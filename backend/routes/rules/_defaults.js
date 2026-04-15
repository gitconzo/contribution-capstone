// backend/routes/rules/_defaults.js
// Shared constants and helpers used by both get.js and post.js.

const DEFAULT_RULES = {
  rules: [
    { name: "Total Lines of Code",        value: 14, desc: "Percentage of code written in code base" },
    { name: "Total Edited Code",           value: 11, desc: "Percentage of total edited code (additions and deletions)" },
    { name: "Total Commits",               value:  8, desc: "Percentage of commits made" },
    { name: "Total Functions Written",     value: 14, desc: "Percentage of functions written in codebase" },
    { name: "Total Hotspot Contributed",   value: 11, desc: "Percentage of hotspots written in codebase (hotspots = above average function complexity)" },
    { name: "Code Complexity",             value: 10, desc: "Average code complexity" },
    { name: "Average Sentence Length",     value:  6, desc: "Average sentence length" },
    { name: "Sentence Complexity",         value:  6, desc: "Sentence complexity" },
    { name: "Word Count",                  value:  8, desc: "Word Count" },
    { name: "Readability",                 value: 12, desc: "Readability" },
  ],
  autoRecalc: true,
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
