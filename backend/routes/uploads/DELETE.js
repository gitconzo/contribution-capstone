// backend/routes/uploads/DELETE.js
const fs = require("fs");
const path = require("path");
const router = require("express").Router();
const db = require("../../utils/db");
const { PARSED_DIR } = require("../../utils/config");
const { deleteFile } = require("../../utils/s3");

// DELETE /api/uploads/:id
// Deletes one uploaded file record and removes its local parsed JSON if present
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Missing file id" });
  }

  try {
    const result = await db.query(
      `SELECT id, s3_key, s3_parsed_key, json_path
       FROM file_registry
       WHERE id = $1`,
      [id]
    );

    const entry = result.rows[0];

    if (!entry) {
      return res.status(404).json({ error: "File not found" });
    }

    // Remove local parsed JSON
    if (entry.json_path) {
      const fullPath = path.join(PARSED_DIR, path.basename(entry.json_path));
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    // Remove S3 objects (fire-and-forget — don't fail the delete if S3 cleanup errors)
    if (entry.s3_key) deleteFile(entry.s3_key).catch(e => console.warn("S3 delete s3_key failed:", e.message));
    if (entry.s3_parsed_key) deleteFile(entry.s3_parsed_key).catch(e => console.warn("S3 delete s3_parsed_key failed:", e.message));

    await db.query("DELETE FROM file_registry WHERE id = $1", [id]);

    return res.json({
      success: true,
      message: "File deleted successfully",
      id,
    });
  } catch (err) {
    console.error("DELETE /api/uploads/:id error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/uploads/cleanup-docs
// Marks all parsed documentation files as deleted and removes the combined metrics file
router.delete("/cleanup-docs", async (_req, res) => {
  try {
    const docTypes = ["sprint_report", "project_plan", "worklog"];

    const result = await db.query(
      `SELECT id, json_path
       FROM file_registry
       WHERE status = 'parsed'
       AND (user_type = ANY($1) OR detected_type = ANY($1))`,
      [docTypes]
    );

    let deletedCount = 0;

    for (const entry of result.rows) {
      if (entry.json_path) {
        const fullPath = path.join(PARSED_DIR, path.basename(entry.json_path));
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          deletedCount++;
        }
      }
    }

    await db.query(
      `UPDATE file_registry
       SET status = 'deleted',
           json_path = NULL,
           s3_parsed_key = NULL
       WHERE status = 'parsed'
       AND (user_type = ANY($1) OR detected_type = ANY($1))`,
      [docTypes]
    );

    return res.json({
      success: true,
      message: `Cleaned up ${deletedCount} documentation files`,
    });
  } catch (err) {
    console.error("DELETE /api/uploads/cleanup-docs error:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;