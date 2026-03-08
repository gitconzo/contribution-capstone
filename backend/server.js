// backend/server.js
const express = require("express");
const cors = require("cors");

const { PORT, DATA_DIR, UPLOAD_DIR, PARSED_DIR, REGISTRY_PATH, TEAMS_PATH, ACTIVE_TEAM_PATH } = require("./utils/config");
const { ensureFile, ensureDir } = require("./utils/fileUtils");

const app = express();
app.use(cors());
app.use(express.json());

// Check dirs/files exist on startup
ensureDir(DATA_DIR);
ensureDir(UPLOAD_DIR);
ensureDir(PARSED_DIR);
ensureFile(REGISTRY_PATH, []);
ensureFile(TEAMS_PATH, []);
ensureFile(ACTIVE_TEAM_PATH, null);

// Serve uploaded files as static assets
app.use("/uploads", express.static(UPLOAD_DIR));

// API routes
app.use("/api", require("./routes"));

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
