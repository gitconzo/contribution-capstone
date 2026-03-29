// frontend/src/pages/UploadFile.js
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/api";

const TYPE_OPTIONS = [
  { value: "attendance", label: "Attendance Sheet (.xlsx)" },
  { value: "worklog", label: "Worklog Document (.docx/.pdf)" },
  { value: "peer_review", label: "Peer Review Form (.docx/.pdf)" },
  { value: "sprint_report", label: "Sprint Report (.docx)" },
  { value: "project_plan", label: "Project Plan (.docx)" },
  { value: "unknown", label: "Unknown Type" }
];

export default function UploadFile({ darkMode }) {
  const [file, setFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [files, setFiles] = useState([]);
  const [overrideType, setOverrideType] = useState("unknown");
  const [confirming, setConfirming] = useState(false);

  // repo analysis UI state
  const [repoUrl, setRepoUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState("");

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

  const fetchFiles = () => {
    apiFetch("/api/uploads")
      .then(res => res.json())
      .then(setFiles)
      .catch(console.error);
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setUploadResult(null);
    if (selected) {
      const lower = selected.name.toLowerCase();
      if (lower.includes("attendance")) setOverrideType("attendance");
      else if (lower.includes("worklog")) setOverrideType("worklog");
      else if (lower.match(/sprint[-_\s]?report/) || lower.includes("sprintreport")) setOverrideType("sprint_report");
      else if (lower.includes("peer")) setOverrideType("peer_review");
      else if (lower.includes("project") && lower.includes("plan")) setOverrideType("project_plan");
      else setOverrideType("unknown");
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    // Get presigned URL + S3 key from the backend
    const presignRes = await apiFetch(
      `/api/uploads/presign?filename=${encodeURIComponent(file.name)}&teamId=${encodeURIComponent(localStorage.getItem("activeTeamId") || "unknown")}&contentType=${encodeURIComponent(file.type || "application/octet-stream")}`
    );
    const { url, s3Key, storedName } = await presignRes.json();

    // Upload directly to S3 using the presigned URL
    await fetch(url, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });

    // Register the upload in the backend
    const res = await apiFetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        s3Key,
        storedName,
        originalName: file.name,
        size: file.size,
        mimetype: file.type,
        teamId: localStorage.getItem("activeTeamId") || "unknown",
        userType: overrideType,
      }),
    });
    const json = await res.json();
    setUploadResult(json);
  };

  const handleConfirm = async () => {
    if (!uploadResult?.id) return;
    setConfirming(true);

    const res = await apiFetch("/api/uploads/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: uploadResult.id, type: effectiveType })
    });

    const json = await res.json();
    setUploadResult(json);
    setConfirming(false);
    fetchFiles();
  };

  // Analyze (fetch commits + run main.py)
  const handleAnalyzeRepo = async () => {
    setAnalyzeMsg("");
    if (!repoUrl.trim()) {
      setAnalyzeMsg("Please paste a GitHub repository URL first.");
      return;
    }
    setAnalyzing(true);
    try {
      await apiFetch("/api/github/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: repoUrl.trim() })
      });
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const st = await apiFetch("/api/github/status").then(r => r.json());
        if (st.finalStatsExists) {
          clearInterval(poll);
          setAnalyzing(false);
          setAnalyzeMsg("Analysis complete! Refresh the dashboard to see results.");
        } else if (attempts > 60) {
          clearInterval(poll);
          setAnalyzing(false);
          setAnalyzeMsg("Analysis is taking longer than expected. Check server logs.");
        } else {
          setAnalyzeMsg(`Analysis running... (${attempts * 5}s elapsed)`);
        }
      }, 5000);
    } catch (e) {
      try {
        const st = await apiFetch("/api/github/status").then(r => r.json());
        if (st.finalStatsExists) {
          setAnalyzeMsg("Analysis finished, but the browser couldn't read the response (likely CORS/mixed-content). Data is ready.");
        } else if (st.commitsExists) {
          setAnalyzeMsg("Commits fetched, but analysis response failed. Try again or refresh dashboard.");
        } else {
          setAnalyzeMsg(`${e.message || "Network error"}`);
        }
      } catch {
        setAnalyzeMsg(`${e.message || "Network error"}`);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const cardStyle = {
    background: theme.card,
    padding: "20px",
    borderRadius: "10px",
    boxShadow: theme.shadow,
    marginBottom: "20px",
    border: `1px solid ${theme.border}`,
  };

  const labelStyle = {
    fontWeight: "bold",
    marginTop: "10px",
    color: theme.text,
    display: "block",
  };

  const selectStyle = {
    width: "100%",
    padding: "10px",
    marginTop: "5px",
    borderRadius: "8px",
    border: `1px solid ${theme.border}`,
    background: theme.inputBg,
    color: theme.text,
    outline: "none",
  };

  const uploadBoxStyle = {
    border: `2px dashed ${theme.softBorder}`,
    padding: "15px",
    textAlign: "center",
    marginTop: "10px",
    borderRadius: "10px",
    background: theme.cardAlt,
    color: theme.subtext,
  };

  const filePreviewStyle = {
    marginTop: "10px",
    padding: "10px",
    background: theme.cardAlt,
    borderRadius: "8px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: theme.text,
    border: `1px solid ${theme.border}`,
  };

  const uploadBtnStyle = {
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
  };

  const confirmBoxStyle = {
    background: theme.cardAlt,
    color: theme.text,
    padding: "12px",
    marginTop: "10px",
    borderRadius: "8px",
    border: `1px solid ${theme.border}`,
    lineHeight: 1.5,
  };

  const confirmBtnStyle = {
    marginTop: "10px",
    width: "100%",
    padding: "10px",
    background: darkMode ? "#1f2937" : "#444",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 600,
  };

  const tableStyle = {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: "0 10px",
    marginTop: "10px",
    color: theme.text,
  };

  const thStyle = {
    textAlign: "left",
    color: theme.subtext,
    fontSize: "13px",
    padding: "0 12px 8px 12px",
  };

  const tableRowStyle = {
    background: theme.tableRow,
    boxShadow: darkMode ? "none" : "0 1px 3px rgba(0,0,0,0.1)",
  };

  const tableCellStyle = {
    padding: "12px 15px",
    textAlign: "left",
    color: theme.text,
    borderTop: `1px solid ${theme.border}`,
    borderBottom: `1px solid ${theme.border}`,
  };

  const downloadBtnStyle = {
    background: "#000",
    color: "white",
    padding: "8px 14px",
    borderRadius: "6px",
    textDecoration: "none",
    cursor: "pointer",
    fontWeight: "bold",
    display: "inline-block",
    border: "none",
  };

  const analyzeBtnStyle = {
    width: "100%",
    padding: "10px",
    borderRadius: "8px",
    border: "none",
    background: "#111827",
    color: "white",
    cursor: "pointer",
    marginTop: "10px",
    fontWeight: 600,
    opacity: analyzing || !repoUrl.trim() ? 0.6 : 1,
  };

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "20px",
        minHeight: "100vh",
        background: theme.pageBg,
        color: theme.text,
      }}
    >
      {/* Analyze GitHub Repo card */}
      <div style={cardStyle}>
        <h1 style={{ marginTop: 0, color: theme.text }}>Analyze GitHub Repository</h1>
        <label style={labelStyle}>Paste GitHub URL</label>
        <input
          type="text"
          placeholder="https://github.com/owner/repo"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            marginTop: 6,
            borderRadius: 8,
            border: `1px solid ${theme.border}`,
            background: theme.inputBg,
            color: theme.text,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <button
          onClick={handleAnalyzeRepo}
          disabled={analyzing || !repoUrl.trim()}
          style={analyzeBtnStyle}
        >
          {analyzing ? "Analyzing..." : "Analyze Repo"}
        </button>
        {analyzeMsg && (
          <div style={{ marginTop: 8, color: analyzeMsg.startsWith("Analysis complete") ? "#065f46" : theme.subtext }}>
            {analyzeMsg}
          </div>
        )}
        <div style={{ marginTop: 8, color: theme.subtext, fontSize: 12 }}>
          This will fetch commits and run code analysis (Lizard + blame) via <code>main.py</code>.
        </div>
      </div>

      {/* Upload Documents card */}
      <div style={cardStyle}>
        <h1 style={{ marginTop: 0, color: theme.text }}>Upload Documents</h1>

        <label style={labelStyle}>Select Document Type</label>
        <select value={overrideType} onChange={e => setOverrideType(e.target.value)} style={selectStyle}>
          {TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <label style={labelStyle}>Browse Files</label>
        <div style={uploadBoxStyle}>
          <input type="file" onChange={handleFileSelect} />
          <div style={{ marginTop: "8px" }}>
            <small>Supported formats: .docx .pdf .xlsx</small>
          </div>
        </div>

        {file && (
          <div style={filePreviewStyle}>
            <span>{file.name}</span>
            <button
              onClick={() => setFile(null)}
              style={{
                border: "none",
                background: "#dc2626",
                color: "#fff",
                cursor: "pointer",
                borderRadius: "6px",
                padding: "6px 8px",
                fontWeight: 700,
              }}
            >
              Remove
            </button>
          </div>
        )}

        <button onClick={handleUpload} disabled={!file} style={uploadBtnStyle}>
          Upload
        </button>

        {uploadResult && (
          <div style={confirmBoxStyle}>
            Uploaded: {uploadResult.originalName}
            <br />
            Detected Type: <b>{uploadResult.detectedType}</b>
            <button onClick={handleConfirm} disabled={confirming} style={confirmBtnStyle}>
              {confirming ? "Processing..." : "Confirm & Parse"}
            </button>
          </div>
        )}
      </div>

      {/* Uploaded Files table */}
      <div
        style={{
          background: theme.card,
          padding: "20px",
          borderRadius: "10px",
          boxShadow: theme.shadow,
          border: `1px solid ${theme.border}`,
        }}
      >
        <h2 style={{ marginTop: 0, color: theme.text }}>Uploaded Files</h2>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>File Name</th>
              <th style={thStyle}>File Type</th>
              <th style={thStyle}>Upload Date</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Download</th>
            </tr>
          </thead>
          <tbody>
            {files.length ? (
              files.map(f => (
                <tr key={f.id} style={tableRowStyle}>
                  <td style={{ ...tableCellStyle, borderLeft: `1px solid ${theme.border}`, borderTopLeftRadius: "10px", borderBottomLeftRadius: "10px" }}>
                    {f.originalName}
                  </td>
                  <td style={tableCellStyle}>{f.userType || f.detectedType}</td>
                  <td style={tableCellStyle}>{new Date(f.uploadDate).toLocaleString()}</td>
                  <td style={tableCellStyle}>{f.status}</td>
                  <td style={{ ...tableCellStyle, borderRight: `1px solid ${theme.border}`, borderTopRightRadius: "10px", borderBottomRightRadius: "10px" }}>
                    <button
                      style={downloadBtnStyle}
                      onClick={async () => {
                        const res = await apiFetch(`/api/uploads/${f.id}/download`);
                        const { url } = await res.json();
                        window.open(url, "_blank");
                      }}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: "center", padding: "12px", color: theme.subtext }}>
                  No files uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
