const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const SETTINGS_PATH = path.join(__dirname, "..", "data", "appSettings.json");

function ensureSettingsFile() {
  if (!fs.existsSync(SETTINGS_PATH)) {
    fs.writeFileSync(
      SETTINGS_PATH,
      JSON.stringify({ studentDefaultPassword: "Test@12345" }, null, 2),
      "utf-8"
    );
  }
}

function readSettings() {
  ensureSettingsFile();
  return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
}

function writeSettings(settings) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

router.get("/", (_req, res) => {
  try {
    const settings = readSettings();
    res.json(settings);
  } catch (err) {
    console.error("GET /api/settings error:", err);
    res.status(500).json({ error: "Failed to load settings." });
  }
});

router.put("/student-default-password", (req, res) => {
  try {
    const { newPassword } = req.body || {};

    if (!newPassword) {
      return res.status(400).json({ error: "newPassword is required." });
    }

    const settings = readSettings();
    settings.studentDefaultPassword = newPassword;
    writeSettings(settings);

    res.json({
      message: "Student default password updated successfully.",
      studentDefaultPassword: settings.studentDefaultPassword,
    });
  } catch (err) {
    console.error("PUT /api/settings/student-default-password error:", err);
    res.status(500).json({ error: "Failed to update student default password." });
  }
});

module.exports = router;