// backend/routes/teams/TASKS.js
const router = require("express").Router();
const db = require("../../utils/db");

async function ensureTasksTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id                SERIAL PRIMARY KEY,
      sprint_id         INT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
      team_id           TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      assigned_to_email TEXT NOT NULL,
      title             TEXT NOT NULL,
      description       TEXT,
      story_points      INT NOT NULL DEFAULT 1,
      priority          TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      status            TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'complete')),
      created_by_email  TEXT,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Add priority column to existing tables that don't have it
  await db.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'`);
  // Migrate old easy/hard values to low/high
  await db.query(`UPDATE tasks SET priority = 'low'  WHERE priority = 'easy'`).catch(() => {});
  await db.query(`UPDATE tasks SET priority = 'high' WHERE priority = 'hard'`).catch(() => {});
  // Update CHECK constraint to allow low/medium/high
  await db.query(`ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check`).catch(() => {});
  await db.query(`ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('low', 'medium', 'high'))`).catch(() => {});
}

// Helper: verify the requesting user is the scrum master for this sprint
// Passes if: sprint has this email as scrum_master_email OR student holds scrum_master role in team
async function isScrumMaster(teamId, sprintId, email) {
  if (!email) return false;

  // Check if student holds scrum_master role in the team
  const roleCheck = await db.query(
    "SELECT role FROM students WHERE team_id = $1 AND LOWER(email) = LOWER($2)",
    [teamId, email]
  );
  if (roleCheck.rows.length) {
    const roles = String(roleCheck.rows[0].role || "").split(",").map(r => r.trim());
    if (roles.includes("scrum_master")) return true;
  }

  // Also check sprint's assigned scrum_master_email
  const sprintCheck = await db.query(
    "SELECT scrum_master_email FROM sprints WHERE id = $1 AND team_id = $2",
    [sprintId, teamId]
  );
  if (!sprintCheck.rows.length) return false;
  const smEmail = String(sprintCheck.rows[0].scrum_master_email || "").toLowerCase();
  return smEmail !== "" && smEmail === String(email).toLowerCase();
}

