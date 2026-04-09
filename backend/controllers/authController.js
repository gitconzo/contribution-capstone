const fs = require("fs");
const path = require("path");
const { readAppSettings, writeAppSettings } = require("../utils/appSettings");

const USERS_PATH = path.join(__dirname, "../data/users.json");

function generateToken(user) {
  return `demo-token-${user.id}-${Date.now()}`;
}

function loadUsers() {
  if (!fs.existsSync(USERS_PATH)) return [];
  return JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
}

async function login(req, res) {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const users = loadUsers();
    const user = users.find(
      (u) => u.email?.toLowerCase() === String(email).toLowerCase()
    );

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = generateToken(user);

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        usingDefaultPassword: false,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error during login." });
  }
}

async function getMe(req, res) {
  try {
    const users = loadUsers();
    const user = users.find((u) => u.id === req.user?.id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      usingDefaultPassword: false,
    });
  } catch (error) {
    console.error("Get me error:", error);
    return res.status(500).json({ message: "Server error." });
  }
}

async function changePassword(req, res) {
  return res.status(400).json({
    message: "Password changes are now handled through Cognito on the frontend.",
  });
}

async function getStudentDefaultPassword(req, res) {
  try {
    const settings = readAppSettings();

    return res.json({
      studentDefaultPassword: settings.studentDefaultPassword || "",
    });
  } catch (error) {
    console.error("Get student default password error:", error);
    return res.status(500).json({
      message: "Server error while loading student default password.",
    });
  }
}

async function updateStudentDefaultPassword(req, res) {
  try {
    const { newPassword, confirmPassword } = req.body || {};

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "New password and confirm password are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "Student default password must be at least 8 characters.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "Student password and confirm password do not match.",
      });
    }

    writeAppSettings({
      studentDefaultPassword: newPassword,
    });

    return res.json({
      message: "Student default password updated successfully.",
      updatedStudents: 0,
    });
  } catch (error) {
    console.error("Update student default password error:", error);
    return res.status(500).json({
      message: "Server error while updating student default password.",
    });
  }
}

async function forgotUsername(req, res) {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const users = loadUsers();
    const user = users.find(
      (u) => u.email?.toLowerCase() === String(email).toLowerCase()
    );

    if (!user) {
      return res.status(404).json({ message: "No account found for that email." });
    }

    return res.json({
      message: "Username found.",
      username: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error("Forgot username error:", error);
    return res.status(500).json({ message: "Server error while retrieving username." });
  }
}

async function forgotPassword(req, res) {
  return res.status(400).json({
    message: "Forgot password is now handled through Cognito on the frontend.",
  });
}

module.exports = {
  login,
  getMe,
  changePassword,
  getStudentDefaultPassword,
  updateStudentDefaultPassword,
  forgotUsername,
  forgotPassword,
};