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

const { protect, authorizeRoles } = require("../../middleware/authMiddleware");

router.post("/login", login);
router.get("/me", protect, getMe);
router.post("/change-password", protect, changePassword);


router.get("/student-default-password", getStudentDefaultPassword);
router.post("/student-default-password", updateStudentDefaultPassword);

router.post("/forgot-username", forgotUsername);
router.post("/forgot-password", forgotPassword);

module.exports = router;