const express = require("express");
const cors = require("cors");

const { PORT, DATA_DIR, UPLOAD_DIR, PARSED_DIR } = require("./utils/config");
const { ensureFile, ensureDir } = require("./utils/fileUtils");

const authRoutes = require("./routes/authentication");

const app = express();
app.use(cors());
app.use(express.json());

// Check dirs/files exist on startup
ensureDir(DATA_DIR);
ensureDir(UPLOAD_DIR);
ensureDir(PARSED_DIR);

// Serve uploaded files as static assets
app.use("/uploads", express.static(UPLOAD_DIR));

// Auth routes
app.use("/api/auth", authRoutes);

// API routes
app.use("/api", require("./routes"));

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

