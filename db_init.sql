USE TransferDemoDB;
GO

IF OBJECT_ID('dbo.sp_RespondToMoneyRequest', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_RespondToMoneyRequest;
IF OBJECT_ID('dbo.sp_CreateMoneyRequest', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_CreateMoneyRequest;
IF OBJECT_ID('dbo.sp_TransferMoney', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_TransferMoney;
IF OBJECT_ID('dbo.sp_GetWalletDashboard', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GetWalletDashboard;
IF OBJECT_ID('dbo.sp_LoginWalletUser', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_LoginWalletUser;
IF OBJECT_ID('dbo.sp_RegisterWalletUser', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_RegisterWalletUser;
GO

IF OBJECT_ID('dbo.trg_AuditWalletBalance', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_AuditWalletBalance;
GO

IF OBJECT_ID('dbo.MoneyRequests', 'U') IS NOT NULL DROP TABLE dbo.MoneyRequests;
IF OBJECT_ID('dbo.AccountAuditLogs', 'U') IS NOT NULL DROP TABLE dbo.AccountAuditLogs;
IF OBJECT_ID('dbo.TransferTransactions', 'U') IS NOT NULL DROP TABLE dbo.TransferTransactions;
IF OBJECT_ID('dbo.WalletAccounts', 'U') IS NOT NULL DROP TABLE dbo.WalletAccounts;
IF OBJECT_ID('dbo.WalletUsers', 'U') IS NOT NULL DROP TABLE dbo.WalletUsers;
GO

CREATE TABLE dbo.WalletUsers (
    UserId INT IDENTITY(1,1) PRIMARY KEY,
    FullName NVARCHAR(120) NOT NULL,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    PasswordHash VARBINARY(32) NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_WalletUsers_CreatedAt DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.WalletAccounts (
    AccountId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL UNIQUE,
    Balance DECIMAL(18,2) NOT NULL CONSTRAINT CK_WalletAccounts_Balance CHECK (Balance >= 0),
    CurrencyCode CHAR(3) NOT NULL CONSTRAINT DF_WalletAccounts_Currency DEFAULT 'USD',
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_WalletAccounts_CreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT FK_WalletAccounts_User FOREIGN KEY (UserId) REFERENCES dbo.WalletUsers(UserId)
);
GO

CREATE TABLE dbo.TransferTransactions (
    TransferId INT IDENTITY(1,1) PRIMARY KEY,
    SenderUserId INT NOT NULL,
    RecipientUserId INT NOT NULL,
    Amount DECIMAL(18,2) NOT NULL CONSTRAINT CK_TransferTransactions_Amount CHECK (Amount > 0),
    Memo NVARCHAR(160) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_TransferTransactions_CreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT FK_TransferTransactions_Sender FOREIGN KEY (SenderUserId) REFERENCES dbo.WalletUsers(UserId),
    CONSTRAINT FK_TransferTransactions_Recipient FOREIGN KEY (RecipientUserId) REFERENCES dbo.WalletUsers(UserId)
);
GO

CREATE TABLE dbo.AccountAuditLogs (
    AuditId INT IDENTITY(1,1) PRIMARY KEY,
    AccountId INT NOT NULL,
    OldBalance DECIMAL(18,2) NOT NULL,
    NewBalance DECIMAL(18,2) NOT NULL,
    Delta DECIMAL(18,2) NOT NULL,
    ActionLabel NVARCHAR(50) NOT NULL CONSTRAINT DF_AccountAuditLogs_ActionLabel DEFAULT 'BALANCE_UPDATED',
    ActionDate DATETIME2 NOT NULL CONSTRAINT DF_AccountAuditLogs_ActionDate DEFAULT SYSDATETIME(),
    CONSTRAINT FK_AccountAuditLogs_Account FOREIGN KEY (AccountId) REFERENCES dbo.WalletAccounts(AccountId)
);
GO

CREATE TABLE dbo.MoneyRequests (
    RequestId INT IDENTITY(1,1) PRIMARY KEY,
    RequesterUserId INT NOT NULL,
    PayerUserId INT NOT NULL,
    Amount DECIMAL(18,2) NOT NULL CONSTRAINT CK_MoneyRequests_Amount CHECK (Amount > 0),
    Memo NVARCHAR(160) NULL,
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_MoneyRequests_Status DEFAULT 'pending',
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_MoneyRequests_CreatedAt DEFAULT SYSDATETIME(),
    RespondedAt DATETIME2 NULL,
    CONSTRAINT FK_MoneyRequests_Requester FOREIGN KEY (RequesterUserId) REFERENCES dbo.WalletUsers(UserId),
    CONSTRAINT FK_MoneyRequests_Payer FOREIGN KEY (PayerUserId) REFERENCES dbo.WalletUsers(UserId),
    CONSTRAINT CK_MoneyRequests_Status CHECK (Status IN ('pending', 'accepted', 'declined')),
    CONSTRAINT CK_MoneyRequests_DifferentUsers CHECK (RequesterUserId <> PayerUserId)
);
GO

CREATE TRIGGER dbo.trg_AuditWalletBalance
ON dbo.WalletAccounts
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.AccountAuditLogs (AccountId, OldBalance, NewBalance, Delta, ActionLabel, ActionDate)
    SELECT
        inserted.AccountId,
        deleted.Balance,
        inserted.Balance,
        inserted.Balance - deleted.Balance,
        'BALANCE_UPDATED',
        SYSDATETIME()
    FROM inserted
    INNER JOIN deleted
        ON inserted.AccountId = deleted.AccountId
    WHERE inserted.Balance <> deleted.Balance;
END;
GO

CREATE PROCEDURE dbo.sp_RegisterWalletUser
    @FullName NVARCHAR(120),
    @Email NVARCHAR(255),
    @Password NVARCHAR(128),
    @OpeningBalance DECIMAL(18,2) = 1000.00
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @NormalizedEmail NVARCHAR(255) = LOWER(LTRIM(RTRIM(@Email)));

    IF NULLIF(LTRIM(RTRIM(@FullName)), '') IS NULL
        THROW 52000, 'Full name is required.', 1;

    IF NULLIF(@NormalizedEmail, '') IS NULL
        THROW 52001, 'Email is required.', 1;

    IF NULLIF(@Password, '') IS NULL
        THROW 52002, 'Password is required.', 1;

    IF @OpeningBalance < 0
        THROW 52003, 'Opening balance cannot be negative.', 1;

    IF EXISTS (SELECT 1 FROM dbo.WalletUsers WHERE Email = @NormalizedEmail)
        THROW 52004, 'An account with that email already exists.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO dbo.WalletUsers (FullName, Email, PasswordHash)
        VALUES (@FullName, @NormalizedEmail, HASHBYTES('SHA2_256', @Password));

        DECLARE @UserId INT = SCOPE_IDENTITY();

        INSERT INTO dbo.WalletAccounts (UserId, Balance)
        VALUES (@UserId, @OpeningBalance);

        SELECT
            u.UserId,
            u.FullName,
            u.Email,
            a.AccountId,
            a.Balance,
            a.CurrencyCode,
            u.CreatedAt
        FROM dbo.WalletUsers u
        INNER JOIN dbo.WalletAccounts a
            ON a.UserId = u.UserId
        WHERE u.UserId = @UserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH
END;
GO

CREATE PROCEDURE dbo.sp_LoginWalletUser
    @Email NVARCHAR(255),
    @Password NVARCHAR(128)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedEmail NVARCHAR(255) = LOWER(LTRIM(RTRIM(@Email)));

    SELECT
        u.UserId,
        u.FullName,
        u.Email,
        a.AccountId,
        a.Balance,
        a.CurrencyCode,
        u.CreatedAt
    FROM dbo.WalletUsers u
    INNER JOIN dbo.WalletAccounts a
        ON a.UserId = u.UserId
    WHERE u.Email = @NormalizedEmail
      AND u.PasswordHash = HASHBYTES('SHA2_256', @Password);
END;
GO

CREATE PROCEDURE dbo.sp_GetWalletDashboard
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.UserId,
        u.FullName,
        u.Email,
        a.AccountId,
        a.Balance,
        a.CurrencyCode,
        u.CreatedAt
    FROM dbo.WalletUsers u
    INNER JOIN dbo.WalletAccounts a
        ON a.UserId = u.UserId
    WHERE u.UserId = @UserId;

    SELECT
        u.UserId,
        u.FullName,
        u.Email,
        a.Balance
    FROM dbo.WalletUsers u
    INNER JOIN dbo.WalletAccounts a
        ON a.UserId = u.UserId
    WHERE u.UserId <> @UserId
    ORDER BY u.FullName;

    SELECT TOP (10)
        t.TransferId,
        CASE
            WHEN t.SenderUserId = @UserId THEN 'Sent'
            ELSE 'Received'
        END AS DirectionLabel,
        CASE
            WHEN t.SenderUserId = @UserId THEN recipient.FullName
            ELSE sender.FullName
        END AS CounterpartyName,
        CASE
            WHEN t.SenderUserId = @UserId THEN recipient.Email
            ELSE sender.Email
        END AS CounterpartyEmail,
        t.Amount,
        t.Memo,
        t.CreatedAt
    FROM dbo.TransferTransactions t
    INNER JOIN dbo.WalletUsers sender
        ON sender.UserId = t.SenderUserId
    INNER JOIN dbo.WalletUsers recipient
        ON recipient.UserId = t.RecipientUserId
    WHERE t.SenderUserId = @UserId
       OR t.RecipientUserId = @UserId
    ORDER BY t.CreatedAt DESC;

    SELECT TOP (10)
        logs.AuditId,
        logs.OldBalance,
        logs.NewBalance,
        logs.Delta,
        logs.ActionLabel,
        logs.ActionDate
    FROM dbo.AccountAuditLogs logs
    INNER JOIN dbo.WalletAccounts accounts
        ON accounts.AccountId = logs.AccountId
    WHERE accounts.UserId = @UserId
    ORDER BY logs.ActionDate DESC;

    SELECT
        r.RequestId,
        r.RequesterUserId,
        requester.FullName AS RequesterName,
        requester.Email AS RequesterEmail,
        r.PayerUserId,
        payer.FullName AS PayerName,
        payer.Email AS PayerEmail,
        r.Amount,
        r.Memo,
        r.Status,
        r.CreatedAt,
        r.RespondedAt
    FROM dbo.MoneyRequests r
    INNER JOIN dbo.WalletUsers requester
        ON requester.UserId = r.RequesterUserId
    INNER JOIN dbo.WalletUsers payer
        ON payer.UserId = r.PayerUserId
    WHERE r.RequesterUserId = @UserId
       OR r.PayerUserId = @UserId
    ORDER BY r.CreatedAt DESC;
END;
GO

CREATE PROCEDURE dbo.sp_TransferMoney
    @SenderUserId INT,
    @RecipientUserId INT,
    @Amount DECIMAL(18,2),
    @Memo NVARCHAR(160) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @SenderUserId = @RecipientUserId
        THROW 53000, 'You cannot transfer money to the same account.', 1;

    IF @Amount <= 0
        THROW 53001, 'Transfer amount must be greater than zero.', 1;

    DECLARE @SenderAccountId INT;
    DECLARE @RecipientAccountId INT;
    DECLARE @SenderBalance DECIMAL(18,2);
    DECLARE @SenderName NVARCHAR(120);
    DECLARE @RecipientName NVARCHAR(120);

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @SenderAccountId = a.AccountId,
            @SenderBalance = a.Balance,
            @SenderName = u.FullName
        FROM dbo.WalletAccounts a WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.WalletUsers u
            ON u.UserId = a.UserId
        WHERE a.UserId = @SenderUserId;

        SELECT
            @RecipientAccountId = a.AccountId,
            @RecipientName = u.FullName
        FROM dbo.WalletAccounts a WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.WalletUsers u
            ON u.UserId = a.UserId
        WHERE a.UserId = @RecipientUserId;

        IF @SenderAccountId IS NULL
            THROW 53002, 'The sender account does not exist.', 1;

        IF @RecipientAccountId IS NULL
            THROW 53003, 'The recipient account does not exist.', 1;

        IF @SenderBalance < @Amount
            THROW 53004, 'Insufficient balance for this transfer.', 1;

        UPDATE dbo.WalletAccounts
        SET Balance = Balance - @Amount
        WHERE AccountId = @SenderAccountId;

        UPDATE dbo.WalletAccounts
        SET Balance = Balance + @Amount
        WHERE AccountId = @RecipientAccountId;

        INSERT INTO dbo.TransferTransactions (SenderUserId, RecipientUserId, Amount, Memo)
        VALUES (@SenderUserId, @RecipientUserId, @Amount, NULLIF(@Memo, ''));

        SELECT
            'Transfer completed successfully.' AS Message,
            @SenderName AS SenderName,
            @RecipientName AS RecipientName,
            @Amount AS Amount;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH
END;
GO

CREATE PROCEDURE dbo.sp_CreateMoneyRequest
    @RequesterUserId INT,
    @PayerUserId INT,
    @Amount DECIMAL(18,2),
    @Memo NVARCHAR(160) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RequesterUserId = @PayerUserId
        THROW 54000, 'You cannot request money from yourself.', 1;

    IF @Amount <= 0
        THROW 54001, 'Request amount must be greater than zero.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.WalletAccounts WHERE UserId = @RequesterUserId)
        THROW 54002, 'The requester account does not exist.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.WalletAccounts WHERE UserId = @PayerUserId)
        THROW 54003, 'The payer account does not exist.', 1;

    INSERT INTO dbo.MoneyRequests (RequesterUserId, PayerUserId, Amount, Memo)
    VALUES (@RequesterUserId, @PayerUserId, @Amount, NULLIF(@Memo, ''));

    DECLARE @RequestId INT = SCOPE_IDENTITY();

    SELECT
        r.RequestId,
        r.RequesterUserId,
        requester.FullName AS RequesterName,
        r.PayerUserId,
        payer.FullName AS PayerName,
        r.Amount,
        r.Memo,
        r.Status,
        r.CreatedAt
    FROM dbo.MoneyRequests r
    INNER JOIN dbo.WalletUsers requester
        ON requester.UserId = r.RequesterUserId
    INNER JOIN dbo.WalletUsers payer
        ON payer.UserId = r.PayerUserId
    WHERE r.RequestId = @RequestId;
END;
GO

CREATE PROCEDURE dbo.sp_RespondToMoneyRequest
    @RequestId INT,
    @PayerUserId INT,
    @Accept BIT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @RequesterUserId INT;
    DECLARE @Amount DECIMAL(18,2);
    DECLARE @Memo NVARCHAR(160);
    DECLARE @CurrentStatus NVARCHAR(20);
    DECLARE @ActualPayerUserId INT;

    SELECT
        @RequesterUserId = RequesterUserId,
        @ActualPayerUserId = PayerUserId,
        @Amount = Amount,
        @Memo = Memo,
        @CurrentStatus = Status
    FROM dbo.MoneyRequests
    WHERE RequestId = @RequestId;

    IF @RequesterUserId IS NULL
        THROW 55000, 'The money request does not exist.', 1;

    IF @ActualPayerUserId <> @PayerUserId
        THROW 55001, 'You are not the payer for this request.', 1;

    IF @CurrentStatus <> 'pending'
        THROW 55002, 'This request has already been responded to.', 1;

    IF @Accept = 1
    BEGIN
        DECLARE @SenderAccountId INT;
        DECLARE @RecipientAccountId INT;
        DECLARE @SenderBalance DECIMAL(18,2);
        DECLARE @PayerName NVARCHAR(120);
        DECLARE @RequesterName NVARCHAR(120);

        BEGIN TRY
            BEGIN TRANSACTION;

            SELECT
                @SenderAccountId = a.AccountId,
                @SenderBalance = a.Balance,
                @PayerName = u.FullName
            FROM dbo.WalletAccounts a WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN dbo.WalletUsers u
                ON u.UserId = a.UserId
            WHERE a.UserId = @PayerUserId;

            SELECT
                @RecipientAccountId = a.AccountId,
                @RequesterName = u.FullName
            FROM dbo.WalletAccounts a WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN dbo.WalletUsers u
                ON u.UserId = a.UserId
            WHERE a.UserId = @RequesterUserId;

            IF @SenderBalance < @Amount
                THROW 55003, 'Insufficient balance to fulfill this request.', 1;

            UPDATE dbo.WalletAccounts
            SET Balance = Balance - @Amount
            WHERE AccountId = @SenderAccountId;

            UPDATE dbo.WalletAccounts
            SET Balance = Balance + @Amount
            WHERE AccountId = @RecipientAccountId;

            DECLARE @TransferMemo NVARCHAR(160) = COALESCE(@Memo, 'Payment request #' + CAST(@RequestId AS NVARCHAR(10)));

            INSERT INTO dbo.TransferTransactions (SenderUserId, RecipientUserId, Amount, Memo)
            VALUES (@PayerUserId, @RequesterUserId, @Amount, @TransferMemo);

            UPDATE dbo.MoneyRequests
            SET Status = 'accepted', RespondedAt = SYSDATETIME()
            WHERE RequestId = @RequestId;

            SELECT
                'Request accepted and transfer completed.' AS Message,
                @PayerName AS PayerName,
                @RequesterName AS RequesterName,
                @Amount AS Amount;

            COMMIT TRANSACTION;
        END TRY
        BEGIN CATCH
            IF @@TRANCOUNT > 0
                ROLLBACK TRANSACTION;

            THROW;
        END CATCH
    END
    ELSE
    BEGIN
        UPDATE dbo.MoneyRequests
        SET Status = 'declined', RespondedAt = SYSDATETIME()
        WHERE RequestId = @RequestId;

        SELECT 'Request declined.' AS Message;
    END
END;
GO

EXEC dbo.sp_RegisterWalletUser
    @FullName = 'Alice Tran',
    @Email = 'alice@wallet.demo',
    @Password = 'demo123',
    @OpeningBalance = 2200.00;
GO

EXEC dbo.sp_RegisterWalletUser
    @FullName = 'Bob Nguyen',
    @Email = 'bob@wallet.demo',
    @Password = 'demo123',
    @OpeningBalance = 1450.00;
GO

EXEC dbo.sp_RegisterWalletUser
    @FullName = 'Charlie Pham',
    @Email = 'charlie@wallet.demo',
    @Password = 'demo123',
    @OpeningBalance = 860.00;
GO
