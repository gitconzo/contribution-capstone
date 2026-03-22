// backend/routes/uploads/GET.js
const path = require("path");
const router = require("express").Router();
const { ROOT_DIR, REGISTRY_PATH } = require("../../utils/config");
const { readJson, safeReadJson } = require("../../utils/fileUtils");
const { getPresignedUploadUrl, getPresignedDownloadUrl } = require("../../utils/s3");

function loadRegistry() { return readJson(REGISTRY_PATH); }

// GET /api/uploads
router.get("/", (_req, res) => {
  const registry = loadRegistry().sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  res.json(registry);
});

// GET /api/uploads/presign
// returns presigned S3 URL for direct browser upload +& the S3 key to reference later
router.get("/presign", async (req, res) => {
  try {
    const { filename, teamId, contentType } = req.query;
    if (!filename || !teamId) return res.status(400).json({ error: "Missing filename or teamId" });

    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    const storedName = `${base}__${Date.now()}${ext}`;
    const s3Key = `${teamId}/uploads/${storedName}`;

    const url = await getPresignedUploadUrl(s3Key, contentType || "application/octet-stream");
    res.json({ url, s3Key, storedName });
  } catch (e) {
    console.error("GET /api/uploads/presign error:", e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/uploads/:id/download
// returns a presigned download URL for a file in S3
router.get("/:id/download", async (req, res) => {
  try {
    const entry = loadRegistry().find(f => f.id === req.params.id);
    if (!entry?.s3Key) return res.status(404).json({ error: "File not found in S3" });
    const url = await getPresignedDownloadUrl(entry.s3Key);
    res.json({ url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
