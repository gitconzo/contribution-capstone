// backend/utils/config.js
// Single source of truth for all environment-based configuration.
// Every other file should import from here rather than reading process.env directly.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");

const PORT = parseInt(process.env.PORT || "5002", 10);
const DATA_DIR = path.join(ROOT_DIR, process.env.DATA_DIR || "data");
const UPLOAD_DIR = path.join(ROOT_DIR, process.env.UPLOADS_DIR || "uploads");
const PARSED_DIR = path.join(DATA_DIR, process.env.PARSED_DIR || "parsed");
const ANALYSES_DIR = path.join(DATA_DIR, process.env.ANALYSES_DIR || "analyses");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

module.exports = {
  PORT,
  ROOT_DIR,
  DATA_DIR,
  UPLOAD_DIR,
  PARSED_DIR,
  ANALYSES_DIR,
  GITHUB_TOKEN,
};
