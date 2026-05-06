import { useEffect, useMemo, useState, useCallback } from "react";
import { User, ChevronDown, ChevronRight } from "lucide-react";
import { apiFetch } from "../utils/api";

const AUTHOR_MAP = {
  "student@university.edu": "KAAzadi",
  "student2@university.edu": "fourthedesign",
  "student3@university.edu": "Angel Bowers",
  "Student One": "KAAzadi",
  "Student Two": "fourthedesign",
  "Student Three": "Angel Bowers",
};

// ── Role helpers ──────────────────────────────────────────────────────────────
function parseRoles(roleStr = "") {
  const parts = String(roleStr || "member").split(",").map(r => r.trim()).filter(Boolean);
  return parts.length ? parts : ["member"];
}
function hasRole(roleStr, role) { return parseRoles(roleStr).includes(role); }
function roleBadges(roleStr) {
  return parseRoles(roleStr).map(r => {
    if (r === "leader")       return { key: r, label: "Leader",       bg: "#dcfce7", color: "#166534" };
    if (r === "scrum_master") return { key: r, label: "Scrum Master", bg: "#fef3c7", color: "#92400e" };
    return                           { key: r, label: "Member",       bg: "#e5e7eb", color: "#374151" };
  });
}

// ── Misc helpers ──────────────────────────────────────────────────────────────
function normalizeText(v = "") { return String(v).trim().toLowerCase().replace(/\s+/g, ""); }
function getProgressColor(s) { return s === "High Performing" ? "#166534" : s === "On Track" ? "#92400e" : "#991b1b"; }
function getProgressBg(s)    { return s === "High Performing" ? "#dcfce7" : s === "On Track" ? "#fef3c7" : "#fee2e2"; }
function getStatus(score = 0) { return score >= 70 ? "High Performing" : score >= 40 ? "On Track" : "At Risk"; }
function average(values = []) {
  const v = values.filter(x => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}
function safePercentFromRatio(value, max) {
  return (!Number.isFinite(value) || max <= 0) ? 0 : Math.round((value / max) * 100);
}
function formatDate(d) {
  if (!d) return "—";
  const str = typeof d === "string" ? d : String(d);
  const ymd = str.split("T")[0];
  const parts = ymd.split("-");
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : ymd;
}

// ── Sub-components ────────────────────────────────────────────────────────────
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
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      <div style={{ fontSize: 14, color: theme.subtext, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span><span>{v}%</span>
      </div>
      <div style={{ height: 10, background: theme.barBg, borderRadius: 999 }}>
        <div style={{ width: `${v}%`, height: "100%", background: theme.barFill, borderRadius: 999 }} />
      </div>
    </div>
  );
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
    worklogHours: Math.round(raw.hours || 0) || Math.round(record.worklogHours || 0) || 0,
    documents:    Math.round(raw.documents || 0) || Math.round(record.documents || 0) || 0,
    meetings:     Math.round(raw.meetings || 0) || Math.round(record.meetings || 0) || 0,
    percent: record.percent || "",
    breakdown, raw,
  };
}
function matchStudentRecord(ranking = [], user) {
  if (!user) return null;
  const email = normalizeText(user.email || "");
  const name  = normalizeText(user.name || "");
  const gh    = normalizeText(user.githubAuthor || AUTHOR_MAP[user.email] || AUTHOR_MAP[user.name] || "");
  if (email) { const m = ranking.find(r => normalizeText(r.email || "") === email); if (m) return m; }
  if (name)  { const m = ranking.find(r => normalizeText(r.name  || "") === name);  if (m) return m; }
  if (gh)    return ranking.find(r => normalizeText(r.author||"") === gh) ||
                    ranking.find(r => normalizeText(r.author||"").includes(gh)) ||
                    ranking.find(r => gh.includes(normalizeText(r.author||""))) || null;
  return null;
}

