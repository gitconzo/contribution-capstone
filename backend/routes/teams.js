// backend/routes/teams.js
const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const DATA_DIR = path.join(__dirname, "..", "data");
const TEAMS_PATH = path.join(DATA_DIR, "teams.json");
const ACTIVE_PATH = path.join(DATA_DIR, "activeTeam.json"); // may be string or {id: ...}

// Ensure data files exist
function ensureFile(file, init) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(init, null, 2));
}
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
ensureFile(TEAMS_PATH, []);
// If you already have an existing activeTeam file, leave it; otherwise create {id:null}
if (!fs.existsSync(ACTIVE_PATH)) fs.writeFileSync(ACTIVE_PATH, JSON.stringify({ id: null }, null, 2));

// Read helpers
function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function writeJson(p, v) {
  fs.writeFileSync(p, JSON.stringify(v, null, 2));
}

// Active team read that tolerates both formats:
// - plain string: "team_123"
// - object: { id: "team_123" }
function readActiveId() {
  try {
    const raw = fs.readFileSync(ACTIVE_PATH, "utf-8").trim();
    // plain string case (e.g., "team_1761724815106")
    if (raw.startsWith('"') || /^[A-Za-z0-9_\-]+$/.test(raw)) {
      const val = JSON.parse(raw); // will parse string literal -> "team_..."
      return typeof val === "string" ? val : (val?.id ?? null);
    }
    // object case
    const obj = JSON.parse(raw);
    return obj?.id ?? null;
  } catch {
    return null;
  }
}

function writeActiveId(id) {
  // Normalize to object form going forward
  writeJson(ACTIVE_PATH, { id });
}

// GET /api/teams
router.get("/", (req, res) => {
  const teams = readJson(TEAMS_PATH);
  res.json(teams);
});

// GET /api/teams/active
router.get("/active", (req, res) => {
  const id = readActiveId();
  res.json({ id });
});

// POST /api/teams/active  { id }
router.post("/active", (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing id" });

  const teams = readJson(TEAMS_PATH);
  if (!teams.find(t => t.id === id)) {
    return res.status(404).json({ error: "Team not found" });
  }
  writeActiveId(id);
  res.json({ ok: true, id });
});

// POST /api/teams  -> create a team
// Payload shape:
// {
//   "name": "Team Name",
//   "code": "COS40005",
//   "repo": { "url":"...", "owner":"...", "repo":"..." },
//   "students": [ { "name":"...", "email":"..." }, ... ]
// }
router.post("/", (req, res) => {
  const { name, code, repo, students } = req.body || {};
  if (!name || !code) {
    return res.status(400).json({ error: "Missing required fields: name, code" });
  }
  const teams = readJson(TEAMS_PATH);
  const id = `team_${Date.now()}`;

  const newTeam = {
    id,
    name,
    code,
    repo: repo || null,
    students: Array.isArray(students) ? students : [],
    rules: null,
    createdAt: new Date().toISOString(),
  };

  teams.push(newTeam);
  writeJson(TEAMS_PATH, teams);
  // Make newly-created team active by default (optional)
  writeActiveId(id);

  res.status(201).json(newTeam);
});

module.exports = router;
