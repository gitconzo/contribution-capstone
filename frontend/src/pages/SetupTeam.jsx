import React, { useState } from "react";
import { apiFetch } from "../utils/api";
import SprintManager from "../components/SprintManager";

const EMPTY_STUDENT = { name: "", email: "", github: "", aliases: "" };

export default function SetupTeam({ darkMode, teams = [], onTeamsChange }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [newStudents, setNewStudents] = useState([{ ...EMPTY_STUDENT }]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Which team is expanded (shows edit panel + students)
  const [expandedId, setExpandedId] = useState(null);
  // Cognito statuses per team: { [teamId]: { [email]: status } }
  const [studentStatuses, setStudentStatuses] = useState({});

  // Edit team details state
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editRepo, setEditRepo] = useState("");

  // Add student state
  const [addingStudentToId, setAddingStudentToId] = useState(null);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentGithub, setNewStudentGithub] = useState("");

  // Edit student state
  const [editingStudent, setEditingStudent] = useState(null);
  const [editStudentName, setEditStudentName] = useState("");
  const [editStudentEmail, setEditStudentEmail] = useState("");
  const [editStudentGithub, setEditStudentGithub] = useState("");

  const theme = darkMode
    ? {
        pageBg: "#0b1120",
        card: "#111827",
        cardAlt: "#0f172a",
        text: "#f8fafc",
        subtext: "#94a3b8",
        border: "#1f2937",
        softBorder: "#334155",
        inputBg: "#0f172a",
        shadow: "0 8px 20px rgba(0,0,0,.28)",
        dangerBg: "#3f1d1d",
        dangerText: "#fecaca",
        dangerBorder: "#7f1d1d",
        expandEditBg: "#0f172a",
        expandEditText: "#94a3b8",
        studentRowBg: "#0f172a",
        addStudentBorder: "#334155",
        addStudentColor: "#94a3b8",
      }
    : {
        pageBg: "#f8fafc",
        card: "#ffffff",
        cardAlt: "#ffffff",
        text: "#111827",
        subtext: "#64748b",
        border: "#e5e7eb",
        softBorder: "#d1d5db",
        inputBg: "#ffffff",
        shadow: "0 4px 12px rgba(0,0,0,.04)",
        dangerBg: "#fee2e2",
        dangerText: "#991b1b",
        dangerBorder: "#fecaca",
        expandEditBg: "#f0f9ff",
        expandEditText: "#374151",
        studentRowBg: "#f9fafb",
        addStudentBorder: "#d1d5db",
        addStudentColor: "#64748b",
      };

  const updateNewStudent = (i, field, value) =>
    setNewStudents(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  const addNewStudentRow = () => setNewStudents(prev => [...prev, { ...EMPTY_STUDENT }]);

  const removeNewStudentRow = (i) => setNewStudents(prev => prev.filter((_, idx) => idx !== i));

  const loadTeams = async () => {
    setError("");
    try {
      const res = await apiFetch("/api/teams");
      if (!res.ok) throw new Error(`Load teams failed (${res.status})`);
      const data = await res.json();
      onTeamsChange(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Unable to load teams");
    }
  };

  const toggleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setEditingId(null);
      setEditingStudent(null);
      setAddingStudentToId(null);
    } else {
      setExpandedId(id);
      setEditingId(null);
      setEditingStudent(null);
      setAddingStudentToId(null);

      // Fetch Cognito statuses for team's students
      try {
        const res = await apiFetch(`/api/teams/${id}/student-statuses`);
        if (res.ok) {
          const statuses = await res.json();
          setStudentStatuses(prev => ({ ...prev, [id]: statuses }));
        }
      } catch (err) {
        console.error("Failed to fetch student statuses:", err);
      }
    }
  };

  // ---- Create team ----
  const onCreate = async () => {
    setError("");
    if (!name.trim() || !code.trim() || !repoUrl.trim()) {
      setError("Team Name, Project Code, and Repository URL are required.");
      return;
    }
    const validStudents = newStudents.filter(s => s.name.trim() && s.email.trim());
    if (validStudents.length === 0) {
      setError("Must include at least one student with name and email.");
      return;
    }
    setCreating(true);
    try {
      const body = {
        name: name.trim(),
        code: code.trim(),
        repo: normalizeRepo(repoUrl.trim()),
        students: validStudents.map(s => ({
          name: s.name.trim(),
          email: s.email.trim(),
          github: s.github.trim() || null,
          aliases: s.aliases.trim() ? s.aliases.split(",").map(a => a.trim()).filter(Boolean) : [],
        })),
      };
      const res = await apiFetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Create failed (${res.status})`);
      await loadTeams();
      setName(""); setCode(""); setRepoUrl(""); setNewStudents([{ ...EMPTY_STUDENT }]);
      alert("Team created.");
    } catch (e) {
      setError(e.message || "Create team failed");
    } finally {
      setCreating(false);
    }
  };

  // ---- Edit team details ----
  const onEditTeam = (t) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditCode(t.code);
    setEditRepo(t.repo?.url || "");
  };

  const onSaveTeam = async (id) => {
    try {
      const res = await apiFetch(`/api/teams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, code: editCode, repo: normalizeRepo(editRepo) }),
      });
      if (!res.ok) throw new Error("Failed to update team");
      setEditingId(null);
      await loadTeams();
    } catch (e) {
      setError(e.message);
    }
  };

  // ---- Delete team ----
  const onDeleteTeam = async (id) => {
    if (!window.confirm("Are you sure you want to delete this team?")) return;
    try {
      const res = await apiFetch(`/api/teams/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete team");
      if (expandedId === id) setExpandedId(null);
      await loadTeams();
    } catch (e) {
      setError(e.message);
    }
  };

  // ---- Add student ----
  const onAddStudent = async (teamId) => {
    if (!newStudentName.trim() || !newStudentEmail.trim()) {
      setError("Student name and email are required.");
      return;
    }
    try {
      const res = await apiFetch(`/api/teams/${teamId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newStudentName.trim(), email: newStudentEmail.trim(), github: newStudentGithub.trim() }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Failed to add student"); }
      setAddingStudentToId(null);
      setNewStudentName(""); setNewStudentEmail(""); setNewStudentGithub("");
      await loadTeams();
    } catch (e) {
      setError(e.message);
    }
  };

  // ---- Remove student ----
  const onRemoveStudent = async (teamId, email) => {
    if (!window.confirm(`Remove ${email} from team?`)) return;
    try {
      const res = await apiFetch(`/api/teams/${teamId}/students/${encodeURIComponent(email)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove student");
      await loadTeams();
    } catch (e) {
      setError(e.message);
    }
  };

  // ---- Edit student ----
  const onEditStudent = (teamId, student) => {
    setEditingStudent({ teamId, email: student.email });
    setEditStudentName(student.name);
    setEditStudentEmail(student.email);
    setEditStudentGithub(student.github || "");
  };

  const onSaveStudent = async () => {
    const { teamId, email } = editingStudent;
    try {
      const res = await apiFetch(`/api/teams/${teamId}/students/${encodeURIComponent(email)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editStudentName, email: editStudentEmail, github: editStudentGithub }),
      });
      if (!res.ok) throw new Error("Failed to update student");
      setEditingStudent(null);
      await loadTeams();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div
      style={{
        padding: "80px 16px",
        maxWidth: 1000,
        margin: "0 auto",
        minHeight: "100vh",
        background: theme.pageBg,
        color: theme.text,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 22, color: theme.text }}>Setup Team</h1>
      <div style={{ color: theme.subtext, marginBottom: 12 }}>
        Create a new project team and provide the repo and students.
      </div>

      {error && (
        <div
          style={{
            background: theme.dangerBg,
            color: theme.dangerText,
            padding: 10,
            borderRadius: 8,
            marginBottom: 12,
            border: `1px solid ${theme.dangerBorder}`,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {error}
          <button
            onClick={() => setError("")}
            style={{ background: "none", border: "none", cursor: "pointer", color: theme.dangerText, fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Create team form */}
      <div style={card(theme)}>
        <div style={{ fontWeight: 700, marginBottom: 10, color: theme.text }}>Create New Team</div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Team Name" theme={theme}>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inp(theme)} />
          </Field>
          <Field label="Project Code" theme={theme}>
            <input value={code} onChange={(e) => setCode(e.target.value)} style={inp(theme)} />
          </Field>
        </div>
        <div style={{ marginTop: 10 }}>
          <Field label="Repository URL" theme={theme}>
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="e.g. https://github.com/org/repo"
              style={inp(theme, { width: "100%" })}
            />
          </Field>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: theme.subtext, marginBottom: 6 }}>Students</div>
          {newStudents.map((s, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
                gap: 6,
                alignItems: "end",
                marginBottom: 8,
              }}
            >
              <Field label="Name" theme={theme}>
                <input
                  value={s.name}
                  onChange={e => updateNewStudent(i, "name", e.target.value)}
                  style={inp(theme)}
                  placeholder="John Doe"
                />
              </Field>
              <Field label="Email" theme={theme}>
                <input
                  value={s.email}
                  onChange={e => updateNewStudent(i, "email", e.target.value)}
                  style={inp(theme)}
                  placeholder="john@example.com"
                />
              </Field>
              <Field label="GitHub" theme={theme}>
                <input
                  value={s.github}
                  onChange={e => updateNewStudent(i, "github", e.target.value)}
                  style={inp(theme)}
                  placeholder="johndoe"
                />
              </Field>
              <Field label="Aliases (comma separated)" theme={theme}>
                <input
                  value={s.aliases}
                  onChange={e => updateNewStudent(i, "aliases", e.target.value)}
                  style={inp(theme)}
                  placeholder="john, j.doe"
                />
              </Field>
              <button
                onClick={() => removeNewStudentRow(i)}
                disabled={newStudents.length === 1}
                style={{ ...btn(), padding: "8px 10px", marginBottom: 1 }}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addNewStudentRow}
            style={{
              marginTop: 2,
              background: "none",
              border: `1px dashed ${theme.addStudentBorder}`,
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 12,
              color: theme.addStudentColor,
              width: "100%",
            }}
          >
            + Add Student
          </button>
        </div>
        <div style={{ marginTop: 14 }}>
          <button onClick={onCreate} disabled={creating} style={btn()}>
            {creating ? "Creating..." : "Create Team"}
          </button>
        </div>
      </div>
       {/* Global Sprint Management */}
      <div style={card(theme, { marginTop: 16 })}>
        <div style={{ fontWeight: 700, marginBottom: 4, color: theme.text }}>Sprint Management</div>
        <div style={{ color: theme.subtext, fontSize: 13, marginBottom: 12 }}>
          Manage sprints across all teams
        </div>
        <SprintManager teamId={null} allTeams={teams} darkMode={darkMode} globalMode />
      </div>
 
      {/* Teams list */}
      <div style={card(theme, { marginTop: 16 })}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: theme.text }}>Existing Teams</div>
        {teams.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {teams.map((t) => {
              const isExpanded = expandedId === t.id;
              return (
                <div
                  key={t.id}
                  style={{
                    border: `1px solid ${theme.border}`,
                    borderRadius: 10,
                    overflow: "hidden",
                    background: theme.cardAlt,
                  }}
                >
                  {/* Clickable team header */}
                  <div
                    onClick={() => toggleExpand(t.id)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 14px",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = darkMode ? "#1f2937" : "#f1f5f9"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
                        {t.name}{" "}
                        <span style={{ color: theme.subtext, fontWeight: 400 }}>({t.code})</span>
                        <span style={{ fontSize: 11, color: theme.subtext }}>
                          {t.students?.length || 0} student{t.students?.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: theme.subtext, marginTop: 2 }}>
                        {t.repo?.url || "No repo set"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await apiFetch("/api/teams/active", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: t.id }),
                          });
                          localStorage.setItem("activeTeamId", t.id);
                          alert("Active team updated.");
                        }}
                        style={btn({ fontSize: 11, padding: "5px 9px" })}
                      >
                        Make Active
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteTeam(t.id); }}
                        style={btn({ background: "#b83232", fontSize: 11, padding: "5px 9px" })}
                      >
                        Delete
                      </button>
                      <span style={{ color: theme.subtext, fontSize: 16, userSelect: "none" }}>
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  {/* Expanded panel */}
                  {isExpanded && (
                    <div
                      style={{
                        borderTop: `1px solid ${theme.border}`,
                        padding: "12px 14px",
                        display: "grid",
                        gap: 12,
                      }}
                    >
                      {/* Students */}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: theme.expandEditText }}>
                          Members
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          {(t.students || []).map(s => {
                            const isPending = studentStatuses[t.id]?.[s.email] === "FORCE_CHANGE_PASSWORD";
                            return (
                              <div key={s.email}>
                                {editingStudent?.teamId === t.id && editingStudent?.email === s.email ? (
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "1fr 1fr 1fr auto",
                                      gap: 6,
                                      alignItems: "end",
                                      background: theme.expandEditBg,
                                      borderRadius: 8,
                                      padding: 8,
                                      border: `1px solid ${theme.border}`,
                                    }}
                                  >
                                    <Field label="Name" theme={theme}>
                                      <input value={editStudentName} onChange={e => setEditStudentName(e.target.value)} style={inp(theme)} />
                                    </Field>
                                    <Field label="Email" theme={theme}>
                                      <input value={editStudentEmail} onChange={e => setEditStudentEmail(e.target.value)} style={inp(theme)} />
                                    </Field>
                                    <Field label="GitHub" theme={theme}>
                                      <input value={editStudentGithub} onChange={e => setEditStudentGithub(e.target.value)} style={inp(theme)} />
                                    </Field>
                                    <div style={{ display: "flex", gap: 4 }}>
                                      <button onClick={onSaveStudent} style={btn({ fontSize: 12, padding: "6px 10px" })}>Save</button>
                                      <button onClick={() => setEditingStudent(null)} style={btn({ background: "#6b7280", fontSize: 12, padding: "6px 10px" })}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "1fr 1fr 1fr auto",
                                      alignItems: "center",
                                      background: theme.studentRowBg,
                                      borderRadius: 8,
                                      padding: "8px 12px",
                                      border: `1px solid ${theme.border}`,
                                      opacity: isPending ? 0.5 : 1,
                                    }}
                                  >
                                    <div style={{ fontSize: 13 }}>
                                      <div style={{ fontWeight: 600, color: theme.text }}>{s.name}</div>
                                      {isPending && (
                                        <span style={{ fontSize: 11, fontWeight: 600, color: "#f59e0b" }}>
                                          Pending setup
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 12, color: theme.subtext }}>{s.email}</div>
                                    <div style={{ fontSize: 12, color: theme.subtext }}>
                                      {s.github ? (
                                        <span style={{ color: "#2d5db8" }}>@{s.github}</span>
                                      ) : (
                                        <span style={{ color: theme.border }}>No GitHub</span>
                                      )}
                                      {s.aliases?.length > 0 && (
                                        <span style={{ marginLeft: 8, color: theme.subtext }}>
                                          alias: {Array.isArray(s.aliases) ? s.aliases.join(", ") : s.aliases}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                      <button onClick={() => onEditStudent(t.id, s)} style={btn({ background: "#2d5db8", fontSize: 11, padding: "4px 8px" })}>Edit</button>
                                      <button onClick={() => onRemoveStudent(t.id, s.email)} style={btn({ background: "#b83232", fontSize: 11, padding: "4px 8px" })}>Remove</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Add student */}
                        {addingStudentToId === t.id ? (
                          <div
                            style={{
                              marginTop: 8,
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr 1fr auto",
                              gap: 6,
                              alignItems: "end",
                              background: theme.expandEditBg,
                              borderRadius: 8,
                              padding: 8,
                              border: `1px solid ${theme.border}`,
                            }}
                          >
                            <Field label="Name" theme={theme}>
                              <input value={newStudentName} onChange={e => setNewStudentName(e.target.value)} style={inp(theme)} placeholder="John Doe" />
                            </Field>
                            <Field label="Email" theme={theme}>
                              <input value={newStudentEmail} onChange={e => setNewStudentEmail(e.target.value)} style={inp(theme)} placeholder="john@example.com" />
                            </Field>
                            <Field label="GitHub" theme={theme}>
                              <input value={newStudentGithub} onChange={e => setNewStudentGithub(e.target.value)} style={inp(theme)} placeholder="johndoe" />
                            </Field>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={() => onAddStudent(t.id)} style={btn({ fontSize: 12, padding: "6px 10px" })}>Add</button>
                              <button onClick={() => setAddingStudentToId(null)} style={btn({ background: "#6b7280", fontSize: 12, padding: "6px 10px" })}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddingStudentToId(t.id)}
                            style={{
                              marginTop: 8,
                              background: "none",
                              border: `1px dashed ${theme.addStudentBorder}`,
                              borderRadius: 8,
                              padding: "6px 12px",
                              cursor: "pointer",
                              fontSize: 12,
                              color: theme.addStudentColor,
                              width: "100%",
                            }}
                          >
                            + Add Student
                          </button>
                        )}
                      </div>

                       

                      {/* Edit team details */}
                      <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 12 }}>
                        {editingId === t.id ? (
                          <div style={{ display: "grid", gap: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: theme.expandEditText }}>Edit Team Details</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <Field label="Team Name" theme={theme}>
                                <input value={editName} onChange={e => setEditName(e.target.value)} style={inp(theme)} />
                              </Field>
                              <Field label="Project Code" theme={theme}>
                                <input value={editCode} onChange={e => setEditCode(e.target.value)} style={inp(theme)} />
                              </Field>
                            </div>
                            <Field label="Repository URL" theme={theme}>
                              <input value={editRepo} onChange={e => setEditRepo(e.target.value)} style={inp(theme, { width: "100%" })} />
                            </Field>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button onClick={() => onSaveTeam(t.id)} style={btn()}>Save</button>
                              <button onClick={() => setEditingId(null)} style={btn({ background: "#6b7280" })}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => onEditTeam(t)}
                            style={btn({ background: "#2d5db8", fontSize: 12, padding: "6px 10px", width: "fit-content" })}
                          >
                            Edit Team Details
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: theme.subtext }}>No teams yet.</div>
        )}
      </div>
    </div>
  );
}

function normalizeRepo(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const owner = parts[0] || "";
    const repo = (parts[1] || "").replace(/\.git$/i, "");
    return { url, owner, repo };
  } catch {
    return { url };
  }
}

function card(theme, extra = {}) {
  return {
    background: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: 14,
    boxShadow: theme.shadow,
    ...extra,
  };
}

function Field({ label, children, theme }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 12, color: theme.text }}>{label}</span>
      {children}
    </label>
  );
}

function inp(theme, extra = {}) {
  return {
    border: `1px solid ${theme.softBorder}`,
    background: theme.inputBg,
    color: theme.text,
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    ...extra,
  };
}

function btn(extra = {}) {
  return {
    background: "#1e293b",
    color: "#fff",
    border: "none",
    padding: "10px 14px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    ...extra,
  };
}
