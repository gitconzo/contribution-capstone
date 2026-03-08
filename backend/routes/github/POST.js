// backend/routes/github/post.js
const path = require("path");
const { execFile } = require("child_process");
const router = require("express").Router();
const { ROOT_DIR, DATA_DIR, TEAMS_PATH } = require("../../utils/config");
const { readJson, writeJson, safeReadJson, ensureDir } = require("../../utils/fileUtils");
const { pyBin, runFile } = require("../../utils/processUtils");
const { readActiveId } = require("../../utils/activeTeamUtils");

function parseRepoFromUrl(url) {
  let owner = "", repo = "";
  try {
    if (url.includes("github.com")) {
      const cleaned = url.replace(/\.git$/i, "");
      const parts = cleaned.split(/github\.com[/:]/).pop().split("/");
      owner = (parts[0] || "").trim();
      repo  = (parts[1] || "").trim();
    } else if (/^[^/]+\/[^/]+$/.test(url)) {
      [owner, repo] = url.split("/");
    }
  } catch {}
  return { url, owner, repo };
}

// POST /api/github/fetch  (uses active team's saved repo URL)
router.post("/fetch", (req, res) => {
  const activeId = readActiveId();
  const teams = readJson(TEAMS_PATH);
  const active = teams.find(t => t.id === activeId) || null;

  if (!active?.repo?.url) {
    return res.status(400).json({ error: "Active team has no repository URL configured." });
  }

  const script = path.join(ROOT_DIR, "fetchData.js");
  const env = {
    ...process.env,
    REPO_URL:   active.repo.url,
    REPO_OWNER: active.repo.owner || "",
    REPO_NAME:  active.repo.repo  || "",
  };

  execFile("node", [script], { cwd: ROOT_DIR, env }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: `GitHub fetch failed: ${stderr || err.message}` });
    res.json({ success: true, message: "Fetched GitHub commits.", stdout });
  });
});

// POST /api/github/analyze  { url }
router.post("/analyze", async (req, res) => {
  try {
    const rawUrl = String(req.body?.url || "").trim();
    if (!rawUrl) return res.status(400).json({ error: "Missing 'url' in body." });

    const { url, owner, repo } = parseRepoFromUrl(rawUrl);
    if (!owner || !repo) return res.status(400).json({ error: "Could not parse owner/repo from URL." });

    ensureDir(DATA_DIR);
    writeJson(path.join(DATA_DIR, "repo.json"), { url, owner, repo });

    await runFile("node", [path.join(ROOT_DIR, "fetchData.js")], { cwd: ROOT_DIR });
    await runFile(pyBin(), [path.join(ROOT_DIR, "main.py"), "--repo-url", url], { cwd: ROOT_DIR });

    const commits = safeReadJson(path.join(DATA_DIR, "commits.json"), []);
    res.json({ success: true, repo: { owner, repo, url }, summary: { commits: commits.length } });
  } catch (e) {
    console.error("analyze error:", e);
    res.status(500).json({ error: e.message || "Failed to analyze GitHub repo" });
  }
});

module.exports = router;
