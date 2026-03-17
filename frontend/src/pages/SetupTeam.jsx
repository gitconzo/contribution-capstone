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

    setCreating(true);
    try {
      const body = {
        name: name.trim(),
        code: code.trim(),
        repo: normalizeRepo(repoUrl.trim()),
        students,
      };

      const res = await fetch(`${API}/api/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Create failed (${res.status})`);

      await loadTeams();
      setName("");
      setCode("");
      setRepoUrl("");
      setCsvText("");
      alert("Team created.");
    } catch (e) {
      setError(e.message || "Create team failed");
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
      <h1 style={{ margin: 0, fontSize: 22, color: theme.text }}>Setup Team</h1>
      <div style={{ color: theme.subtext, marginBottom: 12 }}>
        Create a new project team and provide the repo and students CSV.
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
              style={inp(theme, { minWidth: 400 })}
            />
          </Field>
        </div>

        <div style={{ marginTop: 10 }}>
          <Field label="Students CSV (name,email per line)" theme={theme}>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`Example:\nAlice Smith, alice@example.com\nBob Jones, bob@example.com`}
              rows={8}
              style={inp(theme, { fontFamily: "monospace", resize: "vertical" })}
            />
          </Field>
          <div style={{ marginTop: 6, fontSize: 12, color: theme.subtext }}>
            Parsed {students.length} student{students.length !== 1 ? "s" : ""}.
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <button onClick={onCreate} disabled={creating} style={btn()}>
            {creating ? "Creating..." : "Create Team"}
          </button>
        </div>
      </div>

      <div style={card(theme, { marginTop: 16 })}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: theme.text }}>Existing Teams</div>

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

