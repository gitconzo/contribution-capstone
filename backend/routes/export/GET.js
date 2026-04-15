// backend/routes/export/GET.js
const router = require("express").Router();
const { ROOT_DIR } = require("../../utils/config");
const { readActiveId } = require("../../utils/activeTeamUtils");
const { aggregateTeamScores } = require("../../services/aggregator");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// GET /api/export?teamId=...
router.get("/", async (req, res) => {
  try {
    const teamId = req.query.teamId || readActiveId();
    if (!teamId) return res.status(400).json({ error: "Missing teamId" });

    const payload = await aggregateTeamScores({ teamId, rootDir: ROOT_DIR });
    if (!payload?.ranking?.length) {
      return res.status(404).json({ error: "No data found for this team" });
    }

    const tmpDir = os.tmpdir();
    const ts = Date.now();
    const outPath = path.join(tmpDir, `export_${teamId}_${ts}.xlsx`);
    const scriptPath = path.join(tmpDir, `gen_${ts}.py`);
    const jsonPath = path.join(tmpDir, `data_${ts}.json`);

    // Filter to selected students if provided
    function parseStudentFilter(query) {
      if (!query.students) return null;
      return query.students.split(",").map(email => email.trim().toLowerCase());
    }

    const studentFilter = parseStudentFilter(req.query);
    const ranking = studentFilter
      ? payload.ranking.filter(student => studentFilter.includes((student.email || "").toLowerCase()))
      : payload.ranking;
    const teamCode = payload.team?.name?.replace(/\s+/g, "_") || teamId;

    fs.writeFileSync(jsonPath, JSON.stringify(ranking));

    const script = `
import openpyxl
from openpyxl import Workbook
from openpyxl.chart import BarChart, PieChart, Reference
import json

with open(r"${jsonPath.replace(/\\/g, "\\\\")}") as f:
    data = json.load(f)

wb = Workbook()
ws = wb.active
ws.title = "Contribution Scores"

headers = [
    "Rank", "Name", "Email", "Overall Score (%)",
    "Code Commits", "Work Hours", "Documents", "Meetings",
    "Total Lines of Code (normalised)", "Total Edited Code (normalised)", "Total Commits (normalised)",
    "Total Functions Written (normalised)", "Total Hotspots Contributed (normalised)", "Code Complexity (normalised)",
    "Average Sentence Length (normalised)", "Sentence Complexity (normalised)",
    "Word Count (normalised)", "Readability (normalised)",
    "Total Lines of Code %", "Total Edited Code %", "Total Commits %",
    "Total Functions Written %", "Total Hotspots Contributed %",
    "Code Complexity (raw)", "Average Sentence Length (raw)", "Sentence Complexity (raw)",
    "Word Count (raw)", "Readability Score (raw)", "Attendance %"
]
ws.append(headers)

for i, s in enumerate(data, start=1):
    b = s.get("breakdown", {})
    r = s.get("raw", {})
    ws.append([
        i, s.get("name",""), s.get("email",""), round(s.get("score",0),1),
        r.get("commits",0), r.get("hours",0), r.get("docCount",0), r.get("meetings",0),
        round(b.get("loc",0)*100), round(b.get("editedCode",0)*100),
        round(b.get("commits",0)*100), round(b.get("functions",0)*100),
        round(b.get("hotspots",0)*100), round(b.get("codeComplexity",0)*100),
        round(b.get("avgSentenceLength",0)*100), round(b.get("sentenceComplexity",0)*100),
        round(b.get("wordCount",0)*100), round(b.get("readability",0)*100),
        round(r.get("loc",0),2), round(r.get("editedCode",0),2),
        round(r.get("commits",0),2), round(r.get("functions",0),2),
        round(r.get("hotspots",0),2), round(r.get("codeComplexity",0),3),
        round(r.get("avgSentenceLength",0),2), round(r.get("sentenceComplexity",0),3),
        r.get("wordCount",0), round(r.get("readability",0),2),
        round(r.get("attendance",0)*100,1),
    ])

for col in ws.columns:
    max_len = max(len(str(cell.value)) if cell.value is not None else 0 for cell in col)
    ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 40)

num_students = len(data)
names = Reference(ws, min_col=2, min_row=2, max_row=num_students+1)

chart1 = PieChart()
chart1.title = "Overall Contribution Score"
chart1.style = 10
chart1.width = 18
chart1.height = 12
pie_data = Reference(ws, min_col=4, min_row=1, max_row=num_students+1)
chart1.add_data(pie_data, titles_from_data=True)
chart1.set_categories(names)
ws.add_chart(chart1, "AC2")

# Chart 2: Code metrics grouped bar
chart2 = BarChart()
chart2.type = "col"
chart2.grouping = "clustered"
chart2.title = "Code Metrics (Normalised)"
chart2.y_axis.title = "Normalised Score (0-100)"
chart2.x_axis.title = "Student"
chart2.style = 10
chart2.width = 22
chart2.height = 12
chart2.x_axis.tickLblPos = "low"
chart2.x_axis.delete = False
chart2.y_axis.delete = False
chart2.x_axis.majorTickMark = "out"
chart2.y_axis.majorTickMark = "out"
for col in range(9, 15):
    chart2.add_data(Reference(ws, min_col=col, min_row=1, max_row=num_students+1), titles_from_data=True)
cats2 = Reference(ws, min_col=2, min_row=2, max_row=num_students+1)
chart2.set_categories(cats2)
ws.add_chart(chart2, "AC28")

# Chart 3: Documentation metrics grouped bar
chart3 = BarChart()
chart3.type = "col"
chart3.grouping = "clustered"
chart3.title = "Documentation Metrics (Normalised)"
chart3.y_axis.title = "Normalised Score (0-100)"
chart3.x_axis.title = "Student"
chart3.style = 10
chart3.width = 22
chart3.height = 12
chart3.x_axis.tickLblPos = "low"
chart3.x_axis.delete = False
chart3.y_axis.delete = False
chart3.x_axis.majorTickMark = "out"
chart3.y_axis.majorTickMark = "out"
for col in range(15, 19):
    chart3.add_data(Reference(ws, min_col=col, min_row=1, max_row=num_students+1), titles_from_data=True)
cats3 = Reference(ws, min_col=2, min_row=2, max_row=num_students+1)
chart3.set_categories(cats3)
ws.add_chart(chart3, "AC54")

wb.save(r"${outPath.replace(/\\/g, "\\\\")}")
`;

    fs.writeFileSync(scriptPath, script);
    const py = process.platform === "win32" ? "python" : "python3";
    execFileSync(py, [scriptPath]);
    fs.unlinkSync(scriptPath);
    fs.unlinkSync(jsonPath);

    const filename = `contribution_report_${teamCode}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(fs.readFileSync(outPath));
    fs.unlinkSync(outPath);

  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: error.message || "Export failed" });
  }
});

module.exports = router;