import { useEffect, useMemo, useState } from "react";
import { User, X } from "lucide-react";
import Cropper from "react-easy-crop";
import { changeCurrentUserPassword } from "../utils/cognitoAuth";
import { apiFetch } from "../utils/api";

const STUDENT_UPLOAD_TYPES = [
  { value: "worklog", label: "Worklog / Week Log" },
  { value: "peer_review", label: "Peer Review" },
  { value: "attendance", label: "Attendance Sheet (Leader only)" },
  { value: "sprint_report", label: "Sprint Report (Leader only)" },
  { value: "project_plan", label: "Project Plan (Leader only)" },
];

function normalizeText(value = "") {
  return String(value).trim().toLowerCase().replace(/\s+/g, "");
}


function formatDateTime(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function prettyType(value = "") {
  const map = {
    worklog: "Worklog",
    peer_review: "Peer Review",
    attendance: "Attendance Sheet",
    sprint_report: "Sprint Report",
    project_plan: "Project Plan",
  };
  return map[value] || value || "Unknown";
}

export default function StudentSettings({ darkMode, studentTeams = [], selectedTeamId: selectedTeamIdProp = "", onTeamChange, onRefreshTeams, studentUploads: uploadsProp = [], uploadsLoading: uploadsLoadingProp = false, onRefreshUploads }) {
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
        menuActiveBg: "#f8fafc",
        menuActiveText: "#0b1120",
        menuBg: "#0f172a",
        menuText: "#f8fafc",
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
        menuActiveBg: "#111827",
        menuActiveText: "#ffffff",
        menuBg: "#ffffff",
        menuText: "#111827",
      };

      const savedUser = useMemo(() => {
        const raw = localStorage.getItem("user");
        return raw ? JSON.parse(raw) : null;
      }, []);

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

const [cropModalOpen, setCropModalOpen] = useState(false);
const [imageToCrop, setImageToCrop] = useState(null);
const [crop, setCrop] = useState({ x: 0, y: 0 });
const [zoom, setZoom] = useState(1);
const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const selectedTeamId = selectedTeamIdProp;
  const [selectedDocType, setSelectedDocType] = useState("worklog");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const studentUploads = uploadsProp;
  const uploadsLoading = uploadsLoadingProp;

  const selectedTeam = studentTeams.find((team) => team.id === selectedTeamId) || null;
  const selectedTeamStudents = selectedTeam?.students || [];

  const currentMembership = selectedTeamStudents.find((student) => {
    const studentEmail = normalizeText(student.email || "");
    const studentName = normalizeText(student.name || "");
    const userEmail = normalizeText(savedUser?.email || "");
    const userName = normalizeText(savedUser?.name || "");

    if (userEmail && studentEmail) {
      return studentEmail === userEmail;
    }

    return !!userName && !!studentName && studentName === userName;
  }) || null;

  const currentRole = currentMembership?.role || "member";

  useEffect(() => {
    async function loadProfilePhoto() {
      const photoKey = currentMembership?.profile_photo_url;
  
      if (!photoKey) {
        setProfileImage("");
        return;
      }
  
      try {
        const res = await apiFetch(
          `/api/uploads/file?key=${encodeURIComponent(photoKey)}`
        );
        const data = await res.json();
  
        if (res.ok && data.url) {
          setProfileImage(data.url);
        } else {
          setProfileImage("");
        }
      } catch (error) {
        console.error("Failed to load profile photo:", error);
        setProfileImage("");
      }
    }
  
    loadProfilePhoto();
  }, [currentMembership]);

  const visibleUploadTypes =
  currentRole === "leader"
    ? STUDENT_UPLOAD_TYPES
    : STUDENT_UPLOAD_TYPES.filter(
        (type) => !["attendance", "sprint_report", "project_plan"].includes(type.value)
      );

  async function handleStudentUpload() {
    setUploadMessage("");
    setUploadError("");

    if (!selectedTeamId) {
      setUploadError("Please select a group first.");
      return;
    }

    if (!selectedFile) {
      setUploadError("Please choose a file first.");
      return;
    }

    try {
      setUploading(true);

      const studentFolder = `${selectedTeamId}/${savedUser?.email || "unknown"}`;
      const presignRes = await apiFetch(
        `/api/uploads/presign?filename=${encodeURIComponent(selectedFile.name)}&teamId=${encodeURIComponent(selectedTeamId)}&contentType=${encodeURIComponent(selectedFile.type || "application/octet-stream")}&folder=${encodeURIComponent(studentFolder)}`
      );

      const presignData = await presignRes.json();

      if (!presignRes.ok) {
        setUploadError(presignData.error || "Failed to get upload URL.");
        return;
      }

      const { url, s3Key, storedName } = presignData;

      const s3Res = await fetch(url, {
        method: "PUT",
        body: selectedFile,
        headers: {
          "Content-Type": selectedFile.type || "application/octet-stream",
        },
      });

      if (!s3Res.ok) {
        setUploadError("File upload to storage failed.");
        return;
      }

      const saveRes = await apiFetch(`/api/uploads/student`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          s3Key,
          storedName,
          originalName: selectedFile.name,
          size: selectedFile.size,
          mimetype: selectedFile.type,
          teamId: selectedTeamId,
          userType: selectedDocType,
          uploadedByName: savedUser?.name || null,
          uploadedByEmail: savedUser?.email || null,
        }),
      });

      const saveData = await saveRes.json();

      if (!saveRes.ok) {
        setUploadError(saveData.error || "Failed to save upload.");
        return;
      }

      setUploadMessage("Document uploaded successfully.");
      setSelectedFile(null);
      await onRefreshUploads?.();
      setSelectedDocType("worklog");
    } catch (error) {
      console.error("Student upload failed:", error);
      setUploadError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }


  async function handleChangePassword(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    try {
      setLoading(true);

      await changeCurrentUserPassword(currentPassword, newPassword);

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
      const msg = err?.message || err?.code || "Failed to update password.";

      if (msg.includes("Incorrect username or password")) {
        setError("Current password is incorrect.");
      } else if (msg.includes("InvalidPasswordException")) {
        setError("New password does not meet the password policy.");
      } else if (msg.includes("LimitExceededException")) {
        setError("Too many attempts. Please try again later.");
      } else if (msg.includes("No logged-in user found")) {
        setError("No logged-in user found. Please log in again.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function removePhoto() {
    setPhotoMessage("");
    setPhotoError("");
  
    if (!selectedTeamId || !savedUser?.email) {
      setPhotoError("Missing student or team information.");
      return;
    }
  
    try {
      const res = await apiFetch(`/api/teams/profile-photo/remove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: savedUser.email,
          teamId: selectedTeamId,
        }),
      });
  
      const data = await res.json().catch(() => ({}));
  
      if (!res.ok) {
        setPhotoError(data.error || "Failed to remove profile photo.");
        return;
      }
  
      setProfileImage("");
      setPhotoMessage("Profile photo removed.");
  
      await onRefreshTeams?.();
    } catch (error) {
      console.error("Failed to remove profile photo:", error);
      setPhotoError("Failed to remove profile photo.");
    }
  }

  function createImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.setAttribute("crossOrigin", "anonymous");
      image.src = url;
    });
  }

  async function getCroppedImg(imageSrc, pixelCrop) {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], `cropped-profile-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        resolve(file);
      }, "image/jpeg");
    });
  }

  const onCropComplete = (_, croppedAreaPixelsValue) => {
    setCroppedAreaPixels(croppedAreaPixelsValue);
  };

  async function handleCropSave() {
    try {
      if (!imageToCrop || !croppedAreaPixels) return;
  
      const cropped = await getCroppedImg(imageToCrop, croppedAreaPixels);
      setCropModalOpen(false);
      setPhotoMessage("");
      setPhotoError("");
  
      await uploadCroppedPhoto(cropped);
    } catch (error) {
      console.error("Crop failed:", error);
      setPhotoError("Failed to crop image.");
    }
  }

  async function uploadCroppedPhoto(file) {
    setPhotoMessage("");
    setPhotoError("");
  
    if (!file) {
      setPhotoError("No cropped image found.");
      return;
    }
  
    if (!selectedTeamId) {
      setPhotoError("Please select a group first.");
      return;
    }
  
    try {
      const safeEmail = savedUser?.email || "student";
      const photoFileName = `profile-${Date.now()}.jpg`;
      const folder = `profile-photos/${safeEmail}`;
  
      const presignRes = await apiFetch(
        `/api/uploads/presign?filename=${encodeURIComponent(photoFileName)}&teamId=${encodeURIComponent(selectedTeamId)}&contentType=${encodeURIComponent(file.type || "image/jpeg")}&folder=${encodeURIComponent(folder)}`
      );
  
      const presignData = await presignRes.json().catch(() => ({}));
      console.log("presign status:", presignRes.status);
      console.log("presign data:", presignData);
  
      if (!presignRes.ok) {
        setPhotoError(presignData.error || "Failed to get upload URL.");
        return;
      }
  
      const { url, s3Key } = presignData;
  
      const uploadRes = await fetch(url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "image/jpeg",
        },
      });
  
      console.log("S3 upload status:", uploadRes.status);
  
      if (!uploadRes.ok) {
        const uploadText = await uploadRes.text().catch(() => "");
        console.log("S3 upload response:", uploadText);
        setPhotoError("Failed to upload cropped profile photo.");
        return;
      }
  
      const saveRes = await apiFetch(`/api/teams/profile-photo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: savedUser?.email,
          teamId: selectedTeamId,
          photoUrl: s3Key,
        }),
      });
  
      const saveData = await saveRes.json().catch(() => ({}));
      console.log("save status:", saveRes.status);
      console.log("save data:", saveData);
  
      if (!saveRes.ok) {
        setPhotoError(saveData.error || "Failed to save profile photo.");
        return;
      }
  
      setProfileImage(URL.createObjectURL(file));
      setPhotoMessage("Profile photo updated successfully.");
      await onRefreshTeams?.();
    } catch (error) {
      console.error("Profile photo upload failed:", error);
      setPhotoError(error.message || "Failed to upload profile photo.");
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
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
        }}
      >
        <h1 style={{ marginTop: 0, fontSize: 28, color: theme.text }}>Settings</h1>
        <p style={{ color: theme.subtext, marginBottom: 24 }}>
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
              border: `1px solid ${theme.border}`,
              borderRadius: 16,
              padding: 16,
              background: theme.cardSoft,
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: 14,
                fontSize: 18,
                color: theme.text,
              }}
            >
              Options
            </h3>

            <button
              onClick={() => {
                setActiveSection("photo");
                setPhotoMessage("");
                setPhotoError("");
              }}
              style={menuButton(activeSection === "photo", theme)}
            >
              Profile Photo
            </button>

            <button
              onClick={() => {
                setActiveSection("documents");
                setPhotoMessage("");
                setPhotoError("");
              }}
              style={menuButton(activeSection === "documents", theme)}
            >
              Document Upload
            </button>

            <button
              onClick={() => {
                setActiveSection("security");
                setMessage("");
                setError("");
              }}
              style={menuButton(activeSection === "security", theme)}
            >
              Security
            </button>
          </div>

          <div
            style={{
              border: `1px solid ${theme.border}`,
              borderRadius: 16,
              padding: 20,
              background: theme.cardSoft,
              minHeight: 360,
            }}
          >
            {activeSection === "photo" && (
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 12, color: theme.text }}>
                  Profile Photo
                </h3>
                <p style={{ color: theme.subtext, marginBottom: 18 }}>
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
                      <User size={44} color="#9ca3af" />
                    )}
                  </div>

                  <div style={{ display: "grid", gap: 12 }}>
                  <input
  type="file"
  accept="image/*"
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPhotoError("Please select a valid image file.");
      return;
    }

    setPhotoMessage("");
    setPhotoError("");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setImageToCrop(URL.createObjectURL(file));
    setCropModalOpen(true);
  }}
/>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>

                      <button
                        type="button"
                        onClick={removePhoto}
                        style={{
                          border: `1px solid ${theme.border}`,
                          background: theme.cardSoft,
                          color: theme.text,
                          borderRadius: 10,
                          padding: "12px 16px",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: "pointer",
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
    <h3 style={{ marginTop: 0, marginBottom: 12, color: theme.text }}>
      Document Upload
    </h3>
    <p style={{ color: theme.subtext, marginBottom: 18 }}>
      Upload documents for your selected group.
    </p>

    <div style={{ display: "grid", gap: 14, maxWidth: 560 }}>
      <div>
        <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500, color: theme.text }}>
          Selected Group
        </label>
        <select
          value={selectedTeamId}
          onChange={(e) => onTeamChange?.(e.target.value)}
          style={inputField(theme)}
        >
          {studentTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name} {team.code ? `(${team.code})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div style={{ fontSize: 14, color: theme.subtext }}>
        Your role in this group:{" "}
        <strong style={{ color: theme.text }}>
          {currentRole === "leader" ? "Leader" : "Member"}
        </strong>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500, color: theme.text }}>
          Document Type
        </label>
        <select
          value={selectedDocType}
          onChange={(e) => setSelectedDocType(e.target.value)}
          style={inputField(theme)}
        >
          {visibleUploadTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500, color: theme.text }}>
          Choose File
        </label>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt,.xlsx,.xls"
          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
        />
      </div>

      {selectedFile && (
        <div style={{ color: theme.subtext, fontSize: 14 }}>
          Selected file: <strong style={{ color: theme.text }}>{selectedFile.name}</strong>
        </div>
      )}

      {uploadError && (
        <div
          style={{
            background: "#fee2e2",
            color: "#b91c1c",
            padding: "10px 12px",
            borderRadius: 10,
            fontSize: 14,
          }}
        >
          {uploadError}
        </div>
      )}

      {uploadMessage && (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: "10px 12px",
            borderRadius: 10,
            fontSize: 14,
          }}
        >
          {uploadMessage}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={handleStudentUpload}
          disabled={uploading}
          style={{
            border: "none",
            background: theme.btnBg,
            color: theme.btnText,
            borderRadius: 10,
            padding: "12px 16px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {uploading ? "Uploading..." : "Upload Document"}
        </button>
      </div>
    </div>

    <div
      style={{
        marginTop: 28,
        borderTop: `1px solid ${theme.border}`,
        paddingTop: 20,
      }}
    >
      <h4 style={{ marginTop: 0, marginBottom: 12, color: theme.text }}>
        My Uploaded Files
      </h4>

      {uploadsLoading ? (
        <div style={{ color: theme.subtext, fontSize: 14 }}>
          Loading uploaded files...
        </div>
      ) : studentUploads.length === 0 ? (
        <div style={{ color: theme.subtext, fontSize: 14 }}>
          No uploaded files found for this group yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {studentUploads.map((file) => (
            <div
              key={file.id}
              style={{
                border: `1px solid ${theme.border}`,
                borderRadius: 12,
                padding: 14,
                background: theme.card,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 8,
                }}
              >
                <div style={{ fontWeight: 600, color: theme.text }}>
                  {file.original_name || file.originalName || "Unnamed file"}
                </div>

              </div>

              <div style={{ fontSize: 14, color: theme.subtext, display: "grid", gap: 4 }}>
                <div>
                  Type: <strong style={{ color: theme.text }}>
                    {prettyType(file.user_type || file.detected_type)}
                  </strong>
                </div>
                <div>
                  Scope: <strong style={{ color: theme.text }}>
                    {file.upload_scope || "individual"}
                  </strong>
                </div>
                <div>
                  Uploaded: <strong style={{ color: theme.text }}>
                    {formatDateTime(file.upload_date || file.uploadDate)}
                  </strong>
                </div>
                <div>
                  Status: <strong style={{ color: theme.text }}>
                    {file.status || "pending"}
                  </strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
)}
            {activeSection === "security" && (
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 16, color: theme.text }}>
                  Change Password
                </h3>

                <form
                  onSubmit={handleChangePassword}
                  style={{ display: "grid", gap: 14, maxWidth: 520 }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontSize: 14,
                        fontWeight: 500,
                        color: theme.text,
                      }}
                    >
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      style={inputField(theme)}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontSize: 14,
                        fontWeight: 500,
                        color: theme.text,
                      }}
                    >
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      style={inputField(theme)}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontSize: 14,
                        fontWeight: 500,
                        color: theme.text,
                      }}
                    >
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      style={inputField(theme)}
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

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      border: "none",
                      background: theme.btnBg,
                      color: theme.btnText,
                      borderRadius: 10,
                      padding: "12px 16px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {loading ? "Updating..." : "Update Password"}
                  </button>
                </form>
              </div>
            )}
                    </div>
        </div>
      </div>

      {cropModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0, color: theme.text }}>Crop Profile Photo</h3>
              <button
                type="button"
                onClick={() => setCropModalOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: theme.text,
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                position: "relative",
                width: "100%",
                height: 320,
                background: "#111",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ color: theme.text, fontSize: 14, fontWeight: 500 }}>
                Zoom
              </label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{ width: "100%", marginTop: 8 }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 18,
              }}
            >
              <button
                type="button"
                onClick={() => setCropModalOpen(false)}
                style={{
                  border: `1px solid ${theme.border}`,
                  background: theme.cardSoft,
                  color: theme.text,
                  borderRadius: 10,
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCropSave}
                style={{
                  border: "none",
                  background: theme.btnBg,
                  color: theme.btnText,
                  borderRadius: 10,
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Save Crop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
      
function menuButton(active, theme) {
  return {
    width: "100%",
    textAlign: "left",
    padding: "12px 14px",
    marginBottom: 10,
    borderRadius: 10,
    border: `1px solid ${theme.border}`,
    background: active ? theme.menuActiveBg : theme.menuBg,
    color: active ? theme.menuActiveText : theme.menuText,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };
}

function inputField(theme) {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: `1px solid ${theme.inputBorder}`,
    fontSize: 14,
    background: theme.inputBg,
    color: theme.inputText,
    outline: "none",
    boxSizing: "border-box",
  };
}
