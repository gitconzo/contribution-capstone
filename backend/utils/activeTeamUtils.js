// backend/utils/activeTeamUtils.js
// Helpers for reading and writing the active team ID.
// Tolerates both legacy (plain string) and current ({ id }) storage formats.
const fs = require("fs");
const { ACTIVE_TEAM_PATH } = require("./config");
const { writeJson } = require("./fileUtils");

function readActiveId() {
  try {
    const raw = fs.readFileSync(ACTIVE_TEAM_PATH, "utf-8").trim();
    if (raw.startsWith('"') || /^[A-Za-z0-9_\-]+$/.test(raw)) {
      const val = JSON.parse(raw);
      return typeof val === "string" ? val : (val?.id ?? null);
    }
    const obj = JSON.parse(raw);
    return obj?.id ?? null;
  } catch {
    return null;
  }
}

function writeActiveId(id) {
  writeJson(ACTIVE_TEAM_PATH, { id });
}

module.exports = { readActiveId, writeActiveId };
