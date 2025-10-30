import React, { useEffect, useState } from "react";

const API = "http://localhost:5002";

export default function SetupTeam() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [csvText, setCsvText] = useState("");
  const [students, setStudents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const loadTeams = async () => {
    setError("");
    try {
      const res = await fetch(`${API}/api/teams`);
      if (!res.ok) throw new Error(`Load teams failed (${res.status})`);
      const data = await res.json();
      setTeams(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Unable to load teams");
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  // Parse CSV when text changes
  useEffect(() => {
    const parsed = parseCsv(csvText);
    setStudents(parsed);
  }, [csvText]);

  // Update individual student field
  const updateStudent = (index, field, value) => {
    setStudents(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Add/remove aliases
  const addAlias = (index) => {
    setStudents(prev => {
      const updated = [...prev];
      updated[index].aliases = [...(updated[index].aliases || []), ""];
      return updated;
    });
  };

  const updateAlias = (studentIndex, aliasIndex, value) => {
    setStudents(prev => {
      const updated = [...prev];
      const aliases = [...(updated[studentIndex].aliases || [])];
      aliases[aliasIndex] = value;
      updated[studentIndex].aliases = aliases;
      return updated;
    });
  };

  const removeAlias = (studentIndex, aliasIndex) => {
    setStudents(prev => {
      const updated = [...prev];
      const aliases = [...(updated[studentIndex].aliases || [])];
      aliases.splice(aliasIndex, 1);
      updated[studentIndex].aliases = aliases;
      return updated;
    });
  };

  const onCreate = async () => {
    setError("");
    if (!name.trim() || !code.trim() || !repoUrl.trim()) {
      setError("Team Name, Project Code, and Repository URL are required.");
      return;
    }
    if (students.length === 0) {
      setError("Must include at least one student.");
      return;
    }

    // Validate students have required fields
    for (const s of students) {
      if (!s.name || !s.email) {
        setError("All students must have a name and email.");
        return;
      }
    }

    setCreating(true);
    try {
      const body = {
        name: name.trim(),
        code: code.trim(),
        repo: normalizeRepo(repoUrl.trim()),
        students: students.map(s => ({
          name: s.name,
          email: s.email,
          github: s.github || null,
          aliases: (s.aliases || []).filter(a => a.trim())
        }))
      };

      const res = await fetch(`${API}/api/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Create failed (${res.status})`);

      // Refresh and clear form
      await loadTeams();
      setName("");
      setCode("");
      setRepoUrl("");
      setCsvText("");
      setStudents([]);
      alert("Team created successfully!");
    } catch (e) {
      setError(e.message || "Create team failed");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ padding: "80px 16px", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Setup Team</h1>
      <div style={{ color: "#64748b", marginBottom: 12 }}>
        Create a new project team and configure student details including GitHub usernames and aliases.
      </div>

      {error && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: 10, borderRadius: 8, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={card()}>
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
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="e.g. https://github.com/org/repo"
              style={inp({ minWidth: 400 })}
            />
          </Field>
        </div>

        <div style={{ marginTop: 10 }}>
          <Field label="Quick Import: Paste CSV (name, email per line)">
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`Example:\nAlice Smith, alice@example.com\nBob Jones, bob@example.com`}
              rows={4}
              style={inp({ fontFamily: "monospace" })}
            />
          </Field>
          <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
            Parsed {students.length} student{students.length !== 1 ? "s" : ""}.
            {students.length > 0 && " Scroll down to add GitHub usernames and aliases."}
          </div>
        </div>
      </div>

      {/* Student Details Section */}
      {students.length > 0 && (
        <div style={card({ marginTop: 16 })}>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 16 }}>
            Student Details
          </div>
          
          {students.map((student, idx) => (
            <div key={idx} style={{ 
              border: "1px solid #e5e7eb", 
              borderRadius: 10, 
              padding: 14, 
              marginBottom: 12,
              background: "#f9fafb"
            }}>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
                <Field label="Name">
                  <input 
                    value={student.name} 
                    onChange={(e) => updateStudent(idx, 'name', e.target.value)}
                    style={inp({ fontSize: 13 })} 
                  />
                </Field>
                <Field label="Email">
                  <input 
                    value={student.email} 
                    onChange={(e) => updateStudent(idx, 'email', e.target.value)}
                    style={inp({ fontSize: 13 })} 
                  />
                </Field>
                <Field label="GitHub Username (optional)">
                  <input 
                    value={student.github || ""} 
                    onChange={(e) => updateStudent(idx, 'github', e.target.value)}
                    placeholder="e.g. johndoe123"
                    style={inp({ fontSize: 13 })} 
                  />
                </Field>
              </div>

              {/* Aliases Section */}
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>
                    Aliases (name variations used in documents)
                  </label>
                  <button 
                    onClick={() => addAlias(idx)}
                    style={{ 
                      background: "#111", 
                      color: "#fff", 
                      border: "none", 
                      padding: "4px 8px", 
                      borderRadius: 6, 
                      fontSize: 11,
                      cursor: "pointer"
                    }}
                  >
                    + Add Alias
                  </button>
                </div>
                
                {(student.aliases || []).length > 0 ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    {student.aliases.map((alias, aliasIdx) => (
                      <div key={aliasIdx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          value={alias}
                          onChange={(e) => updateAlias(idx, aliasIdx, e.target.value)}
                          placeholder="e.g. John, Johnny, J. Doe"
                          style={{ ...inp({ fontSize: 12 }), flex: 1 }}
                        />
                        <button
                          onClick={() => removeAlias(idx, aliasIdx)}
                          style={{
                            background: "#dc2626",
                            color: "#fff",
                            border: "none",
                            padding: "4px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            cursor: "pointer"
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>
                    No aliases yet. Add aliases to help match names from documents.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Button */}
      {students.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button onClick={onCreate} disabled={creating} style={btn()}>
            {creating ? "Creating..." : "Create Team"}
          </button>
        </div>
      )}

      {/* Teams list */}
      <div style={card({ marginTop: 16 })}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Existing Teams</div>
        {teams.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {teams.map((t) => (
              <div
                key={t.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "10px 12px",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {t.name} <span style={{ color: "#64748b", fontWeight: 400 }}>({t.code})</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {t.repo?.url} • {t.students?.length || 0} students
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`${API}/api/teams/active`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: t.id }),
                        });
                        if (!res.ok) throw new Error("Failed to set active team");
                        alert("Active team updated.");
                      } catch (e) {
                        alert(e.message);
                      }
                    }}
                    style={btn({ background: "#111", color: "#fff" })}
                  >
                    Make Active
                  </button>
                </div>
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

function parseCsv(text) {
  const rows = (text || "").split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  const out = [];
  for (const r of rows) {
    const [name, email] = r.split(",").map((x) => (x || "").trim());
    if (name && email) out.push({ name, email, github: "", aliases: [] });
  }
  return out;
}

function normalizeRepo(url) {
  // returns {url, owner, repo} when possible
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
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
      {children}
    </label>
  );
}
function inp(extra = {}) {
  return { border: "1px solid #d1d5db", borderRadius: 10, padding: "8px 10px", fontSize: 14, ...extra };
}
function btn(extra = {}) {
  return { background: "#000", color: "#fff", border: "none", padding: "10px 14px", borderRadius: 10, cursor: "pointer", ...extra };
}