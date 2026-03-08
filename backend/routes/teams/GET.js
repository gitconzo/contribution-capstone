// backend/routes/teams/get.js
const router = require("express").Router();
const { TEAMS_PATH } = require("../../utils/config");
const { readJson } = require("../../utils/fileUtils");
const { readActiveId } = require("../../utils/activeTeamUtils");

// GET /api/teams
router.get("/", (req, res) => {
  res.json(readJson(TEAMS_PATH));
});

// GET /api/teams/active
router.get("/active", (req, res) => {
  const id = readActiveId();
  const team = readJson(TEAMS_PATH).find(t => t.id === id);
  res.json(team || { id: null });
});

// GET /api/teams/:id
router.get("/:id", (req, res) => {
  const team = readJson(TEAMS_PATH).find(t => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: "Team not found" });
  res.json(team);
});

// GET /api/teams/:id/rules
router.get("/:id/rules", (req, res) => {
  const team = readJson(TEAMS_PATH).find(t => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: "Team not found" });
  res.json(team.rules || null);
});

module.exports = router;
