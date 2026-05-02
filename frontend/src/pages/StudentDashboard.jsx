import { useEffect, useMemo, useState } from "react";
import { User, ChevronDown } from "lucide-react";
import { apiFetch } from "../utils/api";

const AUTHOR_MAP = {
  "student@university.edu": "KAAzadi",
  "student2@university.edu": "fourthedesign",
  "student3@university.edu": "Angel Bowers",
  "Student One": "KAAzadi",
  "Student Two": "fourthedesign",
  "Student Three": "Angel Bowers",
};

// ── Role helpers ─────────────────────────────────────────────────────────────
// Roles are stored as comma-separated strings e.g. "leader,scrum_master"
function parseRoles(roleStr = "") {
  const parts = String(roleStr || "member").split(",").map(r => r.trim()).filter(Boolean);
  return parts.length ? parts : ["member"];
}

function hasRole(roleStr, role) {
  return parseRoles(roleStr).includes(role);
}

function roleBadges(roleStr) {
  const roles = parseRoles(roleStr);
  return roles.map(r => {
    if (r === "leader")       return { key: r, label: "Leader",       bg: "#dcfce7", color: "#166534" };
    if (r === "scrum_master") return { key: r, label: "Scrum Master", bg: "#fef3c7", color: "#92400e" };
    return                           { key: r, label: "Member",       bg: "#e5e7eb", color: "#374151" };
  });
}
// ─────────────────────────────────────────────────────────────────────────────

