import React, { useEffect, useMemo, useState } from "react";

const API = "http://localhost:5002";

export default function SetupTeam({ darkMode }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [csvText, setCsvText] = useState("");
  const [teams, setTeams] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [editingTeam, setEditingTeam] = useState(null);

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
      };

  const students = useMemo(() => parseCsv(csvText), [csvText]);

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

  const validateForm = () => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = "Team name is required.";
    }

    if (!code.trim()) {
      newErrors.code = "Project code is required.";
    }

    if (!repoUrl.trim()) {
      newErrors.repoUrl = "Repository URL is required.";
    } else if (!repoUrl.includes("github.com")) {
      newErrors.repoUrl = "Please enter a valid GitHub repository URL.";
    }

    if (!csvText.trim()) {
      newErrors.csvText = "Students CSV is required.";
    } else if (students.length === 0) {
      newErrors.csvText =
        "Please enter at least one valid student in the format: name,email";
    }

    const emailSet = new Set();

    students.forEach((student, index) => {
      if (!student.name?.trim()) {
        newErrors[`student-name-${index}`] = `Student ${index + 1}: name is required.`;
      }

      if (!student.email?.trim()) {
        newErrors[`student-email-${index}`] = `Student ${index + 1}: email is required.`;
      } else if (!/\S+@\S+\.\S+/.test(student.email)) {
        newErrors[`student-email-${index}`] = `Student ${index + 1}: invalid email format.`;
      } else if (emailSet.has(student.email.toLowerCase())) {
        newErrors[`student-email-${index}`] = `Student ${index + 1}: duplicate email found.`;
      } else {
        emailSet.add(student.email.toLowerCase());
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEdit = (team) => {
    setEditingTeam(team);
    setName(team.name || "");
    setCode(team.code || "");
    setRepoUrl(team.repo?.url || "");
    setCsvText(studentsToCsv(team.students || []));
    setErrors({});
    setError("");
  };

  const handleCancelEdit = () => {
    setEditingTeam(null);
    setName("");
    setCode("");
    setRepoUrl("");
    setCsvText("");
    setErrors({});
    setError("");
  };

  const onCreate = async () => {
    setError("");

    if (!validateForm()) return;

    setCreating(true);
    try {
      const body = {
        name: name.trim(),
        code: code.trim(),
        repo: normalizeRepo(repoUrl.trim()),
        students,
      };

      let res;

      if (editingTeam) {
        res = await fetch(`${API}/api/teams/${editingTeam.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`${API}/api/teams`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error ||
            `${editingTeam ? "Update" : "Create"} failed (${res.status})`
        );
      }

      await loadTeams();
      handleCancelEdit();
      alert(editingTeam ? "Team updated." : "Team created.");
    } catch (e) {
      setError(e.message || "Action failed");
    } finally {
      setCreating(false);
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
      <h1 style={{ margin: 0, fontSize: 22, color: theme.text }}>
        {editingTeam ? "Modify Group" : "Setup Team"}
      </h1>

      <div style={{ color: theme.subtext, marginBottom: 12 }}>
        {editingTeam
          ? "Update the selected group details and save your changes."
          : "Create a new project team and provide the repo and students CSV."}
      </div>

      {error && (
        <div
          style={{
            background: theme.dangerBg,
            color: theme.dangerText,
            padding: 10,
            borderRadius: 8,
            marginBottom: 12,
            border: `1px solid ${darkMode ? "#7f1d1d" : "#fecaca"}`,
          }}
        >
          {error}
        </div>
      )}

      <div style={card(theme)}>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Team Name" theme={theme}>
            <>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors((prev) => ({ ...prev, name: "" }));
                }}
                style={inp(theme, errors.name)}
              />
              {errors.name && <div style={fieldErrorStyle}>{errors.name}</div>}
            </>
          </Field>

          <Field label="Project Code" theme={theme}>
            <>
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setErrors((prev) => ({ ...prev, code: "" }));
                }}
                style={inp(theme, errors.code)}
              />
              {errors.code && <div style={fieldErrorStyle}>{errors.code}</div>}
            </>
          </Field>
        </div>

        <div style={{ marginTop: 10 }}>
          <Field label="Repository URL" theme={theme}>
            <>
              <input
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  setErrors((prev) => ({ ...prev, repoUrl: "" }));
                }}
                placeholder="e.g. https://github.com/org/repo"
                style={inp(theme, errors.repoUrl, { minWidth: 400 })}
              />
              {errors.repoUrl && <div style={fieldErrorStyle}>{errors.repoUrl}</div>}
            </>
          </Field>
        </div>

        <div style={{ marginTop: 10 }}>
          <Field label="Students CSV (name,email per line)" theme={theme}>
            <>
              <textarea
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setErrors((prev) => ({ ...prev, csvText: "" }));
                }}
                placeholder={`Example:\nAlice Smith, alice@example.com\nBob Jones, bob@example.com`}
                rows={8}
                style={inp(theme, errors.csvText, {
                  fontFamily: "monospace",
                  resize: "vertical",
                })}
              />
              {errors.csvText && <div style={fieldErrorStyle}>{errors.csvText}</div>}
            </>
          </Field>

          <div style={{ marginTop: 6, fontSize: 12, color: theme.subtext }}>
            Parsed {students.length} student{students.length !== 1 ? "s" : ""}.
          </div>

          {students.length > 0 && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                border: `1px solid ${theme.border}`,
                borderRadius: 10,
                background: theme.cardAlt,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Parsed Students</div>
              <div style={{ display: "grid", gap: 6 }}>
                {students.map((student, index) => (
                  <div
                    key={`${student.email}-${index}`}
                    style={{
                      fontSize: 13,
                      color: theme.text,
                      padding: "6px 8px",
                      borderRadius: 8,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    <div>{student.name}</div>
                    <div style={{ color: theme.subtext }}>{student.email}</div>
                    {errors[`student-name-${index}`] && (
                      <div style={fieldErrorStyle}>{errors[`student-name-${index}`]}</div>
                    )}
                    {errors[`student-email-${index}`] && (
                      <div style={fieldErrorStyle}>{errors[`student-email-${index}`]}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <button onClick={onCreate} disabled={creating} style={btn()}>
            {creating
              ? editingTeam
                ? "Updating..."
                : "Creating..."
              : editingTeam
              ? "Update Team"
              : "Create Team"}
          </button>

          {editingTeam && (
            <button
              onClick={handleCancelEdit}
              style={btn({ background: "#6b7280" })}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div style={card(theme, { marginTop: 16 })}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: theme.text }}>
          Existing Teams
        </div>

        {teams.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {teams.map((t) => (
              <div
                key={t.id}
                style={{
                  border: `1px solid ${theme.border}`,
                  background: theme.cardAlt,
                  borderRadius: 10,
                  padding: "10px 12px",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: theme.text }}>
                    {t.name}{" "}
                    <span style={{ color: theme.subtext, fontWeight: 400 }}>
                      ({t.code})
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: theme.subtext }}>
                    {t.repo?.url} • {t.students?.length || 0} students
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleEdit(t)}
                    style={btn({ background: "#2563eb" })}
                  >
                    Edit
                  </button>

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
                    style={btn()}
                  >
                    Make Active
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: theme.subtext }}>No teams yet.</div>
        )}
      </div>
    </div>
  );
}

function studentsToCsv(students = []) {
  return students.map((s) => `${s.name},${s.email}`).join("\n");
}

function parseCsv(text) {
  const rows = (text || "")
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean);

  const out = [];
  for (const r of rows) {
    const [name, email] = r.split(",").map((x) => (x || "").trim());
    if (name && email) out.push({ name, email });
  }
  return out;
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
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, color: theme.text }}>{label}</span>
      {children}
    </label>
  );
}

function inp(theme, hasError = false, extra = {}) {
  return {
    border: `1px solid ${hasError ? "#dc2626" : theme.softBorder}`,
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
    background: "#000",
    color: "#fff",
    border: "none",
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 600,
    ...extra,
  };
}

const fieldErrorStyle = {
  color: "#dc2626",
  fontSize: 12,
  marginTop: 4,
};