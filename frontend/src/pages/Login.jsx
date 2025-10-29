import React, { useState } from "react";
import "./login.css";

export function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) return setError("Please enter email and password.");
    setError("");
    onLogin?.();
  }

  return (
    <div className="p17-page">
      {/* header/logo + brand */}
      <div className="p17-brand">
        <div className="p17-logo" aria-hidden>
          {/* people icon */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11Zm-8 0c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11Zm0 2c-2.67 0-8 1.34-8 4v1.5A1.5 1.5 0 0 0 1.5 20h13a1.5 1.5 0 0 0 1.5-1.5V17c0-2.66-5.33-4-8-4Zm8 0c-.46 0-.98.03-1.53.08 1.86.93 3.53 2.38 3.53 4.92v1.5c0 .18-.02.35-.06.5H22.5a1.5 1.5 0 0 0 1.5-1.5V17c0-2.66-5.33-4-8-4Z"/>
          </svg>
        </div>
        <h1 className="p17-title">Project17</h1>
        <p className="p17-subtitle">Rule-based Contribution Assessment System</p>
      </div>

      {/* card */}
      <div className="p17-card">
        <h2 className="p17-card-title">Sign in to your account</h2>
        <p className="p17-card-sub">Enter your credentials to access the assessment dashboard</p>

        <form className="p17-form" onSubmit={handleSubmit}>
          {/* email */}
          <label className="p17-label">Email address</label>
          <div className="p17-input-wrap">
            <span className="p17-left-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4-8 5L4 8V6l8 5 8-5v2Z"/>
              </svg>
            </span>
            <input
              type="email"
              placeholder="lecturer@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          {/* password */}
          <label className="p17-label">Password</label>
          <div className="p17-input-wrap">
            <span className="p17-left-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5Zm3 8H9V6a3 3 0 0 1 6 0v3Z"/>
              </svg>
            </span>
            <input
              type={showPw ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="p17-eye"
              onClick={() => setShowPw((s) => !s)}
              aria-label="Toggle password visibility"
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>

          {error && <div className="p17-error">{error}</div>}

          <button type="submit" className="p17-cta">Sign in</button>
        </form>

        <p className="p17-hint">Any email and password combination</p>
      </div>
    </div>
  );
}
