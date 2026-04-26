// backend/routes/uploads/GET.js
const path = require("path");
const router = require("express").Router();
const db = require("../../utils/db");
const { getPresignedUploadUrl, getPresignedDownloadUrl } = require("../../utils/s3");

// GET /api/uploads
// Returns all uploaded files sorted by most recent first
router.get("/", async (_req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM file_registry ORDER BY upload_date DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/uploads error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/uploads/student?teamId=...&email=...
router.get("/student", async (req, res) => {
  try {
    const { teamId, email } = req.query;

    if (!teamId || !email) {
      return res.status(400).json({ error: "Missing teamId or email" });
    }

    const result = await db.query(
      `
      SELECT *
      FROM file_registry
      WHERE team_id = $1
        AND LOWER(uploaded_by_email) = LOWER($2)
      ORDER BY upload_date DESC
      `,
      [teamId, email]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/uploads/student error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/uploads/presign
// Generates a presigned S3 URL so the browser can upload directly to S3
router.get("/presign", async (req, res) => {
  try {
    const { filename, teamId, contentType, folder } = req.query;

    if (!filename || !teamId) {
      return res.status(400).json({ error: "Missing filename or teamId" });
    }

    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    const storedName = `${base}__${Date.now()}${ext}`;

    const s3Key = folder
      ? `${folder}/${storedName}`
      : `${teamId}/uploads/${storedName}`;

    const url = await getPresignedUploadUrl(
      s3Key,
      contentType || "application/octet-stream"
    );

    res.json({ url, s3Key, storedName });
  } catch (err) {
    console.error("GET /api/uploads/presign error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/uploads/file?key=...
// Returns a presigned download URL for any S3 key
router.get("/file", async (req, res) => {
  try {
    const { key } = req.query;

    if (!key) {
      return res.status(400).json({ error: "Missing key" });
    }

    const url = await getPresignedDownloadUrl(key);
    res.json({ url });
  } catch (err) {
    console.error("GET /api/uploads/file error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/uploads/by-team?teamId=...
// Returns all files for a team, grouped by student — no S3 keys exposed
router.get("/by-team", async (req, res) => {
  try {
    const { teamId } = req.query;
    if (!teamId) return res.status(400).json({ error: "Missing teamId" });

    const result = await db.query(
      `SELECT
         id, team_id, original_name, detected_type, user_type,
         uploaded_by_name, uploaded_by_email, upload_scope,
         approval_status, status, upload_date, size, decline_reason, parse_message
       FROM file_registry
       WHERE team_id = $1
       ORDER BY uploaded_by_email ASC, upload_date DESC`,
      [teamId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/uploads/by-team error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/uploads/:id/download
// Returns a presigned download URL for a file stored in S3
router.get("/:id/download", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT s3_key FROM file_registry WHERE id = $1",
      [req.params.id]
    );

    const entry = result.rows[0];
    if (!entry?.s3_key) {
      return res.status(404).json({ error: "File not found in S3" });
    }

    const url = await getPresignedDownloadUrl(entry.s3_key);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
