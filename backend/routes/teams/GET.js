// backend/routes/teams/GET.js
const router = require("express").Router();
const db = require("../../utils/db");

async function fetchTeamById(id) {
  const teamRes = await db.query("SELECT * FROM teams WHERE id = $1", [id]);
  if (!teamRes.rows.length) return null;
  const team = teamRes.rows[0];

  const studentsRes = await db.query("SELECT * FROM students WHERE team_id = $1", [id]);
  team.students = studentsRes.rows;

  return team;
}

// GET /api/teams
router.get("/", async (_req, res) => {
  try {
    const result = await db.query("SELECT * FROM teams ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/teams/active — must be before /:id
router.get("/active", async (_req, res) => {
  try {
    // Active team is the most recently created for now
    const result = await db.query("SELECT * FROM teams ORDER BY created_at DESC LIMIT 1");
    res.json(result.rows[0] || { id: null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/teams/:id
router.get("/:id", async (req, res) => {
  try {
    const team = await fetchTeamById(req.params.id);
    if (!team) return res.status(404).json({ error: "Team not found" });
    res.json(team);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/teams/:id/rules
router.get("/:id/rules", async (req, res) => {
  try {
    const rulesRes = await db.query("SELECT * FROM rules WHERE team_id = $1", [req.params.id]);
    const settingsRes = await db.query("SELECT * FROM rule_settings WHERE team_id = $1", [req.params.id]);
    res.json({ rules: rulesRes.rows, settings: settingsRes.rows[0] || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
