import React, { useState } from "react";
import { requestOtp, verifyOtp } from "../auth";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await requestOtp(email);
      setSent(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      onLogin(await verifyOtp(email, code));
    } catch (verificationError) {
      setError(verificationError.message);
    } finally {
      setBusy(false);
    }
  }

  function changeEmail() {
    setSent(false);
    setCode("");
    setError("");
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="eyebrow">PERSONAL FINANCE</span>
        <h1 id="login-title">Know where your money goes.</h1>
        <p>Sign in with a one-time code sent to your email. Your finance data stays in this browser.</p>

        {!sent ? (
          <form onSubmit={sendCode} className="auth-form">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
            {error && <div className="error" role="alert">{error}</div>}
            <button className="primary" disabled={busy}>
              {busy ? "Sending code..." : "Send email code"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="auth-form">
            <div className="sent-to">
              <span>Code sent to</span>
              <strong>{email}</strong>
            </div>
            <label htmlFor="otp">One-time code</label>
            <input
              id="otp"
              className="otp-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              minLength="4"
              maxLength="10"
              required
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              placeholder="000000"
            />
            {error && <div className="error" role="alert">{error}</div>}
            <button className="primary" disabled={busy}>
              {busy ? "Checking code..." : "Open my dashboard"}
            </button>
            <button type="button" className="text-button" onClick={changeEmail}>
              Use a different email
            </button>
          </form>
        )}

        <p className="auth-footnote">
          <span aria-hidden="true">&#9679;</span> Secure email OTP sign in
        </p>
      </section>
    </main>
  );
}
