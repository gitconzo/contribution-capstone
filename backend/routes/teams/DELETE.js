// backend/routes/teams/DELETE.js
const router = require("express").Router();
const db = require("../../utils/db");

// DELETE /api/teams/:id — delete a team
router.delete("/:id", async (req, res) => {
  try {
    const teamCheck = await db.query("SELECT id FROM teams WHERE id = $1", [req.params.id]);
    if (!teamCheck.rows.length) return res.status(404).json({ error: "Team not found" });

    // Delete dependents first to avoid foreign key constraint errors
    await db.query("DELETE FROM students WHERE team_id = $1", [req.params.id]);
    await db.query("DELETE FROM rules WHERE team_id = $1", [req.params.id]);
    await db.query("DELETE FROM rule_settings WHERE team_id = $1", [req.params.id]);
    await db.query("DELETE FROM teams WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/teams/:id error:", e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/teams/:id/students/:email — remove a student
router.delete("/:id/students/:email", async (req, res) => {
  try {
    const studentCheck = await db.query(
      "SELECT * FROM students WHERE team_id = $1 AND email = $2",
      [req.params.id, req.params.email]
    );
    if (!studentCheck.rows.length) return res.status(404).json({ error: "Student not found" });

    await db.query("DELETE FROM students WHERE team_id = $1 AND email = $2", [req.params.id, req.params.email]);

    const teamRes     = await db.query("SELECT * FROM teams WHERE id = $1", [req.params.id]);
    const studentsRes = await db.query("SELECT * FROM students WHERE team_id = $1", [req.params.id]);
    res.json({ ...teamRes.rows[0], students: studentsRes.rows });
  } catch (e) {
    console.error("DELETE /api/teams/:id/students/:email error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
