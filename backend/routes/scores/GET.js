// backend/routes/scores/GET.js
const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const db = require("../../utils/db");
const { ROOT_DIR, DATA_DIR } = require("../../utils/config");
const { aggregateTeamScores } = require("../../services/aggregator");
const { safeReadJson } = require("../../utils/fileUtils");

// GET /api/scores?teamId=...
router.get("/", async (req, res) => {
  try {
    const teamId = req.query.teamId;
    if (!teamId) return res.status(400).json({ error: "teamId is required." });

    const usePeerReview = req.query.usePeerReview === "true";

    // Check if any sprint scores exist for this team
    const sprintsRes = await db.query(
      "SELECT id, sprint_number, start_date, end_date FROM sprints WHERE team_id = $1 ORDER BY sprint_number ASC",
      [teamId]
    );
    const sprints = sprintsRes.rows;

    // Find sprints that have been analysed (stats file exists)
    const analysedSprints = sprints.filter(sp => {
      const statsPath = path.join(DATA_DIR, `sprint_${sp.id}_${teamId}_stats.json`);
      return fs.existsSync(statsPath);
    });

    // If no sprints have been analysed, fall back to full repo analysis
    if (!analysedSprints.length) {
      const payload = await aggregateTeamScores({ teamId, rootDir: ROOT_DIR, usePeerReview });
      return res.json({ ...payload, scoringMethod: "overall" });
    }

    // Average scores across all analysed sprints
    const sprintResults = [];
    for (const sp of analysedSprints) {
      const statsPath = path.join(DATA_DIR, `sprint_${sp.id}_${teamId}_stats.json`);
      const sprintStats = safeReadJson(statsPath, {});
      const scored = await aggregateTeamScores({
        teamId,
        rootDir: ROOT_DIR,
        usePeerReview,
        sprintStats,
      });
      sprintResults.push(scored);
    }

    // Average each student's score across all analysed sprints
    const baseRanking = sprintResults[0].ranking;
    const averaged = baseRanking.map(student => {
      const sprintScores = sprintResults.map(sr =>
        sr.ranking.find(r => r.email === student.email)?.score || 0
      );
      const avgScore = +(sprintScores.reduce((a, b) => a + b, 0) / sprintScores.length).toFixed(2);
      return { ...student, score: avgScore };
    });

    // Re-normalise so scores add up to 100%
    const total = averaged.reduce((sum, s) => sum + s.score, 0);
    const normalised = total > 0
      ? averaged.map(s => ({ ...s, score: +(100 * s.score / total).toFixed(2) }))
      : averaged;

    const reRanked = normalised
      .sort((a, b) => b.score - a.score)
      .map((r, idx) => ({ ...r, rank: idx + 1 }));

    res.json({
      ...sprintResults[0],
      ranking: reRanked,
      scoringMethod: "sprint_average",
      sprintCount: analysedSprints.length,
      totalSprints: sprints.length,
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "Failed to aggregate scores" });
  }
});

module.exports = router;