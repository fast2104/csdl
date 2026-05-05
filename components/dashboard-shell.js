"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

const TAG_SUGGESTIONS = [
  "Food",
  "Transport",
  "Utilities",
  "Entertainment",
  "Rent",
  "Groceries",
  "Shopping",
  "Health",
  "Travel",
  "Other",
];

const TAG_COLORS = [
  "#006d77",
  "#e29578",
  "#83c5be",
  "#f5b700",
  "#c44536",
  "#264653",
  "#2a9d8f",
  "#e76f51",
  "#7209b7",
  "#3a86a7",
];

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "statistics", label: "Statistics" },
  { id: "budgets", label: "Budgets" },
  { id: "transfer", label: "Transfer" },
  { id: "requests", label: "Requests" },
  { id: "profile", label: "Profile" },
];

function formatMoney(value, currencyCode = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(Number(value || 0));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function relativeTime(dateString) {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function tagColor(tag, index) {
  if (!tag) return TAG_COLORS[TAG_COLORS.length - 1];
  return TAG_COLORS[index % TAG_COLORS.length];
}

function PieChart({ data }) {
  if (!data.length) return null;

  const total = data.reduce((sum, d) => sum + d.total, 0);
  if (total === 0) return null;

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="pie-chart-container">
      <svg viewBox="0 0 160 160" className="pie-chart-svg">
        {data.map((item, i) => {
          const fraction = item.total / total;
          const dashLength = fraction * circumference;
          const currentOffset = offset;
          offset += dashLength;

          return (
            <circle
              key={item.tag}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={tagColor(item.tag, i)}
              strokeWidth="32"
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={-currentOffset}
              style={{ transition: "stroke-dasharray 0.4s, stroke-dashoffset 0.4s" }}
            />
          );
        })}
      </svg>
      <ul className="pie-legend">
        {data.map((item, i) => (
          <li key={item.tag}>
            <span
              className="pie-swatch"
              style={{ background: tagColor(item.tag, i) }}
            />
            <span className="pie-label">{item.tag}</span>
            <strong>{formatMoney(item.total)}</strong>
            <span className="pie-pct">
              {total > 0 ? Math.round((item.total / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BalanceChart({ data }) {
  if (!data || data.length < 2) return null;

  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const balances = data.map((d) => d.balance);
  const minBal = Math.min(...balances);
  const maxBal = Math.max(...balances);
  const range = maxBal - minBal || 1;

  const points = data
    .map((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const y = padding.top + chartH - ((d.balance - minBal) / range) * chartH;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `${padding.left},${padding.top + chartH} ${points} ${padding.left + chartW},${padding.top + chartH}`;

  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) =>
    minBal + (range / yTicks) * i,
  );

  const xLabelCount = Math.min(data.length, 5);
  const xStep = Math.max(1, Math.floor((data.length - 1) / (xLabelCount - 1)));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="balance-chart-svg">
      {yLabels.map((val) => {
        const y = padding.top + chartH - ((val - minBal) / range) * chartH;
        return (
          <g key={val}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="rgba(24,32,43,0.06)"
            />
            <text
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              className="chart-label"
            >
              ${Math.round(val)}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        if (i % xStep !== 0 && i !== data.length - 1) return null;
        const x = padding.left + (i / (data.length - 1)) * chartW;
        return (
          <text
            key={i}
            x={x}
            y={height - 4}
            textAnchor="middle"
            className="chart-label"
          >
            {formatShortDate(d.pointDate)}
          </text>
        );
      })}

      <polygon points={areaPoints} className="chart-area" />
      <polyline points={points} className="chart-line" fill="none" />
    </svg>
  );
}

function BudgetProgressBar({ percentUsed }) {
  const clamped = Math.min(percentUsed, 100);
  const color =
    percentUsed > 90
      ? "var(--danger)"
      : percentUsed > 75
        ? "#e5a100"
        : "var(--success)";

  return (
    <div className="budget-bar-track">
      <div
        className="budget-bar-fill"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}

export default function DashboardShell({ dbError, initialData, session }) {
  const router = useRouter();
  const currentUserId = Number(session.userId);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedRecipient, setSelectedRecipient] = useState(
    initialData.contacts[0]?.userId ?? null,
  );
  const [transferAmount, setTransferAmount] = useState("125.00");
  const [transferMemo, setTransferMemo] = useState("Coffee split");
  const [transferTag, setTransferTag] = useState("");
  const [requestPayer, setRequestPayer] = useState(
    initialData.contacts[0]?.userId ?? null,
  );
  const [requestAmount, setRequestAmount] = useState("50.00");
  const [requestMemo, setRequestMemo] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [transactionModal, setTransactionModal] = useState({
    open: false,
    status: "idle",
    title: "",
    message: "",
  });

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  const [balanceHistory, setBalanceHistory] = useState([]);
  const [expenseStats, setExpenseStats] = useState(null);
  const [statsPeriod, setStatsPeriod] = useState(30);

  const [budgets, setBudgets] = useState([]);
  const [budgetTag, setBudgetTag] = useState("");
  const [budgetLimit, setBudgetLimit] = useState("500");
  const [budgetMonth, setBudgetMonth] = useState(new Date().getMonth() + 1);
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear());

  const [recurringTransfers, setRecurringTransfers] = useState([]);
  const [recurringRecipient, setRecurringRecipient] = useState(
    initialData.contacts[0]?.userId ?? null,
  );
  const [recurringAmount, setRecurringAmount] = useState("100.00");
  const [recurringMemo, setRecurringMemo] = useState("");
  const [recurringTag, setRecurringTag] = useState("");
  const [recurringFrequency, setRecurringFrequency] = useState("monthly");
  const [recurringStartDate, setRecurringStartDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split("T")[0],
  );

  const [splitBills, setSplitBills] = useState([]);
  const [splitDescription, setSplitDescription] = useState("");
  const [splitAmount, setSplitAmount] = useState("");
  const [splitParticipants, setSplitParticipants] = useState([]);

  const stats = useMemo(() => {
    const sent = initialData.history
      .filter((item) => item.direction === "Sent")
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const received = initialData.history
      .filter((item) => item.direction === "Received")
      .reduce((sum, item) => sum + Number(item.amount), 0);

    return {
      sent,
      received,
    };
  }, [initialData.history]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unread=true&limit=10");
      const data = await res.json();
      if (data.ok) {
        setNotifications(data.notifications);
        setUnreadCount(data.notifications.filter((n) => !n.isRead).length);
      }
    } catch {
      /* ignore polling errors */
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (activeTab === "overview") {
      fetch("/api/balance-history")
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) setBalanceHistory(data.history);
        })
        .catch(() => {});
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "statistics") {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - statsPeriod);
      fetch(`/api/stats?from=${fromDate.toISOString()}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) setExpenseStats(data.stats);
        })
        .catch(() => {});
    }
  }, [activeTab, statsPeriod]);

  useEffect(() => {
    if (activeTab === "budgets") {
      fetch(`/api/budgets?month=${budgetMonth}&year=${budgetYear}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) setBudgets(data.budgets);
        })
        .catch(() => {});
    }
  }, [activeTab, budgetMonth, budgetYear]);

  useEffect(() => {
    if (activeTab === "transfer") {
      fetch("/api/recurring")
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) setRecurringTransfers(data.recurring);
        })
        .catch(() => {});
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "requests") {
      fetch("/api/split-bills")
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) setSplitBills(data.splitBills);
        })
        .catch(() => {});
    }
  }, [activeTab]);

  function refreshDashboard(successMessage) {
    setFeedback(successMessage || "");
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleMarkAllRead() {
    const unreadIds = notifications
      .filter((n) => !n.isRead)
      .map((n) => n.notificationId);
    if (unreadIds.length === 0) return;

    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationIds: unreadIds }),
    });
    await fetchNotifications();
  }

  async function handleTransfer(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setTransactionModal({
      open: true,
      status: "pending",
      title: "Processing transfer",
      message:
        "The app is calling the SQL Server stored procedure and waiting for the transaction to commit.",
    });

    try {
      const response = await fetch("/api/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientUserId: selectedRecipient,
          amount: Number(transferAmount),
          memo: transferMemo,
          tag: transferTag || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Transfer failed.");
        setTransactionModal({
          open: true,
          status: "error",
          title: "Transfer failed",
          message:
            data.error ||
            "The SQL transaction was rolled back before the transfer completed.",
        });
        return;
      }

      setTransferAmount("125.00");
      setTransferMemo("Coffee split");
      setTransferTag("");
      setTransactionModal({
        open: true,
        status: "success",
        title: "Transfer complete",
        message:
          data.result?.Message ||
          "The transaction committed successfully and the balances were updated.",
      });
      refreshDashboard(data.result?.Message || "Transfer completed.");
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not reach the server.",
      );
      setTransactionModal({
        open: true,
        status: "error",
        title: "Connection problem",
        message:
          fetchError instanceof Error
            ? fetchError.message
            : "Could not reach the server.",
      });
    }
  }

  async function handleCreateRequest(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setTransactionModal({
      open: true,
      status: "pending",
      title: "Creating request",
      message: "Calling sp_CreateMoneyRequest to store the payment request.",
    });

    try {
      const response = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payerUserId: requestPayer,
          amount: Number(requestAmount),
          memo: requestMemo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Request failed.");
        setTransactionModal({
          open: true,
          status: "error",
          title: "Request failed",
          message: data.error || "Could not create the money request.",
        });
        return;
      }

      setRequestAmount("50.00");
      setRequestMemo("");
      setTransactionModal({
        open: true,
        status: "success",
        title: "Request sent",
        message: "Your money request has been sent successfully.",
      });
      refreshDashboard("Money request sent.");
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not reach the server.",
      );
      setTransactionModal({
        open: true,
        status: "error",
        title: "Connection problem",
        message:
          fetchError instanceof Error
            ? fetchError.message
            : "Could not reach the server.",
      });
    }
  }

  async function handleRespondToRequest(requestId, accept) {
    setError("");
    setFeedback("");
    setTransactionModal({
      open: true,
      status: "pending",
      title: accept ? "Accepting request" : "Declining request",
      message: accept
        ? "Calling sp_RespondToMoneyRequest to execute the transfer."
        : "Declining the money request.",
    });

    try {
      const response = await fetch("/api/request/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, accept }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Response failed.");
        setTransactionModal({
          open: true,
          status: "error",
          title: "Response failed",
          message: data.error || "Could not respond to the money request.",
        });
        return;
      }

      setTransactionModal({
        open: true,
        status: "success",
        title: accept ? "Request accepted" : "Request declined",
        message:
          data.result?.Message ||
          (accept
            ? "Transfer completed successfully."
            : "Request has been declined."),
      });
      refreshDashboard(
        data.result?.Message || (accept ? "Request accepted." : "Request declined."),
      );
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not reach the server.",
      );
      setTransactionModal({
        open: true,
        status: "error",
        title: "Connection problem",
        message:
          fetchError instanceof Error
            ? fetchError.message
            : "Could not reach the server.",
      });
    }
  }

  async function handleUpsertBudget(event) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tag: budgetTag || null,
          monthlyLimit: Number(budgetLimit),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to save budget.");
        return;
      }
      setBudgetTag("");
      setBudgetLimit("500");
      const res = await fetch(`/api/budgets?month=${budgetMonth}&year=${budgetYear}`);
      const fresh = await res.json();
      if (fresh.ok) setBudgets(fresh.budgets);
      setFeedback("Budget saved.");
    } catch {
      setError("Could not reach the server.");
    }
  }

  async function handleDeleteBudget(budgetId) {
    try {
      await fetch("/api/budgets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetId }),
      });
      const res = await fetch(`/api/budgets?month=${budgetMonth}&year=${budgetYear}`);
      const fresh = await res.json();
      if (fresh.ok) setBudgets(fresh.budgets);
    } catch {
      /* ignore */
    }
  }

  async function handleCreateRecurring(event) {
    event.preventDefault();
    setError("");
    setTransactionModal({
      open: true,
      status: "pending",
      title: "Creating recurring transfer",
      message: "Setting up your scheduled transfer.",
    });

    try {
      const response = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientUserId: recurringRecipient,
          amount: Number(recurringAmount),
          memo: recurringMemo,
          tag: recurringTag || null,
          frequency: recurringFrequency,
          nextRunDate: recurringStartDate,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to create recurring transfer.");
        setTransactionModal({
          open: true,
          status: "error",
          title: "Failed",
          message: data.error || "Could not create the recurring transfer.",
        });
        return;
      }
      setRecurringAmount("100.00");
      setRecurringMemo("");
      setRecurringTag("");
      setTransactionModal({
        open: true,
        status: "success",
        title: "Recurring transfer created",
        message: "Your scheduled transfer has been set up.",
      });
      const res = await fetch("/api/recurring");
      const fresh = await res.json();
      if (fresh.ok) setRecurringTransfers(fresh.recurring);
    } catch {
      setTransactionModal({
        open: true,
        status: "error",
        title: "Connection problem",
        message: "Could not reach the server.",
      });
    }
  }

  async function handleCancelRecurring(recurringId) {
    try {
      await fetch("/api/recurring", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurringId }),
      });
      const res = await fetch("/api/recurring");
      const fresh = await res.json();
      if (fresh.ok) setRecurringTransfers(fresh.recurring);
    } catch {
      /* ignore */
    }
  }

  async function handleCreateSplitBill(event) {
    event.preventDefault();
    setError("");
    setTransactionModal({
      open: true,
      status: "pending",
      title: "Creating split bill",
      message: "Generating payment requests for each participant.",
    });

    try {
      const response = await fetch("/api/split-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: splitDescription,
          totalAmount: Number(splitAmount),
          splitMethod: "equal",
          participantUserIds: [currentUserId, ...splitParticipants],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to create split bill.");
        setTransactionModal({
          open: true,
          status: "error",
          title: "Failed",
          message: data.error || "Could not create the split bill.",
        });
        return;
      }
      setSplitDescription("");
      setSplitAmount("");
      setSplitParticipants([]);
      setTransactionModal({
        open: true,
        status: "success",
        title: "Split bill created",
        message: "Payment requests have been sent to all participants.",
      });
      refreshDashboard("Split bill created.");
      const res = await fetch("/api/split-bills");
      const fresh = await res.json();
      if (fresh.ok) setSplitBills(fresh.splitBills);
    } catch {
      setTransactionModal({
        open: true,
        status: "error",
        title: "Connection problem",
        message: "Could not reach the server.",
      });
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="wallet-shell">
      {transactionModal.open ? (
        <div className="modal-backdrop" role="presentation">
          <div
            aria-labelledby="transaction-modal-title"
            aria-modal="true"
            className="transaction-modal"
            role="dialog"
          >
            <div
              className={`modal-badge ${transactionModal.status}`}
            >
              {transactionModal.status === "pending" ? "..." : null}
              {transactionModal.status === "success" ? "OK" : null}
              {transactionModal.status === "error" ? "!" : null}
            </div>
            <h2 id="transaction-modal-title">{transactionModal.title}</h2>
            <p>{transactionModal.message}</p>
            <button
              className="primary-button"
              onClick={() =>
                setTransactionModal((current) => ({ ...current, open: false }))
              }
              type="button"
            >
              {transactionModal.status === "pending" ? "Hide" : "Close"}
            </button>
          </div>
        </div>
      ) : null}

      <section className="wallet-hero">
        <div className="wallet-hero-copy">
          <div className="eyebrow">Digital Wallet Demo</div>
          <h1>{session.fullName}</h1>
        </div>
        <div className="wallet-balance-card">
          <span>Current balance</span>
          <strong>
            {formatMoney(
              initialData.profile.balance,
              initialData.profile.currencyCode,
            )}
          </strong>
          <small>Account #{initialData.profile.accountId ?? "Pending"}</small>
        </div>
      </section>

      <div className="notification-bar">
        <button
          className="notification-bell"
          onClick={() => setShowNotifications((prev) => !prev)}
          type="button"
        >
          Notifications
          {unreadCount > 0 ? (
            <span className="notification-badge">{unreadCount}</span>
          ) : null}
        </button>

        {showNotifications ? (
          <div className="notification-dropdown">
            <div className="notification-header">
              <strong>Notifications</strong>
              {unreadCount > 0 ? (
                <button
                  className="mark-read-button"
                  onClick={handleMarkAllRead}
                  type="button"
                >
                  Mark all read
                </button>
              ) : null}
            </div>
            {notifications.length ? (
              <ul className="notification-list">
                {notifications.map((n) => (
                  <li
                    key={n.notificationId}
                    className={n.isRead ? "notification-item read" : "notification-item"}
                  >
                    <strong>{n.title}</strong>
                    {n.body ? <p>{n.body}</p> : null}
                    <span className="notification-time">{relativeTime(n.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-copy" style={{ padding: "16px" }}>
                No notifications yet.
              </p>
            )}
          </div>
        ) : null}
      </div>

      {dbError ? <div className="banner error-banner">{dbError}</div> : null}
      {feedback ? <div className="banner success-banner">{feedback}</div> : null}
      {error ? <div className="banner error-banner">{error}</div> : null}

      <nav className="tab-strip">
        {tabs.map((tab) => (
          <button
            className={tab.id === activeTab ? "tab active" : "tab"}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
        <button className="logout-button" onClick={handleLogout} type="button">
          Logout
        </button>
      </nav>

      {/* ========== OVERVIEW TAB ========== */}
      {activeTab === "overview" ? (
        <section className="dashboard-grid">
          <article className="surface-card stat-card">
            <span>Total sent</span>
            <strong>{formatMoney(stats.sent)}</strong>
          </article>
          <article className="surface-card stat-card">
            <span>Total received</span>
            <strong>{formatMoney(stats.received)}</strong>
          </article>
          <article className="surface-card stat-card">
            <span>Contacts</span>
            <strong>{initialData.contacts.length}</strong>
          </article>

          {balanceHistory.length >= 2 ? (
            <article className="surface-card wide-card">
              <div className="section-heading">
                <h2>Balance over time</h2>
                <span>{balanceHistory.length} data points</span>
              </div>
              <BalanceChart data={balanceHistory} />
            </article>
          ) : null}

          <article className="surface-card wide-card">
            <div className="section-heading">
              <h2>Recent transfers</h2>
              <span>{initialData.history.length} rows</span>
            </div>
            <div className="list-stack">
              {initialData.history.length ? (
                initialData.history.map((item) => (
                  <div className="history-row" key={item.transferId}>
                    <div>
                      <strong>{item.counterpartyName}</strong>
                      <p>
                        {item.direction} • {item.memo || "No memo"}
                      </p>
                    </div>
                    <div className="history-meta">
                      <strong
                        className={
                          item.direction === "Received" ? "positive" : "negative"
                        }
                      >
                        {item.direction === "Received" ? "+" : "-"}
                        {formatMoney(item.amount)}
                      </strong>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-copy">No transfers yet. Use the Transfer tab to create one.</p>
              )}
            </div>
          </article>

          <article className="surface-card wide-card">
            <div className="section-heading">
              <h2>Trigger audit trail</h2>
              <span>{initialData.audits.length} balance changes</span>
            </div>
            <div className="list-stack">
              {initialData.audits.length ? (
                initialData.audits.map((item) => (
                  <div className="audit-row" key={item.auditId}>
                    <div>
                      <strong>
                        {formatMoney(item.oldBalance)} to {formatMoney(item.newBalance)}
                      </strong>
                      <p>{item.actionLabel}</p>
                    </div>
                    <div className="history-meta">
                      <strong className={Number(item.delta) >= 0 ? "positive" : "negative"}>
                        {Number(item.delta) >= 0 ? "+" : ""}
                        {formatMoney(item.delta)}
                      </strong>
                      <span>{formatDate(item.actionDate)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-copy">Balance audit entries will appear here after transfers.</p>
              )}
            </div>
          </article>
        </section>
      ) : null}

      {/* ========== STATISTICS TAB ========== */}
      {activeTab === "statistics" ? (
        <section className="stats-layout">
          <div className="stats-period-selector">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                className={statsPeriod === days ? "tab active" : "tab"}
                onClick={() => setStatsPeriod(days)}
                type="button"
              >
                {days}d
              </button>
            ))}
          </div>

          {expenseStats ? (
            <>
              <div className="stats-summary-row">
                <article className="surface-card stat-card">
                  <span>Total sent</span>
                  <strong className="negative">{formatMoney(expenseStats.summary.totalSent)}</strong>
                </article>
                <article className="surface-card stat-card">
                  <span>Total received</span>
                  <strong className="positive">{formatMoney(expenseStats.summary.totalReceived)}</strong>
                </article>
                <article className="surface-card stat-card">
                  <span>Net flow</span>
                  <strong className={expenseStats.summary.netFlow >= 0 ? "positive" : "negative"}>
                    {expenseStats.summary.netFlow >= 0 ? "+" : ""}
                    {formatMoney(expenseStats.summary.netFlow)}
                  </strong>
                </article>
              </div>

              <article className="surface-card wide-card">
                <div className="section-heading">
                  <h2>Spending by tag</h2>
                  <span>{expenseStats.byTag.length} tags</span>
                </div>
                {expenseStats.byTag.length ? (
                  <PieChart data={expenseStats.byTag} />
                ) : (
                  <p className="empty-copy">No outgoing transfers in this period.</p>
                )}
              </article>

              <article className="surface-card wide-card">
                <div className="section-heading">
                  <h2>Receiving by tag</h2>
                  <span>{expenseStats.receivedByTag?.length || 0} tags</span>
                </div>
                {expenseStats.receivedByTag?.length ? (
                  <PieChart data={expenseStats.receivedByTag} />
                ) : (
                  <p className="empty-copy">No incoming transfers in this period.</p>
                )}
              </article>

              <article className="surface-card wide-card">
                <div className="section-heading">
                  <h2>Top recipients</h2>
                  <span>{expenseStats.byCounterparty.length} contacts</span>
                </div>
                <div className="list-stack">
                  {expenseStats.byCounterparty.length ? (
                    expenseStats.byCounterparty.map((item) => (
                      <div className="history-row" key={item.counterpartyUserId}>
                        <div>
                          <strong>{item.counterpartyName}</strong>
                        </div>
                        <div className="history-meta">
                          <strong className="negative">{formatMoney(item.totalSent)}</strong>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="empty-copy">No outgoing transfers in this period.</p>
                  )}
                </div>
              </article>
            </>
          ) : (
            <p className="empty-copy">Loading statistics...</p>
          )}
        </section>
      ) : null}

      {/* ========== BUDGETS TAB ========== */}
      {activeTab === "budgets" ? (
        <section className="budgets-layout">
          <article className="surface-card transfer-card">
            <div className="section-heading">
              <h2>Set a budget</h2>
            </div>
            <form className="transfer-form" onSubmit={handleUpsertBudget}>
              <label>
                Tag (leave blank for overall budget)
                <input
                  list="budget-tag-suggestions"
                  maxLength={40}
                  onChange={(e) => setBudgetTag(e.target.value)}
                  placeholder="e.g. Food, Transport, or blank for Overall"
                  type="text"
                  value={budgetTag}
                />
                <datalist id="budget-tag-suggestions">
                  {TAG_SUGGESTIONS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </label>
              <label>
                Monthly limit
                <input
                  min="0.01"
                  onChange={(e) => setBudgetLimit(e.target.value)}
                  required
                  step="0.01"
                  type="number"
                  value={budgetLimit}
                />
              </label>
              <button className="primary-button" type="submit">
                Save budget
              </button>
            </form>
          </article>

          <article className="surface-card wide-card">
            <div className="section-heading">
              <h2>
                Budget summary — {budgetMonth}/{budgetYear}
              </h2>
              <div className="month-nav">
                <button
                  type="button"
                  className="tab"
                  onClick={() => {
                    if (budgetMonth === 1) {
                      setBudgetMonth(12);
                      setBudgetYear(budgetYear - 1);
                    } else {
                      setBudgetMonth(budgetMonth - 1);
                    }
                  }}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="tab"
                  onClick={() => {
                    if (budgetMonth === 12) {
                      setBudgetMonth(1);
                      setBudgetYear(budgetYear + 1);
                    } else {
                      setBudgetMonth(budgetMonth + 1);
                    }
                  }}
                >
                  Next
                </button>
              </div>
            </div>
            <div className="list-stack">
              {budgets.length ? (
                budgets.map((b) => (
                  <div className="budget-row" key={b.budgetId}>
                    <div className="budget-info">
                      <strong>{b.tag}</strong>
                      <p>
                        {formatMoney(b.spentThisMonth)} of {formatMoney(b.monthlyLimit)}
                        {" "}({b.percentUsed}%)
                      </p>
                      <BudgetProgressBar percentUsed={b.percentUsed} />
                    </div>
                    <div className="budget-actions">
                      <span className={b.remainingAmount >= 0 ? "positive" : "negative"}>
                        {b.remainingAmount >= 0 ? formatMoney(b.remainingAmount) + " left" : formatMoney(Math.abs(b.remainingAmount)) + " over"}
                      </span>
                      <button
                        className="decline-button"
                        onClick={() => handleDeleteBudget(b.budgetId)}
                        type="button"
                        style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-copy">No budgets set. Use the form above to create one.</p>
              )}
            </div>
          </article>
        </section>
      ) : null}

      {/* ========== TRANSFER TAB ========== */}
      {activeTab === "transfer" ? (
        <section className="transfer-layout">
          <article className="surface-card transfer-card">
            <div className="section-heading">
              <h2>Send money</h2>
              <span>Stored procedure: sp_TransferMoney</span>
            </div>
            <form className="transfer-form" onSubmit={handleTransfer}>
              <label>
                Recipient
                <div className="recipient-grid">
                  {initialData.contacts.map((contact) => (
                    <button
                      className={
                        contact.userId === selectedRecipient
                          ? "recipient-chip active"
                          : "recipient-chip"
                      }
                      key={contact.userId}
                      onClick={() => setSelectedRecipient(contact.userId)}
                      type="button"
                    >
                      <span>{initials(contact.fullName)}</span>
                      <strong>{contact.fullName}</strong>
                      <small>{contact.email}</small>
                    </button>
                  ))}
                </div>
              </label>

              <label>
                Amount
                <input
                  min="0.01"
                  onChange={(event) => setTransferAmount(event.target.value)}
                  required
                  step="0.01"
                  type="number"
                  value={transferAmount}
                />
              </label>

              <label>
                Memo
                <input
                  maxLength={160}
                  onChange={(event) => setTransferMemo(event.target.value)}
                  placeholder="What is this transfer for?"
                  type="text"
                  value={transferMemo}
                />
              </label>

              <label>
                Tag (optional)
                <input
                  list="transfer-tag-suggestions"
                  maxLength={40}
                  onChange={(event) => setTransferTag(event.target.value)}
                  placeholder="e.g. Food, Transport, Rent"
                  type="text"
                  value={transferTag}
                />
                <datalist id="transfer-tag-suggestions">
                  {TAG_SUGGESTIONS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </label>

              <button className="primary-button" disabled={isPending} type="submit">
                {isPending ? "Refreshing..." : "Execute transfer"}
              </button>
            </form>
          </article>

          {/* Recurring transfers section */}
          <article className="surface-card transfer-card">
            <div className="section-heading">
              <h2>Recurring transfers</h2>
              <span>Schedule automatic payments</span>
            </div>
            <form className="transfer-form" onSubmit={handleCreateRecurring}>
              <label>
                Recipient
                <div className="recipient-grid">
                  {initialData.contacts.map((contact) => (
                    <button
                      className={
                        contact.userId === recurringRecipient
                          ? "recipient-chip active"
                          : "recipient-chip"
                      }
                      key={contact.userId}
                      onClick={() => setRecurringRecipient(contact.userId)}
                      type="button"
                    >
                      <span>{initials(contact.fullName)}</span>
                      <strong>{contact.fullName}</strong>
                    </button>
                  ))}
                </div>
              </label>
              <label>
                Amount
                <input
                  min="0.01"
                  onChange={(e) => setRecurringAmount(e.target.value)}
                  required
                  step="0.01"
                  type="number"
                  value={recurringAmount}
                />
              </label>
              <label>
                Frequency
                <select
                  onChange={(e) => setRecurringFrequency(e.target.value)}
                  value={recurringFrequency}
                  className="form-select"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <label>
                Start date
                <input
                  onChange={(e) => setRecurringStartDate(e.target.value)}
                  required
                  type="date"
                  value={recurringStartDate}
                />
              </label>
              <label>
                Memo
                <input
                  maxLength={160}
                  onChange={(e) => setRecurringMemo(e.target.value)}
                  placeholder="Memo (optional)"
                  type="text"
                  value={recurringMemo}
                />
              </label>
              <label>
                Tag (optional)
                <input
                  list="recurring-tag-suggestions"
                  maxLength={40}
                  onChange={(e) => setRecurringTag(e.target.value)}
                  placeholder="e.g. Rent, Subscription"
                  type="text"
                  value={recurringTag}
                />
                <datalist id="recurring-tag-suggestions">
                  {TAG_SUGGESTIONS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </label>
              <button className="primary-button" type="submit">
                Create recurring transfer
              </button>
            </form>
          </article>

          {recurringTransfers.length ? (
            <article className="surface-card wide-card">
              <div className="section-heading">
                <h2>Scheduled transfers</h2>
                <span>{recurringTransfers.filter((r) => r.isActive).length} active</span>
              </div>
              <div className="list-stack">
                {recurringTransfers.map((r) => (
                  <div className="history-row" key={r.recurringId}>
                    <div>
                      <strong>{r.recipientName}</strong>
                      <p>
                        {formatMoney(r.amount)} • {r.frequency}
                        {r.tag ? ` • ${r.tag}` : ""}
                        {r.memo ? ` • ${r.memo}` : ""}
                      </p>
                      <small>
                        {r.isActive
                          ? `Next: ${new Date(r.nextRunDate).toLocaleDateString()}`
                          : "Cancelled"}
                      </small>
                    </div>
                    <div className="history-meta">
                      {r.isActive ? (
                        <button
                          className="decline-button"
                          onClick={() => handleCancelRecurring(r.recurringId)}
                          type="button"
                          style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                        >
                          Cancel
                        </button>
                      ) : (
                        <span className="request-status-label">cancelled</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

      {/* ========== REQUESTS TAB ========== */}
      {activeTab === "requests" ? (
        <section className="requests-layout">
          <article className="surface-card transfer-card">
            <div className="section-heading">
              <h2>Request money</h2>
              <span>Stored procedure: sp_CreateMoneyRequest</span>
            </div>
            <form className="transfer-form" onSubmit={handleCreateRequest}>
              <label>
                Request from
                <div className="recipient-grid">
                  {initialData.contacts.map((contact) => (
                    <button
                      className={
                        contact.userId === requestPayer
                          ? "recipient-chip active"
                          : "recipient-chip"
                      }
                      key={contact.userId}
                      onClick={() => setRequestPayer(contact.userId)}
                      type="button"
                    >
                      <span>{initials(contact.fullName)}</span>
                      <strong>{contact.fullName}</strong>
                      <small>{contact.email}</small>
                    </button>
                  ))}
                </div>
              </label>

              <label>
                Amount
                <input
                  min="0.01"
                  onChange={(event) => setRequestAmount(event.target.value)}
                  required
                  step="0.01"
                  type="number"
                  value={requestAmount}
                />
              </label>

              <label>
                Memo
                <input
                  maxLength={160}
                  onChange={(event) => setRequestMemo(event.target.value)}
                  placeholder="What is this request for?"
                  type="text"
                  value={requestMemo}
                />
              </label>

              <button className="primary-button" disabled={isPending} type="submit">
                {isPending ? "Refreshing..." : "Send request"}
              </button>
            </form>
          </article>

          {/* Split bill */}
          <article className="surface-card transfer-card">
            <div className="section-heading">
              <h2>Split a bill</h2>
              <span>Evenly splits and sends requests</span>
            </div>
            <form className="transfer-form" onSubmit={handleCreateSplitBill}>
              <label>
                Description
                <input
                  maxLength={160}
                  onChange={(e) => setSplitDescription(e.target.value)}
                  placeholder="e.g. Dinner at Sushi Place"
                  required
                  type="text"
                  value={splitDescription}
                />
              </label>
              <label>
                Total amount
                <input
                  min="0.01"
                  onChange={(e) => setSplitAmount(e.target.value)}
                  required
                  step="0.01"
                  type="number"
                  value={splitAmount}
                />
              </label>
              <label>
                Split with (select participants)
                <div className="recipient-grid">
                  {initialData.contacts.map((contact) => {
                    const isSelected = splitParticipants.includes(contact.userId);
                    return (
                      <button
                        className={isSelected ? "recipient-chip active" : "recipient-chip"}
                        key={contact.userId}
                        onClick={() => {
                          setSplitParticipants((prev) =>
                            isSelected
                              ? prev.filter((id) => id !== contact.userId)
                              : [...prev, contact.userId],
                          );
                        }}
                        type="button"
                      >
                        <span>{initials(contact.fullName)}</span>
                        <strong>{contact.fullName}</strong>
                      </button>
                    );
                  })}
                </div>
              </label>
              {splitParticipants.length > 0 && splitAmount ? (
                <p style={{ color: "var(--muted)", fontWeight: 600 }}>
                  Each participant pays{" "}
                  {formatMoney(Number(splitAmount) / (splitParticipants.length + 1))}{" "}
                  ({splitParticipants.length + 1} people including you)
                </p>
              ) : null}
              <button
                className="primary-button"
                disabled={splitParticipants.length === 0}
                type="submit"
              >
                Create split bill
              </button>
            </form>
          </article>

          <article className="surface-card wide-card">
            <div className="section-heading">
              <h2>Incoming requests</h2>
              <span>
                {initialData.requests.filter(
                  (r) => r.payerUserId === currentUserId,
                ).length}{" "}
                requests
              </span>
            </div>
            <div className="list-stack">
              {initialData.requests.filter(
                (r) => r.payerUserId === currentUserId,
              ).length ? (
                initialData.requests
                  .filter((r) => r.payerUserId === currentUserId)
                  .map((item) => (
                    <div className="request-row" key={item.requestId}>
                      <div>
                        <strong>{item.requesterName}</strong>
                        <p>
                          {item.memo || "No memo"} •{" "}
                          {item.status === "pending"
                            ? "Awaiting your response"
                            : item.status}
                        </p>
                      </div>
                      <div className="request-actions">
                        <strong>{formatMoney(item.amount)}</strong>
                        {item.status === "pending" ? (
                          <div className="request-buttons">
                            <button
                              className="primary-button"
                              disabled={isPending}
                              onClick={() =>
                                handleRespondToRequest(item.requestId, true)
                              }
                              type="button"
                            >
                              Accept
                            </button>
                            <button
                              className="decline-button"
                              disabled={isPending}
                              onClick={() =>
                                handleRespondToRequest(item.requestId, false)
                              }
                              type="button"
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          <span className="request-status-label">
                            {item.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
              ) : (
                <p className="empty-copy">
                  No incoming requests. Other users can request money from you.
                </p>
              )}
            </div>
          </article>

          <article className="surface-card wide-card">
            <div className="section-heading">
              <h2>Outgoing requests</h2>
              <span>
                {initialData.requests.filter(
                  (r) => r.requesterUserId === currentUserId,
                ).length}{" "}
                requests
              </span>
            </div>
            <div className="list-stack">
              {initialData.requests.filter(
                (r) => r.requesterUserId === currentUserId,
              ).length ? (
                initialData.requests
                  .filter((r) => r.requesterUserId === currentUserId)
                  .map((item) => (
                    <div className="request-row" key={item.requestId}>
                      <div>
                        <strong>{item.payerName}</strong>
                        <p>{item.memo || "No memo"}</p>
                      </div>
                      <div className="request-actions">
                        <strong>{formatMoney(item.amount)}</strong>
                        <span
                          className={`request-status-label ${
                            item.status === "accepted"
                              ? "positive"
                              : item.status === "declined"
                                ? "negative"
                                : ""
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))
              ) : (
                <p className="empty-copy">
                  No outgoing requests. Use the form above to request money.
                </p>
              )}
            </div>
          </article>

          {splitBills.length ? (
            <article className="surface-card wide-card">
              <div className="section-heading">
                <h2>Split bills</h2>
                <span>{splitBills.length} bills</span>
              </div>
              <div className="list-stack">
                {splitBills.map((sb) => (
                  <div className="history-row" key={sb.splitBillId}>
                    <div>
                      <strong>{sb.description}</strong>
                      <p>
                        {formatMoney(sb.totalAmount)} • {sb.splitMethod} split •{" "}
                        {sb.paidCount}/{sb.participantCount} paid
                      </p>
                      <small>
                        Created by {sb.creatorName} • {formatDate(sb.createdAt)}
                      </small>
                    </div>
                    <div className="history-meta">
                      <span
                        className={`request-status-label ${
                          sb.status === "settled"
                            ? "positive"
                            : sb.status === "cancelled"
                              ? "negative"
                              : ""
                        }`}
                      >
                        {sb.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

      {/* ========== PROFILE TAB ========== */}
      {activeTab === "profile" ? (
        <section className="profile-layout">
          <article className="surface-card profile-card">
            <div className="profile-header">
              <div className="avatar-badge">{initials(session.fullName)}</div>
              <div>
                <h2>{session.fullName}</h2>
                <p>{session.email}</p>
              </div>
            </div>
            <div className="profile-grid">
              <div>
                <span>Database account</span>
                <strong>#{initialData.profile.accountId ?? "Pending"}</strong>
              </div>
              <div>
                <span>Member since</span>
                <strong>{new Date(initialData.profile.createdAt).toLocaleDateString()}</strong>
              </div>
              <div>
                <span>Authentication</span>
                <strong>Cookie session on top of SQL login procedure</strong>
              </div>
              <div>
                <span>SQL server</span>
                <strong>localhost\SQLEXPRESS via Windows auth</strong>
              </div>
            </div>
          </article>
        </section>
      ) : null}
    </div>
  );
}
