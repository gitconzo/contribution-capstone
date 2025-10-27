// frontend/src/pages/UploadFile.js
import React, { useEffect, useMemo, useState } from "react";


const TYPE_OPTIONS = [
  { value: "attendance", label: "Attendance Sheet (.xlsx)" },
  { value: "worklog", label: "Worklog Document (.docx/.pdf)" },
  { value: "peer_review", label: "Peer Review Form (.docx/.pdf)" },
  { value: "sprint_report", label: "Sprint Report (.docx)" },
  { value: "unknown", label: "Unknown Type" }
];

export default function UploadFile() {
  const [file, setFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [files, setFiles] = useState([]);
  const [overrideType, setOverrideType] = useState("unknown");
  const [confirming, setConfirming] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [msg, setMsg] = useState("");

  const API = "http://localhost:5002";

  const detectedType = uploadResult?.detectedType || "unknown";
  const effectiveType = useMemo(() => {
    return overrideType !== "unknown" ? overrideType : detectedType;
  }, [overrideType, detectedType]);

  const fetchFiles = () => {
    fetch(`${API}/api/uploads`)
      .then(res => res.json())
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
    setMsg("");
    let owner = "";
    let repo = "";

    if (repoUrl) {
    const parts = repoUrl.split("/").filter(Boolean);
    owner = parts[parts.length - 2] || "";
    repo = parts[parts.length - 1]?.replace(".git", "") || "";
  }
    
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userType", overrideType);
    formData.append("repoUrl", repoUrl);
    formData.append("owner", owner);
    formData.append("repo", repo);

  try {
    const res = await fetch(`${API}/api/uploads`, {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error || "Upload failed");
      return;
    }

    setUploadResult(json);

    const parts = [];
    if (json.originalName) parts.push(`Uploaded ${json.originalName}`);
    if (json.repo?.url) parts.push(`Repo: ${json.repo.url}`);
    if (json.mainPy?.status) parts.push(`main.py: ${json.mainPy.status}`);
    setMsg(parts.join(" • "));

    fetchFiles();
  } catch (e) {
    setMsg(`Upload error: ${e.message}`);
  }
  };

  
    
  const handleConfirm = async () => {
    if (!uploadResult?.id) return;
    setConfirming(true);

    const res = await fetch(`${API}/api/uploads/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: uploadResult.id, type: effectiveType })
    });

    const json = await res.json();
    setUploadResult(json);
    setConfirming(false);
    fetchFiles();
  };

  return (
    <div style={styles.pageContainer}>
      {/* Upload Card */}
      
      <div style={styles.card}>
        <h1>Upload github repository</h1>
        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        <label htmlFor="repoUrl">GitHub repository link</label>
        <input
          id="repoUrl"
          type="text"
          placeholder="e.g. https://github.com/[user]/[repo_url]"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          style={{ padding: 8 }}
        />
      </div>

  {msg && <div style={{ marginTop: 12 }}>{msg}</div>}


      </div>
      
      
      <div style={styles.card}>
        <h1>Upload Documents</h1>

        <label style={styles.label}>Select Document Type</label>
        <select value={overrideType} onChange={e => setOverrideType(e.target.value)} style={styles.select}>
          {TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>

        <label style={styles.label}>Browse Files</label>
        <div style={styles.uploadBox}>
          <input type="file" onChange={handleFileSelect} />
          <small>Supported formats: .docx .pdf .xlsx</small>
        </div>

        {file && (
          <div style={styles.filePreview}>
            📄 {file.name}
            <button onClick={() => setFile(null)} style={styles.removeBtn}>✖</button>
          </div>
        )}

        <button onClick={handleUpload} disabled={!file} style={styles.uploadBtn}>
          Upload
        </button>

        {uploadResult && (
          <div style={styles.confirmBox}>
            ✅ Uploaded: {uploadResult.originalName}<br />
            Detected Type: <b>{uploadResult.detectedType}</b>
            <button onClick={handleConfirm} disabled={confirming} style={styles.confirmBtn}>
              {confirming ? "Processing..." : "Confirm & Parse"}
            </button>
          </div>
        )}
      </div>

      {/* Uploaded Files Table */}
      <div style={styles.tableCard}>
        <h2>Uploaded Files</h2>

        <table style={styles.table}>
          <thead>
            <tr>
              <th>File Name</th>
              <th>File Type</th>
              <th>Upload Date</th>
              <th>Status</th>
              <th>Download</th>
            </tr>
          </thead>
          <tbody>
                {files.length ? files.map(file => (
                    <tr key={file.id} style={styles.tableRow}>
                    <td style={styles.tableCell}>{file.originalName}</td>
                    <td style={styles.tableCell}>{file.userType || file.detectedType}</td>
                    <td style={styles.tableCell}>{new Date(file.uploadDate).toLocaleString()}</td>
                    <td style={styles.tableCell}>{file.status}</td>
                    <td style={styles.tableCell}>
                        <a
                        href={`http://localhost:5002/${file.storedPath}`}
                        download
                        style={styles.downloadBtn}
                        >
                        Download
                        </a>
                    </td>
                    </tr>
                )) : (
                    <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: "12px" }}>
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

/* ------------------ STYLES ------------------ */
const styles = {
  pageContainer: {
    maxWidth: "900px",
    margin: "auto",
    padding: "20px"
  },
  card: {
    background: "#fff",
    padding: "20px",
    borderRadius: "10px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    marginBottom: "20px"
  },
  label: { fontWeight: "bold", marginTop: "10px" },
  select: { width: "100%", padding: "8px", marginTop: "5px" },
  uploadBox: {
    border: "2px dashed #ccc",
    padding: "15px",
    textAlign: "center",
    marginTop: "10px"
  },
  filePreview: {
    marginTop: "10px",
    padding: "10px",
    background: "#f4f4f4",
    borderRadius: "8px",
    display: "flex",
    justifyContent: "space-between"
  },
  removeBtn: { border: "none", background: "red", color: "#fff", cursor: "pointer" },
  uploadBtn: {
    width: "100%",
    padding: "10px",
    borderRadius: "5px",
    border: "none",
    background: "black",
    color: "white",
    cursor: "pointer",
    marginTop: "10px"
  },
  confirmBox: {
    background: "#f9f9f9",
    padding: "10px",
    marginTop: "10px",
    borderRadius: "5px"
  },
  confirmBtn: {
    marginTop: "8px",
    width: "100%",
    padding: "8px",
    background: "#444",
    color: "white",
    border: "none",
    cursor: "pointer"
  },
  tableCard: {
    background: "#fff",
    padding: "20px",
    borderRadius: "10px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
  },
    table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: "0 10px", // Spacing between rows
    marginTop: "10px"
  },
  tableRow: {
    background: "#f9f9f9",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
  },
  tableCell: {
    padding: "12px 15px",
    textAlign: "left"
  },
  downloadBtn: {
    background: "black",
    color: "white",
    padding: "8px 14px",
    borderRadius: "6px",
    textDecoration: "none",
    cursor: "pointer",
    fontWeight: "bold",
    display: "inline-block"
  }
};
