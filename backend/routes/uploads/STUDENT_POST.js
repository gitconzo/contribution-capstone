const router = require("express").Router();
const path = require("path");
const os = require("os");
const fs = require("fs");
const { execFile } = require("child_process");
const db = require("../../utils/db");
const { ROOT_DIR, PARSED_DIR } = require("../../utils/config");
const { pyBin } = require("../../utils/processUtils");
const { downloadToFile, uploadFile } = require("../../utils/s3");
const { combineDocumentationMetrics } = require("../../services/combineDocumentationMetrics");

function detectTypeFromName(filename, userGuess) {
  if (userGuess && userGuess !== "unknown") return userGuess;
  const lower = (filename || "").toLowerCase();
  if (lower.includes("attendance")) return "attendance";
  if (lower.includes("worklog")) return "worklog";
  if (lower.includes("sprint")) return "sprint_report";
  if (lower.includes("peer")) return "peer_review";
  if (lower.includes("project") && lower.includes("plan")) return "project_plan";
  return "unknown";
}

const PARSERS = {
  attendance:    { extensions: [".xlsx", ".xls"], script: path.join(ROOT_DIR, "parsers", "attendance.py"),               label: "Attendance",    combineAfter: false },
  worklog:       { extensions: [".docx", ".pdf"], script: path.join(ROOT_DIR, "parsers", "worklog_parser.py"),            label: "Worklog",       combineAfter: false },
  sprint_report: { extensions: [".docx"],         script: path.join(ROOT_DIR, "parsers", "parse_sprint_report_docx.py"), label: "Sprint Report", combineAfter: true  },
  project_plan:  { extensions: [".docx"],         script: path.join(ROOT_DIR, "parsers", "parse_project_plan_docx.py"),  label: "Project Plan",  combineAfter: true  },
  peer_review:   { extensions: [".docx"],         script: path.join(ROOT_DIR, "parsers", "parse_peer_review.py"),        label: "Peer Review",   combineAfter: false },
};

const TEAM_LEVEL_TYPES = ["attendance", "sprint_report", "project_plan"];
const INDIVIDUAL_TYPES = ["worklog", "peer_review"];

// Auto-parse after upload — no approval step needed
async function parseEntry(entry) {
  const finalType = entry.user_type || entry.detected_type || "unknown";
  const ext = path.extname(entry.original_name).toLowerCase();
  const baseName = path.basename(entry.original_name, ext);
  const parsedFileName = `${baseName}-parsed.json`;
  const parser = PARSERS[finalType];

  if (!parser || !parser.extensions.includes(ext)) {
    await db.query("UPDATE file_registry SET status = $1, parse_message = $2 WHERE id = $3",
      ["confirmed", "No parser available for this file type.", entry.id]);
    return;
  }

  const tempInputPath  = path.join(os.tmpdir(), entry.stored_name);
  const tempOutputPath = path.join(os.tmpdir(), parsedFileName);

  try {
    await downloadToFile(entry.s3_key, tempInputPath);
  } catch (e) {
    await db.query("UPDATE file_registry SET status = $1, parse_message = $2 WHERE id = $3",
      ["parse_failed", `Failed to download from S3: ${e.message}`, entry.id]);
    return;
  }

  await new Promise((resolve) => {
    execFile(pyBin(), [parser.script, tempInputPath, tempOutputPath], { cwd: ROOT_DIR }, async (err, _stdout, stderr) => {
      if (err) {
        await db.query("UPDATE file_registry SET status = $1, parse_message = $2 WHERE id = $3",
          ["parse_failed", `${parser.label} parse failed: ${stderr || err.message}`, entry.id]);
        return resolve();
      }
      try {
        const s3ParsedKey = `${entry.team_id || "unknown"}/parsed/${parsedFileName}`;
        await uploadFile(s3ParsedKey, tempOutputPath, "application/json");
        fs.copyFileSync(tempOutputPath, path.join(PARSED_DIR, parsedFileName));
        if (parser.combineAfter) {
          try { combineDocumentationMetrics(ROOT_DIR); } catch (_) {}
        }
        await db.query(
          "UPDATE file_registry SET status = $1, s3_parsed_key = $2, json_path = $3, parse_message = $4 WHERE id = $5",
          ["parsed", s3ParsedKey, `data/parsed/${parsedFileName}`, `${parser.label} parsed successfully`, entry.id]
        );
      } catch (uploadErr) {
        await db.query("UPDATE file_registry SET status = $1, parse_message = $2 WHERE id = $3",
          ["parse_failed", `Parse succeeded but S3 upload failed: ${uploadErr.message}`, entry.id]);
      }
      resolve();
    });
  });
}

router.post("/student", async (req, res) => {
  const { s3Key, storedName, originalName, size, mimetype, teamId, userType, uploadedByName, uploadedByEmail } = req.body || {};

  if (!s3Key || !originalName || !teamId || !uploadedByEmail) {
    return res.status(400).json({ error: "Missing required upload fields." });
  }

  try {
    const studentResult = await db.query(
      "SELECT * FROM students WHERE team_id = $1 AND email = $2",
      [teamId, uploadedByEmail]
    );

    if (!studentResult.rows.length) {
      return res.status(403).json({ error: "You are not a member of this team." });
    }

    const student     = studentResult.rows[0];
    const role        = student.role || "member";
    const detectedType = detectTypeFromName(originalName, userType || null);
    const uploadScope  = TEAM_LEVEL_TYPES.includes(detectedType) ? "team" : "individual";

    if (TEAM_LEVEL_TYPES.includes(detectedType) && role !== "leader") {
      return res.status(403).json({ error: "Only the team leader can upload this document type." });
    }

    if (!TEAM_LEVEL_TYPES.includes(detectedType) && !INDIVIDUAL_TYPES.includes(detectedType) && detectedType !== "unknown") {
      return res.status(400).json({ error: "Unsupported document type." });
    }

    const id = storedName || path.basename(s3Key);

    await db.query(
      `INSERT INTO file_registry
        (id, team_id, original_name, stored_name, s3_key, mimetype, size,
         detected_type, user_type, uploaded_by_name, uploaded_by_email,
         upload_scope, approval_status, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, teamId, originalName, id, s3Key, mimetype||null, size||null,
       detectedType, detectedType, uploadedByName||null, uploadedByEmail, uploadScope,
       "approved", "confirmed"]
    );

    const result = await db.query("SELECT * FROM file_registry WHERE id = $1", [id]);
    const entry  = result.rows[0];

    parseEntry(entry).catch(e => console.error(`Auto-parse failed for ${entry.id}:`, e));
    res.json({ ...entry, _message: "Upload received and parsing started." });
  } catch (err) {
    console.error("POST /api/uploads/student error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;