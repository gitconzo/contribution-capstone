import React, { useEffect, useState } from "react";

export default function StudentSettings() {
  const [activeSection, setActiveSection] = useState("security");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [profileImage, setProfileImage] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    const savedPhoto = localStorage.getItem("student_profile_photo");
    if (savedPhoto) {
      setProfileImage(savedPhoto);
    }
  }, []);

  async function handleChangePassword(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all password fields.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    try {
      setLoading(true);

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
        setError(data.message || "Failed to update password.");
        return;
      }

      setMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      const savedUser = localStorage.getItem("user");
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        parsedUser.usingDefaultPassword = false;
        localStorage.setItem("user", JSON.stringify(parsedUser));
      }
    } catch (err) {
      console.error(err);
      setError("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  }

  function handlePhotoChange(e) {
    setPhotoMessage("");
    setPhotoError("");

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPhotoError("Please select a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setProfileImage(result);
        localStorage.setItem("student_profile_photo", result);
        setPhotoMessage("Profile photo updated successfully.");
      }
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setProfileImage("");
    localStorage.removeItem("student_profile_photo");
    setPhotoMessage("Profile photo removed.");
    setPhotoError("");
  }

  return (
    <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
        }}
      >
        <h1 style={{ marginTop: 0, fontSize: 28 }}>Settings</h1>
        <p style={{ color: "#6b7280", marginBottom: 24 }}>
          Manage your student account settings.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "260px 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 16,
              background: "#fafafa",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 14, fontSize: 18 }}>Options</h3>

            <button
              onClick={() => {
                setActiveSection("photo");
                setPhotoMessage("");
                setPhotoError("");
              }}
              style={menuButton(activeSection === "photo")}
            >
              Profile Photo
            </button>

            <button
              onClick={() => {
                setActiveSection("documents");
                setPhotoMessage("");
                setPhotoError("");
              }}
              style={menuButton(activeSection === "documents")}
            >
              Document Upload (Beta)
            </button>

            <button
              onClick={() => {
                setActiveSection("security");
                setMessage("");
                setError("");
              }}
              style={menuButton(activeSection === "security")}
            >
              Security
            </button>
          </div>

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 20,
              background: "#fafafa",
              minHeight: 360,
            }}
          >
            {activeSection === "photo" && (
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>Profile Photo</h3>
                <p style={{ color: "#6b7280", marginBottom: 18 }}>
                  Upload or change your profile photo.
                </p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 20,
                    flexWrap: "wrap",
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      width: 110,
                      height: 110,
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: "2px solid #d1d5db",
                      background: "#e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {profileImage ? (
                      <img
                        src={profileImage}
                        alt="Profile Preview"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 36 }}>👤</span>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: 12 }}>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} />
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button type="button" style={actionButton}>
                        Upload Photo
                      </button>
                      <button
                        type="button"
                        onClick={removePhoto}
                        style={{
                          ...secondaryButton,
                        }}
                      >
                        Remove Photo
                      </button>
                    </div>
                  </div>
                </div>

                {photoError && (
                  <div
                    style={{
                      background: "#fee2e2",
                      color: "#b91c1c",
                      padding: "10px 12px",
                      borderRadius: 10,
                      fontSize: 14,
                      maxWidth: 520,
                    }}
                  >
                    {photoError}
                  </div>
                )}

                {photoMessage && (
                  <div
                    style={{
                      background: "#dcfce7",
                      color: "#166534",
                      padding: "10px 12px",
                      borderRadius: 10,
                      fontSize: 14,
                      maxWidth: 520,
                    }}
                  >
                    {photoMessage}
                  </div>
                )}
              </div>
            )}

            {activeSection === "documents" && (
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>Document Upload (Beta)</h3>
                <p style={{ color: "#6b7280", marginBottom: 18 }}>
                  Upload supporting documents or progress files. This feature is currently in beta.
                </p>

                <input
                  type="file"
                  style={{ marginBottom: 14 }}
                  accept=".pdf,.doc,.docx,.txt"
                />

                <div>
                  <button style={actionButton}>Upload Document</button>
                </div>
              </div>
            )}

            {activeSection === "security" && (
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 16 }}>Change Password</h3>

                <form onSubmit={handleChangePassword} style={{ display: "grid", gap: 14, maxWidth: 520 }}>
                  <div>
                    <label style={labelStyle}>Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      style={inputStyle}
                    />
                  </div>

                  {error && (
                    <div
                      style={{
                        background: "#fee2e2",
                        color: "#b91c1c",
                        padding: "10px 12px",
                        borderRadius: 10,
                        fontSize: 14,
                      }}
                    >
                      {error}
                    </div>
                  )}

                  {message && (
                    <div
                      style={{
                        background: "#dcfce7",
                        color: "#166534",
                        padding: "10px 12px",
                        borderRadius: 10,
                        fontSize: 14,
                      }}
                    >
                      {message}
                    </div>
                  )}

                  <button type="submit" disabled={loading} style={actionButton}>
                    {loading ? "Updating..." : "Update Password"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function menuButton(active) {
  return {
    width: "100%",
    textAlign: "left",
    padding: "12px 14px",
    marginBottom: 10,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: active ? "#111827" : "#fff",
    color: active ? "#fff" : "#111827",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };
}

const actionButton = {
  border: "none",
  background: "#111827",
  color: "#fff",
  borderRadius: 10,
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButton = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 10,
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const labelStyle = {
  display: "block",
  marginBottom: 6,
  fontSize: 14,
  fontWeight: 500,
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  fontSize: 14,
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
};