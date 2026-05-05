// frontend/src/pages/RuleSettings.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { apiFetch } from "../utils/api";

// Enhanced descriptions for each metric
const METRIC_DESCRIPTIONS = {
  "Total Lines of Code": {
    short: "Percentage of code written in code base",
    detailed: "Runs git blame on every file in the repository (or files changed during the sprint). Each line is attributed to whoever last committed it. The total lines per author is divided by the team total to produce a percentage."
  },
  "Total Edited Code": {
    short: "Percentage of total edited code (additions and deletions)",
    detailed: "Counts the total additions and deletions across all commits per author from git log. Each author's total edits divided by the team's total edits gives their percentage. Merge commits are excluded."
  },
  "Total Commits": {
    short: "Percentage of commits made",
    detailed: "Counts the number of commits per author across all branches. Each author's commit count divided by the total team commits gives their percentage. Merge commits are excluded."
  },
  "Total Functions Written": {
    short: "Percentage of functions written in codebase",
    detailed: "Lizard analyses all files to detect functions. Git blame is run on each function's line range. Each author receives a proportional share of that function based on how many lines they contributed. All shares are summed and divided by total functions."
  },
  "Total Hotspot Contributed": {
    short: "Percentage of hotspots written in codebase",
    detailed: "Each function is scored by combining normalised cyclomatic complexity and call frequency (how often it is called elsewhere in the codebase). The top 25% scoring functions are classified as hotspots. Each hotspot is split proportionally among all authors who contributed lines to it. Total hotspot shares divided by total hotspots gives each author's percentage"
  },
  "Code Complexity": {
    short: "Average code complexity",
    detailed: "For every function a student contributed lines to, their complexity score is calculated using a weighted combination of four metrics from Lizard: cyclomatic complexity (weighted 0.5), maximum nesting depth (how deeply blocks are nested, weighted 0.2), length of function (weighted 0.2 scaled by /10), and parameter count (weighted 0.1). Each function's complexity score is then weighted by the student's proportional line contribution to that function. The average across all functions they touched is their final complexity score"
  },
  "Average Sentence Length": {
    short: "Average sentence length in documentation",
    detailed: "Analyzes documentation writing style by measuring average sentence length. Moderate sentence lengths (15-20 words) typically indicate clear, professional technical writing."
  },
  "Sentence Complexity": {
    short: "Complexity of written sentences",
    detailed: "Measures grammatical complexity using subordinate clauses and embedded structures. Higher values indicate more sophisticated writing, though simpler structures often communicate more effectively in technical contexts."
  },
  "Word Count": {
    short: "Total words contributed in documentation",
    detailed: "Tracks the total volume of documentation written, including sprint reports, project plans, and other written deliverables. This measures the extent of written contribution to the project."
  },
  "Readability": {
    short: "Flesch reading ease score",
    detailed: "Uses the Flesch Reading Ease formula to assess how easy documentation is to understand (higher = easier). Scores of 60-70 are ideal for technical documentation, balancing accessibility with precision."
  }
};

const DEFAULT_RULES = {
  rules: [
    { name: "Total Lines of Code", value: 12, desc: METRIC_DESCRIPTIONS["Total Lines of Code"].short },
    { name: "Total Edited Code", value: 10, desc: METRIC_DESCRIPTIONS["Total Edited Code"].short },
    { name: "Total Commits", value: 7, desc: METRIC_DESCRIPTIONS["Total Commits"].short },
    { name: "Total Functions Written", value: 12, desc: METRIC_DESCRIPTIONS["Total Functions Written"].short },
    { name: "Total Hotspot Contributed", value: 10, desc: METRIC_DESCRIPTIONS["Total Hotspot Contributed"].short },
    { name: "Code Complexity", value: 9, desc: METRIC_DESCRIPTIONS["Code Complexity"].short },
    { name: "Average Sentence Length", value: 5, desc: METRIC_DESCRIPTIONS["Average Sentence Length"].short },
    { name: "Sentence Complexity", value: 5, desc: METRIC_DESCRIPTIONS["Sentence Complexity"].short },
    { name: "Word Count", value: 7, desc: METRIC_DESCRIPTIONS["Word Count"].short },
    { name: "Readability", value: 11, desc: METRIC_DESCRIPTIONS["Readability"].short },
  ],
  autoRecalc: true,
};

