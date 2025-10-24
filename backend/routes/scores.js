// routes/scores.js
const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// Contribution scores endpoint - calculates and returns contribution score
router.get("/scores", (req, res) => {
  // looks for commit data in local file
  const filePath = path.join(__dirname, "..", "data", "commits.json");

  if (!fs.existsSync(filePath)) {
    // Error if data cant be fetched
    return res.status(404).json({ error: "No commit data found. Run fetchData.js first." });
  }

  // load data
  const commits = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // Aggregate raw metrics per author
  // creation of rawScores dictionary
  const rawScores = {};
  commits.forEach((commitObj) => {
    // if name is missing "unknown" is given
    const author = commitObj.author || "Unknown";
    if (!rawScores[author]) {
      rawScores[author] = { commits: 0, additions: 0, deletions: 0 };
    }
    rawScores[author].commits += 1; // count commits
    rawScores[author].additions += commitObj.stats?.additions || 0; // count lines added
    rawScores[author].deletions += commitObj.stats?.deletions || 0; // count lines deleted
  });

  // Normalization function
  function normalize(values) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return values.map(() => 1);
    return values.map((v) => (v - min) / (max - min));
  }

  // Normalize each metric from all authors
  const authors = Object.keys(rawScores); // e.g., ["Connor", "Jason", "Jen"]
  const commitsNorm = normalize(authors.map(a => rawScores[a].commits)); // [4, 10, 7]
  const additionsNorm = normalize(authors.map(a => rawScores[a].additions)); // [164275, 2000, 400]
  const deletionsNorm = normalize(authors.map(a => rawScores[a].deletions)); // [11812, 50, 600]

  // Weighted sum
  const weights = { commits: 0.3, additions: 0.4, deletions: 0.3 };

  const finalScores = {};
  authors.forEach((author, i) => {
    finalScores[author] =
      commitsNorm[i] * weights.commits +
      additionsNorm[i] * weights.additions +
      deletionsNorm[i] * weights.deletions;
  });

  // both raw and normalized scores are sent back to frontend
  res.json({ raw: rawScores, scores: finalScores });
});

module.exports = router;