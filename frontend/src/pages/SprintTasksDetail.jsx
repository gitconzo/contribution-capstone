// frontend/src/pages/SprintTasksDetail.jsx
import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";

function fmtDate(d) {
  if (!d) return "—";
  const str = typeof d === "string" ? d : String(d);
  const ymd = str.split("T")[0];
  const parts = ymd.split("-");
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : ymd;
}

function priorityLabel(p) {
  return p === "high" ? "High" : p === "medium" ? "Medium" : "Low";
}
function priorityColor(p) { return p === "high" ? "#991b1b" : p === "medium" ? "#92400e" : "#166534"; }
function priorityBg(p)    { return p === "high" ? "#fee2e2" : p === "medium" ? "#fef3c7" : "#dcfce7"; }

function CollapsibleSprintCard({ sprint, tasks, currentSprintId, darkMode, theme }) {
  const isActive = currentSprintId === sprint.id;
  const [open, setOpen] = useState(isActive);

  const today    = new Date(); today.setHours(0,0,0,0);
  const isPast   = new Date(sprint.end_date   + "T12:00:00") < today;
  const isFuture = new Date(sprint.start_date + "T12:00:00") > today;
  const done     = tasks.filter(t => t.status === "complete").length;
  const total    = tasks.length;
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0;

  const byStudent = tasks.reduce((acc, t) => {
    const key = t.assigned_to_email;
    if (!acc[key]) acc[key] = { name: t.assigned_to_name || t.assigned_to_email, tasks:[] };
    acc[key].tasks.push(t);
    return acc;
  }, {});

  const sprintBorderColor = isActive ? "#6ee7b7" : theme.border;
  const sprintHeaderBg    = isActive ? (darkMode ? "#052e16" : "#f0fdf4") : theme.card;

  return (
    <div style={{ background:theme.card, border:`1px solid ${sprintBorderColor}`, borderRadius:14, overflow:"hidden", boxShadow:theme.shadow }}>
      {/* Clickable header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", background:sprintHeaderBg, border:"none", cursor:"pointer", gap:10 }}
      >
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontWeight:800, fontSize:20, color: isActive ? "#16a34a" : theme.subtext, minWidth:28 }}>{sprint.sprint_number}</span>
          <div style={{ textAlign:"left" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontWeight:700, fontSize:15, color: isActive ? (darkMode?"#86efac":"#166534") : theme.text }}>Sprint {sprint.sprint_number}</span>
              {isActive && <span style={{ fontSize:11, fontWeight:700, color:"#16a34a", background:"#dcfce7", padding:"2px 8px", borderRadius:999 }}>Active</span>}
              {isPast    && <span style={{ fontSize:11, fontWeight:600, color:theme.subtext, background:theme.progressBg, padding:"2px 8px", borderRadius:999 }}>Completed</span>}
              {isFuture  && <span style={{ fontSize:11, fontWeight:600, color:"#1d4ed8", background:"#dbeafe", padding:"2px 8px", borderRadius:999 }}>Upcoming</span>}
            </div>
            <div style={{ fontSize:12, color:theme.subtext, marginTop:2 }}>
              {fmtDate(sprint.start_date)} → {fmtDate(sprint.end_date)}
              {sprint.scrum_master_name && <span style={{ marginLeft:10 }}>SM: <strong style={{ color:theme.text }}>{sprint.scrum_master_name}</strong></span>}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          {total > 0 && (
            <>
              <span style={{ fontSize:13, color:theme.subtext }}>{done}/{total} done</span>
              <div style={{ width:100, height:8, borderRadius:999, background:theme.progressBg }}>
                <div style={{ width:`${pct}%`, height:"100%", borderRadius:999, background:"#16a34a" }}/>
              </div>
              <span style={{ fontSize:12, fontWeight:600, color:"#16a34a", minWidth:32 }}>{pct}%</span>
            </>
          )}
          <span style={{ fontSize:16, color:theme.subtext, marginLeft:4 }}>{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Collapsible body */}
      {open && (
        <div style={{ padding: total === 0 ? "14px 18px" : "12px 16px", borderTop:`1px solid ${sprintBorderColor}` }}>
          {total === 0 ? (
            <div style={{ fontSize:13, color:theme.subtext, fontStyle:"italic" }}>No tasks assigned for this sprint.</div>
          ) : (
            <div style={{ display:"grid", gap:10 }}>
              {Object.entries(byStudent).map(([email, { name, tasks: studentTasks }]) => {
                const sDone = studentTasks.filter(t => t.status === "complete").length;
                return (
                  <div key={email} style={{ border:`1px solid ${theme.border}`, borderRadius:10, overflow:"hidden" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 14px", background:theme.cardSoft, borderBottom:`1px solid ${theme.border}` }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:30, height:30, borderRadius:"50%", background:"#dbeafe", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#1d4ed8", flexShrink:0 }}>
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight:600, fontSize:14, color:theme.text }}>{name}</span>
                      </div>
                      <span style={{ fontSize:12, color:theme.subtext }}>{sDone}/{studentTasks.length} done</span>
                    </div>
                    <div>
                      {studentTasks.map((t, idx) => {
                        const isDone = t.status === "complete";
                        return (
                          <div key={t.id} style={{ padding:"10px 14px", borderBottom: idx < studentTasks.length-1 ? `1px solid ${theme.border}` : "none", opacity: isDone ? 0.75 : 1 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <div style={{ width:10, height:10, borderRadius:"50%", background: isDone ? "#16a34a" : "#fbbf24", flexShrink:0 }}/>
                              <span style={{ fontSize:14, fontWeight:600, color:theme.text, flex:1, textDecoration: isDone?"line-through":"none" }}>{t.title}</span>
                              {/* Difficulty — square corners, left border accent */}
                              <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:4, background:priorityBg(t.priority||'medium'), color:priorityColor(t.priority||'medium'), borderLeft:`3px solid ${priorityColor(t.priority||'medium')}`, flexShrink:0, letterSpacing:"0.03em" }}>{priorityLabel(t.priority||'medium')}</span>
                              {/* Status — pill with dot prefix */}
                              <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:999, background: isDone?"#166534":"#1d4ed8", color:"#fff", flexShrink:0, display:"flex", alignItems:"center", gap:4 }}>
                                <span style={{ width:6, height:6, borderRadius:"50%", background: isDone?"#86efac":"#93c5fd", flexShrink:0, display:"inline-block" }}/>
                                {isDone ? "Done" : "In Progress"}
                              </span>
                            </div>
                            {t.description && <div style={{ fontSize:12, color:theme.subtext, marginTop:5, paddingLeft:18 }}>{t.description}</div>}
                            {isDone && t.completed_at && (
                              <div style={{ fontSize:11, color:"#16a34a", marginTop:4, paddingLeft:18 }}>
                                Completed {new Date(t.completed_at).toLocaleDateString(undefined, { day:"numeric", month:"short", year:"numeric" })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SprintTasksDetail({ teamId, teamName, darkMode, onBack }) {
  const theme = darkMode
    ? { pageBg:"#0b1120", card:"#111827", cardSoft:"#0f172a", text:"#f8fafc", subtext:"#94a3b8", border:"#1f2937", progressBg:"#1f2937", buttonBg:"#111827", shadow:"0 8px 20px rgba(0,0,0,.28)" }
    : { pageBg:"#f8fafc", card:"#ffffff", cardSoft:"#f9fafb", text:"#111827", subtext:"#6b7280", border:"#e5e7eb", progressBg:"#e5e7eb", buttonBg:"#ffffff", shadow:"0 4px 12px rgba(0,0,0,.04)" };

  const [sprints,        setSprints]        = useState([]);
  const [tasksBySprintId, setTasksBySprintId] = useState({});
  const [loading,        setLoading]        = useState(true);
  const [currentSprint,  setCurrentSprint]  = useState(null);

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    Promise.all([
      apiFetch(`/api/teams/${teamId}/sprints`).then(r => r.json()).catch(() => []),
      apiFetch(`/api/teams/${teamId}/tasks`).then(r => r.json()).catch(() => []),
    ]).then(([sprintsData, tasksData]) => {
      const sprintList = Array.isArray(sprintsData) ? sprintsData : [];
      setSprints(sprintList);

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const active = sprintList.find(sp => {
        const s = new Date(sp.start_date + "T12:00:00");
        const e = new Date(sp.end_date   + "T12:00:00");
        return today >= s && today <= e;
      }) || null;
      setCurrentSprint(active);

      const grouped = {};
      (Array.isArray(tasksData) ? tasksData : []).forEach(t => {
        if (!grouped[t.sprint_id]) grouped[t.sprint_id] = [];
        grouped[t.sprint_id].push(t);
      });
      setTasksBySprintId(grouped);
    }).finally(() => setLoading(false));
  }, [teamId]);

  const totalTasks = Object.values(tasksBySprintId).flat().length;
  const totalDone  = Object.values(tasksBySprintId).flat().filter(t => t.status === "complete").length;

  return (
    <div style={{ padding:"80px 16px 40px", maxWidth:1000, margin:"0 auto", minHeight:"100vh", background:theme.pageBg, color:theme.text }}>

      {/* Back button */}
      <button onClick={onBack} style={btn(theme)}>← Back</button>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", gap:12, marginTop:12, marginBottom:20 }}>
        <div>
          <h1 style={{ margin:"0 0 4px", fontSize:22, color:theme.text }}>Sprint Tasks Overview</h1>
          <div style={{ color:theme.subtext, fontSize:13 }}>{teamName || "Team"}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ color:theme.subtext, fontSize:12 }}>Total Completion</div>
          <div style={{ fontWeight:700, fontSize:22, color:"#16a34a", lineHeight:1 }}>{totalTasks ? `${totalDone}/${totalTasks}` : "—"}</div>
          <div style={{ fontSize:12, color:theme.subtext, marginTop:2 }}>tasks done</div>
        </div>
      </div>

      {/* ── Legend ── */}
      {!loading && sprints.length > 0 && (
        <div style={{ background:theme.card, border:`1px solid ${theme.border}`, borderRadius:12, padding:"12px 16px", marginBottom:16, display:"flex", flexWrap:"wrap", gap:20 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:theme.subtext, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Task Difficulty</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {[
                { label:"Low",    desc:"Quick task",  color:"#166534", bg:"#dcfce7" },
                { label:"Medium", desc:"Regular task", color:"#92400e", bg:"#fef3c7" },
                { label:"High",   desc:"Heavy task",  color:"#991b1b", bg:"#fee2e2" },
              ].map(({ label, desc, color, bg }) => (
                <div key={label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:4, background:bg, color, borderLeft:`3px solid ${color}` }}>{label}</span>
                  <span style={{ fontSize:11, color:theme.subtext }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderLeft:`1px solid ${theme.border}`, paddingLeft:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:theme.subtext, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Task Status</div>
            <div style={{ display:"flex", gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:999, background:"#1d4ed8", color:"#fff", display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:"#93c5fd", display:"inline-block" }}/>In Progress
                </span>
                <span style={{ fontSize:11, color:theme.subtext }}>In progress</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:999, background:"#166534", color:"#fff", display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:"#86efac", display:"inline-block" }}/>Done
                </span>
                <span style={{ fontSize:11, color:theme.subtext }}>Completed</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color:theme.subtext, padding:24 }}>Loading tasks...</div>
      ) : sprints.length === 0 ? (
        <div style={{ background:theme.card, border:`1px solid ${theme.border}`, borderRadius:12, padding:24, color:theme.subtext }}>
          No sprints configured for this team yet.
        </div>
      ) : (
        <div style={{ display:"grid", gap:14 }}>
          {sprints.map(sprint => (
            <CollapsibleSprintCard
              key={sprint.id}
              sprint={sprint}
              tasks={tasksBySprintId[sprint.id] || []}
              currentSprintId={currentSprint?.id}
              darkMode={darkMode}
              theme={theme}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function btn(theme) {
  return { border:`1px solid ${theme.border}`, background:theme.buttonBg, color:theme.text, borderRadius:10, padding:"6px 10px", fontSize:12, cursor:"pointer" };
}