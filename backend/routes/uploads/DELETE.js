// backend/routes/uploads/DELETE.js
const fs = require("fs");
const path = require("path");
const router = require("express").Router();
const db = require("../../utils/db");
const { PARSED_DIR } = require("../../utils/config");

// DELETE /api/uploads/cleanup-docs
// Marks all parsed documentation files as deleted and removes the combined metrics file
router.delete("/cleanup-docs", async (_req, res) => {
  try {
    const docTypes = ["sprint_report", "project_plan", "worklog"];

    // Find all parsed documentation entries
    const result = await db.query(
      `SELECT id, json_path FROM file_registry
       WHERE status = 'parsed'
       AND (user_type = ANY($1) OR detected_type = ANY($1))`,
      [docTypes]
    );

    // Delete local parsed JSON files where they exist
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

    // Mark all those entries as deleted in the database
    await db.query(
      `UPDATE file_registry
       SET status = 'deleted', json_path = NULL, s3_parsed_key = NULL
       WHERE status = 'parsed'
       AND (user_type = ANY($1) OR detected_type = ANY($1))`,
      [docTypes]
    );

    // Remove the combined metrics file if it exists
    const combinedMetricsPath = path.join(PARSED_DIR, "combined_documentation_metrics.json");
    if (fs.existsSync(combinedMetricsPath)) {
      fs.unlinkSync(combinedMetricsPath);
    }

    res.json({ success: true, message: `Cleaned up ${deletedCount} documentation files` });
  } catch (err) {
    console.error("DELETE /api/uploads/cleanup-docs error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
