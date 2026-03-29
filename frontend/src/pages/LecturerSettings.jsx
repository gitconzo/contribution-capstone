import React, { useEffect, useState } from "react";
import { changeCurrentUserPassword } from "../utils/cognitoAuth";

export default function LecturerSettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [defaultPassword, setDefaultPassword] = useState("");
  const [newDefaultPassword, setNewDefaultPassword] = useState("");
  const [confirmDefaultPassword, setConfirmDefaultPassword] = useState("");
  const [showDefaultPassword, setShowDefaultPassword] = useState(false);

  const [teacherMessage, setTeacherMessage] = useState("");
  const [teacherError, setTeacherError] = useState("");
  const [studentMessage, setStudentMessage] = useState("");
  const [studentError, setStudentError] = useState("");

  const [loadingTeacher, setLoadingTeacher] = useState(false);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [loadingDefault, setLoadingDefault] = useState(true);

  useEffect(() => {
    fetchCurrentDefaultPassword();
  }, []);

  async function fetchCurrentDefaultPassword() {
    try {
      setLoadingDefault(true);
      const response = await fetch("http://localhost:5002/api/settings");
      const data = await response.json();

      if (!response.ok) {
        setStudentError(data.error || "Failed to load current default password.");
        return;
      }

      setDefaultPassword(data.studentDefaultPassword || "");
    } catch (error) {
      console.error(error);
      setStudentError("Cannot load current default password.");
    } finally {
      setLoadingDefault(false);
    }
  }

  async function handleTeacherPasswordChange(e) {
    e.preventDefault();
    setTeacherMessage("");
    setTeacherError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setTeacherError("Please fill in all lecturer password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setTeacherError("New lecturer password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setTeacherError("New lecturer passwords do not match.");
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
      setTeacherError(error?.message || "Failed to update lecturer password.");
    } finally {
      setLoadingTeacher(false);
    }
  }

  async function handleDefaultPasswordChange(e) {
    e.preventDefault();
    setStudentMessage("");
    setStudentError("");

    if (!newDefaultPassword || !confirmDefaultPassword) {
      setStudentError("Please fill in all default password fields.");
      return;
    }

    if (newDefaultPassword.length < 8) {
      setStudentError("Default password must be at least 8 characters.");
      return;
    }

    if (newDefaultPassword !== confirmDefaultPassword) {
      setStudentError("Default passwords do not match.");
      return;
    }

    try {
      setLoadingStudent(true);

      const response = await fetch("http://localhost:5002/api/settings/student-default-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newPassword: newDefaultPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStudentError(data.error || "Failed to update default password.");
        return;
      }

      setStudentMessage("Student default password updated successfully.");
      setNewDefaultPassword("");
      setConfirmDefaultPassword("");
      setDefaultPassword(data.studentDefaultPassword || "");
    } catch (error) {
      console.error(error);
      setStudentError("Cannot connect to server.");
    } finally {
      setLoadingStudent(false);
    }
  }

  return (
    <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 20,
          padding: 24,
          boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
        }}
      >
        <h1 style={{ marginTop: 0, fontSize: 30, color: "#111827" }}>Lecturer Settings</h1>
        <p style={{ color: "#6b7280", marginBottom: 24 }}>
          Manage your lecturer password and the active student default password.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 20,
          }}
        >
          <div style={cardStyle}>
            <h3 style={titleStyle}>Change Lecturer Password</h3>
            <form onSubmit={handleTeacherPasswordChange} style={{ display: "grid", gap: 14 }}>
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
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

              {teacherError && <div style={errorStyle}>{teacherError}</div>}
              {teacherMessage && <div style={successStyle}>{teacherMessage}</div>}

              <button type="submit" style={buttonStyle} disabled={loadingTeacher}>
                {loadingTeacher ? "Updating..." : "Update Lecturer Password"}
              </button>
            </form>
          </div>

          <div style={cardStyle}>
            <h3 style={titleStyle}>Student Default Password</h3>

            <div style={activeBoxStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={activeDotStyle}></span>
                <span style={{ fontWeight: 600, color: "#166534" }}>Active</span>
              </div>

              <div style={{ fontSize: 14, color: "#374151", marginBottom: 8 }}>
                Current default password
              </div>

              <div style={passwordDisplayStyle}>
                <span>
                  {loadingDefault
                    ? "Loading..."
                    : showDefaultPassword
                    ? defaultPassword
                    : "•".repeat(Math.max(defaultPassword.length, 8))}
                </span>

                <button
                  type="button"
                  onClick={() => setShowDefaultPassword((s) => !s)}
                  style={secondaryButtonStyle}
                >
                  {showDefaultPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <p style={{ color: "#6b7280", fontSize: 14 }}>
              Every newly created student account will use this password.
            </p>

            <form onSubmit={handleDefaultPasswordChange} style={{ display: "grid", gap: 14 }}>
              <input
                type="password"
                placeholder="New default student password"
                value={newDefaultPassword}
                onChange={(e) => setNewDefaultPassword(e.target.value)}
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Confirm new default student password"
                value={confirmDefaultPassword}
                onChange={(e) => setConfirmDefaultPassword(e.target.value)}
                style={inputStyle}
              />

              {studentError && <div style={errorStyle}>{studentError}</div>}
              {studentMessage && <div style={successStyle}>{studentMessage}</div>}

              <button type="submit" style={buttonStyle} disabled={loadingStudent}>
                {loadingStudent ? "Updating..." : "Update Default Password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "#fafafa",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 20,
};

const titleStyle = {
  marginTop: 0,
  marginBottom: 16,
  fontSize: 20,
  color: "#111827",
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
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 13,
  cursor: "pointer",
};

const activeBoxStyle = {
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  borderRadius: 12,
  padding: 14,
  marginBottom: 16,
};

const activeDotStyle = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "#22c55e",
  display: "inline-block",
};

const passwordDisplayStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontSize: 14,
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