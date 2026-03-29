import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPasswordRequest, forgotPasswordConfirm } from "../utils/cognitoAuth";
import "./login.css";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendCode(e) {
    e.preventDefault();

    if (!email.trim()) {
      setError("Please enter your registered email.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await forgotPasswordRequest(email.trim().toLowerCase());
      setSuccess("A verification code has been sent to your email.");
      setStep(2);
    } catch (err) {
      const message = err?.message || err?.code || "Failed to send verification code.";

      if (message.includes("User does not exist")) {
        setError("No account found with this email.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();

    if (!code.trim() || !newPassword || !confirmPassword) {
      setError("Please complete all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await forgotPasswordConfirm(
        email.trim().toLowerCase(),
        code.trim(),
        newPassword
      );

      setSuccess("Your password has been reset successfully. You can now sign in.");
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      const message = err?.message || err?.code || "Failed to reset password.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p17-page">
      <div className="p17-brand">
        <div className="p17-logo" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11Zm-8 0c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11Zm0 2c-2.67 0-8 1.34-8 4v1.5A1.5 1.5 0 0 0 1.5 20h13a1.5 1.5 0 0 0 1.5-1.5V17c0-2.66-5.33-4-8-4Zm8 0c-.46 0-.98.03-1.53.08 1.86.93 3.53 2.38 3.53 4.92v1.5c0 .18-.02.35-.06.5H22.5a1.5 1.5 0 0 0 1.5-1.5V17c0-2.66-5.33-4-8-4Z" />
          </svg>
        </div>
        <h1 className="p17-title">Project17</h1>
        <p className="p17-subtitle">Rule-based Contribution Assessment System</p>
      </div>

      <div className="p17-card">
        <h2 className="p17-card-title">Forgot Password</h2>
        <p className="p17-card-sub">
          {step === 1
            ? "Enter your registered email to receive a reset code."
            : "Enter the verification code and create a new password."}
        </p>

        {step === 1 ? (
          <form className="p17-form" onSubmit={handleSendCode}>
            <label className="p17-label">Email address</label>
            <div className="p17-input-wrap">
              <span className="p17-left-icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4-8 5L4 8V6l8 5 8-5v2Z" />
                </svg>
              </span>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            {error && <div className="p17-error">{error}</div>}
            {success && <div className="p17-success">{success}</div>}

            <button type="submit" className="p17-cta" disabled={loading}>
              {loading ? "Sending code..." : "Send Reset Code"}
            </button>
          </form>
        ) : (
          <form className="p17-form" onSubmit={handleResetPassword}>
            <label className="p17-label">Verification code</label>
            <div className="p17-field">
              <input
                className="p17-input"
                type="text"
                placeholder="Enter the code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>

            <label className="p17-label">New password</label>
            <div className="p17-password-wrap">
              <input
                className="p17-input p17-input-password"
                type={showPw ? "text" : "password"}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                className="p17-toggle-btn"
                onClick={() => setShowPw((s) => !s)}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>

            <label className="p17-label">Confirm new password</label>
            <div className="p17-password-wrap">
              <input
                className="p17-input p17-input-password"
                type={showConfirmPw ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                className="p17-toggle-btn"
                onClick={() => setShowConfirmPw((s) => !s)}
              >
                {showConfirmPw ? "Hide" : "Show"}
              </button>
            </div>

            {error && <div className="p17-error">{error}</div>}
            {success && <div className="p17-success">{success}</div>}

            <button type="submit" className="p17-cta" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        <div style={{ marginTop: 14, textAlign: "center", fontSize: 14 }}>
          <Link to="/login" style={{ color: "#2563eb", textDecoration: "none" }}>
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}