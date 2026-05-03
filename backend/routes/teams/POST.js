// backend/routes/teams/POST.js
const router = require("express").Router();
const db = require("../../utils/db");
const { createOrUpdateStudentUser } = require("../../utils/cognitoAdmin");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Helper: parse role string into array e.g. "leader,scrum_master" -> ["leader","scrum_master"]
function parseRoles(roleStr = "") {
  return String(roleStr || "member").split(",").map(r => r.trim()).filter(Boolean);
}

// Helper: build role string from array, fallback to "member"
function buildRoleString(rolesArr = []) {
  const valid = rolesArr.filter(r => ["leader", "scrum_master"].includes(r));
  return valid.length ? valid.join(",") : "member";
}

// POST /api/teams/active
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
    if (!email) return res.status(400).json({ error: "Student email is required." });
    const teamId = req.params.id;

    const teamCheck = await db.query("SELECT id FROM teams WHERE id = $1", [teamId]);
    if (!teamCheck.rows.length) return res.status(404).json({ error: "Team not found" });

    // Check if anyone else (not this student) is already leader
    const leaderCheck = await db.query(
      "SELECT * FROM students WHERE team_id = $1 AND role LIKE '%leader%' AND email != $2",
      [teamId, email]
    );
    if (leaderCheck.rows.length) return res.status(400).json({ error: "This team already has a leader." });

    const studentRes = await db.query(
      "SELECT * FROM students WHERE team_id = $1 AND email = $2", [teamId, email]
    );
    if (!studentRes.rows.length) return res.status(404).json({ error: "Student not found in this team." });

    // Add leader to existing roles
    const currentRoles = parseRoles(studentRes.rows[0].role);
    if (!currentRoles.includes("leader")) currentRoles.push("leader");
    const newRole = buildRoleString(currentRoles);

    await db.query("UPDATE students SET role = $1 WHERE team_id = $2 AND email = $3", [newRole, teamId, email]);
    const updatedStudents = await db.query("SELECT * FROM students WHERE team_id = $1", [teamId]);
    res.json({ success: true, message: "Leader role added.", students: updatedStudents.rows });
  } catch (e) {
    console.error("POST claim-leader error:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/teams/:id/remove-leader
router.post("/:id/remove-leader", async (req, res) => {
  const { email } = req.body || {};
  try {
    if (!email) return res.status(400).json({ error: "Student email is required." });
    const teamId = req.params.id;

    const teamCheck = await db.query("SELECT id FROM teams WHERE id = $1", [teamId]);
    if (!teamCheck.rows.length) return res.status(404).json({ error: "Team not found" });

    const studentRes = await db.query(
      "SELECT * FROM students WHERE team_id = $1 AND email = $2", [teamId, email]
    );
    if (!studentRes.rows.length) return res.status(404).json({ error: "Student not found." });

    const currentRoles = parseRoles(studentRes.rows[0].role);
    if (!currentRoles.includes("leader")) return res.status(400).json({ error: "You are not the current leader." });

    const newRole = buildRoleString(currentRoles.filter(r => r !== "leader"));
    await db.query("UPDATE students SET role = $1 WHERE team_id = $2 AND email = $3", [newRole, teamId, email]);
    const updatedStudents = await db.query("SELECT * FROM students WHERE team_id = $1", [teamId]);
    res.json({ success: true, message: "Leader role removed.", students: updatedStudents.rows });
  } catch (e) {
    console.error("POST remove-leader error:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/teams/:id/claim-scrum-master
router.post("/:id/claim-scrum-master", async (req, res) => {
  const { email } = req.body || {};
  try {
    if (!email) return res.status(400).json({ error: "Student email is required." });
    const teamId = req.params.id;

    const teamCheck = await db.query("SELECT id FROM teams WHERE id = $1", [teamId]);
    if (!teamCheck.rows.length) return res.status(404).json({ error: "Team not found" });

    // Check if anyone else (not this student) is already scrum master
    const scrumCheck = await db.query(
      "SELECT * FROM students WHERE team_id = $1 AND role LIKE '%scrum_master%' AND email != $2",
      [teamId, email]
    );
    if (scrumCheck.rows.length) return res.status(400).json({ error: "This team already has a Scrum Master." });

    const studentRes = await db.query(
      "SELECT * FROM students WHERE team_id = $1 AND email = $2", [teamId, email]
    );
    if (!studentRes.rows.length) return res.status(404).json({ error: "Student not found in this team." });

    // Add scrum_master to existing roles
    const currentRoles = parseRoles(studentRes.rows[0].role);
    if (!currentRoles.includes("scrum_master")) currentRoles.push("scrum_master");
    const newRole = buildRoleString(currentRoles);

    await db.query("UPDATE students SET role = $1 WHERE team_id = $2 AND email = $3", [newRole, teamId, email]);
    const updatedStudents = await db.query("SELECT * FROM students WHERE team_id = $1", [teamId]);
    res.json({ success: true, message: "Scrum Master role added.", students: updatedStudents.rows });
  } catch (e) {
    console.error("POST claim-scrum-master error:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/teams/:id/remove-scrum-master
router.post("/:id/remove-scrum-master", async (req, res) => {
  const { email } = req.body || {};
  try {
    if (!email) return res.status(400).json({ error: "Student email is required." });
    const teamId = req.params.id;

    const teamCheck = await db.query("SELECT id FROM teams WHERE id = $1", [teamId]);
    if (!teamCheck.rows.length) return res.status(404).json({ error: "Team not found" });

    const studentRes = await db.query(
      "SELECT * FROM students WHERE team_id = $1 AND email = $2", [teamId, email]
    );
    if (!studentRes.rows.length) return res.status(404).json({ error: "Student not found." });

    const currentRoles = parseRoles(studentRes.rows[0].role);
    if (!currentRoles.includes("scrum_master")) return res.status(400).json({ error: "You are not the current Scrum Master." });

    const newRole = buildRoleString(currentRoles.filter(r => r !== "scrum_master"));
    await db.query("UPDATE students SET role = $1 WHERE team_id = $2 AND email = $3", [newRole, teamId, email]);
    const updatedStudents = await db.query("SELECT * FROM students WHERE team_id = $1", [teamId]);
    res.json({ success: true, message: "Scrum Master role removed.", students: updatedStudents.rows });
  } catch (e) {
    console.error("POST remove-scrum-master error:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/teams
router.post("/", async (req, res) => {
  const { name, code, repo, students } = req.body || {};
  if (!name || !code) return res.status(400).json({ error: "Missing required fields: name, code" });
  try {
    let unitResult = await db.query("SELECT id FROM units WHERE code = $1", [code]);
    if (!unitResult.rows.length) {
      unitResult = await db.query("INSERT INTO units (code, name) VALUES ($1, $2) RETURNING id", [code, code]);
    }
    const unitId = unitResult.rows[0].id;
    const id = `team_${Date.now()}`;
    await db.query(
      `INSERT INTO teams (id, unit_id, name, repo_url, repo_owner, repo_name) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, unitId, name, repo?.url || null, repo?.owner || null, repo?.repo || null]
    );
    const studentList = Array.isArray(students) ? students : [];
    const cognitoResults = [];
    for (const s of studentList) {
      const safeEmail = normalizeEmail(s.email);
      await db.query(
        `INSERT INTO students (team_id, name, email, github, aliases, role) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
        [id, s.name, safeEmail || null, s.github || null, s.aliases ? JSON.stringify(s.aliases) : null, s.role || "member"]
      );
      if (safeEmail) {
        try {
          const result = await createOrUpdateStudentUser(safeEmail, s.name || "");
          cognitoResults.push({ email: safeEmail, success: true, created: result.created });
        } catch (err) {
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
  if (!name || !email) return res.status(400).json({ error: "Name and email required" });
  try {
    const safeEmail = normalizeEmail(email);
    const teamCheck = await db.query("SELECT id FROM teams WHERE id = $1", [req.params.id]);
    if (!teamCheck.rows.length) return res.status(404).json({ error: "Team not found" });
    const exists = await db.query("SELECT id FROM students WHERE team_id = $1 AND email = $2", [req.params.id, safeEmail]);
    if (exists.rows.length) return res.status(400).json({ error: "Student with this email already exists" });
    await db.query(
      `INSERT INTO students (team_id, name, email, github, aliases) VALUES ($1, $2, $3, $4, $5)`,
      [req.params.id, name, safeEmail, github || null, aliases ? JSON.stringify(aliases) : null]
    );
    let cognitoResult = null;
    try {
      const result = await createOrUpdateStudentUser(safeEmail, name);
      cognitoResult = { success: true, created: result.created };
    } catch (err) {
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
      `INSERT INTO rule_settings (team_id, auto_recalc) VALUES ($1, $2) ON CONFLICT (team_id) DO UPDATE SET auto_recalc = EXCLUDED.auto_recalc`,
      [id, autoRecalc ?? true]
    );
    if (Array.isArray(rules)) {
      for (const r of rules) {
        await db.query(
          `INSERT INTO rules (team_id, name, weight, description) VALUES ($1, $2, $3, $4) ON CONFLICT (team_id, name) DO UPDATE SET weight = EXCLUDED.weight, description = EXCLUDED.description`,
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