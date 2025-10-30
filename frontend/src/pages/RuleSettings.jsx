import React, { useEffect, useMemo, useState, useCallback } from "react";

const API = "http://localhost:5002";

// Enhanced descriptions for each metric
const METRIC_DESCRIPTIONS = {
  "Total Lines of Code": {
    short: "Percentage of code written in code base",
    detailed: "Measures the total lines of code (LOC) contributed by each student as a percentage of the entire codebase. This includes all additions to the repository, reflecting the volume of code work contributed."
  },
  "Total Edited Code": {
    short: "Percentage of total edited code (additions and deletions)",
    detailed: "Combines both code additions and deletions to measure overall code activity. This metric captures refactoring, bug fixes, and improvements, providing a more complete picture of code contribution beyond just new lines."
  },
  "Total Commits": {
    short: "Percentage of commits made",
    detailed: "Tracks the number of commits made by each student as a percentage of total team commits. Regular commits indicate consistent engagement with the project and good version control practices."
  },
  "Total Functions Written": {
    short: "Percentage of functions written in codebase",
    detailed: "Measures how many complete functions or methods each student has authored. This metric better captures structural contributions than raw line counts, as it focuses on discrete, functional units of code."
  },
  "Total Hotspot Contributed": {
    short: "Percentage of hotspots written in codebase",
    detailed: "Identifies complex, high-maintenance code sections ('hotspots') above average cyclomatic complexity. Students who work on hotspots are tackling challenging, critical parts of the codebase that require deeper understanding."
  },
  "Code Complexity": {
    short: "Average code complexity",
    detailed: "Measures the average cyclomatic complexity of contributed code, indicating how intricate and sophisticated the code is. Higher complexity may show advanced problem-solving but could also indicate code that needs refactoring."
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
  crossVerify: true,
};

export default function RuleSettings() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [scores, setScores] = useState(null);
  const [loadingScores, setLoadingScores] = useState(false);
  const [expandedMetric, setExpandedMetric] = useState(null);

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
        autoRecalc: typeof data.autoRecalc === "boolean" ? data.autoRecalc : DEFAULT_RULES.autoRecalc,
        crossVerify: typeof data.crossVerify === "boolean" ? data.crossVerify : DEFAULT_RULES.crossVerify,
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
      const res = await fetch(`${API}/api/scores`);
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
        crossVerify: effectiveRules.crossVerify,
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
        rules: saved.rules?.rules ?? body.rules,
        autoRecalc: saved.rules?.autoRecalc ?? body.autoRecalc,
        crossVerify: saved.rules?.crossVerify ?? body.crossVerify,
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
      
      return {
        name: student.name,
        tag,
        tagClass,
        score,
      };
    }).sort((a, b) => b.score - a.score);
  }, [scores]);

  return (
    <>
      <div className="rule-settings-container">
        <div className="page-header">
          <h1>Rule Settings</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-black" onClick={fetchRules} disabled={loading}>
              {loading ? "Loading..." : "Reload"}
            </button>
            <button className="btn-black" onClick={saveSettings} disabled={saving || loading || totalWeight !== 100}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", color: "#991b1b", padding: 10, borderRadius: 8, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {totalWeight !== 100 && (
          <div style={{ background: "#fef3c7", color: "#92400e", padding: 10, borderRadius: 8, marginBottom: 16 }}>
            ⚠️ Total weight must equal 100% before saving. Current: {totalWeight}%
          </div>
        )}

        <div className="card">
          <h2 className="section-title">Assessment Rule Weights</h2>
          <p className="section-desc">
            Adjust the importance of each contribution metric. Total must equal 100%. Click on any metric for a detailed explanation.
          </p>

          {(effectiveRules.rules || []).map((r, i) => {
            const isExpanded = expandedMetric === r.name;
            const description = METRIC_DESCRIPTIONS[r.name];
            
            return (
              <div key={`${r.name}-${i}`} className="range-group">
                <div 
                  className="range-header clickable"
                  onClick={() => setExpandedMetric(isExpanded ? null : r.name)}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  <span>
                    {r.name} 
                    <span style={{ marginLeft: 8, color: "#9ca3af", fontSize: "0.9em" }}>
                      {isExpanded ? "▼" : "▶"}
                    </span>
                  </span>
                  <span>{r.value}%</span>
                </div>
                
                {isExpanded && description && (
                  <div style={{ 
                    background: "#f9fafb", 
                    padding: "12px", 
                    borderRadius: "6px", 
                    marginBottom: "8px",
                    fontSize: "0.85rem",
                    color: "#374151",
                    lineHeight: "1.6"
                  }}>
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
                />
                
                {!isExpanded && (
                  <p className="range-desc">{description ? description.short : r.desc}</p>
                )}
              </div>
            );
          })}

          <p className={`total-weight ${totalWeight === 100 ? "green" : "red"}`}>
            Total Weight: {totalWeight}%
          </p>
        </div>

        <div className="card">
          <h2 className="section-title">System Settings</h2>
          <p className="section-desc">Configure automated behavior and validation options</p>
          <div className="switch-row">
            <span>Automatically recalculate scores when rules change</span>
            <input
              type="checkbox"
              checked={!!effectiveRules.autoRecalc}
              onChange={() =>
                setRulesField((cur) => ({ ...cur, autoRecalc: !cur.autoRecalc }))
              }
            />
          </div>
          <div className="switch-row">
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

        <div className="card">
          <h2 className="section-title">Current Team Scores</h2>
          <p className="section-desc">
            Live scores based on your current rule settings ({scores?.team?.name || "No team selected"})
          </p>

          {loadingScores ? (
            <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
              Loading scores...
            </div>
          ) : teamPreview.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
              No team data available. Upload documents and configure team settings.
            </div>
          ) : (
            teamPreview.map((m, i) => (
              <div key={i} className="team-row">
                <div>
                  <span className={`tag ${m.tagClass}`}>{m.tag}</span>
                  <div>{m.name}</div>
                </div>
                <div>
                  <div className="score">{m.score}%</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .rule-settings-container { background: #f9fafb; padding: 40px; color: #333; }
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .btn-black { background: #000; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 500; transition: all 0.2s; }
        .btn-black:hover:not(:disabled) { background: #333; }
        .btn-black:disabled { background: #666; cursor: not-allowed; opacity: 0.6; }
        .card { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); margin-bottom: 24px; }
        .section-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 8px; }
        .section-desc { color: #777; font-size: 0.9rem; margin-bottom: 16px; }
        .range-group { margin-bottom: 20px; }
        .range-header { display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: 500; }
        .range-header.clickable:hover { color: #2563eb; }
        .range-desc { font-size: 0.8rem; color: #666; margin-top: 6px; }
        input[type=range] { width: 100%; accent-color: #000; }
        .switch-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
        .total-weight { text-align: right; font-weight: 600; margin-top: 16px; font-size: 1.1rem; }
        .green { color: #16a34a; } .red { color: #dc2626; }
        .team-row { display: flex; justify-content: space-between; border: 1px solid #eee; border-radius: 10px; padding: 12px 16px; margin-bottom: 10px; }
        .tag { display: inline-block; padding: 3px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 500; margin-bottom: 4px; }
        .tag.high { background: #dcfce7; color: #166534; }
        .tag.medium { background: #fef9c3; color: #854d0e; }
        .tag.low { background: #fee2e2; color: #b91c1c; }
        .score { font-weight: 600; font-size: 1.2rem; }
      `}</style>
    </>
  );
}