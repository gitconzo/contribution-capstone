// frontend/src/pages/UploadFile.js
import React, { useEffect, useMemo, useState } from "react";

const TYPE_OPTIONS = [
  { value: "attendance", label: "Attendance Sheet (.xlsx)" },
  { value: "worklog", label: "Worklog Document (.docx/.pdf)" },
  { value: "peer_review", label: "Peer Review Form (.docx/.pdf)" },
  { value: "sprint_report", label: "Sprint Report (.docx)" },
  { value: "project_plan", label: "Project Plan (.docx)" },
  { value: "unknown", label: "Unknown Type" },
];

export default function UploadFile({ darkMode }) {
  const [file, setFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [files, setFiles] = useState([]);
  const [overrideType, setOverrideType] = useState("unknown");
  const [confirming, setConfirming] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);

  const API = "http://localhost:5002";

  const theme = darkMode
    ? {
        pageBg: "#0b1120",
        card: "#111827",
        cardAlt: "#0f172a",
        text: "#f8fafc",
        subtext: "#94a3b8",
        border: "#1f2937",
        softBorder: "#334155",
        inputBg: "#0f172a",
        shadow: "0 8px 20px rgba(0,0,0,.28)",
        buttonBg: "#111827",
        tableRow: "#0f172a",
      }
    : {
        pageBg: "#f8fafc",
        card: "#ffffff",
        cardAlt: "#f9fafb",
        text: "#111827",
        subtext: "#6b7280",
        border: "#e5e7eb",
        softBorder: "#d1d5db",
        inputBg: "#ffffff",
        shadow: "0 2px 10px rgba(0,0,0,0.1)",
        buttonBg: "#ffffff",
        tableRow: "#f9f9f9",
      };

  const detectedType = uploadResult?.detectedType || "unknown";

  const effectiveType = useMemo(() => {
    return overrideType !== "unknown" ? overrideType : detectedType;
  }, [overrideType, detectedType]);

  const displayedFiles = showAllFiles
    ? files
    : files.slice(0, 3);

  const fetchFiles = () => {
    fetch(`${API}/api/uploads`)
      .then((res) => res.json())
      .then(setFiles)
      .catch(console.error);
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileSelect = (e) => {
    setFile(e.target.files?.[0] || null);
    setUploadResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("userType", overrideType);

    const res = await fetch(`${API}/api/uploads`, {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    setUploadResult(json);
  };

  const handleConfirm = async () => {
    if (!uploadResult?.id) return;

    setConfirming(true);

    const res = await fetch(`${API}/api/uploads/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: uploadResult.id,
        type: effectiveType,
      }),
    });

    const json = await res.json();

    setUploadResult(json);
    setConfirming(false);

    fetchFiles();
  };

  const styles = {
    pageContainer: {
      maxWidth: "900px",
      margin: "0 auto",
      padding: "20px",
      minHeight: "100vh",
      background: theme.pageBg,
      color: theme.text,
    },

    card: {
      background: theme.card,
      padding: "20px",
      borderRadius: "10px",
      boxShadow: theme.shadow,
      marginBottom: "20px",
      border: `1px solid ${theme.border}`,
    },

    label: {
      fontWeight: "bold",
      marginTop: "10px",
      color: theme.text,
      display: "block",
    },

    select: {
      width: "100%",
      padding: "10px",
      marginTop: "5px",
      borderRadius: "8px",
      border: `1px solid ${theme.border}`,
      background: theme.inputBg,
      color: theme.text,
      outline: "none",
    },

    uploadBox: {
      border: `2px dashed ${theme.softBorder}`,
      padding: "15px",
      textAlign: "center",
      marginTop: "10px",
      borderRadius: "10px",
      background: theme.cardAlt,
      color: theme.subtext,
    },

    filePreview: {
      marginTop: "10px",
      padding: "10px",
      background: theme.cardAlt,
      borderRadius: "8px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      color: theme.text,
      border: `1px solid ${theme.border}`,
    },

    removeBtn: {
      border: "none",
      background: "#dc2626",
      color: "#fff",
      cursor: "pointer",
      borderRadius: "6px",
      padding: "6px 8px",
      fontWeight: 700,
    },

    uploadBtn: {
      width: "100%",
      padding: "12px",
      borderRadius: "8px",
      border: "none",
      background: "#000",
      color: "white",
      cursor: file ? "pointer" : "not-allowed",
      marginTop: "10px",
      fontWeight: 700,
      opacity: file ? 1 : 0.6,
    },

    confirmBox: {
      background: theme.cardAlt,
      color: theme.text,
      padding: "12px",
      marginTop: "10px",
      borderRadius: "8px",
      border: `1px solid ${theme.border}`,
      lineHeight: 1.5,
    },

    confirmBtn: {
      marginTop: "10px",
      width: "100%",
      padding: "10px",
      background: darkMode ? "#1f2937" : "#444",
      color: "white",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: 600,
    },

    tableCard: {
      background: theme.card,
      padding: "20px",
      borderRadius: "10px",
      boxShadow: theme.shadow,
      border: `1px solid ${theme.border}`,
    },

    table: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: "0 10px",
      marginTop: "10px",
      color: theme.text,
    },

    th: {
      textAlign: "left",
      color: theme.subtext,
      fontSize: "13px",
      padding: "0 12px 8px 12px",
    },

    tableRow: {
      background: theme.tableRow,
      boxShadow: darkMode ? "none" : "0 1px 3px rgba(0,0,0,0.1)",
    },

    tableCell: {
      padding: "12px 15px",
      textAlign: "left",
      color: theme.text,
      borderTop: `1px solid ${theme.border}`,
      borderBottom: `1px solid ${theme.border}`,
    },

    firstCell: {
      borderLeft: `1px solid ${theme.border}`,
      borderTopLeftRadius: "10px",
      borderBottomLeftRadius: "10px",
    },

    lastCell: {
      borderRight: `1px solid ${theme.border}`,
      borderTopRightRadius: "10px",
      borderBottomRightRadius: "10px",
    },

    downloadBtn: {
      background: "#000",
      color: "white",
      padding: "8px 14px",
      borderRadius: "6px",
      textDecoration: "none",
      cursor: "pointer",
      fontWeight: "bold",
      display: "inline-block",
    },
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.card}>
        <h1 style={{ marginTop: 0, color: theme.text }}>
          Upload Documents
        </h1>

        <label style={styles.label}>Select Document Type</label>

        <select
          value={overrideType}
          onChange={(e) => setOverrideType(e.target.value)}
          style={styles.select}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <label style={styles.label}>Browse Files</label>

        <div style={styles.uploadBox}>
          <input type="file" onChange={handleFileSelect} />

          <div style={{ marginTop: "8px" }}>
            <small>Supported formats: .docx .pdf .xlsx</small>
          </div>
        </div>

        {file && (
          <div style={styles.filePreview}>
            <span>{file.name}</span>

            <button
              onClick={() => setFile(null)}
              style={styles.removeBtn}
            >
              Remove
            </button>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file}
          style={styles.uploadBtn}
        >
          Upload
        </button>

        {uploadResult && (
          <div style={styles.confirmBox}>
            Uploaded: {uploadResult.originalName}
            <br />
            Detected Type: <b>{uploadResult.detectedType}</b>

            <button
              onClick={handleConfirm}
              disabled={confirming}
              style={styles.confirmBtn}
            >
              {confirming ? "Processing..." : "Confirm & Parse"}
            </button>
          </div>
        )}
      </div>

      <div style={styles.tableCard}>
        <h2 style={{ marginTop: 0, color: theme.text }}>
          Uploaded Files
        </h2>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>File Name</th>
              <th style={styles.th}>File Type</th>
              <th style={styles.th}>Upload Date</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Download</th>
            </tr>
          </thead>

          <tbody>
            {files.length ? (
              displayedFiles.map((file) => (
                <tr key={file.id} style={styles.tableRow}>
                  <td
                    style={{
                      ...styles.tableCell,
                      ...styles.firstCell,
                    }}
                  >
                    {file.originalName}
                  </td>

                  <td style={styles.tableCell}>
                    {file.userType || file.detectedType}
                  </td>

                  <td style={styles.tableCell}>
                    {new Date(file.uploadDate).toLocaleString()}
                  </td>

                  <td style={styles.tableCell}>
                    {file.status}
                  </td>

                  <td
                    style={{
                      ...styles.tableCell,
                      ...styles.lastCell,
                    }}
                  >
                    <a
                      href={`http://localhost:5002/${file.storedPath}`}
                      download
                      style={styles.downloadBtn}
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="5"
                  style={{
                    textAlign: "center",
                    padding: "12px",
                    color: theme.subtext,
                  }}
                >
                  No files uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {files.length > 3 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "14px",
            }}
          >
            <button
              onClick={() => setShowAllFiles(!showAllFiles)}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontWeight: 600,
                color: theme.subtext,
                fontSize: "14px",
              }}
            >
              {showAllFiles ? "Show Less" : "See More"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
