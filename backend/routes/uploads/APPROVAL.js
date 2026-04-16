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
  attendance:   { extensions: [".xlsx", ".xls"], script: path.join(ROOT_DIR, "parsers", "attendance.py"),                  label: "Attendance",   combineAfter: false },
  worklog:      { extensions: [".docx", ".pdf"], script: path.join(ROOT_DIR, "parsers", "worklog_parser.py"),              label: "Worklog",      combineAfter: false },
  sprint_report:{ extensions: [".docx"],         script: path.join(ROOT_DIR, "parsers", "parse_sprint_report_docx.py"),    label: "Sprint Report",combineAfter: true  },
  project_plan: { extensions: [".docx"],         script: path.join(ROOT_DIR, "parsers", "parse_project_plan_docx.py"),     label: "Project Plan", combineAfter: true  },
  peer_review:  { extensions: [".docx"],         script: path.join(ROOT_DIR, "parsers", "parse_peer_review_docx.py"),      label: "Peer Review",  combineAfter: false },
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

  const tempInputPath = path.join(os.tmpdir(), entry.stored_name);
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

// GET /api/uploads/pending
router.get("/pending", async (req, res) => {
    try {
      const { teamId } = req.query;
  
      if (!teamId) {
        return res.status(400).json({ error: "Missing teamId" });
      }
  
      const result = await db.query(
        `
        SELECT *
        FROM file_registry
        WHERE approval_status = 'pending'
          AND team_id = $1
          AND LOWER(COALESCE(uploaded_by_name, '')) <> 'lecturer'
        ORDER BY upload_date DESC
        `,
        [teamId]
      );
  
      res.json(result.rows);
    } catch (err) {
      console.error("GET /api/uploads/pending error:", err);
      res.status(500).json({ error: err.message });
    }
  });

// POST /api/uploads/:id/reparse — re-triggers parsing for a parse_failed file
router.post("/:id/reparse", async (req, res) => {
  try {
    const lookup = await db.query("SELECT * FROM file_registry WHERE id = $1", [req.params.id]);
    if (!lookup.rows.length) return res.status(404).json({ error: "Upload not found" });

    const entry = lookup.rows[0];
    if (entry.approval_status !== "approved") {
      return res.status(400).json({ error: "File must be approved before parsing." });
    }

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

// POST /api/uploads/:id/approve
router.post("/:id/approve", async (req, res) => {
  try {
    const { approvedBy } = req.body || {};

    const result = await db.query(
      `UPDATE file_registry
       SET approval_status = 'approved', approved_by = $1, approved_at = NOW(), status = 'confirmed'
       WHERE id = $2
       RETURNING *`,
      [approvedBy || "Lecturer", req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Upload not found" });
    }

    const entry = result.rows[0];

    // Trigger parsing so the file is included in score calculations
    parseEntry(entry).catch(e => console.error(`Parsing failed for ${entry.id}:`, e));

    const updated = await db.query("SELECT * FROM file_registry WHERE id = $1", [req.params.id]);
    res.json(updated.rows[0]);
  } catch (err) {
    console.error("POST /api/uploads/:id/approve error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/uploads/:id/reject
router.post("/:id/reject", async (req, res) => {
  try {
    const { approvedBy, declineReason } = req.body || {};

    const result = await db.query(
      `
      UPDATE file_registry
      SET approval_status = 'rejected',
          approved_by = $1,
          approved_at = NOW(),
          decline_reason = $2,
          status = 'rejected'
      WHERE id = $3
      RETURNING *
      `,
      [approvedBy || "Lecturer", declineReason || null, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Upload not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("POST /api/uploads/:id/reject error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

router.get("/file", async (req, res) => {
    try {
      const { key } = req.query;
  
      if (!key) {
        return res.status(400).json({ error: "Missing file key" });
      }
  
      // If your bucket is public:
      const fileUrl = `${process.env.S3_BASE_URL}/${key}`;
  
      res.json({ url: fileUrl });
  
    } catch (err) {
      console.error("Failed to get file URL:", err);
      res.status(500).json({ error: "Failed to get file URL" });
    }
  });