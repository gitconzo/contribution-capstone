// backend/routes/uploads/POST.js
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const router = require("express").Router();
const db = require("../../utils/db");
const { ROOT_DIR, PARSED_DIR } = require("../../utils/config");
const { pyBin } = require("../../utils/processUtils");
const { downloadToFile, uploadFile } = require("../../utils/s3");

// Detects the document type from the filename, falling back to the user's selection
function detectTypeFromName(filename, userGuess) {
  if (userGuess && userGuess !== "unknown") return userGuess;
  const lower = (filename || "").toLowerCase();
  if (lower.includes("attendance")) return "attendance";
  if (lower.includes("worklog")) return "worklog";
  if (lower.includes("sprint")) return "sprint_report";
  if (lower.includes("peer") || lower.includes("self-peer") || lower.includes("self_peer") || lower.includes("peer assessment") || lower.includes("peer_assessment")) return "peer_review";
  if ((lower.includes("project") && lower.includes("plan")) || lower.includes("team plan")) return "project_plan";
  return "unknown";
}

// POST /api/uploads
// Called after the browser uploads the file directly to S3 via presigned URL
// Registers the upload in the database
router.post("/", async (req, res) => {
  const {
    s3Key,
    storedName,
    originalName,
    size,
    mimetype,
    teamId,
    userType,
    sprintId,
    uploadedByName,
    uploadedByEmail,
  } = req.body || {};

  if (!s3Key || !originalName) {
    return res.status(400).json({ error: "Missing s3Key or originalName" });
  }

  const id = storedName || path.basename(s3Key);
  const detectedType = detectTypeFromName(originalName, userType || null);

  try {
    await db.query(
      `INSERT INTO file_registry
        (
          id,
          team_id,
          original_name,
          stored_name,
          s3_key,
          mimetype,
          size,
          detected_type,
          status,
          sprint_id,
          uploaded_by_name,
          uploaded_by_email
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded', $9, $10, $11)`,
      [
        id,
        teamId || null,
        originalName,
        id,
        s3Key,
        mimetype || null,
        size || null,
        detectedType,
        sprintId || null,
        uploadedByName || null,
        uploadedByEmail || null,
      ]
    );

    const result = await db.query("SELECT * FROM file_registry WHERE id = $1", [id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("POST /api/uploads error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/uploads/confirm
// Downloads the file from S3, runs the appropriate parser, uploads the parsed JSON back to S3
router.post("/confirm", async (req, res) => {
  const { id, type } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing id" });

  const lookupResult = await db.query("SELECT * FROM file_registry WHERE id = $1", [id]);
  const entry = lookupResult.rows[0];
  if (!entry) return res.status(404).json({ error: "Upload not found" });

  const finalType = type && type !== "unknown" ? type : (entry.detected_type || "unknown");
  const ext = path.extname(entry.original_name).toLowerCase();
  const baseName = path.basename(entry.original_name, ext);
  const parsedFileName = `${baseName}-parsed.json`;

  // Helper to save the final state to the DB and return the response
  const finish = async (updates) => {
    await db.query(
      `UPDATE file_registry
       SET user_type = $1, status = $2, s3_parsed_key = $3, json_path = $4, parse_message = $5
       WHERE id = $6`,
      [updates.userType, updates.status, updates.s3ParsedKey || null, updates.jsonPath || null, updates.message || null, id]
    );
    const updated = await db.query("SELECT * FROM file_registry WHERE id = $1", [id]);
    res.json(updated.rows[0]);
  };

  const parsers = {
    attendance: {
      extensions: [".xlsx", ".xls"],
      script: path.join(ROOT_DIR, "parsers", "attendance.py"),
      label: "Attendance",
      combineAfter: false,
    },
    worklog: {
      extensions: [".docx", ".pdf"],
      script: path.join(ROOT_DIR, "parsers", "worklog_parser.py"),
      label: "Worklog",
      combineAfter: false,
    },
    sprint_report: {
      extensions: [".docx"],
      script: path.join(ROOT_DIR, "parsers", "parse_sprint_report_docx.py"),
      label: "Sprint report",
      combineAfter: true,
    },
    project_plan: {
      extensions: [".docx"],
      script: path.join(ROOT_DIR, "parsers", "parse_project_plan_docx.py"),
      label: "Project Plan",
      combineAfter: true,
    },
    peer_review: {
      extensions: [".docx"],
      script: path.join(ROOT_DIR, "parsers", "parse_peer_review.py"),
      label: "Peer Review",
      combineAfter: false,
    },
  };

  const parser = parsers[finalType];
  if (!parser || !parser.extensions.includes(ext)) {
    return finish({ userType: finalType, status: "confirmed", message: "No parser available for this file type." });
  }

  try {
    const tempInputPath = path.join(os.tmpdir(), entry.stored_name);
    const tempOutputPath = path.join(os.tmpdir(), parsedFileName);

    // Download the original file from S3 to a temp location for the parser
    await downloadToFile(entry.s3_key, tempInputPath);

    execFile(pyBin(), [parser.script, tempInputPath, tempOutputPath], { cwd: ROOT_DIR }, async (execError, _stdout, stderr) => {
      if (execError) {
        return finish({ userType: finalType, status: "parse_failed", message: `${parser.label} parse failed: ${stderr || execError.message}` });
      }

      const teamId = entry.team_id || "unknown";
      const s3ParsedKey = `${teamId}/parsed/${parsedFileName}`;

      try {
        // Upload the parsed JSON to S3
        await uploadFile(s3ParsedKey, tempOutputPath, "application/json");

        // Also copy to local parsed directory so the aggregator can fall back to it
        const fs = require("fs");
        fs.copyFileSync(tempOutputPath, path.join(PARSED_DIR, parsedFileName));

        return finish({
          userType: finalType,
          status: "parsed",
          s3ParsedKey,
          jsonPath: `data/parsed/${parsedFileName}`,
          message: `${parser.label} parsed successfully`,
        });
      } catch (uploadError) {
        console.error("Failed to upload parsed JSON to S3:", uploadError);
        return finish({ userType: finalType, status: "parse_failed", message: `Parse succeeded but S3 upload failed: ${uploadError.message}` });
      }
    });
  } catch (downloadError) {
    console.error("Failed to download from S3 for parsing:", downloadError);
    return finish({ userType: finalType, status: "parse_failed", message: `Failed to download file from S3: ${downloadError.message}` });
  }
});

module.exports = router;
