import React, { useState } from "react";

const RuleSettings = () => {
  const [rules, setRules] = useState([
    { name: "Code Commits", value: 30, desc: "Weight given to Git commits and code quality" },
    { name: "Work Log Hours", value: 25, desc: "Time spent on project tasks as logged" },
    { name: "Documentation", value: 20, desc: "Documents created and maintained" },
    { name: "Meeting Participation", value: 15, desc: "Attendance and participation in team meetings" },
    { name: "Code Review", value: 10, desc: "Participation in code reviews and peer feedback" },
  ]);

  const [autoRecalc, setAutoRecalc] = useState(true);
  const [crossVerify, setCrossVerify] = useState(true);

  const [triangulation, setTriangulation] = useState({
    codeWorklog: 80,
    meetingDoc: 70,
    activityDist: 60,
  });

  const [peerValidation, setPeerValidation] = useState("Statistical analysis");

  const [team] = useState([
    { name: "Jason Vo", tag: "High Performer", tagClass: "high", score: 94, change: "+2%", plus: true },
    { name: "Jen Mao", tag: "High Performer", tagClass: "high", score: 92, change: "+1%", plus: true },
    { name: "Connor Lack", tag: "High Performer", tagClass: "high", score: 89, change: "+3%", plus: true },
    { name: "Kavindu Bhanuka Weragoda", tag: "Medium Performer", tagClass: "medium", score: 73, change: "-1%", plus: false },
    { name: "Md Hriday Mia", tag: "Low Performer", tagClass: "low", score: 42, change: "-5%", plus: false },
  ]);

  const totalWeight = rules.reduce((sum, r) => sum + parseInt(r.value), 0);

  // save placeholder (for backend PHP connection)
  const saveSettings = async () => {
    const payload = { rules, autoRecalc, crossVerify, triangulation, peerValidation };

    try {
      const res = await fetch("http://localhost/backend/saveRules.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) alert("Settings saved successfully!");
      else alert("Failed to save (backend not ready yet).");
    } catch {
      alert("Server not responding yet — backend integration pending.");
    }
  };

  return (
    <>
      <div className="rule-settings-container">
        <div className="page-header">
          <h1>Rule Settings</h1>
          <button className="btn-black" onClick={saveSettings}>
            Save Settings
          </button>
        </div>

        {/* Assessment Rule Weights */}
        <div className="card">
          <h2 className="section-title">Assessment Rule Weights</h2>
          <p className="section-desc">
            Adjust the importance of each contribution metric. Total must equal 100%.
          </p>

          {rules.map((r, i) => (
            <div key={i} className="range-group">
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
                  const newRules = [...rules];
                  newRules[i].value = parseInt(e.target.value);
                  setRules(newRules);
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
          <p className="section-desc">
            Configure automated behavior and validation options
          </p>
          <div className="switch-row">
            <span>Automatically recalculate scores when rules change</span>
            <input
              type="checkbox"
              checked={autoRecalc}
              onChange={() => setAutoRecalc(!autoRecalc)}
            />
          </div>
          <div className="switch-row">
            <span>Cross-verify metrics for consistency and flag issues</span>
            <input
              type="checkbox"
              checked={crossVerify}
              onChange={() => setCrossVerify(!crossVerify)}
            />
          </div>
        </div>

        {/* Triangulation Rules */}
        <div className="card">
          <h2 className="section-title">Triangulation Rules</h2>
          <p className="section-desc">
            Configure how the system cross-checks different data sources
          </p>

          <div className="range-group">
            <div className="range-header">
              <span>Code–Worklog Validation</span>
              <span>{triangulation.codeWorklog}% match required</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={triangulation.codeWorklog}
              onChange={(e) =>
                setTriangulation({ ...triangulation, codeWorklog: e.target.value })
              }
            />
          </div>

          <div className="range-group">
            <div className="range-header">
              <span>Meeting–Document Correlation</span>
              <span>{triangulation.meetingDoc}% correlation required</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={triangulation.meetingDoc}
              onChange={(e) =>
                setTriangulation({ ...triangulation, meetingDoc: e.target.value })
              }
            />
          </div>

          <div className="range-group">
            <div className="range-header">
              <span>Activity Distribution</span>
              <span>{triangulation.activityDist}% of project duration</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={triangulation.activityDist}
              onChange={(e) =>
                setTriangulation({ ...triangulation, activityDist: e.target.value })
              }
            />
          </div>

          <label>Peer Validation Method</label>
          <select
            value={peerValidation}
            onChange={(e) => setPeerValidation(e.target.value)}
          >
            <option>Statistical analysis</option>
            <option>Manual comparison</option>
            <option>Hybrid check</option>
          </select>
        </div>

        {/* Rule Impact Preview */}
        <div className="card">
          <h2 className="section-title">Rule Impact Preview</h2>
          <p className="section-desc">
            See how current rule weights would affect your teammates' scores
          </p>

          {team.map((m, i) => (
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
        .rule-settings-container {
          background: #f9fafb;
          padding: 40px;
          color: #333;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .btn-black {
          background: #000;
          color: #fff;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
        }
        .btn-black:hover { background: #333; }
        .card {
          background: #fff;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          margin-bottom: 24px;
        }
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
};

export default RuleSettings;