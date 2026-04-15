// backend/routes/teams/POST.js
const router = require("express").Router();
const db = require("../../utils/db");
const { createOrUpdateStudentUser } = require("../../utils/cognitoAdmin");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// POST /api/teams/active  { id }
router.post("/active", async (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing id" });

  const result = await db.query("SELECT id FROM teams WHERE id = $1", [id]);
  if (!result.rows.length) return res.status(404).json({ error: "Team not found" });

  const { writeActiveId } = require("../../utils/activeTeamUtils");
  writeActiveId(id);
  res.json({ success: true, id });
});

// POST /api/teams/:id/claim-leader
router.post("/:id/claim-leader", async (req, res) => {
  const { email } = req.body || {};

  try {
    if (!email) {
      return res.status(400).json({ error: "Student email is required." });
    }

    const teamId = req.params.id;

    const teamCheck = await db.query("SELECT id FROM teams WHERE id = $1", [teamId]);
    if (!teamCheck.rows.length) {
      return res.status(404).json({ error: "Team not found" });
    }

    const leaderCheck = await db.query(
      "SELECT * FROM students WHERE team_id = $1 AND role = 'leader'",
      [teamId]
    );

    if (leaderCheck.rows.length) {
      return res.status(400).json({ error: "This team already has a leader." });
    }

    const studentCheck = await db.query(
      "SELECT * FROM students WHERE team_id = $1 AND email = $2",
      [teamId, email]
    );

    if (!studentCheck.rows.length) {
      return res.status(404).json({ error: "Student not found in this team." });
    }

    await db.query(
      "UPDATE students SET role = 'leader' WHERE team_id = $1 AND email = $2",
      [teamId, email]
    );

    const updatedStudents = await db.query(
      "SELECT * FROM students WHERE team_id = $1",
      [teamId]
    );

    res.json({
      success: true,
      message: "Leader assigned successfully.",
      students: updatedStudents.rows,
    });
  } catch (e) {
    console.error("POST /api/teams/:id/claim-leader error:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/teams/:id/remove-leader
router.post("/:id/remove-leader", async (req, res) => {
  const { email } = req.body || {};

  try {
    if (!email) {
      return res.status(400).json({ error: "Student email is required." });
    }

    const teamId = req.params.id;

    const teamCheck = await db.query("SELECT id FROM teams WHERE id = $1", [teamId]);
    if (!teamCheck.rows.length) {
      return res.status(404).json({ error: "Team not found" });
    }

    const leaderCheck = await db.query(
      "SELECT * FROM students WHERE team_id = $1 AND email = $2 AND role = 'leader'",
      [teamId, email]
    );

    if (!leaderCheck.rows.length) {
      return res.status(400).json({ error: "You are not the current leader of this team." });
    }

    await db.query(
      "UPDATE students SET role = 'member' WHERE team_id = $1 AND email = $2",
      [teamId, email]
    );

    const updatedStudents = await db.query(
      "SELECT * FROM students WHERE team_id = $1",
      [teamId]
    );

    res.json({
      success: true,
      message: "Leader role removed successfully.",
      students: updatedStudents.rows,
    });
  } catch (e) {
    console.error("POST /api/teams/:id/remove-leader error:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/teams
router.post("/", async (req, res) => {
  const { name, code, repo, students } = req.body || {};
  if (!name || !code) {
    return res.status(400).json({ error: "Missing required fields: name, code" });
  }

  try {
    // Find or create the unit by code
    let unitResult = await db.query("SELECT id FROM units WHERE code = $1", [code]);
    if (!unitResult.rows.length) {
      unitResult = await db.query(
        "INSERT INTO units (code, name) VALUES ($1, $2) RETURNING id",
        [code, code]
      );
    }
    const unitId = unitResult.rows[0].id;

    const id = `team_${Date.now()}`;
    const repoUrl = repo?.url || null;
    const repoOwner = repo?.owner || null;
    const repoName = repo?.repo || null;

    await db.query(
      `INSERT INTO teams (id, unit_id, name, repo_url, repo_owner, repo_name)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, unitId, name, repoUrl, repoOwner, repoName]
    );

    const studentList = Array.isArray(students) ? students : [];
    const cognitoResults = [];

    for (const s of studentList) {
      const safeEmail = normalizeEmail(s.email);

      await db.query(
        `INSERT INTO students (team_id, name, email, github, aliases)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [
          id,
          s.name,
          safeEmail || null,
          s.github || null,
          s.aliases ? JSON.stringify(s.aliases) : null,
        ]
      );

      if (safeEmail) {
        try {
          const result = await createOrUpdateStudentUser(safeEmail, s.name || "");
          cognitoResults.push({ email: safeEmail, success: true, created: result.created });
        } catch (err) {
          console.error(`Failed to create Cognito user for ${safeEmail}:`, err);
          cognitoResults.push({ email: safeEmail, success: false, error: err.message });
        }
      }
    }

    res.status(201).json({ id, name, code, repo: repo || null, students: studentList, cognitoResults });
  } catch (e) {
    console.error("POST /api/teams error:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/teams/:id/students
router.post("/:id/students", async (req, res) => {
  const { name, email, github, aliases } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ error: "Name and email required" });
  }

  try {
    const safeEmail = normalizeEmail(email);

    const teamCheck = await db.query("SELECT id FROM teams WHERE id = $1", [req.params.id]);
    if (!teamCheck.rows.length) {
      return res.status(404).json({ error: "Team not found" });
    }

    const exists = await db.query(
      "SELECT id FROM students WHERE team_id = $1 AND email = $2",
      [req.params.id, safeEmail]
    );
    if (exists.rows.length) {
      return res.status(400).json({ error: "Student with this email already exists" });
    }

    await db.query(
      `INSERT INTO students (team_id, name, email, github, aliases)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.params.id,
        name,
        safeEmail,
        github || null,
        aliases ? JSON.stringify(aliases) : null,
      ]
    );

    let cognitoResult = null;
    try {
      const result = await createOrUpdateStudentUser(safeEmail, name);
      cognitoResult = { success: true, created: result.created };
    } catch (err) {
      console.error(`Failed to create Cognito user for ${safeEmail}:`, err);
      cognitoResult = { success: false, error: err.message };
    }

    const teamRes = await db.query("SELECT * FROM teams WHERE id = $1", [req.params.id]);
    const studentsRes = await db.query("SELECT * FROM students WHERE team_id = $1", [req.params.id]);

    res.json({ ...teamRes.rows[0], students: studentsRes.rows, cognitoResult });
  } catch (e) {
    console.error("POST /api/teams/:id/students error:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/teams/:id/rules
router.post("/:id/rules", async (req, res) => {
  const { id } = req.params;
  const { rules, autoRecalc } = req.body || {};

  try {
    const teamCheck = await db.query("SELECT id FROM teams WHERE id = $1", [id]);
    if (!teamCheck.rows.length) return res.status(404).json({ error: "Team not found" });

    await db.query(
      `INSERT INTO rule_settings (team_id, auto_recalc)
       VALUES ($1, $2)
       ON CONFLICT (team_id) DO UPDATE SET
         auto_recalc = EXCLUDED.auto_recalc`,
      [id, autoRecalc ?? true]
    );

    if (Array.isArray(rules)) {
      for (const r of rules) {
        await db.query(
          `INSERT INTO rules (team_id, name, weight, description)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (team_id, name) DO UPDATE SET
             weight      = EXCLUDED.weight,
             description = EXCLUDED.description`,
          [id, r.name, r.value ?? r.weight ?? 0, r.desc || r.description || null]
        );
      }
    }

    res.json({ ok: true, teamId: id });
  } catch (e) {
    console.error("POST /api/teams/:id/rules error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;