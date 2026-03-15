// backend/routes/teams/post.js
const router = require("express").Router();
const { TEAMS_PATH } = require("../../utils/config");
const { readJson, writeJson } = require("../../utils/fileUtils");
const { writeActiveId } = require("../../utils/activeTeamUtils");

// POST /api/teams/active  { id }
router.post("/active", (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing id" });

  const team = readJson(TEAMS_PATH).find(t => t.id === id);
  if (!team) return res.status(404).json({ error: "Team not found" });

  writeActiveId(id);
  res.json({ success: true, id });
});

// POST /api/teams
router.post("/", (req, res) => {
  const { name, code, repo, students } = req.body || {};
  if (!name || !code) return res.status(400).json({ error: "Missing required fields: name, code" });

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
  writeActiveId(id);
  res.status(201).json(newTeam);
});

// POST /api/teams/:id/students - adding students
router.post("/:id/students", (req, res) => {
  const teams = readJson(TEAMS_PATH);
  const team = teams.find(t => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const { name, email, github } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: "Name and email required" });

   const exists = team.students.find(s => s.email === email);
  if (exists) return res.status(400).json({ error: "Student with this email already exists" });

  team.students.push({ name, email, github: github || "" });
  writeJson(TEAMS_PATH, teams);
  res.json(team);
})

// POST /api/teams/:id/rules
router.post("/:id/rules", (req, res) => {
  const { id } = req.params;
  const teams = readJson(TEAMS_PATH);
  const idx = teams.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: "Team not found" });

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



module.exports = router;
