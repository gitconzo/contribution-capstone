// backend/routes/github/GET.js
const fs = require("fs");
const path = require("path");
const router = require("express").Router();
const { DATA_DIR, ANALYSES_DIR } = require("../../utils/config");
const { safeReadJson } = require("../../utils/fileUtils");

// GET /api/github/status?teamId=
router.get("/status", (req, res) => {
  const teamId = String(req.query.teamId || "").trim();
  if (!teamId) return res.json({ status: "idle" });

  const commits = path.join(DATA_DIR, "commits.json");
  const statsPath  = path.join(ANALYSES_DIR, `overall_${teamId}_stats.json`);
  const statusPath = path.join(ANALYSES_DIR, `overall_${teamId}_status.json`);

  const analysisStatus = safeReadJson(statusPath, { status: "idle" });

  const out = {
    ...analysisStatus,
    commitsExists:    fs.existsSync(commits),
    finalStatsExists: fs.existsSync(statsPath),
    commitsMtime:     null,
    finalStatsMtime:  null,
  };
  try {
    if (out.commitsExists)    out.commitsMtime    = fs.statSync(commits).mtimeMs;
    if (out.finalStatsExists) out.finalStatsMtime = fs.statSync(statsPath).mtimeMs;
  } catch (_) {}

  res.json(out);
});

module.exports = router;
