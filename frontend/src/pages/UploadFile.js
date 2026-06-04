// frontend/src/pages/UploadFile.js
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/api";
import { useActiveTeam } from "../context/TeamContext";
import { RefreshCw } from "lucide-react";

const TYPE_OPTIONS = [
  { value: "attendance", label: "Attendance Sheet (.xlsx)" },
  { value: "worklog", label: "Worklog Document (.docx/.pdf)" },
  { value: "peer_review", label: "Peer Review Form (.docx/.pdf)" },
  { value: "sprint_report", label: "Sprint Report (.docx)" },
  { value: "project_plan", label: "Project Plan (.docx)" },
  { value: "unknown", label: "Unknown Type" }
];

const GROUP_VIEW_OPTIONS = [
  { value: "active", label: "Active Group" },
  { value: "all", label: "All Groups" }
];

const TYPE_LABELS = {
  attendance: "Attendance Sheet",
  worklog: "Worklog",
  peer_review: "Peer Review",
  sprint_report: "Sprint Report",
  project_plan: "Project Plan",
  unknown: "Unknown",
};

function prettyType(v = "") {
  return TYPE_LABELS[v] || v || "Unknown";
}

function normalizeUploadRecord(fileItem = {}) {
  return {
    id: fileItem.id,
    teamId: fileItem.team_id || fileItem.teamId || "unknown",
    originalName: fileItem.original_name || fileItem.originalName || "unknown",
    storedName: fileItem.stored_name || fileItem.storedName || "",
    s3Key: fileItem.s3_key || fileItem.s3Key || "",
    s3ParsedKey: fileItem.s3_parsed_key || fileItem.s3ParsedKey || null,
    jsonPath: fileItem.json_path || fileItem.jsonPath || null,
    mimetype: fileItem.mimetype || "",
    size: Number(fileItem.size || 0),
    uploadDate: fileItem.upload_date || fileItem.uploadDate || null,
    detectedType: fileItem.detected_type || fileItem.detectedType || "unknown",
    userType: fileItem.user_type || fileItem.userType || "unknown",
    status: fileItem.status || "unknown",
    approvalStatus: fileItem.approval_status || fileItem.approvalStatus || null,
    parseMessage: fileItem.parse_message || fileItem.parseMessage || "",
    uploadedByName: fileItem.uploaded_by_name || fileItem.uploadedByName || null,
    uploadedByEmail: fileItem.uploaded_by_email || fileItem.uploadedByEmail || null,
    sprintId: fileItem.sprint_id || fileItem.sprintId || null,
  };
}

