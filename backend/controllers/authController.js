const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { comparePassword, hashPassword } = require("../utils/hashPassword");

const USERS_PATH = path.join(__dirname, "../data/users.json");
const APP_SETTINGS_PATH = path.join(__dirname, "../data/appSettings.json");
const DEFAULT_PASSWORD = "123456";

if (!fs.existsSync(APP_SETTINGS_PATH)) {
  fs.writeFileSync(
    APP_SETTINGS_PATH,
    JSON.stringify(
      {
        studentDefaultPasswordHash: bcrypt.hashSync(DEFAULT_PASSWORD, 10),
      },
      null,
      2
    )
  );
}

function generateToken(user) {
  return `demo-token-${user.id}-${Date.now()}`;
}

function loadUsers() {
  return JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
}

function loadAppSettings() {
  return JSON.parse(fs.readFileSync(APP_SETTINGS_PATH, "utf-8"));
}

function saveAppSettings(settings) {
  fs.writeFileSync(APP_SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

async function isUsingDefaultPassword(user) {
  try {
    const settings = loadAppSettings();
    return user.password === settings.studentDefaultPasswordHash;
  } catch {
    return false;
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const users = loadUsers();
    const user = users.find(
      (u) => u.email.toLowerCase() === String(email).toLowerCase()
    );

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isMatch = await comparePassword(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = generateToken(user);
    const usingDefaultPassword = user.role === "student" ? await isUsingDefaultPassword(user) : false;

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        usingDefaultPassword,
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
    const user = users.find((u) => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const usingDefaultPassword = user.role === "student" ? await isUsingDefaultPassword(user) : false;

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      usingDefaultPassword,
    });
  } catch (error) {
    console.error("Get me error:", error);
    return res.status(500).json({ message: "Server error." });
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All password fields are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New password and confirm password do not match." });
    }

    const users = loadUsers();
    const userIndex = users.findIndex((u) => u.id === req.user.id);

    if (userIndex === -1) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await comparePassword(currentPassword, users[userIndex].password);

    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    const hashedNewPassword = await hashPassword(newPassword);
    users[userIndex].password = hashedNewPassword;

    saveUsers(users);

    return res.json({
      message: "Password updated successfully.",
      usingDefaultPassword: false,
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Server error while changing password." });
  }
}

async function updateStudentDefaultPassword(req, res) {
  try {
    const { currentDefaultPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentDefaultPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "Current default password, new password, and confirm password are required.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Student default password must be at least 6 characters.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "Student password and confirm password do not match.",
      });
    }

    const settings = loadAppSettings();

    const currentDefaultMatches = await comparePassword(
      currentDefaultPassword,
      settings.studentDefaultPasswordHash
    );

    if (!currentDefaultMatches) {
      return res.status(401).json({
        message: "Current default password is incorrect.",
      });
    }

    const newHash = await hashPassword(newPassword);

    const users = loadUsers();
    let updatedStudents = 0;

    for (const user of users) {
      if (user.role !== "student") continue;

      let isStillUsingDefault = false;

      try {
        isStillUsingDefault = await comparePassword(currentDefaultPassword, user.password);
      } catch {
        isStillUsingDefault = user.password === currentDefaultPassword;
      }

      if (isStillUsingDefault) {
        user.password = newHash;
        updatedStudents += 1;
      }
    }

    saveUsers(users);

    settings.studentDefaultPasswordHash = newHash;
    saveAppSettings(settings);

    return res.json({
      message: "Student default password updated successfully.",
      updatedStudents,
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
      (u) => u.email.toLowerCase() === String(email).toLowerCase()
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
  try {
    const { email, newPassword, confirmPassword } = req.body || {};

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New password and confirm password do not match." });
    }

    const users = loadUsers();
    const userIndex = users.findIndex(
      (u) => u.email.toLowerCase() === String(email).toLowerCase()
    );

    if (userIndex === -1) {
      return res.status(404).json({ message: "No account found for that email." });
    }

    const hashedNewPassword = await hashPassword(newPassword);
    users[userIndex].password = hashedNewPassword;

    saveUsers(users);

    return res.json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Server error while resetting password." });
  }
}

module.exports = {
  login,
  getMe,
  changePassword,
  updateStudentDefaultPassword,
  forgotUsername,
  forgotPassword,
};