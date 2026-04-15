const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const { ROOT_DIR, DATA_DIR, PARSED_DIR, REGISTRY_PATH } = require("../../utils/config");
const { readJson, writeJson } = require("../../utils/fileUtils");

router.post("/", (req, res) => {
  try {
    const { teamId } = req.body || {};
    if (!teamId) return res.status(400).json({ error: "teamId is required" });

    // Clear parsed JSON files for this team only, keep upload entries
    const registry = readJson(REGISTRY_PATH) || [];
    registry.forEach(entry => {
      if (entry.teamId !== teamId) return;
      if (entry.parseInfo?.jsonPath) {
        const abs = path.join(ROOT_DIR, entry.parseInfo.jsonPath);
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      }
      entry.status = "uploaded";
      entry.parseInfo = null;
    });
    writeJson(REGISTRY_PATH, registry);

    // Clear team-specific analysis files from PARSED_DIR
    if (fs.existsSync(PARSED_DIR)) {
      fs.readdirSync(PARSED_DIR)
        .filter(f => f.startsWith(teamId))
        .forEach(f => fs.unlinkSync(path.join(PARSED_DIR, f)));
    }

    res.json({ success: true, message: "Team scores reset successfully" });
  } catch (e) {
    console.error("Reset error:", e);
    res.status(500).json({ error: e.message || "Reset failed" });
  }
});

module.exports = router;