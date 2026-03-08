// backend/utils/fileUtils.js
// Centralised file I/O helpers — replaces duplicate readJson/writeJson/safeReadJson/ensureFile across all files.
const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Returns fallback instead of throwing when the file is missing or malformed.
function safeReadJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

// Writes init value only if the file doesn't already exist.
function ensureFile(filePath, init) {
  if (!fs.existsSync(filePath)) writeJson(filePath, init);
}

// Creates the directory (and any missing parents) if it doesn't already exist.
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

module.exports = { readJson, writeJson, safeReadJson, ensureFile, ensureDir };
