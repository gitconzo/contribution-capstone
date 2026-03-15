const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const router = express.Router();

const { isHashed } = require("../utils/hashPassword");

const DATA_DIR = path.join(__dirname, "..", "data");
const TEAMS_PATH = path.join(DATA_DIR, "teams.json");
const ACTIVE_PATH = path.join(DATA_DIR, "activeTeam.json");
const USERS_PATH = path.join(DATA_DIR, "users.json");
const APP_SETTINGS_PATH = path.join(DATA_DIR, "appSettings.json");

// Ensure data files exist
function ensureFile(file, init) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(init, null, 2));
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
ensureFile(TEAMS_PATH, []);
ensureFile(USERS_PATH, []);

if (!fs.existsSync(APP_SETTINGS_PATH)) {
  fs.writeFileSync(
    APP_SETTINGS_PATH,
    JSON.stringify(
      {
        studentDefaultPasswordHash: bcrypt.hashSync("123456", 10),
      },
      null,
      2
    )
  );
}

if (!fs.existsSync(ACTIVE_PATH)) {
  fs.writeFileSync(ACTIVE_PATH, JSON.stringify({ id: null }, null, 2));
}

// Read helpers
function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function writeJson(p, v) {
  fs.writeFileSync(p, JSON.stringify(v, null, 2));
}

// Active team read
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

function writeActiveId(id) {
  writeJson(ACTIVE_PATH, { id });
}

async function ensureStudentAccounts(students = []) {
  if (!Array.isArray(students) || students.length === 0) return [];

  const users = readJson(USERS_PATH);
  const settings = readJson(APP_SETTINGS_PATH);
  const createdAccounts = [];

  let maxId = users.reduce((max, user) => {
    const currentId = Number(user.id) || 0;
    return currentId > max ? currentId : max;
  }, 0);

  const defaultPasswordHash =
    settings.studentDefaultPasswordHash || bcrypt.hashSync("123456", 10);

  for (const student of students) {
    const email = String(student?.email || "").trim().toLowerCase();
    const name = String(student?.name || "").trim();

    if (!email || !name) continue;

    const existingUser = users.find(
      (u) => String(u.email || "").trim().toLowerCase() === email
    );

    if (existingUser) {
      if (existingUser.password && !isHashed(existingUser.password)) {
        existingUser.password = defaultPasswordHash;
      }
      continue;
    }

    maxId += 1;

    const newUser = {
      id: maxId,
      name,
      email,
      password: defaultPasswordHash,
      role: "student",
    };

    users.push(newUser);
    createdAccounts.push({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    });
  }

  writeJson(USERS_PATH, users);
  return createdAccounts;
}

// GET /api/teams
router.get("/", (req, res) => {
  const teams = readJson(TEAMS_PATH);
  res.json(teams);
});

// GET /api/teams/active
router.get("/active", (req, res) => {
  const id = readActiveId();
  const teams = readJson(TEAMS_PATH);
  const team = teams.find((t) => t.id === id);

  if (!team) {
    return res.json({ id: null });
  }

  res.json(team);
});

// POST /api/teams/active
router.post("/active", (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing id" });

  const teams = readJson(TEAMS_PATH);
  const team = teams.find((t) => t.id === id);

  if (!team) {
    return res.status(404).json({ error: "Team not found" });
  }

  writeActiveId(id);
  res.json({ success: true, id });
});

// GET /api/teams/:id
router.get("/:id", (req, res) => {
  const teams = readJson(TEAMS_PATH);
  const team = teams.find((t) => t.id === req.params.id);

  if (!team) {
    return res.status(404).json({ error: "Team not found" });
  }

  res.json(team);
});

// POST /api/teams -> create a team
router.post("/", async (req, res) => {
  try {
    const { name, code, repo, students } = req.body || {};

    if (!name || !code) {
      return res.status(400).json({ error: "Missing required fields: name, code" });
    }

    const teams = readJson(TEAMS_PATH);
    const id = `team_${Date.now()}`;

    const normalizedStudents = Array.isArray(students)
      ? students
          .map((student) => ({
            name: String(student?.name || "").trim(),
            email: String(student?.email || "").trim().toLowerCase(),
          }))
          .filter((student) => student.name && student.email)
      : [];

    const newTeam = {
      id,
      name,
      code,
      repo: repo || null,
      students: normalizedStudents,
      rules: null,
      createdAt: new Date().toISOString(),
    };

    teams.push(newTeam);
    writeJson(TEAMS_PATH, teams);
    writeActiveId(id);

    const createdAccounts = await ensureStudentAccounts(normalizedStudents);

    res.status(201).json({
      ...newTeam,
      createdAccounts,
    });
  } catch (error) {
    console.error("Create team error:", error);
    res.status(500).json({ error: "Failed to create team and student accounts." });
  }
});

// POST /api/teams/:id/rules
router.post("/:id/rules", (req, res) => {
  const id = req.params.id;
  const teams = readJson(TEAMS_PATH);
  const idx = teams.findIndex((t) => t.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: "Team not found" });
  }

  const { rules, autoRecalc, crossVerify, triangulation, peerValidation } = req.body || {};

  teams[idx].rules = {
    rules: Array.isArray(rules) ? rules : null,
    autoRecalc: !!autoRecalc,
    crossVerify: !!crossVerify,
    triangulation: triangulation || { codeWorklog: 80, meetingDoc: 70, activityDist: 60 },
    peerValidation: peerValidation || "Statistical analysis",
    savedAt: new Date().toISOString(),
  };

  writeJson(TEAMS_PATH, teams);
  res.json(teams[idx].rules);
});

// GET /api/teams/:id/rules
router.get("/:id/rules", (req, res) => {
  const teams = readJson(TEAMS_PATH);
  const team = teams.find((t) => t.id === req.params.id);

  if (!team) {
    return res.status(404).json({ error: "Team not found" });
  }

  res.json(team.rules || null);
});

module.exports = router;