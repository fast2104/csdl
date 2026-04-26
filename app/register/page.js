import { redirect } from "next/navigation";
import AuthForm from "@/components/auth-form";
import { getSession } from "@/lib/session";

export default async function RegisterPage() {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-page">
      <section className="hero-panel">
        <div className="eyebrow">Create Demo Account</div>
        <h1>Register a fresh wallet user directly through SQL Server.</h1>
        <p>
          New accounts are created by a stored procedure that inserts the user,
          creates a wallet account, and seeds an opening balance in one
          transaction.
        </p>
        <div className="hero-grid">
          <article className="hero-card">
            <span>Windows Auth</span>
            <strong>Connects to localhost\SQLEXPRESS with trusted connection</strong>
          </article>
          <article className="hero-card">
            <span>Opening Balance</span>
            <strong>Configurable at registration for easier demos</strong>
          </article>
          <article className="hero-card">
            <span>Contacts Ready</span>
            <strong>Seeded users are available as transfer recipients</strong>
          </article>
        </div>
      </section>
      <AuthForm mode="register" />
    </main>
  );
}