function getStatusBadgeStyle(status = "") {
  const value = String(status).toLowerCase();
  if (value.includes("parsed") || value.includes("complete") || value.includes("confirmed"))
    return { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" };
  if (value.includes("pending") || value.includes("uploaded") || value.includes("processing"))
    return { background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" };
  if (value.includes("fail") || value.includes("error") || value.includes("rejected"))
    return { background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5" };
  return { background: "#e5e7eb", color: "#374151", border: "1px solid #d1d5db" };
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDisplayDate(dateValue) {
  if (!dateValue) return "Unknown";
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

export default function UploadFile({ darkMode }) {
  const { activeTeamId } = useActiveTeam();
  const [file, setFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [files, setFiles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [overrideType, setOverrideType] = useState("unknown");
  const [confirming, setConfirming] = useState(false);

  const [repoUrl, setRepoUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [groupView, setGroupView] = useState("active");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [uploadTeamId, setUploadTeamId] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);

  const [sprints, setSprints] = useState([]);
  const [uploadSprintId, setUploadSprintId] = useState("");

  const theme = darkMode
    ? { pageBg:"#0b1120", card:"#111827", cardAlt:"#0f172a", text:"#f8fafc", subtext:"#94a3b8", border:"#1f2937", softBorder:"#334155", inputBg:"#0f172a", shadow:"0 8px 20px rgba(0,0,0,.28)", tableRow:"#0f172a", groupBadgeBg:"#1e293b", groupBadgeText:"#e2e8f0" }
    : { pageBg:"#f8fafc", card:"#ffffff", cardAlt:"#f9fafb", text:"#111827", subtext:"#6b7280", border:"#e5e7eb", softBorder:"#d1d5db", inputBg:"#ffffff", shadow:"0 2px 10px rgba(0,0,0,0.1)", tableRow:"#f9f9f9", groupBadgeBg:"#eef2ff", groupBadgeText:"#3730a3" };

  const detectedType = uploadResult?.detectedType || "unknown";
  const effectiveType = useMemo(() => overrideType !== "unknown" ? overrideType : detectedType, [overrideType, detectedType]);


  const fetchFiles = () => {
    apiFetch("/api/uploads").then(r => r.json())
      .then(data => setFiles(Array.isArray(data) ? data.map(normalizeUploadRecord) : []))
      .catch(console.error);
  };

  const fetchTeams = () => {
    apiFetch("/api/teams").then(r => r.json())
      .then(data => setTeams(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  useEffect(() => { fetchTeams(); }, []);

  // Re-fetch files whenever the active team changes
  useEffect(() => { fetchFiles(); }, [activeTeamId]);

  // Always sync upload target when active team changes
  useEffect(() => {
    if (activeTeamId) setUploadTeamId(activeTeamId);
  }, [activeTeamId]);

  useEffect(() => {
    if (!uploadTeamId) { setSprints([]); setUploadSprintId(""); return; }
    apiFetch(`/api/teams/${uploadTeamId}/sprints`)
      .then(r => r.json())
      .then(data => setSprints(Array.isArray(data) ? data : []))
      .catch(() => setSprints([]));
    setUploadSprintId("");
  }, [uploadTeamId]);

  const teamNameMap = useMemo(() => {
    const map = {};
    (Array.isArray(teams) ? teams : []).forEach(team => { map[team.id] = team.name || team.code || team.id; });
    return map;
  }, [teams]);

  const uploaderLabel = (fileItem) => fileItem.uploadedByName || fileItem.uploadedByEmail || "Unknown";

  const groupedFiles = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const grouped = {};
    files.forEach(f => {
      const teamId = f.teamId || "unknown";
      const fileType = f.userType || f.detectedType || "unknown";
      const fileStatus = String(f.status || "").toLowerCase();
      const fileName = String(f.originalName || "").toLowerCase();
      const uploader = uploaderLabel(f).toLowerCase();

      if (groupView === "active" && activeTeamId && teamId !== activeTeamId) return;
      if (groupView === "all" && selectedGroup !== "all" && teamId !== selectedGroup) return;
      if (selectedType !== "all" && fileType !== selectedType) return;
      if (selectedStatus !== "all" && fileStatus !== selectedStatus) return;
      if (normalizedSearch && !fileName.includes(normalizedSearch) && !uploader.includes(normalizedSearch)) return;

      if (!grouped[teamId]) grouped[teamId] = [];
      grouped[teamId].push(f);
    });

    return Object.entries(grouped)
      .map(([teamId, groupFiles]) => ({
        teamId,
        teamName: teamNameMap[teamId] || (teamId === "unknown" ? "Unknown Group" : teamId),
        files: [...groupFiles].sort((a, b) => new Date(b.uploadDate || 0) - new Date(a.uploadDate || 0)),
      }))
      .sort((a, b) => {
        if (a.teamId === activeTeamId) return -1;
        if (b.teamId === activeTeamId) return 1;
        return a.teamName.localeCompare(b.teamName);
      });
  }, [files, teamNameMap, activeTeamId, groupView, selectedGroup, selectedType, selectedStatus, searchTerm]);

  const availableStatuses = useMemo(() => {
    const values = new Set();
    files.forEach(f => { if (f.status) values.add(String(f.status).toLowerCase()); });
    return Array.from(values);
  }, [files]);

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setUploadResult(null);
    if (selected) {
      const lower = selected.name.toLowerCase();
      if (lower.includes("attendance"))                                                     setOverrideType("attendance");
      else if (lower.includes("worklog"))                                                   setOverrideType("worklog");
      else if (lower.includes("sprint"))                                                    setOverrideType("sprint_report");
      else if (lower.includes("peer") || lower.includes("peer_assessment"))                setOverrideType("peer_review");
      else if ((lower.includes("project") && lower.includes("plan")) || lower.includes("team plan")) setOverrideType("project_plan");
      else                                                                                  setOverrideType("unknown");
    }
  };

  const handleUpload = async () => {
    if (!file || !uploadTeamId) return;
    try {
      const teamIdForUpload = uploadTeamId || activeTeamId || "unknown";
      let currentUser = null;
      try { currentUser = JSON.parse(localStorage.getItem("user") || "null"); } catch {}

      const presignRes = await apiFetch(`/api/uploads/presign?filename=${encodeURIComponent(file.name)}&teamId=${encodeURIComponent(teamIdForUpload)}&contentType=${encodeURIComponent(file.type || "application/octet-stream")}`);
      if (!presignRes.ok) { const err = await presignRes.json(); setUploadResult({ error: err.error || "Failed to get upload URL." }); return; }

      const { url, s3Key, storedName } = await presignRes.json();
      const s3Res = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      if (!s3Res.ok) { setUploadResult({ error: `S3 upload failed (${s3Res.status}).` }); return; }

      const res = await apiFetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          s3Key,
          storedName,
          originalName: file.name,
          size: file.size,
          mimetype: file.type,
          teamId: teamIdForUpload,
          userType: overrideType,
          sprintId: uploadSprintId || null,
          uploadedByName: currentUser?.name || null,
          uploadedByEmail: currentUser?.email || null,
        }),
      });
      const json = await res.json();
      setUploadResult(normalizeUploadRecord(json));
      fetchFiles();
    } catch (e) { setUploadResult({ error: e.message || "Upload failed." }); }
  };

  const handleConfirm = async () => {
    if (!uploadResult?.id) return;
    setConfirming(true);
    try {
      const res = await apiFetch("/api/uploads/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: uploadResult.id, type: effectiveType }) });
      const json = await res.json();
      setUploadResult(normalizeUploadRecord(json));
      setFile(null); setOverrideType("unknown");
      fetchFiles();
    } finally { setConfirming(false); }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm("Delete this uploaded file?")) return;
    try {
      const res = await apiFetch(`/api/uploads/${fileId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error || "Failed to delete file."); return; }
      if (uploadResult?.id === fileId) setUploadResult(null);
      fetchFiles();
    } catch { alert("Failed to delete file."); }
  };

  const handleAnalyzeRepo = async () => {
    setAnalyzeMsg("");
    if (!repoUrl.trim()) { setAnalyzeMsg("Please paste a GitHub repository URL first."); return; }
    setAnalyzing(true);
    try {
      await apiFetch("/api/github/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: repoUrl.trim(), teamId: uploadTeamId }) });
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const st = await apiFetch(`/api/github/status?teamId=${encodeURIComponent(uploadTeamId)}`).then(r => r.json());
        if (st.finalStatsExists) { clearInterval(poll); setAnalyzing(false); setAnalyzeMsg("Analysis complete! Refresh the dashboard to see results."); }
        else if (attempts > 60) { clearInterval(poll); setAnalyzing(false); setAnalyzeMsg("Analysis is taking longer than expected."); }
        else setAnalyzeMsg(`Analysis running... (${attempts * 5}s elapsed)`);
      }, 5000);
    } catch (e) { setAnalyzeMsg(e.message || "Network error"); }
    finally { setAnalyzing(false); }
  };

  const handleDownload = async (fileId) => { try { const res = await apiFetch(`/api/uploads/${fileId}/download`); const { url } = await res.json(); window.open(url, "_blank"); } catch {} };
  const handleView    = async (fileId) => { try { const res = await apiFetch(`/api/uploads/${fileId}/download`); const { url } = await res.json(); window.open(url, "_blank"); } catch {} };
  const handleReparse = async (fileId) => { try { const res = await apiFetch(`/api/uploads/${fileId}/reparse`, { method: "POST", headers: { "Content-Type": "application/json" } }); if (!res.ok) throw new Error(); const updated = normalizeUploadRecord(await res.json()); setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: updated.status, parseMessage: updated.parseMessage } : f)); } catch {} };

  const cardStyle     = { background: theme.card, padding: "20px", borderRadius: "10px", boxShadow: theme.shadow, marginBottom: "20px", border: `1px solid ${theme.border}` };
  const labelStyle    = { fontWeight: "bold", marginTop: "10px", color: theme.text, display: "block" };
  const selectStyle   = { width: "100%", padding: "10px", marginTop: "5px", borderRadius: "8px", border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, outline: "none" };
  const uploadBoxStyle = { border: `2px dashed ${theme.softBorder}`, padding: "15px", textAlign: "center", marginTop: "10px", borderRadius: "10px", background: theme.cardAlt, color: theme.subtext };
  const filePreviewStyle = { marginTop: "10px", padding: "10px", background: theme.cardAlt, borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", color: theme.text, border: `1px solid ${theme.border}` };
  const uploadBtnStyle = { width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: "#000", color: "white", cursor: file && uploadTeamId ? "pointer" : "not-allowed", marginTop: "10px", fontWeight: 700, opacity: file && uploadTeamId ? 1 : 0.6 };
  const confirmBoxStyle = { background: theme.cardAlt, color: theme.text, padding: "12px", marginTop: "10px", borderRadius: "8px", border: `1px solid ${theme.border}`, lineHeight: 1.5 };
  const confirmBtnStyle = { marginTop: "10px", width: "100%", padding: "10px", background: darkMode ? "#1f2937" : "#444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 };
  const analyzeBtnStyle = { width: "100%", padding: "10px", borderRadius: "8px", border: "none", background: "#111827", color: "white", cursor: "pointer", marginTop: "10px", fontWeight: 600, opacity: analyzing || !repoUrl.trim() ? 0.6 : 1 };
  const tableCellStyle = { padding: "12px", textAlign: "left", color: theme.text, borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`, verticalAlign: "top", overflowWrap: "anywhere", wordBreak: "break-word" };
  const tableStyle     = { width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", marginTop: "10px", color: theme.text, tableLayout: "auto", minWidth: "760px" };
  const thStyle        = { textAlign: "left", color: theme.subtext, fontSize: "13px", padding: "0 12px 8px 12px" };
  const tableRowStyle  = { background: theme.tableRow, boxShadow: darkMode ? "none" : "0 1px 3px rgba(0,0,0,0.1)" };

  return (
    <div style={{ maxWidth: "1500px", margin: "0 auto", padding: "20px", minHeight: "100vh", background: theme.pageBg, color: theme.text }}>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 440px) 1fr", gap: 20, alignItems: "stretch" }}>

      {/* ── Left column: Analyze Repo + Upload Documents ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Analyze Repo ── */}
      <div style={cardStyle}>
        <h1 style={{ marginTop: 0, color: theme.text }}>Analyze GitHub Repository</h1>
        <label style={labelStyle}>Paste GitHub URL</label>
        <input type="text" placeholder="https://github.com/owner/repo" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} style={{ width: "100%", padding: "10px", marginTop: 6, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, outline: "none", boxSizing: "border-box" }} />
        <button onClick={handleAnalyzeRepo} disabled={analyzing || !repoUrl.trim()} style={analyzeBtnStyle}>{analyzing ? "Analyzing..." : "Analyze Repo"}</button>
        {analyzeMsg && <div style={{ marginTop: 8, color: analyzeMsg.startsWith("Analysis complete") ? "#065f46" : theme.subtext }}>{analyzeMsg}</div>}
        <div style={{ marginTop: 8, color: theme.subtext, fontSize: 12 }}>This will fetch commits and run code analysis (Lizard + blame) via <code>main.py</code>.</div>
      </div>

      {/* ── Upload Documents ── */}
      <div style={cardStyle}>
        <h1 style={{ marginTop: 0, color: theme.text }}>Upload Documents</h1>
        <div style={{ padding: "14px", borderRadius: "10px", background: theme.cardAlt, border: `1px solid ${theme.border}`, marginBottom: "14px" }}>
          <label style={{ ...labelStyle, marginTop: 0 }}>Upload To Group</label>
          <select value={uploadTeamId} onChange={e => setUploadTeamId(e.target.value)} style={selectStyle}>
            <option value="">Select a group</option>
            {teams.map(team => <option key={team.id} value={team.id}>{team.name || team.code || team.id}</option>)}
          </select>
          <div style={{ marginTop: 8, fontSize: 13, color: theme.subtext }}>
            Current target: <strong style={{ color: theme.text }}>{teamNameMap[uploadTeamId] || "No group selected"}</strong>
          </div>
        </div>

        {sprints.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <label style={labelStyle}>Tag to Sprint</label>
            <select
              value={uploadSprintId}
              onChange={e => setUploadSprintId(e.target.value)}
              style={selectStyle}
            >
              <option value="">No sprint (overall)</option>
              {sprints.map(s => (
                <option key={s.id} value={s.id}>
                  Sprint {s.sprint_number} ({s.start_date} → {s.end_date})
                </option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: theme.subtext, marginTop: 4 }}>
              Tag this document to a sprint for sprint-specific scoring.
            </div>
          </div>
        )}

        <label style={labelStyle}>Select Document Type</label>
        <select value={overrideType} onChange={e => setOverrideType(e.target.value)} style={selectStyle}>
          {TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>

        <label style={labelStyle}>Browse Files</label>
        <div style={uploadBoxStyle}>
          <input type="file" onChange={handleFileSelect} />
          <div style={{ marginTop: "8px" }}><small>Supported formats: .docx .pdf .xlsx</small></div>
        </div>

        {file && (
          <div style={filePreviewStyle}>
            <span>{file.name}</span>
            <button onClick={() => setFile(null)} style={{ border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", borderRadius: "6px", padding: "6px 8px", fontWeight: 700 }}>Remove</button>
          </div>
        )}

        <button onClick={handleUpload} disabled={!file || !uploadTeamId} style={uploadBtnStyle}>Upload</button>

        {uploadResult?.error && (
          <div style={{ marginTop: 10, padding: "10px 12px", background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 14 }}>{uploadResult.error}</div>
        )}

        {uploadResult && !uploadResult.error && (
          <div style={confirmBoxStyle}>
            Uploaded: {uploadResult.originalName || "Unknown file"}<br />
            Detected Type: <b>{uploadResult.detectedType || "unknown"}</b>
            {uploadResult.status && <><br />Status: <b>{uploadResult.status}</b></>}
            {uploadResult.parseMessage && <><br />Message: {uploadResult.parseMessage}</>}
            {!["confirmed","parsed","parse_failed"].includes(String(uploadResult.status||"").toLowerCase()) && (
              <button onClick={handleConfirm} disabled={confirming} style={confirmBtnStyle}>{confirming ? "Processing..." : "Confirm & Parse"}</button>
            )}
          </div>
        )}
      </div>

      </div>
      {/* end left column */}

      {/* ── Right column: Uploaded Files by Group ── */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h2 style={{ margin: 0, color: theme.text }}>Uploaded Files by Group</h2>
          <style>{`@keyframes refreshSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          <button
            onClick={() => {
              setRefreshing(true);
              fetchFiles();
              fetchTeams();
              setTimeout(() => setRefreshing(false), 800);
            }}
            disabled={refreshing}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              border: `1px solid ${theme.border}`,
              background: "#111827", color: "#ffffff",
              borderRadius: 10, padding: "8px 12px",
              fontSize: 13, cursor: refreshing ? "not-allowed" : "pointer", fontWeight: 700,
            }}
            title="Refresh uploaded files"
          >
            <RefreshCw
              size={15}
              style={{
                animation: refreshing ? "refreshSpin 0.8s linear infinite" : "none",
                transformOrigin: "center",
              }}
            />
            Refresh
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
          <div>
            <label style={labelStyle}>Group View</label>
            <select value={groupView} onChange={e => setGroupView(e.target.value)} style={selectStyle}>
              {GROUP_VIEW_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          {groupView === "all" && (
            <div>
              <label style={labelStyle}>Filter by Group</label>
              <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} style={selectStyle}>
                <option value="all">All Groups</option>
                {teams.map(team => <option key={team.id} value={team.id}>{team.name || team.code || team.id}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={labelStyle}>Filter by Type</label>
            <select value={selectedType} onChange={e => setSelectedType(e.target.value)} style={selectStyle}>
              <option value="all">All Types</option>
              {TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{prettyType(opt.value)}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Filter by Status</label>
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} style={selectStyle}>
              <option value="all">All Statuses</option>
              {availableStatuses.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Search</label>
            <input type="text" placeholder="Search by file name or uploader" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: "100%", padding: "10px", marginTop: 5, borderRadius: "8px", border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>

        {groupedFiles.length ? groupedFiles.map(group => (
          <div key={group.teamId} style={{ marginTop: 18, padding: 16, border: `1px solid ${theme.border}`, borderRadius: 12, background: theme.cardAlt }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, color: theme.text }}>{group.teamName}</h3>
              <span style={{ background: theme.groupBadgeBg, color: theme.groupBadgeText, borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>
                {group.teamId === activeTeamId ? "Active Group" : `Group ID: ${group.teamId}`}
              </span>
            </div>
            <div style={{ width: "100%", overflow: "visible" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>File Name</th>
                    <th style={thStyle}>File Type</th>
                    <th style={thStyle}>Uploaded By</th>
                    <th style={thStyle}>Size</th>
                    <th style={thStyle}>Upload Date</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.files.map((f) => {
                    const badgeStyle = getStatusBadgeStyle(f.status);
                    return (
                      <tr key={f.id} style={tableRowStyle}>
                        <td
                          style={{
                            ...tableCellStyle,
                            borderLeft: `1px solid ${theme.border}`,
                            borderTopLeftRadius: "10px",
                            borderBottomLeftRadius: "10px",
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{f.originalName}</div>
                        </td>
                        <td style={tableCellStyle}>
                          <div>{prettyType(f.userType !== "unknown" ? f.userType : f.detectedType)}</div>
                          {f.sprintId && (
                            <div style={{ fontSize: 11, marginTop: 3, color: "#0369a1", background: "#e0f2fe", padding: "1px 6px", borderRadius: 999, display: "inline-block" }}>
                              {sprints.find(s => String(s.id) === String(f.sprintId))?.sprint_number
                                ? `Sprint ${sprints.find(s => String(s.id) === String(f.sprintId)).sprint_number}`
                                : "Sprint"}
                            </div>
                          )}
                        </td>
                        <td style={tableCellStyle}>
                        <div>{uploaderLabel(f)}</div>
                        </td>
                        <td style={tableCellStyle}>{formatFileSize(f.size)}</td>
                        <td style={tableCellStyle}>{formatDisplayDate(f.uploadDate)}</td>
                        <td style={tableCellStyle}>
                          <span
                            style={{
                              ...badgeStyle,
                              borderRadius: "6px",
                              padding: "3px 8px",
                              fontSize: "11px",
                              fontWeight: 700,
                              letterSpacing: "0.05em",
                              display: "inline-block",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {(f.status || "unknown").toUpperCase()}
                          </span>
                        </td>
                        <td
                          style={{
                            ...tableCellStyle,
                            borderRight: `1px solid ${theme.border}`,
                            borderTopRightRadius: "10px",
                            borderBottomRightRadius: "10px",
                            position: "relative",
                          }}
                        >
                          <button
                            onClick={() => setOpenMenuId(openMenuId === f.id ? null : f.id)}
                            style={{
                              background: "none",
                              border: `1px solid ${theme.border}`,
                              borderRadius: 6,
                              cursor: "pointer",
                              fontSize: 16,
                              color: theme.subtext,
                              padding: "2px 8px",
                              lineHeight: 1,
                            }}
                          >
                            ⋮
                          </button>

                          {openMenuId === f.id && (
                            <div
                              style={{
                                position: "absolute",
                                right: 8,
                                top: "100%",
                                zIndex: 100,
                                background: theme.card,
                                border: `1px solid ${theme.border}`,
                                borderRadius: 8,
                                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                                minWidth: 130,
                                overflow: "hidden",
                              }}
                            >
                              {[
                                { label: "View", onClick: () => handleView(f.id), color: theme.text },
                                { label: "Download", onClick: () => handleDownload(f.id), color: theme.text },
                                ...(f.status === "parse_failed" ? [
                                  { label: "Re-parse", onClick: () => handleReparse(f.id), color: "#1d4ed8" },
                                ] : []),
                                { label: "Delete", onClick: () => handleDelete(f.id), color: "#b83232" },
                              ].map(({ label, onClick, color }) => (
                                <button
                                  key={label}
                                  onClick={() => { onClick(); setOpenMenuId(null); }}
                                  style={{
                                    display: "block",
                                    width: "100%",
                                    textAlign: "left",
                                    background: "none",
                                    border: "none",
                                    padding: "9px 14px",
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )) : (
          <div style={{ textAlign: "center", padding: "12px", color: theme.subtext }}>No files found for the selected filters.</div>
        )}
      </div>
      {/* end right column */}

      </div>
      {/* end grid */}
    </div>
  );
}