// backend/routes/scores/GET.js
const router = require("express").Router();
const { ROOT_DIR } = require("../../utils/config");
const { aggregateTeamScores } = require("../../services/aggregator");

// GET /api/scores?teamId=...
router.get("/", async (req, res) => {
  try {
    const teamId = req.query.teamId;
    if (!teamId) return res.status(400).json({ error: "teamId is required." });

    const usePeerReview = req.query.usePeerReview === "true";

    // Overall scoring always uses the full repo analysis (finalStats.json) + all documents.
    // Sprint-specific scores are fetched separately via /sprints/:sprintId/scores.
    const payload = await aggregateTeamScores({ teamId, rootDir: ROOT_DIR, usePeerReview });
    return res.json({ ...payload, scoringMethod: "overall" });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "Failed to aggregate scores" });
  }
});

module.exports = router;