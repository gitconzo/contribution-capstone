// backend/routes/rules/GET.js
const router = require("express").Router();
const db = require("../../utils/db");
const { readActiveId } = require("../../utils/activeTeamUtils");
const { DEFAULT_RULES, weightsFromRules } = require("./_defaults");

// GET /api/rules?teamId=TEAM_ID  (falls back to active team)
router.get("/", async (req, res) => {
  try {
    const teamId = req.query.teamId || readActiveId();
    if (!teamId) return res.status(400).json({ error: "No active team and no teamId supplied." });

    const teamCheck = await db.query("SELECT id FROM teams WHERE id = $1", [teamId]);
    if (!teamCheck.rows.length) return res.status(404).json({ error: "Team not found" });

    const [settingsResult, rulesResult] = await Promise.all([
      db.query("SELECT * FROM rule_settings WHERE team_id = $1", [teamId]),
      db.query("SELECT name, weight, description FROM rules WHERE team_id = $1 ORDER BY id", [teamId]),
    ]);

    const settings = settingsResult.rows[0];

    const rules = rulesResult.rows.length
      ? rulesResult.rows.map(row => ({ name: row.name, value: row.weight, desc: row.description }))
      : DEFAULT_RULES.rules;

    const payload = {
      rules,
      autoRecalc: settings?.auto_recalc ?? DEFAULT_RULES.autoRecalc,
    };

    res.json({ teamId, ...payload, weights: weightsFromRules(payload.rules) || {} });
  } catch (err) {
    console.error("GET /api/rules error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
