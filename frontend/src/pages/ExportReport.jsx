import React, { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";

const API = "http://localhost:5002";

export default function ExportReport({ darkMode }) {
  const [selectedFormat, setSelectedFormat] = useState("pdf");
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [team, setTeam] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeTimeline, setIncludeTimeline] = useState(true);
  const [includeRules, setIncludeRules] = useState(true);
  const [includeTriangulation, setIncludeTriangulation] = useState(true);

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

  const currentRules = [
    { name: "Code Commits", weight: "30%" },
    { name: "Work Log Hours", weight: "25%" },
    { name: "Documentation", weight: "20%" },
    { name: "Meeting Participation", weight: "15%" },
    { name: "Code Review", weight: "10%" },
  ];

  const loadTeam = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const activeRes = await fetch(`${API}/api/teams/active`);
      const activeData = await activeRes.json();

      const teamsRes = await fetch(`${API}/api/teams`);
      const teamsData = await teamsRes.json();

      const activeTeam = (teamsData || []).find(
        (t) => t.id === activeData?.teamId
      );

      const teamStudents = activeTeam?.students || [];

      setTeam(activeTeam || null);
      setStudents(teamStudents);

      setSelectedStudents((prev) =>
        prev.filter((email) => teamStudents.some((s) => s.email === email))
      );
    } catch (err) {
      console.error("Failed to load export team data:", err);
      setTeam(null);
      setStudents([]);
      setSelectedStudents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTeam();
  }, []);

  const handleRefresh = async () => {
    await loadTeam(true);
  };

  const toggleStudent = (email) => {
    setSelectedStudents((prev) =>
      prev.includes(email)
        ? prev.filter((s) => s !== email)
        : [...prev, email]
    );
  };

  const selectAll = () => {
    setSelectedStudents(students.map((s) => s.email));
  };

  const clearSelection = () => {
    setSelectedStudents([]);
  };

  const isAtRisk = (student) => {
    const lowScore = typeof student.score === "number" && student.score < 40;
    const missingUploads =
      typeof student.missingUploads === "number" && student.missingUploads > 1;
    const lowAttendance =
      typeof student.attendanceRate === "number" &&
      student.attendanceRate < 60;

    return lowScore || missingUploads || lowAttendance;
  };

  const atRiskCount = useMemo(() => {
    return students.filter((student) => isAtRisk(student)).length;
  }, [students]);

  const averageScore = useMemo(() => {
    const withScores = students.filter((s) => typeof s.score === "number");
    if (!withScores.length) return "N/A";

    const avg =
      withScores.reduce((sum, s) => sum + s.score, 0) / withScores.length;

    return `${Math.round(avg)}%`;
  }, [students]);

  const exportStudents = useMemo(() => {
    if (selectedStudents.length === 0) return students;
    return students.filter((student) =>
      selectedStudents.includes(student.email)
    );
  }, [students, selectedStudents]);

  const getFileBaseName = () => {
    const safeTeamName = (team?.name || "team-report")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    return `${safeTeamName}-${selectedFormat}-report`;
  };

  const getIncludedSectionsText = () => {
    const sections = [];

    if (includeCharts) sections.push("Contribution Charts & Visualizations");
    if (includeTimeline) sections.push("Activity Timeline & Evidence");
    if (includeRules) sections.push("Rule Weights & Calculation Methods");
    if (includeTriangulation)
      sections.push("Triangulation Analysis & Validation");

    return sections;
  };

  const getExportRows = () => {
    return exportStudents.map((student, index) => ({
      No: index + 1,
      Name: student.name || "",
      Email: student.email || "",
      Role: student.role || "Member",
      Score: typeof student.score === "number" ? `${student.score}%` : "--",
      "Attendance Rate":
        typeof student.attendanceRate === "number"
          ? `${student.attendanceRate}%`
          : "--",
      "Missing Uploads":
        typeof student.missingUploads === "number"
          ? student.missingUploads
          : "--",
      "At Risk": isAtRisk(student) ? "Yes" : "No",
    }));
  };

  const exportCSV = () => {
    const rows = getExportRows();
    const headers = Object.keys(
      rows[0] || {
        No: "",
        Name: "",
        Email: "",
        Role: "",
        Score: "",
        "Attendance Rate": "",
        "Missing Uploads": "",
        "At Risk": "",
      }
    );

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    saveAs(blob, `${getFileBaseName()}.csv`);
  };

  const exportExcel = () => {
    const rows = getExportRows();
    const workbook = XLSX.utils.book_new();

    const reportSummary = [
      { Field: "Team Name", Value: team?.name || "No Active Team" },
      { Field: "Team Code", Value: team?.code || "-" },
      { Field: "Repository", Value: team?.repo?.url || "Not connected" },
      { Field: "Students Included", Value: exportStudents.length },
      { Field: "Average Score", Value: averageScore },
      { Field: "At Risk Count", Value: atRiskCount },
    ];

    const sectionRows = getIncludedSectionsText().map((item) => ({
      Section: item,
    }));

    const rulesRows = currentRules.map((rule) => ({
      Rule: rule.name,
      Weight: rule.weight,
    }));

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(reportSummary),
      "Summary"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(rows),
      "Students"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(sectionRows),
      "Sections"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(rulesRows),
      "Rules"
    );

    XLSX.writeFile(workbook, `${getFileBaseName()}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    const addLine = (text, size = 12, isBold = false, gap = 8) => {
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      doc.setFontSize(size);

      const lines = doc.splitTextToSize(text, pageWidth - 20);
      doc.text(lines, 10, y);
      y += lines.length * 6 + gap;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    };

    addLine("Export Assessment Report", 18, true, 10);
    addLine(
      `Team: ${team?.name || "No Active Team"} ${
        team?.code ? `(${team.code})` : ""
      }`,
      12,
      true,
      6
    );
    addLine(`Repository: ${team?.repo?.url || "Not connected"}`, 11, false, 6);
    addLine(`Students Included: ${exportStudents.length}`, 11, false, 3);
    addLine(`Average Score: ${averageScore}`, 11, false, 3);
    addLine(`At Risk Count: ${atRiskCount}`, 11, false, 8);

    addLine("Sections Included", 13, true, 6);
    getIncludedSectionsText().forEach((section) => {
      addLine(`• ${section}`, 11, false, 2);
    });

    y += 4;
    addLine("Assessment Rules", 13, true, 6);
    currentRules.forEach((rule) => {
      addLine(`• ${rule.name}: ${rule.weight}`, 11, false, 2);
    });

    y += 4;
    addLine("Student Details", 13, true, 6);

    exportStudents.forEach((student, index) => {
      addLine(
        `${index + 1}. ${student.name || "Unnamed Student"} (${
          student.email || "No email"
        })`,
        11,
        true,
        2
      );
      addLine(`Role: ${student.role || "Member"}`, 10, false, 1);
      addLine(
        `Score: ${
          typeof student.score === "number" ? `${student.score}%` : "--"
        }`,
        10,
        false,
        1
      );
      addLine(
        `Attendance Rate: ${
          typeof student.attendanceRate === "number"
            ? `${student.attendanceRate}%`
            : "--"
        }`,
        10,
        false,
        1
      );
      addLine(
        `Missing Uploads: ${
          typeof student.missingUploads === "number"
            ? student.missingUploads
            : "--"
        }`,
        10,
        false,
        1
      );
      addLine(`At Risk: ${isAtRisk(student) ? "Yes" : "No"}`, 10, false, 4);
    });

    doc.save(`${getFileBaseName()}.pdf`);
  };

  const exportWord = async () => {
    const sectionsText = getIncludedSectionsText();

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              heading: HeadingLevel.TITLE,
              children: [
                new TextRun({
                  text: "Export Assessment Report",
                  bold: true,
                  size: 32,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Team: ${team?.name || "No Active Team"} ${
                    team?.code ? `(${team.code})` : ""
                  }`,
                  bold: true,
                }),
              ],
            }),
            new Paragraph(`Repository: ${team?.repo?.url || "Not connected"}`),
            new Paragraph(`Students Included: ${exportStudents.length}`),
            new Paragraph(`Average Score: ${averageScore}`),
            new Paragraph(`At Risk Count: ${atRiskCount}`),

            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [
                new TextRun({ text: "Sections Included", bold: true }),
              ],
            }),
            ...sectionsText.map(
              (section) =>
                new Paragraph({
                  children: [new TextRun(`• ${section}`)],
                })
            ),

            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [
                new TextRun({ text: "Assessment Rules", bold: true }),
              ],
            }),
            ...currentRules.map(
              (rule) =>
                new Paragraph({
                  children: [new TextRun(`• ${rule.name}: ${rule.weight}`)],
                })
            ),

            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: "Student Details", bold: true })],
            }),

            ...exportStudents.flatMap((student, index) => [
              new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [
                  new TextRun({
                    text: `${index + 1}. ${
                      student.name || "Unnamed Student"
                    }`,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph(`Email: ${student.email || "No email"}`),
              new Paragraph(`Role: ${student.role || "Member"}`),
              new Paragraph(
                `Score: ${
                  typeof student.score === "number" ? `${student.score}%` : "--"
                }`
              ),
              new Paragraph(
                `Attendance Rate: ${
                  typeof student.attendanceRate === "number"
                    ? `${student.attendanceRate}%`
                    : "--"
                }`
              ),
              new Paragraph(
                `Missing Uploads: ${
                  typeof student.missingUploads === "number"
                    ? student.missingUploads
                    : "--"
                }`
              ),
              new Paragraph(`At Risk: ${isAtRisk(student) ? "Yes" : "No"}`),
            ]),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${getFileBaseName()}.docx`);
  };

  const handleExport = async () => {
    try {
      setExporting(true);

      if (!team && students.length === 0) {
        alert("No team data available to export.");
        return;
      }

      switch (selectedFormat) {
        case "csv":
          exportCSV();
          break;
        case "excel":
          exportExcel();
          break;
        case "pdf":
          exportPDF();
          break;
        case "word":
          await exportWord();
          break;
        default:
          alert("Unsupported export format.");
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please check the console for details.");
    } finally {
      setExporting(false);
    }
  };

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
      <div
        style={{
          minHeight: "100vh",
          background: theme.pageBg,
          color: theme.text,
          padding: "24px",
        }}
      >
        Loading export data...
      </div>
    );
  }

  return (
    <div
      style={{
        background: theme.pageBg,
        minHeight: "100vh",
        padding: "24px",
        color: theme.text,
      }}
    >
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        <div
          style={{
            ...cardStyle,
            marginBottom: "20px",
            padding: "26px 24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "#000",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                fontWeight: 700,
              }}
            >
              ↓
            </div>

            <div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: 800,
                  color: theme.text,
                  marginBottom: "4px",
                }}
              >
                Export Assessment Report
              </div>

              <div style={{ fontSize: "15px", color: theme.subtext }}>
                Generate comprehensive reports of student contribution assessments
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.1fr 1fr",
            gap: "20px",
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={cardStyle}>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: theme.text,
                  marginBottom: "6px",
                }}
              >
                Export Format
              </div>

              <div
                style={{
                  fontSize: "15px",
                  color: theme.subtext,
                  marginBottom: "18px",
                }}
              >
                Choose the format for your assessment report
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "14px",
                }}
              >
                {[
                  ["pdf", "PDF Report", "Formatted document with charts"],
                  ["word", "Word Document", "Editable DOCX format"],
                  ["csv", "CSV Data", "Raw data for analysis"],
                  ["excel", "Excel Workbook", "Multi-sheet analysis"],
                ].map(([value, title, desc]) => (
                  <div
                    key={value}
                    onClick={() => setSelectedFormat(value)}
                    style={{
                      ...smallCardStyle,
                      border:
                        selectedFormat === value
                          ? "2px solid #9ca3af"
                          : `1px solid ${theme.border}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        marginBottom: "6px",
                        color: theme.text,
                      }}
                    >
                      {title}
                    </div>

                    <div style={{ fontSize: "14px", color: theme.subtext }}>
                      {desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: theme.text,
                  marginBottom: "6px",
                }}
              >
                Include in Report
              </div>

              <div
                style={{
                  fontSize: "15px",
                  color: theme.subtext,
                  marginBottom: "18px",
                }}
              >
                Select which sections to include in the exported report
              </div>

              <div style={{ display: "grid", gap: "12px", fontSize: "15px" }}>
                <label>
                  <input
                    type="checkbox"
                    checked={includeCharts}
                    onChange={(e) => setIncludeCharts(e.target.checked)}
                  />{" "}
                  Contribution Charts & Visualizations
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={includeTimeline}
                    onChange={(e) => setIncludeTimeline(e.target.checked)}
                  />{" "}
                  Activity Timeline & Evidence
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={includeRules}
                    onChange={(e) => setIncludeRules(e.target.checked)}
                  />{" "}
                  Rule Weights & Calculation Methods
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={includeTriangulation}
                    onChange={(e) => setIncludeTriangulation(e.target.checked)}
                  />{" "}
                  Triangulation Analysis & Validation
                </label>
              </div>
            </div>

            <div style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "6px",
                }}
              >
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: theme.text,
                  }}
                >
                  Student Selection
                </div>

                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  title="Refresh"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: darkMode ? "#f8fafc" : "#000",
                    cursor: refreshing ? "not-allowed" : "pointer",
                    padding: "2px",
                    fontSize: "15px",
                    lineHeight: 1,
                    opacity: refreshing ? 0.5 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ↻
                </button>
              </div>

              <div
                style={{
                  fontSize: "15px",
                  color: theme.subtext,
                  marginBottom: "18px",
                }}
              >
                Choose which students to include in the report
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "24px",
                  fontSize: "15px",
                  fontWeight: 600,
                  marginBottom: "18px",
                }}
              >
                <button
                  onClick={selectAll}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontWeight: 700,
                    color: theme.text,
                  }}
                >
                  Select All
                </button>

                <button
                  onClick={clearSelection}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: theme.subtext,
                  }}
                >
                  Clear Selection
                </button>
              </div>

              <div style={{ display: "grid", gap: "10px" }}>
                {students.length ? (
                  students.map((student, index) => (
                    <div
                      key={student.email || index}
                      style={{
                        border: `1px solid ${theme.border}`,
                        borderRadius: "12px",
                        padding: "14px 16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: theme.cardAlt,
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          flex: 1,
                          minWidth: "260px",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.email)}
                          onChange={() => toggleStudent(student.email)}
                        />

                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "15px",
                                fontWeight: 600,
                                color: theme.text,
                              }}
                            >
                              {student.name}
                            </div>

                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: 700,
                                padding: "4px 8px",
                                borderRadius: "999px",
                                background: "#e0e7ff",
                                color: "#3730a3",
                              }}
                            >
                              {student.role || "Member"}
                            </div>

                            {isAtRisk(student) && (
                              <div
                                style={{
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                  padding: "4px 10px",
                                  borderRadius: "999px",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  border: "1px solid #ef4444",
                                }}
                              >
                                ⚠️ At Risk
                              </div>
                            )}
                          </div>

                          <div
                            style={{
                              fontSize: "14px",
                              color: theme.subtext,
                              marginTop: "4px",
                            }}
                          >
                            {student.email}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          border: `1px solid ${theme.softBorder}`,
                          borderRadius: "999px",
                          padding: "4px 10px",
                          fontSize: "14px",
                          fontWeight: 700,
                          color: theme.text,
                          minWidth: "52px",
                          textAlign: "center",
                          background: darkMode ? "#0f172a" : "#ffffff",
                        }}
                      >
                        {typeof student.score === "number"
                          ? `${student.score}%`
                          : "--"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: theme.subtext }}>
                    No students found in the active team.
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: "14px",
                  fontSize: "14px",
                  color: theme.subtext,
                  fontStyle: "italic",
                }}
              >
                {selectedStudents.length === 0
                  ? "No students selected. All students will be included in the report."
                  : `${selectedStudents.length} student(s) selected for export.`}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={cardStyle}>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: theme.text,
                  marginBottom: "6px",
                }}
              >
                Report Summary
              </div>

              <div
                style={{
                  fontSize: "15px",
                  color: theme.subtext,
                  marginBottom: "18px",
                  lineHeight: 1.4,
                }}
              >
                Preview of what will be included
              </div>

              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: theme.text,
                  lineHeight: 1.5,
                  marginBottom: "10px",
                }}
              >
                {team?.name || "No Active Team"}{" "}
                {team?.code ? `(${team.code})` : ""}
              </div>

              <div
                style={{
                  fontSize: "14px",
                  color: theme.subtext,
                  lineHeight: 1.5,
                  marginBottom: "18px",
                }}
              >
                Repository: {team?.repo?.url || "Not connected"}
              </div>

              {atRiskCount > 0 && (
                <div
                  style={{
                    marginBottom: "16px",
                    background: "#fee2e2",
                    color: "#b91c1c",
                    border: "1px solid #ef4444",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    fontWeight: 700,
                    fontSize: "14px",
                  }}
                >
                  ⚠️ {atRiskCount} student
                  {atRiskCount > 1 ? "s are" : " is"} currently flagged as at
                  risk
                </div>
              )}

              <hr
                style={{
                  border: "none",
                  borderTop: `1px solid ${theme.border}`,
                  margin: "16px 0",
                }}
              />

              <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
                <div style={summaryRowStyle}>
                  <span>Students:</span>
                  <strong>{students.length}</strong>
                </div>

                <div style={summaryRowStyle}>
                  <span>Average Score:</span>
                  <strong style={{ color: "#16a34a" }}>{averageScore}</strong>
                </div>

                <div style={summaryRowStyle}>
                  <span>Selected for Export:</span>
                  <strong>{exportStudents.length}</strong>
                </div>

                <div style={summaryRowStyle}>
                  <span>At Risk:</span>
                  <strong
                    style={{
                      color: atRiskCount > 0 ? "#dc2626" : theme.text,
                    }}
                  >
                    {atRiskCount}
                  </strong>
                </div>
              </div>

              <hr
                style={{
                  border: "none",
                  borderTop: `1px solid ${theme.border}`,
                  margin: "16px 0",
                }}
              />

              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  marginBottom: "10px",
                }}
              >
                Sections Included:
              </div>

              <ul
                style={{
                  margin: 0,
                  paddingLeft: "18px",
                  color: theme.subtext,
                  fontSize: "14px",
                  lineHeight: 1.7,
                }}
              >
                {getIncludedSectionsText().map((section) => (
                  <li key={section}>{section}</li>
                ))}
              </ul>
            </div>

            <div style={cardStyle}>
              <button
                onClick={handleExport}
                disabled={exporting || exportStudents.length === 0}
                style={{
                  width: "100%",
                  background:
                    exporting || exportStudents.length === 0 ? "#4b5563" : "#000",
                  color: "#fff",
                  border: "none",
                  borderRadius: "12px",
                  padding: "14px",
                  fontSize: "16px",
                  fontWeight: 700,
                  cursor:
                    exporting || exportStudents.length === 0
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {exporting
                  ? "Exporting..."
                  : `Export ${selectedFormat.toUpperCase()} Report`}
              </button>

              <div
                style={{
                  textAlign: "center",
                  fontSize: "13px",
                  color: theme.subtext,
                  marginTop: "10px",
                  lineHeight: 1.4,
                }}
              >
                Report will be downloaded to your device
              </div>
            </div>

            <div style={cardStyle}>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: theme.text,
                  marginBottom: "6px",
                }}
              >
                Current Rules
              </div>

              <div
                style={{
                  fontSize: "15px",
                  color: theme.subtext,
                  marginBottom: "18px",
                  lineHeight: 1.4,
                }}
              >
                Assessment weights being applied
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  fontSize: "15px",
                  color: theme.text,
                }}
              >
                {currentRules.map((rule) => (
                  <div
                    key={rule.name}
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span>{rule.name}:</span>
                    <strong>{rule.weight}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const summaryRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "15px",
};
