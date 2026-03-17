// frontend/src/pages/RuleSettings.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";

const API = "http://localhost:5002";

const DEFAULT_RULES = {
  rules: [
    { name: "Total Lines of Code", value: 12, desc: "Percentage of code written in code base" },
    { name: "Total Edited Code", value: 10, desc: "percentage of total edited code (additions and deletions)" },
    { name: "Total Commits", value: 7, desc: "Percentage of commits made" },
    { name: "Total Functions Written", value: 12, desc: "Percentage of functions written in codebase" },
    { name: "Total Hotspot Contributed", value: 10, desc: "Percentage of hotspots written in codebase (hotspots = above average function complexity)" },
    { name: "Code Complexity", value: 9, desc: "Average code complexity" },
    { name: "Average Sentence Length", value: 5, desc: "Average sentence length" },
    { name: "Sentence Complexity", value: 5, desc: "Sentence complexity" },
    { name: "Word Count", value: 7, desc: "Word Count" },
    { name: "Readability", value: 8, desc: "Readability" },
  ],
  autoRecalc: true,
  crossVerify: true,
  triangulation: { codeWorklog: 80, meetingDoc: 70, activityDist: 60 },
  peerValidation: "Statistical analysis",
};

export default function RuleSettings({ darkMode }) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        green: "#16a34a",
        red: "#dc2626",
      }
    : {
        pageBg: "#f9fafb",
        card: "#ffffff",
        cardAlt: "#ffffff",
        text: "#333333",
        subtext: "#777777",
        border: "#e5e7eb",
        softBorder: "#eeeeee",
        inputBg: "#ffffff",
        shadow: "0 4px 12px rgba(0,0,0,0.08)",
        green: "#16a34a",
        red: "#dc2626",
      };

  const effectiveRules = payload ?? DEFAULT_RULES;

  const totalWeight = useMemo(
    () => (effectiveRules.rules || []).reduce((sum, r) => sum + (parseInt(r.value, 10) || 0), 0),
    [effectiveRules]
  );

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API}/api/rules`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed to fetch rules (${res.status})`);
      }
      const data = await res.json();

      const normalized = {
        rules: Array.isArray(data.rules) ? data.rules : DEFAULT_RULES.rules,
        autoRecalc:
          typeof data.autoRecalc === "boolean" ? data.autoRecalc : DEFAULT_RULES.autoRecalc,
        crossVerify:
          typeof data.crossVerify === "boolean" ? data.crossVerify : DEFAULT_RULES.crossVerify,
        triangulation: data.triangulation || DEFAULT_RULES.triangulation,
        peerValidation: data.peerValidation || DEFAULT_RULES.peerValidation,
        teamId: data.teamId || null,
      };
      setPayload(normalized);
    } catch (e) {
      setError(e.message || "Unable to load rules");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const setRulesField = (updater) => {
    setPayload((prev) => {
      const base = prev ?? { ...DEFAULT_RULES };
      return updater(base);
    });
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError("");
      const body = {
        rules: effectiveRules.rules,
        autoRecalc: effectiveRules.autoRecalc,
        crossVerify: effectiveRules.crossVerify,
        triangulation: effectiveRules.triangulation,
        peerValidation: effectiveRules.peerValidation,
      };
      const res = await fetch(`${API}/api/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Save failed (${res.status})`);
      }
      const saved = await res.json();
      setPayload((prev) => ({
        ...(prev ?? {}),
        ...(saved.rules ? saved : { ...prev }),
        rules: saved.rules?.rules ?? body.rules,
        autoRecalc: saved.rules?.autoRecalc ?? body.autoRecalc,
        crossVerify: saved.rules?.crossVerify ?? body.crossVerify,
        triangulation: saved.rules?.triangulation ?? body.triangulation,
        peerValidation: saved.rules?.peerValidation ?? body.peerValidation,
      }));
      alert("Settings saved successfully!");
    } catch (e) {
      setError(e.message || "Failed to save settings");
      alert(`Failed to save: ${e.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const teamPreview = [
    { name: "Jason Vo", tag: "High Performer", tagClass: "high", score: 94, change: "+2%", plus: true },
    { name: "Jen Mao", tag: "High Performer", tagClass: "high", score: 92, change: "+1%", plus: true },
    { name: "Connor Lack", tag: "High Performer", tagClass: "high", score: 89, change: "+3%", plus: true },
    { name: "Kavindu Bhanuka Weragoda", tag: "Medium Performer", tagClass: "medium", score: 73, change: "-1%", plus: false },
    { name: "Md Hriday Mia", tag: "Low Performer", tagClass: "low", score: 42, change: "-5%", plus: false },
  ];

  return (
    <>
      <div
        className="rule-settings-container"
        style={{
          background: theme.pageBg,
          color: theme.text,
          minHeight: "100vh",
          padding: 40,
        }}
      >
        <div
          className="page-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 30,
          }}
        >
          <h1 style={{ color: theme.text, margin: 0 }}>Rule Settings</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-black"
              onClick={fetchRules}
              disabled={loading}
              style={buttonStyle(darkMode)}
            >
              {loading ? "Loading..." : "Reload"}
            </button>
            <button
              className="btn-black"
              onClick={saveSettings}
              disabled={saving || loading}
              style={buttonStyle(darkMode)}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: darkMode ? "#3f1d1d" : "#fee2e2",
              color: darkMode ? "#fecaca" : "#991b1b",
              padding: 10,
              borderRadius: 8,
              marginBottom: 16,
              border: `1px solid ${darkMode ? "#7f1d1d" : "#fecaca"}`,
            }}
          >
            {error}
          </div>
        )}

        <div style={card(theme)}>
          <h2 className="section-title" style={{ color: theme.text }}>Assessment Rule Weights</h2>
          <p className="section-desc" style={{ color: theme.subtext }}>
            Adjust the importance of each contribution metric. Total must equal 100%.
          </p>

          {(effectiveRules.rules || []).map((r, i) => (
            <div key={`${r.name}-${i}`} className="range-group" style={{ marginBottom: 20 }}>
              <div
                className="range-header"
                style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontWeight: 500 }}
              >
                <span>{r.name}</span>
                <span>{r.value}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={r.value}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  setRulesField((cur) => {
                    const next = { ...cur, rules: [...(cur.rules || [])] };
                    next.rules[i] = { ...next.rules[i], value: val };
                    return next;
                  });
                }}
                style={{ width: "100%", accentColor: "#000" }}
              />
              <p className="range-desc" style={{ fontSize: "0.8rem", color: theme.subtext }}>
                {r.desc}
              </p>
            </div>
          ))}

          <p
            className="total-weight"
            style={{
              textAlign: "right",
              fontWeight: 600,
              color: totalWeight === 100 ? theme.green : theme.red,
            }}
          >
            Total Weight: {totalWeight}%
          </p>
        </div>

        <div style={card(theme)}>
          <h2 className="section-title" style={{ color: theme.text }}>System Settings</h2>
          <p className="section-desc" style={{ color: theme.subtext }}>
            Configure automated behavior and validation options
          </p>

          <div
            className="switch-row"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}
          >
            <span>Automatically recalculate scores when rules change</span>
            <input
              type="checkbox"
              checked={!!effectiveRules.autoRecalc}
              onChange={() =>
                setRulesField((cur) => ({ ...cur, autoRecalc: !cur.autoRecalc }))
              }
            />
          </div>

          <div
            className="switch-row"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}
          >
            <span>Cross-verify metrics for consistency and flag issues</span>
            <input
              type="checkbox"
              checked={!!effectiveRules.crossVerify}
              onChange={() =>
                setRulesField((cur) => ({ ...cur, crossVerify: !cur.crossVerify }))
              }
            />
          </div>
        </div>

        <div style={card(theme)}>
          <h2 className="section-title" style={{ color: theme.text }}>Triangulation Rules</h2>
          <p className="section-desc" style={{ color: theme.subtext }}>
            Configure how the system cross-checks different data sources
          </p>

          <TriSlider
            label="Code–Worklog Validation"
            suffix=" % match required"
            value={Number(effectiveRules.triangulation?.codeWorklog ?? 0)}
            onChange={(v) =>
              setRulesField((cur) => ({
                ...cur,
                triangulation: { ...(cur.triangulation || {}), codeWorklog: v },
              }))
            }
            theme={theme}
          />

          <TriSlider
            label="Meeting–Document Correlation"
            suffix=" % correlation required"
            value={Number(effectiveRules.triangulation?.meetingDoc ?? 0)}
            onChange={(v) =>
              setRulesField((cur) => ({
                ...cur,
                triangulation: { ...(cur.triangulation || {}), meetingDoc: v },
              }))
            }
            theme={theme}
          />

          <TriSlider
            label="Activity Distribution"
            suffix=" % of project duration"
            value={Number(effectiveRules.triangulation?.activityDist ?? 0)}
            onChange={(v) =>
              setRulesField((cur) => ({
                ...cur,
                triangulation: { ...(cur.triangulation || {}), activityDist: v },
              }))
            }
            theme={theme}
          />

          <label style={{ color: theme.text }}>Peer Validation Method</label>
          <select
            value={effectiveRules.peerValidation || "Statistical analysis"}
            onChange={(e) =>
              setRulesField((cur) => ({ ...cur, peerValidation: e.target.value }))
            }
            style={selectStyle(theme)}
          >
            <option>Statistical analysis</option>
            <option>Manual comparison</option>
            <option>Hybrid check</option>
          </select>
        </div>

        <div style={card(theme)}>
          <h2 className="section-title" style={{ color: theme.text }}>Rule Impact Preview</h2>
          <p className="section-desc" style={{ color: theme.subtext }}>
            See how current rule weights would affect your teammates' scores
          </p>

          {teamPreview.map((m, i) => (
            <div
              key={i}
              className="team-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                border: `1px solid ${theme.softBorder}`,
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 10,
                background: theme.cardAlt,
              }}
            >
              <div>
                <span style={tagStyle(m.tagClass)}>{m.tag}</span>
                <div style={{ color: theme.text }}>{m.name}</div>
              </div>
              <div>
                <div className="score" style={{ fontWeight: 600, color: theme.text }}>
                  {m.score}%
                </div>
                <div
                  className={`score-change ${m.plus ? "plus" : "minus"}`}
                  style={{
                    color: m.plus ? theme.green : theme.red,
                    fontSize: "0.8rem",
                  }}
                >
                  {m.change} from current rules
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function TriSlider({ label, value, onChange, theme }) {
  const v = Number.isFinite(value) ? value : 0;
  return (
    <div className="range-group" style={{ marginBottom: 20 }}>
      <div
        className="range-header"
        style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontWeight: 500 }}
      >
        <span style={{ color: theme.text }}>{label}</span>
        <span style={{ color: theme.text }}>{v}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={v}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        style={{ width: "100%", accentColor: "#000" }}
      />
    </div>
  );
}

function card(theme) {
  return {
    background: theme.card,
    borderRadius: 16,
    padding: 24,
    boxShadow: theme.shadow,
    marginBottom: 24,
    border: `1px solid ${theme.border}`,
  };
}

function buttonStyle(darkMode) {
  return {
    background: "#000",
    color: "#fff",
    border: "none",
    padding: "10px 20px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 500,
    opacity: darkMode ? 0.95 : 1,
  };
}

function selectStyle(theme) {
  return {
    width: "100%",
    padding: 8,
    borderRadius: 6,
    border: `1px solid ${theme.border}`,
    marginTop: 6,
    background: theme.card,
    color: theme.text,
  };
}

function tagStyle(level) {
  const base = {
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: 10,
    fontSize: "0.75rem",
    fontWeight: 500,
    marginBottom: 4,
  };

  if (level === "high") return { ...base, background: "#dcfce7", color: "#166534" };
  if (level === "medium") return { ...base, background: "#fef9c3", color: "#854d0e" };
  return { ...base, background: "#fee2e2", color: "#b91c1c" };
}

