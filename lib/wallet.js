import { getPool, getSqlModule } from "@/lib/db";

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function getSqlErrorMessage(error, fallback) {
  if (error?.originalError?.info?.message) {
    return error.originalError.info.message;
  }

  return error instanceof Error ? error.message : fallback;
}

function mapUser(record) {
  return {
    userId: record.UserId,
    fullName: record.FullName,
    email: record.Email,
    accountId: record.AccountId,
    balance: Number(record.Balance),
    currencyCode: record.CurrencyCode,
    createdAt: record.CreatedAt,
  };
}

export async function registerUser({
  fullName,
  email,
  password,
  openingBalance,
}) {
  try {
    const sql = await getSqlModule();
    const pool = await getPool();
    const result = await pool
      .request()
      .input("FullName", sql.NVarChar(120), fullName.trim())
      .input("Email", sql.NVarChar(255), normalizeEmail(email))
      .input("Password", sql.NVarChar(128), password)
      .input("OpeningBalance", sql.Decimal(18, 2), openingBalance)
      .execute("sp_RegisterWalletUser");

    return mapUser(result.recordset[0]);
  } catch (error) {
    throw new Error(getSqlErrorMessage(error, "Registration failed."));
  }
}

export async function loginUser({ email, password }) {
  try {
    const sql = await getSqlModule();
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Email", sql.NVarChar(255), normalizeEmail(email))
      .input("Password", sql.NVarChar(128), password)
      .execute("sp_LoginWalletUser");

    const record = result.recordset[0];

    if (!record) {
      throw new Error("Invalid email or password.");
    }

    return mapUser(record);
  } catch (error) {
    throw new Error(getSqlErrorMessage(error, "Login failed."));
  }
}

export async function getDashboardData(userId) {
  const sql = await getSqlModule();
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .execute("sp_GetWalletDashboard");

  const [
    profileSet = [],
    contactsSet = [],
    historySet = [],
    auditsSet = [],
  ] = result.recordsets;

  if (!profileSet[0]) {
    throw new Error("The logged-in wallet user could not be found.");
  }

  let requestsRows = [];
  try {
    const requestsResult = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .query(`
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
        ORDER BY r.CreatedAt DESC
      `);
    requestsRows = requestsResult.recordset;
    console.log(
      "[wallet] requests query for userId=%s returned %d row(s)%s",
      userId,
      requestsRows.length,
      requestsRows.length
        ? " — first: " + JSON.stringify(requestsRows[0])
        : "",
    );
  } catch (requestsError) {
    console.error("[wallet] requests query failed:", requestsError.message);
  }

  return {
    profile: {
      userId: profileSet[0].UserId,
      fullName: profileSet[0].FullName,
      email: profileSet[0].Email,
      accountId: profileSet[0].AccountId,
      balance: Number(profileSet[0].Balance),
      currencyCode: profileSet[0].CurrencyCode,
      createdAt: profileSet[0].CreatedAt,
    },
    contacts: contactsSet.map((item) => ({
      userId: item.UserId,
      fullName: item.FullName,
      email: item.Email,
      balance: Number(item.Balance),
    })),
    history: historySet.map((item) => ({
      transferId: item.TransferId,
      direction: item.DirectionLabel,
      counterpartyName: item.CounterpartyName,
      counterpartyEmail: item.CounterpartyEmail,
      amount: Number(item.Amount),
      memo: item.Memo,
      createdAt: item.CreatedAt,
    })),
    audits: auditsSet.map((item) => ({
      auditId: item.AuditId,
      oldBalance: Number(item.OldBalance),
      newBalance: Number(item.NewBalance),
      delta: Number(item.Delta),
      actionLabel: item.ActionLabel,
      actionDate: item.ActionDate,
    })),
    requests: requestsRows.map((item) => ({
      requestId: Number(item.RequestId),
      requesterUserId: Number(item.RequesterUserId),
      requesterName: item.RequesterName,
      requesterEmail: item.RequesterEmail,
      payerUserId: Number(item.PayerUserId),
      payerName: item.PayerName,
      payerEmail: item.PayerEmail,
      amount: Number(item.Amount),
      memo: item.Memo,
      status: item.Status,
      createdAt: item.CreatedAt,
      respondedAt: item.RespondedAt,
    })),
  };
}

export async function createMoneyRequest({
  requesterUserId,
  payerUserId,
  amount,
  memo,
}) {
  try {
    const sql = await getSqlModule();
    const pool = await getPool();
    const result = await pool
      .request()
      .input("RequesterUserId", sql.Int, requesterUserId)
      .input("PayerUserId", sql.Int, payerUserId)
      .input("Amount", sql.Decimal(18, 2), amount)
      .input("Memo", sql.NVarChar(160), memo)
      .execute("sp_CreateMoneyRequest");

    return result.recordset[0] || { Message: "Request created." };
  } catch (error) {
    throw new Error(
      getSqlErrorMessage(error, "Failed to create money request."),
    );
  }
}

export async function respondToMoneyRequest({
  requestId,
  payerUserId,
  accept,
}) {
  try {
    const sql = await getSqlModule();
    const pool = await getPool();
    const result = await pool
      .request()
      .input("RequestId", sql.Int, requestId)
      .input("PayerUserId", sql.Int, payerUserId)
      .input("Accept", sql.Bit, accept)
      .execute("sp_RespondToMoneyRequest");

    return result.recordset[0] || { Message: "Response recorded." };
  } catch (error) {
    throw new Error(
      getSqlErrorMessage(error, "Failed to respond to money request."),
    );
  }
}

export async function transferMoney({
  senderUserId,
  recipientUserId,
  amount,
  memo,
}) {
  try {
    const sql = await getSqlModule();
    const pool = await getPool();
    const result = await pool
      .request()
      .input("SenderUserId", sql.Int, senderUserId)
      .input("RecipientUserId", sql.Int, recipientUserId)
      .input("Amount", sql.Decimal(18, 2), amount)
      .input("Memo", sql.NVarChar(160), memo)
      .execute("sp_TransferMoney");

    return result.recordset[0] || { Message: "Transfer completed." };
  } catch (error) {
    throw new Error(getSqlErrorMessage(error, "Transfer failed."));
  }
}
