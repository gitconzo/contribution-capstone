const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch"); // install: npm install node-fetch

// repo details
const owner = "gitconzo";
const repo = "contribution-capstone";
// if private repo, add token here
const token = process.env.GITHUB_TOKEN;

async function fetchCommits() {
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

      detailedCommits.push({
        sha,
        author: detailData.commit.author.name,
        username: detailData.author ? detailData.author.login : "Unknown",
        date: detailData.commit.author.date,
        message: detailData.commit.message,
        stats: detailData.stats,
      });
    }

    const filePath = path.join(__dirname, "data", "commits.json");
    fs.writeFileSync(filePath, JSON.stringify(detailedCommits, null, 2));

    console.log(`Saved ${detailedCommits.length} detailed commits to ${filePath}`);
  } catch (err) {
    console.error("Error fetching commits:", err.message);
  }
}

fetchCommits();
