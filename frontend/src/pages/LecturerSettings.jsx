import { useEffect, useState } from "react";
import { changeCurrentUserPassword } from "../utils/cognitoAuth";
import { apiFetch } from "../utils/api";

export default function LecturerSettings({ darkMode }) {
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

  const [studentDefaultPassword, setStudentDefaultPassword] = useState("");
  const [studentConfirmPassword, setStudentConfirmPassword] = useState("");
  const [currentDefaultPassword, setCurrentDefaultPassword] = useState("");
  const [showCurrentDefaultPassword, setShowCurrentDefaultPassword] = useState(false);

  const [teacherMessage, setTeacherMessage] = useState("");
  const [teacherError, setTeacherError] = useState("");
  const [studentMessage, setStudentMessage] = useState("");
  const [studentError, setStudentError] = useState("");

  const [loadingTeacher, setLoadingTeacher] = useState(false);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [loadingDefaultPassword, setLoadingDefaultPassword] = useState(true);

  useEffect(() => {
    async function loadDefaultPassword() {
      try {
        setLoadingDefaultPassword(true);

        const response = await apiFetch("/api/auth/student-default-password", {
          method: "GET",
        });

        const data = await response.json();

        if (response.ok) {
          setCurrentDefaultPassword(data.studentDefaultPassword || "");
        }
      } catch (error) {
        console.error("Failed to load default student password:", error);
      } finally {
        setLoadingDefaultPassword(false);
      }
    }

    loadDefaultPassword();
  }, []);

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

  async function handleStudentDefaultPasswordChange(e) {
    e.preventDefault();
    setStudentMessage("");
    setStudentError("");

    if (!studentDefaultPassword || !studentConfirmPassword) {
      setStudentError("Please fill in all student default password fields.");
      return;
    }

    if (studentDefaultPassword.length < 8) {
      setStudentError("Student default password must be at least 8 characters.");
      return;
    }

    if (studentDefaultPassword !== studentConfirmPassword) {
      setStudentError("Student password and confirm password do not match.");
      return;
    }

    try {
      setLoadingStudent(true);

      const response = await apiFetch("/api/auth/student-default-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newPassword: studentDefaultPassword,
          confirmPassword: studentConfirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStudentError(data.message || "Failed to update student default password.");
        return;
      }

      setStudentMessage(
        `Student default password updated successfully. ${data.updatedStudents || 0} student account(s) were updated.`
      );
      setCurrentDefaultPassword(studentDefaultPassword);
      setStudentDefaultPassword("");
      setStudentConfirmPassword("");
    } catch (error) {
      console.error(error);
      setStudentError("Cannot connect to server.");
    } finally {
      setLoadingStudent(false);
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
          Manage your lecturer account and the student default password.
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
            <h3 style={titleStyle(theme)}>Student Default Password</h3>
            <p style={subtitleStyle(theme)}>
              This password is used when new student accounts are created. Students who already changed
              their own password will not be affected unless your backend is configured to update them.
            </p>

            <div
              style={{
                border: "1px solid #86efac",
                background: "#f0fdf4",
                borderRadius: 14,
                padding: 16,
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#22c55e",
                    display: "inline-block",
                  }}
                />
                <span style={{ fontWeight: 700, color: "#166534" }}>Active</span>
              </div>

              <div style={{ color: "#166534", fontSize: 14, marginBottom: 8 }}>
                Current default password
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <input
                  type={showCurrentDefaultPassword ? "text" : "password"}
                  value={
                    loadingDefaultPassword
                      ? "Loading..."
                      : currentDefaultPassword || "No default password found"
                  }
                  readOnly
                  style={{
                    ...inputStyle(theme),
                    background: darkMode ? "#0f172a" : "#ffffff",
                    flex: 1,
                  }}
                />

                <button
                  type="button"
                  onClick={() => setShowCurrentDefaultPassword((prev) => !prev)}
                  style={secondaryButtonStyle(theme)}
                  disabled={loadingDefaultPassword || !currentDefaultPassword}
                >
                  {showCurrentDefaultPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <form onSubmit={handleStudentDefaultPasswordChange} style={{ display: "grid", gap: 14 }}>
              <input
                type="password"
                placeholder="New default student password"
                value={studentDefaultPassword}
                onChange={(e) => setStudentDefaultPassword(e.target.value)}
                style={inputStyle(theme)}
              />

              <input
                type="password"
                placeholder="Confirm new default student password"
                value={studentConfirmPassword}
                onChange={(e) => setStudentConfirmPassword(e.target.value)}
                style={inputStyle(theme)}
              />

              {studentError && <div style={errorStyle}>{studentError}</div>}
              {studentMessage && <div style={successStyle}>{studentMessage}</div>}

              <button type="submit" style={buttonStyle(theme)} disabled={loadingStudent}>
                {loadingStudent ? "Updating..." : "Update Default Password"}
              </button>
            </form>
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