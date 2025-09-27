const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 5002;

app.use(cors());

// API endpoint
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from Node.js backend!" });
});

// Contribution scores endpoint
app.get("/api/scores", (req, res) => {
  const filePath = path.join(__dirname, "data", "commits.json");

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "No commit data found. Run fetchData.js first." });
  }

  const commits = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // Simple scoring that counts commits per author
  const scores = {};

  commits.forEach((commitObj) => {
    const author = commitObj.commit?.author?.name || "Unknown";
    scores[author] = (scores[author] || 0) + 1;
  });

  res.json(scores);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
