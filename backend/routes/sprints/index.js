// backend/routes/sprints/index.js
const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const { ROOT_DIR, DATA_DIR } = require("../../utils/config");
const { pyBin, runFile } = require("../../utils/processUtils");
const { safeReadJson, writeJson } = require("../../utils/fileUtils");

const SPRINTS_PATH = path.join(DATA_DIR, "sprints.json");

function loadSprints() {
  return safeReadJson(SPRINTS_PATH, []);
}

function saveSprints(sprints) {
  writeJson(SPRINTS_PATH, sprints);
}

// GET /api/sprints — get all sprints
router.get("/", (req, res) => {
  res.json(loadSprints());
});

// GET /api/sprints/team/:teamId — get sprints for a team
router.get("/team/:teamId", (req, res) => {
  const { teamId } = req.params;
  const sprints = loadSprints().filter(s =>
    !s.team_ids || s.team_ids.length === 0 || s.team_ids.includes(teamId)
  );
  res.json(sprints);
});

// GET /api/sprints/:id — get single sprint
router.get("/:id", (req, res) => {
  const sprint = loadSprints().find(s => s.id === req.params.id);
  if (!sprint) return res.status(404).json({ error: "Sprint not found" });
  res.json(sprint);
});

// POST /api/sprints — create sprint
router.post("/", (req, res) => {
  const { name, start_date, end_date, team_ids } = req.body;
  if (!name || !start_date || !end_date) {
    return res.status(400).json({ error: "name, start_date and end_date are required" });
  }

  const sprints = loadSprints();
  const sprint = {
    id: `sprint_${Date.now()}`,
    name,
    start_date,
    end_date,
    team_ids: team_ids || [],
    createdAt: new Date().toISOString(),
  };
  sprints.push(sprint);
  saveSprints(sprints);
  res.json(sprint);
});

// PUT /api/sprints/:id — update sprint
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { name, start_date, end_date, team_ids } = req.body;
  const sprints = loadSprints();
  const idx = sprints.findIndex(s => s.id === id);
  if (idx === -1) return res.status(404).json({ error: "Sprint not found" });

  sprints[idx] = { ...sprints[idx], name, start_date, end_date, team_ids: team_ids || sprints[idx].team_ids };
  saveSprints(sprints);
  res.json(sprints[idx]);
});

// DELETE /api/sprints/:id — delete sprint
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const sprints = loadSprints().filter(s => s.id !== id);
  saveSprints(sprints);

  // Clean up sprint stats files
  const statsPattern = path.join(DATA_DIR, `sprint_${id}_*`);
  try {
    fs.readdirSync(DATA_DIR)
      .filter(f => f.startsWith(`sprint_${id}_`))
      .forEach(f => fs.unlinkSync(path.join(DATA_DIR, f)));
  } catch (e) {}

  res.json({ success: true });
});

// POST /api/sprints/:id/analyze — run analysis for sprint
// body: { team_id?, repo_url? } — if no team_id, analyse all teams in sprint
router.post("/:id/analyze", async (req, res) => {
  const { id } = req.params;
  const { team_id } = req.body || {};

  const sprint = loadSprints().find(s => s.id === id);
  if (!sprint) return res.status(404).json({ error: "Sprint not found" });

  // Write status
  writeJson(path.join(DATA_DIR, `sprint_${id}_status.json`), {
    status: "running",
    startedAt: new Date().toISOString(),
    sprintId: id,
  });

  // Return immediately
  res.json({ success: true, status: "running", message: "Sprint analysis started." });

  // Run in background
  (async () => {
    try {
      // Get teams to analyse
      const db = require("../../utils/db");
      let teamsQuery;
      if (team_id) {
        teamsQuery = await db.query("SELECT * FROM teams WHERE id = $1", [team_id]);
      } else if (sprint.team_ids?.length) {
        teamsQuery = await db.query(
          "SELECT * FROM teams WHERE id = ANY($1)",
          [sprint.team_ids]
        );
      } else {
        teamsQuery = await db.query("SELECT * FROM teams");
      }

      for (const team of teamsQuery.rows) {
        if (!team.repo_url) {
          console.warn(`Team ${team.id} has no repo URL, skipping`);
          continue;
        }

        console.log(`Analysing sprint ${sprint.name} for team ${team.id}`);
        const outputPath = path.join(DATA_DIR, `sprint_${id}_${team.id}_stats.json`);

        try {
          await runFile(pyBin(), [
            path.join(ROOT_DIR, "main.py"),
            "--repo-url", team.repo_url,
            "--start-date", sprint.start_date,
            "--end-date", sprint.end_date,
            "--output", outputPath,
          ], { cwd: ROOT_DIR });
          console.log(`Sprint analysis complete for team ${team.id}`);
        } catch (e) {
          console.error(`Sprint analysis failed for team ${team.id}:`, e.message);
        }
      }

      writeJson(path.join(DATA_DIR, `sprint_${id}_status.json`), {
        status: "complete",
        completedAt: new Date().toISOString(),
        sprintId: id,
      });
    } catch (e) {
      console.error("Sprint analysis error:", e.message);
      writeJson(path.join(DATA_DIR, `sprint_${id}_status.json`), {
        status: "error",
        error: e.message,
        sprintId: id,
      });
    }
  })();
});

