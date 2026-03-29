const fs = require("fs");
const path = require("path");

const SETTINGS_PATH = path.join(__dirname, "..", "data", "appSettings.json");

function ensureSettingsFile() {
  if (!fs.existsSync(SETTINGS_PATH)) {
    fs.writeFileSync(
      SETTINGS_PATH,
      JSON.stringify({ studentDefaultPassword: "Test@123" }, null, 2),
      "utf-8"
    );
  }
}

function readAppSettings() {
  ensureSettingsFile();
  return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
}

module.exports = {
  readAppSettings,
};