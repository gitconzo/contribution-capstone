// backend/routes/github/POST.js
const path = require("path");
const { execFile } = require("child_process");
const router = require("express").Router();
const { ROOT_DIR, DATA_DIR, ANALYSES_DIR } = require("../../utils/config");
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

// POST /api/github/fetch  (uses active team's saved repo URL)
router.post("/fetch", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT repo_url, repo_owner, repo_name FROM teams ORDER BY created_at DESC LIMIT 1"
    );
    const active = result.rows[0] || null;

    if (!active?.repo_url) {
      return res.status(400).json({ error: "Active team has no repository URL configured." });
    }

    const script = path.join(ROOT_DIR, "fetchData.js");
    const env = {
      ...process.env,
      REPO_URL:   active.repo_url,
      REPO_OWNER: active.repo_owner || "",
      REPO_NAME:  active.repo_name  || "",
    };

    execFile("node", [script], { cwd: ROOT_DIR, env }, (err, stdout, stderr) => {
      if (err) return res.status(500).json({ error: `GitHub fetch failed: ${stderr || err.message}` });
      res.json({ success: true, message: "Fetched GitHub commits.", stdout });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/// POST /api/github/analyze  { url, teamId }
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

    ensureDir(DATA_DIR);
    ensureDir(ANALYSES_DIR);
    const branch     = rawUrl.includes("/tree/") ? rawUrl.split("/tree/")[1] : "";
    const outputPath = path.join(ANALYSES_DIR, `overall_${teamId}_stats.json`);
    const statusPath = path.join(ANALYSES_DIR, `overall_${teamId}_status.json`);

    writeJson(path.join(DATA_DIR, "repo.json"), { url, owner, repo, branch });
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
