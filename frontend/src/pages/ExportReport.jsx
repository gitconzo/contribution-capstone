import React, { useState } from "react";

export default function ExportReport({ darkMode }) {
  const [selectedFormat, setSelectedFormat] = useState("pdf");
  const [selectedStudents, setSelectedStudents] = useState([]);

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
        buttonBg: "#111827",
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
        inputBg: "#ffffff",
        buttonBg: "#ffffff",
        shadow: "0 6px 14px rgba(0,0,0,.04)",
      };

  const students = [
    {
      id: 1,
      name: "Jen Mao",
      email: "103821194@student.swin.edu.au",
      score: 92,
    },
    {
      id: 2,
      name: "Connor Lack",
      email: "103992223@student.swin.edu.au",
      score: 89,
    },
    {
      id: 3,
      name: "Jason Vo",
      email: "103993653@student.swin.edu.au",
      score: 94,
    },
    {
      id: 4,
      name: "Kavindu Bhanuka Weragoda",
      email: "104860525@student.swin.edu.au",
      score: 73,
    },
    {
      id: 5,
      name: "Md Hridoy Mia",
      email: "105077229@student.swin.edu.au",
      score: 58,
    },
  ];

  const toggleStudent = (id) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedStudents(students.map((s) => s.id));
  };

  const clearSelection = () => {
    setSelectedStudents([]);
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

  return (
    <div
      style={{
        background: theme.pageBg,
        minHeight: "100vh",
        padding: "24px",
        color: theme.text,
      }}
    >
      <div
        style={{
          maxWidth: "1120px",
          margin: "0 auto",
        }}
      >
        {/* Header Card */}
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
              <div
                style={{
                  fontSize: "15px",
                  color: theme.subtext,
                }}
              >
                Generate comprehensive reports of student contribution assessments
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.1fr 1fr",
            gap: "20px",
            alignItems: "start",
          }}
        >
          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Export Format */}
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
                <div
                  onClick={() => setSelectedFormat("pdf")}
                  style={{
                    ...smallCardStyle,
                    border:
                      selectedFormat === "pdf"
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
                    PDF Report
                  </div>
                  <div style={{ fontSize: "14px", color: theme.subtext }}>
                    Formatted document with charts
                  </div>
                </div>

                <div
                  onClick={() => setSelectedFormat("word")}
                  style={{
                    ...smallCardStyle,
                    border:
                      selectedFormat === "word"
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
                    Word Document
                  </div>
                  <div style={{ fontSize: "14px", color: theme.subtext }}>
                    Editable DOCX format
                  </div>
                </div>

                <div
                  onClick={() => setSelectedFormat("csv")}
                  style={{
                    ...smallCardStyle,
                    border:
                      selectedFormat === "csv"
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
                    CSV Data
                  </div>
                  <div style={{ fontSize: "14px", color: theme.subtext }}>
                    Raw data for analysis
                  </div>
                </div>

                <div
                  onClick={() => setSelectedFormat("excel")}
                  style={{
                    ...smallCardStyle,
                    border:
                      selectedFormat === "excel"
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
                    Excel Workbook
                  </div>
                  <div style={{ fontSize: "14px", color: theme.subtext }}>
                    Multi-sheet analysis
                  </div>
                </div>
              </div>
            </div>

            {/* Include in Report */}
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

              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  fontSize: "15px",
                  color: theme.text,
                }}
              >
                <label>
                  <input type="checkbox" defaultChecked /> Contribution Charts & Visualizations
                </label>
                <label>
                  <input type="checkbox" defaultChecked /> Activity Timeline & Evidence
                </label>
                <label>
                  <input type="checkbox" defaultChecked /> Rule Weights & Calculation Methods
                </label>
                <label>
                  <input type="checkbox" defaultChecked /> Triangulation Analysis & Validation
                </label>
              </div>
            </div>

            {/* Student Selection */}
            <div style={cardStyle}>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: theme.text,
                  marginBottom: "6px",
                }}
              >
                Student Selection
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
                {students.map((student) => (
                  <div
                    key={student.id}
                    style={{
                      border: `1px solid ${theme.border}`,
                      borderRadius: "12px",
                      padding: "14px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: theme.cardAlt,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                      />
                      <div>
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
                            fontSize: "14px",
                            color: theme.subtext,
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
                      {student.score}%
                    </div>
                  </div>
                ))}
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

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Report Summary */}
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
                COS40005-Computing Technology Project A - Sprint 1
              </div>

              <div
                style={{
                  fontSize: "14px",
                  color: theme.subtext,
                  lineHeight: 1.5,
                  marginBottom: "18px",
                }}
              >
                Sprint 1: Project setup, requirements analysis, and initial development
                phase with team formation and technology stack selection
              </div>

              <hr
                style={{
                  border: "none",
                  borderTop: `1px solid ${theme.border}`,
                  margin: "16px 0",
                }}
              />

              <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "15px",
                    color: theme.text,
                  }}
                >
                  <span>Students:</span>
                  <strong>5</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "15px",
                    color: theme.text,
                  }}
                >
                  <span>Average Score:</span>
                  <strong style={{ color: "#16a34a" }}>81%</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "15px",
                    color: theme.text,
                  }}
                >
                  <span>High Performers:</span>
                  <strong>3</strong>
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
                  color: theme.text,
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
                <li>Student scores and rankings</li>
                <li>Charts and visualizations</li>
                <li>Activity timeline</li>
                <li>Assessment rules</li>
                <li>Data validation</li>
              </ul>
            </div>

            {/* Export Button */}
            <div style={cardStyle}>
              <button
                style={{
                  width: "100%",
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  borderRadius: "12px",
                  padding: "14px",
                  fontSize: "16px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Export PDF Report
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

            {/* Current Rules */}
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
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Code Commits:</span>
                  <strong>30%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Work Log Hours:</span>
                  <strong>25%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Documentation:</span>
                  <strong>20%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Meeting Participation:</span>
                  <strong>15%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Code Review:</span>
                  <strong>10%</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
