// backend/routes/scores/GET.js
const router = require("express").Router();
const { ROOT_DIR } = require("../../utils/config");
const { aggregateTeamScores } = require("../../services/aggregator");
const { protect } = require("../../middleware/authMiddleware");
const db = require("../../utils/db");

// GET /api/scores?teamId=...
router.get("/", protect, async (req, res) => {
  try {
    const teamId = req.query.teamId;
    if (!teamId) return res.status(400).json({ error: "teamId is required." });

    // Authorise: tutors must own the team; students must be enrolled in it.
    const { email, role } = req.user;
    const ownerRes = await db.query("SELECT owner_email FROM teams WHERE id = $1", [teamId]);
    if (!ownerRes.rows.length) return res.status(404).json({ error: "Team not found." });

    if (role === "student") {
      const enrolled = await db.query(
        "SELECT 1 FROM students WHERE team_id = $1 AND LOWER(email) = LOWER($2)",
        [teamId, email]
      );
      if (!enrolled.rows.length) return res.status(403).json({ error: "Not a member of this team." });
    } else {
      const ownerEmail = ownerRes.rows[0].owner_email;
      if (ownerEmail && ownerEmail.toLowerCase() !== String(email).toLowerCase()) {
        return res.status(403).json({ error: "You do not own this team." });
      }
    }

    const usePeerReview = req.query.usePeerReview === "true";

    // Overall scoring always uses the full repo analysis + all documents.
    // Sprint-specific scores are fetched separately via /sprints/:sprintId/scores.
    const payload = await aggregateTeamScores({ teamId, rootDir: ROOT_DIR, usePeerReview });
    return res.json({ ...payload, scoringMethod: "overall" });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "Failed to aggregate scores" });
  }
});

module.exports = router;