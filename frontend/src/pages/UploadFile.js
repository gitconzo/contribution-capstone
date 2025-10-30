// frontend/src/pages/UploadFile.js
import React, { useEffect, useMemo, useState } from "react";

const TYPE_OPTIONS = [
  { value: "attendance", label: "Attendance Sheet (.xlsx)" },
  { value: "worklog", label: "Worklog Document (.docx/.pdf)" },
  { value: "peer_review", label: "Peer Review Form (.docx/.pdf)" },
  { value: "sprint_report", label: "Sprint Report (.docx)" },
  { value: "project_plan", label: "Project Plan (.docx)" },
  { value: "unknown", label: "Unknown Type" }
];

export default function UploadFile() {
  const [file, setFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [files, setFiles] = useState([]);
  const [overrideType, setOverrideType] = useState("unknown");
  const [confirming, setConfirming] = useState(false);

  // NEW: repo url state + result
  const [repoUrl, setRepoUrl] = useState("");
  const [repoBusy, setRepoBusy] = useState(false);
  const [repoResult, setRepoResult] = useState(null);

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
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userType", overrideType);

    const res = await fetch(`${API}/api/uploads`, { method: "POST", body: formData });
    const json = await res.json();
    setUploadResult(json);
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

  // NEW: Submit repo URL (runs backend main.py)
  const handleRepoAnalyze = async () => {
  const url = repoUrl.trim();
  if (!url) return;
  setRepoBusy(true);
  setRepoResult(null);
  try {
    const fd = new FormData();
    fd.append("repoUrl", url);        // <-- text field, not a file

    const res = await fetch(`${API}/api/uploads`, {
      method: "POST",
      body: fd,                       // <-- no headers => no preflight
    });

    // If server crashed, this can still throw here:
    const json = await res.json();
    setRepoResult(json);
  } catch (e) {
    setRepoResult({ error: e.message || "Failed to analyze repo." });
  } finally {
    setRepoBusy(false);
  }
};

  return (
    <div style={styles.pageContainer}>
      {/* --- New Analyze GitHub Repo Card --- */}
      <div style={styles.card}>
        <h1>Analyze GitHub Repo</h1>
        <label style={styles.label}>Paste Repo URL (e.g., https://github.com/owner/repo)</label>
        <input
          type="text"
          placeholder="https://github.com/owner/repo"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          style={styles.textInput}
        />
        <button onClick={handleRepoAnalyze} disabled={!repoUrl.trim() || repoBusy} style={styles.uploadBtn}>
          {repoBusy ? "Analyzing..." : "Analyze Repo"}
        </button>

        {repoResult && (
          <div style={styles.confirmBox}>
            <div><b>Repo:</b> {repoResult?.repo?.url || repoResult?.repoUrl || "—"}</div>
            {repoResult?.mainPy ? (
              <>
                <div><b>main.py status:</b> {repoResult.mainPy.status}</div>
                <pre style={styles.pre}>
{(repoResult.mainPy.message || "").slice(0, 4000)}
{(repoResult.mainPy.message || "").length > 4000 ? "\n...truncated..." : ""}
                </pre>
              </>
            ) : repoResult?.error ? (
              <div style={{ color: "red" }}>Error: {repoResult.error}</div>
            ) : (
              <div>Submitted.</div>
            )}
            <small>
              Outputs: <code>/backend/data/output.json</code>, <code>/backend/data/finalStats.json</code>, <code>/backend/data/commits.json</code>
            </small>
          </div>
        )}
      </div>

      {/* --- Existing Upload Documents Card --- */}
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

const styles = {
  pageContainer: { maxWidth: "900px", margin: "auto", padding: "20px" },
  card: {
    background: "#fff", padding: "20px", borderRadius: "10px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)", marginBottom: "20px"
  },
  label: { fontWeight: "bold", marginTop: "10px" },
  select: { width: "100%", padding: "8px", marginTop: "5px" },
  uploadBox: {
    border: "2px dashed #ccc", padding: "15px", textAlign: "center", marginTop: "10px"
  },
  textInput: {
    width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", marginTop: "8px"
  },
  filePreview: {
    marginTop: "10px", padding: "10px", background: "#f4f4f4",
    borderRadius: "8px", display: "flex", justifyContent: "space-between"
  },
  removeBtn: { border: "none", background: "red", color: "#fff", cursor: "pointer" },
  uploadBtn: {
    width: "100%", padding: "10px", borderRadius: "5px", border: "none",
    background: "black", color: "white", cursor: "pointer", marginTop: "10px"
  },
  confirmBox: { background: "#f9f9f9", padding: "10px", marginTop: "10px", borderRadius: "5px" },
  confirmBtn: {
    marginTop: "8px", width: "100%", padding: "8px", background: "#444",
    color: "white", border: "none", cursor: "pointer"
  },
  tableCard: {
    background: "#fff", padding: "20px", borderRadius: "10px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
  },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", marginTop: "10px" },
  tableRow: { background: "#f9f9f9", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  tableCell: { padding: "12px 15px", textAlign: "left" },
  downloadBtn: {
    background: "black", color: "white", padding: "8px 14px",
    borderRadius: "6px", textDecoration: "none", cursor: "pointer", fontWeight: "bold",
    display: "inline-block"
  },
  pre: {
    marginTop: 8, padding: 10, background: "#eee", borderRadius: 6, maxHeight: 240, overflow: "auto"
  }
};