// ── Story points badge ────────────────────────────────────────────────────────
function PriorityBadge({ priority }) {
  const cfg = {
    low:    { label: "Low",    color: "#166534", bg: "#dcfce7" },
    medium: { label: "Medium", color: "#92400e", bg: "#fef3c7" },
    high:   { label: "High",   color: "#991b1b", bg: "#fee2e2" },
  }[priority] || { label: "Medium", color: "#92400e", bg: "#fef3c7" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: cfg.bg, color: cfg.color, borderLeft: `3px solid ${cfg.color}` }}>
      {cfg.label}
    </span>
  );
}

// ── Single task card ──────────────────────────────────────────────────────────
function TaskCard({ task, isScrumMaster, isAssignedToMe, onStatusToggle, onEdit, onDelete, theme }) {
  const isDone = task.status === "complete";
  const canComplete = (isAssignedToMe || isScrumMaster) && !isDone;
  const [confirming, setConfirming] = useState(false);
  const [completing, setCompleting] = useState(false);

  async function handleComplete() {
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    setCompleting(true);
    try { await onStatusToggle(task); } finally { setCompleting(false); }
  }

  return (
    <div style={{ background: theme.card, border: `1px solid ${isDone ? "#bbf7d0" : theme.border}`, borderRadius: 12, padding: "12px 14px", opacity: isDone ? 0.85 : 1 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ marginTop: 4, flexShrink: 0, width: 10, height: 10, borderRadius: "50%", background: isDone ? "#16a34a" : "#fbbf24" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: theme.text, textDecoration: isDone ? "line-through" : "none" }}>{task.title}</span>
            <PriorityBadge priority={task.priority || 'medium'} />
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, fontWeight: 600, background: isDone ? "#dcfce7" : "#fef3c7", color: isDone ? "#166534" : "#92400e" }}>
              {isDone ? "Complete" : "In Progress"}
            </span>
          </div>
          {task.description && <div style={{ fontSize: 13, color: theme.subtext, marginTop: 4 }}>{task.description}</div>}
          {isScrumMaster && task._showAssignee && (
            <div style={{ fontSize: 12, color: theme.subtext, marginTop: 4 }}>
              Assigned to: <strong style={{ color: theme.text }}>{task.assigned_to_name || task.assigned_to_email}</strong>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
          {isDone ? (
            <button disabled style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "default", display: "flex", alignItems: "center", gap: 5 }}>
              ✓ Completed
            </button>
          ) : canComplete ? (
            <>
              <button
                onClick={handleComplete}
                disabled={completing}
                style={{ border: "none", background: confirming ? "#92400e" : "#1d4ed8", color: "#fff", borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: completing ? "default" : "pointer", display: "flex", alignItems: "center", gap: 5, opacity: completing ? 0.8 : 1 }}
              >
                {completing && <span style={{ width: 11, height: 11, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", display: "inline-block", animation: "spin 0.75s linear infinite", flexShrink: 0 }} />}
                {completing ? "Completing…" : confirming ? "Are you sure?" : "Mark as Complete"}
              </button>
              {confirming && !completing && (
                <button onClick={() => setConfirming(false)} style={{ background: "none", border: `1px solid ${theme.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 11, color: theme.subtext, cursor: "pointer" }}>
                  Cancel
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Sprint task group (collapsible) ──────────────────────────────────────────
function SprintTaskGroup({ sprint, tasks, isScrumMaster, myEmail, onStatusToggle, onEdit, onDelete, defaultOpen, theme }) {
  const [open, setOpen] = useState(defaultOpen);
  const done  = tasks.filter(t => t.status === "complete").length;
  const total = tasks.length;

  // Group tasks by student for scrum master view
  const byStudent = isScrumMaster ? tasks.reduce((acc, t) => {
    const key = t.assigned_to_email;
    if (!acc[key]) acc[key] = { name: t.assigned_to_name || t.assigned_to_email, email: key, tasks: [] };
    acc[key].tasks.push(t);
    return acc;
  }, {}) : null;

  return (
    <div style={{ border: `1px solid ${theme.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
      <button onClick={() => setOpen(v => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: theme.card, border: "none", cursor: "pointer", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {open ? <ChevronDown size={16} color={theme.subtext} /> : <ChevronRight size={16} color={theme.subtext} />}
          <span style={{ fontWeight: 700, color: theme.text, fontSize: 14 }}>Sprint {sprint.sprint_number}</span>
          <span style={{ fontSize: 12, color: theme.subtext }}>{formatDate(sprint.sprint_start || sprint.start_date)} → {formatDate(sprint.sprint_end || sprint.end_date)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: theme.subtext }}>{done}/{total} done</span>
          {total > 0 && (
            <div style={{ width: 60, height: 6, borderRadius: 999, background: theme.barBg }}>
              <div style={{ width: `${Math.round((done / total) * 100)}%`, height: "100%", borderRadius: 999, background: "#16a34a" }} />
            </div>
          )}
        </div>
      </button>
      {open && (
        <div style={{ padding: "10px 12px", background: theme.cardSoft || theme.pageBg, display: "grid", gap: 8 }}>
          {tasks.length === 0 ? (
            <div style={{ fontSize: 13, color: theme.subtext, padding: "8px 4px" }}>No tasks assigned for this sprint.</div>
          ) : isScrumMaster ? (
            /* Scrum Master: grouped by student */
            Object.values(byStudent).map(({ name, email, tasks: studentTasks }) => {
              const studentDone = studentTasks.filter(t => t.status === "complete").length;
              return (
                <div key={email} style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: theme.cardSoft || theme.pageBg, borderBottom: `1px solid ${theme.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#1d4ed8", flexShrink: 0 }}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 13, color: theme.text }}>{name}</span>
                      {normalizeText(email) === normalizeText(myEmail || "") && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#92400e", background: "#fef3c7", padding: "1px 7px", borderRadius: 999 }}>You</span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: theme.subtext }}>{studentDone}/{studentTasks.length} done</span>
                  </div>
                  <div style={{ padding: "8px 10px", display: "grid", gap: 6 }}>
                    {studentTasks.map(t => (
                      <TaskCard key={t.id} task={t}
                        isScrumMaster={true}
                        isAssignedToMe={normalizeText(t.assigned_to_email) === normalizeText(myEmail || "")}
                        onStatusToggle={onStatusToggle}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        theme={theme}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            /* Regular student: only their own tasks */
            tasks.map(t => (
              <TaskCard key={t.id} task={t}
                isScrumMaster={false}
                isAssignedToMe={true}
                onStatusToggle={onStatusToggle}
                onEdit={onEdit}
                onDelete={onDelete}
                theme={theme}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function StudentDashboard({ darkMode, studentTeams = [], scores = null, selectedTeamId = "", onTeamChange, loading = false, onRefreshTeams, onManageTasks }) {
  const theme = darkMode
    ? { pageBg:"#0b1120", card:"#111827", cardSoft:"#0f172a", text:"#f8fafc", subtext:"#94a3b8", border:"#1f2937", inputBg:"#0f172a", barBg:"#1f2937", barFill:"#f8fafc" }
    : { pageBg:"#f9fafb", card:"#ffffff", cardSoft:"#fafafa", text:"#111827", subtext:"#6b7280", border:"#e5e7eb", inputBg:"#ffffff", barBg:"#e5e7eb", barFill:"#111827" };

  const savedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
  }, []);

  const [showTooltip,  setShowTooltip]  = useState(false);
  const [profilePhoto, setProfilePhoto] = useState("");
  const [stepDownOpen, setStepDownOpen] = useState(false);

  const [currentSprint, setCurrentSprint] = useState(null);
  const [allSprints,    setAllSprints]    = useState([]);

  const [tasksBySprintId, setTasksBySprintId] = useState({});
  const [tasksLoading,    setTasksLoading]    = useState(false);

  const ranking        = useMemo(() => scores?.ranking || [], [scores]);
  const matchedRecord  = matchStudentRecord(ranking, savedUser);
  const student        = normalizeStudentRecord(matchedRecord, savedUser);
  const teamSize       = ranking.length || 0;
  const progressStatus = getStatus(student?.score || 0);

  const selectedTeamObject = useMemo(() => studentTeams.find(t => t.id === selectedTeamId) || null, [studentTeams, selectedTeamId]);
  const teamStudents       = useMemo(() => selectedTeamObject?.students || [], [selectedTeamObject]);

  const currentStudentTeamRecord = useMemo(() => {
    const se = normalizeText(savedUser?.email || "");
    const sn = normalizeText(savedUser?.name  || "");
    return teamStudents.find(m => {
      const me = normalizeText(m.email || "");
      const mn = normalizeText(m.name  || "");
      if (se && me) return se === me;
      return sn && mn && sn === mn;
    }) || null;
  }, [teamStudents, savedUser]);

  const currentRoleStr = currentStudentTeamRecord?.role || "member";
  const myRoles        = parseRoles(currentRoleStr);
  const isLeader       = myRoles.includes("leader");
  const isScrumMaster  = myRoles.includes("scrum_master");
  const isBoth         = isLeader && isScrumMaster;

  const isCurrentSprintSM = useMemo(() => {
    if (!savedUser?.email || !currentSprint) return false;
    const sprintSM = normalizeText(currentSprint.scrum_master_email || "");
    // Sprint has an explicit SM — only match them
    if (sprintSM !== "") return sprintSM === normalizeText(savedUser.email);
    // Sprint has no assigned SM — fall back to team role
    return isScrumMaster;
  }, [currentSprint, savedUser, isScrumMaster]);

  const otherLeader = useMemo(() =>
    teamStudents.find(m => hasRole(m.role, "leader") && normalizeText(m.email||"") !== normalizeText(savedUser?.email||"")) || null,
    [teamStudents, savedUser]);
  const otherScrumMaster = useMemo(() =>
    teamStudents.find(m => hasRole(m.role, "scrum_master") && normalizeText(m.email||"") !== normalizeText(savedUser?.email||"")) || null,
    [teamStudents, savedUser]);

  const canClaimLeader      = !!selectedTeamId && !!currentStudentTeamRecord && !isLeader      && !otherLeader;
  const canClaimScrumMaster = !!selectedTeamId && !!currentStudentTeamRecord && !isScrumMaster && !otherScrumMaster;

  useEffect(() => {
    async function loadPhoto() {
      const key = currentStudentTeamRecord?.profile_photo_url;
      if (!key) { setProfilePhoto(""); return; }
      try {
        const res = await apiFetch(`/api/uploads/file?key=${encodeURIComponent(key)}`);
        const d   = await res.json();
        setProfilePhoto(res.ok && d.url ? d.url : "");
      } catch { setProfilePhoto(""); }
    }
    loadPhoto();
  }, [currentStudentTeamRecord]);

  useEffect(() => {
    if (!selectedTeamId) { setAllSprints([]); setCurrentSprint(null); return; }
    apiFetch(`/api/teams/${selectedTeamId}/sprints`)
      .then(r => r.json())
      .then(data => {
        const sprints = Array.isArray(data) ? data : [];
        setAllSprints(sprints);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const active = sprints.find(sp => {
          const s = new Date(sp.start_date + "T12:00:00");
          const e = new Date(sp.end_date   + "T12:00:00");
          return today >= s && today <= e;
        }) || null;
        setCurrentSprint(active);
      })
      .catch(() => { setAllSprints([]); setCurrentSprint(null); });
  }, [selectedTeamId]);

  const loadTasks = useCallback(async () => {
    if (!selectedTeamId) { setTasksBySprintId({}); return; }
    setTasksLoading(true);
    try {
      const res  = await apiFetch(`/api/teams/${selectedTeamId}/tasks`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const grouped = {};
      (Array.isArray(data) ? data : []).forEach(t => {
        if (!grouped[t.sprint_id]) grouped[t.sprint_id] = [];
        grouped[t.sprint_id].push(t);
      });
      setTasksBySprintId(grouped);
    } catch { setTasksBySprintId({}); }
    finally { setTasksLoading(false); }
  }, [selectedTeamId]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  useEffect(() => {
    if (!stepDownOpen) return;
    const h = () => setStepDownOpen(false);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [stepDownOpen]);

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
  const handleClaimLeader         = () => callRoleApi("claim-leader",        "You are now a Leader of this group.");
  const handleStepDownLeader      = () => { setStepDownOpen(false); callRoleApi("remove-leader",        "You have stepped down as Leader."); };
  const handleClaimScrumMaster    = () => callRoleApi("claim-scrum-master",  "You are now the Scrum Master of this group.");
  const handleStepDownScrumMaster = () => { setStepDownOpen(false); callRoleApi("remove-scrum-master", "You have stepped down as Scrum Master."); };

  async function toggleTaskStatus(task) {
    const newStatus = task.status === "complete" ? "in_progress" : "complete";
    try {
      const res = await apiFetch(`/api/teams/${selectedTeamId}/tasks/${task.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus, updated_by_email: savedUser?.email }) });
      if (!res.ok) { const d = await res.json(); alert(d.error || "Failed to update"); return; }
      await loadTasks();
    } catch { alert("Failed to update task"); }
  }

  const contributionBreakdown = useMemo(() => {
    if (!student || !ranking.length) return { githubActivity: 0, worklogContribution: 0, documentationContribution: 0, meetingParticipation: 0 };
    const cb = student.breakdown || {}; const raw = student.raw || {};
    const githubActivity             = Math.round(average(["loc","editedCode","commits","functions","hotspots","codeComplexity"].map(k => (cb[k]||0)*100)));
    const documentationContribution = Math.round(average(["avgSentenceLength","sentenceComplexity","wordCount","readability"].map(k => (cb[k]||0)*100)));
    const maxWH = Math.max(...ranking.map(r => Number(r.raw?.hours || r.worklogHours || 0)), 0);
    const maxM  = Math.max(...ranking.map(r => Number(r.raw?.meetings || r.meetings || 0)), 0);
    const worklogContribution  = maxWH > 0 ? safePercentFromRatio(Number(raw.hours || student.worklogHours || 0), maxWH) : 0;
    const meetingParticipation = Number.isFinite(raw.attendance) ? Math.round((raw.attendance||0)*100) : maxM > 0 ? safePercentFromRatio(Number(raw.meetings||student.meetings||0), maxM) : 0;
    return { githubActivity, worklogContribution, documentationContribution, meetingParticipation };
  }, [student, ranking]);

  const sprintProgress = currentSprint ? (() => {
    const end   = new Date(currentSprint.end_date   + "T23:59:59");
    const start = new Date(currentSprint.start_date + "T00:00:00");
    const today = new Date();
    const total    = Math.ceil((new Date(currentSprint.end_date) - start) / (1000*60*60*24)) + 1;
    const daysLeft = Math.max(0, Math.ceil((end - today) / (1000*60*60*24)));
    return { daysLeft, pct: Math.min(100, Math.round(((total - daysLeft) / total) * 100)) };
  })() : null;

  // Sprints ordered: past (collapsed) → current (expanded) → future
  const sprintsForTaskView = useMemo(() => {
    if (!allSprints.length) return [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const past    = allSprints.filter(s => new Date(s.end_date+"T12:00:00") < today).sort((a,b) => b.sprint_number - a.sprint_number);
    const current = allSprints.filter(s => { const st = new Date(s.start_date+"T12:00:00"); const en = new Date(s.end_date+"T12:00:00"); return today >= st && today <= en; });
    const future  = allSprints.filter(s => new Date(s.start_date+"T12:00:00") > today).sort((a,b) => a.sprint_number - b.sprint_number);
    return [...past, ...current, ...future];
  }, [allSprints]);

  if (loading) return (
    <div style={{ padding: 24, background: theme.pageBg, minHeight: "100vh" }}>
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{ marginTop: 0, color: theme.text }}>Student Dashboard</h2>
        <p style={{ color: theme.subtext }}>Loading your contribution data...</p>
      </div>
    </div>
  );

  if (!student) return (
    <div style={{ padding: 24, background: theme.pageBg, minHeight: "100vh" }}>
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{ marginTop: 0, color: theme.text }}>Student Dashboard</h2>
        <p style={{ color: theme.subtext }}>Your student record could not be matched with the current team contribution data.</p>
        <p style={{ color: theme.subtext }}>Logged in as: <strong>{savedUser?.name || savedUser?.email || "Unknown user"}</strong></p>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 24, background: theme.pageBg, minHeight: "100vh" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>

        {/* ── Header card ── */}
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 20, padding: 24, marginBottom: 18, boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ width: 82, height: 82, borderRadius: "50%", overflow: "hidden", border: "2px solid #d1d5db", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {profilePhoto ? <img src={profilePhoto} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={36} color="#9ca3af" />}
              </div>
              <div>
                <div style={{ fontSize: 14, color: theme.subtext, marginBottom: 6 }}>Student Contribution Dashboard</div>
                <h1 style={{ margin: 0, fontSize: 30, color: theme.text }}>Welcome, {student.displayName}</h1>
                <div style={{ marginTop: 8, color: theme.subtext }}>
                  <div>Email: {student.email}</div>
                  <div style={{ marginTop: 10, maxWidth: 280 }}>
                    <div style={{ fontSize: 13, marginBottom: 6 }}>Selected Group</div>
                    <select value={selectedTeamId} onChange={e => onTeamChange?.(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, outline: "none" }}>
                      {studentTeams.map(g => <option key={g.id} value={g.id}>{g.name} {g.code ? `(${g.code})` : ""}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 13, color: theme.subtext, marginBottom: 8 }}>Your Role in This Group</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {roleBadges(currentRoleStr).map(b => (
                      <span key={b.key} style={{ padding: "6px 14px", borderRadius: 999, background: b.bg, color: b.color, fontWeight: 700, fontSize: 13 }}>{b.label}</span>
                    ))}
                    {otherLeader && <span style={{ fontSize: 12, color: theme.subtext }}>Leader: <strong style={{ color: theme.text }}>{otherLeader.name || otherLeader.email}</strong></span>}
                    {otherScrumMaster && <span style={{ fontSize: 12, color: theme.subtext }}>Scrum Master: <strong style={{ color: theme.text }}>{otherScrumMaster.name || otherScrumMaster.email}</strong></span>}
                    {canClaimLeader && <button onClick={handleClaimLeader} style={{ padding: "7px 12px", borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Become Leader</button>}
                    {canClaimScrumMaster && <button onClick={handleClaimScrumMaster} style={{ padding: "7px 12px", borderRadius: 10, border: "1px solid #fde68a", background: "#fef9c3", color: "#92400e", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Become Scrum Master</button>}
                    {(isLeader || isScrumMaster) && (
                      <div style={{ position: "relative" }}>
                        {isBoth ? (
                          <>
                            <button onClick={e => { e.stopPropagation(); setStepDownOpen(v => !v); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, border: "1px solid #fca5a5", background: "#fee2e2", color: "#991b1b", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                              Step Down <ChevronDown size={14} />
                            </button>
                            {stepDownOpen && (
                              <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: "110%", left: 0, zIndex: 200, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", minWidth: 190, overflow: "hidden" }}>
                                <button onClick={handleStepDownLeader} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#166534", cursor: "pointer", borderBottom: `1px solid ${theme.border}` }}>Step Down as Leader</button>
                                <button onClick={handleStepDownScrumMaster} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#92400e", cursor: "pointer" }}>Step Down as Scrum Master</button>
                              </div>
                            )}
                          </>
                        ) : isLeader ? (
                          <button onClick={handleStepDownLeader} style={{ padding: "7px 12px", borderRadius: 10, border: "1px solid #fca5a5", background: "#fee2e2", color: "#991b1b", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Step Down as Leader</button>
                        ) : (
                          <button onClick={handleStepDownScrumMaster} style={{ padding: "7px 12px", borderRadius: 10, border: "1px solid #fca5a5", background: "#fee2e2", color: "#991b1b", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Step Down as Scrum Master</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ position: "relative", display: "inline-block" }} onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
              <div style={{ padding: "10px 14px", borderRadius: 999, background: getProgressBg(progressStatus), color: getProgressColor(progressStatus), fontWeight: 600, fontSize: 14, cursor: "pointer" }}>{progressStatus}</div>
              {showTooltip && (
                <div style={{ position: "absolute", top: "120%", right: 0, width: 220, background: "#111827", color: "#fff", padding: 12, borderRadius: 10, fontSize: 13, lineHeight: 1.7, boxShadow: "0 6px 18px rgba(0,0,0,0.2)", zIndex: 20 }}>
                  0–40% → At Risk<br />40–70% → On Track<br />70–100% → High Performing
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Sprint banner ── */}
        {allSprints.length > 0 && (
          <div style={{ marginBottom: 18, borderRadius: 14, border: `1px solid ${currentSprint ? "#6ee7b7" : theme.border}`, background: currentSprint ? (darkMode ? "#052e16" : "#f0fdf4") : (darkMode ? "#111827" : "#f9fafb"), padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ textAlign: "center", minWidth: 52 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: currentSprint ? "#16a34a" : theme.subtext }}>Sprint</div>
                  <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: currentSprint ? "#16a34a" : theme.subtext }}>{currentSprint ? currentSprint.sprint_number : "—"}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: currentSprint ? (darkMode ? "#86efac" : "#166534") : theme.subtext }}>{currentSprint ? "Sprint in Progress" : "No Active Sprint"}</div>
                  {currentSprint
                    ? <div style={{ fontSize: 13, color: darkMode ? "#6ee7b7" : "#16a34a", marginTop: 2 }}>{formatDate(currentSprint.start_date)} → {formatDate(currentSprint.end_date)}</div>
                    : <div style={{ fontSize: 12, color: theme.subtext, marginTop: 2 }}>No sprint is currently running</div>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
                {currentSprint?.scrum_master_name && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: theme.subtext, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Scrum Master</div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#92400e", background: "#fef3c7", padding: "3px 10px", borderRadius: 999, border: "1px solid #fde68a" }}>{currentSprint.scrum_master_name}</span>
                  </div>
                )}
                {isCurrentSprintSM && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e", background: "#fef3c7", padding: "4px 10px", borderRadius: 999, border: "1px solid #fde68a" }}>You are Scrum Master this sprint</span>
                )}
                {sprintProgress && (
                  <div style={{ textAlign: "center", minWidth: 120 }}>
                    <div style={{ fontSize: 10, color: theme.subtext, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{sprintProgress.daysLeft === 1 ? "Last day!" : `${sprintProgress.daysLeft} days left`}</div>
                    <div style={{ height: 6, borderRadius: 999, background: darkMode ? "#1f2937" : "#d1fae5", width: 120 }}>
                      <div style={{ height: "100%", borderRadius: 999, background: "#16a34a", width: `${sprintProgress.pct}%` }} />
                    </div>
                    <div style={{ fontSize: 10, color: theme.subtext, marginTop: 3 }}>{sprintProgress.pct}% through</div>
                  </div>
                )}
                {!currentSprint && allSprints.length > 0 && (() => {
                  const today = new Date(); today.setHours(0,0,0,0);
                  const up = allSprints.filter(s => new Date(s.start_date+"T12:00:00") > today).sort((a,b) => a.sprint_number - b.sprint_number)[0];
                  return up ? <div style={{ fontSize: 13, color: theme.subtext }}>Next: <strong style={{ color: theme.text }}>Sprint {up.sprint_number}</strong> starts {formatDate(up.start_date)}</div> : null;
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ── Scrum Master quick action card ── */}
        {isCurrentSprintSM && (
          <div style={{ marginBottom: 18, borderRadius: 14, border: "1px solid #bfdbfe", background: darkMode ? "#0c1a30" : "#eff6ff", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: darkMode ? "#93c5fd" : "#1d4ed8" }}>Sprint Task Management</div>
              <div style={{ fontSize: 13, color: darkMode ? "#60a5fa" : "#3b82f6", marginTop: 3 }}>
                You are the Scrum Master for Sprint {currentSprint?.sprint_number} — assign and manage tasks for your team
              </div>
            </div>
            <button
              onClick={() => onManageTasks?.(selectedTeamId, selectedTeamObject?.students || [])}
              style={{ flexShrink: 0, padding: "9px 18px", borderRadius: 10, border: `1px solid ${darkMode ? "#3b82f6" : "#93c5fd"}`, background: "transparent", color: darkMode ? "#93c5fd" : "#1d4ed8", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Manage Tasks
            </button>
          </div>
        )}

        {/* ── Metric cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginBottom: 22 }}>
          <MetricCard title="Contribution Score" value={`${student.score}%`}              subtitle="Overall contribution score"        theme={theme} />
          <MetricCard title="GitHub Commits"      value={student.commits}                  subtitle="Recorded code contribution"        theme={theme} />
          <MetricCard title="Worklog Hours"        value={`${student.worklogHours}h`}      subtitle="Tracked worklog contribution"      theme={theme} />
          <MetricCard title="Team Rank"            value={`${student.rank} / ${teamSize}`} subtitle="Your current position in the team" theme={theme} />
        </div>

        {/* ── Breakdown + Summary ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18, marginBottom: 22 }}>
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
              <div><div style={{ fontSize: 13, color: theme.subtext, marginBottom: 4 }}>Current Score</div><div style={{ fontWeight: 600, color: theme.text }}>{student.score}%</div></div>
              <div><div style={{ fontSize: 13, color: theme.subtext, marginBottom: 4 }}>Code Contribution</div><div style={{ color: theme.text }}>{student.commits} recorded commits</div></div>
              <div><div style={{ fontSize: 13, color: theme.subtext, marginBottom: 4 }}>Documentation Contribution</div><div style={{ color: theme.text }}>{student.documents} documented contributions</div></div>
              <div><div style={{ fontSize: 13, color: theme.subtext, marginBottom: 4 }}>Meeting Participation</div><div style={{ color: theme.text }}>{student.meetings} recorded meetings</div></div>
              <div><div style={{ fontSize: 13, color: theme.subtext, marginBottom: 4 }}>Rank Summary</div><div style={{ color: theme.text }}>You are currently ranked <strong>{student.rank}</strong> out of <strong>{teamSize}</strong> team members.</div></div>
            </div>
          </SectionCard>
        </div>


        {/* ══════════════════════════════════════════
            SPRINT TASKS (read-only student view)
        ══════════════════════════════════════════ */}
        {allSprints.length > 0 && (
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 22, boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: theme.text }}>My Tasks</h3>
              <div style={{ fontSize: 13, color: theme.subtext, marginTop: 3 }}>Your assigned tasks across sprints</div>
            </div>
            {tasksLoading ? (
              <div style={{ fontSize: 13, color: theme.subtext, padding: 12 }}>Loading tasks...</div>
            ) : (
              sprintsForTaskView.map((sprint, idx) => {
                const sprintTasks = (tasksBySprintId[sprint.id] || []).filter(t =>
                  normalizeText(t.assigned_to_email) === normalizeText(savedUser?.email || "")
                );
                const isActiveSprint = currentSprint?.id === sprint.id;
                const defaultOpen    = isActiveSprint || (!currentSprint && idx === sprintsForTaskView.length - 1);
                return (
                  <SprintTaskGroup
                    key={sprint.id}
                    sprint={sprint}
                    tasks={sprintTasks}
                    isScrumMaster={false}
                    myEmail={savedUser?.email}
                    onStatusToggle={toggleTaskStatus}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    defaultOpen={defaultOpen}
                    theme={theme}
                  />
                );
              })
            )}
          </div>
        )}


      </div>
    </div>
  );
}