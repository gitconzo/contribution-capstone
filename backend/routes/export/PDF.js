const router = require("express").Router();
const { ROOT_DIR } = require("../../utils/config");
const { readActiveId } = require("../../utils/activeTeamUtils");
const { aggregateTeamScores } = require("../../services/aggregator");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

router.post("/pdf", async (req, res) => {
  try {
    const teamId = req.body?.teamId || readActiveId();
    if (!teamId) return res.status(400).json({ error: "Missing teamId" });

    const payload = await aggregateTeamScores({ teamId, rootDir: ROOT_DIR });
    if (!payload?.ranking?.length) {
      return res.status(404).json({ error: "No data found for this team" });
    }

    const { selectedEmails } = req.body || {};
    const ranking = selectedEmails?.length
      ? payload.ranking.filter(s => selectedEmails.includes(s.email))
      : payload.ranking;

    if (!ranking.length) {
      return res.status(404).json({ error: "No data found for selected students" });
    }

    const tmpDir = os.tmpdir();
    const ts = Date.now();
    const outPath = path.join(tmpDir, `report_${teamId}_${ts}.pdf`);
    const scriptPath = path.join(tmpDir, `gen_pdf_${ts}.py`);
    const jsonPath = path.join(tmpDir, `pdf_data_${ts}.json`);

    const teamCode = payload.team?.code || teamId;
    const teamName = payload.team?.name || "Team";

    fs.writeFileSync(jsonPath, JSON.stringify({
      team: payload.team,
      ranking,
      weights: payload.weights,
    }));

    const script = `
import json
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from datetime import datetime

with open(r"${jsonPath.replace(/\\/g, "\\\\")}") as f:
    data = json.load(f)

team = data.get("team", {})
ranking = data.get("ranking", [])
weights = data.get("weights", {})

doc = SimpleDocTemplate(
    r"${outPath.replace(/\\/g, "\\\\")}",
    pagesize=landscape(A4),
    rightMargin=15*mm,
    leftMargin=15*mm,
    topMargin=15*mm,
    bottomMargin=15*mm,
)

styles = getSampleStyleSheet()
story = []

# ---- Title ----
title_style = ParagraphStyle("title", fontSize=18, fontName="Helvetica-Bold", spaceAfter=4, alignment=TA_LEFT)
sub_style   = ParagraphStyle("sub",   fontSize=10, fontName="Helvetica",      spaceAfter=2, textColor=colors.HexColor("#64748b"))
label_style = ParagraphStyle("label", fontSize=9,  fontName="Helvetica-Bold", spaceAfter=1)
normal_style= ParagraphStyle("norm",  fontSize=9,  fontName="Helvetica",      spaceAfter=1)

story.append(Paragraph("Contribution Assessment Report", title_style))
story.append(Paragraph(f"{team.get('name','')}  ({team.get('code','')})", sub_style))
story.append(Paragraph(f"Generated: {datetime.now().strftime('%d %B %Y')}", sub_style))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e5e7eb"), spaceAfter=8))

# ---- Team summary ----
avg_score = round(sum(r.get("score",0) for r in ranking) / len(ranking), 1) if ranking else 0
high_count = sum(1 for r in ranking if r.get("score",0) >= 80)

summary_data = [
    ["Students", "Average Score", "High Contributors (>=80%)", "Repository"],
    [
        str(len(ranking)),
        f"{avg_score}%",
        f"{high_count} / {len(ranking)}",
        team.get("repo_url") or team.get("repo", {}).get("url", "Not connected") if isinstance(team.get("repo"), dict) else team.get("repo_url", "Not connected"),
    ]
]

summary_table = Table(summary_data, colWidths=[35*mm, 45*mm, 60*mm, None])
summary_table.setStyle(TableStyle([
    ("BACKGROUND",    (0,0), (-1,0), colors.HexColor("#1a1a2e")),
    ("TEXTCOLOR",     (0,0), (-1,0), colors.white),
    ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
    ("FONTSIZE",      (0,0), (-1,-1), 9),
    ("FONTNAME",      (0,1), (-1,-1), "Helvetica"),
    ("ALIGN",         (0,0), (-1,-1), "CENTER"),
    ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
    ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.HexColor("#f8fafc"), colors.white]),
    ("GRID",          (0,0), (-1,-1), 0.5, colors.HexColor("#e5e7eb")),
    ("TOPPADDING",    (0,0), (-1,-1), 5),
    ("BOTTOMPADDING", (0,0), (-1,-1), 5),
]))
story.append(summary_table)
story.append(Spacer(1, 10))

# ---- Student breakdown table ----
story.append(Paragraph("Student Breakdown", ParagraphStyle("h2", fontSize=12, fontName="Helvetica-Bold", spaceAfter=6)))

headers = [
    "Rank", "Name", "Email", "Score",
    "LOC %", "Edits %", "Commits %", "Functions %", "Hotspots %", "Complexity",
    "Word Count", "Readability", "Attendance %",
]

col_widths = [12*mm, 35*mm, 55*mm, 16*mm,
              16*mm, 16*mm, 17*mm, 18*mm, 18*mm, 18*mm,
              18*mm, 18*mm, 18*mm]

table_data = [headers]
for s in ranking:
    r = s.get("raw", {})
    table_data.append([
        str(s.get("rank", "")),
        s.get("name", ""),
        s.get("email", ""),
        f"{round(s.get('score',0),1)}%",
        f"{round(r.get('loc',0),1)}%",
        f"{round(r.get('editedCode',0),1)}%",
        f"{round(r.get('commits',0),1)}%",
        f"{round(r.get('functions',0),1)}%",
        f"{round(r.get('hotspots',0),1)}%",
        str(round(r.get('codeComplexity',0),2)),
        str(int(r.get('wordCount',0))),
        str(round(r.get('readability',0),1)),
        f"{round(r.get('attendance',0)*100,1)}%",
    ])

student_table = Table(table_data, colWidths=col_widths, repeatRows=1)
student_table.setStyle(TableStyle([
    ("BACKGROUND",    (0,0), (-1,0), colors.HexColor("#1a1a2e")),
    ("TEXTCOLOR",     (0,0), (-1,0), colors.white),
    ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
    ("FONTSIZE",      (0,0), (-1,-1), 8),
    ("FONTNAME",      (0,1), (-1,-1), "Helvetica"),
    ("ALIGN",         (0,0), (0,-1), "CENTER"),
    ("ALIGN",         (1,0), (2,-1), "LEFT"),
    ("ALIGN",         (3,0), (-1,-1), "CENTER"),
    ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
    ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.HexColor("#f8fafc"), colors.white]),
    ("GRID",          (0,0), (-1,-1), 0.5, colors.HexColor("#e5e7eb")),
    ("TOPPADDING",    (0,0), (-1,-1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ("LEFTPADDING",   (0,0), (-1,-1), 4),
    ("RIGHTPADDING",  (0,0), (-1,-1), 4),
]))
story.append(student_table)
story.append(Spacer(1, 8))

# ---- Weights used ----
story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e5e7eb"), spaceBefore=4, spaceAfter=6))
story.append(Paragraph("Assessment Weights Applied", ParagraphStyle("h3", fontSize=10, fontName="Helvetica-Bold", spaceAfter=4)))

weight_labels = {
    "loc": "Total Lines of Code", "editedCode": "Total Edited Code",
    "commits": "Total Commits", "functions": "Total Functions Written",
    "hotspots": "Total Hotspots Contributed", "codeComplexity": "Code Complexity",
    "avgSentenceLength": "Avg Sentence Length", "sentenceComplexity": "Sentence Complexity",
    "wordCount": "Word Count", "readability": "Readability",
}

weight_items = [[weight_labels.get(k, k), str(v)] for k, v in weights.items()]
cols = 5
rows = [weight_items[i:i+cols] for i in range(0, len(weight_items), cols)]
flat = []
for row in rows:
    flat.append([item for pair in row for item in pair])

if flat:
    w_col = [28*mm, 12*mm] * cols
    w_table = Table(flat, colWidths=w_col)
    w_table.setStyle(TableStyle([
        ("FONTNAME",  (0,0), (-1,-1), "Helvetica"),
        ("FONTSIZE",  (0,0), (-1,-1), 8),
        ("TEXTCOLOR", (1,0), (-1,-1), colors.HexColor("#2563eb")),
        ("FONTNAME",  (1,0), (-1,-1), "Helvetica-Bold"),
        ("ALIGN",     (1,0), (-1,-1), "RIGHT"),
        ("TOPPADDING",(0,0), (-1,-1), 2),
        ("BOTTOMPADDING",(0,0),(-1,-1), 2),
    ]))
    story.append(w_table)

doc.build(story)
print("done")
`;

    fs.writeFileSync(scriptPath, script);
    const py = process.platform === "win32" ? "python" : "python3";
    execFileSync(py, [scriptPath]);
    fs.unlinkSync(scriptPath);
    fs.unlinkSync(jsonPath);

    const filename = `contribution_report_${teamCode}_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(fs.readFileSync(outPath));
    fs.unlinkSync(outPath);

  } catch (e) {
    console.error("PDF export error:", e);
    res.status(500).json({ error: e.message || "PDF export failed" });
  }
});

module.exports = router;