const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const { ROOT_DIR, DATA_DIR, PARSED_DIR, REGISTRY_PATH } = require("../../utils/config");
const { readJson, writeJson } = require("../../utils/fileUtils");

router.post("/", (req, res) => {
  try {
    // Delete GitHub analysis files
    const filesToDelete = [
      path.join(DATA_DIR, "finalStats.json"),
      path.join(DATA_DIR, "commits.json"),
      path.join(DATA_DIR, "output.json"),
      path.join(DATA_DIR, "combined_documentation_metrics.json"),
    ];

    filesToDelete.forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });

    // Clear parsed JSON files from registry but keep upload entries
    const registry = readJson(REGISTRY_PATH) || [];
    registry.forEach(entry => {
      if (entry.parseInfo?.jsonPath) {
        const abs = path.join(ROOT_DIR, entry.parseInfo.jsonPath);
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      }
      entry.status = "uploaded";
      entry.parseInfo = null;
    });
    writeJson(REGISTRY_PATH, registry);

    // Clear any sprint/project plan parsed files in PARSED_DIR
    if (fs.existsSync(PARSED_DIR)) {
      fs.readdirSync(PARSED_DIR).forEach(f => {
        fs.unlinkSync(path.join(PARSED_DIR, f));
      });
    }

    res.json({ success: true, message: "Team scores reset successfully" });
  } catch (e) {
    console.error("Reset error:", e);
    res.status(500).json({ error: e.message || "Reset failed" });
  }
});

module.exports = router;