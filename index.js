const express = require('express');
const sql = require('mssql');
const path = require('path');

const app = express();
const port = 3000;

// Cấu hình Database (BẠN CẦN THAY ĐỔI CÁC THÔNG SỐ NÀY ĐỂ CHẠY TRÊN MÁY CỦA BẠN)
const dbConfig = {
    user: 'sa',             // Thay bằng user SQL Server của bạn
    password: '123', // Thay bằng mật khẩu 
    server: 'localhost',    // Tên máy chủ (localhost)
    database: 'TransferDemoDB', // Thay tên DB nếu bạn setup khác
    options: {
        port: 63040, // Port SQL Server đang chạy trực tiếp
        encrypt: false, // Dùng true nếu là Azure
        trustServerCertificate: true // Thường dùng true cho localhost
    }
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Kết nối SQL Server
let pool;
sql.connect(dbConfig).then(p => {
    pool = p;
    console.log('Đã kết nối thành công tới SQL Server!');
}).catch(err => {
    console.error('Lỗi kết nối CSDL, vui lòng kiểm tra lại cấu hình DB ở dbConfig:', err.message);
});

// API: Lấy danh sách Account
app.get('/api/accounts', async (req, res) => {
    try {
        const result = await pool.request().query('SELECT * FROM Accounts');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Lấy lịch sử giao dịch
app.get('/api/transactions', async (req, res) => {
    try {
        const result = await pool.request().query('SELECT * FROM Transactions ORDER BY CreatedAt DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Lấy lịch sử log từ Trigger
app.get('/api/auditlogs', async (req, res) => {
    try {
        const result = await pool.request().query('SELECT * FROM AuditLogs ORDER BY ActionDate DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Thực hiện chuyển khoản (Dùng Stored Procedure và Transaction)
app.post('/api/transfer', async (req, res) => {
    const { fromAccount, toAccount, amount } = req.body;

    if (!fromAccount || !toAccount || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Dữ liệu không hợp lệ (số tiền phải > 0)' });
    }

    try {
        // Gọi Stored Procedure sp_TransferMoney
        const request = pool.request();
        request.input('FromAccount', sql.Int, fromAccount);
        request.input('ToAccount', sql.Int, toAccount);
        request.input('Amount', sql.Decimal(18, 2), amount);

        await request.execute('sp_TransferMoney');

        res.json({ success: true, message: 'Chuyển tiền thành công!' });
    } catch (err) {
        // Nếu Transaction bị Rollback và ném lỗi từ SP, nó sẽ được bắt ở đây
        console.error('Giao dịch lỗi/bị huỷ:', err.message);
        res.status(400).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server ứng dụng Demo đang chạy tại: http://localhost:${port}`);
});
