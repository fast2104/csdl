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
    requests: requestsResult.recordset.map((item) => ({
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
  tag,
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
      .input("Tag", sql.NVarChar(40), tag || null)
      .execute("sp_TransferMoney");

    return result.recordset[0] || { Message: "Transfer completed." };
  } catch (error) {
    throw new Error(getSqlErrorMessage(error, "Transfer failed."));
  }
}

export async function getExpenseStats({ userId, fromDate, toDate }) {
  const sql = await getSqlModule();
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("FromDate", sql.DateTime2, fromDate || null)
    .input("ToDate", sql.DateTime2, toDate || null)
    .execute("sp_GetExpenseStats");

  const [summarySet = [], tagSet = [], counterpartySet = []] =
    result.recordsets;

  return {
    summary: summarySet[0]
      ? {
          totalSent: Number(summarySet[0].TotalSent),
          totalReceived: Number(summarySet[0].TotalReceived),
          netFlow: Number(summarySet[0].NetFlow),
        }
      : { totalSent: 0, totalReceived: 0, netFlow: 0 },
    byTag: tagSet.map((item) => ({
      tag: item.Tag,
      total: Number(item.Total),
      transactionCount: item.TransactionCount,
    })),
    byCounterparty: counterpartySet.map((item) => ({
      counterpartyUserId: item.CounterpartyUserId,
      counterpartyName: item.CounterpartyName,
      totalSent: Number(item.TotalSent),
    })),
  };
}

export async function getBalanceHistory({ userId, fromDate, toDate }) {
  const sql = await getSqlModule();
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("FromDate", sql.DateTime2, fromDate || null)
    .input("ToDate", sql.DateTime2, toDate || null)
    .execute("sp_GetBalanceHistory");

  return (result.recordset || []).map((item) => ({
    pointDate: item.PointDate,
    balance: Number(item.Balance),
  }));
}

export async function getBudgetSummary({ userId, month, year }) {
  const sql = await getSqlModule();
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("Month", sql.Int, month)
    .input("Year", sql.Int, year)
    .execute("sp_GetBudgetSummary");

  return (result.recordset || []).map((item) => ({
    budgetId: item.BudgetId,
    tag: item.Tag,
    monthlyLimit: Number(item.MonthlyLimit),
    spentThisMonth: Number(item.SpentThisMonth),
    remainingAmount: Number(item.RemainingAmount),
    percentUsed: Number(item.PercentUsed),
  }));
}

export async function upsertBudget({ userId, tag, monthlyLimit }) {
  try {
    const sql = await getSqlModule();
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("Tag", sql.NVarChar(40), tag || null)
      .input("MonthlyLimit", sql.Decimal(18, 2), monthlyLimit)
      .execute("sp_UpsertBudget");

    return result.recordset[0] || { Message: "Budget saved." };
  } catch (error) {
    throw new Error(getSqlErrorMessage(error, "Failed to save budget."));
  }
}

export async function deleteBudget({ userId, budgetId }) {
  try {
    const sql = await getSqlModule();
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("BudgetId", sql.Int, budgetId)
      .execute("sp_DeleteBudget");

    return result.recordset[0] || { Message: "Budget deleted." };
  } catch (error) {
    throw new Error(getSqlErrorMessage(error, "Failed to delete budget."));
  }
}

export async function getNotifications({ userId, limit, onlyUnread }) {
  const sql = await getSqlModule();
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("Limit", sql.Int, limit || 20)
    .input("OnlyUnread", sql.Bit, onlyUnread ? 1 : 0)
    .execute("sp_GetNotifications");

  return (result.recordset || []).map((item) => ({
    notificationId: item.NotificationId,
    type: item.Type,
    title: item.Title,
    body: item.Body,
    referenceId: item.ReferenceId,
    isRead: Boolean(item.IsRead),
    createdAt: item.CreatedAt,
  }));
}

export async function markNotificationsRead({ userId, notificationIds }) {
  try {
    const sql = await getSqlModule();
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("NotificationIds", sql.NVarChar(sql.MAX), notificationIds.join(","))
      .execute("sp_MarkNotificationsRead");

    return result.recordset[0] || { MarkedCount: 0 };
  } catch (error) {
    throw new Error(
      getSqlErrorMessage(error, "Failed to mark notifications as read."),
    );
  }
}

export async function createRecurringTransfer({
  senderUserId,
  recipientUserId,
  amount,
  memo,
  tag,
  frequency,
  nextRunDate,
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
      .input("Tag", sql.NVarChar(40), tag || null)
      .input("Frequency", sql.NVarChar(20), frequency)
      .input("NextRunDate", sql.Date, nextRunDate)
      .execute("sp_CreateRecurringTransfer");

    return result.recordset[0] || { Message: "Recurring transfer created." };
  } catch (error) {
    throw new Error(
      getSqlErrorMessage(error, "Failed to create recurring transfer."),
    );
  }
}

export async function getRecurringTransfers(userId) {
  const sql = await getSqlModule();
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .execute("sp_GetRecurringTransfers");

  return (result.recordset || []).map((item) => ({
    recurringId: item.RecurringId,
    recipientUserId: item.RecipientUserId,
    recipientName: item.RecipientName,
    recipientEmail: item.RecipientEmail,
    amount: Number(item.Amount),
    memo: item.Memo,
    tag: item.Tag,
    frequency: item.Frequency,
    nextRunDate: item.NextRunDate,
    lastRunDate: item.LastRunDate,
    isActive: Boolean(item.IsActive),
    createdAt: item.CreatedAt,
  }));
}

export async function cancelRecurringTransfer({ recurringId, senderUserId }) {
  try {
    const sql = await getSqlModule();
    const pool = await getPool();
    const result = await pool
      .request()
      .input("RecurringId", sql.Int, recurringId)
      .input("SenderUserId", sql.Int, senderUserId)
      .execute("sp_CancelRecurringTransfer");

    return result.recordset[0] || { Message: "Recurring transfer cancelled." };
  } catch (error) {
    throw new Error(
      getSqlErrorMessage(error, "Failed to cancel recurring transfer."),
    );
  }
}

export async function executeRecurringTransfers() {
  const sql = await getSqlModule();
  const pool = await getPool();
  await pool.request().execute("sp_ExecuteRecurringTransfers");
  return { Message: "Recurring transfers executed." };
}

export async function createSplitBill({
  creatorUserId,
  description,
  totalAmount,
  splitMethod,
  participantUserIds,
  participantAmounts,
}) {
  try {
    const sql = await getSqlModule();
    const pool = await getPool();
    const result = await pool
      .request()
      .input("CreatorUserId", sql.Int, creatorUserId)
      .input("Description", sql.NVarChar(160), description)
      .input("TotalAmount", sql.Decimal(18, 2), totalAmount)
      .input("SplitMethod", sql.NVarChar(20), splitMethod || "equal")
      .input("ParticipantUserIds", sql.NVarChar(sql.MAX), participantUserIds.join(","))
      .input(
        "ParticipantAmounts",
        sql.NVarChar(sql.MAX),
        participantAmounts ? participantAmounts.join(",") : null,
      )
      .execute("sp_CreateSplitBill");

    return result.recordset[0] || { Message: "Split bill created." };
  } catch (error) {
    throw new Error(getSqlErrorMessage(error, "Failed to create split bill."));
  }
}

export async function getSplitBills(userId) {
  const sql = await getSqlModule();
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .execute("sp_GetSplitBills");

  return (result.recordset || []).map((item) => ({
    splitBillId: item.SplitBillId,
    creatorUserId: item.CreatorUserId,
    creatorName: item.CreatorName,
    description: item.Description,
    totalAmount: Number(item.TotalAmount),
    splitMethod: item.SplitMethod,
    status: item.Status,
    createdAt: item.CreatedAt,
    participantCount: item.ParticipantCount,
    paidCount: item.PaidCount,
  }));
}

export async function getSplitBillDetail({ splitBillId, userId }) {
  const sql = await getSqlModule();
  const pool = await getPool();
  const result = await pool
    .request()
    .input("SplitBillId", sql.Int, splitBillId)
    .input("UserId", sql.Int, userId)
    .execute("sp_GetSplitBillDetail");

  const [billSet = [], participantsSet = []] = result.recordsets;

  if (!billSet[0]) return null;

  return {
    splitBillId: billSet[0].SplitBillId,
    creatorUserId: billSet[0].CreatorUserId,
    creatorName: billSet[0].CreatorName,
    description: billSet[0].Description,
    totalAmount: Number(billSet[0].TotalAmount),
    splitMethod: billSet[0].SplitMethod,
    status: billSet[0].Status,
    createdAt: billSet[0].CreatedAt,
    participants: participantsSet.map((p) => ({
      participantId: p.ParticipantId,
      userId: p.UserId,
      fullName: p.FullName,
      email: p.Email,
      shareAmount: Number(p.ShareAmount),
      requestId: p.RequestId,
      status: p.Status,
    })),
  };
}
