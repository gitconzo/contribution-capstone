// frontend/src/components/SprintManager.jsx
import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";

export default function SprintManager({ teamId, allTeams = [], darkMode, globalMode = false }) {
    const [sprints, setSprints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [analyzing, setAnalyzing] = useState({});
    const [form, setForm] = useState({ name: "", start_date: "", end_date: "" });
    const [selectedTeams, setSelectedTeams] = useState("all"); // "all" | "select"
    const [selectedTeamIds, setSelectedTeamIds] = useState([]);
    const [error, setError] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: "", start_date: "", end_date: "" });
    const [editSelectedTeams, setEditSelectedTeams] = useState("all");
    const [editSelectedTeamIds, setEditSelectedTeamIds] = useState([]);

    const theme = darkMode
        ? { card: "#111827", text: "#f8fafc", subtext: "#94a3b8", border: "#1f2937", input: "#0f172a", rowBg: "#0f172a" }
        : { card: "#ffffff", text: "#111827", subtext: "#6b7280", border: "#e5e7eb", input: "#ffffff", rowBg: "#f9fafb" };

    useEffect(() => {
        loadSprints();
    }, [teamId, globalMode]);

    async function loadSprints() {
        setLoading(true);
        try {
        const url = globalMode ? `/api/sprints` : `/api/sprints/team/${teamId}`;
        const res = await apiFetch(url);
        const data = await res.json();
        setSprints(Array.isArray(data) ? data : []);
        } catch (e) {
        setSprints([]);
        } finally {
        setLoading(false);
        }
    }

    function toggleTeamId(id) {
        setSelectedTeamIds(prev =>
        prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
        );
    }

    async function handleAdd() {
        setError("");
        if (!form.name || !form.start_date || !form.end_date) {
        setError("Name, start date and end date are required.");
        return;
        }
        if (form.start_date > form.end_date) {
        setError("Start date must be before end date.");
        return;
        }

        let team_ids;
        if (!globalMode) {
        team_ids = [teamId];
        } else if (selectedTeams === "all") {
        team_ids = allTeams.map(t => t.id);
        } else {
        if (!selectedTeamIds.length) {
            setError("Please select at least one team.");
            return;
        }
        team_ids = selectedTeamIds;
        }

        try {
        const res = await apiFetch("/api/sprints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, team_ids }),
        });
        if (!res.ok) throw new Error("Failed to create sprint");
        setForm({ name: "", start_date: "", end_date: "" });
        setSelectedTeams("all");
        setSelectedTeamIds([]);
        setAdding(false);
        loadSprints();
        } catch (e) {
        setError(e.message);
        }
    }

    async function handleDelete(sprintId) {
        if (!window.confirm("Delete this sprint and all its analysis data?")) return;
        await apiFetch(`/api/sprints/${sprintId}`, { method: "DELETE" });
        loadSprints();
    }

    function startEdit(sprint) {
        setEditingId(sprint.id);
        setEditForm({ name: sprint.name, start_date: sprint.start_date, end_date: sprint.end_date });
        const isAll = sprint.team_ids?.length === allTeams.length || !sprint.team_ids?.length;
        setEditSelectedTeams(isAll ? "all" : "select");
        setEditSelectedTeamIds(sprint.team_ids || []);
    }

    async function handleSaveEdit() {
        setError("");
        if (!editForm.name || !editForm.start_date || !editForm.end_date) {
            setError("Name, start date and end date are required.");
            return;
        }

    const team_ids = editSelectedTeams === "all"
        ? allTeams.map(t => t.id)
        : editSelectedTeamIds;

    try {
        const res = await apiFetch(`/api/sprints/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, team_ids }),
        });
        if (!res.ok) throw new Error("Failed to update sprint");
        setEditingId(null);
        loadSprints();
    } catch (e) {
        setError(e.message);
    }
    }

    async function handleAnalyze(sprint, analyzeAll = false) {
        setAnalyzing(prev => ({ ...prev, [sprint.id]: true }));
        try {
        const body = analyzeAll ? {} : { team_id: teamId };
        await apiFetch(`/api/sprints/${sprint.id}/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const poll = setInterval(async () => {
            const res = await apiFetch(`/api/sprints/${sprint.id}/status`);
            const status = await res.json();
            if (status.status === "complete" || status.status === "error") {
            clearInterval(poll);
            setAnalyzing(prev => ({ ...prev, [sprint.id]: false }));
            }
        }, 3000);
        } catch (e) {
        setAnalyzing(prev => ({ ...prev, [sprint.id]: false }));
        }
    }

    const inputStyle = {
        padding: "8px 12px",
        borderRadius: 8,
        border: `1px solid ${theme.border}`,
        background: theme.input,
        color: theme.text,
        fontSize: 14,
        width: "100%",
        boxSizing: "border-box",
    };

    const btnStyle = (bg = "#111827", disabled = false) => ({
        padding: "6px 12px",
        borderRadius: 8,
        border: `1px solid ${theme.border}`,
        background: disabled ? "#e5e7eb" : bg,
        color: disabled ? "#6b7280" : "#fff",
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 500,
    });

    const tabStyle = (active) => ({
        padding: "6px 14px",
        borderRadius: 8,
        border: `2px solid ${active ? "#111827" : theme.border}`,
        background: active ? "#111827" : "transparent",
        color: active ? "#fff" : theme.text,
        fontSize: 13,
        cursor: "pointer",
        fontWeight: active ? 600 : 400,
    });

    return (
        <div style={{ marginTop: 8 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>
                {globalMode ? "All Sprints" : "Sprints"}
            </div>
            <div style={{ fontSize: 13, color: theme.subtext }}>
                {globalMode
                ? "Manage sprint periods across all teams"
                : "Manage sprint periods for date-range analysis"}
            </div>
            </div>
            <button
            onClick={() => { setAdding(v => !v); setError(""); }}
            style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: "#111827",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
            }}
            >
            {adding ? "Cancel" : "+ Add Sprint"}
            </button>
        </div>

        {/* Add sprint form */}
        {adding && (
            <div style={{
            background: theme.card,
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            }}>
            {/* Sprint details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                <div style={{ fontSize: 12, color: theme.subtext, marginBottom: 4 }}>Sprint Name</div>
                <input
                    style={inputStyle}
                    placeholder="e.g. Sprint 1"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
                </div>
                <div>
                <div style={{ fontSize: 12, color: theme.subtext, marginBottom: 4 }}>Start Date</div>
                <input
                    type="date"
                    style={inputStyle}
                    value={form.start_date}
                    onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                />
                </div>
                <div>
                <div style={{ fontSize: 12, color: theme.subtext, marginBottom: 4 }}>End Date</div>
                <input
                    type="date"
                    style={inputStyle}
                    value={form.end_date}
                    onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                />
                </div>
            </div>

            {/* Team selection — global mode only */}
            {globalMode && (
                <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: theme.subtext, marginBottom: 6 }}>Apply To</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <button onClick={() => setSelectedTeams("all")} style={tabStyle(selectedTeams === "all")}>
                    All Teams
                    </button>
                    <button onClick={() => setSelectedTeams("select")} style={tabStyle(selectedTeams === "select")}>
                    Select Teams
                    </button>
                </div>

                {selectedTeams === "select" && (
                    <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
                        <button
                        onClick={() => setSelectedTeamIds(allTeams.map(t => t.id))}
                        style={{ fontSize: 12, background: "none", border: "none", cursor: "pointer", color: theme.subtext, padding: 0, textDecoration: "underline" }}
                        >
                        Select all
                        </button>
                        <button
                        onClick={() => setSelectedTeamIds([])}
                        style={{ fontSize: 12, background: "none", border: "none", cursor: "pointer", color: theme.subtext, padding: 0, textDecoration: "underline" }}
                        >
                        Clear
                        </button>
                    </div>
                    {allTeams.map(t => (
                        <label
                        key={t.id}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: `1px solid ${selectedTeamIds.includes(t.id) ? "#111827" : theme.border}`,
                            background: selectedTeamIds.includes(t.id) ? (darkMode ? "#1f2937" : "#f1f5f9") : theme.rowBg,
                            cursor: "pointer",
                            fontSize: 13,
                            color: theme.text,
                        }}
                        >
                        <input
                            type="checkbox"
                            checked={selectedTeamIds.includes(t.id)}
                            onChange={() => toggleTeamId(t.id)}
                            style={{ margin: 0 }}
                        />
                        <span style={{ fontWeight: 600 }}>{t.name}</span>
                        <span style={{ color: theme.subtext, fontSize: 12 }}>({t.code})</span>
                        </label>
                    ))}
                    </div>
                )}
                </div>
            )}

            {error && (
                <div style={{ background: "#fee2e2", color: "#991b1b", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
                {error}
                </div>
            )}

            <button onClick={handleAdd} style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#16a34a",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
            }}>
                Create Sprint
            </button>
            </div>
        )}

        {/* Sprint list */}
        {loading ? (
            <div style={{ color: theme.subtext, fontSize: 14 }}>Loading sprints...</div>
        ) : sprints.length === 0 ? (
            <div style={{ color: theme.subtext, fontSize: 14, padding: "12px 0" }}>
            No sprints yet. Add a sprint to enable date-range analysis.
            </div>
        ) : (
            <div style={{ display: "grid", gap: 10 }}>
            {sprints.map(sprint => (
            <div
              key={sprint.id}
              style={{
                background: theme.card,
                border: `1px solid ${editingId === sprint.id ? "#111827" : theme.border}`,
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {/* Sprint header row */}
              <div style={{
                padding: "14px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{sprint.name}</div>
                  <div style={{ fontSize: 13, color: theme.subtext, marginTop: 2 }}>
                    {sprint.start_date} → {sprint.end_date}
                    {sprint.team_ids?.length > 0 && (
                      <span style={{ marginLeft: 8, fontSize: 11, background: "#e0f2fe", color: "#0369a1", padding: "2px 6px", borderRadius: 999 }}>
                        {sprint.team_ids.length === allTeams.length
                          ? "All teams"
                          : `${sprint.team_ids.length} team${sprint.team_ids.length !== 1 ? "s" : ""}`}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {!globalMode && (
                    <button
                      onClick={() => handleAnalyze(sprint, false)}
                      disabled={!!analyzing[sprint.id]}
                      style={btnStyle("#111827", !!analyzing[sprint.id])}
                    >
                      {analyzing[sprint.id] ? "Analysing..." : "Analyse This Team"}
                    </button>
                  )}
                  <button
                    onClick={() => handleAnalyze(sprint, true)}
                    disabled={!!analyzing[sprint.id]}
                    style={btnStyle("#374151", !!analyzing[sprint.id])}
                  >
                    {analyzing[sprint.id] ? "Analysing..." : "Analyse All Teams"}
                  </button>
                  <button
                    onClick={() => editingId === sprint.id ? setEditingId(null) : startEdit(sprint)}
                    style={btnStyle("#2d5db8")}
                  >
                    {editingId === sprint.id ? "Cancel" : "Edit"}
                  </button>
                  <button
                    onClick={() => handleDelete(sprint.id)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: `1px solid #dc2626`,
                      background: "transparent",
                      color: "#dc2626",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Edit panel */}
              {editingId === sprint.id && (
                <div style={{
                  borderTop: `1px solid ${theme.border}`,
                  padding: 16,
                  background: darkMode ? "#0f172a" : "#f8fafc",
                }}>
                  {/* Edit date fields */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: theme.subtext, marginBottom: 4 }}>Sprint Name</div>
                      <input
                        style={inputStyle}
                        value={editForm.name}
                        onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: theme.subtext, marginBottom: 4 }}>Start Date</div>
                      <input
                        type="date"
                        style={inputStyle}
                        value={editForm.start_date}
                        onChange={e => setEditForm(p => ({ ...p, start_date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: theme.subtext, marginBottom: 4 }}>End Date</div>
                      <input
                        type="date"
                        style={inputStyle}
                        value={editForm.end_date}
                        onChange={e => setEditForm(p => ({ ...p, end_date: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Team selection */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: theme.subtext, marginBottom: 6 }}>Teams</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                      <button onClick={() => setEditSelectedTeams("all")} style={tabStyle(editSelectedTeams === "all")}>
                        All Teams
                      </button>
                      <button onClick={() => setEditSelectedTeams("select")} style={tabStyle(editSelectedTeams === "select")}>
                        Select Teams
                      </button>
                    </div>

                    {editSelectedTeams === "select" && (
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
                          <button
                            onClick={() => setEditSelectedTeamIds(allTeams.map(t => t.id))}
                            style={{ fontSize: 12, background: "none", border: "none", cursor: "pointer", color: theme.subtext, padding: 0, textDecoration: "underline" }}
                          >
                            Select all
                          </button>
                          <button
                            onClick={() => setEditSelectedTeamIds([])}
                            style={{ fontSize: 12, background: "none", border: "none", cursor: "pointer", color: theme.subtext, padding: 0, textDecoration: "underline" }}
                          >
                            Clear
                          </button>
                        </div>
                        {allTeams.map(t => (
                          <label
                            key={t.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: `1px solid ${editSelectedTeamIds.includes(t.id) ? "#111827" : theme.border}`,
                              background: editSelectedTeamIds.includes(t.id) ? (darkMode ? "#1f2937" : "#f1f5f9") : theme.rowBg,
                              cursor: "pointer",
                              fontSize: 13,
                              color: theme.text,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={editSelectedTeamIds.includes(t.id)}
                              onChange={() => setEditSelectedTeamIds(prev =>
                                prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]
                              )}
                              style={{ margin: 0 }}
                            />
                            <span style={{ fontWeight: 600 }}>{t.name}</span>
                            <span style={{ color: theme.subtext, fontSize: 12 }}>({t.code})</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {error && (
                    <div style={{ background: "#fee2e2", color: "#991b1b", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
                      {error}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleSaveEdit} style={btnStyle("#16a34a")}>
                      Save Changes
                    </button>
                    <button onClick={() => setEditingId(null)} style={btnStyle("#6b7280")}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
            </div>
        )}
        </div>
    );
}