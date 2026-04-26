// frontend/src/pages/FileExplorer.jsx
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/api";

const TYPE_LABELS = {
  worklog: "Worklog",
  peer_review: "Peer Review",
  attendance: "Attendance Sheet",
  sprint_report: "Sprint Report",
  project_plan: "Project Plan",
};

const APPROVAL_STYLES = {
  approved:  { background: "#dcfce7", color: "#166534" },
  pending:   { background: "#fef3c7", color: "#92400e" },
  rejected:  { background: "#fee2e2", color: "#991b1b" },
};

function prettyType(v = "") {
  return TYPE_LABELS[v] || v || "Unknown";
}

function prettySize(bytes) {
  if (!bytes || bytes === 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function prettyDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function FileIcon({ name = "" }) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const color =
    ext === "pdf" ? "#ef4444" :
    ["xlsx", "xls"].includes(ext) ? "#16a34a" :
    ["docx", "doc"].includes(ext) ? "#2563eb" :
    "#64748b";

  const label =
    ext === "pdf" ? "PDF" :
    ["xlsx", "xls"].includes(ext) ? "XLS" :
    ["docx", "doc"].includes(ext) ? "DOC" :
    ext.toUpperCase().slice(0, 3) || "FILE";

  return (
    <div style={{
      width: 42, height: 48, borderRadius: 6, flexShrink: 0,
      background: `${color}18`, border: `1.5px solid ${color}40`,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 2,
    }}>
      <div style={{ fontSize: 7, fontWeight: 800, color, letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ width: 18, height: 2, borderRadius: 2, background: `${color}60` }} />
      <div style={{ width: 14, height: 2, borderRadius: 2, background: `${color}40` }} />
      <div style={{ width: 16, height: 2, borderRadius: 2, background: `${color}40` }} />
    </div>
  );
}

export default function FileExplorer({ darkMode, teams = [], activeTeamId = "" }) {
  const [teamId, setTeamId] = useState(
    () => localStorage.getItem("dashboardTeamId") || activeTeamId || teams[0]?.id || ""
  );
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null); // null = all
  const [openingId, setOpeningId] = useState(null);

  const t = darkMode
    ? { pageBg: "#0b1120", card: "#111827", cardHover: "#1e293b", sidebar: "#0f172a",
        text: "#f8fafc", subtext: "#94a3b8", border: "#1f2937", activeBg: "#1d4ed8",
        activeText: "#fff", sidebarItem: "#1e293b" }
    : { pageBg: "#f8fafc", card: "#ffffff", cardHover: "#f1f5f9", sidebar: "#f1f5f9",
        text: "#0f172a", subtext: "#64748b", border: "#e5e7eb", activeBg: "#111827",
        activeText: "#fff", sidebarItem: "#ffffff" };

  useEffect(() => {
    if (!teamId) { setFiles([]); return; }
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/uploads/by-team?teamId=${encodeURIComponent(teamId)}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setFiles(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setFiles([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [teamId]);

  // Reset student selection when team changes
  useEffect(() => { setSelectedEmail(null); }, [teamId]);

  const currentTeam = teams.find(t => t.id === teamId);

  // Build sidebar student list from files
  const students = useMemo(() => {
    const seen = new Map();
    files.forEach(f => {
      if (f.uploaded_by_email && !seen.has(f.uploaded_by_email)) {
        seen.set(f.uploaded_by_email, f.uploaded_by_name || f.uploaded_by_email);
      }
    });
    return Array.from(seen.entries()).map(([email, name]) => ({ email, name }));
  }, [files]);

  // "Team Documents" group
  const displayFiles = useMemo(() => {
    if (!selectedEmail) return files;
    if (selectedEmail === "__team__") return files.filter(f => f.upload_scope === "team");
    return files.filter(f => f.uploaded_by_email === selectedEmail);
  }, [files, selectedEmail]);

  const teamFiles = useMemo(() => files.filter(f => f.upload_scope === "team"), [files]);

  async function openFile(fileId) {
    setOpeningId(fileId);
    try {
      const res = await apiFetch(`/api/uploads/${encodeURIComponent(fileId)}/download`);
      const data = await res.json();
      if (data?.url) window.open(data.url, "_blank");
    } catch (err) {
      console.error("Failed to open file", err);
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div style={{ padding: "24px 16px", maxWidth: 1100, margin: "0 auto", color: t.text }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700 }}>File Explorer</h1>
        <p style={{ margin: 0, color: t.subtext, fontSize: 14 }}>
          Browse all submitted files by student
        </p>
      </div>

      {/* Team selector */}
      {teams.length > 1 && (
        <select
          value={teamId}
          onChange={e => setTeamId(e.target.value)}
          style={{
            marginBottom: 20, padding: "9px 12px", borderRadius: 10, fontSize: 14,
            border: `1px solid ${t.border}`, background: t.card, color: t.text,
            cursor: "pointer", minWidth: 220,
          }}
        >
          {teams.map(team => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
      )}

      {/* Body */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* Sidebar */}
        <div style={{
          width: 220, flexShrink: 0, background: t.sidebar,
          border: `1px solid ${t.border}`, borderRadius: 14,
          padding: "8px 6px", position: "sticky", top: 80,
        }}>
          <div style={{ padding: "4px 8px 8px", fontSize: 11, fontWeight: 700,
            color: t.subtext, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Filter by Student
          </div>

          <SidebarItem
            label="All Files"
            count={files.length}
            active={selectedEmail === null}
            onClick={() => setSelectedEmail(null)}
            t={t}
          />

          {teamFiles.length > 0 && (
            <SidebarItem
              label="Team Documents"
              count={teamFiles.length}
              active={selectedEmail === "__team__"}
              onClick={() => setSelectedEmail("__team__")}
              t={t}
            />
          )}

          {students.length > 0 && (
            <div style={{ borderTop: `1px solid ${t.border}`, margin: "6px 0", paddingTop: 6 }} />
          )}

          {students.map(s => {
            const count = files.filter(f => f.uploaded_by_email === s.email).length;
            return (
              <SidebarItem
                key={s.email}
                label={s.name}
                sublabel={s.name !== s.email ? s.email : null}
                count={count}
                active={selectedEmail === s.email}
                onClick={() => setSelectedEmail(s.email)}
                t={t}
              />
            );
          })}

          {students.length === 0 && !loading && (
            <div style={{ padding: "8px 10px", fontSize: 13, color: t.subtext }}>
              No uploads yet
            </div>
          )}
        </div>

        {/* File list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Section label */}
          <div style={{ marginBottom: 12, fontSize: 13, color: t.subtext }}>
            {selectedEmail === null
              ? `All files${currentTeam ? ` · ${currentTeam.name}` : ""}`
              : selectedEmail === "__team__"
              ? "Team Documents"
              : students.find(s => s.email === selectedEmail)?.name || selectedEmail}
            {!loading && (
              <span style={{ marginLeft: 8, fontWeight: 600, color: t.text }}>
                ({displayFiles.length} {displayFiles.length === 1 ? "file" : "files"})
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ background: t.card, border: `1px solid ${t.border}`,
              borderRadius: 14, padding: 24, color: t.subtext, fontSize: 14 }}>
              Loading files…
            </div>
          ) : displayFiles.length === 0 ? (
            <div style={{ background: t.card, border: `1px solid ${t.border}`,
              borderRadius: 14, padding: 24, color: t.subtext, fontSize: 14 }}>
              No files to show.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {displayFiles.map(file => (
                <FileCard
                  key={file.id}
                  file={file}
                  t={t}
                  opening={openingId === file.id}
                  onOpen={() => openFile(file.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ label, sublabel, count, active, onClick, t }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 6,
        padding: "8px 10px", borderRadius: 8, marginBottom: 2,
        border: "none", cursor: "pointer",
        background: active ? t.activeBg : "transparent",
        color: active ? t.activeText : t.text,
        transition: "background 0.1s",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: active ? 600 : 400,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: 11, color: active ? `${t.activeText}99` : t.subtext,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sublabel}
          </div>
        )}
      </div>
      <span style={{
        fontSize: 11, fontWeight: 600, flexShrink: 0,
        background: active ? "rgba(255,255,255,0.2)" : t.border,
        color: active ? t.activeText : t.subtext,
        borderRadius: 10, padding: "1px 7px",
      }}>
        {count}
      </span>
    </button>
  );
}

function FileCard({ file, t, opening, onOpen }) {
  const typeLabel = prettyType(file.user_type || file.detected_type);
  const approvalStyle = APPROVAL_STYLES[file.approval_status] || APPROVAL_STYLES.pending;
  const sizeStr = prettySize(file.size);
  const dateStr = prettyDate(file.upload_date);

  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`,
      borderRadius: 14, padding: "14px 16px",
      boxShadow: "0 2px 8px rgba(0,0,0,.04)",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <FileIcon name={file.original_name} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + badges row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
          <span style={{
            fontWeight: 600, fontSize: 14, color: t.text,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320,
          }}>
            {file.original_name || "Unnamed file"}
          </span>

          <Badge label={typeLabel} style={{ background: "#f1f5f9", color: "#475569" }} />

          <Badge
            label={(file.approval_status || "pending").toUpperCase()}
            style={approvalStyle}
          />
        </div>

        {/* Meta row */}
        <div style={{ fontSize: 13, color: t.subtext, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {file.uploaded_by_name && (
            <span>
              <span style={{ color: t.subtext }}>by </span>
              <strong style={{ color: t.text }}>{file.uploaded_by_name}</strong>
            </span>
          )}
          {dateStr && <span>{dateStr}</span>}
          {sizeStr && <span>{sizeStr}</span>}
          {file.upload_scope === "team" && (
            <span style={{ color: "#8b5cf6", fontWeight: 600 }}>Team doc</span>
          )}
        </div>

        {/* Decline / parse message */}
        {file.decline_reason && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#991b1b",
            background: "#fee2e2", borderRadius: 6, padding: "4px 8px", display: "inline-block" }}>
            Declined: {file.decline_reason}
          </div>
        )}
        {file.status === "parse_failed" && file.parse_message && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#9a3412",
            background: "#ffedd5", borderRadius: 6, padding: "4px 8px", display: "inline-block" }}>
            {file.parse_message}
          </div>
        )}
      </div>

      {/* Action */}
      <button
        onClick={onOpen}
        disabled={opening}
        style={{
          flexShrink: 0, border: "1px solid #111827", background: opening ? "#374151" : "#111827",
          color: "#fff", borderRadius: 8, padding: "7px 14px",
          fontSize: 13, fontWeight: 600, cursor: opening ? "default" : "pointer",
          opacity: opening ? 0.7 : 1,
        }}
      >
        {opening ? "Opening…" : "Open"}
      </button>
    </div>
  );
}

function Badge({ label, style }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
      borderRadius: 5, padding: "2px 7px", flexShrink: 0,
      ...style,
    }}>
      {label}
    </span>
  );
}
