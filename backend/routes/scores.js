// routes/scores.js
const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// Contribution scores endpoint - calculates and returns contribution score
router.get("/scores", (req, res) => {
  // looks for commit data in local file
  const filePath = path.join(__dirname, "..", "data", "finalStats.json");
  
  if (!fs.existsSync(filePath)) {
    // Error if data cant be fetched
    return res.status(404).json({ error: "No commit data found. Run fetchData.js first." });
  }

  // load data
  const commits = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  //function that doubles the standard deviation for normalising data
  function normalize(values){
    modifyStdDev = 2 //value used to multiply standard deviation

    const mean = values.reduce((a, b) => a + b, 0)/ values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0)/ values.length;
    const standardDeviation = Math.sqrt(variance);
    const zScores = values.map(v => modifyStdDev * ((v - mean)/standardDeviation));
    const min = Math.min(...zScores);
    const max = Math.max(...zScores);

    return zScores.map(v => (v-min)/(max-min));
    
  }

  // Aggregate raw metrics per author
  // creation of rawScores dictionary
  const rawScores = {};
  Object.entries(commits).forEach(([authorName, stats]) => {
    // if name is missing "unknown" is given
    const author = authorName || "Unknown";
    if (!rawScores[author]) {
      rawScores[author] = { complexity : 0, functions: 0, hotspots: 0, loc: 0, commits: 0, edits: 0 }; //add missing metrics once completed ****
    }

    //Code metrics
    rawScores[author].complexity += stats.average_complexity || 0;
    rawScores[author].functions += stats.percentage_of_functions_written || 0;
    rawScores[author].hotspotsP += stats.percentage_of_hotspots || 0;
    rawScores[author].locP += stats.percentage_of_LOC || 0;
    rawScores[author].commitsP += stats.commit_percentage || 0;
    rawScores[author].editsP += stats.edit_percentage || 0;

    //Missing Metrics (have yet to be added)
    //rawScores[author].sentenceLength += stats.ave_sentence_length || 0;
    //rawScores[author].sentenceComplexity += stats.sentence_complexity || 0;
    //rawScores[author].wordcount += stats.wordcount || 0;
    //rawScores[author].readability += stats.readability || 0;
  });

  // Normalize each metric from all authors
  const authors = Object.keys(rawScores); // e.g., ["Connor", "Jason", "Jen"]

  const normComplexity = normalize(authors.map(a => rawScores[a].complexity));
  const normFunctions = normalize(authors.map(a => rawScores[a].functions));
  const normHotspots = normalize(authors.map(a => rawScores[a].hotspots));
  const normLOC = normalize(authors.map(a => rawScores[a].loc));
  const normCommits = normalize(authors.map(a => rawScores[a].commits));
  const normEdits = normalize(authors.map(a => rawScores[a].edits));

  //const normSenLength = normalize(authors.map(a => rawScores[a].sentenceLength));
  //const normSenComplexity = normalize(authors.map(a => rawScores[a].sentenceComplexity));
  //const normWordcount = normalize(authors.map(a => rawScores[a].wordcount));
  //const normReadability = normalize(authors.map(a => rawScores[a].readability));

  // Weighted sum
  const weights = { complexity: 0.09, loc: 0.12, edit: 0.1, commits: 0.07, functions: 0.12, hotspots: 0.1 }; //add missing metrics once completed ****

  const codeScores = {};
  //const docScores = {};
  const finalScores = {}
  authors.forEach((author, i) => {
    codeScores[author] =
      normComplexity[i] * weights.complexity +
      normFunctions[i] * weights.functions +
      normHotspots[i] * weights.hotspots +
      normLOC[i] * weights.loc +
      normCommits[i] * weights.commits +
      normEdits[i] * weights.edits;
    
    //docScores[author] =
    //  normComplexity[i] * weights.complexity +
    //  normFunctions[i] * weights.functions +
    //  normHotspots[i] * weights.hotspots +
    //  normLOC[i] * weights.loc +
    //  normCommits[i] * weights.commits +
    //  normEdits[i] * weights.edits;

    finalScores[author] = codeScores[author] + docScores[author]
  });
  
  //const codeScore 

  //const docScore

  // both raw and normalized scores are sent back to frontend
  res.json({ raw: rawScores, scores: finalScores });
});

module.exports = router;