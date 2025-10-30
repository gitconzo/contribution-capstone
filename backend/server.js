// backend/server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { execFile } = require("child_process");
const { aggregateTeamScores } = require("./services/aggregator");
const { combineDocumentationMetrics } = require("./services/combineDocumentationMetrics");

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

// ---------------------- Scores / GitHub ----------------------

// Scores computed from data/commits.json (populated by fetch)
app.get("/api/scores", (req, res) => {
  try {
    const teamId = req.query.teamId || getActiveTeamId();
    if (!teamId) return res.status(400).json({ error: "No active team." });

    const payload = aggregateTeamScores({ teamId, rootDir: __dirname });
    // payload = { team, ranking:[{name,email,github,score,breakdown,raw}], weights, ... }
    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "Failed to aggregate scores" });
  }
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

// Upload a single file (field name: "file") - DOCUMENTS ONLY
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
    const py = path.join(__dirname, "parsers", "attendance.py");
    const outJson = path.join(DATA_DIR, "attendance.json");
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
    const py = path.join(__dirname, "parsers", "worklog_parser.py");
    const outJson = path.join(DATA_DIR, "worklog.json");
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
    const timestamp = Date.now();
    const outJson = path.join(DATA_DIR, `sprint_report_${timestamp}.json`);
    
    execFile("python3", [py, absPath, outJson], { cwd: __dirname }, (err, stdout, stderr) => {
      if (err) {
        entry.status = "parse_failed";
        entry.parseInfo = { message: `Sprint report parse failed: ${stderr || err.message}` };
      } else {
        entry.status = "parsed";
        entry.parseInfo = { jsonPath: path.relative(__dirname, outJson), message: "Sprint report parsed successfully" };

        try {
          combineDocumentationMetrics(__dirname);
        } catch (err) {
          console.error("Failed to combine documentation metrics:", err);
        }
      }
      finish();
    });
    return;
  }

  // Project plan (.docx)
  if (finalType === "project_plan" && ext === ".docx") {
    const py = path.join(__dirname, "parsers", "parse_project_plan_docx.py");
    const timestamp = Date.now();
    const outJson = path.join(DATA_DIR, `project_plan_${timestamp}.json`);
    
    execFile("python3", [py, absPath, outJson], { cwd: __dirname }, (err, stdout, stderr) => {
      if (err) {
        entry.status = "parse_failed";
        entry.parseInfo = { message: `Project Plan parse failed: ${stderr || err.message}` };
      } else {
        entry.status = "parsed";
        entry.parseInfo = { jsonPath: path.relative(__dirname, outJson), message: "Project Plan parsed successfully" };

        try {
          combineDocumentationMetrics(__dirname);
        } catch (err) {
          console.error("Failed to combine documentation metrics:", err);
        }
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

// Mount routers BEFORE any catch-all routes
const teamsRouter = require("./routes/teams");
const rulesRouter = require("./routes/rules");
app.use("/api/teams", teamsRouter);
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

// Cleanup endpoint
app.delete("/api/uploads/cleanup-docs", (req, res) => {
  try {
    const registry = loadRegistry();
    
    // Find all doc-related JSON files
    const docFiles = registry.filter(r => 
      ["sprint_report", "project_plan", "worklog"].includes(r.userType || r.detectedType) &&
      r.status === "parsed"
    );
    
    // Delete the parsed JSON files
    let deleted = 0;
    docFiles.forEach(entry => {
      if (entry.parseInfo?.jsonPath) {
        const fullPath = path.join(__dirname, entry.parseInfo.jsonPath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          deleted++;
        }
        // Mark as deleted in registry
        entry.status = "deleted";
        entry.parseInfo = null;
      }
    });
    
    // Delete combined metrics
    const combinedPath = path.join(DATA_DIR, "combined_documentation_metrics.json");
    if (fs.existsSync(combinedPath)) {
      fs.unlinkSync(combinedPath);
    }
    
    saveRegistry(registry);
    
    res.json({ 
      success: true, 
      message: `Cleaned up ${deleted} documentation files` 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});