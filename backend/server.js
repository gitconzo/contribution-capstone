// backend/server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { execFile } = require("child_process");

const app = express();
const PORT = 5002;

app.use(cors());
app.use(express.json());

// Paths
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const REGISTRY_PATH = path.join(__dirname, "fileRegistry.json");
const TEAMS_PATH = path.join(DATA_DIR, "teams.json");
const ACTIVE_TEAM_PATH = path.join(DATA_DIR, "activeTeam.json");

// Ensure dirs/files
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(REGISTRY_PATH)) fs.writeFileSync(REGISTRY_PATH, JSON.stringify([], null, 2));
if (!fs.existsSync(TEAMS_PATH)) fs.writeFileSync(TEAMS_PATH, JSON.stringify([], null, 2));
if (!fs.existsSync(ACTIVE_TEAM_PATH)) fs.writeFileSync(ACTIVE_TEAM_PATH, JSON.stringify(null, null, 2));

// Registry helpers
function loadRegistry() { return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")); }
function saveRegistry(data) { fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2)); }

// Teams helpers
function loadTeams() { return JSON.parse(fs.readFileSync(TEAMS_PATH, "utf-8")); }
function saveTeams(data) { fs.writeFileSync(TEAMS_PATH, JSON.stringify(data, null, 2)); }
function getActiveTeamId() { return JSON.parse(fs.readFileSync(ACTIVE_TEAM_PATH, "utf-8")); }
function setActiveTeamId(id) { fs.writeFileSync(ACTIVE_TEAM_PATH, JSON.stringify(id, null, 2)); }
function findTeamById(id) { return loadTeams().find(t => t.id === id) || null; }
function getActiveTeam() {
  const id = getActiveTeamId();
  return id ? findTeamById(id) : null;
}

// Multer storage for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `${base}__${ts}${ext}`);
  }
});
const upload = multer({ storage });

// Multer for CSV in team creation (reuse same storage into uploads to keep simple)
const teamUpload = multer({ storage });

// Simple type detection by name
function detectTypeFromName(filename, userGuess) {
  if (userGuess && userGuess !== "unknown") return userGuess;
  const lower = (filename || "").toLowerCase();
  if (lower.includes("attendance")) return "attendance";
  if (lower.includes("worklog")) return "worklog";
  if (lower.includes("sprint")) return "sprint_report";
  if (lower.includes("peer")) return "peer_review";
  if (lower.includes("project") && lower.includes("plan")) return "project_plan";
  return "unknown";
}

// ---------------------- Teams API ----------------------

// Create team (multipart: fields + optional studentsCsv)
// fields: teamName, projectCode, repoUrl
app.post("/api/teams", teamUpload.single("studentsCsv"), (req, res) => {
  const name = (req.body?.teamName || "").trim();
  const code = (req.body?.projectCode || "").trim();
  const repoUrlRaw = (req.body?.repoUrl || "").trim();

  if (!name || !code) {
    return res.status(400).json({ error: "teamName and projectCode are required" });
  }

  // Basic repo parse (owner/repo) if provided
  let repo = null;
  if (repoUrlRaw) {
    const parts = repoUrlRaw.split("/").filter(Boolean);
    const owner = parts[parts.length - 2] || "";
    const repoName = (parts[parts.length - 1] || "").replace(".git", "");
    if (owner && repoName) {
      repo = { url: repoUrlRaw, owner, repo: repoName };
    } else {
      repo = { url: repoUrlRaw };
    }
  }

  // Parse CSV (very simple: name,email)
  let students = [];
  if (req.file) {
    try {
      const csvText = fs.readFileSync(path.join(UPLOAD_DIR, req.file.filename), "utf-8");
      const lines = csvText.split(/\r?\n/).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        const row = lines[i].trim();
        if (!row) continue;
        const cols = row.split(",").map(s => s.trim());
        if (cols.length >= 2) {
          // Skip header if matches
          if (i === 0 && /name/i.test(cols[0]) && /email/i.test(cols[1])) continue;
          students.push({ name: cols[0], email: cols[1] });
        }
      }
    } catch (e) {
      return res.status(400).json({ error: `Failed to parse CSV: ${e.message}` });
    }
  }

  const id = `team_${Date.now()}`;
  const team = {
    id, name, code,
    repo, // {url, owner, repo} or null
    students, // [{name,email}]
    rules: null, // will be saved via /rules
    createdAt: new Date().toISOString()
  };

  const teams = loadTeams();
  teams.push(team);
  saveTeams(teams);

  // Set active to this team if none
  if (!getActiveTeamId()) setActiveTeamId(id);

  res.json(team);
});

// List teams
app.get("/api/teams", (req, res) => {
  res.json(loadTeams());
});

// Get active team
app.get("/api/teams/active", (req, res) => {
  const team = getActiveTeam();
  if (!team) return res.status(404).json(null);
  res.json(team);
});

