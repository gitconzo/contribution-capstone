// backend/routes/uploads/DELETE.js
const fs = require("fs");
const path = require("path");
const router = require("express").Router();
const { ROOT_DIR, PARSED_DIR, REGISTRY_PATH } = require("../../utils/config");
const { readJson, writeJson } = require("../../utils/fileUtils");

function loadRegistry() { return readJson(REGISTRY_PATH); }
function saveRegistry(data) { writeJson(REGISTRY_PATH, data); }

// DELETE /api/uploads/cleanup-docs
router.delete("/cleanup-docs", (_req, res) => {
  try {
    const registry = loadRegistry();
    const docFiles = registry.filter(r =>
      ["sprint_report", "project_plan", "worklog"].includes(r.userType || r.detectedType) &&
      r.status === "parsed"
    );

    let deleted = 0;
    docFiles.forEach(entry => {
      if (entry.parseInfo?.jsonPath) {
        const fullPath = path.join(ROOT_DIR, entry.parseInfo.jsonPath);
        if (fs.existsSync(fullPath)) { fs.unlinkSync(fullPath); deleted++; }
        entry.status = "deleted";
        entry.parseInfo = null;
      }
    });

    const combinedPath = path.join(PARSED_DIR, "combined_documentation_metrics.json");
    if (fs.existsSync(combinedPath)) fs.unlinkSync(combinedPath);

    saveRegistry(registry);
    res.json({ success: true, message: `Cleaned up ${deleted} documentation files` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
