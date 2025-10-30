// fetchData.js
const fs = require("fs");
const path = require("path");

// ✅ Add optional fetch polyfill for Node < 18
if (typeof fetch === "undefined") {
  global.fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));
}

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

function parseOwnerRepoFromUrl(raw) {
  if (!raw) return { owner: "", repo: "" };
  try {
    if (!raw.includes("://") && raw.split("/").length === 2) {
      const [o, r] = raw.split("/");
      return { owner: o, repo: r.replace(/\.git$/i, "") };
    }
    const u = new URL(raw);
    const parts = u.pathname.split("/").filter(Boolean);
    return { owner: parts[0] || "", repo: (parts[1] || "").replace(/\.git$/i, "") };
  } catch {
    return { owner: "", repo: "" };
  }
}

// ✅ NEW: env-first source of truth; fallback to repo.json
function readRepoInfo() {
  const envUrl   = (process.env.REPO_URL   || "").trim();
  const envOwner = (process.env.REPO_OWNER || "").trim();
  const envRepo  = (process.env.REPO_NAME  || "").trim();

  if (envUrl || (envOwner && envRepo)) {
    const parsed = parseOwnerRepoFromUrl(envUrl);
    const owner = envOwner || parsed.owner;
    const repo  = envRepo  || parsed.repo;
    if (!owner || !repo) {
      throw new Error(`Invalid env repo info. Got owner="${owner}" repo="${repo}" from REPO_URL="${envUrl}"`);
    }
    return { url: envUrl || `https://github.com/${owner}/${repo}`, owner, repo };
  }

  // fallback to repo.json
  if (!fs.existsSync(repoPath)) {
    throw new Error(`Repo info not found at ${repoPath}. Save a repository first.`);
  }
  const r = JSON.parse(fs.readFileSync(repoPath, "utf-8"));
  if ((!r.owner || !r.repo) && r.url) {
    const parsed = parseOwnerRepoFromUrl(r.url);
    r.owner = r.owner || parsed.owner;
    r.repo  = r.repo  || parsed.repo;
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

async function fetchAllCommits(owner, repo, token, maxDetailed = 200) {
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  let page = 1;
  const per_page = 100;
  const summaries = [];

  while (true) {
    const url = `${base}/commits?per_page=${per_page}&page=${page}`;
    const r = await ghFetch(url, token);
    const batch = await r.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    summaries.push(...batch);
    if (batch.length < per_page) break;
    page += 1;
    if (page > 10) break; // cap ~1000 commits
  }

  const detailed = [];
  const limit = Math.min(summaries.length, maxDetailed);
  for (let i = 0; i < limit; i++) {
    const sha = summaries[i].sha;
    const url = `${base}/commits/${sha}`;
    try {
      const r = await ghFetch(url, token);
      const j = await r.json();
      detailed.push({
        sha,
        author: (j.commit && j.commit.author && j.commit.author.name) || (j.author && j.author.login) || "Unknown",
        stats: j.stats || { additions: 0, deletions: 0 }
      });
    } catch {
      detailed.push({ sha, author: "Unknown", stats: { additions: 0, deletions: 0 } });
    }
  }

  for (let i = maxDetailed; i < summaries.length; i++) {
    const s = summaries[i];
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
    const { owner, repo } = readRepoInfo();
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
    const commits = await fetchAllCommits(owner, repo, token, 200);
    ensureDirForFile(commitsOutPath);
    fs.writeFileSync(commitsOutPath, JSON.stringify(commits, null, 2));
    console.log(`Wrote ${commits.length} commits → ${commitsOutPath}`);
  } catch (err) {
    console.error("fetchData error:", err.message);
    process.exit(1);
  }
})();
