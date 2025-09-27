const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch"); // install: npm install node-fetch

// repo details
const owner = "gitconzo";
const repo = "contribution-capstone";

async function fetchCommits() {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits`;
  
  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        // if private repo: Authorization: `token YOUR_PERSONAL_ACCESS_TOKEN`
      },
    });

    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status}`);
    }

    const data = await res.json();

    const filePath = path.join(__dirname, "data", "commits.json");
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    console.log(`Saved ${data.length} commits to ${filePath}`);
  } catch (err) {
    console.error("Error fetching commits:", err.message);
  }
}

fetchCommits();
