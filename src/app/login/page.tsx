"use client";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Sign in failed");
      setBusy(false);
      return;
    }
    window.location.href = data.role === "ADMIN" ? "/admin" : "/m";
  }

  return (
    <div className="auth-wrap">
      <form className="card pad auth-card stack-lg" onSubmit={submit} style={{ padding: 28 }}>
        <div className="stack-sm">
          <div className="logo">
            <div className="logo-mark">C</div>
            Clubhouse Ops
          </div>
          <p className="muted small">Oriana & Festival Living · CFC</p>
        </div>
        <div className="stack">
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span>Password</span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <div className="banner bad">{error}</div>}
        </div>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