// Set active team
app.post("/api/teams/active", (req, res) => {
  const id = req.body?.id;
  if (!id) return res.status(400).json({ error: "Missing team id" });
  const team = findTeamById(id);
  if (!team) return res.status(404).json({ error: "Team not found" });
  setActiveTeamId(id);
  res.json({ success: true });
});

// Get team by id
app.get("/api/teams/:id", (req, res) => {
  const t = findTeamById(req.params.id);
  if (!t) return res.status(404).json({ error: "Team not found" });
  res.json(t);
});

// Save rules for a team
app.post("/api/teams/:id/rules", (req, res) => {
  const id = req.params.id;
  const teams = loadTeams();
  const idx = teams.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: "Team not found" });

  const { rules, autoRecalc, crossVerify, triangulation, peerValidation } = req.body || {};
  teams[idx].rules = {
    rules: Array.isArray(rules) ? rules : null,
    autoRecalc: !!autoRecalc,
    crossVerify: !!crossVerify,
    triangulation: triangulation || { codeWorklog: 80, meetingDoc: 70, activityDist: 60 },
    peerValidation: peerValidation || "Statistical analysis",
    savedAt: new Date().toISOString()
  };
  saveTeams(teams);
  res.json(teams[idx].rules);
});

// Get rules for a team
app.get("/api/teams/:id/rules", (req, res) => {
  const t = findTeamById(req.params.id);
  if (!t) return res.status(404).json({ error: "Team not found" });
  res.json(t.rules || null);
});

// ---------------------- Scores / GitHub ----------------------

// Scores computed from data/commits.json (populated by fetch)
app.get("/api/scores", (req, res) => {
  const commitsPath = path.join(DATA_DIR, "commits.json");
  if (!fs.existsSync(commitsPath)) {
    return res.status(404).json({ error: "No commit data found. Run /api/github/fetch or fetchData.js." });
  }

  const commits = JSON.parse(fs.readFileSync(commitsPath, "utf-8"));
  if (!Array.isArray(commits) || commits.length === 0) {
    return res.json({ ranking: [], raw: {} });
  }

  const raw = {};
  commits.forEach(c => {
    const author = c.author || "Unknown";
    if (!raw[author]) raw[author] = { commits: 0, additions: 0, deletions: 0 };
    raw[author].commits += 1;
    raw[author].additions += c.stats?.additions || 0;
    raw[author].deletions += c.stats?.deletions || 0;
  });

  const authors = Object.keys(raw);
  const commitsArr   = authors.map(a => raw[a].commits);
  const additionsArr = authors.map(a => raw[a].additions);
  const deletionsArr = authors.map(a => raw[a].deletions);

  function normalizeMinMax(values) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return values.map(() => 1);
    return values.map(v => (v - min) / (max - min));
  }

  const commitsNorm   = normalizeMinMax(commitsArr);
  const additionsNorm = normalizeMinMax(additionsArr);
  const deletionsNorm = normalizeMinMax(deletionsArr);

  const weights = { commits: 0.3, additions: 0.4, deletions: 0.3 };
  const scored = authors.map((author, i) => ({
    author,
    commits: raw[author].commits,
    additions: raw[author].additions,
    deletions: raw[author].deletions,
    score:
      commitsNorm[i]   * weights.commits +
      additionsNorm[i] * weights.additions +
      deletionsNorm[i] * weights.deletions
  }));

  scored.sort((a, b) => b.score - a.score);
  const totalScore = scored.reduce((s, r) => s + r.score, 0) || 1;

  const ranking = scored.map((r, idx) => ({
    rank: idx + 1,
    author: r.author,
    commits: r.commits,
    additions: r.additions,
    deletions: r.deletions,
    score: Number(r.score.toFixed(6)),
    percent: `${((r.score / totalScore) * 100).toFixed(1)}%`
  }));

  res.json({ ranking, raw });
});

// Trigger GitHub fetch (expects active team repo)
app.post("/api/github/fetch", (req, res) => {
  const active = getActiveTeam();
  if (!active?.repo?.url) {
    return res.status(400).json({ error: "Active team has no repository URL configured." });
  }
  const script = path.join(__dirname, "fetchData.js");
  // Pass repo info via env to the script (script should read process.env.REPO_URL etc.)
  const env = { ...process.env, REPO_URL: active.repo.url, REPO_OWNER: active.repo.owner || "", REPO_NAME: active.repo.repo || "" };

  execFile("node", [script], { cwd: __dirname, env }, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: `GitHub fetch failed: ${stderr || err.message}` });
    }
    res.json({ success: true, message: "Fetched GitHub commits.", stdout });
  });
});

// ---------------------- Uploads API ----------------------

// List uploads (latest first)
app.get("/api/uploads", (req, res) => {
  const registry = loadRegistry().sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  res.json(registry);
});

