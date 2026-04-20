-- Tạo cơ sở dữ liệu nếu chưa có (Tuỳ chọn phần này tuỳ môi trường của bạn)
-- Nếu đã có DB, hãy đổi 'TransferDemoDB' thành tên DB của bạn
-- CREATE DATABASE TransferDemoDB;
-- GO
-- USE TransferDemoDB;
-- GO

-- 1. TẠO CÁC BẢNG (TABLES)
IF OBJECT_ID('Transactions', 'U') IS NOT NULL DROP TABLE Transactions;
IF OBJECT_ID('AuditLogs', 'U') IS NOT NULL DROP TABLE AuditLogs;
IF OBJECT_ID('Accounts', 'U') IS NOT NULL DROP TABLE Accounts;

CREATE TABLE Accounts (
    AccountId INT IDENTITY(1,1) PRIMARY KEY,
    AccountName NVARCHAR(100) NOT NULL,
    Balance DECIMAL(18,2) NOT NULL CHECK (Balance >= 0) -- Ràng buộc không cho số dư âm
);

CREATE TABLE Transactions (
    TransactionId INT IDENTITY(1,1) PRIMARY KEY,
    FromAccountId INT,
    ToAccountId INT,
    Amount DECIMAL(18,2) NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (FromAccountId) REFERENCES Accounts(AccountId),
    FOREIGN KEY (ToAccountId) REFERENCES Accounts(AccountId)
);

CREATE TABLE AuditLogs (
    LogId INT IDENTITY(1,1) PRIMARY KEY,
    AccountId INT,
    OldBalance DECIMAL(18,2),
    NewBalance DECIMAL(18,2),
    ActionDate DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (AccountId) REFERENCES Accounts(AccountId)
);
GO

-- 2. TẠO TRIGGER LƯU VẾT (AUDIT)
CREATE OR ALTER TRIGGER trg_AuditAccountBalance
ON Accounts
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Thêm log vào bảng AuditLogs khi có thay đổi số dư
    INSERT INTO AuditLogs (AccountId, OldBalance, NewBalance, ActionDate)
    SELECT 
        i.AccountId,
        d.Balance,
        i.Balance,
        GETDATE()
    FROM inserted i
    JOIN deleted d ON i.AccountId = d.AccountId
    WHERE i.Balance <> d.Balance; -- Chỉ log khi số dư thực sự thay đổi
END;
GO

-- 3. TẠO STORED PROCEDURE VÀ TRANSACTION CHUYỂN TIỀN
CREATE OR ALTER PROCEDURE sp_TransferMoney
    @FromAccount INT,
    @ToAccount INT,
    @Amount DECIMAL(18,2)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Nếu From và To giống nhau thì ném lỗi
    IF @FromAccount = @ToAccount
    BEGIN
        THROW 51001, 'Không thể chuyển tiền cho chính mình.', 1;
        RETURN;
    END

    BEGIN TRY
        -- Bắt đầu Transaction
        BEGIN TRANSACTION;

        -- Kiểm tra số dư người gửi
        DECLARE @CurrentBalance DECIMAL(18,2);
        SELECT @CurrentBalance = Balance FROM Accounts WHERE AccountId = @FromAccount;
        
        IF @CurrentBalance IS NULL
        BEGIN
            THROW 51002, 'Tài khoản gửi không tồn tại.', 1;
        END

        IF @CurrentBalance < @Amount
        BEGIN
            THROW 51000, 'Số dư không đủ để thực hiện giao dịch.', 1;
        END

        -- Trừ tiền người gửi
        UPDATE Accounts SET Balance = Balance - @Amount WHERE AccountId = @FromAccount;
        
        -- Cộng tiền người nhận
        UPDATE Accounts SET Balance = Balance + @Amount WHERE AccountId = @ToAccount;

        -- Ghi log giao dịch
        INSERT INTO Transactions (FromAccountId, ToAccountId, Amount)
        VALUES (@FromAccount, @ToAccount, @Amount);

        -- Xác nhận Transaction thành công
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        -- Hủy bỏ Transaction nếu xảy ra bất kỳ lỗi gì
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
            
        -- Báo lỗi ra cho ứng dụng (Node.js)
        THROW;
    END CATCH
END;
GO

-- 4. KHỞI TẠO DỮ LIỆU MẪU
INSERT INTO Accounts (AccountName, Balance) VALUES ('Alice', 1000.00);
INSERT INTO Accounts (AccountName, Balance) VALUES ('Bob', 500.00);
INSERT INTO Accounts (AccountName, Balance) VALUES ('Charlie', 200.00);
GO
