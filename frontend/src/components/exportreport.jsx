import React, { useMemo, useState } from "react";
import { mockProjects as mockprojects, mockStudents as mockstudents, mockRules as mockrules } from "./mockdata";

export function Exportreport({ selectedProjectId = "proj-1" }) {
  // formats
  const [fmt, setFmt] = useState("pdf"); // pdf | docx | csv | xlsx

  // sections to include
  const [inc, setInc] = useState({
    charts: true,
    timeline: true,
    rules: true,
    validation: true,
  });

  // project + students
  const project = mockprojects.find((p) => p.id === selectedProjectId) || mockprojects[0];
  const studentsAll = useMemo(() => {
    const ids = project?.students || [];
    return ids.map((id) => mockstudents.find((s) => s.id === id)).filter(Boolean);
  }, [project]);

  // selection
  const [pickedIds, setPickedIds] = useState(() => studentsAll.map((s) => s.id));
  const picked = useMemo(() => studentsAll.filter((s) => pickedIds.includes(s.id)), [studentsAll, pickedIds]);

  // summary (right card)
  const summary = useMemo(() => {
    const n = studentsAll.length || 1;
    const avg = Math.round((studentsAll.reduce((a, s) => a + (s.overallScore || 0), 0) / n) * 10) / 10;
    const high = studentsAll.filter((s) => s.contributionLevel === "high").length;
    return { n, avg, high };
  }, [studentsAll]);

  // simple helpers
  const toggleId = (id) =>
    setPickedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const pickAll = () => setPickedIds(studentsAll.map((s) => s.id));
  const clearAll = () => setPickedIds([]);

  function exportNow() {
    // placeholder export (real export can call backend or html2pdf later)
    const payload = {
      format: fmt,
      include: inc,
      projectId: project.id,
      studentIds: pickedIds,
    };
    console.log("EXPORT payload", payload);
    alert(`exporting ${fmt.toUpperCase()} for ${pickedIds.length} students… (see console)`);
  }

  return (
    <div style={ui.wrap}>
      {/* title */}
      <div style={ui.headRow}>
        <div>
          <div style={ui.titleRow}>
            <span style={ui.titleIcon}>📥</span>
            <h1 style={ui.h1}>Export Assessment Report</h1>
          </div>
          <div style={ui.muted}>Generate comprehensive reports of student contribution assessments</div>
        </div>
      </div>

      <div style={ui.grid}>
        {/* left column */}
        <div style={ui.colLeft}>
          {/* formats */}
          <div style={ui.card}>
            <div style={ui.cardHead}>Export Format</div>
            <div style={ui.mutedSmall}>Choose the format for your assessment report</div>

            <div style={ui.formatGrid}>
              <FormatBox
                active={fmt === "pdf"}
                onClick={() => setFmt("pdf")}
                title="PDF Report"
                sub="Formatted document with charts"
              />
              <FormatBox
                active={fmt === "docx"}
                onClick={() => setFmt("docx")}
                title="Word Document"
                sub="Editable DOCX format"
              />
              <FormatBox
                active={fmt === "csv"}
                onClick={() => setFmt("csv")}
                title="CSV Data"
                sub="Raw data for analysis"
              />
              <FormatBox
                active={fmt === "xlsx"}
                onClick={() => setFmt("xlsx")}
                title="Excel Workbook"
                sub="Multi-sheet analysis"
              />
            </div>
          </div>

          {/* include sections */}
          <div style={ui.card}>
            <div style={ui.cardHead}>Include in Report</div>
            <div style={ui.mutedSmall}>Select which sections to include in the exported report</div>

            <CheckRow
              label="Contribution Charts & Visualizations"
              checked={inc.charts}
              onChange={(v) => setInc((s) => ({ ...s, charts: v }))}
            />
            <CheckRow
              label="Activity Timeline & Evidence"
              checked={inc.timeline}
              onChange={(v) => setInc((s) => ({ ...s, timeline: v }))}
            />
            <CheckRow
              label="Rule Weights & Calculation Methods"
              checked={inc.rules}
              onChange={(v) => setInc((s) => ({ ...s, rules: v }))}
            />
            <CheckRow
              label="Triangulation Analysis & Validation"
              checked={inc.validation}
              onChange={(v) => setInc((s) => ({ ...s, validation: v }))}
            />
          </div>

          {/* student selection */}
          <div style={ui.card}>
            <div style={ui.cardHead}>Student Selection</div>
            <div style={ui.mutedSmall}>Choose which students to include in the report</div>

            <div style={ui.selActions}>
              <button style={ui.linkBtn} onClick={pickAll}>Select All</button>
              <button style={ui.linkBtn} onClick={clearAll}>Clear Selection</button>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {studentsAll.map((s) => (
                <div key={s.id} style={ui.studentRow}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={pickedIds.includes(s.id)}
                      onChange={() => toggleId(s.id)}
                    />
                    <div style={{ lineHeight: 1.2 }}>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      <div style={ui.mutedSmall}>{s.email}</div>
                    </div>
                  </label>
                  <ScorePill score={s.overallScore} />
                </div>
              ))}
            </div>

            {pickedIds.length === 0 && (
              <div style={{ ...ui.mutedSmall, marginTop: 8 }}>
                No students selected. All students will be included in the report.
              </div>
            )}
          </div>
        </div>

        {/* right column */}
        <div style={ui.colRight}>
          {/* summary */}
          <div style={ui.card}>
            <div style={ui.cardHead}>Report Summary</div>
            <div style={ui.mutedSmall}>Preview of what will be included</div>

            <div style={ui.summaryProj}>
              <div style={{ fontWeight: 700 }}>{project.name}</div>
              <div style={ui.mutedSmall}>{project.description}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 12, fontSize: 12, color: "#334155" }}>
                <span>📅 {project.startDate} – {project.endDate}</span>
              </div>
            </div>

            <div style={ui.summaryKV}>
              <KV label="Students" value={summary.n} />
              <KV label="Average Score" value={`${summary.avg}%`} colored />
              <KV label="High Performers" value={summary.high} />
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Sections included:</div>
              <ul style={ui.ul}>
                {inc.charts && <li>Student scores and rankings</li>}
                {inc.charts && <li>Charts and visualizations</li>}
                {inc.timeline && <li>Activity timeline</li>}
                {inc.rules && <li>Assessment rules</li>}
                {inc.validation && <li>Data validation</li>}
                {!inc.charts && !inc.timeline && !inc.rules && !inc.validation && (
                  <li>None selected</li>
                )}
              </ul>
            </div>
          </div>

          {/* export button */}
          <div style={ui.card}>
            <button style={ui.exportBtn} onClick={exportNow}>
              ⬇️ Export {fmt.toUpperCase()} Report
            </button>
            <div style={ui.mutedSmall}>Report will be downloaded to your device</div>
          </div>

          {/* current rules */}
          <div style={ui.card}>
            <div style={ui.cardHead}>Current Rules</div>
            <div style={ui.mutedSmall}>Assessment weights being applied</div>
            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
              {mockrules.map((r) => (
                <div key={r.id} style={ui.ruleRow}>
                  <div>{r.name}</div>
                  <div style={ui.rulePct}>{r.weight}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- small pieces ---------- */

function FormatBox({ active, onClick, title, sub }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...ui.fmtBox,
        ...(active ? ui.fmtActive : null),
      }}
    >
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={ui.mutedTiny}>{sub}</div>
    </button>
  );
}

