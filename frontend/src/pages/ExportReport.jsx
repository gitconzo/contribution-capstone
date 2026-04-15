import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/api";

export default function ExportReport({ darkMode }) {
  const [selectedFormat, setSelectedFormat] = useState("pdf");
  const [selectedStudents, setSelectedStudents] = useState([]);
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
    return ranking.filter(s => selectedStudents.includes(s.email));
  }, [ranking, selectedStudents]);

  const toggleStudent = (email) => {
    setSelectedStudents((prev) =>
      prev.includes(email) ? prev.filter((s) => s !== email) : [...prev, email]
    );
  };

  const selectAll = () => {
    setSelectedStudents(students.map((s) => s.email));
  };

  const clearSelection = () => {
    setSelectedStudents([]);
  };

   const averageScore = useMemo(() => {
    const list = ranking.length ? ranking : [];
    if (!list.length) return "N/A";
    const avg = list.reduce((sum, s) => sum + (s.score || 0), 0) / list.length;
    return `${Math.round(avg)}%`;
  }, [ranking]);

  const handleExport = async () => {
  setExportError("");
  setExporting(true);
  try {
    if (selectedFormat === "excel") {
      const teamId = team?.id;
      if (!teamId) throw new Error("No active team");
      const res = await apiFetch(`/api/export?teamId=${encodeURIComponent(teamId)}`);
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
        "Rank","Name","Email","Overall Score (%)",
        "Code Commits","Work Hours","Documents","Meetings",
        "Total Lines of Code (normalised)","Total Edited Code (normalised)","Total Commits (normalised)",
        "Total Functions Written (normalised)","Total Hotspots Contributed (normalised)","Code Complexity (normalised)",
        "Average Sentence Length (normalised)","Sentence Complexity (normalised)",
        "Word Count (normalised)","Readability (normalised)",
        "Total Lines of Code %","Total Edited Code %","Total Commits %",
        "Total Functions Written %","Total Hotspots Contributed %",
        "Code Complexity (raw)","Average Sentence Length (raw)","Sentence Complexity (raw)",
        "Word Count (raw)","Readability Score (raw)","Attendance %"
      ];
      const rows = filteredRanking.map((s, i) => {
        const b = s.breakdown || {};
        const r = s.raw || {};
        return [
          i+1, s.name||"", s.email||"", (s.score||0).toFixed(1),
          r.commits||0, r.hours||0, r.docCount||0, r.meetings||0,
          Math.round((b.loc||0)*100), Math.round((b.editedCode||0)*100),
          Math.round((b.commits||0)*100), Math.round((b.functions||0)*100),
          Math.round((b.hotspots||0)*100), Math.round((b.codeComplexity||0)*100),
          Math.round((b.avgSentenceLength||0)*100), Math.round((b.sentenceComplexity||0)*100),
          Math.round((b.wordCount||0)*100), Math.round((b.readability||0)*100),
          (r.loc||0).toFixed(2), (r.editedCode||0).toFixed(2),
          (r.commits||0).toFixed(2), (r.functions||0).toFixed(2),
          (r.hotspots||0).toFixed(2), (r.codeComplexity||0).toFixed(3),
          (r.avgSentenceLength||0).toFixed(2), (r.sentenceComplexity||0).toFixed(3),
          r.wordCount||0, (r.readability||0).toFixed(2),
          ((r.attendance||0)*100).toFixed(1),
        ];
      });
      const csv = [headers, ...rows]
        .map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contribution_report_${team?.code||"team"}_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      setExportError(`${selectedFormat.toUpperCase()} export is not yet implemented.`);
    }
  } catch (e) {
    setExportError(e.message || "Export failed");
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
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: theme.pageBg }}>
        <div style={{
          width: 40,
          height: 40,
          border: `4px solid ${theme.border}`,
          borderTop: `4px solid ${darkMode ? "#f8fafc" : "#111827"}`,
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
      <div
        style={{
          maxWidth: "1120px",
          margin: "0 auto",
        }}
      >
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
                  ["excel", "xlsx File", "Excel sheet with graphs"],
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
                    <div style={{ fontSize: "14px", color: theme.subtext }}>{desc}</div>
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
                <label><input type="checkbox" defaultChecked /> Contribution Charts & Visualizations</label>
                <label><input type="checkbox" defaultChecked /> Activity Timeline & Evidence</label>
                <label><input type="checkbox" defaultChecked /> Rule Weights & Calculation Methods</label>
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
                {ranking.length ? (
                  ranking.map((student) => (
                    <div key={student.email} style={{ 
                      border: `1px solid ${theme.border}`, 
                      borderRadius: "12px", 
                      padding: "14px 16px", 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", 
                      background: theme.cardAlt }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.email)}
                          onChange={() => toggleStudent(student.email)}
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
                        {typeof student.score === "number" ? `${student.score}%` : "--"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: theme.subtext }}>No students found in the active team.</div>
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
                {team?.name || "No Active Team"} {team?.code ? `(${team.code})` : ""}
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

              <hr
                style={{
                  border: "none",
                  borderTop: `1px solid ${theme.border}`,
                  margin: "16px 0",
                }}
              />

              <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px" }}>
                  <span>Students:</span>
                  <strong>{students.length}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px" }}>
                  <span>Average Score:</span>
                  <strong style={{ color: "#16a34a" }}>{averageScore}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px" }}>
                  <span>Selected for Export:</span>
                  <strong>{selectedStudents.length || students.length}</strong>
                </div>
              </div>

              <hr
                style={{
                  border: "none",
                  borderTop: `1px solid ${theme.border}`,
                  margin: "16px 0",
                }}
              />

              <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "10px" }}>
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

            <div style={cardStyle}>
              {exportError && (
                <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "12px" }}>
                {exportError}
                </div>
              )}
              <button
                onClick={handleExport}
                disabled={exporting}
                style={{ width: "100%", background: exporting ? "#6b7280" : "#000", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "16px", fontWeight: 700, cursor: exporting ? "not-allowed" : "pointer" }}
              >
                {exporting ? "Exporting..." : `Export ${selectedFormat.toUpperCase()} Report`}
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

              <div style={{ display: "grid", gap: "12px", fontSize: "15px", color: theme.text }}>
                {scores?.weights ? (
                  Object.entries(scores.weights).map(([key, val]) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, ' $1')}:</span>
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
