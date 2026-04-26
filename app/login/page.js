import { redirect } from "next/navigation";
import AuthForm from "@/components/auth-form";
import { getSession } from "@/lib/session";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-page">
      <section className="hero-panel">
        <div className="eyebrow">SQL Server Showcase</div>
        <h1>Wallet flows powered by procedures, triggers, and transactions.</h1>
        <p>
          This demo uses Next.js App Router for the UI and SQL Server Express
          for account registration, login, transfer execution, and balance
          auditing.
        </p>
        <div className="hero-grid">
          <article className="hero-card">
            <span>Stored Procedures</span>
            <strong>Register, login, dashboard reads, and transfers</strong>
          </article>
          <article className="hero-card">
            <span>Transactions</span>
            <strong>Atomic money movement with rollback on errors</strong>
          </article>
          <article className="hero-card">
            <span>Triggers</span>
            <strong>Automatic balance audit entries after each change</strong>
          </article>
        </div>
      </section>
      <AuthForm mode="login" />
    </main>
  );
}
