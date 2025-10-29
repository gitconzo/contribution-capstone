// frontend/src/pages/RuleSettings.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";

const API = "http://localhost:5002";

// Single source of truth for defaults (matches backend DEFAULT_RULES)
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

export default function RuleSettings() {
  // Entire rules payload lives here; initialize as null to show loader → always render with effectiveRules
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // derive effective (never null)
  const effectiveRules = payload ?? DEFAULT_RULES;

  const totalWeight = useMemo(
    () => (effectiveRules.rules || []).reduce((sum, r) => sum + (parseInt(r.value, 10) || 0), 0),
    [effectiveRules]
  );

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      // GET /api/rules returns: { teamId, rules, autoRecalc, crossVerify, triangulation, peerValidation }
      const res = await fetch(`${API}/api/rules`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed to fetch rules (${res.status})`);
      }
      const data = await res.json();

      // Normalize shape defensively
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
      // Still show defaults so UI is usable
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
        // teamId can be omitted to target the active team per backend contract
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
      // Mirror back what server persisted (defensive)
      setPayload((prev) => ({
        ...(prev ?? {}),
        ...(saved.rules ? saved : { ...prev }), // backend returns { ok, teamId, rules }
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

  // Local “team preview” data left as-is but guarded
  const teamPreview = [
    { name: "Jason Vo", tag: "High Performer", tagClass: "high", score: 94, change: "+2%", plus: true },
    { name: "Jen Mao", tag: "High Performer", tagClass: "high", score: 92, change: "+1%", plus: true },
    { name: "Connor Lack", tag: "High Performer", tagClass: "high", score: 89, change: "+3%", plus: true },
    { name: "Kavindu Bhanuka Weragoda", tag: "Medium Performer", tagClass: "medium", score: 73, change: "-1%", plus: false },
    { name: "Md Hriday Mia", tag: "Low Performer", tagClass: "low", score: 42, change: "-5%", plus: false },
  ];

  return (
    <>
      <div className="rule-settings-container">
        <div className="page-header">
          <h1>Rule Settings</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-black" onClick={fetchRules} disabled={loading}>
              {loading ? "Loading..." : "Reload"}
            </button>
            <button className="btn-black" onClick={saveSettings} disabled={saving || loading}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", color: "#991b1b", padding: 10, borderRadius: 8, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Assessment Rule Weights */}
        <div className="card">
          <h2 className="section-title">Assessment Rule Weights</h2>
          <p className="section-desc">
            Adjust the importance of each contribution metric. Total must equal 100%.
          </p>

          {(effectiveRules.rules || []).map((r, i) => (
            <div key={`${r.name}-${i}`} className="range-group">
              <div className="range-header">
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
              />
              <p className="range-desc">{r.desc}</p>
            </div>
          ))}

          <p className={`total-weight ${totalWeight === 100 ? "green" : "red"}`}>
            Total Weight: {totalWeight}%
          </p>
        </div>

        {/* System Settings */}
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

        {/* Triangulation Rules */}
        <div className="card">
          <h2 className="section-title">Triangulation Rules</h2>
          <p className="section-desc">Configure how the system cross-checks different data sources</p>

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
          />

          <label>Peer Validation Method</label>
          <select
            value={effectiveRules.peerValidation || "Statistical analysis"}
            onChange={(e) =>
              setRulesField((cur) => ({ ...cur, peerValidation: e.target.value }))
            }
          >
            <option>Statistical analysis</option>
            <option>Manual comparison</option>
            <option>Hybrid check</option>
          </select>
        </div>

        {/* Rule Impact Preview (sample data) */}
        <div className="card">
          <h2 className="section-title">Rule Impact Preview</h2>
          <p className="section-desc">
            See how current rule weights would affect your teammates' scores
          </p>

          {teamPreview.map((m, i) => (
            <div key={i} className="team-row">
              <div>
                <span className={`tag ${m.tagClass}`}>{m.tag}</span>
                <div>{m.name}</div>
              </div>
              <div>
                <div className="score">{m.score}%</div>
                <div className={`score-change ${m.plus ? "plus" : "minus"}`}>
                  {m.change} from current rules
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inline Styling */}
      <style>{`
        .rule-settings-container { background: #f9fafb; padding: 40px; color: #333; }
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .btn-black { background: #000; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 500; }
        .btn-black:hover { background: #333; }
        .card { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); margin-bottom: 24px; }
        .section-title { font-size: 1.1rem; font-weight: 600; }
        .section-desc { color: #777; font-size: 0.9rem; margin-bottom: 16px; }
        .range-group { margin-bottom: 20px; }
        .range-header { display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: 500; }
        .range-desc { font-size: 0.8rem; color: #666; }
        input[type=range] { width: 100%; accent-color: #000; }
        .switch-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
        select { width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #ccc; margin-top: 6px; }
        .total-weight { text-align: right; font-weight: 600; }
        .green { color: #16a34a; } .red { color: #dc2626; }
        .team-row { display: flex; justify-content: space-between; border: 1px solid #eee; border-radius: 10px; padding: 12px 16px; margin-bottom: 10px; }
        .tag { display: inline-block; padding: 3px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 500; margin-bottom: 4px; }
        .tag.high { background: #dcfce7; color: #166534; }
        .tag.medium { background: #fef9c3; color: #854d0e; }
        .tag.low { background: #fee2e2; color: #b91c1c; }
        .score { font-weight: 600; }
        .score-change.plus { color: #16a34a; font-size: 0.8rem; }
        .score-change.minus { color: #dc2626; font-size: 0.8rem; }
      `}</style>
    </>
  );
}

function TriSlider({ label, value, onChange, suffix = "" }) {
  const v = Number.isFinite(value) ? value : 0;
  return (
    <div className="range-group">
      <div className="range-header">
        <span>{label}</span>
        <span>{v}%{suffix ? "" : ""}</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={v}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
      />
    </div>
  );
}
