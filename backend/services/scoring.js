// backend/services/scoring.js
// Normalises raw per-student metrics & applies rule weights for final ranked score

// Safely converts a value to a number, returning the default if it's not a valid number
function pickNumber(value, defaultValue = 0) {
  if (value === null || value === undefined) return defaultValue;
  const number = Number(value);
  return Number.isFinite(number) ? number : defaultValue;
}

// Normalises an array of values using z-scores so students are ranked relative to each other
// Returns values scaled between 0 and 1
function normalize(values) {
  const arr = Array.isArray(values) ? values : [];
  if (arr.length === 0) return [];

  const stdDevMultiplier = 2;

  const mean = arr.reduce((sum, value) => sum + value, 0) / arr.length;
  const variance = arr.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / arr.length;
  const standardDeviation = Math.sqrt(variance);

  if (!Number.isFinite(standardDeviation) || standardDeviation === 0) {
    // If all values are zero there is no data — return zeros, not 0.5
    return arr.map(() => (mean === 0 ? 0 : 0.5));
  }

  const zScores = arr.map(value => stdDevMultiplier * ((value - mean) / standardDeviation));
  const min = Math.min(...zScores);
  const max = Math.max(...zScores);

  if (max === min) return zScores.map(() => 0.5);

  return zScores.map(zScore => (zScore - min) / (max - min));
}

// Converts the rules array format into a flat weights object keyed by metric name
function mapRulesIfArray(rulesObj) {
  const arr = rulesObj && Array.isArray(rulesObj.rules) ? rulesObj.rules : null;
  if (!arr) return null;

  const byName = Object.fromEntries(
    arr.map(rule => [String(rule.name || "").trim().toLowerCase(), Number(rule.value || 0)])
  );

  const getValue = name => byName[name.toLowerCase()] || 0;

  return {
    loc: getValue("Total Lines of Code"),
    editedCode: getValue("Total Edited Code"),
    commits: getValue("Total Commits"),
    functions: getValue("Total Functions Written"),
    hotspots: getValue("Total Hotspot Contributed"),
    codeComplexity: getValue("Code Complexity"),
    avgSentenceLength: getValue("Average Sentence Length"),
    sentenceComplexity: getValue("Sentence Complexity"),
    wordCount: getValue("Word Count"),
    readability: getValue("Readability"),
  };
}

// Takes the raw per-student data, normalises each metric, applies weights, and returns a ranked list
function scoreStudents(students, rules = null) {
  const defaultWeights = {
    loc: 12,
    editedCode: 10,
    commits: 7,
    functions: 12,
    hotspots: 10,
    codeComplexity: 9,
    avgSentenceLength: 5,
    sentenceComplexity: 5,
    wordCount: 7,
    readability: 11,
  };

  const weights = mapRulesIfArray(rules) || rules || defaultWeights;
  const dimensions = Object.keys(weights);

  // Build a raw score object for each student across all dimensions
  const rawScores = students.map(student => {
    const scores = {};
    dimensions.forEach(dimension => {
      switch (dimension) {
        case "loc":                scores[dimension] = pickNumber(student.code.pctLOC); break;
        case "editedCode":         scores[dimension] = pickNumber(student.code.editPct); break;
        case "commits":            scores[dimension] = pickNumber(student.code.commitPct); break;
        case "functions":          scores[dimension] = pickNumber(student.code.pctFunctions); break;
        case "hotspots":           scores[dimension] = pickNumber(student.code.pctHotspots); break;
        case "codeComplexity":     scores[dimension] = pickNumber(student.code.avgComplexity); break;
        case "avgSentenceLength":  scores[dimension] = pickNumber(student.docs.avgSentenceLength); break;
        case "sentenceComplexity": scores[dimension] = pickNumber(student.docs.sentenceComplexity); break;
        case "wordCount":          scores[dimension] = pickNumber(student.docs.words); break;
        case "readability":        scores[dimension] = pickNumber(student.docs.readability); break;
        default:                   scores[dimension] = 0;
      }
    });

    // Include attendance in raw for display purposes (not used in weighted score)
    scores.attendance = pickNumber(student.attendance.percentage);
    scores.meetings = pickNumber(student.attendance.meetings);
    scores.hours = pickNumber(student.attendance.hours);

    return scores;
  });

  // proportion of team total for every metric
  const normalisedVectors = {};
  dimensions.forEach(dimension => {
    const values = rawScores.map(score => score[dimension]);
    const teamTotal = values.reduce((sum, v) => sum + v, 0);
    normalisedVectors[dimension] = teamTotal === 0
      ? values.map(() => 1 / students.length)
      : values.map(v => v / teamTotal);
  });

  // Compute weighted total for each student
  const weightedTotals = students.map((_, index) =>
    dimensions.reduce((sum, dimension) => sum + (normalisedVectors[dimension][index] || 0) * (weights[dimension] || 0), 0)
  );

  // proportion of team total for every metric
  const teamTotal = weightedTotals.reduce((sum, t) => sum + t, 0);
  const percentages = teamTotal === 0
    ? weightedTotals.map(() => +(100 / students.length).toFixed(2))
    : weightedTotals.map(total => +(100 * (total / teamTotal)).toFixed(2));

  const ranked = students
    .map((student, index) => ({
      name: student.name,
      email: student.email,
      github: student.github,
      breakdown: Object.fromEntries(dimensions.map(dimension => [dimension, +(normalisedVectors[dimension][index] || 0).toFixed(4)])),
      score: percentages[index],
      raw: rawScores[index],
      expectedShare: +(100 / students.length).toFixed(2)
    }))
    .sort((first, second) => second.score - first.score)
    .map((result, index) => ({ rank: index + 1, ...result }));

  return { ranking: ranked, weights, dims: dimensions, studentsCount: students.length };
}

module.exports = { pickNumber, normalize, scoreStudents };
