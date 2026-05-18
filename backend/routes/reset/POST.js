const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const { ROOT_DIR } = require("../../utils/config");
const db = require("../../utils/db");

router.post("/", async (req, res) => {
  try {
    const { teamId } = req.body || {};
    if (!teamId) return res.status(400).json({ error: "teamId is required" });

    // Find all parsed files for this team so we can delete their local JSON outputs
    const parsed = await db.query(
      `SELECT json_path FROM file_registry
       WHERE team_id = $1 AND json_path IS NOT NULL`,
      [teamId]
    );

    // Delete local parsed JSON files
    for (const row of parsed.rows) {
      const abs = path.join(ROOT_DIR, row.json_path);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    }

    // Reset all file_registry rows for this team back to pre-parse state
    // Files remain approved so the lecturer does not need to re-approve them —
    // only the parse output is cleared. The aggregator will exclude them until reparsed.
    await db.query(
      `UPDATE file_registry
       SET status          = 'confirmed',
           json_path       = NULL,
           s3_parsed_key   = NULL,
           parse_message   = NULL
       WHERE team_id = $1`,
      [teamId]
    );

    res.json({ success: true, message: "Team scores reset successfully" });
  } catch (e) {
    console.error("Reset error:", e);
    res.status(500).json({ error: e.message || "Reset failed" });
  }
});

module.exports = router;