// GET /api/teams/:id/tasks?sprintId=&email=
// Returns all tasks for a team, optionally filtered by sprint
// If email is provided, only returns tasks assigned to that student
router.get("/:id/tasks", async (req, res) => {
  try {
    await ensureTasksTable();
    const { sprintId, email } = req.query;

    let query = `
      SELECT t.*,
             s.name  AS assigned_to_name,
             sp.sprint_number,
             TO_CHAR(sp.start_date, 'YYYY-MM-DD') AS sprint_start,
             TO_CHAR(sp.end_date,   'YYYY-MM-DD') AS sprint_end
      FROM tasks t
      JOIN students s  ON s.team_id = t.team_id AND s.email = t.assigned_to_email
      JOIN sprints sp  ON sp.id = t.sprint_id
      WHERE t.team_id = $1
    `;
    const params = [req.params.id];

    if (sprintId) {
      params.push(sprintId);
      query += ` AND t.sprint_id = $${params.length}`;
    }
    if (email) {
      params.push(email);
      query += ` AND t.assigned_to_email = $${params.length}`;
    }

    query += " ORDER BY sp.sprint_number DESC, t.story_points DESC, t.created_at ASC";

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (e) {
    console.error("GET /api/teams/:id/tasks error:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/teams/:id/tasks — Scrum Master creates a task
router.post("/:id/tasks", async (req, res) => {
  const { sprint_id, assigned_to_email, title, description, story_points, priority, created_by_email } = req.body || {};

  if (!sprint_id || !assigned_to_email || !title) {
    return res.status(400).json({ error: "sprint_id, assigned_to_email, and title are required" });
  }

  try {
    await ensureTasksTable();

    // Verify team exists
    const teamCheck = await db.query("SELECT id FROM teams WHERE id = $1", [req.params.id]);
    if (!teamCheck.rows.length) return res.status(404).json({ error: "Team not found" });

    // Verify requester is scrum master for this sprint
    const scrumCheck = await isScrumMaster(req.params.id, sprint_id, created_by_email);
    if (!scrumCheck) {
      return res.status(403).json({ error: "Only the Scrum Master can assign tasks for this sprint." });
    }

    // Verify assigned student is in this team
    const studentCheck = await db.query(
      "SELECT id FROM students WHERE team_id = $1 AND email = $2",
      [req.params.id, assigned_to_email]
    );
    if (!studentCheck.rows.length) return res.status(404).json({ error: "Assigned student not found in this team." });

    const result = await db.query(
      `INSERT INTO tasks (sprint_id, team_id, assigned_to_email, title, description, story_points, priority, created_by_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [sprint_id, req.params.id, assigned_to_email, title, description || null, story_points || 1, priority || 'medium', created_by_email || null]
    );

    // Return with joined data
    const full = await db.query(
      `SELECT t.*, s.name AS assigned_to_name, sp.sprint_number,
              TO_CHAR(sp.start_date, 'YYYY-MM-DD') AS sprint_start,
              TO_CHAR(sp.end_date,   'YYYY-MM-DD') AS sprint_end
       FROM tasks t
       JOIN students s ON s.team_id = t.team_id AND s.email = t.assigned_to_email
       JOIN sprints sp ON sp.id = t.sprint_id
       WHERE t.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(full.rows[0]);
  } catch (e) {
    console.error("POST /api/teams/:id/tasks error:", e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/teams/:id/tasks/:taskId — edit task (scrum master) or update status (assigned student)
router.put("/:id/tasks/:taskId", async (req, res) => {
  const { title, description, story_points, priority, status, assigned_to_email, updated_by_email } = req.body || {};

  try {
    await ensureTasksTable();

    const taskRes = await db.query(
      "SELECT * FROM tasks WHERE id = $1 AND team_id = $2",
      [req.params.taskId, req.params.id]
    );
    if (!taskRes.rows.length) return res.status(404).json({ error: "Task not found" });

    const task = taskRes.rows[0];
    const isAssignedStudent = String(task.assigned_to_email).toLowerCase() === String(updated_by_email || "").toLowerCase();
    const scrumCheck = await isScrumMaster(req.params.id, task.sprint_id, updated_by_email);

    // Students can only update status; scrum master can update everything
    if (status !== undefined) {
      if (!["ongoing", "complete"].includes(status)) {
        return res.status(400).json({ error: "Status must be 'ongoing' or 'complete'" });
      }
      if (!isAssignedStudent && !scrumCheck) {
        return res.status(403).json({ error: "Only the assigned student or Scrum Master can update task status." });
      }
    }

    if ((title !== undefined || description !== undefined || story_points !== undefined) && !scrumCheck) {
      return res.status(403).json({ error: "Only the Scrum Master can edit task details." });
    }

    await db.query(
      `UPDATE tasks SET
         title               = COALESCE($1, title),
         description         = COALESCE($2, description),
         story_points        = COALESCE($3, story_points),
         priority            = COALESCE($4, priority),
         status              = COALESCE($5, status),
         assigned_to_email   = COALESCE($6, assigned_to_email),
         updated_at          = NOW()
       WHERE id = $7`,
      [title || null, description || null, story_points || null, priority || null, status || null, assigned_to_email || null, req.params.taskId]
    );

    const full = await db.query(
      `SELECT t.*, s.name AS assigned_to_name, sp.sprint_number,
              TO_CHAR(sp.start_date, 'YYYY-MM-DD') AS sprint_start,
              TO_CHAR(sp.end_date,   'YYYY-MM-DD') AS sprint_end
       FROM tasks t
       JOIN students s ON s.team_id = t.team_id AND s.email = t.assigned_to_email
       JOIN sprints sp ON sp.id = t.sprint_id
       WHERE t.id = $1`,
      [req.params.taskId]
    );

    res.json(full.rows[0]);
  } catch (e) {
    console.error("PUT /api/teams/:id/tasks/:taskId error:", e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/teams/:id/tasks/:taskId — Scrum Master only
router.delete("/:id/tasks/:taskId", async (req, res) => {
  const { deleted_by_email } = req.body || {};

  try {
    await ensureTasksTable();

    const taskRes = await db.query(
      "SELECT * FROM tasks WHERE id = $1 AND team_id = $2",
      [req.params.taskId, req.params.id]
    );
    if (!taskRes.rows.length) return res.status(404).json({ error: "Task not found" });

    const scrumCheck = await isScrumMaster(req.params.id, taskRes.rows[0].sprint_id, deleted_by_email);
    if (!scrumCheck) {
      return res.status(403).json({ error: "Only the Scrum Master can delete tasks." });
    }

    await db.query("DELETE FROM tasks WHERE id = $1", [req.params.taskId]);
    res.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/teams/:id/tasks/:taskId error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;