// backend/routes/rules/GET.js
const router = require("express").Router();
const { TEAMS_PATH } = require("../../utils/config");
const { readJson } = require("../../utils/fileUtils");
const { readActiveId } = require("../../utils/activeTeamUtils");
const { DEFAULT_RULES, weightsFromRules } = require("./_defaults");

// GET /api/rules?teamId=TEAM_ID  (falls back to active team)
router.get("/", (req, res) => {
  const teamId = req.query.teamId || readActiveId();
  if (!teamId) return res.status(400).json({ error: "No active team and no teamId supplied." });

  const team = readJson(TEAMS_PATH).find(t => t.id === teamId);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const payload = team.rules || DEFAULT_RULES;
  const weights = weightsFromRules(payload.rules) || {};
  res.json({ teamId, ...payload, weights });
});

module.exports = router;
