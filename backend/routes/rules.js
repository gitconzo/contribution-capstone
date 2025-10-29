// backend/routes/rules.js
const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const DATA_DIR = path.join(__dirname, "..", "data");
const TEAMS_PATH = path.join(DATA_DIR, "teams.json");
const ACTIVE_PATH = path.join(DATA_DIR, "activeTeam.json");

// Helpers
function ensureFile(file, init) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(init, null, 2));
}
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
ensureFile(TEAMS_PATH, []);
ensureFile(ACTIVE_PATH, { id: null });

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function writeJson(p, v) {
  fs.writeFileSync(p, JSON.stringify(v, null, 2));
}

function readActiveId() {
  try {
    const raw = fs.readFileSync(ACTIVE_PATH, "utf-8").trim();
    if (raw.startsWith('"') || /^[A-Za-z0-9_\-]+$/.test(raw)) {
      const val = JSON.parse(raw);
      return typeof val === "string" ? val : (val?.id ?? null);
    }
    const obj = JSON.parse(raw);
    return obj?.id ?? null;
  } catch {
    return null;
  }
}

// Default rule settings if none saved yet
const DEFAULT_RULES = {
  rules: [
    { name: "Code Commits", value: 30, desc: "Weight given to Git commits and code quality" },
    { name: "Work Log Hours", value: 25, desc: "Time spent on project tasks as logged" },
    { name: "Documentation", value: 20, desc: "Documents created and maintained" },
    { name: "Meeting Participation", value: 15, desc: "Attendance and participation in team meetings" },
    { name: "Peer Review", value: 10, desc: "Participation in code reviews and peer feedback" },
  ],
  autoRecalc: true,
  crossVerify: true,
  triangulation: { codeWorklog: 80, meetingDoc: 70, activityDist: 60 },
  peerValidation: "Statistical analysis",
};

// GET /api/rules?teamId=TEAM_ID
// If teamId absent, uses active team.
router.get("/", (req, res) => {
  const teamId = req.query.teamId || readActiveId();
  if (!teamId) return res.status(400).json({ error: "No active team and no teamId supplied." });

  const teams = readJson(TEAMS_PATH);
  const team = teams.find(t => t.id === teamId);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const payload = team.rules || DEFAULT_RULES;
  res.json({ teamId, ...payload });
});

// POST /api/rules  -> save rules for team
// Body: { teamId?, rules, autoRecalc, crossVerify, triangulation, peerValidation }
router.post("/", (req, res) => {
  const active = readActiveId();
  const {
    teamId = active,
    rules,
    autoRecalc,
    crossVerify,
    triangulation,
    peerValidation,
  } = req.body || {};

  if (!teamId) return res.status(400).json({ error: "No active team and no teamId supplied." });

  const teams = readJson(TEAMS_PATH);
  const idx = teams.findIndex(t => t.id === teamId);
  if (idx === -1) return res.status(404).json({ error: "Team not found" });

  const current = teams[idx].rules || {};
  teams[idx].rules = {
    rules: Array.isArray(rules) ? rules : (current.rules || DEFAULT_RULES.rules),
    autoRecalc: typeof autoRecalc === "boolean" ? autoRecalc : (current.autoRecalc ?? DEFAULT_RULES.autoRecalc),
    crossVerify: typeof crossVerify === "boolean" ? crossVerify : (current.crossVerify ?? DEFAULT_RULES.crossVerify),
    triangulation: triangulation || current.triangulation || DEFAULT_RULES.triangulation,
    peerValidation: peerValidation || current.peerValidation || DEFAULT_RULES.peerValidation,
  };

  writeJson(TEAMS_PATH, teams);
  res.json({ ok: true, teamId, rules: teams[idx].rules });
});

module.exports = router;
