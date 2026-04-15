import { useEffect, useState } from "react";
import { changeCurrentUserPassword } from "../utils/cognitoAuth";
import { apiFetch } from "../utils/api";

export default function LecturerSettings({ darkMode, teams = [] }) {
  const theme = darkMode
    ? {
        pageBg: "#0b1120",
        card: "#111827",
        cardSoft: "#0f172a",
        text: "#f8fafc",
        subtext: "#94a3b8",
        border: "#1f2937",
        inputBg: "#0f172a",
        inputBorder: "#374151",
        inputText: "#f8fafc",
        btnBg: "#f8fafc",
        btnText: "#0b1120",
        mutedBtnBg: "#111827",
        mutedBtnText: "#f8fafc",
      }
    : {
        pageBg: "#f9fafb",
        card: "#ffffff",
        cardSoft: "#fafafa",
        text: "#111827",
        subtext: "#6b7280",
        border: "#e5e7eb",
        inputBg: "#ffffff",
        inputBorder: "#d1d5db",
        inputText: "#111827",
        btnBg: "#111827",
        btnText: "#ffffff",
        mutedBtnBg: "#ffffff",
        mutedBtnText: "#111827",
      };

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [teacherMessage, setTeacherMessage] = useState("");
  const [teacherError, setTeacherError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");

  const [loadingTeacher, setLoadingTeacher] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);

  // Student reset
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedEmail, setSelectedEmail] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (teams.length && !selectedTeamId) setSelectedTeamId(teams[0].id);
  }, [teams, selectedTeamId]);

  async function handleTeacherPasswordChange(e) {
    e.preventDefault();
    setTeacherMessage("");
    setTeacherError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setTeacherError("Please fill in all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setTeacherError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setTeacherError("New password and confirm password do not match.");
      return;
    }

    try {
      setLoadingTeacher(true);

      await changeCurrentUserPassword(currentPassword, newPassword);

      setTeacherMessage("Lecturer password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      const msg = error?.message || error?.code || "Failed to update password.";

      if (msg.includes("Incorrect username or password")) {
        setTeacherError("Current password is incorrect.");
      } else if (msg.includes("InvalidPasswordException")) {
        setTeacherError("New password does not meet the password policy.");
      } else if (msg.includes("LimitExceededException")) {
        setTeacherError("Too many attempts. Please try again later.");
      } else if (msg.includes("No logged-in user found")) {
        setTeacherError("No logged-in user found. Please log in again.");
      } else {
        setTeacherError(msg);
      }
    } finally {
      setLoadingTeacher(false);
    }
  }

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const teamStudents = selectedTeam?.students || [];

  async function handleResetPassword() {
    if (!selectedEmail) return;
    setResetMessage("");
    setResetError("");
    setLoadingReset(true);
    try {
      const res = await apiFetch("/api/auth/reset-student-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: selectedEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || "Failed to reset password.");
      } else {
        setResetMessage(`Password reset sent to ${selectedEmail}.`);
        setSelectedEmail("");
      }
    } catch {
      setResetError("Cannot connect to server.");
    } finally {
      setLoadingReset(false);
      setConfirming(false);
    }
  }

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: 1100,
        margin: "0 auto",
        background: theme.pageBg,
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          background: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: 20,
          padding: 24,
          boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
        }}
      >
        <h1 style={{ marginTop: 0, fontSize: 30, color: theme.text }}>
          Lecturer Settings
        </h1>
        <p style={{ color: theme.subtext, marginBottom: 24 }}>
          Manage your lecturer account and student access.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: 20,
          }}
        >
          <div style={cardStyle(theme)}>
            <h3 style={titleStyle(theme)}>Change Lecturer Password</h3>
            <p style={subtitleStyle(theme)}>
              Update your own Cognito password securely.
            </p>

            <form onSubmit={handleTeacherPasswordChange} style={{ display: "grid", gap: 14 }}>
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={inputStyle(theme)}
              />

              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={inputStyle(theme)}
              />

              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle(theme)}
              />

              {teacherError && <div style={errorStyle}>{teacherError}</div>}
              {teacherMessage && <div style={successStyle}>{teacherMessage}</div>}

              <button type="submit" style={buttonStyle(theme)} disabled={loadingTeacher}>
                {loadingTeacher ? "Updating..." : "Update Lecturer Password"}
              </button>
            </form>
          </div>

          <div style={cardStyle(theme)}>
            <h3 style={titleStyle(theme)}>Reset Student Password</h3>
            <p style={subtitleStyle(theme)}>
              Send a password reset to a specific student. If they haven't set their password yet,
              the invite email will be resent. Otherwise they'll receive a reset link.
            </p>

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: theme.subtext, marginBottom: 6 }}>Team</div>
                <select
                  value={selectedTeamId}
                  onChange={e => { setSelectedTeamId(e.target.value); setSelectedEmail(""); setConfirming(false); }}
                  style={inputStyle(theme)}
                >
                  {teams.length === 0 && <option value="">No teams found</option>}
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name} {t.code ? `(${t.code})` : ""}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, color: theme.subtext, marginBottom: 6 }}>Student</div>
                <select
                  value={selectedEmail}
                  onChange={e => { setSelectedEmail(e.target.value); setConfirming(false); setResetMessage(""); setResetError(""); }}
                  style={inputStyle(theme)}
                  disabled={!teamStudents.length}
                >
                  <option value="">— Select a student —</option>
                  {teamStudents.map(s => (
                    <option key={s.email} value={s.email}>{s.name} ({s.email})</option>
                  ))}
                </select>
              </div>

              {resetError && <div style={errorStyle}>{resetError}</div>}
              {resetMessage && <div style={successStyle}>{resetMessage}</div>}

              {!confirming ? (
                <button
                  type="button"
                  style={buttonStyle(theme)}
                  disabled={!selectedEmail || loadingReset}
                  onClick={() => setConfirming(true)}
                >
                  Reset Password
                </button>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{
                    background: darkMode ? "#1c1917" : "#fef9c3",
                    border: `1px solid ${darkMode ? "#78350f" : "#fde047"}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: darkMode ? "#fde68a" : "#713f12",
                  }}>
                    Send a password reset to <strong>{selectedEmail}</strong>?
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      style={buttonStyle(theme)}
                      disabled={loadingReset}
                      onClick={handleResetPassword}
                    >
                      {loadingReset ? "Sending..." : "Yes, Reset"}
                    </button>
                    <button
                      type="button"
                      style={secondaryButtonStyle(theme)}
                      disabled={loadingReset}
                      onClick={() => setConfirming(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function cardStyle(theme) {
  return {
    background: theme.cardSoft,
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: 20,
  };
}

function titleStyle(theme) {
  return {
    marginTop: 0,
    marginBottom: 10,
    fontSize: 20,
    color: theme.text,
  };
}

function subtitleStyle(theme) {
  return {
    color: theme.subtext,
    fontSize: 14,
    marginTop: 0,
    marginBottom: 16,
    lineHeight: 1.5,
  };
}

function inputStyle(theme) {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: `1px solid ${theme.inputBorder}`,
    fontSize: 14,
    boxSizing: "border-box",
    background: theme.inputBg,
    color: theme.inputText,
    outline: "none",
  };
}

function buttonStyle(theme) {
  return {
    border: "none",
    background: theme.btnBg,
    color: theme.btnText,
    borderRadius: 10,
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };
}

function secondaryButtonStyle(theme) {
  return {
    border: `1px solid ${theme.border}`,
    background: theme.mutedBtnBg,
    color: theme.mutedBtnText,
    borderRadius: 10,
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };
}

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