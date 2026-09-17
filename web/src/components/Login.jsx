import React, { useState } from "react";
import { requestOtp, verifyOtp } from "../auth";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (password.length < 8) throw new Error("Password must be at least 8 characters.");
      if (resetMode && password !== confirmPassword) throw new Error("The new passwords do not match.");
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
      onLogin(await verifyOtp(email, code, password, { resetPassword: resetMode }));
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

  function toggleResetMode() {
    setResetMode((current) => !current);
    setPassword("");
    setConfirmPassword("");
    setCode("");
    setSent(false);
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
        <p>
          {resetMode
            ? "Choose a new password, then confirm the change with a one-time email code."
            : "Sign in with your password and a one-time email code. Your finance data stays in this browser."}
        </p>

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
            <label htmlFor="password">{resetMode ? "New password" : "Password"}</label>
            <input
              id="password"
              type="password"
              autoComplete={resetMode ? "new-password" : "current-password"}
              minLength="8"
              maxLength="128"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
            />
            {resetMode && (
              <>
                <label htmlFor="confirm-password">Confirm new password</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength="8"
                  maxLength="128"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Enter the new password again"
                />
              </>
            )}
            <p className="field-help">
              {resetMode
                ? "Use at least 8 characters. Your old password will be replaced after OTP verification."
                : "Your first verified sign-in creates this password."}
            </p>
            {error && <div className="error" role="alert">{error}</div>}
            <button className="primary" disabled={busy}>
              {busy ? "Sending code..." : resetMode ? "Send reset code" : "Continue with email"}
            </button>
            <button type="button" className="text-button" onClick={toggleResetMode}>
              {resetMode ? "Back to sign in" : "Forgot or need to reset password?"}
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
              {busy ? "Checking code..." : resetMode ? "Reset password & sign in" : "Open my dashboard"}
            </button>
            <button type="button" className="text-button" onClick={changeEmail}>
              Use a different email or password
            </button>
          </form>
        )}

        <p className="auth-footnote">
          <span aria-hidden="true">&#9679;</span> {resetMode ? "Secure OTP password reset" : "Password + email verification"}
        </p>
      </section>
    </main>
  );
}
