// Combines GitHub + docs + attendance (+ peer review later) into per-student scores for a selected team.
const fs = require("fs");
const path = require("path");
const { combineDocumentationMetrics } = require("./combineDocumentationMetrics");

// ---------- helpers ----------
function safeReadJSON(p, fallback = null) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return fallback;
  }
}

function normalize(values) {
  const arr = Array.isArray(values) ? values : [];
  if (arr.length === 0) return [];

  const modifyStdDev = 2; // value used to multiply standard deviation

  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length;
  const standardDeviation = Math.sqrt(variance);

  if (!Number.isFinite(standardDeviation) || standardDeviation === 0) {
    return arr.map(() => 0.5);
  }

  const zScores = arr.map(v => modifyStdDev * ((v - mean) / standardDeviation));
  const min = Math.min(...zScores);
  const max = Math.max(...zScores);
  if (max === min) return zScores.map(() => 0.5);

  return zScores.map(v => (v - min) / (max - min));
}

// Try to match any author/email/alias to a student index
function buildAliasMap(team) {
  // students: [{ name, email, github?, aliases?:[] }]
  const map = new Map();
  team.students.forEach((s, idx) => {
    const variants = new Set([
      s.name,
      s.email,
      s.github,
      ...(s.aliases || []),
    ]
      .filter(Boolean)
      .map(x => String(x).toLowerCase().trim()));

    for (const k of variants) map.set(k, idx);
  });
  return map;
}

function matchStudentIndex(aliasMap, key) {
  if (!key) return -1;
  const k = String(key).toLowerCase().trim();
  // Try direct match
  if (aliasMap.has(k)) return aliasMap.get(k);
  
  // Try without (Leader) or other parenthetical
  const cleaned = k.replace(/\s*\(.*?\)\s*/g, '').trim();
  if (aliasMap.has(cleaned)) return aliasMap.get(cleaned);
  
  return -1;
}

