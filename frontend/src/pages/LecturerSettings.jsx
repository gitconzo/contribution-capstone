import React, { useState } from "react";

export default function LecturerSettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [currentStudentDefaultPassword, setCurrentStudentDefaultPassword] = useState("");
  const [studentDefaultPassword, setStudentDefaultPassword] = useState("");
  const [studentConfirmPassword, setStudentConfirmPassword] = useState("");

  const [teacherMessage, setTeacherMessage] = useState("");
  const [teacherError, setTeacherError] = useState("");
  const [studentMessage, setStudentMessage] = useState("");
  const [studentError, setStudentError] = useState("");

  const [loadingTeacher, setLoadingTeacher] = useState(false);
  const [loadingStudent, setLoadingStudent] = useState(false);

  async function handleTeacherPasswordChange(e) {
    e.preventDefault();
    setTeacherMessage("");
    setTeacherError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setTeacherError("Please fill in all fields.");
      return;
    }

    if (newPassword.length < 6) {
      setTeacherError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setTeacherError("New password and confirm password do not match.");
      return;
    }

    try {
      setLoadingTeacher(true);
      const token = localStorage.getItem("token");

      const response = await fetch("http://localhost:5002/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setTeacherError(data.message || "Failed to update password.");
        return;
      }

      setTeacherMessage("Lecturer password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      setTeacherError("Cannot connect to server.");
    } finally {
      setLoadingTeacher(false);
    }
  }

  async function handleStudentDefaultPasswordChange(e) {
    e.preventDefault();
    setStudentMessage("");
    setStudentError("");

    if (!currentStudentDefaultPassword || !studentDefaultPassword || !studentConfirmPassword) {
      setStudentError("Please fill in all student password fields.");
      return;
    }

    if (studentDefaultPassword.length < 6) {
      setStudentError("Student default password must be at least 6 characters.");
      return;
    }

    if (studentDefaultPassword !== studentConfirmPassword) {
      setStudentError("Student password and confirm password do not match.");
      return;
    }

    try {
      setLoadingStudent(true);
      const token = localStorage.getItem("token");

      const response = await fetch("http://localhost:5002/api/auth/student-default-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentDefaultPassword: currentStudentDefaultPassword,
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

      setCurrentStudentDefaultPassword("");
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
          Manage your account password and student default login password.
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
            <h3 style={titleStyle}>Change Student Default Password</h3>
            <p style={{ color: "#6b7280", fontSize: 14, marginTop: 0 }}>
              Only student accounts still using the current default password will be updated.
              Students who already changed their own password will not be affected.
            </p>

            <form onSubmit={handleStudentDefaultPasswordChange} style={{ display: "grid", gap: 14 }}>
              <input
                type="password"
                placeholder="Current default student password"
                value={currentStudentDefaultPassword}
                onChange={(e) => setCurrentStudentDefaultPassword(e.target.value)}
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="New default student password"
                value={studentDefaultPassword}
                onChange={(e) => setStudentDefaultPassword(e.target.value)}
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Confirm new default student password"
                value={studentConfirmPassword}
                onChange={(e) => setStudentConfirmPassword(e.target.value)}
                style={inputStyle}
              />

              {studentError && <div style={errorStyle}>{studentError}</div>}
              {studentMessage && <div style={successStyle}>{studentMessage}</div>}

              <button type="submit" style={buttonStyle} disabled={loadingStudent}>
                {loadingStudent ? "Updating..." : "Update Student Default Password"}
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