export default function RuleSettings({ darkMode }) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [scores, setScores] = useState(null);
  const [loadingScores, setLoadingScores] = useState(false);
  const [expandedMetric, setExpandedMetric] = useState(null);

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
        expandedBg: "#0f172a",
        expandedText: "#cbd5e1",
        warnBg: "#422006",
        warnText: "#fde68a",
        warnBorder: "#78350f",
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
        expandedBg: "#f9fafb",
        expandedText: "#374151",
        warnBg: "#fef3c7",
        warnText: "#92400e",
        warnBorder: "#fde68a",
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
      const res = await apiFetch("/api/rules");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed to fetch rules (${res.status})`);
      }
      const data = await res.json();

      const normalized = {
        rules: Array.isArray(data.rules) ? data.rules : DEFAULT_RULES.rules,
        autoRecalc: typeof data.autoRecalc === "boolean" ? data.autoRecalc : DEFAULT_RULES.autoRecalc,
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

  const fetchScores = useCallback(async () => {
    try {
      setLoadingScores(true);
      const res = await apiFetch("/api/scores");
      if (!res.ok) throw new Error("Failed to fetch scores");
      const data = await res.json();
      setScores(data);
    } catch (e) {
      console.error("Failed to load scores:", e);
      setScores(null);
    } finally {
      setLoadingScores(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchScores();
  }, [fetchRules, fetchScores]);

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
      };
      const res = await apiFetch("/api/rules", {
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
        rules: saved.rules?.rules ?? body.rules,
        autoRecalc: saved.rules?.autoRecalc ?? body.autoRecalc,
      }));

      if (effectiveRules.autoRecalc) {
        await fetchScores();
      }

      alert("Settings saved successfully!");
    } catch (e) {
      setError(e.message || "Failed to save settings");
      alert(`Failed to save: ${e.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const teamPreview = useMemo(() => {
    if (!scores?.ranking) return [];

    return scores.ranking.map(student => {
      const score = Math.round(student.score || 0);
      let tag = "Low Performer";
      let tagClass = "low";

      if (score >= 80) {
        tag = "High Performer";
        tagClass = "high";
      } else if (score >= 60) {
        tag = "Medium Performer";
        tagClass = "medium";
      }

      return { name: student.name, tag, tagClass, score };
    }).sort((a, b) => b.score - a.score);
  }, [scores]);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: theme.pageBg }}>
      <div style={{
        width: 40,
        height: 40,
        border: `4px solid ${theme.border}`,
        borderTop: `4px solid ${darkMode ? "#f8fafc" : "#111827"}`,
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div
      style={{
        background: theme.pageBg,
        color: theme.text,
        minHeight: "100vh",
        padding: 40,
      }}
    >
      <div
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
            onClick={fetchRules}
            disabled={loading}
            style={buttonStyle()}
          >
            {loading ? "Loading..." : "Reload"}
          </button>
          <button
            onClick={saveSettings}
            disabled={saving || loading || totalWeight !== 100}
            style={buttonStyle()}
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

      {totalWeight !== 100 && (
        <div
          style={{
            background: theme.warnBg,
            color: theme.warnText,
            padding: 10,
            borderRadius: 8,
            marginBottom: 16,
            border: `1px solid ${theme.warnBorder}`,
          }}
        >
          Total weight must equal 100% before saving. Current: {totalWeight}%
        </div>
      )}

      {/* Assessment Rule Weights */}
      <div style={card(theme)}>
        <h2 style={{ color: theme.text, fontSize: "1.1rem", fontWeight: 600, marginBottom: 8, marginTop: 0 }}>
          Assessment Rule Weights
        </h2>
        <p style={{ color: theme.subtext, fontSize: "0.9rem", marginBottom: 16 }}>
          Adjust the importance of each contribution metric. Total must equal 100%. Click on any metric for a detailed explanation.
        </p>

        {(effectiveRules.rules || []).map((r, i) => {
          const isExpanded = expandedMetric === r.name;
          const description = METRIC_DESCRIPTIONS[r.name];

          return (
            <div key={`${r.name}-${i}`} style={{ marginBottom: 20 }}>
              <div
                onClick={() => setExpandedMetric(isExpanded ? null : r.name)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                  fontWeight: 500,
                  cursor: "pointer",
                  userSelect: "none",
                  color: theme.text,
                }}
              >
                <span>
                  {r.name}
                  <span style={{ marginLeft: 8, color: theme.subtext, fontSize: "0.9em" }}>
                    {isExpanded ? "▼" : "▶"}
                  </span>
                </span>
                <span>{r.value}%</span>
              </div>

              {isExpanded && description && (
                <div
                  style={{
                    background: theme.expandedBg,
                    padding: "12px",
                    borderRadius: "6px",
                    marginBottom: "8px",
                    fontSize: "0.85rem",
                    color: theme.expandedText,
                    lineHeight: "1.6",
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  {description.detailed}
                </div>
              )}

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

              {!isExpanded && (
                <p style={{ fontSize: "0.8rem", color: theme.subtext, marginTop: 6 }}>
                  {description ? description.short : r.desc}
                </p>
              )}
            </div>
          );
        })}

        <p
          style={{
            textAlign: "right",
            fontWeight: 600,
            marginTop: 16,
            fontSize: "1.1rem",
            color: totalWeight === 100 ? theme.green : theme.red,
          }}
        >
          Total Weight: {totalWeight}%
        </p>
      </div>

      {/* System Settings */}
      <div style={card(theme)}>
        <h2 style={{ color: theme.text, fontSize: "1.1rem", fontWeight: 600, marginBottom: 8, marginTop: 0 }}>
          System Settings
        </h2>
        <p style={{ color: theme.subtext, fontSize: "0.9rem", marginBottom: 16 }}>
          Configure automated behavior and validation options
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 0",
            color: theme.text,
          }}
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

      </div>

      {/* Current Team Scores */}
      <div style={card(theme)}>
        <h2 style={{ color: theme.text, fontSize: "1.1rem", fontWeight: 600, marginBottom: 8, marginTop: 0 }}>
          Current Team Scores
        </h2>
        <p style={{ color: theme.subtext, fontSize: "0.9rem", marginBottom: 16 }}>
          Live scores based on your current rule settings ({scores?.team?.name || "No team selected"})
        </p>

        {loadingScores ? (
          <div style={{ textAlign: "center", padding: "20px", color: theme.subtext }}>
            Loading scores...
          </div>
        ) : teamPreview.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px", color: theme.subtext }}>
            No team data available. Upload documents and configure team settings.
          </div>
        ) : (
          teamPreview.map((m, i) => (
            <div
              key={i}
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
                <div style={{ fontWeight: 600, fontSize: "1.2rem", color: theme.text }}>
                  {m.score}%
                </div>
              </div>
            </div>
          ))
        )}
      </div>
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

function buttonStyle() {
  return {
    background: "#000",
    color: "#fff",
    border: "none",
    padding: "10px 20px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 500,
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
