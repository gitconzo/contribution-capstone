// backend/routes/scores/GET.js
const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const db = require("../../utils/db");
const { ROOT_DIR, DATA_DIR } = require("../../utils/config");
const { readActiveId } = require("../../utils/activeTeamUtils");
const { aggregateTeamScores } = require("../../services/aggregator");
const { safeReadJson } = require("../../utils/fileUtils");

// GET /api/scores?teamId=...
router.get("/", async (req, res) => {
  try {
    const teamId = req.query.teamId || readActiveId();
    if (!teamId) return res.status(400).json({ error: "No active team." });

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
      const sprintRankings = sprintResults.map(sr =>
        sr.ranking.find(r => r.email === student.email)
      ).filter(Boolean);

      const avgScore = +(sprintRankings.reduce((a, r) => a + (r.score || 0), 0) / sprintRankings.length).toFixed(2);

      // Average each breakdown dimension across all sprints
      const allDims = Object.keys(sprintRankings[0]?.breakdown || {});
      const avgBreakdown = {};
      allDims.forEach(dim => {
        const vals = sprintRankings.map(r => r.breakdown?.[dim] || 0);
        avgBreakdown[dim] = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(4);
      });

      // Average raw values too
      const sumKeys = new Set(["codeCommits", "hours", "meetings", "documents", "wordCount"]);
      const allRawKeys = Object.keys(sprintRankings[0]?.raw || {});
      const avgRaw = {};
      allRawKeys.forEach(key => {
        const vals = sprintRankings.map(r => r.raw?.[key] || 0);
        avgRaw[key] = sumKeys.has(key)
          ? +(vals.reduce((a, b) => a + b, 0)).toFixed(2)  // sum across sprints
          : +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2); // average across sprints
      });

      return { ...student, score: avgScore, breakdown: avgBreakdown, raw: avgRaw };
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