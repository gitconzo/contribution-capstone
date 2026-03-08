// backend/routes/github/get.js
const fs = require("fs");
const router = require("express").Router();
const { DATA_DIR } = require("../../utils/config");
const path = require("path");

// GET /api/github/status
router.get("/status", (_req, res) => {
  const commits    = path.join(DATA_DIR, "commits.json");
  const finalStats = path.join(DATA_DIR, "finalStats.json");

  const out = {
    commitsExists:    fs.existsSync(commits),
    finalStatsExists: fs.existsSync(finalStats),
    commitsMtime:     null,
    finalStatsMtime:  null,
  };
  try {
    if (out.commitsExists)    out.commitsMtime    = fs.statSync(commits).mtimeMs;
    if (out.finalStatsExists) out.finalStatsMtime = fs.statSync(finalStats).mtimeMs;
  } catch (_) {}

  res.json(out);
});

module.exports = router;
