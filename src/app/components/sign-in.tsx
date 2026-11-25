"use client";
import { useState } from "react";
import { api, errorMessage } from "./client-api";
export function SignIn({
  accounts,
}: {
  accounts: { id: string; name: string }[];
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function signIn(personaId: string) {
    setBusy(true);
    setError("");
    try {
      await api("/api/session", "POST", { personaId });
      window.location.reload();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Choose a sample account</h2>
      <p>
        Explore forecasting with fictional data. Changes reset when the server
        restarts.
      </p>
      <div className="account-grid">
        {accounts.map((account) => (
          <button
            key={account.id}
            disabled={busy}
            onClick={() => signIn(account.id)}
          >
            {account.name}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
