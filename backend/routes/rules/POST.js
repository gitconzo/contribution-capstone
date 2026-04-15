// backend/routes/rules/POST.js
const router = require("express").Router();
const db = require("../../utils/db");
const { readActiveId } = require("../../utils/activeTeamUtils");
const { DEFAULT_RULES, weightsFromRules } = require("./_defaults");

// POST /api/rules
router.post("/", async (req, res) => {
  try {
    const { teamId = readActiveId(), rules, autoRecalc } = req.body || {};
    if (!teamId) return res.status(400).json({ error: "No active team and no teamId supplied." });

    const teamCheck = await db.query("SELECT id FROM teams WHERE id = $1", [teamId]);
    if (!teamCheck.rows.length) return res.status(404).json({ error: "Team not found" });

    const [currentSettings, currentRules] = await Promise.all([
      db.query("SELECT * FROM rule_settings WHERE team_id = $1", [teamId]),
      db.query("SELECT name, weight, description FROM rules WHERE team_id = $1", [teamId]),
    ]);
    const cs = currentSettings.rows[0] || {};
    const cr = currentRules.rows.map(r => ({ name: r.name, value: r.weight, desc: r.description }));

    const newRules      = Array.isArray(rules) ? rules : (cr.length ? cr : DEFAULT_RULES.rules);
    const newAutoRecalc = typeof autoRecalc === "boolean" ? autoRecalc : (cs.auto_recalc ?? DEFAULT_RULES.autoRecalc);

    await db.query(`
      INSERT INTO rule_settings (team_id, auto_recalc)
      VALUES ($1, $2)
      ON CONFLICT (team_id) DO UPDATE SET
        auto_recalc = EXCLUDED.auto_recalc
    `, [teamId, newAutoRecalc]);

    // Replace rules: delete then re-insert
    await db.query("DELETE FROM rules WHERE team_id = $1", [teamId]);
    for (const r of newRules) {
      await db.query(
        `INSERT INTO rules (team_id, name, weight, description) VALUES ($1,$2,$3,$4)`,
        [teamId, r.name, r.value ?? r.weight ?? 0, r.desc ?? r.description ?? ""]
      );
    }

    const saved = { rules: newRules, autoRecalc: newAutoRecalc };
    res.json({ ok: true, teamId, rules: saved, weights: weightsFromRules(saved.rules) || {} });
  } catch (err) {
    console.error("POST /api/rules error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
