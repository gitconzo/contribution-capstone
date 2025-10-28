import React, { useMemo, useState } from "react";
import {
  mockProjects as mockprojects,
  mockStudents as mockstudents,
} from "./mockdata";

export function Dashboard({ onViewStudent, selectedProjectId, onSelectProject }) {
  const [query, setQuery] = useState("");

  // current project
  const project =
    mockprojects.find((p) => p.id === selectedProjectId) || mockprojects[0];

  // students for this project (by id list)
  const allStudents = useMemo(() => {
    const ids = project?.students || [];
    return ids
      .map((id) => mockstudents.find((s) => s.id === id))
      .filter(Boolean);
  }, [project]);

  // KPIs
  const kpis = useMemo(() => {
    const size = allStudents.length || 1;
    let high = 0;
    let commits = 0;
    let scoreSum = 0;
    allStudents.forEach((s) => {
      if (s.contributionLevel === "high") high += 1;
      commits += s.metrics?.codeCommits || 0;
      scoreSum += s.overallScore || 0;
    });
    return {
      avgScore: Math.round((scoreSum / size) * 10) / 10,
      highText: `${high}/${allStudents.length}`,
      totalCommits: commits,
    };
  }, [allStudents]);

  // search
  const students = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allStudents;
    return allStudents.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  }, [allStudents, query]);

  return (
    <div style={{ padding: "80px 16px 24px", maxWidth: 1120, margin: "0 auto" }}>
      {/* top header */}
      <div style={rowBetween()}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Project Dashboard</h1>
          <div style={{ color: "#64748b", fontSize: 14 }}>
            Monitor team contribution and performance metrics
          </div>
        </div>

        <select
          value={selectedProjectId}
          onChange={(e) => onSelectProject?.(e.target.value)}
          style={selectBox()}
          title="select project"
        >
          {mockprojects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* project / sprint card */}
      <div style={card({ marginTop: 16 })}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{project.name}</div>
        <div style={{ color: "#64748b", fontSize: 14 }}>{project.description}</div>
        <div style={{ marginTop: 10, display: "flex", gap: 16, color: "#334155", fontSize: 13 }}>
          <span>📅 {project.startDate} – {project.endDate}</span>
          <span>👥 {allStudents.length} students</span>
        </div>
      </div>

      {/* KPI row */}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          marginTop: 12,
        }}
      >
        <KpiCard title="Average Score" icon="📊">
          <div style={{ fontSize: 20, fontWeight: 700, color: "#16a34a" }}>
            {kpis.avgScore}%
          </div>
          <Progress value={kpis.avgScore} />
        </KpiCard>

        <KpiCard title="High Contributors" icon="👤">
          <div style={{ fontSize: 20, fontWeight: 700 }}>{kpis.highText}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Students with high contribution levels
          </div>
        </KpiCard>

        <KpiCard title="Total Commits" icon="👥">
          <div style={{ fontSize: 20, fontWeight: 700 }}>{kpis.totalCommits}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Across all team members</div>
        </KpiCard>
      </div>

      {/* team members: header + search */}
      <div style={card({ marginTop: 16, paddingBottom: 10 })}>
        <div style={rowBetween()}>
          <div>
            <div style={{ fontWeight: 700 }}>Team Members</div>
            <div style={{ color: "#64748b", fontSize: 13 }}>
              View and assess individual student contributions
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search students…"
              style={inputBox()}
            />
            <button style={ghostBtn()} title="All Levels (placeholder)">
              ▾ All Levels
            </button>
          </div>
        </div>
      </div>

      {/* rows */}
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {students.map((s) => (
          <div key={s.id} style={rowCard()}>
            {/* left block */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>{s.name}</div>
                <Badge level={s.contributionLevel} />
              </div>
              <div style={{ color: "#64748b", fontSize: 13 }}>{s.email}</div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 14,
                  marginTop: 10,
                  fontSize: 13,
                }}
              >
                <Metric label="Code Commits" value={s.metrics.codeCommits} />
                <Metric label="Work Hours" value={`${s.metrics.worklogHours}h`} />
                <Metric label="Documents" value={s.metrics.documentsCreated} />
                <Metric label="Meetings" value={s.metrics.meetingsAttended} />
              </div>
            </div>

            {/* right block */}
            <div style={{ display: "grid", alignContent: "center", justifyItems: "end", gap: 6 }}>
              <div style={{ color: "#64748b", fontSize: 12 }}>Overall Score</div>
              <div style={{ fontWeight: 700, color: scoreColor(s.overallScore) }}>{s.overallScore}</div>
              <div style={{ color: scoreColor(s.overallScore), fontSize: 12 }}>%</div>
              <button onClick={() => onViewStudent?.(s.id)} style={linkBtn()}>
                👁 View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------- small components -------------------- */

function KpiCard({ title, icon, children }) {
  return (
    <div style={card()}>
      <div style={rowBetween({ fontSize: 13, color: "#64748b" })}>
        <span>{title}</span>
        <span>{icon}</span>
      </div>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

function Progress({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            background: "#16a34a",
          }}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div style={{ color: "#64748b", fontSize: 12 }}>{label}:</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function Badge({ level }) {
  const base = {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid",
  };
  if (level === "high")
    return (
      <span style={{ ...base, color: "#065f46", borderColor: "#a7f3d0", background: "#ecfdf5" }}>
        high contributor
      </span>
    );
  if (level === "medium")
    return (
      <span style={{ ...base, color: "#92400e", borderColor: "#fde68a", background: "#fffbeb" }}>
        medium contributor
      </span>
    );
  return (
    <span style={{ ...base, color: "#991b1b", borderColor: "#fecaca", background: "#fef2f2" }}>
      low contributor
    </span>
  );
}

function scoreColor(score = 0) {
  if (score >= 90) return "#16a34a"; // green
  if (score >= 80) return "#22c55e"; // light green
  if (score >= 70) return "#2563eb"; // blue
  if (score >= 60) return "#ca8a04"; // yellow
  if (score >= 50) return "#ea580c"; // orange
  return "#dc2626"; // red
}



function card(extra = {}) {
  return {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 6px 14px rgba(0,0,0,.04)",
    ...extra,
  };
}

function rowCard() {
  return {
    ...card(),
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 16,
    alignItems: "center",
  };
}

function inputBox() {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#fff",
    fontSize: 14,
    minWidth: 240,
  };
}

function selectBox() {
  return { ...inputBox(), minWidth: 300 };
}

function ghostBtn() {
  return {
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111827",
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 13,
    cursor: "pointer",
  };
}

function linkBtn() {
  return {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 10,
    padding: "6px 10px",
    fontSize: 13,
    cursor: "pointer",
  };
}

function rowBetween(extra = {}) {
  return { display: "flex", justifyContent: "space-between", alignItems: "center", ...extra };
}
