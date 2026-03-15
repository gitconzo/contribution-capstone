// backend/routes/rules/POST.js
const router = require("express").Router();
const { TEAMS_PATH } = require("../../utils/config");
const { readJson, writeJson } = require("../../utils/fileUtils");
const { readActiveId } = require("../../utils/activeTeamUtils");
const { DEFAULT_RULES, weightsFromRules } = require("./_defaults");

// POST /api/rules
router.post("/", (req, res) => {
  const active = readActiveId();
  const { teamId = active, rules, autoRecalc, crossVerify, triangulation, peerValidation } = req.body || {};
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
  const saved = teams[idx].rules;
  const weights = weightsFromRules(saved.rules) || {};
  res.json({ ok: true, teamId, rules: saved, weights });
});

module.exports = router;
