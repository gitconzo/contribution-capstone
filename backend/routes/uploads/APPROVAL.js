const router = require("express").Router();
const db = require("../../utils/db");

// GET /api/uploads/pending
router.get("/pending", async (req, res) => {
    try {
      const { teamId } = req.query;
  
      if (!teamId) {
        return res.status(400).json({ error: "Missing teamId" });
      }
  
      const result = await db.query(
        `
        SELECT *
        FROM file_registry
        WHERE approval_status = 'pending'
          AND team_id = $1
          AND LOWER(COALESCE(uploaded_by_name, '')) <> 'lecturer'
        ORDER BY upload_date DESC
        `,
        [teamId]
      );
  
      res.json(result.rows);
    } catch (err) {
      console.error("GET /api/uploads/pending error:", err);
      res.status(500).json({ error: err.message });
    }
  });

// POST /api/uploads/:id/approve
router.post("/:id/approve", async (req, res) => {
  try {
    const { approvedBy } = req.body || {};

    const result = await db.query(
      `
      UPDATE file_registry
      SET approval_status = 'approved',
          approved_by = $1,
          approved_at = NOW(),
          status = 'confirmed'
      WHERE id = $2
      RETURNING *
      `,
      [approvedBy || "Lecturer", req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Upload not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("POST /api/uploads/:id/approve error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/uploads/:id/reject
router.post("/:id/reject", async (req, res) => {
  try {
    const { approvedBy, declineReason } = req.body || {};

    const result = await db.query(
      `
      UPDATE file_registry
      SET approval_status = 'rejected',
          approved_by = $1,
          approved_at = NOW(),
          decline_reason = $2,
          status = 'rejected'
      WHERE id = $3
      RETURNING *
      `,
      [approvedBy || "Lecturer", declineReason || null, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Upload not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("POST /api/uploads/:id/reject error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;