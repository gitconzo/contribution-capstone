const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch"); // install: npm install node-fetch - allows for API calls in Node

// repo details (hard coded)
const owner = "IsotopicIO";
const repo = "iso-space-game";

//check repo.json and use those values forr owner and repo
try {
  const repoFile = path.join(__dirname, "data", "repo.json");
  if (fs.existsSync(repoFile)) {
    const repoData = JSON.parse(fs.readFileSync(repoFile, "utf-8"));
    if (repoData.owner && repoData.repo) {
      owner = repoData.owner;
      repo = repoData.repo;
      console.log(`Using repo from: ${owner}/${repo}`);
    } else {
      console.log("Repo info incomplete in repo.json, using hard coded repo.");
    }
  }
} catch (err) {
  console.warn("Could not load repo.json, using defaults:", err.message);
}


// if private repo, add token here
const token = process.env.GITHUB_TOKEN;

async function fetchCommits() {
    // ask GitHub for recent commits from repo
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`; 

  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        ...(token ? { Authorization: `token ${token}` } : {}),
      },
    });

    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status}`);
    }

    const commits = await res.json();
    const detailedCommits = [];
    // loops over commits to grab data such as additions and deletions
    for (const commit of commits) {
      const sha = commit.sha;
      const detailUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;

      const detailRes = await fetch(detailUrl, {
        headers: {
          "Accept": "application/vnd.github.v3+json",
          ...(token ? { Authorization: `token ${token}` } : {}),
        },
      });

      if (!detailRes.ok) {
        console.warn(`Skipping commit ${sha}, error: ${detailRes.status}`);
        continue;
      }

      const detailData = await detailRes.json();
      // storing and saving commit details
      detailedCommits.push({
        sha,
        author: detailData.commit.author.name,
        username: detailData.author ? detailData.author.login : "Unknown",
        date: detailData.commit.author.date,
        message: detailData.commit.message,
        stats: detailData.stats,
      });
    }
    // saved locally
    const filePath = path.join(__dirname, "data", "commits.json");
    fs.writeFileSync(filePath, JSON.stringify(detailedCommits, null, 2));

    console.log(`Saved ${detailedCommits.length} detailed commits to ${filePath}`);
  } catch (err) {
    console.error("Error fetching commits:", err.message);
  }
}

fetchCommits();
