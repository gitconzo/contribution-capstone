import React, { useState } from "react";
import { apiFetch } from "../utils/api";

const EMPTY_STUDENT = { name: "", email: "", github: "", aliases: "" };
const EMPTY_SPRINT   = { sprint_number: "", start_date: "", end_date: "", scrum_master_email: "" };

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function generateSprints(startDate, sprintCount, sprintLengthDays) {
  const sprints = [];
  let cursor = startDate;
  for (let i = 1; i <= sprintCount; i++) {
    const end = addDays(cursor, sprintLengthDays - 1);
    sprints.push({ sprint_number: i, start_date: cursor, end_date: end, scrum_master_email: "" });
    cursor = addDays(end, 1);
  }
  return sprints;
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
  const [sprintsByTeam, setSprintsByTeam]     = useState({});
  const [addingSprintToId, setAddingSprintToId] = useState(null);
  const [newSprint, setNewSprint]             = useState({ ...EMPTY_SPRINT });
  const [editingSprint, setEditingSprint]     = useState(null);
  const [editSprint, setEditSprint]           = useState({ ...EMPTY_SPRINT });
  const [sprintError, setSprintError]         = useState("");

  // ── Global Sprint Template ──
  const [templateOpen, setTemplateOpen]   = useState(false);
  const [tplMode, setTplMode]             = useState("auto");  // "auto" | "manual"
  const [tplTargets, setTplTargets]       = useState([]);
  const [tplApplying, setTplApplying]     = useState(false);
  const [tplResult, setTplResult]         = useState("");
  // Auto mode
  const [tplStart, setTplStart]   = useState("");
  const [tplCount, setTplCount]   = useState(4);
  const [tplLength, setTplLength] = useState(21);
  // Manual mode
  const [tplManual, setTplManual] = useState([
    { sprint_number: 1, start_date: "", end_date: "" },
  ]);
  const addTplManualRow = () =>
    setTplManual(p => [...p, { sprint_number: p.length + 1, start_date: "", end_date: "" }]);
  const removeTplManualRow = (i) =>
    setTplManual(p => p.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, sprint_number: idx + 1 })));
  const updateTplManual = (i, f, v) =>
    setTplManual(p => p.map((s, idx) => idx === i ? { ...s, [f]: v } : s));

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
      };

  // ── Student row helpers ──
  const updateNewStudent = (i, f, v) =>
    setNewStudents(p => p.map((s, idx) => idx === i ? { ...s, [f]: v } : s));
  const addNewStudentRow    = () => setNewStudents(p => [...p, { ...EMPTY_STUDENT }]);
  const removeNewStudentRow = (i) => setNewStudents(p => p.filter((_, idx) => idx !== i));

  // ── Create-form sprint helpers ──
  const nextCreateSprintNum = () =>
    createSprints.length > 0 ? Math.max(...createSprints.map(s => s.sprint_number)) + 1 : 1;
  const addCreateSprint = () =>
    setCreateSprints(p => [...p, { ...EMPTY_SPRINT, sprint_number: nextCreateSprintNum() }]);
  const updateCreateSprint = (i, f, v) =>
    setCreateSprints(p => p.map((s, idx) => idx === i ? { ...s, [f]: v } : s));
  const removeCreateSprint = (i) =>
    setCreateSprints(p => p.filter((_, idx) => idx !== i));

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
    if (!name.trim() || !code.trim() || !repoUrl.trim()) {
      setError("Team Name, Project Code, and Repository URL are required."); return;
    }
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
          await apiFetch(`/api/teams/${json.id}/sprints`, {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ sprint_number: Number(sp.sprint_number), start_date: sp.start_date, end_date: sp.end_date, scrum_master_email: null }),
          });
        }
      }
      await loadTeams();
      setName(""); setCode(""); setRepoUrl(""); setNewStudents([{ ...EMPTY_STUDENT }]); setCreateSprints([]);
      alert("Team created.");
    } catch (e) { setError(e.message || "Create team failed"); }
    finally { setCreating(false); }
  };

  // ── Edit/delete team ──
  const onEditTeam = (t) => { setEditingId(t.id); setEditName(t.name); setEditCode(t.code); setEditRepo(t.repo?.url || ""); };
  const onSaveTeam = async (id) => {
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
  const nextSprintNum = (teamId) => {
    const s = sprintsByTeam[teamId] || [];
    return s.length ? Math.max(...s.map(x => x.sprint_number)) + 1 : 1;
  };
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
    setEditSprint({ sprint_number:sprint.sprint_number, start_date:sprint.start_date?.split("T")[0]||"", end_date:sprint.end_date?.split("T")[0]||"", scrum_master_email:sprint.scrum_master_email||"" });
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

  // ── Global Sprint Template: apply ──
  const tplAutoPreview = tplStart && tplCount > 0 && tplLength > 0
    ? generateSprints(tplStart, tplCount, tplLength) : [];

  const toggleTplTarget = (id) =>
    setTplTargets(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const applyTemplate = async () => {
    setTplResult("");
    if (!tplTargets.length) { setTplResult("Select at least one team."); return; }

    let sprints = [];
    if (tplMode === "auto") {
      if (!tplStart) { setTplResult("Please set a start date."); return; }
      sprints = generateSprints(tplStart, tplCount, tplLength);
    } else {
      const valid = tplManual.filter(s => s.start_date && s.end_date);
      if (!valid.length) { setTplResult("Add at least one sprint with start and end dates."); return; }
      sprints = valid;
    }

    setTplApplying(true);
    let ok = 0, fail = 0;
    for (const teamId of tplTargets) {
      for (const sp of sprints) {
        try {
          const res = await apiFetch(`/api/teams/${teamId}/sprints`, {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ sprint_number:sp.sprint_number, start_date:sp.start_date, end_date:sp.end_date, scrum_master_email:null }),
          });
          if (res.ok) ok++; else fail++;
        } catch { fail++; }
      }
      if (sprintsByTeam[teamId]) await loadSprints(teamId);
    }
    setTplApplying(false);
    setTplResult(`✓ Applied ${ok} sprint${ok!==1?"s":""} across ${tplTargets.length} team${tplTargets.length!==1?"s":""}${fail ? ` (${fail} skipped — already exist)` : ""}.`);
  };

  // ── Display helpers ──
  const getRoleBadgeStyle = (role) => {
    const base = { fontSize:10, padding:"2px 6px", borderRadius:999, fontWeight:600 };
    if (role === "leader")       return { ...base, background:"#dbeafe", color:"#1d4ed8" };
    if (role === "scrum_master") return { ...base, background:"#fef3c7", color:"#92400e" };
    return { ...base, background:"#e5e7eb", color:"#374151" };
  };
  const getRoleLabel = (role) => {
    if (role === "leader") return "leader";
    if (role === "scrum_master") return "scrum master";
    return "member";
  };
  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-AU", { day:"numeric", month:"short", year:"numeric" });
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
          ⚡ GLOBAL SPRINT TEMPLATE
      ══════════════════════════════════════════════════════ */}
      <div style={{ ...cardStyle(theme), marginBottom:16, border:`1px solid ${theme.tplBorder}`, background:theme.tplBg }}>

        {/* Header */}
        <div onClick={() => { setTemplateOpen(p => !p); setTplResult(""); }} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}>
          <div>
            <div style={{ fontWeight:700, color:theme.text, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:16 }}>⚡</span> Global Sprint Template
            </div>
            <div style={{ fontSize:12, color:theme.subtext, marginTop:2 }}>
              Generate and apply identical sprint schedules to multiple teams at once
            </div>
          </div>
          <span style={{ color:theme.subtext, fontSize:16 }}>{templateOpen ? "▲" : "▼"}</span>
        </div>

        {templateOpen && (
          <div style={{ marginTop:14 }}>

            {/* ── Mode tabs ── */}
            <div style={{ display:"flex", gap:4, marginBottom:16, borderBottom:`1px solid ${theme.border}`, paddingBottom:0 }}>
              {[
                { key:"auto",   label:"🔁 Auto Generate", desc:"Set start date + sprint length" },
                { key:"manual", label:"✏️ Manual",          desc:"Define each sprint date yourself" },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setTplMode(tab.key); setTplResult(""); }}
                  style={{
                    padding:"8px 18px",
                    borderRadius:"8px 8px 0 0",
                    border:`1px solid ${theme.border}`,
                    borderBottom: tplMode === tab.key ? `2px solid #2d5db8` : `1px solid ${theme.border}`,
                    background: tplMode === tab.key ? theme.tabActiveBg : theme.tabInactiveBg,
                    color: tplMode === tab.key ? theme.tabActiveText : theme.tabInactiveText,
                    fontWeight: tplMode === tab.key ? 700 : 400,
                    cursor:"pointer",
                    fontSize:13,
                    marginBottom: tplMode === tab.key ? -1 : 0,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── AUTO mode ── */}
            {tplMode === "auto" && (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 120px", gap:10, marginBottom:12 }}>
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

                {/* Auto preview */}
                {tplAutoPreview.length > 0 && (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:theme.subtext, marginBottom:6 }}>Preview</div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {tplAutoPreview.map(sp => (
                        <div key={sp.sprint_number} style={{ background:theme.sprintRowBg, border:`1px solid ${theme.border}`, borderRadius:8, padding:"6px 12px", fontSize:12 }}>
                          <span style={{ fontWeight:700, color:"#2d5db8" }}>S{sp.sprint_number}</span>
                          <span style={{ color:theme.subtext, marginLeft:6 }}>{formatDate(sp.start_date)} → {formatDate(sp.end_date)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── MANUAL mode ── */}
            {tplMode === "manual" && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, color:theme.subtext, marginBottom:8 }}>
                  Define each sprint's exact dates — these will be applied identically to all selected teams.
                </div>
                <div style={{ display:"grid", gap:6 }}>
                  {tplManual.map((sp, i) => (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"60px 1fr 1fr auto", gap:8, alignItems:"end", background:theme.sprintRowBg, borderRadius:8, padding:"10px 12px", border:`1px solid ${theme.border}` }}>
                      {/* Sprint # label */}
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
                      <button
                        onClick={() => removeTplManualRow(i)}
                        disabled={tplManual.length === 1}
                        style={{ ...btn({ background:"#b83232", padding:"8px 10px" }), opacity:tplManual.length===1?0.4:1 }}
                      >✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={addTplManualRow} style={dashedBtn(theme, { marginTop:8 })}>+ Add Sprint</button>
              </div>
            )}

            {/* ── Team selection (shared) ── */}
            {teams.length > 0 && (
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
                      <button
                        key={t.id}
                        onClick={() => toggleTplTarget(t.id)}
                        style={{
                          fontSize:12, padding:"4px 12px", borderRadius:999, cursor:"pointer", fontWeight:600,
                          border:`1px solid ${selected ? "#2d5db8" : theme.border}`,
                          background: selected ? "#dbeafe" : theme.card,
                          color: selected ? "#1d4ed8" : theme.subtext,
                        }}
                      >
                        {t.name} <span style={{ fontWeight:400 }}>({t.code})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Apply button ── */}
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={applyTemplate} disabled={tplApplying} style={btn({ background:"#16a34a", opacity:tplApplying?0.6:1 })}>
                {tplApplying ? "Applying…" : `Apply to ${tplTargets.length} team${tplTargets.length!==1?"s":""}`}
              </button>
              {tplResult && (
                <span style={{ fontSize:13, color: tplResult.startsWith("✓") ? "#16a34a" : theme.dangerText }}>
                  {tplResult}
                </span>
              )}
            </div>

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

        {/* Students */}
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

        {/* Sprints at creation */}
        <div style={{ marginTop:16, borderTop:`1px solid ${theme.border}`, paddingTop:14 }}>
          <div style={{ fontSize:13, fontWeight:600, color:theme.text, marginBottom:4 }}>Sprints</div>
          <div style={{ fontSize:12, color:theme.subtext, marginBottom:10 }}>
            Optionally define a sprint schedule now — you can also add or edit sprints after creation.
          </div>
          {createSprints.length > 0 && (
            <div style={{ display:"grid", gap:6, marginBottom:8 }}>
              {createSprints.map((sp, i) => (
                <div key={i} style={{ display:"grid", gridTemplateColumns:"80px 1fr 1fr auto", gap:6, alignItems:"end", background:theme.sprintRowBg, borderRadius:8, padding:"10px 12px", border:`1px solid ${theme.border}` }}>
                  <Field label="Sprint #" theme={theme}>
                    <input type="number" min="1" value={sp.sprint_number} onChange={e => updateCreateSprint(i,"sprint_number",e.target.value)} style={inp(theme)} />
                  </Field>
                  <Field label="Start Date" theme={theme}>
                    <input type="date" value={sp.start_date} onChange={e => updateCreateSprint(i,"start_date",e.target.value)} style={inp(theme)} />
                  </Field>
                  <Field label="End Date" theme={theme}>
                    <input type="date" value={sp.end_date} onChange={e => updateCreateSprint(i,"end_date",e.target.value)} style={inp(theme)} />
                  </Field>
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

                  {/* Team header */}
                  <div
                    onClick={() => toggleExpand(t.id)}
                    style={{ display:"grid", gridTemplateColumns:"1fr auto", alignItems:"center", gap:8, padding:"12px 14px", cursor:"pointer", transition:"background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = darkMode ? "#1f2937" : "#f1f5f9"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div>
                      <div style={{ fontWeight:600, color:theme.text, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        {t.name}
                        <span style={{ color:theme.subtext, fontWeight:400 }}>({t.code})</span>
                        <span style={{ fontSize:11, color:theme.subtext }}>{t.students?.length||0} student{t.students?.length!==1?"s":""}</span>
                        {sprints.length > 0 && (
                          <span style={{ fontSize:11, background:"#dbeafe", color:"#1d4ed8", padding:"1px 7px", borderRadius:999, fontWeight:600 }}>
                            {sprints.length} sprint{sprints.length!==1?"s":""}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:12, color:theme.subtext, marginTop:2 }}>{t.repo?.url||"No repo set"}</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <button onClick={async e => { e.stopPropagation(); await apiFetch("/api/teams/active",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id})}); localStorage.setItem("activeTeamId",t.id); alert("Active team updated."); }} style={btn({fontSize:11,padding:"5px 9px"})}>Make Active</button>
                      <button onClick={e => { e.stopPropagation(); onDeleteTeam(t.id); }} style={btn({background:"#b83232",fontSize:11,padding:"5px 9px"})}>Delete</button>
                      <span style={{ color:theme.subtext, fontSize:16, userSelect:"none" }}>{isExpanded?"▲":"▼"}</span>
                    </div>
                  </div>

                  {/* Expanded panel */}
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
                                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                                        <div style={{fontWeight:600,color:theme.text}}>{s.name}</div>
                                        <span style={getRoleBadgeStyle(s.role)}>{getRoleLabel(s.role)}</span>
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
                        ):(
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
                            {sprintError}
                            <button onClick={()=>setSprintError("")} style={{background:"none",border:"none",cursor:"pointer",color:theme.dangerText}}>✕</button>
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
                                      <div style={{fontWeight:600,fontSize:13,color:theme.text}}>{formatDate(sprint.start_date)}</div>
                                    </div>
                                    <div>
                                      <div style={{fontSize:11,color:theme.subtext,marginBottom:2}}>Ends</div>
                                      <div style={{fontWeight:600,fontSize:13,color:theme.text}}>{formatDate(sprint.end_date)}</div>
                                    </div>
                                    <div>
                                      <div style={{fontSize:11,color:theme.subtext,marginBottom:4}}>Scrum Master</div>
                                      {sprint.scrum_master_name
                                        ?<span style={{fontSize:12,fontWeight:600,color:"#92400e",background:"#fef3c7",padding:"2px 10px",borderRadius:999,border:"1px solid #fde68a"}}>{sprint.scrum_master_name}</span>
                                        :<span style={{fontSize:12,color:theme.subtext,fontStyle:"italic"}}>Unassigned</span>}
                                    </div>
                                    <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                                      <button onClick={()=>onEditSprint(t.id,sprint)} style={btn({background:"#2d5db8",fontSize:11,padding:"4px 8px"})}>Edit</button>
                                      <button onClick={()=>onDeleteSprint(t.id,sprint.id)} style={btn({background:"#b83232",fontSize:11,padding:"4px 8px"})}>Delete</button>
                                    </div>
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

// ── Pure helpers ──────────────────────────────────────────────────────────────
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