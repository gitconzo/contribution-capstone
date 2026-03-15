// backend/routes/uploads/GET.js
const path = require("path");
const router = require("express").Router();
const { ROOT_DIR, REGISTRY_PATH } = require("../../utils/config");
const { readJson, safeReadJson } = require("../../utils/fileUtils");

function loadRegistry() { return readJson(REGISTRY_PATH); }

// GET /api/uploads
router.get("/", (_req, res) => {
  const registry = loadRegistry().sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  res.json(registry);
});

// GET /api/uploads/:id/json
router.get("/:id/json", (req, res) => {
  const entry = loadRegistry().find(f => f.id === req.params.id);
  if (!entry || !entry.parseInfo?.jsonPath) {
    return res.status(404).json({ error: "Parsed JSON not found for this file" });
  }

  const jsonPath = path.join(ROOT_DIR, entry.parseInfo.jsonPath);
  const data = safeReadJson(jsonPath);
  if (!data) return res.status(404).json({ error: "JSON file not found on server" });

  res.json(data);
});

module.exports = router;
