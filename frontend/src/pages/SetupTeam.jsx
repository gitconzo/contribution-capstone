import React, { useEffect, useState } from "react";

import { apiFetch } from "../utils/api";

const EMPTY_STUDENT = { name: "", email: "", github: "", aliases: "" };

export default function SetupTeam() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [newStudents, setNewStudents] = useState([{ ...EMPTY_STUDENT }]);
  const [teams, setTeams] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Which team is expanded (shows edit panel + students)
  const [expandedId, setExpandedId] = useState(null);

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
      setTeams(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Unable to load teams");
    }
  };

  useEffect(() => { loadTeams(); }, []);

  const toggleExpand = (id) => {
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
    <div style={{ padding: "80px 16px", maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Setup Team</h1>
      <div style={{ color: "#64748b", marginBottom: 12 }}>
        Create a new project team and provide the repo + students CSV.
      </div>

      {error && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: 10, borderRadius: 8, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
          {error}
          <button onClick={() => setError("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#991b1b", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Create team form */}
      <div style={card()}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Create New Team</div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Team Name">
            <input value={name} onChange={(e) => setName(e.target.value)} style={inp()} />
          </Field>
          <Field label="Project Code">
            <input value={code} onChange={(e) => setCode(e.target.value)} style={inp()} />
          </Field>
        </div>
        <div style={{ marginTop: 10 }}>
          <Field label="Repository URL">
            <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="e.g. https://github.com/org/repo" style={inp({ width: "100%" })} />
          </Field>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: "#374151", marginBottom: 6 }}>Students</div>
          {newStudents.map((s, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 6, alignItems: "end", marginBottom: 8 }}>
              <Field label="Name">
                <input value={s.name} onChange={e => updateNewStudent(i, "name", e.target.value)} style={inp()} placeholder="John Doe" />
              </Field>
              <Field label="Email">
                <input value={s.email} onChange={e => updateNewStudent(i, "email", e.target.value)} style={inp()} placeholder="john@example.com" />
              </Field>
              <Field label="GitHub">
                <input value={s.github} onChange={e => updateNewStudent(i, "github", e.target.value)} style={inp()} placeholder="johndoe" />
              </Field>
              <Field label="Aliases (comma separated)">
                <input value={s.aliases} onChange={e => updateNewStudent(i, "aliases", e.target.value)} style={inp()} placeholder="john, j.doe" />
              </Field>
              <button onClick={() => removeNewStudentRow(i)} disabled={newStudents.length === 1}
                style={{ ...btn({ background: "#000", padding: "8px 10px" }), marginBottom: 1 }}>✕</button>
            </div>
          ))}
          <button onClick={addNewStudentRow} style={{ marginTop: 2, background: "none", border: "1px dashed #d1d5db", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "#64748b", width: "100%" }}>
            + Add Student
          </button>
        </div>
        <div style={{ marginTop: 14 }}>
          <button onClick={onCreate} disabled={creating} style={btn()}>
            {creating ? "Creating..." : "Create Team"}
          </button>
        </div>
      </div>

      {/* Teams list */}
      <div style={card({ marginTop: 16 })}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Existing Teams</div>
        {teams.length ? (
          <div style={{ display: "grid", gap: 12 }}>
            {teams.map((t) => (
              <div key={t.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px" }}>

                {/* Team header — always visible */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {t.name} <span style={{ color: "#64748b", fontWeight: 400 }}>({t.code})</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {t.repo?.url} • {t.students?.length || 0} students
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={async () => {
                      await apiFetch("/api/teams/active", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: t.id }),
                      });
                      localStorage.setItem("activeTeamId", t.id);
                      alert("Active team updated.");
                    }} style={btn({ fontSize: 12, padding: "6px 10px" })}>Make Active</button>
                    <button
                      onClick={() => toggleExpand(t.id)}
                      style={btn({ background: expandedId === t.id ? "#6b7280" : "#2563eb", fontSize: 12, padding: "6px 10px" })}
                    >
                      {expandedId === t.id ? "Close" : "Edit"}
                    </button>
                    <button onClick={() => onDeleteTeam(t.id)} style={btn({ background: "#dc2626", fontSize: 12, padding: "6px 10px" })}>Delete</button>
                  </div>
                </div>

                {/* Expanded panel — only visible when Edit is clicked */}
                {expandedId === t.id && (
                  <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 12, display: "grid", gap: 12 }}>

                    {/* Edit team details */}
                    {editingId === t.id ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Edit Team Details</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <Field label="Team Name">
                            <input value={editName} onChange={e => setEditName(e.target.value)} style={inp()} />
                          </Field>
                          <Field label="Project Code">
                            <input value={editCode} onChange={e => setEditCode(e.target.value)} style={inp()} />
                          </Field>
                        </div>
                        <Field label="Repository URL">
                          <input value={editRepo} onChange={e => setEditRepo(e.target.value)} style={inp({ width: "100%" })} />
                        </Field>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => onSaveTeam(t.id)} style={btn()}>Save</button>
                          <button onClick={() => setEditingId(null)} style={btn({ background: "#6b7280" })}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => onEditTeam(t)} style={btn({ background: "#2563eb", fontSize: 12, padding: "6px 10px", width: "fit-content" })}>
                        Edit Team Details
                      </button>
                    )}

                    {/* Students */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>
                        Students ({t.students?.length || 0})
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {(t.students || []).map(s => (
                          <div key={s.email}>
                            {editingStudent?.teamId === t.id && editingStudent?.email === s.email ? (
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 6, alignItems: "end", background: "#f0f9ff", borderRadius: 8, padding: 8 }}>
                                <Field label="Name">
                                  <input value={editStudentName} onChange={e => setEditStudentName(e.target.value)} style={inp()} />
                                </Field>
                                <Field label="Email">
                                  <input value={editStudentEmail} onChange={e => setEditStudentEmail(e.target.value)} style={inp()} />
                                </Field>
                                <Field label="GitHub">
                                  <input value={editStudentGithub} onChange={e => setEditStudentGithub(e.target.value)} style={inp()} />
                                </Field>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button onClick={onSaveStudent} style={btn({ fontSize: 12, padding: "6px 10px" })}>Save</button>
                                  <button onClick={() => setEditingStudent(null)} style={btn({ background: "#6b7280", fontSize: 12, padding: "6px 10px" })}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", background: "#f9fafb", borderRadius: 8, padding: "6px 10px" }}>
                                <div style={{ fontSize: 13 }}>
                                  <span style={{ fontWeight: 500 }}>{s.name}</span>
                                  <span style={{ color: "#64748b", marginLeft: 8 }}>{s.email}</span>
                                  {s.github && <span style={{ color: "#2563eb", marginLeft: 8 }}>@{s.github}</span>}
                                </div>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button onClick={() => onEditStudent(t.id, s)} style={btn({ background: "#2563eb", fontSize: 11, padding: "4px 8px" })}>Edit</button>
                                  <button onClick={() => onRemoveStudent(t.id, s.email)} style={btn({ background: "#dc2626", fontSize: 11, padding: "4px 8px" })}>Remove</button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Add student */}
                      {addingStudentToId === t.id ? (
                        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 6, alignItems: "end", background: "#f0fdf4", borderRadius: 8, padding: 8 }}>
                          <Field label="Name">
                            <input value={newStudentName} onChange={e => setNewStudentName(e.target.value)} style={inp()} placeholder="John Doe" />
                          </Field>
                          <Field label="Email">
                            <input value={newStudentEmail} onChange={e => setNewStudentEmail(e.target.value)} style={inp()} placeholder="john@example.com" />
                          </Field>
                          <Field label="GitHub">
                            <input value={newStudentGithub} onChange={e => setNewStudentGithub(e.target.value)} style={inp()} placeholder="johndoe" />
                          </Field>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => onAddStudent(t.id)} style={btn({ fontSize: 12, padding: "6px 10px" })}>Add</button>
                            <button onClick={() => setAddingStudentToId(null)} style={btn({ background: "#6b7280", fontSize: 12, padding: "6px 10px" })}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingStudentToId(t.id)}
                          style={{ marginTop: 8, background: "none", border: "1px dashed #d1d5db", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "#64748b", width: "100%" }}
                        >
                          + Add Student
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "#64748b" }}>No teams yet.</div>
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

function card(extra = {}) {
  return { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, boxShadow: "0 4px 12px rgba(0,0,0,.04)", ...extra };
}
function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 12, color: "#374151" }}>{label}</span>
      {children}
    </label>
  );
}
function inp(extra = {}) {
  return { border: "1px solid #d1d5db", borderRadius: 10, padding: "8px 10px", fontSize: 14, ...extra };
}
function btn(extra = {}) {
  return { background: "#000", color: "#fff", border: "none", padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontSize: 13, ...extra };
}