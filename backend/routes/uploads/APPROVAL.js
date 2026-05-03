const path = require("path");
const os = require("os");
const fs = require("fs");
const { execFile } = require("child_process");
const router = require("express").Router();
const db = require("../../utils/db");
const { ROOT_DIR, PARSED_DIR } = require("../../utils/config");
const { pyBin } = require("../../utils/processUtils");
const { downloadToFile, uploadFile } = require("../../utils/s3");
const { combineDocumentationMetrics } = require("../../services/combineDocumentationMetrics");

const PARSERS = {
  attendance:   { extensions: [".xlsx", ".xls"], script: path.join(ROOT_DIR, "parsers", "attendance.py"),               label: "Attendance",    combineAfter: false },
  worklog:      { extensions: [".docx", ".pdf"], script: path.join(ROOT_DIR, "parsers", "worklog_parser.py"),            label: "Worklog",       combineAfter: false },
  sprint_report:{ extensions: [".docx"],         script: path.join(ROOT_DIR, "parsers", "parse_sprint_report_docx.py"), label: "Sprint Report", combineAfter: true  },
  project_plan: { extensions: [".docx"],         script: path.join(ROOT_DIR, "parsers", "parse_project_plan_docx.py"),  label: "Project Plan",  combineAfter: true  },
  peer_review:  { extensions: [".docx"],         script: path.join(ROOT_DIR, "parsers", "parse_peer_review.py"),        label: "Peer Review",   combineAfter: false },
};

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

// POST /api/uploads/:id/reparse — re-triggers parsing for a parse_failed file
router.post("/:id/reparse", async (req, res) => {
  try {
    const lookup = await db.query("SELECT * FROM file_registry WHERE id = $1", [req.params.id]);
    if (!lookup.rows.length) return res.status(404).json({ error: "Upload not found" });

    const entry = lookup.rows[0];
    await db.query(
      "UPDATE file_registry SET status = $1, parse_message = $2 WHERE id = $3",
      ["confirmed", "Re-parse requested", entry.id]
    );

    parseEntry(entry).catch(e => console.error(`Re-parse failed for ${entry.id}:`, e));

    const updated = await db.query("SELECT * FROM file_registry WHERE id = $1", [req.params.id]);
    res.json(updated.rows[0]);
  } catch (err) {
    console.error("POST /api/uploads/:id/reparse error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
