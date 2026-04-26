// backend/routes/teams/SPRINTS.js
const router = require("express").Router();
const db = require("../../utils/db");

// Ensure the sprints table exists
async function ensureSprintsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS sprints (
      id          SERIAL PRIMARY KEY,
      team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      sprint_number INT NOT NULL,
      start_date  DATE NOT NULL,
      end_date    DATE NOT NULL,
      scrum_master_email TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(team_id, sprint_number)
    )
  `);
}

// GET /api/teams/:id/sprints
router.get("/:id/sprints", async (req, res) => {
  try {
    await ensureSprintsTable();
    const result = await db.query(
      `SELECT sp.*, s.name AS scrum_master_name
       FROM sprints sp
       LEFT JOIN students s ON s.team_id = sp.team_id AND s.email = sp.scrum_master_email
       WHERE sp.team_id = $1
       ORDER BY sp.sprint_number ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (e) {
    console.error("GET /api/teams/:id/sprints error:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/teams/:id/sprints
router.post("/:id/sprints", async (req, res) => {
  const { sprint_number, start_date, end_date, scrum_master_email } = req.body || {};

  if (!sprint_number || !start_date || !end_date) {
    return res.status(400).json({ error: "sprint_number, start_date, and end_date are required" });
  }
  if (new Date(end_date) <= new Date(start_date)) {
    return res.status(400).json({ error: "end_date must be after start_date" });
  }

  try {
    await ensureSprintsTable();

    const teamCheck = await db.query("SELECT id FROM teams WHERE id = $1", [req.params.id]);
    if (!teamCheck.rows.length) return res.status(404).json({ error: "Team not found" });

    const result = await db.query(
      `INSERT INTO sprints (team_id, sprint_number, start_date, end_date, scrum_master_email)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (team_id, sprint_number) DO UPDATE SET
         start_date           = EXCLUDED.start_date,
         end_date             = EXCLUDED.end_date,
         scrum_master_email   = EXCLUDED.scrum_master_email
       RETURNING *`,
      [req.params.id, sprint_number, start_date, end_date, scrum_master_email || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error("POST /api/teams/:id/sprints error:", e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/teams/:id/sprints/:sprintId
router.put("/:id/sprints/:sprintId", async (req, res) => {
  const { start_date, end_date, scrum_master_email } = req.body || {};

  if (start_date && end_date && new Date(end_date) <= new Date(start_date)) {
    return res.status(400).json({ error: "end_date must be after start_date" });
  }

  try {
    await ensureSprintsTable();

    const existing = await db.query(
      "SELECT * FROM sprints WHERE id = $1 AND team_id = $2",
      [req.params.sprintId, req.params.id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: "Sprint not found" });

    const current = existing.rows[0];
    const result = await db.query(
      `UPDATE sprints SET
         start_date         = $1,
         end_date           = $2,
         scrum_master_email = $3
       WHERE id = $4 AND team_id = $5
       RETURNING *`,
      [
        start_date || current.start_date,
        end_date || current.end_date,
        scrum_master_email !== undefined ? scrum_master_email : current.scrum_master_email,
        req.params.sprintId,
        req.params.id,
      ]
    );

    res.json(result.rows[0]);
  } catch (e) {
    console.error("PUT /api/teams/:id/sprints/:sprintId error:", e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/teams/:id/sprints/:sprintId
router.delete("/:id/sprints/:sprintId", async (req, res) => {
  try {
    await ensureSprintsTable();
    const result = await db.query(
      "DELETE FROM sprints WHERE id = $1 AND team_id = $2 RETURNING id",
      [req.params.sprintId, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Sprint not found" });
    res.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/teams/:id/sprints/:sprintId error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;