function CheckRow({ label, checked, onChange }) {
  return (
    <label style={ui.checkRow}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function KV({ label, value, colored }) {
  return (
    <div style={ui.kvRow}>
      <div style={ui.mutedTiny}>{label}</div>
      <div style={{ fontWeight: 700, color: colored ? "#16a34a" : "#111827" }}>{value}</div>
    </div>
  );
}

function ScorePill({ score = 0 }) {
  const c = scoreColor(score);
  return (
    <span style={{ ...ui.pill, color: c.text, background: c.bg }}>{score}%</span>
  );
}

function scoreColor(n) {
  if (n >= 90) return { text: "#065f46", bg: "#ecfdf5" };
  if (n >= 80) return { text: "#166534", bg: "#dcfce7" };
  if (n >= 70) return { text: "#1d4ed8", bg: "#dbeafe" };
  if (n >= 60) return { text: "#92400e", bg: "#fffbeb" };
  if (n >= 50) return { text: "#9a3412", bg: "#fff7ed" };
  return { text: "#991b1b", bg: "#fef2f2" };
}

/* ---------- styles ---------- */

const ui = {
  wrap: { padding: "72px 16px 24px", maxWidth: 1140, margin: "0 auto" },
  headRow: { marginBottom: 10 },
  titleRow: { display: "flex", alignItems: "center", gap: 10 },
  titleIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    background: "#111827",
    color: "#fff",
    fontSize: 16,
  },
  h1: { margin: 0, fontSize: 22, fontWeight: 800 },
  muted: { color: "#6b7280", fontSize: 13 },
  mutedSmall: { color: "#94a3b8", fontSize: 12 },
  mutedTiny: { color: "#94a3b8", fontSize: 11 },
  grid: { display: "grid", gap: 16, gridTemplateColumns: "1fr 320px", alignItems: "start" },
  colLeft: { display: "grid", gap: 12 },
  colRight: { display: "grid", gap: 12 },

  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 6px 14px rgba(0,0,0,.04)",
  },
  cardHead: { fontWeight: 700, marginBottom: 6 },

  formatGrid: { display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" },
  fmtBox: {
    textAlign: "left",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    background: "#fff",
    cursor: "pointer",
  },
  fmtActive: { borderColor: "#111827", boxShadow: "0 0 0 2px #11182710 inset" },

  checkRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0",
    borderTop: "1px solid #f1f5f9",
    fontSize: 14,
  },

  selActions: { display: "flex", gap: 12, margin: "6px 0 10px" },
  linkBtn: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 10,
    padding: "6px 10px",
    fontSize: 12,
    cursor: "pointer",
  },

  studentRow: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  summaryProj: { marginTop: 8 },
  summaryKV: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  },
  ul: { margin: 0, paddingLeft: 18, color: "#334155", fontSize: 13 },

  exportBtn: {
    width: "100%",
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "12px 14px",
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 6,
  },

  ruleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "8px 10px",
  },
  rulePct: { fontWeight: 700, color: "#ef4444" },

  pill: {
    display: "inline-block",
    padding: "2px 8px",
    fontSize: 12,
    borderRadius: 999,
    border: "1px solid transparent",
  },
};
