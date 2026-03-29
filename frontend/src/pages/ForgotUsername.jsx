import React, { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../utils/api";

export default function ForgotUsername() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setResult("");
    setError("");

    if (!email) {
      setError("Please enter your email.");
      return;
    }

    try {
      setLoading(true);

      const response = await apiFetch("/api/auth/forgot-username", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to find username.");
        return;
      }

      setResult(`Username: ${data.username} | Email: ${data.email}`);
    } catch (err) {
      console.error(err);
      setError("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ marginTop: 0 }}>Forgot Username</h1>
        <p style={{ color: "#6b7280", marginBottom: 20 }}>
          Enter your registered email to find your username.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          {error && <div style={errorStyle}>{error}</div>}
          {result && <div style={successStyle}>{result}</div>}

          <button type="submit" style={buttonStyle} disabled={loading}>
            {loading ? "Checking..." : "Find Username"}
          </button>
        </form>

        <div style={{ marginTop: 18 }}>
          <Link to="/forgot-password" style={linkStyle}>Forgot Password?</Link>
          <br />
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