const express = require("express");
const router = express.Router();

const {
  login,
  getMe,
  changePassword,
  getStudentDefaultPassword,
  updateStudentDefaultPassword,
  forgotUsername,
  forgotPassword,
} = require("../../controllers/authController");

const { resetStudentPassword } = require("../../utils/cognitoAdmin");
const { protect, authorizeRoles } = require("../../middleware/authMiddleware");

router.post("/login", login);
router.get("/me", protect, getMe);
router.post("/change-password", protect, changePassword);

router.get("/student-default-password", getStudentDefaultPassword);
router.post("/student-default-password", updateStudentDefaultPassword);

router.post("/reset-student-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email is required." });
  try {
    const result = await resetStudentPassword(email);
    res.json({ success: true, email: result.email, previousStatus: result.status });
  } catch (err) {
    console.error("reset-student-password error:", err);
    res.status(400).json({ error: err.message });
  }
});

router.post("/forgot-username", forgotUsername);
router.post("/forgot-password", forgotPassword);

module.exports = router;