// ---------- docs extractors (shape-aware but tolerant) ----------
function pickNumber(n, def = 0) {
  if (n === null || n === undefined) return def;
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

function extractAttendanceMetrics(json) {
  const out = {};
  if (!json) return out;

  // Extract from AttendanceSummary (contains percentage like 0.92, 0.83, etc.)
  if (json.AttendanceSummary && typeof json.AttendanceSummary === 'object') {
    Object.entries(json.AttendanceSummary).forEach(([name, percentage]) => {
      // Clean name (remove "(Leader)" etc)
      const cleanName = name.replace(/\s*\(.*?\)\s*/g, '').trim();
      out[cleanName] = { 
        attendance: pickNumber(percentage), // This is the 0.92 value
        hours: 0,
        meetings: 0
      };
    });
  }

  // Count meetings from WeeklyAttendance
  if (json.WeeklyAttendance && Array.isArray(json.WeeklyAttendance)) {
    const totalWeeks = json.WeeklyAttendance.length;
    const meetingCounts = {};
    
    json.WeeklyAttendance.forEach(week => {
      const absentees = new Set(
        (week.Absentees || []).map(n => n.replace(/\s*\(.*?\)\s*/g, '').trim())
      );
      
      // For each person in AttendanceSummary, check if they were absent
      if (json.AttendanceSummary) {
        Object.keys(json.AttendanceSummary).forEach(name => {
          const cleanName = name.replace(/\s*\(.*?\)\s*/g, '').trim();
          if (!meetingCounts[cleanName]) meetingCounts[cleanName] = 0;
          if (!absentees.has(cleanName) && !absentees.has(name)) {
            meetingCounts[cleanName]++;
          }
        });
      }
    });
    
    // Merge meeting counts into out
    Object.entries(meetingCounts).forEach(([name, count]) => {
      if (!out[name]) out[name] = { attendance: 0, hours: 0, meetings: 0 };
      out[name].meetings = count;
    });
  }

  return out;
}

// ---------- main aggregation ----------
function loadGitHubMetrics(dataDir) {
  const finalStats = safeReadJSON(path.join(dataDir, "finalStats.json"), {});
  const authors = {};
  Object.entries(finalStats).forEach(([author, s]) => {
    authors[author] = {
      avgComplexity: pickNumber(s.average_complexity),
      pctFunctions: pickNumber(s.percentage_of_functions_written),
      pctHotspots: pickNumber(s.percentage_of_hotspots),
      pctLOC: pickNumber(s.percentage_of_LOC),
      commits: pickNumber(s.commits),
      additions: pickNumber(s.additions),
      deletions: pickNumber(s.deletions),
      commitPct: pickNumber(s.commit_percentage),
      editPct: pickNumber(s.edit_percentage),
    };
  });
  return authors;
}

function loadParsedArtifacts(rootDir) {
  const registry = safeReadJSON(path.join(rootDir, "fileRegistry.json"), []);
  const results = { attendance: [], worklog: [], sprint: [], project: [] };
  registry.forEach(r => {
    const type = r.userType || r.detectedType || "unknown";
    const relJson = r?.parseInfo?.jsonPath;
    if (!relJson) return;
    const abs = path.join(rootDir, relJson);
    const data = safeReadJSON(abs, null);
    if (!data) return;
    if (type === "attendance") results.attendance.push(data);
    else if (type === "worklog") results.worklog.push(data);
    else if (type === "sprint_report") results.sprint.push(data);
    else if (type === "project_plan") results.project.push(data);
  });
  return results;
}

function aggregateForTeam(team, rootDir) {
  const dataDir = path.join(rootDir, "data");
  const aliasMap = buildAliasMap(team);
  const students = team.students.map(s => ({
    id: s.email || s.name,
    name: s.name,
    email: s.email || null,
    github: s.github || null,
    // raw aggregates:
    code: { avgComplexity: 0, pctFunctions: 0, pctHotspots: 0, pctLOC: 0, commitPct: 0, editPct: 0 },
    attendance: { percentage: 0, meetings: 0, hours: 0 },
    docs: { docCount: 0, words: 0, sections: 0, avgSentenceLength: 0, sentenceComplexity: 0, readability: 0 },
    peer: { score: 0 },
  }));

  // ---------- GitHub
  const gh = loadGitHubMetrics(dataDir);
  Object.entries(gh).forEach(([author, m]) => {
    let idx = matchStudentIndex(aliasMap, author);
    if (idx === -1) idx = matchStudentIndex(aliasMap, author.replace(/\s*\[bot\]\s*$/i, ""));
    if (idx === -1) return;

    const c = students[idx].code;
    c.avgComplexity = m.avgComplexity;
    c.pctFunctions += m.pctFunctions;
    c.pctHotspots += m.pctHotspots;
    c.pctLOC += m.pctLOC;
    c.commitPct += m.commitPct;
    c.editPct += m.editPct;
  });

  const combinedDocsPath = path.join(rootDir, "data", "combined_documentation_metrics.json");
  if (!fs.existsSync(combinedDocsPath)) {
    console.log("no combined_documentation_metrics.json found");
    try {
      combineDocumentationMetrics(rootDir);
    } catch (e) {
      console.warn("failed to generate json", e.message);
    }
  }

  // ---------- Attendance
  const parsed = loadParsedArtifacts(rootDir);
  parsed.attendance.forEach(js => {
    const byStudent = extractAttendanceMetrics(js);
    Object.entries(byStudent).forEach(([key, a]) => {
      const idx = matchStudentIndex(aliasMap, key);
      if (idx !== -1) {
        students[idx].attendance.percentage = pickNumber(a.attendance);
        students[idx].attendance.meetings = pickNumber(a.meetings);
        students[idx].attendance.hours += pickNumber(a.hours);
      }
    });
  });

  // ---------- Documentation from combined metrics
  const combinedDocs = safeReadJSON(combinedDocsPath, null);
  if (combinedDocs?.students) {
    Object.entries(combinedDocs.students).forEach(([name, data]) => {
      const idx = matchStudentIndex(aliasMap, name);
      if (idx !== -1 && data.combined) {
        students[idx].docs.docCount = data.combined.total_docs || 0;
        students[idx].docs.words = data.combined.total_word_count || 0;
        students[idx].docs.sections = data.combined.total_sections || 0;
        students[idx].docs.avgSentenceLength = data.combined.avg_sentence_length || 0;
        students[idx].docs.sentenceComplexity = data.combined.sentence_complexity || 0;
        students[idx].docs.readability = data.combined.readability_score || 0;
      }
    });
  }

  return students;
}

function mapRulesIfArray(rulesObj) {
  const arr = rulesObj && Array.isArray(rulesObj.rules) ? rulesObj.rules : null;
  if (!arr) return null;

  const byName = Object.fromEntries(
    arr.map(r => [String(r.name || "").trim().toLowerCase(), Number(r.value || 0)])
  );
  const v = n => byName[n.toLowerCase()] || 0;

  return {
    loc: v("Total Lines of Code"),
    editedCode: v("Total Edited Code"),
    commits: v("Total Commits"),
    functions: v("Total Functions Written"),
    hotspots: v("Total Hotspot Contributed"),
    codeComplexity: v("Code Complexity"),
    avgSentenceLength: v("Average Sentence Length"),
    sentenceComplexity: v("Sentence Complexity"),
    wordCount: v("Word Count"),
    readability: v("Readability"),
  };
}

// Compute normalized + weighted final
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

  const w = mapRulesIfArray(rules) || rules || defaultWeights;
  const dims = Object.keys(w);

  const raw = students.map(s => {
    const r = {};
    dims.forEach(d => {
      switch (d) {
        case "loc": r[d] = pickNumber(s.code.pctLOC); break;
        case "editedCode": r[d] = pickNumber(s.code.editPct); break;
        case "commits": r[d] = pickNumber(s.code.commitPct); break;
        case "functions": r[d] = pickNumber(s.code.pctFunctions); break;
        case "hotspots": r[d] = pickNumber(s.code.pctHotspots); break;
        case "codeComplexity": r[d] = pickNumber(s.code.avgComplexity); break;
        case "avgSentenceLength": r[d] = pickNumber(s.docs.avgSentenceLength); break;
        case "sentenceComplexity": r[d] = pickNumber(s.docs.sentenceComplexity); break;
        case "wordCount": r[d] = pickNumber(s.docs.words); break;
        case "readability": r[d] = pickNumber(s.docs.readability); break;
        default: r[d] = 0;
      }
    });
    
    // Add attendance percentage to raw (for display)
    r.attendance = pickNumber(s.attendance.percentage);
    r.meetings = pickNumber(s.attendance.meetings);
    r.hours = pickNumber(s.attendance.hours);
    
    return r;
  });

  const normVectors = {};
  dims.forEach(d => (normVectors[d] = normalize(raw.map(r => r[d]))));

  const totals = students.map((_, i) =>
    dims.reduce((sum, d) => sum + (normVectors[d][i] || 0) * (w[d] || 0), 0)
  );
  const maxTotal = Math.max(...totals, 1);
  const percent = totals.map(t => +(100 * (t / maxTotal)).toFixed(2));

  const ranked = students
    .map((s, i) => ({
      name: s.name,
      email: s.email,
      github: s.github,
      breakdown: Object.fromEntries(dims.map(d => [d, +(normVectors[d][i] || 0).toFixed(4)])),
      score: percent[i],
      raw: raw[i],
    }))
    .sort((a, b) => b.score - a.score)
    .map((r, idx) => ({ rank: idx + 1, ...r }));

  return { ranking: ranked, weights: w, dims, studentsCount: students.length };
}

function loadTeamRulesIfAny(team) {
  return team.rules || null;
}

function aggregateTeamScores({ teamId, rootDir }) {
  const teamsPath = path.join(rootDir, "data", "teams.json");
  const teams = safeReadJSON(teamsPath, []);
  const team = teams.find(t => t.id === teamId);
  if (!team) throw new Error("Team not found");

  const students = aggregateForTeam(team, rootDir);
  const rules = loadTeamRulesIfAny(team);
  const scored = scoreStudents(students, rules);

  return {
    team: { id: team.id, name: team.name, code: team.code, repo: team.repo },
    ...scored,
  };
}

module.exports = { aggregateTeamScores };