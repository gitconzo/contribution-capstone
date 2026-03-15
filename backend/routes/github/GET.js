// backend/routes/github/GET.js
const fs = require("fs");
const path = require("path");
const router = require("express").Router();
const { DATA_DIR } = require("../../utils/config");

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
