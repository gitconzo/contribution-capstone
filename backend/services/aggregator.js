// backend/services/aggregator.js
// fetches team/student/rules data from the DB, loads all parsed artifacts,
// matches data to students, and produces a final ranked score for each student

const fs = require("fs");
const path = require("path");
const db = require("../utils/db");
const { safeReadJson } = require("../utils/fileUtils");
const { combineDocumentationMetrics } = require("./combineDocumentationMetrics");
const { buildAliasMap, matchStudentIndex } = require("./studentMatcher");
const { pickNumber, scoreStudents } = require("./scoring");
const { loadGitHubMetrics, loadParsedArtifacts, extractAttendanceMetrics, combineDocsInMemory } = require("./dataLoaders");

async function aggregateForTeam(team, rootDir) {
  const dataDir = path.join(rootDir, "data");
  const aliasMap = buildAliasMap(team);

  // Initialise a blank record for each student
  const students = team.students.map(student => ({
    id: student.email || student.name,
    name: student.name,
    email: student.email || null,
    github: student.github || null,
    code: { avgComplexity: 0, pctFunctions: 0, pctHotspots: 0, pctLOC: 0, commitPct: 0, editPct: 0 },
    attendance: { percentage: 0, meetings: 0, hours: 0 },
    docs: { docCount: 0, words: 0, sections: 0, avgSentenceLength: 0, sentenceComplexity: 0, readability: 0 },
    peer: { score: 0 },
  }));

  // Apply GitHub metrics — match each author to a student via the alias map
  const githubMetrics = loadGitHubMetrics(dataDir);
  Object.entries(githubMetrics).forEach(([author, metrics]) => {
    let studentIndex = matchStudentIndex(aliasMap, author);
    if (studentIndex === -1) studentIndex = matchStudentIndex(aliasMap, author.replace(/\s*\[bot\]\s*$/i, ""));
    if (studentIndex === -1) return;

    const codeData = students[studentIndex].code;
    codeData.avgComplexity = metrics.avgComplexity;
    codeData.pctFunctions += metrics.pctFunctions;
    codeData.pctHotspots += metrics.pctHotspots;
    codeData.pctLOC += metrics.pctLOC;
    codeData.commitPct += metrics.commitPct;
    codeData.editPct += metrics.editPct;
  });

  // Try to generate the local combined docs file if it doesn't exist (legacy fallback)
  const combinedDocsPath = path.join(rootDir, "data", "combined_documentation_metrics.json");
  if (!fs.existsSync(combinedDocsPath)) {
    try {
      combineDocumentationMetrics(rootDir);
    } catch (err) {
      console.warn("Could not generate combined_documentation_metrics.json:", err.message);
    }
  }

  // Load all parsed artifacts for this team from the database / S3
  const parsedArtifacts = await loadParsedArtifacts(rootDir, team.id);

  // Apply attendance metrics
  parsedArtifacts.attendance.forEach(attendanceJson => {
    const byStudent = extractAttendanceMetrics(attendanceJson);
    Object.entries(byStudent).forEach(([key, attendanceData]) => {
      const studentIndex = matchStudentIndex(aliasMap, key);
      if (studentIndex !== -1) {
        students[studentIndex].attendance.percentage = pickNumber(attendanceData.attendance);
        students[studentIndex].attendance.meetings = pickNumber(attendanceData.meetings);
        students[studentIndex].attendance.hours += pickNumber(attendanceData.hours);
      }
    });
  });

  // Combine doc metrics from S3-downloaded sprint/project data,
  // or fall back to the local combined file if no S3 data was loaded
  const combinedDocs = parsedArtifacts.sprint.length || parsedArtifacts.project.length
    ? combineDocsInMemory(parsedArtifacts.sprint, parsedArtifacts.project)
    : safeReadJson(combinedDocsPath, null);

  if (combinedDocs?.students) {
    Object.entries(combinedDocs.students).forEach(([studentName, data]) => {
      const studentIndex = matchStudentIndex(aliasMap, studentName);
      if (studentIndex !== -1 && data.combined) {
        students[studentIndex].docs.docCount = data.combined.total_docs || 0;
        students[studentIndex].docs.words = data.combined.total_word_count || 0;
        students[studentIndex].docs.sections = data.combined.total_sections || 0;
        students[studentIndex].docs.avgSentenceLength = data.combined.avg_sentence_length || 0;
        students[studentIndex].docs.sentenceComplexity = data.combined.sentence_complexity || 0;
        students[studentIndex].docs.readability = data.combined.readability_score || 0;
      }
    });
  }

  return students;
}

async function aggregateTeamScores({ teamId, rootDir }) {
  const teamResult = await db.query("SELECT * FROM teams WHERE id = $1", [teamId]);
  if (!teamResult.rows.length) throw new Error("Team not found");
  const team = teamResult.rows[0];

  const studentsResult = await db.query("SELECT * FROM students WHERE team_id = $1", [teamId]);
  team.students = studentsResult.rows;

  const rulesResult = await db.query(
    "SELECT name, weight, description FROM rules WHERE team_id = $1 ORDER BY id",
    [teamId]
  );
  const rules = rulesResult.rows.length
    ? { rules: rulesResult.rows.map(row => ({ name: row.name, value: row.weight, desc: row.description })) }
    : null;

  const students = await aggregateForTeam(team, rootDir);
  const scored = scoreStudents(students, rules);

  return {
    team: { id: team.id, name: team.name, repo_url: team.repo_url },
    ...scored,
  };
}

module.exports = { aggregateTeamScores };
