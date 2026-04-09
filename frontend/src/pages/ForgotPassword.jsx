import React, { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPasswordRequest, forgotPasswordConfirm } from "../utils/cognitoAuth";

export default function ForgotPassword() {
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendCode(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    try {
      setLoading(true);

      await forgotPasswordRequest(email.trim().toLowerCase());

      setMessage("A verification code has been sent to your email.");
      setStep(2);
    } catch (err) {
      console.error(err);
      const msg = err?.message || err?.code || "Unable to send reset code.";

      if (msg.includes("User does not exist")) {
        setError("No account found for that email.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!email.trim() || !code.trim() || !newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      await forgotPasswordConfirm(
        email.trim().toLowerCase(),
        code.trim(),
        newPassword
      );

      setMessage("Password reset successfully. You can now log in with your new password.");
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
      setStep(1);
    } catch (err) {
      console.error(err);
      const msg = err?.message || err?.code || "Unable to reset password.";

      if (msg.includes("CodeMismatchException") || msg.includes("Invalid verification code")) {
        setError("Invalid verification code.");
      } else if (msg.includes("ExpiredCodeException")) {
        setError("The verification code has expired. Please request a new code.");
      } else if (msg.includes("User does not exist")) {
        setError("No account found for that email.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ marginTop: 0 }}>Forgot Password</h1>
        <p style={{ color: "#6b7280", marginBottom: 20 }}>
          {step === 1
            ? "Enter your email to receive a password reset code."
            : "Enter the verification code and set your new password."}
        </p>

        {step === 1 ? (
          <form onSubmit={handleSendCode} style={{ display: "grid", gap: 14 }}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />

            {error && <div style={errorStyle}>{error}</div>}
            {message && <div style={successStyle}>{message}</div>}

            <button type="submit" style={buttonStyle} disabled={loading}>
              {loading ? "Sending..." : "Send Reset Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} style={{ display: "grid", gap: 14 }}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />

            <input
              type="text"
              placeholder="Enter verification code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={inputStyle}
            />

            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
            />

            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
            />

            {error && <div style={errorStyle}>{error}</div>}
            {message && <div style={successStyle}>{message}</div>}

            <button type="submit" style={buttonStyle} disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setCode("");
                setNewPassword("");
                setConfirmPassword("");
                setError("");
                setMessage("");
              }}
              style={secondaryButtonStyle}
            >
              Back
            </button>
          </form>
        )}

        <div style={{ marginTop: 18 }}>
          <Link to="/login" style={linkStyle}>Back to Login</Link>
        </div>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f9fafb",
  padding: 24,
};

const cardStyle = {
  width: "100%",
  maxWidth: 460,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 24,
  boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  fontSize: 14,
  boxSizing: "border-box",
};

const buttonStyle = {
  border: "none",
  background: "#111827",
  color: "#fff",
  borderRadius: 10,
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 10,
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const errorStyle = {
  background: "#fee2e2",
  color: "#b91c1c",
  padding: "10px 12px",
  borderRadius: 10,
  fontSize: 14,
};

const successStyle = {
  background: "#dcfce7",
  color: "#166534",
  padding: "10px 12px",
  borderRadius: 10,
  fontSize: 14,
};

const linkStyle = {
  color: "#2563eb",
  textDecoration: "none",
  fontSize: 14,
};