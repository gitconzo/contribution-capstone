import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { completeNewPassword } from "../utils/cognitoAuth";
import "./login.css";

function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Failed to parse JWT:", error);
    return null;
  }
}

const LECTURER_EMAILS = ["kavindubweragoda@gmail.com"];
const STUDENT_EMAILS = ["kavinduweragoda0@gmail.com"];

function getRoleFromEmail(email) {
  const safeEmail = String(email || "").trim().toLowerCase();

  if (LECTURER_EMAILS.includes(safeEmail)) return "teacher";
  if (STUDENT_EMAILS.includes(safeEmail)) return "student";
  return "student";
}

export default function SetNewPassword({ onLogin }) {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const cognitoUser = window.__cognitoNewPasswordUser;
    const email = sessionStorage.getItem("newPasswordEmail");
    const userAttributes = JSON.parse(
      sessionStorage.getItem("newPasswordUserAttributes") || "{}"
    );

    if (!cognitoUser || !email) {
      setError("Your password setup session has expired. Please log in again.");
      return;
    }

    try {
      setLoading(true);

      const result = await completeNewPassword(cognitoUser, newPassword, userAttributes);
      const payload = parseJwt(result.idToken);
      const emailFromToken = (payload?.email || email).toLowerCase();

      const user = {
        email: emailFromToken,
        name: payload?.name || payload?.email || emailFromToken,
        role: payload?.["custom:role"] || payload?.role || getRoleFromEmail(emailFromToken),
      };

      localStorage.setItem("token", result.accessToken);
      localStorage.setItem("idToken", result.idToken);
      localStorage.setItem("accessToken", result.accessToken);
      localStorage.setItem("refreshToken", result.refreshToken);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("p17_authed", "1");

      sessionStorage.removeItem("newPasswordEmail");
      sessionStorage.removeItem("newPasswordUserAttributes");
      delete window.__cognitoNewPasswordUser;

      onLogin?.(user);
      navigate("/");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to set new password.");
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
        <p className="p17-subtitle">Set your new password to continue</p>
      </div>

      <div className="p17-card">
        <h2 className="p17-card-title">Create New Password</h2>
        <p className="p17-card-sub">Your temporary password must be changed before you can sign in.</p>

        <form className="p17-form" onSubmit={handleSubmit}>
          <label className="p17-label">New password</label>
          <div className="p17-input-wrap">
            <input
              type={showPw ? "text" : "password"}
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button
              type="button"
              className="p17-eye"
              onClick={() => setShowPw((s) => !s)}
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>

          <label className="p17-label">Confirm new password</label>
          <div className="p17-input-wrap">
            <input
              type={showConfirmPw ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button
              type="button"
              className="p17-eye"
              onClick={() => setShowConfirmPw((s) => !s)}
            >
              {showConfirmPw ? "Hide" : "Show"}
            </button>
          </div>

          {error && <div className="p17-error">{error}</div>}

          <button type="submit" className="p17-cta" disabled={loading}>
            {loading ? "Saving..." : "Set New Password"}
          </button>
        </form>
      </div>
    </div>
  );
}