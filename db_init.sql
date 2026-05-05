USE TransferDemoDB;
GO

IF OBJECT_ID('dbo.sp_GetSplitBillDetail', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GetSplitBillDetail;
IF OBJECT_ID('dbo.sp_GetSplitBills', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GetSplitBills;
IF OBJECT_ID('dbo.sp_CreateSplitBill', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_CreateSplitBill;
IF OBJECT_ID('dbo.sp_GetRecurringTransfers', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GetRecurringTransfers;
IF OBJECT_ID('dbo.sp_CancelRecurringTransfer', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_CancelRecurringTransfer;
IF OBJECT_ID('dbo.sp_UpdateRecurringTransfer', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_UpdateRecurringTransfer;
IF OBJECT_ID('dbo.sp_CreateRecurringTransfer', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_CreateRecurringTransfer;
IF OBJECT_ID('dbo.sp_ExecuteRecurringTransfers', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_ExecuteRecurringTransfers;
IF OBJECT_ID('dbo.sp_MarkNotificationsRead', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_MarkNotificationsRead;
IF OBJECT_ID('dbo.sp_GetNotifications', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GetNotifications;
IF OBJECT_ID('dbo.sp_DeleteBudget', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_DeleteBudget;
IF OBJECT_ID('dbo.sp_UpsertBudget', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_UpsertBudget;
IF OBJECT_ID('dbo.sp_GetBudgetSummary', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GetBudgetSummary;
IF OBJECT_ID('dbo.sp_GetBalanceHistory', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GetBalanceHistory;
IF OBJECT_ID('dbo.sp_GetExpenseStats', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GetExpenseStats;
IF OBJECT_ID('dbo.sp_RespondToMoneyRequest', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_RespondToMoneyRequest;
IF OBJECT_ID('dbo.sp_CreateMoneyRequest', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_CreateMoneyRequest;
IF OBJECT_ID('dbo.sp_TransferMoney', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_TransferMoney;
IF OBJECT_ID('dbo.sp_GetWalletDashboard', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GetWalletDashboard;
IF OBJECT_ID('dbo.sp_LoginWalletUser', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_LoginWalletUser;
IF OBJECT_ID('dbo.sp_RegisterWalletUser', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_RegisterWalletUser;
GO

IF OBJECT_ID('dbo.trg_AuditWalletBalance', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_AuditWalletBalance;
GO

IF OBJECT_ID('dbo.SplitBillParticipants', 'U') IS NOT NULL DROP TABLE dbo.SplitBillParticipants;
IF OBJECT_ID('dbo.SplitBills', 'U') IS NOT NULL DROP TABLE dbo.SplitBills;
IF OBJECT_ID('dbo.RecurringTransfers', 'U') IS NOT NULL DROP TABLE dbo.RecurringTransfers;
IF OBJECT_ID('dbo.Notifications', 'U') IS NOT NULL DROP TABLE dbo.Notifications;
IF OBJECT_ID('dbo.Budgets', 'U') IS NOT NULL DROP TABLE dbo.Budgets;
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
    Tag NVARCHAR(40) NULL,
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

CREATE TABLE dbo.Budgets (
    BudgetId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    Tag NVARCHAR(40) NULL,
    MonthlyLimit DECIMAL(18,2) NOT NULL CONSTRAINT CK_Budgets_MonthlyLimit CHECK (MonthlyLimit > 0),
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Budgets_CreatedAt DEFAULT SYSDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Budgets_UpdatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT FK_Budgets_User FOREIGN KEY (UserId) REFERENCES dbo.WalletUsers(UserId),
    CONSTRAINT UQ_Budgets_PerUserTag UNIQUE (UserId, Tag)
);
GO

CREATE TABLE dbo.Notifications (
    NotificationId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    Type NVARCHAR(40) NOT NULL,
    Title NVARCHAR(120) NOT NULL,
    Body NVARCHAR(500) NULL,
    ReferenceId INT NULL,
    IsRead BIT NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT FK_Notifications_User FOREIGN KEY (UserId) REFERENCES dbo.WalletUsers(UserId)
);
GO

CREATE INDEX IX_Notifications_User_Unread
    ON dbo.Notifications (UserId, IsRead)
    WHERE IsRead = 0;
GO

CREATE TABLE dbo.RecurringTransfers (
    RecurringId INT IDENTITY(1,1) PRIMARY KEY,
    SenderUserId INT NOT NULL,
    RecipientUserId INT NOT NULL,
    Amount DECIMAL(18,2) NOT NULL CONSTRAINT CK_RecurringTransfers_Amount CHECK (Amount > 0),
    Memo NVARCHAR(160) NULL,
    Tag NVARCHAR(40) NULL,
    Frequency NVARCHAR(20) NOT NULL
        CONSTRAINT CK_RecurringTransfers_Frequency CHECK (Frequency IN ('daily','weekly','biweekly','monthly')),
    NextRunDate DATE NOT NULL,
    LastRunDate DATE NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_RecurringTransfers_IsActive DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_RecurringTransfers_CreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT FK_RecurringTransfers_Sender FOREIGN KEY (SenderUserId) REFERENCES dbo.WalletUsers(UserId),
    CONSTRAINT FK_RecurringTransfers_Recipient FOREIGN KEY (RecipientUserId) REFERENCES dbo.WalletUsers(UserId),
    CONSTRAINT CK_RecurringTransfers_DifferentUsers CHECK (SenderUserId <> RecipientUserId)
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
    @Memo NVARCHAR(160) = NULL,
    @Tag NVARCHAR(40) = NULL
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

        INSERT INTO dbo.TransferTransactions (SenderUserId, RecipientUserId, Amount, Memo, Tag)
        VALUES (@SenderUserId, @RecipientUserId, @Amount, NULLIF(@Memo, ''), NULLIF(@Tag, ''));

        INSERT INTO dbo.Notifications (UserId, Type, Title, Body, ReferenceId)
        VALUES
            (@RecipientUserId, 'transfer_received',
             'Money received from ' + @SenderName,
             'You received ' + FORMAT(@Amount, 'C', 'en-US') + ' from ' + @SenderName + '.',
             SCOPE_IDENTITY()),
            (@SenderUserId, 'transfer_sent',
             'Transfer sent to ' + @RecipientName,
             'You sent ' + FORMAT(@Amount, 'C', 'en-US') + ' to ' + @RecipientName + '.',
             SCOPE_IDENTITY());

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

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @RequesterUserId = RequesterUserId,
            @ActualPayerUserId = PayerUserId,
            @Amount = Amount,
            @Memo = Memo,
            @CurrentStatus = Status
        FROM dbo.MoneyRequests WITH (UPDLOCK, HOLDLOCK)
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

            IF @SenderAccountId IS NULL
                THROW 55004, 'The payer account does not exist.', 1;

            IF @RecipientAccountId IS NULL
                THROW 55005, 'The requester account does not exist.', 1;

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
            WHERE RequestId = @RequestId
              AND Status = 'pending';

            IF @@ROWCOUNT = 0
                THROW 55002, 'This request has already been responded to.', 1;

            INSERT INTO dbo.Notifications (UserId, Type, Title, Body, ReferenceId)
            VALUES
                (@RequesterUserId, 'request_accepted',
                 @PayerName + ' accepted your request',
                 @PayerName + ' paid ' + FORMAT(@Amount, 'C', 'en-US') + ' for your money request.',
                 @RequestId);

            SELECT
                'Request accepted and transfer completed.' AS Message,
                @PayerName AS PayerName,
                @RequesterName AS RequesterName,
                @Amount AS Amount;
        END
        ELSE
        BEGIN
            UPDATE dbo.MoneyRequests
            SET Status = 'declined', RespondedAt = SYSDATETIME()
            WHERE RequestId = @RequestId
              AND Status = 'pending';

            IF @@ROWCOUNT = 0
                THROW 55002, 'This request has already been responded to.', 1;

            INSERT INTO dbo.Notifications (UserId, Type, Title, Body, ReferenceId)
            VALUES
                (@RequesterUserId, 'request_declined',
                 @PayerName + ' declined your request',
                 @PayerName + ' declined your ' + FORMAT(@Amount, 'C', 'en-US') + ' money request.',
                 @RequestId);

            SELECT 'Request declined.' AS Message;
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH
END;
GO

CREATE TABLE dbo.SplitBills (
    SplitBillId INT IDENTITY(1,1) PRIMARY KEY,
    CreatorUserId INT NOT NULL,
    Description NVARCHAR(160) NOT NULL,
    TotalAmount DECIMAL(18,2) NOT NULL CONSTRAINT CK_SplitBills_TotalAmount CHECK (TotalAmount > 0),
    SplitMethod NVARCHAR(20) NOT NULL CONSTRAINT DF_SplitBills_SplitMethod DEFAULT 'equal'
        CONSTRAINT CK_SplitBills_SplitMethod CHECK (SplitMethod IN ('equal','custom')),
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_SplitBills_Status DEFAULT 'open'
        CONSTRAINT CK_SplitBills_Status CHECK (Status IN ('open','settled','cancelled')),
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_SplitBills_CreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT FK_SplitBills_Creator FOREIGN KEY (CreatorUserId) REFERENCES dbo.WalletUsers(UserId)
);
GO

CREATE TABLE dbo.SplitBillParticipants (
    ParticipantId INT IDENTITY(1,1) PRIMARY KEY,
    SplitBillId INT NOT NULL,
    UserId INT NOT NULL,
    ShareAmount DECIMAL(18,2) NOT NULL CONSTRAINT CK_SplitBillParticipants_ShareAmount CHECK (ShareAmount > 0),
    RequestId INT NULL,
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_SplitBillParticipants_Status DEFAULT 'pending'
        CONSTRAINT CK_SplitBillParticipants_Status CHECK (Status IN ('pending','paid','declined')),
    CONSTRAINT FK_SplitBillParticipants_SplitBill FOREIGN KEY (SplitBillId) REFERENCES dbo.SplitBills(SplitBillId),
    CONSTRAINT FK_SplitBillParticipants_User FOREIGN KEY (UserId) REFERENCES dbo.WalletUsers(UserId),
    CONSTRAINT FK_SplitBillParticipants_Request FOREIGN KEY (RequestId) REFERENCES dbo.MoneyRequests(RequestId),
    CONSTRAINT UQ_SplitBillParticipants_PerBill UNIQUE (SplitBillId, UserId)
);
GO

-- ============================================================
-- Feature 1: Expense Statistics
-- ============================================================

CREATE PROCEDURE dbo.sp_GetExpenseStats
    @UserId INT,
    @FromDate DATETIME2 = NULL,
    @ToDate DATETIME2 = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Record set 1: Summary
    SELECT
        ISNULL(SUM(CASE WHEN t.SenderUserId = @UserId THEN t.Amount END), 0) AS TotalSent,
        ISNULL(SUM(CASE WHEN t.RecipientUserId = @UserId THEN t.Amount END), 0) AS TotalReceived,
        ISNULL(SUM(CASE WHEN t.RecipientUserId = @UserId THEN t.Amount END), 0)
            - ISNULL(SUM(CASE WHEN t.SenderUserId = @UserId THEN t.Amount END), 0) AS NetFlow
    FROM dbo.TransferTransactions t
    WHERE (t.SenderUserId = @UserId OR t.RecipientUserId = @UserId)
      AND (@FromDate IS NULL OR t.CreatedAt >= @FromDate)
      AND (@ToDate IS NULL OR t.CreatedAt <= @ToDate);

    -- Record set 2: By Tag (outgoing only)
    SELECT
        ISNULL(t.Tag, 'Uncategorized') AS Tag,
        SUM(t.Amount) AS Total,
        COUNT(*) AS TransactionCount
    FROM dbo.TransferTransactions t
    WHERE t.SenderUserId = @UserId
      AND (@FromDate IS NULL OR t.CreatedAt >= @FromDate)
      AND (@ToDate IS NULL OR t.CreatedAt <= @ToDate)
    GROUP BY t.Tag
    ORDER BY Total DESC;

    -- Record set 3: By Counterparty
    SELECT
        u.UserId AS CounterpartyUserId,
        u.FullName AS CounterpartyName,
        SUM(t.Amount) AS TotalSent
    FROM dbo.TransferTransactions t
    INNER JOIN dbo.WalletUsers u
        ON u.UserId = t.RecipientUserId
    WHERE t.SenderUserId = @UserId
      AND (@FromDate IS NULL OR t.CreatedAt >= @FromDate)
      AND (@ToDate IS NULL OR t.CreatedAt <= @ToDate)
    GROUP BY u.UserId, u.FullName
    ORDER BY TotalSent DESC;
END;
GO

-- ============================================================
-- Feature 2: Balance History
-- ============================================================

CREATE PROCEDURE dbo.sp_GetBalanceHistory
    @UserId INT,
    @FromDate DATETIME2 = NULL,
    @ToDate DATETIME2 = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @AccountId INT;
    SELECT @AccountId = AccountId FROM dbo.WalletAccounts WHERE UserId = @UserId;

    IF @AccountId IS NULL
        RETURN;

    -- Opening balance point (account creation)
    SELECT
        a.CreatedAt AS PointDate,
        a.Balance - ISNULL((
            SELECT SUM(logs.Delta)
            FROM dbo.AccountAuditLogs logs
            WHERE logs.AccountId = @AccountId
        ), 0) AS Balance
    FROM dbo.WalletAccounts a
    WHERE a.AccountId = @AccountId

    UNION ALL

    SELECT
        logs.ActionDate AS PointDate,
        logs.NewBalance AS Balance
    FROM dbo.AccountAuditLogs logs
    WHERE logs.AccountId = @AccountId
      AND (@FromDate IS NULL OR logs.ActionDate >= @FromDate)
      AND (@ToDate IS NULL OR logs.ActionDate <= @ToDate)

    ORDER BY PointDate ASC;
END;
GO

-- ============================================================
-- Feature 3: Budgeting
-- ============================================================

CREATE PROCEDURE dbo.sp_GetBudgetSummary
    @UserId INT,
    @Month INT,
    @Year INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @StartDate DATE = DATEFROMPARTS(@Year, @Month, 1);
    DECLARE @EndDate DATE = DATEADD(MONTH, 1, @StartDate);

    SELECT
        b.BudgetId,
        ISNULL(b.Tag, 'Overall') AS Tag,
        b.MonthlyLimit,
        ISNULL(spent.Total, 0) AS SpentThisMonth,
        b.MonthlyLimit - ISNULL(spent.Total, 0) AS RemainingAmount,
        CASE WHEN b.MonthlyLimit > 0
            THEN CAST(ROUND(ISNULL(spent.Total, 0) * 100.0 / b.MonthlyLimit, 1) AS DECIMAL(5,1))
            ELSE 0
        END AS PercentUsed
    FROM dbo.Budgets b
    LEFT JOIN (
        SELECT
            ISNULL(t.Tag, 'Overall') AS MatchTag,
            SUM(t.Amount) AS Total
        FROM dbo.TransferTransactions t
        WHERE t.SenderUserId = @UserId
          AND t.CreatedAt >= @StartDate
          AND t.CreatedAt < @EndDate
        GROUP BY ISNULL(t.Tag, 'Overall')
    ) spent ON (
        (b.Tag IS NULL AND spent.MatchTag = 'Overall')
        OR b.Tag = spent.MatchTag
    )
    WHERE b.UserId = @UserId
    ORDER BY b.Tag;
END;
GO

CREATE PROCEDURE dbo.sp_UpsertBudget
    @UserId INT,
    @Tag NVARCHAR(40) = NULL,
    @MonthlyLimit DECIMAL(18,2)
AS
BEGIN
    SET NOCOUNT ON;

    IF @MonthlyLimit <= 0
        THROW 56000, 'Monthly limit must be greater than zero.', 1;

    IF EXISTS (
        SELECT 1 FROM dbo.Budgets
        WHERE UserId = @UserId
          AND ((Tag IS NULL AND @Tag IS NULL) OR Tag = @Tag)
    )
    BEGIN
        UPDATE dbo.Budgets
        SET MonthlyLimit = @MonthlyLimit, UpdatedAt = SYSDATETIME()
        WHERE UserId = @UserId
          AND ((Tag IS NULL AND @Tag IS NULL) OR Tag = @Tag);
    END
    ELSE
    BEGIN
        INSERT INTO dbo.Budgets (UserId, Tag, MonthlyLimit)
        VALUES (@UserId, NULLIF(@Tag, ''), @MonthlyLimit);
    END

    SELECT
        b.BudgetId,
        ISNULL(b.Tag, 'Overall') AS Tag,
        b.MonthlyLimit
    FROM dbo.Budgets b
    WHERE b.UserId = @UserId
      AND ((b.Tag IS NULL AND @Tag IS NULL) OR b.Tag = @Tag);
END;
GO

CREATE PROCEDURE dbo.sp_DeleteBudget
    @UserId INT,
    @BudgetId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.Budgets
    WHERE BudgetId = @BudgetId AND UserId = @UserId;

    IF @@ROWCOUNT = 0
        THROW 56001, 'Budget not found or you do not own it.', 1;

    SELECT 'Budget deleted.' AS Message;
END;
GO

-- ============================================================
-- Feature 4: Notifications
-- ============================================================

CREATE PROCEDURE dbo.sp_GetNotifications
    @UserId INT,
    @Limit INT = 20,
    @OnlyUnread BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (@Limit)
        n.NotificationId,
        n.Type,
        n.Title,
        n.Body,
        n.ReferenceId,
        n.IsRead,
        n.CreatedAt
    FROM dbo.Notifications n
    WHERE n.UserId = @UserId
      AND (@OnlyUnread = 0 OR n.IsRead = 0)
    ORDER BY n.CreatedAt DESC;
END;
GO

CREATE PROCEDURE dbo.sp_MarkNotificationsRead
    @UserId INT,
    @NotificationIds NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Notifications
    SET IsRead = 1
    WHERE UserId = @UserId
      AND IsRead = 0
      AND NotificationId IN (
          SELECT CAST(value AS INT)
          FROM STRING_SPLIT(@NotificationIds, ',')
          WHERE ISNUMERIC(value) = 1
      );

    SELECT @@ROWCOUNT AS MarkedCount;
END;
GO

-- ============================================================
-- Feature 5: Recurring Transfers
-- ============================================================

CREATE PROCEDURE dbo.sp_CreateRecurringTransfer
    @SenderUserId INT,
    @RecipientUserId INT,
    @Amount DECIMAL(18,2),
    @Memo NVARCHAR(160) = NULL,
    @Tag NVARCHAR(40) = NULL,
    @Frequency NVARCHAR(20),
    @NextRunDate DATE
AS
BEGIN
    SET NOCOUNT ON;

    IF @SenderUserId = @RecipientUserId
        THROW 57000, 'You cannot create a recurring transfer to yourself.', 1;

    IF @Amount <= 0
        THROW 57001, 'Amount must be greater than zero.', 1;

    IF @Frequency NOT IN ('daily','weekly','biweekly','monthly')
        THROW 57002, 'Frequency must be daily, weekly, biweekly, or monthly.', 1;

    INSERT INTO dbo.RecurringTransfers (SenderUserId, RecipientUserId, Amount, Memo, Tag, Frequency, NextRunDate)
    VALUES (@SenderUserId, @RecipientUserId, @Amount, NULLIF(@Memo, ''), NULLIF(@Tag, ''), @Frequency, @NextRunDate);

    SELECT
        r.RecurringId,
        r.SenderUserId,
        recipient.FullName AS RecipientName,
        recipient.Email AS RecipientEmail,
        r.Amount,
        r.Memo,
        r.Tag,
        r.Frequency,
        r.NextRunDate,
        r.IsActive
    FROM dbo.RecurringTransfers r
    INNER JOIN dbo.WalletUsers recipient
        ON recipient.UserId = r.RecipientUserId
    WHERE r.RecurringId = SCOPE_IDENTITY();
END;
GO

CREATE PROCEDURE dbo.sp_UpdateRecurringTransfer
    @RecurringId INT,
    @SenderUserId INT,
    @Amount DECIMAL(18,2) = NULL,
    @Memo NVARCHAR(160) = NULL,
    @Tag NVARCHAR(40) = NULL,
    @Frequency NVARCHAR(20) = NULL,
    @IsActive BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.RecurringTransfers WHERE RecurringId = @RecurringId AND SenderUserId = @SenderUserId)
        THROW 57003, 'Recurring transfer not found or you do not own it.', 1;

    UPDATE dbo.RecurringTransfers
    SET
        Amount = ISNULL(@Amount, Amount),
        Memo = CASE WHEN @Memo IS NOT NULL THEN NULLIF(@Memo, '') ELSE Memo END,
        Tag = CASE WHEN @Tag IS NOT NULL THEN NULLIF(@Tag, '') ELSE Tag END,
        Frequency = ISNULL(@Frequency, Frequency),
        IsActive = ISNULL(@IsActive, IsActive)
    WHERE RecurringId = @RecurringId AND SenderUserId = @SenderUserId;

    SELECT 'Recurring transfer updated.' AS Message;
END;
GO

CREATE PROCEDURE dbo.sp_CancelRecurringTransfer
    @RecurringId INT,
    @SenderUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.RecurringTransfers
    SET IsActive = 0
    WHERE RecurringId = @RecurringId AND SenderUserId = @SenderUserId;

    IF @@ROWCOUNT = 0
        THROW 57004, 'Recurring transfer not found or you do not own it.', 1;

    SELECT 'Recurring transfer cancelled.' AS Message;
END;
GO

CREATE PROCEDURE dbo.sp_GetRecurringTransfers
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.RecurringId,
        r.RecipientUserId,
        recipient.FullName AS RecipientName,
        recipient.Email AS RecipientEmail,
        r.Amount,
        r.Memo,
        r.Tag,
        r.Frequency,
        r.NextRunDate,
        r.LastRunDate,
        r.IsActive,
        r.CreatedAt
    FROM dbo.RecurringTransfers r
    INNER JOIN dbo.WalletUsers recipient
        ON recipient.UserId = r.RecipientUserId
    WHERE r.SenderUserId = @UserId
    ORDER BY r.IsActive DESC, r.NextRunDate ASC;
END;
GO

CREATE PROCEDURE dbo.sp_ExecuteRecurringTransfers
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);
    DECLARE @RecurringId INT, @SenderUserId INT, @RecipientUserId INT;
    DECLARE @Amount DECIMAL(18,2), @Memo NVARCHAR(160), @Tag NVARCHAR(40), @Frequency NVARCHAR(20);

    DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT RecurringId, SenderUserId, RecipientUserId, Amount, Memo, Tag, Frequency
        FROM dbo.RecurringTransfers WITH (UPDLOCK, HOLDLOCK)
        WHERE IsActive = 1 AND NextRunDate <= @Today;

    OPEN cur;
    FETCH NEXT FROM cur INTO @RecurringId, @SenderUserId, @RecipientUserId, @Amount, @Memo, @Tag, @Frequency;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            BEGIN TRANSACTION;

            DECLARE @SenderAccountId INT, @SenderBalance DECIMAL(18,2);
            DECLARE @RecipientAccountId INT;
            DECLARE @SenderName NVARCHAR(120), @RecipientName NVARCHAR(120);

            SELECT @SenderAccountId = a.AccountId, @SenderBalance = a.Balance, @SenderName = u.FullName
            FROM dbo.WalletAccounts a WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN dbo.WalletUsers u ON u.UserId = a.UserId
            WHERE a.UserId = @SenderUserId;

            SELECT @RecipientAccountId = a.AccountId, @RecipientName = u.FullName
            FROM dbo.WalletAccounts a WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN dbo.WalletUsers u ON u.UserId = a.UserId
            WHERE a.UserId = @RecipientUserId;

            IF @SenderBalance < @Amount
            BEGIN
                INSERT INTO dbo.Notifications (UserId, Type, Title, Body, ReferenceId)
                VALUES (@SenderUserId, 'recurring_failed',
                    'Recurring transfer failed',
                    'Insufficient balance to send ' + FORMAT(@Amount, 'C', 'en-US') + ' to ' + @RecipientName + '.',
                    @RecurringId);

                COMMIT TRANSACTION;
                FETCH NEXT FROM cur INTO @RecurringId, @SenderUserId, @RecipientUserId, @Amount, @Memo, @Tag, @Frequency;
                CONTINUE;
            END

            UPDATE dbo.WalletAccounts SET Balance = Balance - @Amount WHERE AccountId = @SenderAccountId;
            UPDATE dbo.WalletAccounts SET Balance = Balance + @Amount WHERE AccountId = @RecipientAccountId;

            INSERT INTO dbo.TransferTransactions (SenderUserId, RecipientUserId, Amount, Memo, Tag)
            VALUES (@SenderUserId, @RecipientUserId, @Amount, ISNULL(@Memo, 'Recurring transfer'), @Tag);

            DECLARE @NewNextRunDate DATE = CASE @Frequency
                WHEN 'daily' THEN DATEADD(DAY, 1, @Today)
                WHEN 'weekly' THEN DATEADD(WEEK, 1, @Today)
                WHEN 'biweekly' THEN DATEADD(WEEK, 2, @Today)
                WHEN 'monthly' THEN DATEADD(MONTH, 1, @Today)
            END;

            UPDATE dbo.RecurringTransfers
            SET LastRunDate = @Today, NextRunDate = @NewNextRunDate
            WHERE RecurringId = @RecurringId;

            INSERT INTO dbo.Notifications (UserId, Type, Title, Body, ReferenceId)
            VALUES
                (@SenderUserId, 'recurring_executed',
                 'Recurring transfer executed',
                 FORMAT(@Amount, 'C', 'en-US') + ' sent to ' + @RecipientName + '.',
                 @RecurringId),
                (@RecipientUserId, 'transfer_received',
                 'Money received from ' + @SenderName,
                 'You received ' + FORMAT(@Amount, 'C', 'en-US') + ' from ' + @SenderName + ' (recurring).',
                 @RecurringId);

            COMMIT TRANSACTION;
        END TRY
        BEGIN CATCH
            IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        END CATCH

        FETCH NEXT FROM cur INTO @RecurringId, @SenderUserId, @RecipientUserId, @Amount, @Memo, @Tag, @Frequency;
    END

    CLOSE cur;
    DEALLOCATE cur;
END;
GO

-- ============================================================
-- Feature 6: Split Bill
-- ============================================================

CREATE PROCEDURE dbo.sp_CreateSplitBill
    @CreatorUserId INT,
    @Description NVARCHAR(160),
    @TotalAmount DECIMAL(18,2),
    @SplitMethod NVARCHAR(20) = 'equal',
    @ParticipantUserIds NVARCHAR(MAX),
    @ParticipantAmounts NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TotalAmount <= 0
        THROW 58000, 'Total amount must be greater than zero.', 1;

    DECLARE @Participants TABLE (Idx INT IDENTITY(1,1), UserId INT, ShareAmount DECIMAL(18,2));
    DECLARE @ParticipantCount INT;

    INSERT INTO @Participants (UserId)
    SELECT CAST(value AS INT) FROM STRING_SPLIT(@ParticipantUserIds, ',')
    WHERE ISNUMERIC(value) = 1;

    SET @ParticipantCount = (SELECT COUNT(*) FROM @Participants);

    IF @ParticipantCount = 0
        THROW 58001, 'At least one participant is required.', 1;

    IF @SplitMethod = 'equal'
    BEGIN
        DECLARE @BaseShare DECIMAL(18,2) = ROUND(@TotalAmount / @ParticipantCount, 2);
        DECLARE @Remainder DECIMAL(18,2) = @TotalAmount - (@BaseShare * @ParticipantCount);

        UPDATE @Participants SET ShareAmount = @BaseShare;
        UPDATE @Participants SET ShareAmount = ShareAmount + @Remainder WHERE Idx = 1;
    END
    ELSE
    BEGIN
        DECLARE @Amounts TABLE (Idx INT IDENTITY(1,1), Amount DECIMAL(18,2));
        INSERT INTO @Amounts (Amount)
        SELECT CAST(value AS DECIMAL(18,2)) FROM STRING_SPLIT(@ParticipantAmounts, ',')
        WHERE ISNUMERIC(value) = 1;

        UPDATE p SET p.ShareAmount = a.Amount
        FROM @Participants p
        INNER JOIN @Amounts a ON p.Idx = a.Idx;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO dbo.SplitBills (CreatorUserId, Description, TotalAmount, SplitMethod)
        VALUES (@CreatorUserId, @Description, @TotalAmount, @SplitMethod);

        DECLARE @SplitBillId INT = SCOPE_IDENTITY();
        DECLARE @Idx INT = 1, @PUserId INT, @ShareAmt DECIMAL(18,2), @ReqId INT;

        WHILE @Idx <= @ParticipantCount
        BEGIN
            SELECT @PUserId = UserId, @ShareAmt = ShareAmount
            FROM @Participants WHERE Idx = @Idx;

            IF @PUserId <> @CreatorUserId
            BEGIN
                INSERT INTO dbo.MoneyRequests (RequesterUserId, PayerUserId, Amount, Memo)
                VALUES (@CreatorUserId, @PUserId, @ShareAmt,
                    'Split: ' + @Description);

                SET @ReqId = SCOPE_IDENTITY();

                INSERT INTO dbo.SplitBillParticipants (SplitBillId, UserId, ShareAmount, RequestId)
                VALUES (@SplitBillId, @PUserId, @ShareAmt, @ReqId);

                INSERT INTO dbo.Notifications (UserId, Type, Title, Body, ReferenceId)
                VALUES (@PUserId, 'split_bill_created',
                    'New split bill from ' + (SELECT FullName FROM dbo.WalletUsers WHERE UserId = @CreatorUserId),
                    'You owe ' + FORMAT(@ShareAmt, 'C', 'en-US') + ' for "' + @Description + '".',
                    @SplitBillId);
            END
            ELSE
            BEGIN
                INSERT INTO dbo.SplitBillParticipants (SplitBillId, UserId, ShareAmount, Status)
                VALUES (@SplitBillId, @PUserId, @ShareAmt, 'paid');
            END

            SET @Idx = @Idx + 1;
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH

    SELECT @SplitBillId AS SplitBillId;
END;
GO

CREATE PROCEDURE dbo.sp_GetSplitBills
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        sb.SplitBillId,
        sb.CreatorUserId,
        creator.FullName AS CreatorName,
        sb.Description,
        sb.TotalAmount,
        sb.SplitMethod,
        sb.Status,
        sb.CreatedAt,
        (
            SELECT COUNT(*) FROM dbo.SplitBillParticipants p
            WHERE p.SplitBillId = sb.SplitBillId
        ) AS ParticipantCount,
        (
            SELECT COUNT(*) FROM dbo.SplitBillParticipants p
            WHERE p.SplitBillId = sb.SplitBillId AND p.Status = 'paid'
        ) AS PaidCount
    FROM dbo.SplitBills sb
    INNER JOIN dbo.WalletUsers creator
        ON creator.UserId = sb.CreatorUserId
    WHERE sb.CreatorUserId = @UserId
       OR sb.SplitBillId IN (
           SELECT SplitBillId FROM dbo.SplitBillParticipants WHERE UserId = @UserId
       )
    ORDER BY sb.CreatedAt DESC;
END;
GO

CREATE PROCEDURE dbo.sp_GetSplitBillDetail
    @SplitBillId INT,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        sb.SplitBillId,
        sb.CreatorUserId,
        creator.FullName AS CreatorName,
        sb.Description,
        sb.TotalAmount,
        sb.SplitMethod,
        sb.Status,
        sb.CreatedAt
    FROM dbo.SplitBills sb
    INNER JOIN dbo.WalletUsers creator
        ON creator.UserId = sb.CreatorUserId
    WHERE sb.SplitBillId = @SplitBillId;

    SELECT
        p.ParticipantId,
        p.UserId,
        u.FullName,
        u.Email,
        p.ShareAmount,
        p.RequestId,
        p.Status
    FROM dbo.SplitBillParticipants p
    INNER JOIN dbo.WalletUsers u
        ON u.UserId = p.UserId
    WHERE p.SplitBillId = @SplitBillId
    ORDER BY p.ParticipantId;
END;
GO

-- ============================================================
-- Seed data
-- ============================================================

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