// Upload a single file (field name: "file")
app.post("/api/uploads", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const registry = loadRegistry();
  const userGuess = req.body?.userType || null;
  const detectedType = detectTypeFromName(req.file.originalname, userGuess);

  const entry = {
    id: path.basename(req.file.filename),
    originalName: req.file.originalname,
    storedName: req.file.filename,
    storedPath: path.join("uploads", req.file.filename),
    mimetype: req.file.mimetype,
    size: req.file.size,
    uploadDate: new Date().toISOString(),
    detectedType,
    userType: null,
    status: "uploaded",
    parseInfo: null
  };

  registry.push(entry);
  saveRegistry(registry);
  res.json(entry);
});

// Confirm & parse
app.post("/api/uploads/confirm", (req, res) => {
  const { id, type } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing id" });

  const registry = loadRegistry();
  const entry = registry.find(r => r.id === id);
  if (!entry) return res.status(404).json({ error: "Upload not found" });

  const finalType = type && type !== "unknown" ? type : (entry.detectedType || "unknown");
  entry.userType = finalType;
  entry.status = "confirmed";

  const absPath = path.join(__dirname, entry.storedPath);
  const ext = path.extname(absPath).toLowerCase();

  const finish = () => {
    saveRegistry(registry);
    res.json(entry);
  };

  // Attendance (xlsx)
  if (finalType === "attendance" && (ext === ".xlsx" || ext === ".xls")) {
    const outJson = absPath.replace(ext, ".json");
    const py = path.join(__dirname, "parsers", "attendance.py");
    execFile("python3", [py, absPath, outJson], { cwd: __dirname }, (err, stdout, stderr) => {
      if (err) {
        entry.status = "parse_failed";
        entry.parseInfo = { message: `Attendance parse failed: ${stderr || err.message}` };
      } else {
        entry.status = "parsed";
        entry.parseInfo = { jsonPath: path.relative(__dirname, outJson), message: "Attendance parsed" };
      }
      finish();
    });
    return;
  }

  // Worklog (.docx/.pdf)
  if (finalType === "worklog" && (ext === ".docx" || ext === ".pdf")) {
    const outJson = absPath.replace(ext, ".json");
    const py = path.join(__dirname, "parsers", "worklog_parser.py");
    execFile("python3", [py, absPath, outJson], { cwd: __dirname }, (err, stdout, stderr) => {
      if (err) {
        entry.status = "parse_failed";
        entry.parseInfo = { message: `Worklog parse failed: ${stderr || err.message}` };
      } else {
        entry.status = "parsed";
        entry.parseInfo = { jsonPath: path.relative(__dirname, outJson), message: "Worklog parsed" };
      }
      finish();
    });
    return;
  }

  // Sprint report (.docx)
  if (finalType === "sprint_report" && ext === ".docx") {
    const py = path.join(__dirname, "parsers", "parse_sprint_report_docx.py");
    execFile("python3", [py, absPath], { cwd: __dirname }, (err, stdout, stderr) => {
      if (err) {
        entry.status = "parse_failed";
        entry.parseInfo = { message: `Sprint report parse failed: ${stderr || err.message}` };
      } else {
        const jsonFile = path.join(path.dirname(absPath), "sprint_report_summary.json");
        entry.status = "parsed";
        entry.parseInfo = { jsonPath: path.relative(__dirname, jsonFile), message: "Sprint report parsed successfully" };
      }
      finish();
    });
    return;
  }

  // Project plan (.docx)
  if (finalType === "project_plan" && ext === ".docx") {
    const py = path.join(__dirname, "parsers", "parse_project_plan_docx.py");
    execFile("python3", [py, absPath], { cwd: __dirname }, (err, stdout, stderr) => {
      if (err) {
        entry.status = "parse_failed";
        entry.parseInfo = { message: `Project Plan parse failed: ${stderr || err.message}` };
      } else {
        const jsonFile = path.join(path.dirname(absPath), "project_plan_summary.json");
        entry.status = "parsed";
        entry.parseInfo = { jsonPath: path.relative(__dirname, jsonFile), message: "Project Plan parsed successfully" };
      }
      finish();
    });
    return;
  }

  // Unknown
  entry.parseInfo = { message: "No parser run for this type." };
  finish();
});

// Serve uploaded files
app.use("/uploads", express.static(UPLOAD_DIR));

const teamsRouter = require("./routes/teams");
const rulesRouter = require("./routes/rules");
app.use("/api", teamsRouter);
app.use("/api/rules", rulesRouter);

// Return parsed JSON for an upload
app.get("/api/uploads/:id/json", (req, res) => {
  const { id } = req.params;
  const registry = loadRegistry();
  const entry = registry.find(f => f.id === id);

  if (!entry || !entry.parseInfo?.jsonPath) {
    return res.status(404).json({ error: "Parsed JSON not found for this file" });
  }

  const jsonPath = path.join(__dirname, entry.parseInfo.jsonPath);
  if (!fs.existsSync(jsonPath)) {
    return res.status(404).json({ error: "JSON file not found on server" });
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
