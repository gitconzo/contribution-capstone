import React, { useEffect, useMemo, useState } from "react";

const API = "http://localhost:5002";

export default function SetupTeam({ darkMode }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [csvText, setCsvText] = useState("");
  const [teams, setTeams] = useState([]);
  const [creating, setCreating] = useState(false);
  const [refreshingTeams, setRefreshingTeams] = useState(false);
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

  const loadTeams = async (isManualRefresh = false) => {
    setError("");
    try {
      if (isManualRefresh) setRefreshingTeams(true);

      const res = await fetch(`${API}/api/teams`);
      if (!res.ok) throw new Error(`Load teams failed (${res.status})`);
      const data = await res.json();
      setTeams(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Unable to load teams");
    } finally {
      setRefreshingTeams(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const handleRefreshTeams = async () => {
    await loadTeams(true);
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
        maxWidth: 1100,
        margin: "0 auto",
        minHeight: "100vh",
        background: theme.pageBg,
        color: theme.text,
      }}
    >
      <div style={headerCard(theme)}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: theme.text }}>
            Setup Team
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 15, color: theme.subtext }}>
            Create a project team, link the repository, and upload student members by CSV.
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: theme.dangerBg,
            color: theme.dangerText,
            padding: "12px 14px",
            borderRadius: 12,
            marginBottom: 16,
            border: `1px solid ${darkMode ? "#7f1d1d" : "#fecaca"}`,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      <div style={card(theme)}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: theme.text }}>
              Team Information
            </div>
            <div style={{ marginTop: 4, fontSize: 14, color: theme.subtext }}>
              Enter the basic project details below.
            </div>
          </div>

          <button
            onClick={handleRefreshTeams}
            disabled={refreshingTeams}
            style={iconBtn(refreshingTeams)}
            title="Refresh"
          >
            ↻
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "1fr 1fr",
            marginTop: 18,
          }}
        >
          <Field label="Team Name" theme={theme}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Team Alpha"
              style={inp(theme)}
            />
          </Field>

          <Field label="Project Code" theme={theme}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. COS40005"
              style={inp(theme)}
            />
          </Field>
        </div>

        <div style={{ marginTop: 16 }}>
          <Field label="Repository URL" theme={theme}>
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="e.g. https://github.com/org/repo"
              style={inp(theme)}
            />
          </Field>
        </div>

        <div style={{ marginTop: 24 }}>
          {sectionHeader(
            theme,
            "Team Members CSV",
            "Paste one student per line in this format: name,email"
          )}

          <div style={{ marginTop: 14 }}>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Paste team member CSV here"
              rows={8}
              style={textareaStyle(theme)}
            />
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 13,
              color: theme.subtext,
              padding: "10px 12px",
              borderRadius: 10,
              background: darkMode ? "#0b1220" : "#f9fafb",
              border: `1px solid ${theme.border}`,
            }}
          >
            Parsed {students.length} student{students.length !== 1 ? "s" : ""}.
          </div>
        </div>

        {students.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 700, color: theme.text, marginBottom: 10 }}>
              Preview
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {students.map((student, index) => (
                <div
                  key={`${student.email}-${index}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 10,
                    background: theme.cardAlt,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: theme.text }}>{student.name}</div>
                    <div style={{ fontSize: 12, color: theme.subtext }}>{student.email}</div>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: darkMode ? "#cbd5e1" : "#374151",
                      padding: "5px 10px",
                      borderRadius: 999,
                      border: `1px solid ${theme.softBorder}`,
                      background: darkMode ? "#0b1220" : "#ffffff",
                    }}
                  >
                    Student
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onCreate} disabled={creating} style={btn(creating)}>
            {creating ? "Creating..." : "Create Team"}
          </button>
        </div>
      </div>

      <div style={card(theme, { marginTop: 18 })}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: theme.text }}>
              Existing Teams
            </div>
            <div style={{ marginTop: 4, fontSize: 14, color: theme.subtext }}>
              Review teams already created in the system.
            </div>
          </div>

          <button
            onClick={handleRefreshTeams}
            disabled={refreshingTeams}
            style={iconBtn(refreshingTeams)}
            title="Refresh"
          >
            ↻
          </button>
        </div>

        {teams.length ? (
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {teams.map((t) => (
              <div
                key={t.id}
                style={{
                  border: `1px solid ${theme.border}`,
                  background: theme.cardAlt,
                  borderRadius: 14,
                  padding: "14px 16px",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: theme.text, fontSize: 15 }}>
                    {t.name}{" "}
                    <span style={{ color: theme.subtext, fontWeight: 500 }}>
                      ({t.code})
                    </span>
                  </div>

                  <div style={{ fontSize: 13, color: theme.subtext, marginTop: 4 }}>
                    {t.repo?.url || "No repository"} • {t.students?.length || 0} student
                    {(t.students?.length || 0) !== 1 ? "s" : ""}
                  </div>

                  {t.students?.length > 0 && (
                    <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                      {t.students.map((student, index) => (
                        <div
                          key={`${student.email}-${index}`}
                          style={{
                            fontSize: 13,
                            color: theme.text,
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: `1px solid ${theme.border}`,
                            background: darkMode ? "#0b1220" : "#f9fafb",
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{student.name}</div>
                          <div style={{ color: theme.subtext, fontSize: 12 }}>
                            {student.email}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "start" }}>
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
          <div style={{ color: theme.subtext, marginTop: 14 }}>No teams yet.</div>
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
    borderRadius: 16,
    padding: 18,
    boxShadow: theme.shadow,
    ...extra,
  };
}

function headerCard(theme) {
  return {
    background: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: 18,
    padding: "22px 20px",
    boxShadow: theme.shadow,
    marginBottom: 18,
  };
}

function sectionHeader(theme, title, desc) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 17, color: theme.text }}>{title}</div>
      <div style={{ marginTop: 4, fontSize: 14, color: theme.subtext }}>{desc}</div>
    </div>
  );
}

function Field({ label, children, theme }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{label}</span>
      {children}
    </label>
  );
}

function inp(theme, extra = {}) {
  return {
    border: `1px solid ${theme.softBorder}`,
    background: theme.inputBg,
    color: theme.text,
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    ...extra,
  };
}

function textareaStyle(theme) {
  return {
    border: `1px solid ${theme.softBorder}`,
    background: theme.inputBg,
    color: theme.text,
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    fontFamily: "monospace",
  };
}

function btn(disabled = false, extra = {}) {
  return {
    background: "#000",
    color: "#fff",
    border: "none",
    padding: "10px 14px",
    borderRadius: 12,
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600,
    opacity: disabled ? 0.7 : 1,
    ...extra,
  };
}

function iconBtn(disabled = false) {
  return {
    background: "#000",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
    fontSize: 16,
    fontWeight: 700,
    marginTop: 1,
  };
}
