const fs = require("fs");
const path = require("path");

const GROUP_ID   = process.env.GROUP_ID || null;
const GROUPS_DIR = process.env.GROUPS_DIR || null;

const dataDirLegacy = path.join(__dirname, "data");
const repoPathLegacy = path.join(dataDirLegacy, "repo.json");

const repoPath = (GROUP_ID && GROUPS_DIR)
  ? path.join(GROUPS_DIR, GROUP_ID, "repo.json")
  : repoPathLegacy;

const commitsOutPath = (GROUP_ID && GROUPS_DIR)
  ? path.join(GROUPS_DIR, GROUP_ID, "commits.json")
  : path.join(dataDirLegacy, "commits.json");

function ensureDirForFile(p) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readRepoInfo() {
  if (!fs.existsSync(repoPath)) {
    throw new Error(`Repo info not found at ${repoPath}. Save a repository for this group first.`);
  }
  const r = JSON.parse(fs.readFileSync(repoPath, "utf-8"));
  // support formats: {url, owner, repo}
  if ((!r.owner || !r.repo) && r.url) {
    const parts = r.url.split("/").filter(Boolean);
    r.owner = r.owner || parts[parts.length - 2];
    r.repo  = r.repo  || (parts[parts.length - 1] || "").replace(".git", "");
  }
  if (!r.owner || !r.repo) {
    throw new Error(`Invalid repo info: requires owner/repo. Got: ${JSON.stringify(r)}`);
  }
  return r;
}

async function ghFetch(url, token, init = {}) {
  const headers = Object.assign(
    {
      "Accept": "application/vnd.github+json",
      "User-Agent": "contribution-assessment-tool/1.0"
    },
    token ? { "Authorization": `Bearer ${token}` } : {}
  );
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const txt = await res.text().catch(()=> "");
    throw new Error(`GitHub ${res.status} ${res.statusText} on ${url}: ${txt}`);
  }
  return res;
}

async function fetchAllCommits(owner, repo, token, maxDetailed = 200, branch = "") {
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  let page = 1;
  const per_page = 100;
  const summaries = [];

  while (true) {
    const url = `${base}/commits?per_page=${per_page}&page=${page}${branch ? `&sha=${branch}` : ""}`;
    const r = await ghFetch(url, token);
    const batch = await r.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    summaries.push(...batch);
    if (batch.length < per_page) break;
    page += 1;
    if (page > 10) break;
  }

  // Fetch detailed stats for first N commits
  const detailed = [];
  const limit = Math.min(summaries.length, maxDetailed);
  for (let i = 0; i < limit; i++) {
    const sha = summaries[i].sha;
    const url = `${base}/commits/${sha}`;
    try {
      const r = await ghFetch(url, token);
      const j = await r.json();

      // Skip merge commits (more than one parent)
      if (j.parents && j.parents.length > 1) continue;

      // Filter out noise files before summing stats
      const ignoreFilePatterns = [
        "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
        "node_modules/", "dist/", "build/", ".min.js",
        ".min.css", "*.map", "vendor/", "coverage/"
      ];

      const filteredFiles = (j.files || []).filter(file => {
        const filename = file.filename || "";
        return !ignoreFilePatterns.some(pattern => filename.includes(pattern));
      });

      const additions = filteredFiles.reduce((sum, f) => sum + (f.additions || 0), 0);
      const deletions = filteredFiles.reduce((sum, f) => sum + (f.deletions || 0), 0);

      detailed.push({
        sha: sha,
        author: (j.commit && j.commit.author && j.commit.author.name) || (j.author && j.author.login) || "Unknown",
        stats: { additions, deletions }
      });
    } catch (e) {
      detailed.push({ sha, author: "Unknown", stats: { additions: 0, deletions: 0 } });
    }
  }

  for (let i = maxDetailed; i < summaries.length; i++) {
    const s = summaries[i];
    const message = s.commit?.message || "";
    if (message.startsWith("Merge")) continue;
    detailed.push({
      sha: s.sha,
      author: (s.commit && s.commit.author && s.commit.author.name) || (s.author && s.author.login) || "Unknown",
      stats: { additions: 0, deletions: 0 }
    });
  }

  return detailed;
}

(async () => {
  try {
    const repoInfo = readRepoInfo();
    const { owner, repo } = repoInfo;
    const branch = repoInfo.branch || "";
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

    const commits = await fetchAllCommits(owner, repo, token, 200, branch);
    ensureDirForFile(commitsOutPath);
    fs.writeFileSync(commitsOutPath, JSON.stringify(commits, null, 2));
    console.log(`Wrote ${commits.length} commits → ${commitsOutPath}`);
  } catch (err) {
    console.error("fetchData error:", err.message);
    process.exit(1);
  }
})();