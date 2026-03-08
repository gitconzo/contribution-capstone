// backend/routes/rules/_defaults.js
// Shared constants and helpers used by both get.js and post.js.

const DEFAULT_RULES = {
  rules: [
    { name: "Total Lines of Code",        value: 12, desc: "Percentage of code written in code base" },
    { name: "Total Edited Code",           value: 10, desc: "Percentage of total edited code (additions and deletions)" },
    { name: "Total Commits",               value:  7, desc: "Percentage of commits made" },
    { name: "Total Functions Written",     value: 12, desc: "Percentage of functions written in codebase" },
    { name: "Total Hotspot Contributed",   value: 10, desc: "Percentage of hotspots written in codebase (hotspots = above average function complexity)" },
    { name: "Code Complexity",             value:  9, desc: "Average code complexity" },
    { name: "Average Sentence Length",     value:  5, desc: "Average sentence length" },
    { name: "Sentence Complexity",         value:  5, desc: "Sentence complexity" },
    { name: "Word Count",                  value:  7, desc: "Word Count" },
    { name: "Readability",                 value: 11, desc: "Readability" },
  ],
  autoRecalc: true,
  crossVerify: true,
  triangulation: { codeWorklog: 80, meetingDoc: 70, activityDist: 60 },
  peerValidation: "Statistical analysis",
};

function weightsFromRules(ruleArr) {
  if (!Array.isArray(ruleArr)) return null;
  const weights = {};
  ruleArr.forEach(r => {
    weights[r.name.trim().toLowerCase()] = Number(r.value || 0);
  });
  return weights;
}

module.exports = { DEFAULT_RULES, weightsFromRules };
