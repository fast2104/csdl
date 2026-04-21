"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "transfer", label: "Transfer" },
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

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export default function DashboardShell({ dbError, initialData, session }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedRecipient, setSelectedRecipient] = useState(
    initialData.contacts[0]?.userId ?? null,
  );
  const [transferAmount, setTransferAmount] = useState("125.00");
  const [transferMemo, setTransferMemo] = useState("Coffee split");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [transactionModal, setTransactionModal] = useState({
    open: false,
    status: "idle",
    title: "",
    message: "",
  });

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

  function refreshDashboard(successMessage) {
    setFeedback(successMessage || "");
    startTransition(() => {
      router.refresh();
    });
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
      setTransactionModal({
        open: true,
        status: "success",
        title: "Transfer complete",
        message:
          data.result?.Message ||
          "The transaction committed successfully and the balances were updated.",
      });
      refreshDashboard(data.result?.Message || "Transfer completed.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not reach the server.",
      );
      setTransactionModal({
        open: true,
        status: "error",
        title: "Connection problem",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Could not reach the server.",
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

              <button className="primary-button" disabled={isPending} type="submit">
                {isPending ? "Refreshing..." : "Execute transfer"}
              </button>
            </form>
          </article>
        </section>
      ) : null}

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
