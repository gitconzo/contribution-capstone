// backend/routes/teams/SPRINTS.js
const router = require("express").Router();
const db = require("../../utils/db");

async function ensureSprintsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS sprints (
      id                  SERIAL PRIMARY KEY,
      team_id             TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      sprint_number       INT NOT NULL,
      start_date          DATE NOT NULL,
      end_date            DATE NOT NULL,
      scrum_master_email  TEXT,
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(team_id, sprint_number)
    )
  `);
}

// Helper: format a PostgreSQL DATE value back to yyyy-mm-dd string
// pg returns DATE columns as JS Date objects — extract year/month/day directly
// to avoid timezone conversion shifting the date by one day
function fmtDate(val) {
  if (!val) return null;
  // pg returns DATE as JS Date object — extract using UTC to get correct yyyy-mm-dd
  // regardless of server timezone
  const d = new Date(val);
  const y   = d.getUTCFullYear();
  const m   = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // Always "yyyy-mm-dd" plain string
}

function normalizeSprint(row) {
  if (!row) return row;
  return {
    ...row,
    start_date: fmtDate(row.start_date),
    end_date:   fmtDate(row.end_date),
  };
}

// GET /api/teams/:id/sprints
router.get("/:id/sprints", async (req, res) => {
  try {
    await ensureSprintsTable();
    const result = await db.query(
      `SELECT sp.id, sp.team_id, sp.sprint_number,
              TO_CHAR(sp.start_date, 'YYYY-MM-DD') AS start_date,
              TO_CHAR(sp.end_date,   'YYYY-MM-DD') AS end_date,
              sp.scrum_master_email, sp.created_at,
              s.name AS scrum_master_name
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

  // Validate date strings are yyyy-mm-dd
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(start_date) || !dateRegex.test(end_date)) {
    return res.status(400).json({ error: "Dates must be in yyyy-mm-dd format" });
  }

  if (end_date <= start_date) {
    return res.status(400).json({ error: "end_date must be after start_date" });
  }

  try {
    await ensureSprintsTable();

    const teamCheck = await db.query("SELECT id FROM teams WHERE id = $1", [req.params.id]);
    if (!teamCheck.rows.length) return res.status(404).json({ error: "Team not found" });

    // Cast explicitly to DATE using ::date to prevent any timestamp/timezone conversion
    const result = await db.query(
      `INSERT INTO sprints (team_id, sprint_number, start_date, end_date, scrum_master_email)
       VALUES ($1, $2, $3::date, $4::date, $5)
       ON CONFLICT (team_id, sprint_number) DO UPDATE SET
         start_date           = EXCLUDED.start_date,
         end_date             = EXCLUDED.end_date,
         scrum_master_email   = EXCLUDED.scrum_master_email
       RETURNING *`,
      [req.params.id, sprint_number, start_date, end_date, scrum_master_email || null]
    );

    // Re-fetch with TO_CHAR to return clean date strings
    const fetched = await db.query(
      `SELECT sp.id, sp.team_id, sp.sprint_number,
              TO_CHAR(sp.start_date, 'YYYY-MM-DD') AS start_date,
              TO_CHAR(sp.end_date,   'YYYY-MM-DD') AS end_date,
              sp.scrum_master_email, sp.created_at
       FROM sprints sp WHERE sp.id = $1`,
      [result.rows[0].id]
    );
    res.status(201).json(fetched.rows[0]);
  } catch (e) {
    console.error("POST /api/teams/:id/sprints error:", e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/teams/:id/sprints/:sprintId
router.put("/:id/sprints/:sprintId", async (req, res) => {
  const { start_date, end_date, scrum_master_email } = req.body || {};

  if (start_date && end_date && end_date <= start_date) {
    return res.status(400).json({ error: "end_date must be after start_date" });
  }

  try {
    await ensureSprintsTable();

    const existing = await db.query(
      "SELECT * FROM sprints WHERE id = $1 AND team_id = $2",
      [req.params.sprintId, req.params.id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: "Sprint not found" });

    const current = normalizeSprint(existing.rows[0]);
    const result = await db.query(
      `UPDATE sprints SET
         start_date         = $1::date,
         end_date           = $2::date,
         scrum_master_email = $3
       WHERE id = $4 AND team_id = $5
       RETURNING *`,
      [
        start_date || current.start_date,
        end_date   || current.end_date,
        scrum_master_email !== undefined ? scrum_master_email : current.scrum_master_email,
        req.params.sprintId,
        req.params.id,
      ]
    );

    const fetched = await db.query(
      `SELECT sp.id, sp.team_id, sp.sprint_number,
              TO_CHAR(sp.start_date, 'YYYY-MM-DD') AS start_date,
              TO_CHAR(sp.end_date,   'YYYY-MM-DD') AS end_date,
              sp.scrum_master_email, sp.created_at
       FROM sprints sp WHERE sp.id = $1`,
      [result.rows[0].id]
    );
    res.json(fetched.rows[0]);
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


// POST /api/teams/:id/sprints/:sprintId/analyze
router.post("/:id/sprints/:sprintId/analyze", async (req, res) => {
  const { id: teamId, sprintId } = req.params;
  try {
    await ensureSprintsTable();
    const sprintRes = await db.query(
      "SELECT * FROM sprints WHERE id = $1 AND team_id = $2",
      [sprintId, teamId]
    );
    if (!sprintRes.rows.length) return res.status(404).json({ error: "Sprint not found" });
    const sprint = sprintRes.rows[0];

    const teamRes = await db.query("SELECT * FROM teams WHERE id = $1", [teamId]);
    if (!teamRes.rows.length) return res.status(404).json({ error: "Team not found" });
    const team = teamRes.rows[0];

    if (!team.repo_url) return res.status(400).json({ error: "Team has no repo URL configured" });

    const { ROOT_DIR, DATA_DIR } = require("../../utils/config");
    const { pyBin, runFile } = require("../../utils/processUtils");
    const { writeJson } = require("../../utils/fileUtils");
    const path = require("path");

    const startDate = fmtDate(sprint.start_date);
    const endDate   = fmtDate(sprint.end_date);
    const outputPath = path.join(DATA_DIR, `sprint_${sprintId}_${teamId}_stats.json`);
    const statusPath = path.join(DATA_DIR, `sprint_${sprintId}_${teamId}_status.json`);

    writeJson(statusPath, { status: "running", startedAt: new Date().toISOString() });
    res.json({ success: true, status: "running", message: "Sprint analysis started." });

    // Run in background
    (async () => {
      try {
        await runFile(pyBin(), [
          path.join(ROOT_DIR, "main.py"),
          "--repo-url", team.repo_url,
          "--start-date", startDate,
          "--end-date", endDate,
          "--output", outputPath,
        ], { cwd: ROOT_DIR });
        writeJson(statusPath, { status: "complete", completedAt: new Date().toISOString() });
      } catch (e) {
        console.error("Sprint analysis error:", e.message);
        writeJson(statusPath, { status: "error", error: e.message });
      }
    })();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/teams/:id/sprints/:sprintId/status
router.get("/:id/sprints/:sprintId/status", (req, res) => {
  const { id: teamId, sprintId } = req.params;
  const { DATA_DIR } = require("../../utils/config");
  const { safeReadJson } = require("../../utils/fileUtils");
  const path = require("path");
  const status = safeReadJson(
    path.join(DATA_DIR, `sprint_${sprintId}_${teamId}_status.json`),
    { status: "idle" }
  );
  res.json(status);
});

// GET /api/teams/:id/sprints/:sprintId/scores
router.get("/:id/sprints/:sprintId/scores", async (req, res) => {
  const { id: teamId, sprintId } = req.params;
  try {
    const { ROOT_DIR, DATA_DIR } = require("../../utils/config");
    const { safeReadJson } = require("../../utils/fileUtils");
    const { aggregateTeamScores } = require("../../services/aggregator");
    const path = require("path");
    const fs   = require("fs");

    const statsPath = path.join(DATA_DIR, `sprint_${sprintId}_${teamId}_stats.json`);
    if (!fs.existsSync(statsPath)) {
      return res.status(404).json({ error: "Sprint not yet analysed for this team" });
    }

    const sprintStats = safeReadJson(statsPath, {});
    const scored = await aggregateTeamScores({ 
      teamId, 
      rootDir: ROOT_DIR, 
      sprintStats,
      sprintId: parseInt(sprintId),
    });
    res.json(scored);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


module.exports = router;