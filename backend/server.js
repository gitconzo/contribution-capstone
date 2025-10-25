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

// Ensure folders / files exist
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const REGISTRY_PATH = path.join(__dirname, "fileRegistry.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(REGISTRY_PATH)) fs.writeFileSync(REGISTRY_PATH, JSON.stringify([], null, 2));

// Helpers for registry
function loadRegistry() {
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
}
function saveRegistry(data) {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2));
}

// Multer storage (preserve ext, add timestamp)
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

// Simple type detection by name
function detectTypeFromName(filename, userGuess) {
  if (userGuess && userGuess !== "unknown") return userGuess;
  const lower = (filename || "").toLowerCase();

  if (lower.includes("attendance")) return "attendance";
  if (lower.includes("worklog") || lower.includes("weekly")) return "worklog";
  if (lower.includes("sprint") && lower.includes("report")) return "sprint_report"; // ✅ NEW
  if (lower.includes("peer")) return "peer_review";
  return "unknown";
}

// GitHub scoring (reads data/commits.json)
// Normalizes commits/additions/deletions and ranks authors
app.get("/api/scores", (req, res) => {
  const commitsPath = path.join(DATA_DIR, "commits.json");
  if (!fs.existsSync(commitsPath)) {
    return res.status(404).json({ error: "No commit data found. Run /api/github/fetch or fetchData.js." });
  }

  const commits = JSON.parse(fs.readFileSync(commitsPath, "utf-8"));
  if (!Array.isArray(commits) || commits.length === 0) {
    return res.json({ ranking: [], raw: {} });
  }

  // aggregate per author
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
    if (max === min) return values.map(() => 1); // avoid zero-div if all equal
    return values.map(v => (v - min) / (max - min));
  }

  // normalize each metric
  const commitsNorm   = normalizeMinMax(commitsArr);
  const additionsNorm = normalizeMinMax(additionsArr);
  const deletionsNorm = normalizeMinMax(deletionsArr);

  // weights → tweak anytime
  const weights = { commits: 0.3, additions: 0.4, deletions: 0.3 };

  // final weighted score
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

  // rank & percent-of-total
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

// OPTIONAL: Trigger GitHub fetch from backend
// (This just runs fetchData.js which writes data/commits.json)
app.post("/api/github/fetch", (req, res) => {
  const script = path.join(__dirname, "fetchData.js");
  execFile("node", [script], { cwd: __dirname }, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: `GitHub fetch failed: ${stderr || err.message}` });
    }
    res.json({ success: true, message: "Fetched GitHub commits.", stdout });
  });
});

// Uploads: list (latest first)
app.get("/api/uploads", (req, res) => {
  const registry = loadRegistry().sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  res.json(registry);
});

// Upload a single file
// field name: "file"
app.post("/api/uploads", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const registry = loadRegistry();
  const userGuess = req.body?.userType || null;
  const detectedType = detectTypeFromName(req.file.originalname, userGuess);

  const entry = {
    id: path.basename(req.file.filename), // simple id = stored filename
    originalName: req.file.originalname,
    storedName: req.file.filename,
    storedPath: path.join("uploads", req.file.filename),
    mimetype: req.file.mimetype,
    size: req.file.size,
    uploadDate: new Date().toISOString(),
    detectedType,      // guessed by name
    userType: null,    // user may override via confirm
    status: "uploaded",// uploaded | confirmed | parsed | parse_failed
    parseInfo: null
  };

  registry.push(entry);
  saveRegistry(registry);
  res.json(entry);
});

// Confirm type & run parser if applicable
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

  function finish() {
    saveRegistry(registry);
    res.json(entry);
  }

  // Attendance: .xlsx --> parsers/attendance.py
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

  // Worklog: .docx/.pdf --> parsers/worklog_parser.py
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

    // Sprint Report: .docx --> parsers/parse_sprint_report_docx.py
  if (finalType === "sprint_report" && ext === ".docx") {
    const outJson = absPath.replace(ext, ".json");
    const py = path.join(__dirname, "parsers", "parse_sprint_report_docx.py");

    execFile("python3", [py, absPath], { cwd: __dirname }, (err, stdout, stderr) => {
      if (err) {
        entry.status = "parse_failed";
        entry.parseInfo = { message: `Sprint report parse failed: ${stderr || err.message}` };
      } else {
        // The script already writes a .json automatically
        const jsonFile = path.join(path.dirname(absPath), "sprint_report_summary.json");
        entry.status = "parsed";
        entry.parseInfo = {
          jsonPath: path.relative(__dirname, jsonFile),
          message: "Sprint report parsed successfully"
        };
      }
      finish();
    });
    return;
  }

  // Peer review / unknown → no parser
  entry.parseInfo = { message: "No parser run for this type." };
  finish();
});

// Serve uploaded files
app.use("/uploads", express.static(UPLOAD_DIR));

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

// Get parsed JSON content for a file
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
