// backend/routes/scores/get.js
const router = require("express").Router();
const { ROOT_DIR } = require("../../utils/config");
const { readActiveId } = require("../../utils/activeTeamUtils");
const { aggregateTeamScores } = require("../../services/aggregator");

// GET /api/scores?teamId=...
router.get("/", (req, res) => {
  try {
    const teamId = req.query.teamId || readActiveId();
    if (!teamId) return res.status(400).json({ error: "No active team." });

    const payload = aggregateTeamScores({ teamId, rootDir: ROOT_DIR });
    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "Failed to aggregate scores" });
  }
});

module.exports = router;
