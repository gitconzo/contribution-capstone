const router = require("express").Router();
const path = require("path");
const db = require("../../utils/db");

function detectTypeFromName(filename, userGuess) {
  if (userGuess && userGuess !== "unknown") return userGuess;
  const lower = (filename || "").toLowerCase();
  if (lower.includes("attendance")) return "attendance";
  if (lower.includes("worklog")) return "worklog";
  if (lower.includes("sprint")) return "sprint_report";
  if (lower.includes("peer")) return "peer_review";
  if (lower.includes("project") && lower.includes("plan")) return "project_plan";
  return "unknown";
}

const TEAM_LEVEL_TYPES = ["attendance", "sprint_report", "project_plan"];
const INDIVIDUAL_TYPES = ["worklog", "peer_review"];

router.post("/student", async (req, res) => {
  const {
    s3Key,
    storedName,
    originalName,
    size,
    mimetype,
    teamId,
    userType,
    uploadedByName,
    uploadedByEmail,
  } = req.body || {};

  if (!s3Key || !originalName || !teamId || !uploadedByEmail) {
    return res.status(400).json({
      error: "Missing required upload fields.",
    });
  }

  try {
    const studentResult = await db.query(
      "SELECT * FROM students WHERE team_id = $1 AND email = $2",
      [teamId, uploadedByEmail]
    );

    if (!studentResult.rows.length) {
      return res.status(403).json({
        error: "You are not a member of this team.",
      });
    }

    const student = studentResult.rows[0];
    const role = student.role || "member";

    const detectedType = detectTypeFromName(originalName, userType || null);
    const uploadScope = TEAM_LEVEL_TYPES.includes(detectedType) ? "team" : "individual";

    if (TEAM_LEVEL_TYPES.includes(detectedType) && role !== "leader") {
      return res.status(403).json({
        error: "Only the team leader can upload this document type.",
      });
    }

    if (
      !TEAM_LEVEL_TYPES.includes(detectedType) &&
      !INDIVIDUAL_TYPES.includes(detectedType) &&
      detectedType !== "unknown"
    ) {
      return res.status(400).json({
        error: "Unsupported document type.",
      });
    }

    const id = storedName || path.basename(s3Key);

    await db.query(
      `INSERT INTO file_registry
        (
          id,
          team_id,
          original_name,
          stored_name,
          s3_key,
          mimetype,
          size,
          detected_type,
          user_type,
          uploaded_by_name,
          uploaded_by_email,
          upload_scope,
          approval_status,
          status
        )
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', 'pending')`,
      [
        id,
        teamId,
        originalName,
        id,
        s3Key,
        mimetype || null,
        size || null,
        detectedType,
        detectedType,
        uploadedByName || null,
        uploadedByEmail,
        uploadScope,
      ]
    );

    const result = await db.query(
      "SELECT * FROM file_registry WHERE id = $1",
      [id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("POST /api/uploads/student error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;