import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/api";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, HeadingLevel, TextRun, WidthType } from "docx";

const WEIGHT_KEY_LABELS = {
  loc:                "Lines of Code",
  editedCode:         "Total Edited Code",
  commits:            "Total Commits",
  functions:          "Total Functions Written",
  hotspots:           "Total Hotspot Contributed",
  codeComplexity:     "Code Complexity",
  avgSentenceLength:  "Average Sentence Length",
  sentenceComplexity: "Sentence Complexity",
  wordCount:          "Word Count",
  readability:        "Readability",
};

function formatWeightKey(key) {
  return WEIGHT_KEY_LABELS[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, firstChar => firstChar.toUpperCase());
}

// Which sections each format supports
const FORMAT_SUPPORTS = {
  pdf:   { charts: true,  timeline: true,  rules: true  },
  word:  { charts: false, timeline: true,  rules: true  },
  csv:   { charts: false, timeline: false, rules: false },
  excel: { charts: true,  timeline: false, rules: false },
};

export default function ExportReport({ darkMode }) {
  const [selectedFormat, setSelectedFormat] = useState("pdf");
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [sections, setSections] = useState({ charts: true, timeline: true, rules: true });
  const [team, setTeam] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const theme = darkMode
    ? {
        pageBg: "#0b1120",
        card: "#111827",
        cardAlt: "#0f172a",
        text: "#f8fafc",
        subtext: "#94a3b8",
        border: "#1f2937",
        softBorder: "#334155",
        shadow: "0 8px 20px rgba(0,0,0,.28)",
      }
    : {
        pageBg: "#f3f4f6",
        card: "#ffffff",
        cardAlt: "#ffffff",
        text: "#111827",
        subtext: "#6b7280",
        border: "#e5e7eb",
        softBorder: "#d1d5db",
        shadow: "0 6px 14px rgba(0,0,0,.04)",
      };

  useEffect(() => {
    const loadTeam = async () => {
      try {
        setLoading(true);
        const activeRes = await apiFetch(`/api/teams/active`);
        const activeData = await activeRes.json();
        const teamsRes = await apiFetch(`/api/teams`);
        const teamsData = await teamsRes.json();
        const teamId = activeData?.id;
        const activeTeam = (teamsData || []).find((t) => t.id === teamId);
        setTeam(activeTeam || null);
        setStudents(activeTeam?.students || []);
        if (teamId) {
          const scoresRes = await apiFetch(`/api/scores?teamId=${encodeURIComponent(teamId)}`);
          const scoresData = await scoresRes.json();
          setScores(scoresData);
          // Auto-select all students on first load
          if (scoresData?.ranking?.length) {
            setSelectedStudents(scoresData.ranking.map(s => s.email));
          }
        }
      } catch (err) {
        console.error("Failed to load export team data:", err);
        setTeam(null);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };
    loadTeam();
  }, []);

  const ranking = useMemo(() => scores?.ranking || [], [scores]);

  const filteredRanking = useMemo(() => {
    if (!selectedStudents.length) return ranking;
    return ranking.filter(student => selectedStudents.includes(student.email));
  }, [ranking, selectedStudents]);

  const toggleStudent = (email) => {
    setSelectedStudents((prev) =>
      prev.includes(email) ? prev.filter((existingEmail) => existingEmail !== email) : [...prev, email]
    );
  };

  const selectAll = () => setSelectedStudents(ranking.map((student) => student.email));
  const clearSelection = () => setSelectedStudents([]);

  const averageScore = useMemo(() => {
    if (!filteredRanking.length) return "N/A";
    const avg = filteredRanking.reduce((sum, student) => sum + (student.score || 0), 0) / filteredRanking.length;
    return `${Math.round(avg)}%`;
  }, [filteredRanking]);

  // Dynamic sections list shown in the Report Summary sidebar
  const sectionsIncluded = useMemo(() => {
    const supported = FORMAT_SUPPORTS[selectedFormat] || {};
    const list = ["Student scores and rankings"];
    if (sections.charts && supported.charts)   list.push("Charts and visualizations");
    if (sections.timeline && supported.timeline) list.push("Activity timeline & evidence");
    if (sections.rules && supported.rules)     list.push("Rule weights & calculation methods");
    return list;
  }, [sections, selectedFormat]);

  // PDF
  function generatePDF() {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();
    const teamLabel = `${team?.name || "Team"}${team?.code ? ` (${team.code})` : ""}`;
    const filename = `contribution_report_${team?.code || "team"}_${new Date().toISOString().slice(0, 10)}.pdf`;

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Contribution Assessment Report", 14, 20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(teamLabel, 14, 30);
    doc.text(`Generated: ${date}`, 14, 37);
    doc.text(`Students selected: ${filteredRanking.length}  |  Average score: ${averageScore}`, 14, 44);

    let y = 54;

    // Rankings table (always included)
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Student Rankings", 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Rank", "Name", "Email", "Score (%)", "Code", "Docs", "Attendance"]],
      body: filteredRanking.map((student, index) => {
        const breakdown = student.breakdown || {};
        const raw = student.raw || {};
        return [
          index + 1,
          student.name || "",
          student.email || "",
          (student.score || 0).toFixed(1),
          `${Math.round((breakdown.loc || 0) * 100)}`,
          `${Math.round((breakdown.wordCount || 0) * 100)}`,
          `${((raw.attendance || 0) * 100).toFixed(1)}`,
        ];
      }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [17, 24, 39] },
    });
    y = doc.lastAutoTable.finalY + 12;

    // Charts — horizontal bar chart per student
    if (sections.charts) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Contribution Overview", 14, y);
      y += 6;

      const barH = 8;
      const barGap = 3;
      const chartW = 120;
      const labelW = 38;
      const chartX = 14 + labelW;
      const scoreLabel = (score) => `${score.toFixed(1)}%`;

      filteredRanking.forEach((student) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const score = student.score || 0;
        const barW = (score / 100) * chartW;
        const [red, green, blue] = score >= 80 ? [22, 163, 74] : score >= 60 ? [202, 138, 4] : [220, 38, 38];

        // Background track
        doc.setFillColor(229, 231, 235);
        doc.rect(chartX, y, chartW, barH, "F");
        // Filled bar
        doc.setFillColor(red, green, blue);
        if (barW > 0) doc.rect(chartX, y, barW, barH, "F");
        // Name label
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40, 40, 40);
        doc.text((student.name || "").substring(0, 16), 14, y + 6);
        // Score label — inside bar if near full width, outside otherwise
        const labelText = scoreLabel(score);
        if (barW > chartW - 18) {
          doc.setTextColor(255, 255, 255);
          doc.text(labelText, chartX + barW - 2, y + 6, { align: "right" });
        } else {
          doc.setTextColor(40, 40, 40);
          doc.text(labelText, chartX + barW + 2, y + 6);
        }

        y += barH + barGap;
      });
      doc.setTextColor(0, 0, 0);
      y += 10;
    }

    // Rule weights table
    if (sections.rules && scores?.weights) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Rule Weights & Calculation Methods", 14, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [["Metric", "Weight"]],
        body: Object.entries(scores.weights).map(([key, val]) => [
          formatWeightKey(key),
          val,
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [17, 24, 39] },
        tableWidth: 100,
      });
      y = doc.lastAutoTable.finalY + 12;
    }

    // Activity timeline — per-student raw metric breakdown
    if (sections.timeline) {
      filteredRanking.forEach((student) => {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`${student.name || "Unknown"}  —  ${(student.score || 0).toFixed(1)}%`, 14, y);
        y += 4;

        const raw = student.raw || {};
        autoTable(doc, {
          startY: y,
          head: [["Metric", "Value"]],
          body: [
            ["Commits",          raw.commits   || 0],
            ["Lines of Code",    (raw.loc       || 0).toFixed(2)],
            ["Word Count",       raw.wordCount  || 0],
            ["Attendance",       `${((raw.attendance || 0) * 100).toFixed(1)}%`],
            ["Meetings",         raw.meetings   || 0],
            ["Edited Code",      (raw.editedCode|| 0).toFixed(2)],
          ],
          styles: { fontSize: 8 },
          headStyles: { fillColor: [55, 65, 81] },
          tableWidth: 110,
        });
        y = doc.lastAutoTable.finalY + 10;
      });
    }

    doc.save(filename);
  }

  // DOCX
  async function generateDOCX() {
    const date = new Date().toLocaleDateString();
    const teamLabel = `${team?.name || "Team"}${team?.code ? ` (${team.code})` : ""}`;
    const filename = `contribution_report_${team?.code || "team"}_${new Date().toISOString().slice(0, 10)}.docx`;

    const headerRow = (cols) =>
      new TableRow({
        children: cols.map(text =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
            width: { size: Math.floor(9000 / cols.length), type: WidthType.DXA },
          })
        ),
      });

    const dataRow = (cols) =>
      new TableRow({
        children: cols.map(text =>
          new TableCell({
            children: [new Paragraph({ text: String(text) })],
            width: { size: Math.floor(9000 / cols.length), type: WidthType.DXA },
          })
        ),
      });

    const children = [
      new Paragraph({ text: "Contribution Assessment Report", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: teamLabel }),
      new Paragraph({ text: `Generated: ${date}` }),
      new Paragraph({ text: `Students selected: ${filteredRanking.length}  |  Average score: ${averageScore}` }),
      new Paragraph({ text: "" }),
      new Paragraph({ text: "Student Rankings", heading: HeadingLevel.HEADING_2 }),
      new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [
          headerRow(["Rank", "Name", "Email", "Score (%)", "Attendance"]),
          ...filteredRanking.map((student, index) => {
            const raw = student.raw || {};
            return dataRow([
              index + 1,
              student.name || "",
              student.email || "",
              (student.score || 0).toFixed(1),
              `${((raw.attendance || 0) * 100).toFixed(1)}%`,
            ]);
          }),
        ],
      }),
      new Paragraph({ text: "" }),
    ];

    // Rule weights
    if (sections.rules && scores?.weights) {
      children.push(
        new Paragraph({ text: "Rule Weights & Calculation Methods", heading: HeadingLevel.HEADING_2 }),
        new Table({
          width: { size: 4500, type: WidthType.DXA },
          rows: [
            headerRow(["Metric", "Weight"]),
            ...Object.entries(scores.weights).map(([key, val]) =>
              dataRow([
                key.replace(/([A-Z])/g, " $1").replace(/^./, firstChar => firstChar.toUpperCase()),
                val,
              ])
            ),
          ],
        }),
        new Paragraph({ text: "" }),
      );
    }

    // Activity timeline - per-student breakdown
    if (sections.timeline) {
      children.push(new Paragraph({ text: "Activity Timeline & Evidence", heading: HeadingLevel.HEADING_2 }));
      filteredRanking.forEach((student) => {
        const raw = student.raw || {};
        children.push(
          new Paragraph({
            text: `${student.name || "Unknown"} — ${(student.score || 0).toFixed(1)}%`,
            heading: HeadingLevel.HEADING_3,
          }),
          new Table({
            width: { size: 4500, type: WidthType.DXA },
            rows: [
              headerRow(["Metric", "Value"]),
              ...([
                ["Commits",      raw.commits    || 0],
                ["Lines of Code",(raw.loc       || 0).toFixed(2)],
                ["Word Count",   raw.wordCount  || 0],
                ["Attendance",   `${((raw.attendance || 0) * 100).toFixed(1)}%`],
                ["Meetings",     raw.meetings   || 0],
                ["Edited Code",  (raw.editedCode|| 0).toFixed(2)],
              ].map(([metric, value]) => dataRow([metric, value]))),
            ],
          }),
          new Paragraph({ text: "" }),
        );
      });
    }

    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Main export handler
  const handleExport = async () => {
    setExportError("");

    if (selectedStudents.length === 0) {
      setExportError("Please select at least one student to include in the report.");
      return;
    }

    setExporting(true);
    try {
      if (selectedFormat === "pdf") {
        generatePDF();

      } else if (selectedFormat === "word") {
        await generateDOCX();

      } else if (selectedFormat === "excel") {
        const teamId = team?.id;
        if (!teamId) throw new Error("No active team");
        const selectedEmails = selectedStudents.length ? selectedStudents : ranking.map(s => s.email);
        const res = await apiFetch("/api/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId, selectedEmails, sections }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Export failed"); }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `contribution_report_${team?.code || teamId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);

      } else if (selectedFormat === "csv") {
        if (!filteredRanking.length) throw new Error("No data to export");
        const headers = [
          "Rank", "Name", "Email", "Overall Score (%)",
          "Code Commits", "Work Hours", "Documents", "Meetings",
          "Total Lines of Code (normalised)", "Total Edited Code (normalised)", "Total Commits (normalised)",
          "Total Functions Written (normalised)", "Total Hotspots Contributed (normalised)", "Code Complexity (normalised)",
          "Average Sentence Length (normalised)", "Sentence Complexity (normalised)",
          "Word Count (normalised)", "Readability (normalised)",
          "Total Lines of Code %", "Total Edited Code %", "Total Commits %",
          "Total Functions Written %", "Total Hotspots Contributed %",
          "Code Complexity (raw)", "Average Sentence Length (raw)", "Sentence Complexity (raw)",
          "Word Count (raw)", "Readability Score (raw)", "Attendance %",
        ];
        const rows = filteredRanking.map((student, index) => {
          const breakdown = student.breakdown || {};
          const raw = student.raw || {};
          return [
            index + 1, student.name || "", student.email || "", (student.score || 0).toFixed(1),
            raw.commits || 0, raw.hours || 0, raw.docCount || 0, raw.meetings || 0,
            Math.round((breakdown.loc || 0) * 100), Math.round((breakdown.editedCode || 0) * 100),
            Math.round((breakdown.commits || 0) * 100), Math.round((breakdown.functions || 0) * 100),
            Math.round((breakdown.hotspots || 0) * 100), Math.round((breakdown.codeComplexity || 0) * 100),
            Math.round((breakdown.avgSentenceLength || 0) * 100), Math.round((breakdown.sentenceComplexity || 0) * 100),
            Math.round((breakdown.wordCount || 0) * 100), Math.round((breakdown.readability || 0) * 100),
            (raw.loc || 0).toFixed(2), (raw.editedCode || 0).toFixed(2),
            (raw.commits || 0).toFixed(2), (raw.functions || 0).toFixed(2),
            (raw.hotspots || 0).toFixed(2), (raw.codeComplexity || 0).toFixed(3),
            (raw.avgSentenceLength || 0).toFixed(2), (raw.sentenceComplexity || 0).toFixed(3),
            raw.wordCount || 0, (raw.readability || 0).toFixed(2),
            ((raw.attendance || 0) * 100).toFixed(1),
          ];
        });
        const csv = [headers, ...rows]
          .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(","))
          .join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `contribution_report_${team?.code || "team"}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      setExportError(error.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  // styles 
  const cardStyle = {
    background: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: "18px",
    padding: "22px",
    boxSizing: "border-box",
    boxShadow: theme.shadow,
  };

  const smallCardStyle = {
    border: `1px solid ${theme.border}`,
    borderRadius: "14px",
    padding: "18px",
    background: theme.cardAlt,
    cursor: "pointer",
    minHeight: "96px",
    color: theme.text,
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: theme.pageBg }}>
        <div style={{
          width: 40, height: 40,
          border: `4px solid ${theme.border}`,
          borderTop: `4px solid ${darkMode ? "#f8fafc" : "#111827"}`,
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Render
  return (
    <div style={{ background: theme.pageBg, minHeight: "100vh", padding: "24px", color: theme.text }}>
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>

        {/* Page header */}
        <div style={{ ...cardStyle, marginBottom: "20px", padding: "26px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 700 }}>↓</div>
            <div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: theme.text, marginBottom: "4px" }}>Export Assessment Report</div>
              <div style={{ fontSize: "15px", color: theme.subtext }}>Generate comprehensive reports of student contribution assessments</div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2.1fr 1fr", gap: "20px", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Format selection */}
            <div style={cardStyle}>
              <div style={{ fontSize: "16px", fontWeight: 700, color: theme.text, marginBottom: "6px" }}>Export Format</div>
              <div style={{ fontSize: "15px", color: theme.subtext, marginBottom: "18px" }}>Choose the format for your assessment report</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                {[
                  ["pdf",   "PDF Report",      "Formatted document with charts"],
                  ["word",  "Word Document",   "Editable DOCX format"],
                  ["csv",   "CSV Data",        "Raw data for analysis"],
                  ["excel", "xlsx File",       "Excel sheet with graphs"],
                ].map(([value, title, desc]) => (
                  <div
                    key={value}
                    onClick={() => setSelectedFormat(value)}
                    style={{
                      ...smallCardStyle,
                      border: selectedFormat === value ? "2px solid #9ca3af" : `1px solid ${theme.border}`,
                    }}
                  >
                    <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "6px", color: theme.text }}>{title}</div>
                    <div style={{ fontSize: "14px", color: theme.subtext }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section toggles */}
            <div style={cardStyle}>
              <div style={{ fontSize: "16px", fontWeight: 700, color: theme.text, marginBottom: "6px" }}>Include in Report</div>
              <div style={{ fontSize: "15px", color: theme.subtext, marginBottom: "18px" }}>Select which sections to include in the exported report</div>
              <div style={{ display: "grid", gap: "12px", fontSize: "15px" }}>
                {[
                  ["charts",   "Contribution Charts & Visualizations"],
                  ["timeline", "Activity Timeline & Evidence"],
                  ["rules",    "Rule Weights & Calculation Methods"],
                ].map(([key, label]) => {
                  const supported = FORMAT_SUPPORTS[selectedFormat]?.[key] ?? false;
                  return (
                    <label
                      key={key}
                      style={{ display: "flex", alignItems: "center", gap: 8, color: supported ? theme.text : theme.subtext, cursor: supported ? "pointer" : "not-allowed" }}
                    >
                      <input
                        type="checkbox"
                        checked={sections[key]}
                        disabled={!supported}
                        onChange={(e) => setSections(prev => ({ ...prev, [key]: e.target.checked }))}
                      />
                      {label}
                      {!supported && (
                        <span style={{ fontSize: 12, color: theme.subtext, marginLeft: 4 }}>
                          (not available for {selectedFormat.toUpperCase()})
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Student selection */}
            <div style={cardStyle}>
              <div style={{ fontSize: "16px", fontWeight: 700, color: theme.text, marginBottom: "6px" }}>Student Selection</div>
              <div style={{ fontSize: "15px", color: theme.subtext, marginBottom: "18px" }}>Choose which students to include in the report</div>
              <div style={{ display: "flex", gap: "24px", fontSize: "15px", fontWeight: 600, marginBottom: "18px" }}>
                <button onClick={selectAll} style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 700, color: theme.text }}>Select All</button>
                <button onClick={clearSelection} style={{ border: "none", background: "transparent", cursor: "pointer", color: theme.subtext }}>Clear Selection</button>
              </div>
              <div style={{ display: "grid", gap: "10px" }}>
                {ranking.length ? (
                  ranking.map((student) => (
                    <div
                      key={student.email}
                      style={{ border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: theme.cardAlt }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.email)}
                          onChange={() => toggleStudent(student.email)}
                        />
                        <div>
                          <div style={{ fontSize: "15px", fontWeight: 600, color: theme.text }}>{student.name}</div>
                          <div style={{ fontSize: "14px", color: theme.subtext }}>{student.email}</div>
                        </div>
                      </div>
                      <div style={{ border: `1px solid ${theme.softBorder}`, borderRadius: "999px", padding: "4px 10px", fontSize: "14px", fontWeight: 700, color: theme.text, minWidth: "52px", textAlign: "center", background: darkMode ? "#0f172a" : "#ffffff" }}>
                        {typeof student.score === "number" ? `${student.score}%` : "--"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: theme.subtext }}>No students found in the active team.</div>
                )}
              </div>
              <div style={{ marginTop: "14px", fontSize: "14px", fontStyle: "italic", color: selectedStudents.length === 0 ? "#dc2626" : theme.subtext }}>
                {selectedStudents.length === 0
                  ? "No students selected. Please select at least one student."
                  : `${selectedStudents.length} student(s) selected for export.`}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Report summary */}
            <div style={cardStyle}>
              <div style={{ fontSize: "16px", fontWeight: 700, color: theme.text, marginBottom: "6px" }}>Report Summary</div>
              <div style={{ fontSize: "15px", color: theme.subtext, marginBottom: "18px", lineHeight: 1.4 }}>Preview of what will be included</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: theme.text, lineHeight: 1.5, marginBottom: "10px" }}>
                {team?.name || "No Active Team"} {team?.code ? `(${team.code})` : ""}
              </div>
              <div style={{ fontSize: "14px", color: theme.subtext, lineHeight: 1.5, marginBottom: "18px" }}>
                Repository: {team?.repo?.url || "Not connected"}
              </div>
              <hr style={{ border: "none", borderTop: `1px solid ${theme.border}`, margin: "16px 0" }} />
              <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px" }}>
                  <span>Students:</span><strong>{students.length}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px" }}>
                  <span>Average Score:</span><strong style={{ color: "#16a34a" }}>{averageScore}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px" }}>
                  <span>Selected for Export:</span><strong>{selectedStudents.length || students.length}</strong>
                </div>
              </div>
              <hr style={{ border: "none", borderTop: `1px solid ${theme.border}`, margin: "16px 0" }} />
              <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "10px" }}>Sections Included:</div>
              <ul style={{ margin: 0, paddingLeft: "18px", color: theme.subtext, fontSize: "14px", lineHeight: 1.7 }}>
                {sectionsIncluded.map(section => <li key={section}>{section}</li>)}
              </ul>
            </div>

            {/* Export button */}
            <div style={cardStyle}>
              {exportError && (
                <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "12px" }}>
                  {exportError}
                </div>
              )}
              <button
                onClick={handleExport}
                disabled={exporting || selectedStudents.length === 0}
                style={{ width: "100%", background: (exporting || selectedStudents.length === 0) ? "#6b7280" : "#000", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "16px", fontWeight: 700, cursor: (exporting || selectedStudents.length === 0) ? "not-allowed" : "pointer" }}
              >
                {exporting ? "Exporting..." : `Export ${selectedFormat.toUpperCase()} Report`}
              </button>
              <div style={{ textAlign: "center", fontSize: "13px", color: theme.subtext, marginTop: "10px", lineHeight: 1.4 }}>
                Report will be downloaded to your device
              </div>
            </div>

            {/* Current rules */}
            <div style={cardStyle}>
              <div style={{ fontSize: "16px", fontWeight: 700, color: theme.text, marginBottom: "6px" }}>Current Rules</div>
              <div style={{ fontSize: "15px", color: theme.subtext, marginBottom: "18px", lineHeight: 1.4 }}>Assessment weights being applied</div>
              <div style={{ display: "grid", gap: "12px", fontSize: "15px", color: theme.text }}>
                {scores?.weights ? (
                  Object.entries(scores.weights).map(([key, val]) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{formatWeightKey(key)}</span>
                      <strong>{val}</strong>
                    </div>
                  ))
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Code Commits:</span><strong>30%</strong></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Work Log Hours:</span><strong>25%</strong></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Documentation:</span><strong>20%</strong></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Meeting Participation:</span><strong>15%</strong></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Code Review:</span><strong>10%</strong></div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
