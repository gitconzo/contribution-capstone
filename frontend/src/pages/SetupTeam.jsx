import React, { useState } from "react";
import { apiFetch } from "../utils/api";

const EMPTY_STUDENT = { name: "", email: "", github: "", aliases: "" };
const EMPTY_SPRINT   = { sprint_number: "", start_date: "", end_date: "", scrum_master_email: "" };
const EMPTY_BREAK    = { label: "", start_date: "", end_date: "" };

// ── Date helpers ──────────────────────────────────────────────────────────────
function addDays(dateStr, days) {
  // Use local Date constructor (year, month, day) to avoid any UTC/timezone shift
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

// Count how many days in [start, end] overlap with any break period
// Count how many days in [rangeStart, rangeEnd] overlap with any break period
// Compare two yyyy-mm-dd strings without any Date/timezone conversion
function dateCmp(a, b) {
  // returns -1, 0, or 1
  return a < b ? -1 : a > b ? 1 : 0;
}

// Check if a single date falls inside any break period (pure string compare)
function isBreakDay(dateStr, breaks) {
  return breaks.some(br => {
    if (!br.start_date || !br.end_date) return false;
    return dateCmp(dateStr, br.start_date) >= 0 && dateCmp(dateStr, br.end_date) <= 0;
  });
}

// Generate sprints walking day-by-day, skipping break days
// so each sprint always contains exactly sprintLengthDays active (non-break) days
function generateSprints(startDate, sprintCount, sprintLengthDays, breaks = []) {
  const sprints = [];
  let cursor = startDate;
  for (let i = 1; i <= sprintCount; i++) {
    let workDays = 0;
    let day = cursor;
    while (workDays < sprintLengthDays) {
      if (!isBreakDay(day, breaks)) workDays++;
      if (workDays < sprintLengthDays) day = addDays(day, 1);
    }
    const end = day;
    sprints.push({ sprint_number: i, start_date: cursor, end_date: end, scrum_master_email: "" });
    cursor = addDays(end, 1);
    // If next cursor lands inside a break, jump past it
    let changed = true;
    while (changed) {
      changed = false;
      for (const br of breaks) {
        if (!br.start_date || !br.end_date) continue;
        if (dateCmp(cursor, br.start_date) >= 0 && dateCmp(cursor, br.end_date) <= 0) {
          cursor = addDays(br.end_date, 1);
          changed = true;
        }
      }
    }
  }
  return sprints;
}



// Format a yyyy-mm-dd string to dd-mm-yyyy for display
function fmtDate(d) {
  if (!d) return "—";
  // Extract date part directly from string — avoids ALL timezone issues
  const str = typeof d === "string" ? d : String(d);
  const ymd = str.split("T")[0]; // "2026-05-11"
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  return `${parts[2]}-${parts[1]}-${parts[0]}`; // "11-05-2026"
}

// Convert a date value from API to yyyy-mm-dd for input[type=date] — uses UTC to avoid timezone shift
function toInputDate(d) {
  if (!d) return "";
  // Extract yyyy-mm-dd directly from string to avoid timezone shift
  const str = typeof d === "string" ? d : String(d);
  return str.split("T")[0]; // Always returns "yyyy-mm-dd"
}

export default function SetupTeam({ darkMode, teams = [], onTeamsChange }) {
  // ── Create-team form ──
  const [name, setName]           = useState("");
  const [code, setCode]           = useState("");
  const [repoUrl, setRepoUrl]     = useState("");
  const [newStudents, setNewStudents] = useState([{ ...EMPTY_STUDENT }]);
  const [createSprints, setCreateSprints] = useState([]);
  const [creating, setCreating]   = useState(false);
  const [error, setError]         = useState("");

  // ── Existing teams ──
  const [expandedId, setExpandedId]           = useState(null);
  const [studentStatuses, setStudentStatuses] = useState({});
  const [editingId, setEditingId]             = useState(null);
  const [editName, setEditName]               = useState("");
  const [editCode, setEditCode]               = useState("");
  const [editRepo, setEditRepo]               = useState("");

  // ── Student add/edit ──
  const [addingStudentToId, setAddingStudentToId] = useState(null);
  const [newStudentName, setNewStudentName]       = useState("");
  const [newStudentEmail, setNewStudentEmail]     = useState("");
  const [newStudentGithub, setNewStudentGithub]   = useState("");
  const [editingStudent, setEditingStudent]       = useState(null);
  const [editStudentName, setEditStudentName]     = useState("");
  const [editStudentEmail, setEditStudentEmail]   = useState("");
  const [editStudentRole, setEditStudentRole]     = useState("member");
  const [editStudentGithub, setEditStudentGithub] = useState("");

  // ── Per-team sprints ──
  const [sprintsByTeam, setSprintsByTeam]       = useState({});
  const [addingSprintToId, setAddingSprintToId] = useState(null);
  const [newSprint, setNewSprint]               = useState({ ...EMPTY_SPRINT });
  const [editingSprint, setEditingSprint]       = useState(null);
  const [editSprint, setEditSprint]             = useState({ ...EMPTY_SPRINT });
  const [sprintError, setSprintError]           = useState("");
  const [analyzingSprint, setAnalyzingSprint] = useState({}); 
  const [analyzeMsg, setAnalyzeMsg] = useState({});

  // ── Sprint Template ──
  const [templateOpen, setTemplateOpen] = useState(false);
  const [tplMode, setTplMode]           = useState("auto");
  const [tplTargets, setTplTargets]     = useState([]);
  const [tplApplying, setTplApplying]   = useState(false);
  const [tplResult, setTplResult]       = useState("");
  const [managedOpenSprint, setManagedOpenSprint] = useState(null);
  const [managingSprintTeams, setManagingSprintTeams] = useState(null); 
  const [sprintTeamEditing, setSprintTeamEditing] = useState({});
  const [editingSprintDates, setEditingSprintDates] = useState(null);
  const [editSprintDatesForm, setEditSprintDatesForm] = useState({ start_date: "", end_date: "" });
  // Auto mode
  const [tplStart, setTplStart]   = useState("");
  const [tplCount, setTplCount]   = useState(4);
  const [tplLength, setTplLength] = useState(21);
  // Campus break periods
  const [tplBreaks, setTplBreaks] = useState([]);
  const addTplBreak    = () => setTplBreaks(p => [...p, { ...EMPTY_BREAK }]);
  const removeTplBreak = (i) => setTplBreaks(p => p.filter((_, idx) => idx !== i));
  const updateTplBreak = (i, f, v) => setTplBreaks(p => p.map((b, idx) => idx === i ? { ...b, [f]: v } : b));
  // Manual mode
  const [tplManual, setTplManual] = useState([{ sprint_number: 1, start_date: "", end_date: "" }]);
  const addTplManualRow    = () => setTplManual(p => [...p, { sprint_number: p.length + 1, start_date: "", end_date: "" }]);
  const removeTplManualRow = (i) => setTplManual(p => p.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, sprint_number: idx + 1 })));
  const updateTplManual    = (i, f, v) => setTplManual(p => p.map((s, idx) => idx === i ? { ...s, [f]: v } : s));

  const theme = darkMode
    ? {
        pageBg:"#0b1120", card:"#111827", cardAlt:"#0f172a",
        text:"#f8fafc", subtext:"#94a3b8", border:"#1f2937",
        softBorder:"#334155", inputBg:"#0f172a",
        shadow:"0 8px 20px rgba(0,0,0,.28)",
        dangerBg:"#3f1d1d", dangerText:"#fecaca", dangerBorder:"#7f1d1d",
        expandEditBg:"#0f172a", expandEditText:"#94a3b8",
        studentRowBg:"#0f172a", addStudentBorder:"#334155", addStudentColor:"#94a3b8",
        sprintRowBg:"#131f35", tplBg:"#0c1a30", tplBorder:"#1e3a5f",
        tabActiveBg:"#1e3a5f", tabActiveText:"#93c5fd",
        tabInactiveBg:"transparent", tabInactiveText:"#64748b",
        breakBg:"#1a1207", breakBorder:"#78350f",
      }
    : {
        pageBg:"#f8fafc", card:"#ffffff", cardAlt:"#ffffff",
        text:"#111827", subtext:"#64748b", border:"#e5e7eb",
        softBorder:"#d1d5db", inputBg:"#ffffff",
        shadow:"0 4px 12px rgba(0,0,0,.04)",
        dangerBg:"#fee2e2", dangerText:"#991b1b", dangerBorder:"#fecaca",
        expandEditBg:"#f0f9ff", expandEditText:"#374151",
        studentRowBg:"#f9fafb", addStudentBorder:"#d1d5db", addStudentColor:"#64748b",
        sprintRowBg:"#f0f7ff", tplBg:"#eff6ff", tplBorder:"#bfdbfe",
        tabActiveBg:"#dbeafe", tabActiveText:"#1d4ed8",
        tabInactiveBg:"transparent", tabInactiveText:"#64748b",
        breakBg:"#fffbeb", breakBorder:"#fde68a",
      };

  // ── Student row helpers ──
  const updateNewStudent    = (i, f, v) => setNewStudents(p => p.map((s, idx) => idx === i ? { ...s, [f]: v } : s));
  const addNewStudentRow    = () => setNewStudents(p => [...p, { ...EMPTY_STUDENT }]);
  const removeNewStudentRow = (i) => setNewStudents(p => p.filter((_, idx) => idx !== i));

  // ── Create-form sprint helpers ──
  const nextCreateSprintNum = () => createSprints.length > 0 ? Math.max(...createSprints.map(s => s.sprint_number)) + 1 : 1;
  const addCreateSprint     = () => setCreateSprints(p => [...p, { ...EMPTY_SPRINT, sprint_number: nextCreateSprintNum() }]);
  const updateCreateSprint  = (i, f, v) => setCreateSprints(p => p.map((s, idx) => idx === i ? { ...s, [f]: v } : s));
  const removeCreateSprint  = (i) => setCreateSprints(p => p.filter((_, idx) => idx !== i));

  const loadTeams = async () => {
    setError("");
    try {
      const res = await apiFetch("/api/teams");
      if (!res.ok) throw new Error(`Load teams failed (${res.status})`);
      const data = await res.json();
      onTeamsChange(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message || "Unable to load teams"); }
  };

  const loadSprints = async (teamId) => {
    try {
      const res = await apiFetch(`/api/teams/${teamId}/sprints`);
      if (res.ok) {
        const data = await res.json();
        setSprintsByTeam(p => ({ ...p, [teamId]: data }));
      }
    } catch (e) { console.error("Failed to load sprints:", e); }
  };

  const toggleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null); setEditingId(null); setEditingStudent(null);
      setAddingStudentToId(null); setAddingSprintToId(null); setEditingSprint(null);
    } else {
      setExpandedId(id); setEditingId(null); setEditingStudent(null);
      setAddingStudentToId(null); setAddingSprintToId(null); setEditingSprint(null);
      try {
        const res = await apiFetch(`/api/teams/${id}/student-statuses`);
        if (res.ok) { const statuses = await res.json(); setStudentStatuses(p => ({ ...p, [id]: statuses })); }
      } catch {}
      await loadSprints(id);
    }
  };

  // ── Create team ──
  const onCreate = async () => {
    setError("");
    if (!name.trim() || !code.trim() || !repoUrl.trim()) { setError("Team Name, Project Code, and Repository URL are required."); return; }
    const validStudents = newStudents.filter(s => s.name.trim() && s.email.trim());
    if (!validStudents.length) { setError("At least one student is required."); return; }
    setCreating(true);
    try {
      const body = {
        name: name.trim(), code: code.trim(), repo: normalizeRepo(repoUrl.trim()),
        students: validStudents.map(s => ({
          name: s.name.trim(), email: s.email.trim(),
          github: s.github.trim() || null,
          aliases: s.aliases.trim() ? s.aliases.split(",").map(a => a.trim()).filter(Boolean) : [],
        })),
      };
      const res  = await apiFetch("/api/teams", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Create failed (${res.status})`);
      if (createSprints.length > 0) {
        for (const sp of createSprints) {
          if (!sp.start_date || !sp.end_date) continue;
          await apiFetch(`/api/teams/${json.id}/sprints`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ sprint_number: Number(sp.sprint_number), start_date: sp.start_date, end_date: sp.end_date, scrum_master_email: null }) });
        }
      }
      await loadTeams();
      setName(""); setCode(""); setRepoUrl(""); setNewStudents([{ ...EMPTY_STUDENT }]); setCreateSprints([]);
      alert("Team created.");
    } catch (e) { setError(e.message || "Create team failed"); }
    finally { setCreating(false); }
  };

  // ── Edit/delete team ──
  const onEditTeam  = (t) => { setEditingId(t.id); setEditName(t.name); setEditCode(t.code); setEditRepo(t.repo?.url || ""); };
  const onSaveTeam  = async (id) => {
    try {
      const res = await apiFetch(`/api/teams/${id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name:editName, code:editCode, repo:normalizeRepo(editRepo) }) });
      if (!res.ok) throw new Error("Failed to update team");
      setEditingId(null); await loadTeams();
    } catch (e) { setError(e.message); }
  };
  const onDeleteTeam = async (id) => {
    if (!window.confirm("Delete this team?")) return;
    try {
      const res = await apiFetch(`/api/teams/${id}`, { method:"DELETE" });
      if (!res.ok) throw new Error("Failed to delete team");
      if (expandedId === id) setExpandedId(null);
      await loadTeams();
    } catch (e) { setError(e.message); }
  };

  // ── Student CRUD ──
  const onAddStudent = async (teamId) => {
    if (!newStudentName.trim() || !newStudentEmail.trim()) { setError("Name and email required."); return; }
    try {
      const res = await apiFetch(`/api/teams/${teamId}/students`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name:newStudentName.trim(), email:newStudentEmail.trim(), github:newStudentGithub.trim() }) });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Failed to add student"); }
      setAddingStudentToId(null); setNewStudentName(""); setNewStudentEmail(""); setNewStudentGithub("");
      await loadTeams();
    } catch (e) { setError(e.message); }
  };
  const onRemoveStudent = async (teamId, email) => {
    if (!window.confirm(`Remove ${email}?`)) return;
    try {
      const res = await apiFetch(`/api/teams/${teamId}/students/${encodeURIComponent(email)}`, { method:"DELETE" });
      if (!res.ok) throw new Error("Failed to remove student");
      await loadTeams();
    } catch (e) { setError(e.message); }
  };
  const onEditStudent = (teamId, s) => {
    setEditStudentRole(s.role || "member"); setEditingStudent({ teamId, email:s.email });
    setEditStudentName(s.name); setEditStudentEmail(s.email); setEditStudentGithub(s.github || "");
  };
  const onSaveStudent = async () => {
    const { teamId, email } = editingStudent;
    try {
      const res = await apiFetch(`/api/teams/${teamId}/students/${encodeURIComponent(email)}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name:editStudentName, email:editStudentEmail, github:editStudentGithub, role:editStudentRole }) });
      if (!res.ok) throw new Error("Failed to update student");
      setEditingStudent(null); await loadTeams();
    } catch (e) { setError(e.message); }
  };

  // ── Sprint CRUD (existing teams) ──
  const nextSprintNum = (teamId) => { const s = sprintsByTeam[teamId] || []; return s.length ? Math.max(...s.map(x => x.sprint_number)) + 1 : 1; };
  const onAddSprint = async (teamId) => {
    setSprintError("");
    const { sprint_number, start_date, end_date, scrum_master_email } = newSprint;
    if (!start_date || !end_date) { setSprintError("Start and end date required."); return; }
    try {
      const res  = await apiFetch(`/api/teams/${teamId}/sprints`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ sprint_number:Number(sprint_number||nextSprintNum(teamId)), start_date, end_date, scrum_master_email:scrum_master_email||null }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add sprint");
      setAddingSprintToId(null); setNewSprint({ ...EMPTY_SPRINT }); await loadSprints(teamId);
    } catch (e) { setSprintError(e.message); }
  };
  const onEditSprint = (teamId, sprint) => {
    setEditingSprint({ teamId, sprintId:sprint.id });
    setEditSprint({ sprint_number:sprint.sprint_number, start_date:toInputDate(sprint.start_date), end_date:toInputDate(sprint.end_date), scrum_master_email:sprint.scrum_master_email||"" });
    setSprintError("");
  };
  const onSaveSprint = async () => {
    setSprintError("");
    const { teamId, sprintId } = editingSprint;
    const { start_date, end_date, scrum_master_email } = editSprint;
    if (!start_date || !end_date) { setSprintError("Start and end date required."); return; }
    try {
      const res  = await apiFetch(`/api/teams/${teamId}/sprints/${sprintId}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ start_date, end_date, scrum_master_email:scrum_master_email||null }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update sprint");
      setEditingSprint(null); await loadSprints(teamId);
    } catch (e) { setSprintError(e.message); }
  };
  const onDeleteSprint = async (teamId, sprintId) => {
    if (!window.confirm("Delete this sprint?")) return;
    try {
      const res = await apiFetch(`/api/teams/${teamId}/sprints/${sprintId}`, { method:"DELETE" });
      if (!res.ok) throw new Error("Failed to delete sprint");
      await loadSprints(teamId);
    } catch (e) { setSprintError(e.message); }
  };

  const onAnalyzeSprint = async (teamId, sprint) => {
  const key = sprint.id;
  setAnalyzingSprint(p => ({ ...p, [key]: true }));
  setAnalyzeMsg(p => ({ ...p, [key]: "Starting..." }));
  try {
    await apiFetch(`/api/teams/${teamId}/sprints/${sprint.id}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const poll = setInterval(async () => {
      try {
        const st = await apiFetch(`/api/teams/${teamId}/sprints/${sprint.id}/status`).then(r => r.json());
        setAnalyzeMsg(p => ({ ...p, [key]: `Running... (${st.status})` }));
        if (st.status === "complete" || st.status === "error") {
          clearInterval(poll);
          setAnalyzingSprint(p => ({ ...p, [key]: false }));
          setAnalyzeMsg(p => ({ ...p, [key]: st.status === "complete" ? "✓ Analysis complete" : `✗ ${st.error || "Failed"}` }));
        }
      } catch {
        clearInterval(poll);
        setAnalyzingSprint(p => ({ ...p, [key]: false }));
        setAnalyzeMsg(p => ({ ...p, [key]: "✗ Status check failed" }));
      }
    }, 4000);
  } catch (e) {
    setAnalyzingSprint(p => ({ ...p, [key]: false }));
    setAnalyzeMsg(p => ({ ...p, [key]: `✗ ${e.message}` }));
  }
};

const onAnalyzeSprintAllTeams = async (sprint) => {
  const key = `all_${sprint.id}`;
  setAnalyzingSprint(p => ({ ...p, [key]: true }));
  setAnalyzeMsg(p => ({ ...p, [key]: "Starting for all teams..." }));

  try {
    // Analyse each team that has this sprint number
    const teamsToAnalyze = teams.filter(t => {
      const teamSprints = sprintsByTeam[t.id] || [];
      return teamSprints.some(s => s.sprint_number === sprint.sprint_number);
    });

    if (!teamsToAnalyze.length) {
      setAnalyzingSprint(p => ({ ...p, [key]: false }));
      setAnalyzeMsg(p => ({ ...p, [key]: "✗ No teams have this sprint number" }));
      return;
    }

    setAnalyzeMsg(p => ({ ...p, [key]: `Analysing ${teamsToAnalyze.length} team(s)...` }));

    // Kick off analysis for each team
    const sprintIds = {};
    for (const team of teamsToAnalyze) {
      const teamSprint = (sprintsByTeam[team.id] || []).find(s => s.sprint_number === sprint.sprint_number);
      if (!teamSprint) continue;
      sprintIds[team.id] = teamSprint.id;
      await apiFetch(`/api/teams/${team.id}/sprints/${teamSprint.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    }

    // Poll all teams until all complete
    let completed = 0;
    const total = Object.keys(sprintIds).length;

    const poll = setInterval(async () => {
      try {
        let done = 0;
        for (const [teamId, sprintId] of Object.entries(sprintIds)) {
          const st = await apiFetch(`/api/teams/${teamId}/sprints/${sprintId}/status`).then(r => r.json());
          if (st.status === "complete" || st.status === "error") done++;
        }
        setAnalyzeMsg(p => ({ ...p, [key]: `Analysing... (${done}/${total} complete)` }));
        if (done >= total) {
          clearInterval(poll);
          setAnalyzingSprint(p => ({ ...p, [key]: false }));
          setAnalyzeMsg(p => ({ ...p, [key]: `✓ Analysis complete for ${total} team(s)` }));
        }
      } catch {
        clearInterval(poll);
        setAnalyzingSprint(p => ({ ...p, [key]: false }));
        setAnalyzeMsg(p => ({ ...p, [key]: "✗ Status check failed" }));
      }
    }, 4000);
  } catch (e) {
    setAnalyzingSprint(p => ({ ...p, [key]: false }));
    setAnalyzeMsg(p => ({ ...p, [key]: `✗ ${e.message}` }));
  }
};

  // ── Template ──
  const validBreaks    = tplBreaks.filter(b => b.start_date && b.end_date);
  const tplAutoPreview = tplStart && tplCount > 0 && tplLength > 0
    ? generateSprints(tplStart, tplCount, tplLength, validBreaks) : [];

  const toggleTplTarget = (id) => setTplTargets(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const applyTemplate = async () => {
    setTplResult("");
    if (!tplTargets.length) { setTplResult("Select at least one team."); return; }
    let sprints = [];
    if (tplMode === "auto") {
      if (!tplStart) { setTplResult("Please set a start date."); return; }
      sprints = generateSprints(tplStart, tplCount, tplLength, validBreaks);
    } else {
      const valid = tplManual.filter(s => s.start_date && s.end_date);
      if (!valid.length) { setTplResult("Add at least one sprint with start and end dates."); return; }
      sprints = valid;
    }

    // Check if any selected teams already have sprints
    let teamsWithSprints = 0;
    for (const teamId of tplTargets) {
      try {
        const res = await apiFetch(`/api/teams/${teamId}/sprints`);
        if (res.ok) {
          const existing = await res.json();
          if (existing.length > 0) teamsWithSprints++;
        }
      } catch {}
    }

    if (teamsWithSprints > 0) {
      const confirmed = window.confirm(
        `${teamsWithSprints} team${teamsWithSprints!==1?"s":""} already ha${teamsWithSprints!==1?"ve":"s"} sprints. They will be deleted and replaced with the new schedule. Continue?`
      );
      if (!confirmed) return;
    }

    setTplApplying(true);
    let ok = 0, fail = 0;

    for (const teamId of tplTargets) {
      // Step 1: delete all existing sprints for this team
      try {
        const existing = await apiFetch(`/api/teams/${teamId}/sprints`);
        if (existing.ok) {
          const existingSprints = await existing.json();
          for (const sp of existingSprints) {
            await apiFetch(`/api/teams/${teamId}/sprints/${sp.id}`, { method:"DELETE" });
          }
        }
      } catch { /* continue even if delete fails */ }

      // Step 2: create new sprints
      for (const sp of sprints) {
        try {
          const res = await apiFetch(`/api/teams/${teamId}/sprints`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ sprint_number:sp.sprint_number, start_date:sp.start_date, end_date:sp.end_date, scrum_master_email:null }) });
          if (res.ok) ok++; else fail++;
        } catch { fail++; }
      }

      await loadSprints(teamId);
    }

    setTplApplying(false);
    setTplResult(`✓ Replaced sprints for ${tplTargets.length} team${tplTargets.length!==1?"s":""} — ${ok} sprint${ok!==1?"s":""} created.${fail ? ` (${fail} failed)` : ""}`);
  };

  // ── Role display helpers ──
  const getRoleBadges = (roleStr) => {
    return String(roleStr || "member").split(",").map(r => r.trim()).filter(Boolean).map(r => {
      if (r === "leader")       return { key:r, label:"leader",       bg:"#dbeafe", color:"#1d4ed8" };
      if (r === "scrum_master") return { key:r, label:"scrum master", bg:"#fef3c7", color:"#92400e" };
      return                           { key:r, label:"member",       bg:"#e5e7eb", color:"#374151" };
    });
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:"80px 16px", maxWidth:1000, margin:"0 auto", minHeight:"100vh", background:theme.pageBg, color:theme.text }}>
      <h1 style={{ margin:0, fontSize:22, color:theme.text }}>Setup Team</h1>
      <div style={{ color:theme.subtext, marginBottom:12 }}>Create a new project team and provide the repo and students.</div>

      {error && (
        <div style={{ background:theme.dangerBg, color:theme.dangerText, padding:10, borderRadius:8, marginBottom:12, border:`1px solid ${theme.dangerBorder}`, display:"flex", justifyContent:"space-between" }}>
          {error}
          <button onClick={() => setError("")} style={{ background:"none", border:"none", cursor:"pointer", color:theme.dangerText, fontWeight:700 }}>✕</button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
           SPRINT TEMPLATE
      ══════════════════════════════════════════════════════ */}
      <div style={{ ...cardStyle(theme), marginBottom:16, border:`1px solid ${theme.tplBorder}`, background:theme.tplBg }}>
        <div onClick={() => {
          const opening = !templateOpen;
          setTemplateOpen(opening);
          setTplResult("");
          setManagedOpenSprint(null);
          if (opening) {
            teams.forEach(t => loadSprints(t.id));
          }
        }} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}>
          <div>
            <div style={{ fontWeight:700, color:theme.text, display:"flex", alignItems:"center", gap:8 }}>
              Sprint Manager
            </div>
            <div style={{ fontSize:12, color:theme.subtext, marginTop:2 }}>
              Generate and apply identical sprint schedules to multiple teams at once
            </div>
          </div>
          <span style={{ color:theme.subtext, fontSize:16 }}>{templateOpen ? "▲" : "▼"}</span>
        </div>

        {templateOpen && (
          <div style={{ marginTop:14 }}>

            {/* Mode tabs */}
            <div style={{ display:"flex", gap:4, marginBottom:16, borderBottom:`1px solid ${theme.border}` }}>
              {[
                { key:"auto",   label:"Auto Generate" },
                { key:"manual", label:"Manual" },
                { key:"manage", label:"Sprint Management" },
              ].map(tab => (
                <button key={tab.key} onClick={() => { setTplMode(tab.key); setTplResult(""); }} style={{ padding:"8px 18px", borderRadius:"8px 8px 0 0", border:`1px solid ${theme.border}`, borderBottom: tplMode===tab.key ? "2px solid #2d5db8" : `1px solid ${theme.border}`, background: tplMode===tab.key ? theme.tabActiveBg : theme.tabInactiveBg, color: tplMode===tab.key ? theme.tabActiveText : theme.tabInactiveText, fontWeight: tplMode===tab.key ? 700 : 400, cursor:"pointer", fontSize:13, marginBottom: tplMode===tab.key ? -1 : 0 }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* AUTO mode */}
            {tplMode === "auto" && (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 120px", gap:10, marginBottom:14 }}>
                  <Field label="Start Date (first sprint begins)" theme={theme}>
                    <input type="date" value={tplStart} onChange={e => setTplStart(e.target.value)} style={inp(theme)} />
                  </Field>
                  <Field label="# of Sprints" theme={theme}>
                    <input type="number" min="1" max="20" value={tplCount} onChange={e => setTplCount(Number(e.target.value))} style={inp(theme)} />
                  </Field>
                  <Field label="Length (days)" theme={theme}>
                    <input type="number" min="1" max="90" value={tplLength} onChange={e => setTplLength(Number(e.target.value))} style={inp(theme)} />
                  </Field>
                </div>

                {/* ── Campus Break Periods ── */}
                <div style={{ marginBottom:14, background:theme.breakBg, border:`1px solid ${theme.breakBorder}`, borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13, color:theme.text }}>🗓 Campus Break Periods</div>
                      <div style={{ fontSize:12, color:theme.subtext, marginTop:2 }}>
                        Breaks are automatically skipped 
                      </div>
                    </div>
                    <button onClick={addTplBreak} style={{ ...btn({ fontSize:11, padding:"4px 10px", background:"#92400e" }) }}>+ Add Break</button>
                  </div>

                  {tplBreaks.length === 0 && (
                    <div style={{ fontSize:12, color:theme.subtext, fontStyle:"italic" }}>No breaks defined — sprints will run continuously</div>
                  )}

                  <div style={{ display:"grid", gap:6 }}>
                    {tplBreaks.map((br, i) => (
                      <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:8, alignItems:"end" }}>
                        <Field label="Break Name (e.g. Mid-Semester Break)" theme={theme}>
                          <input type="text" value={br.label} onChange={e => updateTplBreak(i,"label",e.target.value)} placeholder="e.g. Mid-Semester Break" style={inp(theme)} />
                        </Field>
                        <Field label="Break Starts" theme={theme}>
                          <input type="date" value={br.start_date} onChange={e => updateTplBreak(i,"start_date",e.target.value)} style={inp(theme)} />
                        </Field>
                        <Field label="Break Ends" theme={theme}>
                          <input type="date" value={br.end_date} onChange={e => updateTplBreak(i,"end_date",e.target.value)} style={inp(theme)} />
                        </Field>
                        <button onClick={() => removeTplBreak(i)} style={{ ...btn({ background:"#b83232", padding:"8px 10px" }) }}>✕</button>
                      </div>
                    ))}
                  </div>

                  {/* Show which breaks are valid */}
                  {validBreaks.length > 0 && (
                    <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
                      {validBreaks.map((br, i) => (
                        <span key={i} style={{ fontSize:11, padding:"2px 8px", borderRadius:999, background:"#fef3c7", color:"#92400e", border:"1px solid #fde68a", fontWeight:600 }}>
                          {br.label || "Break"}: {fmtDate(br.start_date)} – {fmtDate(br.end_date)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Auto preview */}
                {tplAutoPreview.length > 0 && (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:theme.subtext, marginBottom:6 }}>
                      Preview {validBreaks.length > 0 ? `(breaks skipped)` : ""}
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {tplAutoPreview.map(sp => (
                        <div key={sp.sprint_number} style={{ background:theme.sprintRowBg, border:`1px solid ${theme.border}`, borderRadius:8, padding:"6px 12px", fontSize:12 }}>
                          <span style={{ fontWeight:700, color:"#2d5db8" }}>S{sp.sprint_number}</span>
                          <span style={{ color:theme.subtext, marginLeft:6 }}>{fmtDate(sp.start_date)} → {fmtDate(sp.end_date)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MANAGE mode */}
            {tplMode === "manage" && (
              <div>
                <div style={{ fontSize:13, color:theme.subtext, marginBottom:14 }}>
                  View and analyse sprints across all teams. Click a sprint to see which teams have it.
                </div>

                {(() => {
                  // Build a map of sprint_number -> { teams with that sprint }
                  const sprintMap = {};
                  teams.forEach(t => {
                    (sprintsByTeam[t.id] || []).forEach(sp => {
                      const num = sp.sprint_number;
                      if (!sprintMap[num]) sprintMap[num] = [];
                      sprintMap[num].push({ team: t, sprint: sp });
                    });
                  });
                  const sprintNumbers = Object.keys(sprintMap).map(Number).sort((a,b) => a - b);

                  if (!sprintNumbers.length) {
                    return <div style={{ color:theme.subtext, fontSize:13, fontStyle:"italic" }}>No sprints found across any team. Use Auto Generate or Manual tabs to create sprints.</div>;
                  }

                  return (
                    <div style={{ display:"grid", gap:10 }}>
                      {sprintNumbers.map(num => {
                        const entries     = sprintMap[num];
                        const firstSprint = entries[0].sprint;
                        const analyzeKey  = `manage_sprint_${num}`;
                        const isOpen      = tplMode === "manage" && managedOpenSprint === num;

                        return (
                          <div key={num} style={{ border:`1px solid ${theme.border}`, borderRadius:10, overflow:"hidden" }}>

                            {/* Sprint header — clickable */}
                            <div
                              onClick={() => setManagedOpenSprint(isOpen ? null : num)}
                              style={{ padding:"12px 16px", background: darkMode ? "#1e293b" : "#f1f5f9", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}
                              onMouseEnter={e => e.currentTarget.style.background = darkMode ? "#273549" : "#e2e8f0"}
                              onMouseLeave={e => e.currentTarget.style.background = darkMode ? "#1e293b" : "#f1f5f9"}
                            >
                              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                                <div style={{ textAlign:"center", minWidth:44 }}>
                                  <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:theme.subtext }}>Sprint</div>
                                  <div style={{ fontSize:24, fontWeight:800, color:"#2d5db8", lineHeight:1 }}>{num}</div>
                                </div>
                                <div>
                                  <div style={{ fontWeight:600, fontSize:14, color:theme.text }}>
                                    {fmtDate(firstSprint.start_date)} → {fmtDate(firstSprint.end_date)}
                                  </div>
                                  <div style={{ fontSize:12, color:theme.subtext, marginTop:2 }}>
                                    {entries.length} team{entries.length !== 1 ? "s" : ""}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display:"flex", gap:6, alignItems:"center" }} onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => {
                                    if (editingSprintDates === num) {
                                      setEditingSprintDates(null);
                                    } else {
                                      setEditingSprintDates(num);
                                      setEditSprintDatesForm({
                                        start_date: firstSprint.start_date,
                                        end_date: firstSprint.end_date,
                                      });
                                    }
                                  }}
                                  style={btn({ background: editingSprintDates === num ? "#6b7280" : "#b17926", fontSize:11, padding:"5px 10px" })}
                                >
                                  {editingSprintDates === num ? "Cancel" : "Edit Dates"}
                                </button>
                                <button
                                  onClick={() => onAnalyzeSprintAllTeams(firstSprint)}
                                  disabled={!!analyzingSprint[analyzeKey] || !!analyzingSprint[`all_${firstSprint.id}`]}
                                  style={btn({ background: (analyzingSprint[analyzeKey] || analyzingSprint[`all_${firstSprint.id}`]) ? "#6b7280" : "#0369a1", fontSize:11, padding:"5px 10px", cursor: (analyzingSprint[analyzeKey] || analyzingSprint[`all_${firstSprint.id}`]) ? "not-allowed" : "pointer" })}
                                >
                                  {(analyzingSprint[analyzeKey] || analyzingSprint[`all_${firstSprint.id}`]) ? "Analysing..." : "Analyse All Teams"}
                                </button>
                                <button
                                  onClick={() => {
                                    if (managingSprintTeams === num) {
                                      setManagingSprintTeams(null);
                                    } else {
                                      setManagingSprintTeams(num);
                                      // Pre-select teams that already have this sprint
                                      const selected = {};
                                      entries.forEach(e => { selected[e.team.id] = true; });
                                      setSprintTeamEditing(selected);
                                    }
                                  }}
                                  style={btn({ background: managingSprintTeams === num ? "#6b7280" : "#2d5db8", fontSize:11, padding:"5px 10px" })}
                                >
                                  {managingSprintTeams === num ? "Cancel" : "Edit Teams"}
                                </button>
                                <span style={{ color:theme.subtext, fontSize:14 }}>{isOpen ? "▲" : "▼"}</span>
                              </div>
                            </div>

                            {/* Edit sprint dates panel */}
                            {editingSprintDates === num && (
                              <div style={{ borderTop:`1px solid ${theme.border}`, padding:"12px 16px", background: darkMode ? "#0f172a" : "#f8fafc" }}>
                                <div style={{ fontSize:13, fontWeight:600, color:theme.text, marginBottom:8 }}>
                                  Edit Sprint {num} Dates
                                </div>
                                <div style={{ fontSize:12, color:theme.subtext, marginBottom:10 }}>
                                  Updates dates for all teams that have Sprint {num}.
                                </div>
                                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:10, alignItems:"end" }}>
                                  <Field label="Start Date" theme={theme}>
                                    <input
                                      type="date"
                                      value={editSprintDatesForm.start_date}
                                      onChange={e => setEditSprintDatesForm(p => ({ ...p, start_date: e.target.value }))}
                                      style={inp(theme)}
                                    />
                                  </Field>
                                  <Field label="End Date" theme={theme}>
                                    <input
                                      type="date"
                                      value={editSprintDatesForm.end_date}
                                      onChange={e => setEditSprintDatesForm(p => ({ ...p, end_date: e.target.value }))}
                                      style={inp(theme)}
                                    />
                                  </Field>
                                  <button
                                    onClick={async () => {
                                      const { start_date, end_date } = editSprintDatesForm;
                                      if (!start_date || !end_date) { setSprintError("Both dates required."); return; }
                                      if (end_date <= start_date) { setSprintError("End date must be after start date."); return; }

                                      // Update sprint for all teams that have this sprint number
                                      for (const { team: t, sprint } of entries) {
                                        await apiFetch(`/api/teams/${t.id}/sprints/${sprint.id}`, {
                                          method: "PUT",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ start_date, end_date }),
                                        });
                                        await loadSprints(t.id);
                                      }
                                      setEditingSprintDates(null);
                                    }}
                                    style={btn({ background:"#16a34a", fontSize:12, padding:"7px 14px" })}
                                  >
                                    Save Dates
                                  </button>
                                </div>
                                {sprintError && (
                                  <div style={{ marginTop:8, fontSize:12, color:"#dc2626" }}>{sprintError}</div>
                                )}
                              </div>
                            )}

                            {/* Edit teams panel */}
                            {managingSprintTeams === num && (
                              <div style={{ borderTop:`1px solid ${theme.border}`, padding:"12px 16px", background: darkMode ? "#0f172a" : "#f8fafc" }}>
                                <div style={{ fontSize:13, fontWeight:600, color:theme.text, marginBottom:8 }}>
                                  Select which teams have Sprint {num}
                                </div>
                                <div style={{ fontSize:12, color:theme.subtext, marginBottom:10 }}>
                                  Adding a team will create Sprint {num} with the same dates. Removing will delete it.
                                </div>
                                <div style={{ display:"grid", gap:6, marginBottom:12 }}>
                                  {teams.map(t => {
                                    const selected = !!sprintTeamEditing[t.id];
                                    return (
                                      <label key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:8, border:`1px solid ${selected ? "#2d5db8" : theme.border}`, background: selected ? (darkMode ? "#1e3a5f" : "#eff6ff") : theme.sprintRowBg, cursor:"pointer", fontSize:13, color:theme.text }}>
                                        <input
                                          type="checkbox"
                                          checked={selected}
                                          onChange={() => setSprintTeamEditing(p => ({ ...p, [t.id]: !p[t.id] }))}
                                          style={{ margin:0 }}
                                        />
                                        <span style={{ fontWeight:600 }}>{t.name}</span>
                                        <span style={{ color:theme.subtext, fontSize:12 }}>({t.code})</span>
                                        {(sprintsByTeam[t.id]||[]).some(s => s.sprint_number === num) && (
                                          <span style={{ fontSize:11, background:"#dcfce7", color:"#166534", padding:"1px 6px", borderRadius:999, marginLeft:"auto" }}>Has sprint</span>
                                        )}
                                      </label>
                                    );
                                  })}
                                </div>
                                <div style={{ display:"flex", gap:8 }}>
                                  <button
                                    onClick={async () => {
                                      // For each team, add or remove sprint based on selection
                                      for (const t of teams) {
                                        const hasIt = (sprintsByTeam[t.id]||[]).find(s => s.sprint_number === num);
                                        const wants = !!sprintTeamEditing[t.id];
                                        if (wants && !hasIt) {
                                          // Add sprint to this team with same dates as firstSprint
                                          await apiFetch(`/api/teams/${t.id}/sprints`, {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                              sprint_number: num,
                                              start_date: firstSprint.start_date,
                                              end_date: firstSprint.end_date,
                                              scrum_master_email: null,
                                            }),
                                          });
                                          await loadSprints(t.id);
                                        } else if (!wants && hasIt) {
                                          // Remove sprint from this team
                                          await apiFetch(`/api/teams/${t.id}/sprints/${hasIt.id}`, { method: "DELETE" });
                                          await loadSprints(t.id);
                                        }
                                      }
                                      setManagingSprintTeams(null);
                                    }}
                                    style={btn({ background:"#16a34a", fontSize:12, padding:"7px 14px" })}
                                  >
                                    Save Team Changes
                                  </button>
                                  <button
                                    onClick={() => setManagingSprintTeams(null)}
                                    style={btn({ background:"#6b7280", fontSize:12, padding:"7px 14px" })}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}

                          
                            {/* Status message */}
                            {(analyzeMsg[`all_${firstSprint.id}`] || analyzeMsg[analyzeKey]) && (
                              <div style={{ padding:"6px 16px", background: darkMode ? "#0f172a" : "#f8fafc", fontSize:11, color: (analyzeMsg[`all_${firstSprint.id}`] || analyzeMsg[analyzeKey])?.startsWith("✓") ? "#16a34a" : (analyzeMsg[`all_${firstSprint.id}`] || analyzeMsg[analyzeKey])?.startsWith("✗") ? "#dc2626" : theme.subtext, borderTop:`1px solid ${theme.border}` }}>
                                {analyzeMsg[`all_${firstSprint.id}`] || analyzeMsg[analyzeKey]}
                              </div>
                            )}

                            {/* Expanded team list */}
                            {isOpen && (
                              <div style={{ borderTop:`1px solid ${theme.border}`, padding:"10px 14px", display:"grid", gap:8 }}>
                                {entries.map(({ team: t, sprint }) => {
                                  const isEditing = editingSprint?.teamId === t.id && editingSprint?.sprintId === sprint.id;
                                  return (
                                    <div key={t.id}>
                                      {isEditing ? (
                                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:6, alignItems:"end", background:theme.expandEditBg, borderRadius:8, padding:10, border:`1px solid ${theme.border}` }}>
                                          <Field label="Start Date" theme={theme}>
                                            <input type="date" value={editSprint.start_date} onChange={e=>setEditSprint(p=>({...p,start_date:e.target.value}))} style={inp(theme)} />
                                          </Field>
                                          <Field label="End Date" theme={theme}>
                                            <input type="date" value={editSprint.end_date} onChange={e=>setEditSprint(p=>({...p,end_date:e.target.value}))} style={inp(theme)} />
                                          </Field>
                                          <Field label="Scrum Master" theme={theme}>
                                            <select value={editSprint.scrum_master_email} onChange={e=>setEditSprint(p=>({...p,scrum_master_email:e.target.value}))} style={inp(theme)}>
                                              <option value="">— None —</option>
                                              {(t.students||[]).map(s=><option key={s.email} value={s.email}>{s.name}</option>)}
                                            </select>
                                          </Field>
                                          <div style={{ display:"flex", gap:4 }}>
                                            <button onClick={onSaveSprint} style={btn({fontSize:12,padding:"6px 10px"})}>Save</button>
                                            <button onClick={()=>setEditingSprint(null)} style={btn({background:"#6b7280",fontSize:12,padding:"6px 10px"})}>Cancel</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", alignItems:"center", gap:10, background:theme.sprintRowBg, borderRadius:8, padding:"10px 14px", border:`1px solid ${theme.border}` }}>
                                          <div>
                                            <div style={{ fontWeight:600, fontSize:13, color:theme.text }}>{t.name}</div>
                                            <div style={{ fontSize:12, color:theme.subtext }}>{t.code}</div>
                                          </div>
                                          <div>
                                            {sprint.scrum_master_name
                                              ? <span style={{ fontSize:12, fontWeight:600, color:"#92400e", background:"#fef3c7", padding:"2px 10px", borderRadius:999, border:"1px solid #fde68a" }}>{sprint.scrum_master_name}</span>
                                              : <span style={{ fontSize:12, color:theme.subtext, fontStyle:"italic" }}>No scrum master</span>}
                                          </div>
                                          <div style={{ display:"flex", gap:4, justifyContent:"flex-end" }}>
                                            <button
                                              onClick={() => onAnalyzeSprint(t.id, sprint)}
                                              disabled={!!analyzingSprint[sprint.id]}
                                              style={btn({ background: analyzingSprint[sprint.id] ? "#6b7280" : "#16a34a", fontSize:11, padding:"4px 8px", cursor: analyzingSprint[sprint.id] ? "not-allowed" : "pointer" })}
                                            >
                                              {analyzingSprint[sprint.id] ? "Analysing..." : "Analyse"}
                                            </button>
                                            <button onClick={() => onEditSprint(t.id, sprint)} style={btn({background:"#2d5db8",fontSize:11,padding:"4px 8px"})}>Edit</button>
                                            <button onClick={() => onDeleteSprint(t.id, sprint.id)} style={btn({background:"#b83232",fontSize:11,padding:"4px 8px"})}>Delete</button>
                                          </div>
                                        </div>
                                      )}
                                      {analyzeMsg[sprint.id] && (
                                        <div style={{ fontSize:11, marginTop:3, textAlign:"right", color: analyzeMsg[sprint.id]?.startsWith("✓") ? "#16a34a" : analyzeMsg[sprint.id]?.startsWith("✗") ? "#dc2626" : theme.subtext }}>
                                          {analyzeMsg[sprint.id]}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* MANUAL mode */}
            {tplMode === "manual" && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, color:theme.subtext, marginBottom:8 }}>
                  Define each sprint's exact dates — applied identically to all selected teams.
                </div>
                <div style={{ display:"grid", gap:6 }}>
                  {tplManual.map((sp, i) => (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"60px 1fr 1fr auto", gap:8, alignItems:"end", background:theme.sprintRowBg, borderRadius:8, padding:"10px 12px", border:`1px solid ${theme.border}` }}>
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontSize:9, color:theme.subtext, textTransform:"uppercase", letterSpacing:1 }}>Sprint</div>
                        <div style={{ fontWeight:800, fontSize:20, color:"#2d5db8", lineHeight:1 }}>{sp.sprint_number}</div>
                      </div>
                      <Field label="Start Date" theme={theme}>
                        <input type="date" value={sp.start_date} onChange={e => updateTplManual(i,"start_date",e.target.value)} style={inp(theme)} />
                      </Field>
                      <Field label="End Date" theme={theme}>
                        <input type="date" value={sp.end_date} onChange={e => updateTplManual(i,"end_date",e.target.value)} style={inp(theme)} />
                      </Field>
                      <button onClick={() => removeTplManualRow(i)} disabled={tplManual.length===1} style={{ ...btn({ background:"#b83232", padding:"8px 10px" }), opacity:tplManual.length===1?0.4:1 }}>✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={addTplManualRow} style={dashedBtn(theme, { marginTop:8 })}>+ Add Sprint</button>
              </div>
            )}

            {/* Team selection */}
            {teams.length > 0 && tplMode !== "manage" && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:600, color:theme.subtext, marginBottom:6, display:"flex", alignItems:"center", gap:6 }}>
                  Apply to teams
                  <button onClick={() => setTplTargets(teams.map(t => t.id))} style={{ ...btn({ fontSize:10, padding:"2px 8px", background:"#2d5db8" }) }}>All</button>
                  <button onClick={() => setTplTargets([])} style={{ ...btn({ fontSize:10, padding:"2px 8px", background:"#6b7280" }) }}>None</button>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {teams.map(t => {
                    const selected = tplTargets.includes(t.id);
                    return (
                      <button key={t.id} onClick={() => toggleTplTarget(t.id)} style={{ fontSize:12, padding:"4px 12px", borderRadius:999, cursor:"pointer", fontWeight:600, border:`1px solid ${selected?"#2d5db8":theme.border}`, background:selected?"#dbeafe":theme.card, color:selected?"#1d4ed8":theme.subtext }}>
                        {t.name} <span style={{ fontWeight:400 }}>({t.code})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Apply button */}
            {tplMode !== "manage" && <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={applyTemplate} disabled={tplApplying} style={btn({ background:"#16a34a", opacity:tplApplying?0.6:1 })}>
                {tplApplying ? "Applying…" : `Apply to ${tplTargets.length} team${tplTargets.length!==1?"s":""}`}
              </button>
              {tplResult && <span style={{ fontSize:13, color: tplResult.startsWith("✓") ? "#16a34a" : "#991b1b" }}>{tplResult}</span>}
            </div>}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          CREATE NEW TEAM
      ══════════════════════════════════════════════════════ */}
      <div style={cardStyle(theme)}>
        <div style={{ fontWeight:700, marginBottom:10, color:theme.text }}>Create New Team</div>
        <div style={{ display:"grid", gap:10, gridTemplateColumns:"1fr 1fr" }}>
          <Field label="Team Name" theme={theme}><input value={name} onChange={e => setName(e.target.value)} style={inp(theme)} /></Field>
          <Field label="Project Code" theme={theme}><input value={code} onChange={e => setCode(e.target.value)} style={inp(theme)} /></Field>
        </div>
        <div style={{ marginTop:10 }}>
          <Field label="Repository URL" theme={theme}>
            <input value={repoUrl} onChange={e => setRepoUrl(e.target.value)} placeholder="e.g. https://github.com/org/repo" style={inp(theme, { width:"100%" })} />
          </Field>
        </div>
        <div style={{ marginTop:10 }}>
          <div style={{ fontSize:12, color:theme.subtext, marginBottom:6 }}>Students</div>
          {newStudents.map((s, i) => (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr auto", gap:6, alignItems:"end", marginBottom:8 }}>
              <Field label="Name" theme={theme}><input value={s.name} onChange={e => updateNewStudent(i,"name",e.target.value)} style={inp(theme)} placeholder="John Doe" /></Field>
              <Field label="Email" theme={theme}><input value={s.email} onChange={e => updateNewStudent(i,"email",e.target.value)} style={inp(theme)} placeholder="john@example.com" /></Field>
              <Field label="GitHub" theme={theme}><input value={s.github} onChange={e => updateNewStudent(i,"github",e.target.value)} style={inp(theme)} placeholder="johndoe" /></Field>
              <Field label="Aliases (comma separated)" theme={theme}><input value={s.aliases} onChange={e => updateNewStudent(i,"aliases",e.target.value)} style={inp(theme)} placeholder="john, j.doe" /></Field>
              <button onClick={() => removeNewStudentRow(i)} disabled={newStudents.length===1} style={{ ...btn(), padding:"8px 10px", marginBottom:1 }}>✕</button>
            </div>
          ))}
          <button onClick={addNewStudentRow} style={dashedBtn(theme)}>+ Add Student</button>
        </div>
        <div style={{ marginTop:16, borderTop:`1px solid ${theme.border}`, paddingTop:14 }}>
          <div style={{ fontSize:13, fontWeight:600, color:theme.text, marginBottom:4 }}>Sprints</div>
          <div style={{ fontSize:12, color:theme.subtext, marginBottom:10 }}>Optionally define a sprint schedule now — you can also add or edit sprints after creation.</div>
          {createSprints.length > 0 && (
            <div style={{ display:"grid", gap:6, marginBottom:8 }}>
              {createSprints.map((sp, i) => (
                <div key={i} style={{ display:"grid", gridTemplateColumns:"80px 1fr 1fr auto", gap:6, alignItems:"end", background:theme.sprintRowBg, borderRadius:8, padding:"10px 12px", border:`1px solid ${theme.border}` }}>
                  <Field label="Sprint #" theme={theme}><input type="number" min="1" value={sp.sprint_number} onChange={e => updateCreateSprint(i,"sprint_number",e.target.value)} style={inp(theme)} /></Field>
                  <Field label="Start Date" theme={theme}><input type="date" value={sp.start_date} onChange={e => updateCreateSprint(i,"start_date",e.target.value)} style={inp(theme)} /></Field>
                  <Field label="End Date" theme={theme}><input type="date" value={sp.end_date} onChange={e => updateCreateSprint(i,"end_date",e.target.value)} style={inp(theme)} /></Field>
                  <button onClick={() => removeCreateSprint(i)} style={{ ...btn({ background:"#b83232", padding:"8px 10px" }), marginBottom:1 }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={addCreateSprint} style={dashedBtn(theme)}>+ Add Sprint</button>
        </div>
        <div style={{ marginTop:14 }}>
          <button onClick={onCreate} disabled={creating} style={btn()}>{creating ? "Creating…" : "Create Team"}</button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          EXISTING TEAMS
      ══════════════════════════════════════════════════════ */}
      <div style={cardStyle(theme, { marginTop:16 })}>
        <div style={{ fontWeight:700, marginBottom:8, color:theme.text }}>Existing Teams</div>
        {teams.length ? (
          <div style={{ display:"grid", gap:10 }}>
            {teams.map((t) => {
              const isExpanded = expandedId === t.id;
              const sprints    = sprintsByTeam[t.id] || [];
              return (
                <div key={t.id} style={{ border:`1px solid ${theme.border}`, borderRadius:10, overflow:"hidden", background:theme.cardAlt }}>
                  <div onClick={() => toggleExpand(t.id)} style={{ display:"grid", gridTemplateColumns:"1fr auto", alignItems:"center", gap:8, padding:"12px 14px", cursor:"pointer", transition:"background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = darkMode?"#1f2937":"#f1f5f9"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div>
                      <div style={{ fontWeight:600, color:theme.text, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        {t.name}
                        <span style={{ color:theme.subtext, fontWeight:400 }}>({t.code})</span>
                        <span style={{ fontSize:11, color:theme.subtext }}>{t.students?.length||0} student{t.students?.length!==1?"s":""}</span>
                        {sprints.length > 0 && <span style={{ fontSize:11, background:"#dbeafe", color:"#1d4ed8", padding:"1px 7px", borderRadius:999, fontWeight:600 }}>{sprints.length} sprint{sprints.length!==1?"s":""}</span>}
                      </div>
                      <div style={{ fontSize:12, color:theme.subtext, marginTop:2 }}>{t.repo?.url||"No repo set"}</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <button onClick={async e => { e.stopPropagation(); await apiFetch("/api/teams/active",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id})}); localStorage.setItem("activeTeamId",t.id); alert("Active team updated."); }} style={btn({fontSize:11,padding:"5px 9px"})}>Make Active</button>
                      <button onClick={e => { e.stopPropagation(); onDeleteTeam(t.id); }} style={btn({background:"#b83232",fontSize:11,padding:"5px 9px"})}>Delete</button>
                      <span style={{ color:theme.subtext, fontSize:16, userSelect:"none" }}>{isExpanded?"▲":"▼"}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop:`1px solid ${theme.border}`, padding:"12px 14px", display:"grid", gap:16 }}>

                      {/* Members */}
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, marginBottom:8, color:theme.expandEditText }}>Members</div>
                        <div style={{ display:"grid", gap:6 }}>
                          {(t.students||[]).map(s => {
                            const isPending = studentStatuses[t.id]?.[s.email]==="FORCE_CHANGE_PASSWORD";
                            return (
                              <div key={s.email}>
                                {editingStudent?.teamId===t.id && editingStudent?.email===s.email ? (
                                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr auto", gap:6, alignItems:"end", background:theme.expandEditBg, borderRadius:8, padding:8, border:`1px solid ${theme.border}` }}>
                                    <Field label="Name" theme={theme}><input value={editStudentName} onChange={e=>setEditStudentName(e.target.value)} style={inp(theme)} /></Field>
                                    <Field label="Email" theme={theme}><input value={editStudentEmail} onChange={e=>setEditStudentEmail(e.target.value)} style={inp(theme)} /></Field>
                                    <Field label="GitHub" theme={theme}><input value={editStudentGithub} onChange={e=>setEditStudentGithub(e.target.value)} style={inp(theme)} /></Field>
                                    <Field label="Role" theme={theme}>
                                      <select value={editStudentRole} onChange={e=>setEditStudentRole(e.target.value)} style={inp(theme)}>
                                        <option value="member">Member</option>
                                        <option value="leader">Leader</option>
                                        <option value="scrum_master">Scrum Master</option>
                                      </select>
                                    </Field>
                                    <div style={{display:"flex",gap:4}}>
                                      <button onClick={onSaveStudent} style={btn({fontSize:12,padding:"6px 10px"})}>Save</button>
                                      <button onClick={()=>setEditingStudent(null)} style={btn({background:"#6b7280",fontSize:12,padding:"6px 10px"})}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", alignItems:"center", background:theme.studentRowBg, borderRadius:8, padding:"8px 12px", border:`1px solid ${theme.border}`, opacity:isPending?0.5:1 }}>
                                    <div style={{fontSize:13}}>
                                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                        <div style={{fontWeight:600,color:theme.text}}>{s.name}</div>
                                        {getRoleBadges(s.role).map(b => (
                                          <span key={b.key} style={{ fontSize:10, padding:"2px 6px", borderRadius:999, fontWeight:600, background:b.bg, color:b.color }}>{b.label}</span>
                                        ))}
                                      </div>
                                      {isPending && <span style={{fontSize:11,fontWeight:600,color:"#f59e0b"}}>Pending setup</span>}
                                    </div>
                                    <div style={{fontSize:12,color:theme.subtext}}>{s.email}</div>
                                    <div style={{fontSize:12,color:theme.subtext}}>
                                      {s.github?<span style={{color:"#2d5db8"}}>@{s.github}</span>:<span style={{color:theme.border}}>No GitHub</span>}
                                      {s.aliases?.length>0&&<span style={{marginLeft:8,color:theme.subtext}}>alias: {Array.isArray(s.aliases)?s.aliases.join(", "):s.aliases}</span>}
                                    </div>
                                    <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                                      <button onClick={()=>onEditStudent(t.id,s)} style={btn({background:"#2d5db8",fontSize:11,padding:"4px 8px"})}>Edit</button>
                                      <button onClick={()=>onRemoveStudent(t.id,s.email)} style={btn({background:"#b83232",fontSize:11,padding:"4px 8px"})}>Remove</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {addingStudentToId===t.id ? (
                          <div style={{marginTop:8,display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:6,alignItems:"end",background:theme.expandEditBg,borderRadius:8,padding:8,border:`1px solid ${theme.border}`}}>
                            <Field label="Name" theme={theme}><input value={newStudentName} onChange={e=>setNewStudentName(e.target.value)} style={inp(theme)} placeholder="John Doe" /></Field>
                            <Field label="Email" theme={theme}><input value={newStudentEmail} onChange={e=>setNewStudentEmail(e.target.value)} style={inp(theme)} placeholder="john@example.com" /></Field>
                            <Field label="GitHub" theme={theme}><input value={newStudentGithub} onChange={e=>setNewStudentGithub(e.target.value)} style={inp(theme)} placeholder="johndoe" /></Field>
                            <div style={{display:"flex",gap:4}}>
                              <button onClick={()=>onAddStudent(t.id)} style={btn({fontSize:12,padding:"6px 10px"})}>Add</button>
                              <button onClick={()=>setAddingStudentToId(null)} style={btn({background:"#6b7280",fontSize:12,padding:"6px 10px"})}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={()=>setAddingStudentToId(t.id)} style={dashedBtn(theme,{marginTop:8})}>+ Add Student</button>
                        )}
                      </div>

                      {/* Sprints */}
                      <div style={{ borderTop:`1px solid ${theme.border}`, paddingTop:14 }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                          <div>
                            <div style={{ fontSize:13, fontWeight:600, color:theme.expandEditText }}>Sprints</div>
                            <div style={{ fontSize:12, color:theme.subtext, marginTop:2 }}>Assign sprint dates and Scrum Masters per sprint</div>
                          </div>
                          {sprints.length>0&&<span style={{fontSize:12,color:theme.subtext}}>{sprints.length} sprint{sprints.length!==1?"s":""} defined</span>}
                        </div>
                        {sprintError&&(
                          <div style={{background:theme.dangerBg,color:theme.dangerText,padding:"8px 12px",borderRadius:8,marginBottom:8,fontSize:13,border:`1px solid ${theme.dangerBorder}`,display:"flex",justifyContent:"space-between"}}>
                            {sprintError}<button onClick={()=>setSprintError("")} style={{background:"none",border:"none",cursor:"pointer",color:theme.dangerText}}>✕</button>
                          </div>
                        )}
                        <div style={{display:"grid",gap:6}}>
                          {sprints.map(sprint=>{
                            const isEditingThis=editingSprint?.teamId===t.id&&editingSprint?.sprintId===sprint.id;
                            return(
                              <div key={sprint.id}>
                                {isEditingThis?(
                                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:6,alignItems:"end",background:theme.expandEditBg,borderRadius:8,padding:10,border:`1px solid ${theme.border}`}}>
                                    <Field label="Start Date" theme={theme}><input type="date" value={editSprint.start_date} onChange={e=>setEditSprint(p=>({...p,start_date:e.target.value}))} style={inp(theme)} /></Field>
                                    <Field label="End Date" theme={theme}><input type="date" value={editSprint.end_date} onChange={e=>setEditSprint(p=>({...p,end_date:e.target.value}))} style={inp(theme)} /></Field>
                                    <Field label="Scrum Master" theme={theme}>
                                      <select value={editSprint.scrum_master_email} onChange={e=>setEditSprint(p=>({...p,scrum_master_email:e.target.value}))} style={inp(theme)}>
                                        <option value="">— None —</option>
                                        {(t.students||[]).map(s=><option key={s.email} value={s.email}>{s.name}</option>)}
                                      </select>
                                    </Field>
                                    <div style={{display:"flex",gap:4}}>
                                      <button onClick={onSaveSprint} style={btn({fontSize:12,padding:"6px 10px"})}>Save</button>
                                      <button onClick={()=>setEditingSprint(null)} style={btn({background:"#6b7280",fontSize:12,padding:"6px 10px"})}>Cancel</button>
                                    </div>
                                  </div>
                                ):(
                                  <div style={{display:"grid",gridTemplateColumns:"72px 1fr 1fr 1fr auto",alignItems:"center",gap:12,background:theme.sprintRowBg,borderRadius:8,padding:"10px 14px",border:`1px solid ${theme.border}`}}>
                                    <div style={{textAlign:"center"}}>
                                      <div style={{fontSize:9,color:theme.subtext,textTransform:"uppercase",letterSpacing:1}}>Sprint</div>
                                      <div style={{fontWeight:800,fontSize:22,color:"#2d5db8",lineHeight:1}}>{sprint.sprint_number}</div>
                                    </div>
                                    <div>
                                      <div style={{fontSize:11,color:theme.subtext,marginBottom:2}}>Starts</div>
                                      <div style={{fontWeight:600,fontSize:13,color:theme.text}}>{fmtDate(sprint.start_date)}</div>
                                    </div>
                                    <div>
                                      <div style={{fontSize:11,color:theme.subtext,marginBottom:2}}>Ends</div>
                                      <div style={{fontWeight:600,fontSize:13,color:theme.text}}>{fmtDate(sprint.end_date)}</div>
                                    </div>
                                    <div>
                                      <div style={{fontSize:11,color:theme.subtext,marginBottom:4}}>Scrum Master</div>
                                      {sprint.scrum_master_name
                                        ?<span style={{fontSize:12,fontWeight:600,color:"#92400e",background:"#fef3c7",padding:"2px 10px",borderRadius:999,border:"1px solid #fde68a"}}>{sprint.scrum_master_name}</span>
                                        :<span style={{fontSize:12,color:theme.subtext,fontStyle:"italic"}}>Unassigned</span>}
                                    </div>
                                    <div style={{display:"flex",gap:4,justifyContent:"flex-end",flexWrap:"wrap",alignItems:"center"}}>
                                      <button
                                        onClick={() => onAnalyzeSprint(t.id, sprint)}
                                        disabled={!!analyzingSprint[sprint.id]}
                                        style={btn({ background: analyzingSprint[sprint.id] ? "#6b7280" : "#16a34a", fontSize:11, padding:"4px 8px", cursor: analyzingSprint[sprint.id] ? "not-allowed" : "pointer" })}
                                      >
                                        {analyzingSprint[sprint.id] ? "Analysing..." : "Analyse This Team"}
                                      </button>
                                      
                                      <button onClick={()=>onEditSprint(t.id,sprint)} style={btn({background:"#2d5db8",fontSize:11,padding:"4px 8px"})}>Edit</button>
                                      <button onClick={()=>onDeleteSprint(t.id,sprint.id)} style={btn({background:"#b83232",fontSize:11,padding:"4px 8px"})}>Delete</button>
                                    </div>
                                    {analyzeMsg[sprint.id] && (
                                      <div style={{ fontSize:11, marginTop:4, textAlign:"right", color: analyzeMsg[sprint.id]?.startsWith("✓") ? "#16a34a" : analyzeMsg[sprint.id]?.startsWith("✗") ? "#dc2626" : theme.subtext }}>
                                        {analyzeMsg[sprint.id]}
                                      </div>
                                    )}
                                    {analyzeMsg[`all_${sprint.id}`] && (
                                      <div style={{ fontSize:11, marginTop:4, textAlign:"right", color: analyzeMsg[`all_${sprint.id}`]?.startsWith("✓") ? "#16a34a" : analyzeMsg[`all_${sprint.id}`]?.startsWith("✗") ? "#dc2626" : theme.subtext }}>
                                        {analyzeMsg[`all_${sprint.id}`]}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {addingSprintToId===t.id?(
                          <div style={{marginTop:8,background:theme.expandEditBg,borderRadius:8,padding:12,border:`1px solid ${theme.border}`}}>
                            <div style={{fontSize:13,fontWeight:600,color:theme.expandEditText,marginBottom:10}}>Add Sprint {newSprint.sprint_number||nextSprintNum(t.id)}</div>
                            <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr auto",gap:8,alignItems:"end"}}>
                              <Field label="Sprint #" theme={theme}><input type="number" min="1" value={newSprint.sprint_number} onChange={e=>setNewSprint(p=>({...p,sprint_number:e.target.value}))} style={inp(theme)} /></Field>
                              <Field label="Start Date" theme={theme}><input type="date" value={newSprint.start_date} onChange={e=>setNewSprint(p=>({...p,start_date:e.target.value}))} style={inp(theme)} /></Field>
                              <Field label="End Date" theme={theme}><input type="date" value={newSprint.end_date} onChange={e=>setNewSprint(p=>({...p,end_date:e.target.value}))} style={inp(theme)} /></Field>
                              <Field label="Scrum Master" theme={theme}>
                                <select value={newSprint.scrum_master_email} onChange={e=>setNewSprint(p=>({...p,scrum_master_email:e.target.value}))} style={inp(theme)}>
                                  <option value="">— None —</option>
                                  {(t.students||[]).map(s=><option key={s.email} value={s.email}>{s.name}</option>)}
                                </select>
                              </Field>
                              <div style={{display:"flex",gap:4}}>
                                <button onClick={()=>onAddSprint(t.id)} style={btn({fontSize:12,padding:"6px 10px"})}>Add</button>
                                <button onClick={()=>{setAddingSprintToId(null);setNewSprint({...EMPTY_SPRINT});setSprintError("");}} style={btn({background:"#6b7280",fontSize:12,padding:"6px 10px"})}>Cancel</button>
                              </div>
                            </div>
                          </div>
                        ):(
                          <button onClick={()=>{setAddingSprintToId(t.id);setNewSprint({...EMPTY_SPRINT,sprint_number:nextSprintNum(t.id)});}} style={dashedBtn(theme,{marginTop:8})}>+ Add Sprint</button>
                        )}
                      </div>

                      {/* Edit team details */}
                      <div style={{ borderTop:`1px solid ${theme.border}`, paddingTop:12 }}>
                        {editingId===t.id?(
                          <div style={{display:"grid",gap:8}}>
                            <div style={{fontSize:13,fontWeight:600,color:theme.expandEditText}}>Edit Team Details</div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                              <Field label="Team Name" theme={theme}><input value={editName} onChange={e=>setEditName(e.target.value)} style={inp(theme)} /></Field>
                              <Field label="Project Code" theme={theme}><input value={editCode} onChange={e=>setEditCode(e.target.value)} style={inp(theme)} /></Field>
                            </div>
                            <Field label="Repository URL" theme={theme}><input value={editRepo} onChange={e=>setEditRepo(e.target.value)} style={inp(theme,{width:"100%"})} /></Field>
                            <div style={{display:"flex",gap:8}}>
                              <button onClick={()=>onSaveTeam(t.id)} style={btn()}>Save</button>
                              <button onClick={()=>setEditingId(null)} style={btn({background:"#6b7280"})}>Cancel</button>
                            </div>
                          </div>
                        ):(
                          <button onClick={()=>onEditTeam(t)} style={btn({background:"#2d5db8",fontSize:12,padding:"6px 10px",width:"fit-content"})}>Edit Team Details</button>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{color:theme.subtext}}>No teams yet.</div>
        )}
      </div>
    </div>
  );
}

function normalizeRepo(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return { url, owner:parts[0]||"", repo:(parts[1]||"").replace(/\.git$/i,"") };
  } catch { return { url }; }
}
function cardStyle(theme, extra={}) {
  return { background:theme.card, border:`1px solid ${theme.border}`, borderRadius:12, padding:14, boxShadow:theme.shadow, ...extra };
}
function Field({ label, children, theme }) {
  return (
    <label style={{display:"grid",gap:4}}>
      <span style={{fontSize:12,color:theme.text}}>{label}</span>
      {children}
    </label>
  );
}
function inp(theme, extra={}) {
  return { border:`1px solid ${theme.softBorder}`, background:theme.inputBg, color:theme.text, borderRadius:10, padding:"8px 10px", fontSize:14, outline:"none", width:"100%", boxSizing:"border-box", ...extra };
}
function btn(extra={}) {
  return { background:"#1e293b", color:"#fff", border:"none", padding:"10px 14px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:600, ...extra };
}
function dashedBtn(theme, extra={}) {
  return { background:"none", border:`1px dashed ${theme.addStudentBorder}`, borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:12, color:theme.addStudentColor, width:"100%", ...extra };
}