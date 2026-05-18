// frontend/src/pages/SprintTasksSM.jsx
import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { apiFetch } from "../utils/api";

const PRIORITY_CONFIG = {
  low:    { label: "Low",    bg: "#dcfce7", color: "#166534", border: "#86efac" },
  medium: { label: "Medium", bg: "#fef3c7", color: "#92400e", border: "#fcd34d" },
  high:   { label: "High",   bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
};

// Story points → difficulty band: 1-3 Low, 4-7 Medium, 8+ High
function priorityFromPoints(n) {
  const p = Number(n) || 0;
  if (p >= 8) return "high";
  if (p >= 4) return "medium";
  return "low";
}

function fmtDate(d) {
  if (!d) return "—";
  const str = typeof d === "string" ? d : String(d);
  const ymd = str.split("T")[0];
  const parts = ymd.split("-");
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : ymd;
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 4, background: cfg.bg, color: cfg.color, borderLeft: `3px solid ${cfg.color}` }}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const isDone = status === "complete";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: isDone ? "#166534" : "#1d4ed8", color: "#fff", display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: isDone ? "#86efac" : "#93c5fd", display: "inline-block" }} />
      {isDone ? "Done" : "In Progress"}
    </span>
  );
}

function TaskCard({ task, onEdit, onDelete, onComplete, savedUserEmail, theme }) {
  const isDone = task.status === "complete";
  const isAssigned = (task.assigned_to_email || "").toLowerCase() === (savedUserEmail || "").toLowerCase();
  const [confirming, setConfirming] = useState(false);
  const [completing, setCompleting] = useState(false);

  async function handleComplete() {
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    setCompleting(true);
    try { await onComplete(task); } finally { setCompleting(false); }
  }

  return (
    <div style={{ background: theme.card, border: `1px solid ${isDone ? "#86efac" : theme.border}`, borderRadius: 10, padding: "12px 14px", opacity: isDone ? 0.6 : 1 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ marginTop: 4, flexShrink: 0, width: 10, height: 10, borderRadius: "50%", background: isDone ? "#16a34a" : "#fbbf24" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: theme.text, textDecoration: isDone ? "line-through" : "none" }}>{task.title}</span>
            <PriorityBadge priority={task.priority || "medium"} />
            <StatusBadge status={task.status} />
          </div>
          {task.description && (
            <div style={{ fontSize: 12, color: theme.subtext, marginTop: 4 }}>{task.description}</div>
          )}
          {isDone && task.completed_at && (
            <div style={{ fontSize: 11, color: "#16a34a", marginTop: 4 }}>
              Completed {new Date(task.completed_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
          {isDone ? (
            <button disabled style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "default", display: "flex", alignItems: "center", gap: 5 }}>
              ✓ Completed
            </button>
          ) : (
            <>
              <button onClick={() => onEdit(task)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: theme.subtext, borderRadius: 4 }}><Pencil size={13} /></button>
              <button onClick={() => onDelete(task)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#ef4444", borderRadius: 4 }}><Trash2 size={13} /></button>
              {isAssigned && (
                <div style={{ display: "flex", gap: 4, alignItems: "center", marginLeft: 2 }}>
                  <button
                    onClick={handleComplete}
                    disabled={completing}
                    style={{ border: "none", background: confirming ? "#92400e" : "#1d4ed8", color: "#fff", borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: completing ? "default" : "pointer", display: "flex", alignItems: "center", gap: 5, opacity: completing ? 0.8 : 1 }}
                  >
                    {completing && <span style={{ width: 11, height: 11, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", display: "inline-block", animation: "spin 0.75s linear infinite", flexShrink: 0 }} />}
                    {completing ? "Completing…" : confirming ? "Are you sure?" : "Complete"}
                  </button>
                  {confirming && !completing && (
                    <button onClick={() => setConfirming(false)} style={{ background: "none", border: `1px solid ${theme.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 11, color: theme.subtext, cursor: "pointer" }}>
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const EMPTY_FORM = { sprint_id: "", assigned_to_email: "", title: "", description: "", story_points: 1 };

export default function SprintTasksSM({ teamId, teamStudents = [], savedUserEmail, darkMode, onBack }) {
  const theme = darkMode
    ? { pageBg: "#0b1120", card: "#111827", cardSoft: "#0f172a", text: "#f8fafc", subtext: "#94a3b8", border: "#1f2937", inputBg: "#0f172a", buttonBg: "#111827", shadow: "0 8px 20px rgba(0,0,0,.28)", progressBg: "#1f2937" }
    : { pageBg: "#f8fafc", card: "#ffffff", cardSoft: "#f9fafb", text: "#111827", subtext: "#6b7280", border: "#e5e7eb", inputBg: "#ffffff", buttonBg: "#ffffff", shadow: "0 4px 12px rgba(0,0,0,.04)", progressBg: "#e5e7eb" };

  const [sprints,         setSprints]         = useState([]);
  const [currentSprint,  setCurrentSprint]   = useState(null);
  const [selectedSprint, setSelectedSprint]  = useState(null);
  const [tasksBySprintId, setTasksBySprintId] = useState({});
  const [loading,        setLoading]         = useState(true);
  const [showForm,       setShowForm]        = useState(false);
  const [editingTask,    setEditingTask]      = useState(null);
  const [form,           setForm]            = useState({ ...EMPTY_FORM });
  const [formError,      setFormError]       = useState("");
  const [formSaving,     setFormSaving]      = useState(false);

  const loadData = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const [sprintsData, tasksData] = await Promise.all([
        apiFetch(`/api/teams/${teamId}/sprints`).then(r => r.json()).catch(() => []),
        apiFetch(`/api/teams/${teamId}/tasks`).then(r => r.json()).catch(() => []),
      ]);
      const sprintList = Array.isArray(sprintsData) ? sprintsData : [];
      setSprints(sprintList);

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const active = sprintList.find(sp => {
        const s = new Date(sp.start_date + "T12:00:00");
        const e = new Date(sp.end_date   + "T12:00:00");
        return today >= s && today <= e;
      }) || null;
      setCurrentSprint(active);
      setSelectedSprint(prev => prev || active || sprintList[sprintList.length - 1] || null);

      const grouped = {};
      (Array.isArray(tasksData) ? tasksData : []).forEach(t => {
        if (!grouped[t.sprint_id]) grouped[t.sprint_id] = [];
        grouped[t.sprint_id].push(t);
      });
      setTasksBySprintId(grouped);
    } finally { setLoading(false); }
  }, [teamId]);

  useEffect(() => { loadData(); }, [loadData]);

  function openNewForm() {
    setEditingTask(null);
    setForm({ ...EMPTY_FORM, sprint_id: String(selectedSprint?.id || ""), assigned_to_email: "" });
    setFormError("");
    setShowForm(true);
  }
  function openEditForm(task) {
    setEditingTask(task);
    setForm({ sprint_id: String(task.sprint_id), assigned_to_email: task.assigned_to_email, title: task.title, description: task.description || "", story_points: task.story_points || 1 });
    setFormError("");
    setShowForm(true);
  }
  function cancelForm() { setShowForm(false); setEditingTask(null); setFormError(""); }

  async function saveTask() {
    setFormError("");
    if (!form.sprint_id)         { setFormError("Please select a sprint."); return; }
    if (!form.assigned_to_email) { setFormError("Please assign to a student."); return; }
    if (!form.title.trim())      { setFormError("Task title is required."); return; }
    setFormSaving(true);
    try {
      const points = Math.max(1, Number(form.story_points) || 1);
      const body   = { ...form, sprint_id: Number(form.sprint_id), story_points: points, priority: priorityFromPoints(points), created_by_email: savedUserEmail, updated_by_email: savedUserEmail };
      const url    = editingTask ? `/api/teams/${teamId}/tasks/${editingTask.id}` : `/api/teams/${teamId}/tasks`;
      const method = editingTask ? "PUT" : "POST";
      const res    = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save task");
      await loadData();
      cancelForm();
    } catch (e) { setFormError(e.message); }
    finally { setFormSaving(false); }
  }

  async function deleteTask(task) {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try {
      const res = await apiFetch(`/api/teams/${teamId}/tasks/${task.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleted_by_email: savedUserEmail }) });
      if (!res.ok) { const d = await res.json(); alert(d.error || "Failed to delete"); return; }
      await loadData();
    } catch { alert("Failed to delete task"); }
  }

  async function completeTask(task) {
    try {
      const res = await apiFetch(`/api/teams/${teamId}/tasks/${task.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "complete", updated_by_email: savedUserEmail }) });
      if (!res.ok) { const d = await res.json(); alert(d.error || "Failed to complete task"); return; }
      await loadData();
    } catch { alert("Failed to complete task"); }
  }

  const selectedTasks = selectedSprint ? (tasksBySprintId[selectedSprint.id] || []) : [];

  // Group by student for the board view
  const byStudent = selectedTasks.reduce((acc, t) => {
    const key = t.assigned_to_email;
    if (!acc[key]) acc[key] = { name: t.assigned_to_name || t.assigned_to_email, email: key, tasks: [] };
    acc[key].tasks.push(t);
    return acc;
  }, {});

  const totalDone  = selectedTasks.filter(t => t.status === "complete").length;
  const totalTasks = selectedTasks.length;
  const pct        = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;

  return (
    <div style={{ padding: "80px 16px 40px", maxWidth: 1100, margin: "0 auto", minHeight: "100vh", background: theme.pageBg, color: theme.text }}>

      {/* Back */}
      <button onClick={onBack} style={btn(theme)}>← Back</button>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginTop: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, color: theme.text }}>Sprint Task Management</h1>
          <div style={{ fontSize: 13, color: theme.subtext }}>Assign and manage tasks for your team as Scrum Master</div>
        </div>
        <button
          onClick={openNewForm}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "none", background: "#2d5db8", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
        >
          <Plus size={15} /> Assign Task
        </button>
      </div>

      {loading ? (
        <div style={{ color: theme.subtext, padding: 24 }}>Loading...</div>
      ) : sprints.length === 0 ? (
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 24, color: theme.subtext }}>No sprints configured yet.</div>
      ) : (
        <>
          {/* Sprint selector tabs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
            {sprints.map(sp => {
              const isActive  = currentSprint?.id === sp.id;
              const isSelected = selectedSprint?.id === sp.id;
              const today = new Date(); today.setHours(0,0,0,0);
              const isPast = new Date(sp.end_date + "T12:00:00") < today;
              return (
                <button
                  key={sp.id}
                  onClick={() => setSelectedSprint(sp)}
                  style={{ padding: "8px 16px", borderRadius: 10, border: `2px solid ${isSelected ? "#2d5db8" : theme.border}`, background: isSelected ? "#dbeafe" : theme.card, color: isSelected ? "#1d4ed8" : theme.text, fontWeight: isSelected ? 700 : 400, cursor: "pointer", fontSize: 13 }}
                >
                  Sprint {sp.sprint_number}
                  {isActive && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "1px 6px", borderRadius: 999 }}>Active</span>}
                  {isPast && !isActive && <span style={{ marginLeft: 6, fontSize: 10, color: theme.subtext }}>✓</span>}
                </button>
              );
            })}
          </div>

          {/* Selected sprint info bar */}
          {selectedSprint && (
            <div style={{ background: currentSprint?.id === selectedSprint.id ? (darkMode ? "#052e16" : "#f0fdf4") : theme.card, border: `1px solid ${currentSprint?.id === selectedSprint.id ? "#6ee7b7" : theme.border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: currentSprint?.id === selectedSprint.id ? (darkMode ? "#86efac" : "#166534") : theme.text }}>
                  Sprint {selectedSprint.sprint_number}
                  {currentSprint?.id === selectedSprint.id && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: 999 }}>Active Sprint</span>}
                </div>
                <div style={{ fontSize: 12, color: theme.subtext, marginTop: 2 }}>
                  {fmtDate(selectedSprint.start_date)} → {fmtDate(selectedSprint.end_date)}
                  {selectedSprint.scrum_master_name && <span style={{ marginLeft: 10 }}>SM: <strong style={{ color: theme.text }}>{selectedSprint.scrum_master_name}</strong></span>}
                </div>
              </div>
              {totalTasks > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: theme.subtext }}>{totalDone}/{totalTasks} done</span>
                  <div style={{ width: 120, height: 8, borderRadius: 999, background: theme.progressBg }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "#16a34a" }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#16a34a" }}>{pct}%</span>
                </div>
              )}
            </div>
          )}

          {/* Task form */}
          {showForm && (
            <div style={{ background: darkMode ? "#0f172a" : "#f0f7ff", border: `1px solid ${theme.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: theme.text, marginBottom: 14 }}>{editingTask ? "Edit Task" : "Assign New Task"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <label style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 12, color: theme.subtext }}>Sprint</span>
                  <select value={form.sprint_id} onChange={e => setForm(p => ({ ...p, sprint_id: e.target.value }))} style={inp(theme)}>
                    <option value="">— Select Sprint —</option>
                    {sprints.map(s => <option key={s.id} value={String(s.id)}>Sprint {s.sprint_number} ({fmtDate(s.start_date)} → {fmtDate(s.end_date)})</option>)}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 12, color: theme.subtext }}>Assign to</span>
                  <select value={form.assigned_to_email} onChange={e => setForm(p => ({ ...p, assigned_to_email: e.target.value }))} style={inp(theme)}>
                    <option value="">— Select Student —</option>
                    {teamStudents.map(s => <option key={s.email} value={s.email}>{s.name}</option>)}
                  </select>
                </label>
              </div>
              <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: theme.subtext }}>Task Title</span>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Implement login page" style={inp(theme)} />
              </label>
              <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: theme.subtext }}>Description (optional)</span>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Add more details about what needs to be done..." style={{ ...inp(theme), resize: "vertical" }} />
              </label>
              <label style={{ display: "grid", gap: 6, marginBottom: 14 }}>
                <span style={{ fontSize: 12, color: theme.subtext }}>Story Points</span>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="number"
                    min={1}
                    value={form.story_points}
                    onChange={e => setForm(p => ({ ...p, story_points: e.target.value === "" ? "" : Math.max(1, Number(e.target.value)) }))}
                    style={{ ...inp(theme), width: 100 }}
                  />
                  <PriorityBadge priority={priorityFromPoints(form.story_points)} />
                  <span style={{ fontSize: 11, color: theme.subtext }}>
                    1–3 Low &nbsp;·&nbsp; 4–7 Medium &nbsp;·&nbsp; 8+ High
                  </span>
                </div>
              </label>
              {formError && <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{formError}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveTask} disabled={formSaving} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#2d5db8", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: formSaving ? 0.6 : 1 }}>
                  {formSaving ? "Saving..." : editingTask ? "Save Changes" : "Assign Task"}
                </button>
                <button onClick={cancelForm} style={{ padding: "9px 20px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.card, color: theme.text, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Task board — grouped by student */}
          {selectedTasks.length === 0 ? (
            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 32, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
              <div style={{ fontWeight: 600, color: theme.text, marginBottom: 6 }}>No tasks yet for Sprint {selectedSprint?.sprint_number}</div>
              <div style={{ fontSize: 13, color: theme.subtext, marginBottom: 16 }}>Assign tasks to team members to get started</div>
              <button onClick={openNewForm} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#2d5db8", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                + Assign First Task
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {Object.values(byStudent).map(({ name, email, tasks }) => {
                const done = tasks.filter(t => t.status === "complete").length;
                return (
                  <div key={email} style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: "hidden", boxShadow: theme.shadow }}>
                    {/* Student column header */}
                    <div style={{ padding: "12px 14px", background: darkMode ? "#0f172a" : "#f8fafc", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#1d4ed8", flexShrink: 0 }}>
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>{name}</span>
                      </div>
                      <span style={{ fontSize: 12, color: theme.subtext }}>{done}/{tasks.length}</span>
                    </div>
                    {/* Tasks in this column */}
                    <div style={{ padding: "10px 10px", display: "grid", gap: 8 }}>
                      {tasks.map(t => (
                        <TaskCard key={t.id} task={t} onEdit={openEditForm} onDelete={deleteTask} onComplete={completeTask} savedUserEmail={savedUserEmail} theme={theme} />
                      ))}
                    </div>
                    {/* Add task to this student shortcut */}
                    <div style={{ padding: "0 10px 10px" }}>
                      <button
                        onClick={() => { setForm({ ...EMPTY_FORM, sprint_id: String(selectedSprint?.id || ""), assigned_to_email: email }); setEditingTask(null); setFormError(""); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        style={{ width: "100%", padding: "7px", borderRadius: 8, border: `1px dashed ${theme.border}`, background: "none", color: theme.subtext, fontSize: 12, cursor: "pointer" }}
                      >
                        + Add task for {name.split(" ")[0]}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function btn(theme) {
  return { border: `1px solid ${theme.border}`, background: theme.buttonBg, color: theme.text, borderRadius: 10, padding: "6px 10px", fontSize: 12, cursor: "pointer" };
}
function inp(theme) {
  return { padding: "9px 11px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, fontSize: 13, width: "100%", boxSizing: "border-box", outline: "none" };
}