import React from "react";

export default function StudentDetail({ student, onBack }) {
  if (!student) {
    return (
      <div style={{ padding: "80px 16px", maxWidth: 960, margin: "0 auto" }}>
        <button onClick={onBack} style={btn()}>← back</button>
        <p>student not found.</p>
      </div>
    );
  }

  const raw = student.raw || {};
  const breakdown = student.breakdown || {};

  return (
    <div style={{ padding: "80px 16px", maxWidth: 1000, margin: "0 auto" }}>
      <button onClick={onBack} style={btn()}>← back</button>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ margin: "8px 0 2px", fontSize: 22 }}>{student.name}</h1>
          <div style={{ color: "#6b7280", fontSize: 13 }}>{student.email}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#6b7280", fontSize: 12 }}>overall score</div>
          <div style={{ fontWeight: 700, color: scoreCol(student.score), fontSize: 36, lineHeight: 1 }}>
            {Math.round(student.score)}
          </div>
          <div style={{ color: scoreCol(student.score), fontSize: 12, marginTop: -2 }}>%</div>
        </div>
      </div>

      {/* Summary Metrics Card */}
      <div style={card({ marginTop: 12 })}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
          <Metric k="Code Commits" v={Math.round(raw.commits || 0)} />
          <Metric k="Work Hours" v={`${Math.round(raw.hours || 0)}h`} />
          <Metric k="Documents" v={Math.round(raw.documents || 0)} />
          <Metric k="Meetings" v={Math.round(raw.meetings || 0)} />
        </div>
      </div>

      {/* Metric Breakdown */}
      <div style={card({ marginTop: 12 })}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>metric breakdown (normalized)</div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
          {/* Code Metrics */}
          <MetricBar label="Loc" value={breakdown.loc} />
          <MetricBar label="EditedCode" value={breakdown.editedCode} />
          <MetricBar label="Commits" value={breakdown.commits} />
          <MetricBar label="Functions" value={breakdown.functions} />
          <MetricBar label="Hotspots" value={breakdown.hotspots} />
          <MetricBar label="CodeComplexity" value={breakdown.codeComplexity} />
          
          {/* Documentation Metrics */}
          <MetricBar label="AvgSentenceLength" value={breakdown.avgSentenceLength} />
          <MetricBar label="SentenceComplexity" value={breakdown.sentenceComplexity} />
          <MetricBar label="WordCount" value={breakdown.wordCount} />
          <MetricBar label="Readability" value={breakdown.readability} />
        </ul>
      </div>

      {/* Raw Values Card */}
      <div style={card({ marginTop: 12 })}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>raw values</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, fontSize: 13 }}>
          <RawMetric label="Lines of Code %" value={`${(raw.loc || 0).toFixed(2)}%`} />
          <RawMetric label="Edited Code %" value={`${(raw.editedCode || 0).toFixed(2)}%`} />
          <RawMetric label="Commit %" value={`${(raw.commits || 0).toFixed(2)}%`} />
          <RawMetric label="Functions %" value={`${(raw.functions || 0).toFixed(2)}%`} />
          <RawMetric label="Hotspots %" value={`${(raw.hotspots || 0).toFixed(2)}%`} />
          <RawMetric label="Code Complexity" value={(raw.codeComplexity || 0).toFixed(3)} />
          <RawMetric label="Avg Sentence Length" value={(raw.avgSentenceLength || 0).toFixed(2)} />
          <RawMetric label="Sentence Complexity" value={(raw.sentenceComplexity || 0).toFixed(3)} />
          <RawMetric label="Word Count" value={Math.round(raw.wordCount || 0)} />
          <RawMetric label="Readability Score" value={(raw.readability || 0).toFixed(2)} />
          <RawMetric label="Attendance" value={`${((raw.attendance || 0) * 100).toFixed(0)}%`} />
        </div>
      </div>
    </div>
  );
}

function MetricBar({ label, value }) {
  const percentage = Math.round((value || 0) * 100);
  return (
    <li style={row()}>
      <span style={{ width: 160, color: "#6b7280", fontSize: 12 }}>{label}</span>
      <span style={{ flex: 1 }}>
        <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb" }}>
          <div 
            style={{ 
              width: `${percentage}%`, 
              height: "100%", 
              borderRadius: 999, 
              background: "#2563eb" 
            }} 
          />
        </div>
      </span>
      <span style={{ width: 40, textAlign: "right", fontSize: 12 }}>{percentage}</span>
    </li>
  );
}

function RawMetric({ label, value }) {
  return (
    <div style={{ padding: "8px 12px", background: "#f9fafb", borderRadius: 8 }}>
      <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{value}</div>
    </div>
  );
}

function card(extra = {}) { 
  return { 
    background: "#fff", 
    border: "1px solid #e5e7eb", 
    borderRadius: 12, 
    padding: 14, 
    boxShadow: "0 4px 12px rgba(0,0,0,.04)", 
    ...extra 
  }; 
}

function row() { 
  return { 
    display: "grid", 
    gridTemplateColumns: "160px 1fr 40px", 
    alignItems: "center", 
    gap: 10 
  }; 
}

function btn() { 
  return { 
    border: "1px solid #e5e7eb", 
    background: "#fff", 
    borderRadius: 10, 
    padding: "6px 10px", 
    fontSize: 12, 
    cursor: "pointer" 
  }; 
}

function Metric({ k, v }) { 
  return (
    <div>
      <div style={{ color: "#6b7280", fontSize: 12 }}>{k}:</div>
      <div style={{ fontWeight: 600 }}>{v}</div>
    </div>
  ); 
}

function scoreCol(n) { 
  if (n >= 90) return "#16a34a"; 
  if (n >= 80) return "#22c55e"; 
  if (n >= 70) return "#2563eb"; 
  if (n >= 60) return "#ca8a04"; 
  if (n >= 50) return "#ea580c"; 
  return "#dc2626"; 
}