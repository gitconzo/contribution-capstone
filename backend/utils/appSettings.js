const fs = require("fs");
const path = require("path");

const APP_SETTINGS_PATH = path.join(__dirname, "../data/appSettings.json");

const DEFAULT_SETTINGS = {
  studentDefaultPassword: "Test@123456",
};

function ensureAppSettingsFile() {
  if (!fs.existsSync(APP_SETTINGS_PATH)) {
    fs.writeFileSync(
      APP_SETTINGS_PATH,
      JSON.stringify(DEFAULT_SETTINGS, null, 2),
      "utf-8"
    );
    return;
  }

  try {
    const raw = fs.readFileSync(APP_SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw);

    if (!parsed.studentDefaultPassword) {
      const merged = { ...DEFAULT_SETTINGS, ...parsed };
      fs.writeFileSync(
        APP_SETTINGS_PATH,
        JSON.stringify(merged, null, 2),
        "utf-8"
      );
    }
  } catch (error) {
    fs.writeFileSync(
      APP_SETTINGS_PATH,
      JSON.stringify(DEFAULT_SETTINGS, null, 2),
      "utf-8"
    );
  }
}

function readAppSettings() {
  ensureAppSettingsFile();
  return JSON.parse(fs.readFileSync(APP_SETTINGS_PATH, "utf-8"));
}

function writeAppSettings(settings) {
  ensureAppSettingsFile();
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  fs.writeFileSync(
    APP_SETTINGS_PATH,
    JSON.stringify(merged, null, 2),
    "utf-8"
  );
  return merged;
}

module.exports = {
  readAppSettings,
  writeAppSettings,
};