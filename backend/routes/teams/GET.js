// backend/routes/teams/GET.js
const router = require("express").Router();
const db = require("../../utils/db");
const { readActiveId } = require("../../utils/activeTeamUtils");
const { getUserStatus } = require("../../utils/cognitoAdmin");
const { protect } = require("../../middleware/authMiddleware");

// One-time migration: add owner_email column if it doesn't exist yet
db.query("ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_email VARCHAR").catch(() => {});

async function fetchTeamById(id) {
  const teamRes = await db.query(
    "SELECT t.*, u.code FROM teams t LEFT JOIN units u ON t.unit_id = u.id WHERE t.id = $1",
    [id]
  );
  if (!teamRes.rows.length) return null;

  const studentsRes = await db.query("SELECT * FROM students WHERE team_id = $1", [id]);
  return normalizeTeam(teamRes.rows[0], studentsRes.rows);
}

function normalizeTeam(t, students) {
  return {
    ...t,
    students: students || [],
    code: t.code,
    repo: { url: t.repo_url, owner: t.repo_owner, repo: t.repo_name },
  };
}

// GET /api/teams — only return teams belonging to the logged-in tutor
router.get("/", protect, async (req, res) => {
  try {
    const email = req.user.email;
    const teamsResult = await db.query(
      `SELECT t.*, u.code FROM teams t
       LEFT JOIN units u ON t.unit_id = u.id
       WHERE t.owner_email = $1 OR t.owner_email IS NULL
       ORDER BY t.created_at DESC`,
      [email]
    );
    const studentsResult = await db.query("SELECT * FROM students");

    const studentsByTeam = {};
    for (const s of studentsResult.rows) {
      if (!studentsByTeam[s.team_id]) studentsByTeam[s.team_id] = [];
      studentsByTeam[s.team_id].push(s);
    }

    res.json(teamsResult.rows.map(t => normalizeTeam(t, studentsByTeam[t.id])));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/teams/active — must be before /:id
router.get("/active", protect, async (req, res) => {
  try {
    const email = req.user.email;
    const savedId = readActiveId();

    if (savedId) {
      const result = await db.query(
        `SELECT t.*, u.code FROM teams t
         LEFT JOIN units u ON t.unit_id = u.id
         WHERE t.id = $1 AND (t.owner_email = $2 OR t.owner_email IS NULL)`,
        [savedId, email]
      );
      if (result.rows.length) {
        const studentsRes = await db.query("SELECT * FROM students WHERE team_id = $1", [savedId]);
        return res.json(normalizeTeam(result.rows[0], studentsRes.rows));
      }
    }

    // Fallback: most recently created team belonging to this tutor
    const result = await db.query(
      `SELECT t.*, u.code FROM teams t
       LEFT JOIN units u ON t.unit_id = u.id
       WHERE t.owner_email = $1 OR t.owner_email IS NULL
       ORDER BY t.created_at DESC LIMIT 1`,
      [email]
    );
    res.json(result.rows[0] ? normalizeTeam(result.rows[0], []) : { id: null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/teams/:id
router.get("/:id([^/]+)", async (req, res) => {
  try {
    const team = await fetchTeamById(req.params.id);
    if (!team) return res.status(404).json({ error: "Team not found" });
    res.json(team);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/teams/:id/student-statuses
router.get("/:id/student-statuses", async (req, res) => {
  try {
    const studentsRes = await db.query(
      "SELECT email FROM students WHERE team_id = $1",
      [req.params.id]
    );

    const statuses = {};
    await Promise.all(
      studentsRes.rows.map(async (s) => {
        if (s.email) {
          statuses[s.email] = await getUserStatus(s.email);
        }
      })
    );

    res.json(statuses);
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
