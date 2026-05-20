// backend/routes/github/POST.js
const path = require("path");
const router = require("express").Router();
const { ROOT_DIR, ANALYSES_DIR } = require("../../utils/config");
const { writeJson, ensureDir } = require("../../utils/fileUtils");
const { pyBin, runFile } = require("../../utils/processUtils");
const db = require("../../utils/db");

function parseRepoFromUrl(url) {
  let owner = "", repo = "";
  try {
    if (url.includes("github.com")) {
      const cleaned = url.replace(/\.git$/i, "");
      // Strip /tree/branch or /blob/branch suffixes
      const stripped = cleaned.replace(/\/tree\/.*$/, "").replace(/\/blob\/.*$/, "");
      const parts = stripped.split(/github\.com[/:]/).pop().split("/");
      owner = (parts[0] || "").trim();
      repo  = (parts[1] || "").trim();
    } else if (/^[^/]+\/[^/]+$/.test(url)) {
      [owner, repo] = url.split("/");
    }
  } catch {}
  return { url, owner, repo };
}

// POST /api/github/analyze  { url, teamId }
router.post("/analyze", async (req, res) => {
  try {
    const rawUrl  = String(req.body?.url    || "").trim();
    const teamId  = String(req.body?.teamId || "").trim();
    if (!rawUrl)  return res.status(400).json({ error: "Missing 'url' in body." });
    if (!teamId)  return res.status(400).json({ error: "Missing 'teamId' in body." });

    const { url, owner, repo } = parseRepoFromUrl(rawUrl);
    if (!owner || !repo) return res.status(400).json({ error: "Could not parse owner/repo from URL." });

    const teamUpdate = await db.query(
      "UPDATE teams SET repo_url = $1, repo_owner = $2, repo_name = $3 WHERE id = $4 RETURNING id",
      [url, owner, repo, teamId]
    );
    if (!teamUpdate.rows.length) return res.status(404).json({ error: "Team not found." });

    ensureDir(ANALYSES_DIR);
    const outputPath = path.join(ANALYSES_DIR, `overall_${teamId}_stats.json`);
    const statusPath = path.join(ANALYSES_DIR, `overall_${teamId}_status.json`);

    writeJson(statusPath, { status: "running", startedAt: new Date().toISOString() });

    // Return immediately — run analysis in background
    res.json({ success: true, status: "running", message: "Analysis started." });

    (async () => {
      try {
        await runFile(pyBin(), [
          path.join(ROOT_DIR, "main.py"),
          "--repo-url", url,
          "--output", outputPath,
        ], { cwd: ROOT_DIR });
        writeJson(statusPath, { status: "complete", completedAt: new Date().toISOString() });
      } catch (e) {
        console.error("Background analysis error:", e.message);
        writeJson(statusPath, { status: "error", error: e.message });
      }
    })();

  } catch (e) {
    console.error("analyze error:", e);
    res.status(500).json({ error: e.message || "Failed to analyze GitHub repo" });
  }
});

module.exports = router;
