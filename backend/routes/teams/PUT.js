// backend/routes/teams/PUT.js
const router = require("express").Router();
const db = require("../../utils/db");

// PUT /api/teams/:id — edit team name, code, repo
router.put("/:id", async (req, res) => {
  const { name, code, repo } = req.body || {};

  try {
    const teamCheck = await db.query("SELECT id FROM teams WHERE id = $1", [req.params.id]);
    if (!teamCheck.rows.length) return res.status(404).json({ error: "Team not found" });

    if (name) await db.query("UPDATE teams SET name = $1 WHERE id = $2", [name, req.params.id]);
    if (repo?.url !== undefined) await db.query(
      "UPDATE teams SET repo_url = $1, repo_owner = $2, repo_name = $3 WHERE id = $4",
      [repo.url || null, repo.owner || null, repo.repo || null, req.params.id]
    );

    if (code) {
      let unitResult = await db.query("SELECT id FROM units WHERE code = $1", [code]);
      if (!unitResult.rows.length) {
        unitResult = await db.query("INSERT INTO units (code, name) VALUES ($1, $2) RETURNING id", [code, code]);
      }
      await db.query("UPDATE teams SET unit_id = $1 WHERE id = $2", [unitResult.rows[0].id, req.params.id]);
    }

    const updated = await db.query("SELECT * FROM teams WHERE id = $1", [req.params.id]);
    const studentsRes = await db.query("SELECT * FROM students WHERE team_id = $1", [req.params.id]);
    res.json({ ...updated.rows[0], students: studentsRes.rows });
  } catch (e) {
    console.error("PUT /api/teams/:id error:", e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/teams/:id/students/:email — edit a student
router.put("/:id/students/:email", async (req, res) => {
  const { name, email, github, role } = req.body || {};

  try {
    const studentCheck = await db.query(
      "SELECT * FROM students WHERE team_id = $1 AND email = $2",
      [req.params.id, req.params.email]
    );
    if (!studentCheck.rows.length) return res.status(404).json({ error: "Student not found" });

    if (name) {
      await db.query(
        "UPDATE students SET name = $1 WHERE team_id = $2 AND email = $3",
        [name, req.params.id, req.params.email]
      );
    }
    
    if (email) {
      await db.query(
        "UPDATE students SET email = $1 WHERE team_id = $2 AND email = $3",
        [email, req.params.id, req.params.email]
      );
    }
    
    if (github !== undefined) {
      await db.query(
        "UPDATE students SET github = $1 WHERE team_id = $2 AND email = $3",
        [github, req.params.id, req.params.email]
      );
    }
    
    if (role !== undefined) {
      const allowedRoles = ["member", "leader", "scrum_master"];
    
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
    
      await db.query(
        "UPDATE students SET role = $1 WHERE team_id = $2 AND email = $3",
        [role, req.params.id, req.params.email]
      );
    }

    const teamRes     = await db.query("SELECT * FROM teams WHERE id = $1", [req.params.id]);
    const studentsRes = await db.query("SELECT * FROM students WHERE team_id = $1", [req.params.id]);
    res.json({ ...teamRes.rows[0], students: studentsRes.rows });
  } catch (e) {
    console.error("PUT /api/teams/:id/students/:email error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