// GET /api/sprints/:id/status — poll analysis status
router.get("/:id/status", (req, res) => {
  const status = safeReadJson(
    path.join(DATA_DIR, `sprint_${req.params.id}_status.json`),
    { status: "idle" }
  );
  res.json(status);
});

// GET /api/sprints/:id/scores/:teamId — get scores for sprint
router.get("/:id/scores/:teamId", async (req, res) => {
  try {
    const { id, teamId } = req.params;

    const sprint = loadSprints().find(s => s.id === id);
    if (!sprint) return res.status(404).json({ error: "Sprint not found" });

    const statsPath = path.join(DATA_DIR, `sprint_${id}_${teamId}_stats.json`);
    if (!fs.existsSync(statsPath)) {
      return res.status(404).json({ error: "Sprint not yet analysed for this team" });
    }

    // Use aggregator with sprint stats injected
    const { aggregateTeamScores } = require("../../services/aggregator");
    const sprintStats = safeReadJson(statsPath, {});

    const scored = await aggregateTeamScores({
      teamId,
      rootDir: ROOT_DIR,
      sprintStats,
    });

    res.json({ sprint, ...scored });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sprints/:id/scores/:teamId/overall — average across all sprints
router.get("/overall/:teamId", async (req, res) => {
  try {
    const { teamId } = req.params;
    const sprints = loadSprints().filter(s =>
      !s.team_ids?.length || s.team_ids.includes(teamId)
    );

    const { aggregateTeamScores } = require("../../services/aggregator");
    const sprintScores = [];

    for (const sprint of sprints) {
      const statsPath = path.join(DATA_DIR, `sprint_${sprint.id}_${teamId}_stats.json`);
      if (!fs.existsSync(statsPath)) continue;

      const sprintStats = safeReadJson(statsPath, {});
      const scored = await aggregateTeamScores({ teamId, rootDir: ROOT_DIR, sprintStats });
      sprintScores.push({ sprint, scored });
    }

    if (!sprintScores.length) {
      // Fall back to overall analysis
      const scored = await aggregateTeamScores({ teamId, rootDir: ROOT_DIR });
      return res.json({ isOverall: true, ...scored });
    }

    // Average scores across sprints
    const allStudents = sprintScores[0].scored.ranking.map(s => s.email);
    const averaged = allStudents.map(email => {
      const studentScores = sprintScores
        .map(sp => sp.scored.ranking.find(r => r.email === email)?.score || 0);
      const avg = studentScores.reduce((a, b) => a + b, 0) / studentScores.length;
      const base = sprintScores[0].scored.ranking.find(r => r.email === email);
      return { ...base, score: +avg.toFixed(2) };
    }).sort((a, b) => b.score - a.score).map((r, idx) => ({ ...r, rank: idx + 1 }));

    res.json({
      isOverall: true,
      ranking: averaged,
      sprintCount: sprintScores.length,
      weights: sprintScores[0].scored.weights,
      studentsCount: averaged.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;