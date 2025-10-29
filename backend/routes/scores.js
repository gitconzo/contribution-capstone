// backend/routes/scores.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const { aggregateTeamScores } = require("../services/aggregator");

const router = express.Router();

// GET /api/scores?teamId=<id>
// If teamId missing, uses data/activeTeam.json
router.get("/scores", (req, res) => {
  try {
    const rootDir = path.join(__dirname, "..");
    let { teamId } = req.query;

    if (!teamId) {
      const activePath = path.join(rootDir, "data", "activeTeam.json");
      if (!fs.existsSync(activePath)) {
        return res.status(400).json({ error: "No teamId provided and activeTeam.json missing." });
      }
      const active = JSON.parse(fs.readFileSync(activePath, "utf-8"));
      teamId = active;
    }

    const payload = aggregateTeamScores({ teamId, rootDir });
    return res.json(payload);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Failed to aggregate scores" });
  }
});

module.exports = router;
