"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const seededAccounts = [
  { email: "alice@wallet.demo", password: "demo123" },
  { email: "bob@wallet.demo", password: "demo123" },
  { email: "charlie@wallet.demo", password: "demo123" },
];

export default function AuthForm({ mode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    email: mode === "login" ? seededAccounts[0].email : "",
    password: mode === "login" ? seededAccounts[0].password : "",
    openingBalance: "1500",
  });

  const isRegister = mode === "register";
  const title = isRegister ? "Register" : "Login";
  const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
  const secondaryHref = isRegister ? "/login" : "/register";
  const secondaryLabel = isRegister
    ? "Already have an account? Sign in."
    : "Need a fresh demo user? Register one.";

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: form.fullName,
            email: form.email,
            password: form.password,
            openingBalance: Number(form.openingBalance),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Request failed.");
          return;
        }

        router.push("/dashboard");
        router.refresh();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not reach the server.",
        );
      }
    });
  }

  return (
    <section className="auth-card">
      <div className="auth-card-header">
        <div className="eyebrow">{title}</div>
        <h2>{isRegister ? "Create your wallet profile" : "Welcome back"}</h2>
        <p>
          {isRegister
            ? "Registration calls a stored procedure that creates the user and wallet in one transaction."
            : "Seeded demo logins are available after you run db_init.sql."}
        </p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {isRegister ? (
          <label>
            Full name
            <input
              autoComplete="name"
              onChange={(event) => updateField("fullName", event.target.value)}
              placeholder="Alyssa P. Hacker"
              required
              type="text"
              value={form.fullName}
            />
          </label>
        ) : null}

        <label>
          Email
          <input
            autoComplete="email"
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="name@example.com"
            required
            type="email"
            value={form.email}
          />
        </label>

        <label>
          Password
          <input
            autoComplete={isRegister ? "new-password" : "current-password"}
            onChange={(event) => updateField("password", event.target.value)}
            placeholder="Enter your password"
            required
            type="password"
            value={form.password}
          />
        </label>

        {isRegister ? (
          <label>
            Opening balance
            <input
              min="0"
              onChange={(event) =>
                updateField("openingBalance", event.target.value)
              }
              step="0.01"
              type="number"
              value={form.openingBalance}
            />
          </label>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}

        <button className="primary-button" disabled={isPending} type="submit">
          {isPending ? "Working..." : title}
        </button>
      </form>

      <div className="auth-footer">
        <Link href={secondaryHref}>{secondaryLabel}</Link>
      </div>

      {!isRegister ? (
        <div className="seeded-panel">
          <strong>Seeded demo accounts</strong>
          <ul>
            {seededAccounts.map((account) => (
              <li key={account.email}>
                <span>{account.email}</span>
                <code>{account.password}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
