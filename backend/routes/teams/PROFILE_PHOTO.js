const router = require("express").Router();
const db = require("../../utils/db");
const { deleteFile } = require("../../utils/s3");

router.post("/", async (req, res) => {
  const { email, teamId, photoUrl } = req.body || {};

  try {
    if (!email || !teamId || !photoUrl) {
      return res.status(400).json({ error: "Missing email, teamId, or photoUrl" });
    }

    const result = await db.query(
      `UPDATE students
       SET profile_photo_url = $1
       WHERE team_id = $2 AND email = $3
       RETURNING *`,
      [photoUrl, teamId, email]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Student not found in this team" });
    }

    res.json({ success: true, student: result.rows[0] });
  } catch (err) {
    console.error("PROFILE PHOTO ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/remove", async (req, res) => {
    const { email, teamId } = req.body || {};
  
    try {
      if (!email || !teamId) {
        return res.status(400).json({ error: "Missing email or teamId" });
      }
  
      const existing = await db.query(
        `SELECT profile_photo_url
         FROM students
         WHERE team_id = $1 AND email = $2`,
        [teamId, email]
      );
  
      if (!existing.rows.length) {
        return res.status(404).json({ error: "Student not found in this team" });
      }
  
      const photoKey = existing.rows[0].profile_photo_url;
  
      if (photoKey) {
        await deleteFile(photoKey);
      }
  
      const result = await db.query(
        `UPDATE students
         SET profile_photo_url = NULL
         WHERE team_id = $1 AND email = $2
         RETURNING *`,
        [teamId, email]
      );
  
      res.json({ success: true, student: result.rows[0] });
    } catch (err) {
      console.error("REMOVE PROFILE PHOTO ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  });

module.exports = router;