function normalizeText(value = "") {
  return String(value).trim().toLowerCase().replace(/\s+/g, "");
}
function getProgressColor(status) {
  if (status === "On Track")       return "#166534";
  if (status === "Needs Attention") return "#92400e";
  return "#991b1b";
}
function getProgressBg(status) {
  if (status === "On Track")       return "#dcfce7";
  if (status === "Needs Attention") return "#fef3c7";
  return "#fee2e2";
}
function MetricCard({ title, value, subtitle, theme }) {
  return (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 18, boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 13, color: theme.subtext, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: theme.text }}>{value}</div>
      {subtitle && <div style={{ fontSize: 13, color: theme.subtext, marginTop: 6 }}>{subtitle}</div>}
    </div>
  );
}
function SectionCard({ title, children, theme }) {
  return (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 22, boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
      <h3 style={{ margin: "0 0 16px 0", fontSize: 18, color: theme.text }}>{title}</h3>
      {children}
    </div>
  );
}
function ProgressBar({ label, value, theme }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      <div style={{ fontSize: 14, color: theme.subtext, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span><span>{safeValue}%</span>
      </div>
      <div style={{ height: 10, background: theme.barBg, borderRadius: 999 }}>
        <div style={{ width: `${safeValue}%`, height: "100%", background: theme.barFill, borderRadius: 999 }} />
      </div>
    </div>
  );
}
function getStatus(score = 0) {
  if (score >= 70) return "On Track";
  if (score >= 40) return "Needs Attention";
  return "At Risk";
}
function normalizeStudentRecord(record, user) {
  if (!record) return null;
  const raw = record.raw || {};
  const breakdown = record.breakdown || {};
  return {
    displayName: user?.name || record.name || record.author || "Student",
    email: record.email || user?.email || "N/A",
    score: Number(record.score || 0),
    rank: Number(record.rank || 0),
    commits:      Math.round(raw.codeCommits || 0) || Math.round(record.commits || 0) || 0,
    worklogHours: Math.round(raw.worklogHours || 0) || Math.round(record.worklogHours || 0) || 0,
    documents:    Math.round(raw.documents || 0) || Math.round(record.documents || 0) || 0,
    meetings:     Math.round(raw.meetings || 0) || Math.round(record.meetings || 0) || 0,
    percent: record.percent || "",
    breakdown,
    raw,
  };
}
function matchStudentRecord(ranking = [], user) {
  if (!user) return null;
  const email       = normalizeText(user.email || "");
  const name        = normalizeText(user.name || "");
  const githubAuthor = normalizeText(user.githubAuthor || AUTHOR_MAP[user.email] || AUTHOR_MAP[user.name] || "");
  if (email) { const m = ranking.find(r => normalizeText(r.email || "") === email); if (m) return m; }
  if (name)  { const m = ranking.find(r => normalizeText(r.name  || "") === name);  if (m) return m; }
  if (githubAuthor) {
    return (
      ranking.find(r => normalizeText(r.author || "") === githubAuthor) ||
      ranking.find(r => normalizeText(r.author || "").includes(githubAuthor)) ||
      ranking.find(r => githubAuthor.includes(normalizeText(r.author || ""))) ||
      null
    );
  }
  return null;
}
function average(values = []) {
  const valid = values.filter(v => Number.isFinite(v));
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}
function safePercentFromRatio(value, max) {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return Math.round((value / max) * 100);
}
function formatDate(d) {
  if (!d) return "—";
  // Extract yyyy-mm-dd directly — avoids ALL timezone issues
  const str = typeof d === "string" ? d : String(d);
  const ymd = str.split("T")[0];
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  return `${parts[2]}-${parts[1]}-${parts[0]}`; // dd-mm-yyyy
}

export default function StudentDashboard({ darkMode, studentTeams = [], scores = null, selectedTeamId = "", onTeamChange, loading = false, onRefreshTeams }) {
  const theme = darkMode
    ? { pageBg:"#0b1120", card:"#111827", cardSoft:"#0f172a", text:"#f8fafc", subtext:"#94a3b8", border:"#1f2937", inputBg:"#0f172a", barBg:"#1f2937", barFill:"#f8fafc" }
    : { pageBg:"#f9fafb", card:"#ffffff", cardSoft:"#fafafa", text:"#111827", subtext:"#6b7280", border:"#e5e7eb", inputBg:"#ffffff", barBg:"#e5e7eb", barFill:"#111827" };

  const savedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
  }, []);

  const [showTooltip,    setShowTooltip]    = useState(false);
  const [profilePhoto,   setProfilePhoto]   = useState("");
  const [stepDownOpen,   setStepDownOpen]   = useState(false); // controls step-down dropdown

  // ── Sprint state ──
  const [currentSprint, setCurrentSprint] = useState(null);
  const [allSprints,    setAllSprints]    = useState([]);

  const ranking       = useMemo(() => scores?.ranking || [], [scores]);
  const matchedRecord = matchStudentRecord(ranking, savedUser);
  const student       = normalizeStudentRecord(matchedRecord, savedUser);

  const expectedAuthor   = savedUser?.githubAuthor || AUTHOR_MAP[savedUser?.email] || AUTHOR_MAP[savedUser?.name] || "No mapping found";
  const availableAuthors = ranking.map(r => r.author || r.name || r.email || "Unknown");
  const teamSize         = ranking.length || 0;
  const progressStatus   = getStatus(student?.score || 0);

  const selectedTeamObject = useMemo(() => studentTeams.find(t => t.id === selectedTeamId) || null, [studentTeams, selectedTeamId]);
  const teamStudents       = selectedTeamObject?.students || [];

  const currentStudentTeamRecord = useMemo(() => {
    const savedEmail = normalizeText(savedUser?.email || "");
    const savedName  = normalizeText(savedUser?.name  || "");
    return teamStudents.find(m => {
      const me = normalizeText(m.email || "");
      const mn = normalizeText(m.name  || "");
      if (savedEmail && me) return savedEmail === me;
      return savedName && mn && savedName === mn;
    }) || null;
  }, [teamStudents, savedUser]);

  const currentRoleStr = currentStudentTeamRecord?.role || "member";
  const myRoles        = parseRoles(currentRoleStr);                    // e.g. ["leader","scrum_master"]
  const isLeader       = myRoles.includes("leader");
  const isScrumMaster  = myRoles.includes("scrum_master");
  const isBoth         = isLeader && isScrumMaster;

  // Is there someone else (not me) holding these roles?
  const otherLeader = useMemo(() =>
    teamStudents.find(m => hasRole(m.role, "leader") && normalizeText(m.email || "") !== normalizeText(savedUser?.email || "")) || null,
    [teamStudents, savedUser]
  );
  const otherScrumMaster = useMemo(() =>
    teamStudents.find(m => hasRole(m.role, "scrum_master") && normalizeText(m.email || "") !== normalizeText(savedUser?.email || "")) || null,
    [teamStudents, savedUser]
  );

  const canClaimLeader      = !!selectedTeamId && !!currentStudentTeamRecord && !isLeader      && !otherLeader;
  const canClaimScrumMaster = !!selectedTeamId && !!currentStudentTeamRecord && !isScrumMaster && !otherScrumMaster;

  // ── Profile photo ──
  useEffect(() => {
    async function loadPhoto() {
      const photoKey = currentStudentTeamRecord?.profile_photo_url;
      if (!photoKey) { setProfilePhoto(""); return; }
      try {
        const res  = await apiFetch(`/api/uploads/file?key=${encodeURIComponent(photoKey)}`);
        const data = await res.json();
        setProfilePhoto(res.ok && data.url ? data.url : "");
      } catch { setProfilePhoto(""); }
    }
    loadPhoto();
  }, [currentStudentTeamRecord]);

  // ── Load sprints ──
  useEffect(() => {
    if (!selectedTeamId) { setAllSprints([]); setCurrentSprint(null); return; }
    apiFetch(`/api/teams/${selectedTeamId}/sprints`)
      .then(r => r.json())
      .then(data => {
        const sprints = Array.isArray(data) ? data : [];
        setAllSprints(sprints);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const active = sprints.find(sp => {
          const s = new Date(sp.start_date); s.setHours(0, 0, 0, 0);
          const e = new Date(sp.end_date);   e.setHours(23, 59, 59, 999);
          return today >= s && today <= e;
        }) || null;
        setCurrentSprint(active);
      })
      .catch(() => { setAllSprints([]); setCurrentSprint(null); });
  }, [selectedTeamId]);

  // Close step-down dropdown on outside click
  useEffect(() => {
    if (!stepDownOpen) return;
    const handler = () => setStepDownOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [stepDownOpen]);

  // ── Role actions ──
  async function callRoleApi(endpoint, successMsg) {
    if (!selectedTeamId || !savedUser?.email) return;
    try {
      const res  = await apiFetch(`/api/teams/${selectedTeamId}/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: savedUser.email }) });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Action failed."); return; }
      await onRefreshTeams?.();
      alert(successMsg);
    } catch { alert("Action failed."); }
  }

  const handleClaimLeader       = () => callRoleApi("claim-leader",        "You are now a Leader of this group.");
  const handleStepDownLeader    = () => { setStepDownOpen(false); callRoleApi("remove-leader",       "You have stepped down as Leader."); };
  const handleClaimScrumMaster  = () => callRoleApi("claim-scrum-master",  "You are now the Scrum Master of this group.");
  const handleStepDownScrumMaster = () => { setStepDownOpen(false); callRoleApi("remove-scrum-master", "You have stepped down as Scrum Master."); };

  // ── Contribution breakdown ──
  const contributionBreakdown = useMemo(() => {
    if (!student || !ranking.length) return { githubActivity: 0, worklogContribution: 0, documentationContribution: 0, meetingParticipation: 0 };
    const cb  = student.breakdown || {};
    const raw = student.raw || {};
    const githubActivity          = Math.round(average(["loc","editedCode","commits","functions","hotspots","codeComplexity"].map(k => (cb[k]||0)*100)));
    const documentationContribution = Math.round(average(["avgSentenceLength","sentenceComplexity","wordCount","readability"].map(k => (cb[k]||0)*100)));
    const maxWH = Math.max(...ranking.map(r => Number(r.raw?.worklogHours || r.worklogHours || 0)), 0);
    const maxM  = Math.max(...ranking.map(r => Number(r.raw?.meetings     || r.meetings     || 0)), 0);
    const worklogContribution  = maxWH > 0 ? safePercentFromRatio(Number(raw.worklogHours || student.worklogHours || 0), maxWH) : 0;
    const meetingParticipation = Number.isFinite(raw.attendance)
      ? Math.round((raw.attendance || 0) * 100)
      : maxM > 0 ? safePercentFromRatio(Number(raw.meetings || student.meetings || 0), maxM) : 0;
    return { githubActivity, worklogContribution, documentationContribution, meetingParticipation };
  }, [student, ranking]);

  // ── Sprint progress ──
  const sprintProgress = currentSprint ? (() => {
    const end   = new Date(currentSprint.end_date); end.setHours(23, 59, 59, 999);
    const start = new Date(currentSprint.start_date);
    const today = new Date();
    const total    = Math.ceil((new Date(currentSprint.end_date) - start) / (1000*60*60*24)) + 1;
    const daysLeft = Math.max(0, Math.ceil((end - today) / (1000*60*60*24)));
    const pct      = Math.min(100, Math.round(((total - daysLeft) / total) * 100));
    return { daysLeft, pct };
  })() : null;

  if (loading) {
    return (
      <div style={{ padding: 24, background: theme.pageBg, minHeight: "100vh" }}>
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 24, maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ marginTop: 0, color: theme.text }}>Student Dashboard</h2>
          <p style={{ color: theme.subtext }}>Loading your contribution data...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div style={{ padding: 24, background: theme.pageBg, minHeight: "100vh" }}>
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 24, maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ marginTop: 0, color: theme.text }}>Student Dashboard</h2>
          <p style={{ color: theme.subtext }}>Your student record could not be matched with the current team contribution data.</p>
          <p style={{ color: theme.subtext }}>Logged in as: <strong>{savedUser?.name || savedUser?.email || "Unknown user"}</strong></p>
          <p style={{ color: theme.subtext }}>Expected GitHub author: <strong>{expectedAuthor}</strong></p>
          <p style={{ color: theme.subtext }}>Available ranking authors: <strong>{availableAuthors.join(", ") || "No authors found"}</strong></p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: theme.pageBg, minHeight: "100vh" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>

        {/* ── Header card ── */}
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 20, padding: 24, marginBottom: 18, boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>

              {/* Avatar */}
              <div style={{ width: 82, height: 82, borderRadius: "50%", overflow: "hidden", border: "2px solid #d1d5db", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {profilePhoto
                  ? <img src={profilePhoto} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <User size={36} color="#9ca3af" />}
              </div>

              <div>
                <div style={{ fontSize: 14, color: theme.subtext, marginBottom: 6 }}>Student Contribution Dashboard</div>
                <h1 style={{ margin: 0, fontSize: 30, color: theme.text }}>Welcome, {student.displayName}</h1>

                <div style={{ marginTop: 8, color: theme.subtext }}>
                  <div>Email: {student.email}</div>
                  <div style={{ marginTop: 10, maxWidth: 280 }}>
                    <div style={{ fontSize: 13, marginBottom: 6 }}>Selected Group</div>
                    <select
                      value={selectedTeamId}
                      onChange={e => onTeamChange?.(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, outline: "none" }}
                    >
                      {studentTeams.map(g => <option key={g.id} value={g.id}>{g.name} {g.code ? `(${g.code})` : ""}</option>)}
                    </select>
                  </div>
                </div>

                {/* ── Role section ── */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 13, color: theme.subtext, marginBottom: 8 }}>Your Role in This Group</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

                    {/* Current role badge(s) */}
                    {roleBadges(currentRoleStr).map(b => (
                      <span key={b.key} style={{ padding: "6px 14px", borderRadius: 999, background: b.bg, color: b.color, fontWeight: 700, fontSize: 13 }}>
                        {b.label}
                      </span>
                    ))}

                    {/* Who holds roles (if not you) */}
                    {otherLeader && (
                      <span style={{ fontSize: 12, color: theme.subtext }}>
                        Leader: <strong style={{ color: theme.text }}>{otherLeader.name || otherLeader.email}</strong>
                      </span>
                    )}
                    {otherScrumMaster && (
                      <span style={{ fontSize: 12, color: theme.subtext }}>
                        Scrum Master: <strong style={{ color: theme.text }}>{otherScrumMaster.name || otherScrumMaster.email}</strong>
                      </span>
                    )}

                    {/* Become Leader */}
                    {canClaimLeader && (
                      <button onClick={handleClaimLeader} style={{ padding: "7px 12px", borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                        Become Leader
                      </button>
                    )}

                    {/* Become Scrum Master */}
                    {canClaimScrumMaster && (
                      <button onClick={handleClaimScrumMaster} style={{ padding: "7px 12px", borderRadius: 10, border: "1px solid #fde68a", background: "#fef9c3", color: "#92400e", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                        Become Scrum Master
                      </button>
                    )}

                    {/* ── Step Down — single button if one role, dropdown if both ── */}
                    {(isLeader || isScrumMaster) && (
                      <div style={{ position: "relative" }}>
                        {isBoth ? (
                          /* Dropdown for both roles */
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); setStepDownOpen(v => !v); }}
                              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, border: "1px solid #fca5a5", background: "#fee2e2", color: "#991b1b", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
                            >
                              Step Down <ChevronDown size={14} />
                            </button>
                            {stepDownOpen && (
                              <div
                                onClick={e => e.stopPropagation()}
                                style={{ position: "absolute", top: "110%", left: 0, zIndex: 200, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", minWidth: 190, overflow: "hidden" }}
                              >
                                <button
                                  onClick={handleStepDownLeader}
                                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#166534", cursor: "pointer", borderBottom: `1px solid ${theme.border}` }}
                                >
                                  Step Down as Leader
                                </button>
                                <button
                                  onClick={handleStepDownScrumMaster}
                                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#92400e", cursor: "pointer" }}
                                >
                                  Step Down as Scrum Master
                                </button>
                              </div>
                            )}
                          </>
                        ) : isLeader ? (
                          <button onClick={handleStepDownLeader} style={{ padding: "7px 12px", borderRadius: 10, border: "1px solid #fca5a5", background: "#fee2e2", color: "#991b1b", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                            Step Down as Leader
                          </button>
                        ) : (
                          <button onClick={handleStepDownScrumMaster} style={{ padding: "7px 12px", borderRadius: 10, border: "1px solid #fca5a5", background: "#fee2e2", color: "#991b1b", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                            Step Down as Scrum Master
                          </button>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              </div>
            </div>

            {/* Status badge */}
            <div style={{ position: "relative", display: "inline-block" }} onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
              <div style={{ padding: "10px 14px", borderRadius: 999, background: getProgressBg(progressStatus), color: getProgressColor(progressStatus), fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                {progressStatus}
              </div>
              {showTooltip && (
                <div style={{ position: "absolute", top: "120%", right: 0, width: 220, background: "#111827", color: "#fff", padding: 12, borderRadius: 10, fontSize: 13, lineHeight: 1.7, boxShadow: "0 6px 18px rgba(0,0,0,0.2)", zIndex: 20 }}>
                  0–40% → At Risk<br />40–70% → Needs Attention<br />70–100% → On Track
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            CURRENT SPRINT BANNER
        ══════════════════════════════════════════ */}
        {allSprints.length > 0 && (
          <div style={{ marginBottom: 18, borderRadius: 14, border: `1px solid ${currentSprint ? "#6ee7b7" : theme.border}`, background: currentSprint ? (darkMode ? "#052e16" : "#f0fdf4") : (darkMode ? "#111827" : "#f9fafb"), padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ textAlign: "center", minWidth: 52 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: currentSprint ? "#16a34a" : theme.subtext }}>Sprint</div>
                  <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: currentSprint ? "#16a34a" : theme.subtext }}>
                    {currentSprint ? currentSprint.sprint_number : "—"}
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: currentSprint ? (darkMode ? "#86efac" : "#166534") : theme.subtext }}>
                    {currentSprint ? "Sprint in Progress" : "No Active Sprint"}
                  </div>
                  {currentSprint ? (
                    <div style={{ fontSize: 13, color: darkMode ? "#6ee7b7" : "#16a34a", marginTop: 2 }}>
                      {formatDate(currentSprint.start_date)} → {formatDate(currentSprint.end_date)}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: theme.subtext, marginTop: 2 }}>No sprint is currently running</div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
                {currentSprint?.scrum_master_name && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: theme.subtext, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Scrum Master</div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#92400e", background: "#fef3c7", padding: "3px 10px", borderRadius: 999, border: "1px solid #fde68a" }}>
                      {currentSprint.scrum_master_name}
                    </span>
                  </div>
                )}

                {/* Highlight if YOU are the sprint's scrum master */}
                {currentSprint?.scrum_master_email &&
                  normalizeText(currentSprint.scrum_master_email) === normalizeText(savedUser?.email || "") && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e", background: "#fef3c7", padding: "4px 10px", borderRadius: 999, border: "1px solid #fde68a" }}>
                    ⭐ You are Scrum Master this sprint
                  </span>
                )}

                {sprintProgress && (
                  <div style={{ textAlign: "center", minWidth: 120 }}>
                    <div style={{ fontSize: 10, color: theme.subtext, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                      {sprintProgress.daysLeft === 1 ? "Last day!" : `${sprintProgress.daysLeft} days left`}
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: darkMode ? "#1f2937" : "#d1fae5", width: 120 }}>
                      <div style={{ height: "100%", borderRadius: 999, background: "#16a34a", width: `${sprintProgress.pct}%` }} />
                    </div>
                    <div style={{ fontSize: 10, color: theme.subtext, marginTop: 3 }}>{sprintProgress.pct}% through</div>
                  </div>
                )}

                {!currentSprint && allSprints.length > 0 && (() => {
                  const today    = new Date(); today.setHours(0, 0, 0, 0);
                  const upcoming = allSprints.filter(s => new Date(s.start_date) > today).sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0];
                  return upcoming ? (
                    <div style={{ fontSize: 13, color: theme.subtext }}>
                      Next: <strong style={{ color: theme.text }}>Sprint {upcoming.sprint_number}</strong> starts {formatDate(upcoming.start_date)}
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ── Metric cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginBottom: 22 }}>
          <MetricCard title="Contribution Score" value={`${student.score}%`} subtitle="Overall contribution score" theme={theme} />
          <MetricCard title="GitHub Commits"     value={student.commits}     subtitle="Recorded code contribution"  theme={theme} />
          <MetricCard title="Worklog Hours"       value={`${student.worklogHours}h`} subtitle="Tracked worklog contribution" theme={theme} />
          <MetricCard title="Team Rank"           value={`${student.rank} / ${teamSize}`} subtitle="Your current position in the team" theme={theme} />
        </div>

        {/* ── Breakdown + Summary ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18 }}>
          <SectionCard title="Contribution Breakdown" theme={theme}>
            <div style={{ display: "grid", gap: 14 }}>
              <ProgressBar label="GitHub Activity"            value={contributionBreakdown.githubActivity}            theme={theme} />
              <ProgressBar label="Worklog Contribution"       value={contributionBreakdown.worklogContribution}       theme={theme} />
              <ProgressBar label="Documentation Contribution" value={contributionBreakdown.documentationContribution} theme={theme} />
              <ProgressBar label="Meeting Participation"      value={contributionBreakdown.meetingParticipation}      theme={theme} />
            </div>
          </SectionCard>

          <SectionCard title="Personal Progress Summary" theme={theme}>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <div style={{ fontSize: 13, color: theme.subtext, marginBottom: 4 }}>Current Score</div>
                <div style={{ fontWeight: 600, color: theme.text }}>{student.score}%</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: theme.subtext, marginBottom: 4 }}>Code Contribution</div>
                <div style={{ color: theme.text }}>{student.commits} recorded commits</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: theme.subtext, marginBottom: 4 }}>Documentation Contribution</div>
                <div style={{ color: theme.text }}>{student.documents} documented contributions</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: theme.subtext, marginBottom: 4 }}>Meeting Participation</div>
                <div style={{ color: theme.text }}>{student.meetings} recorded meetings</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: theme.subtext, marginBottom: 4 }}>Rank Summary</div>
                <div style={{ color: theme.text }}>
                  You are currently ranked <strong>{student.rank}</strong> out of <strong>{teamSize}</strong> team members based on current contribution data.
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

      </div>
    </div>
  );
}