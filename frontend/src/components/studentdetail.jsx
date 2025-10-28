import React from "react";
import { mockStudents as students } from "./mockdata";

// student detail page 
export function Studentdetail({ studentId, onBack }) {
  const s = students.find((x) => x.id === studentId);
  if (!s) {
    return (
      <div style={{ padding: "80px 16px", maxWidth: 960, margin: "0 auto" }}>
        <button onClick={onBack} style={btn()}>← back</button>
        <p>student not found.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "80px 16px", maxWidth: 1000, margin: "0 auto" }}>
      <button onClick={onBack} style={btn()}>← back</button>

      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ margin: "8px 0 2px", fontSize: 22 }}>{s.name}</h1>
          <div style={{ color: "#6b7280", fontSize: 13 }}>{s.email}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#6b7280", fontSize: 12 }}>overall score</div>
          <div style={{ fontWeight: 700, color: scoreCol(s.overallScore), lineHeight: 1 }}>
            {s.overallScore}
          </div>
          <div style={{ color: scoreCol(s.overallScore), fontSize: 12, marginTop: -2 }}>%</div>
        </div>
      </div>

      {/* metrics */}
      <div style={card({ marginTop: 12 })}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
          <Metric k="Code Commits" v={s.metrics.codeCommits} />
          <Metric k="Work Hours"   v={`${s.metrics.worklogHours}h`} />
          <Metric k="Documents"    v={s.metrics.documentsCreated} />
          <Metric k="Meetings"     v={s.metrics.meetingsAttended} />
        </div>
      </div>

      {/* timeline */}
      <div style={card({ marginTop: 12 })}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>activity timeline</div>
        {s.timeline?.length ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {s.timeline.map((t, i) => (
              <li key={i} style={row()}>
                <span style={{ width: 110, color: "#6b7280", fontSize: 12 }}>{t.date}</span>
                <span style={tag(t.type)}>{t.type}</span>
                <span style={{ flex: 1 }}>{t.activity}</span>
                <span style={{ color: "#6b7280", fontSize: 12 }}>impact {t.impact}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ color: "#6b7280", fontSize: 13 }}>no activity yet.</div>
        )}
      </div>
    </div>
  );
}


function card(extra = {}) {
  return { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, boxShadow: "0 4px 12px rgba(0,0,0,.04)", ...extra };
}
function row() {
  return { display: "grid", gridTemplateColumns: "110px auto 1fr auto", alignItems: "center", gap: 10, border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 10px", background: "#fff" };
}
function btn() { return { border: "1px solid #e5e7eb", background: "#fff", borderRadius: 10, padding: "6px 10px", fontSize: 12, cursor: "pointer" }; }
function Metric({ k, v }) { return (<div><div style={{ color: "#6b7280", fontSize: 12 }}>{k}:</div><div style={{ fontWeight: 600 }}>{v}</div></div>); }
function scoreCol(n) {
  if (n >= 90) return "#16a34a"; if (n >= 80) return "#22c55e"; if (n >= 70) return "#2563eb";
  if (n >= 60) return "#ca8a04"; if (n >= 50) return "#ea580c"; return "#dc2626";
}
function tag(type) {
  const base = { fontSize: 11, padding: "2px 8px", borderRadius: 999, border: "1px solid" };
  if (type === "code")     return { ...base, color: "#1d4ed8", background: "#eff6ff", borderColor: "#bfdbfe" };
  if (type === "worklog")  return { ...base, color: "#065f46", background: "#ecfdf5", borderColor: "#a7f3d0" };
  if (type === "document") return { ...base, color: "#9d174d", background: "#fdf2f8", borderColor: "#fbcfe8" };
  if (type === "meeting")  return { ...base, color: "#6d28d9", background: "#f5f3ff", borderColor: "#ddd6fe" };
  return base;
}
