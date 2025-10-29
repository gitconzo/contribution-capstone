// Combines GitHub + docs + attendance (+ peer review later) into per-student scores for a selected team.

const fs = require("fs");
const path = require("path");

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
  if (!values.length) return values;
  // If all equal or std=0, return 1s so nobody gets nuked
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance) || 1;
  const z = values.map(v => (v - mean) / std);
  const min = Math.min(...z);
  const max = Math.max(...z);
  if (max === min) return values.map(() => 1);
  return z.map(v => (v - min) / (max - min));
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
  return aliasMap.has(k) ? aliasMap.get(k) : -1;
}

// ---------- docs extractors (shape-aware but tolerant) ----------
// We expect your parsers to output a student keyed structure or an array with {name/email,...}.
function pickNumber(n, def = 0) {
  if (n === null || n === undefined) return def;
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

function extractAttendanceMetrics(json) {
  // Try common shapes:
  // { students: [{name,email,hours: 12,...}, ...] }  OR  { "Connor Lack": {hours: 15}, ...}
  const out = {};
  if (!json) return out;

  if (Array.isArray(json.students)) {
    json.students.forEach(s => {
      const key = s.email || s.name;
      if (!key) return;
      out[key] = { hours: pickNumber(s.hours), meetings: pickNumber(s.meetings) };
    });
  } else {
    Object.entries(json).forEach(([k, v]) => {
      if (v && typeof v === "object") {
        out[k] = { hours: pickNumber(v.hours), meetings: pickNumber(v.meetings) };
      }
    });
  }
  return out;
}

function extractDocsMetrics(json) {
  // Intended for sprint_report_summary.json / project_plan_summary.json / worklog output
  // We’ll look for per-student word counts, doc counts, etc.
  const out = {};
  if (!json) return out;

  const push = (key, part) => {
    if (!key) return;
    out[key] = out[key] || { docCount: 0, words: 0, sections: 0 };
    if (part.docCount) out[key].docCount += pickNumber(part.docCount);
    if (part.words) out[key].words += pickNumber(part.words);
    if (part.sections) out[key].sections += pickNumber(part.sections);
  };

  if (Array.isArray(json.students)) {
    json.students.forEach(s => push(s.email || s.name, s));
  } else if (json.contributors) {
    // { contributors: { "Connor": {words:1234, docCount: 2, ...}, ... } }
    Object.entries(json.contributors).forEach(([k, v]) => push(k, v));
  } else {
    // best effort: flatten top-level numbers if keyed by name
    Object.entries(json).forEach(([k, v]) => {
      if (v && typeof v === "object") push(k, v);
    });
  }
  return out;
}

// ---------- main aggregation ----------
function loadGitHubMetrics(dataDir) {
  // finalStats.json keyed by author
  const finalStats = safeReadJSON(path.join(dataDir, "finalStats.json"), {});
  // Normalize to a uniform author map
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
  // Use registry to know what was parsed & where JSONs live
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
    attendance: { hours: 0, meetings: 0 },
    docs: { docCount: 0, words: 0, sections: 0 },
    // peer review placeholder:
    peer: { score: 0 },
  }));

  // ---------- GitHub
  const gh = loadGitHubMetrics(dataDir);
  Object.entries(gh).forEach(([author, m]) => {
    // Try matching by author name, then by likely username (your parsers may store username elsewhere)
    let idx = matchStudentIndex(aliasMap, author);
    if (idx === -1) idx = matchStudentIndex(aliasMap, author.replace(/\s*\[bot\]\s*$/i, ""));
    if (idx === -1) return; // ignore non-team authors

    const c = students[idx].code;
    // average values: for multiple aliases we average by taking mean of contributors
    c.avgComplexity = (c.avgComplexity + m.avgComplexity) / (c.avgComplexity ? 2 : 1);
    c.pctFunctions += m.pctFunctions;
    c.pctHotspots += m.pctHotspots;
    c.pctLOC += m.pctLOC;
    c.commitPct += m.commitPct;
    c.editPct += m.editPct;
  });

  // ---------- Attendance / Docs
  const parsed = loadParsedArtifacts(rootDir);

  // Attendance
  parsed.attendance.forEach(js => {
    const byStudent = extractAttendanceMetrics(js);
    Object.entries(byStudent).forEach(([key, a]) => {
      const idx = matchStudentIndex(aliasMap, key);
      if (idx !== -1) {
        students[idx].attendance.hours += pickNumber(a.hours);
        students[idx].attendance.meetings += pickNumber(a.meetings);
      }
    });
  });

  // Documents (worklogs + sprint + project)
  [...parsed.worklog, ...parsed.sprint, ...parsed.project].forEach(js => {
    const byStudent = extractDocsMetrics(js);
    Object.entries(byStudent).forEach(([key, d]) => {
      const idx = matchStudentIndex(aliasMap, key);
      if (idx !== -1) {
        students[idx].docs.docCount += pickNumber(d.docCount, 1); // default 1 doc if omitted
        students[idx].docs.words += pickNumber(d.words);
        students[idx].docs.sections += pickNumber(d.sections);
      }
    });
  });

  return students;
}

// Compute normalized + weighted final
function scoreStudents(students, rules = null) {
  // Default weights (can be overwritten by per-team rules later)
  // Keep these aligned with your RuleSettings sliders (total 100)
  const defaultWeights = {
    codeCommits: 30,      // use commitPct + editPct
    worklogHours: 25,     // attendance.hours
    documentation: 20,    // docs.words + docs.docCount
    meetings: 15,         // attendance.meetings
    codeQuality: 10,      // avgComplexity + pctHotspots + pctFunctions + pctLOC
  };

  const w = rules || defaultWeights;

  // Build raw arrays for normalization
  const raw = students.map(s => ({
    codeCommits: pickNumber(s.code.commitPct) + pickNumber(s.code.editPct),
    worklogHours: pickNumber(s.attendance.hours),
    documentation: pickNumber(s.docs.words) + 200 * pickNumber(s.docs.docCount),
    meetings: pickNumber(s.attendance.meetings),
    codeQuality:
      pickNumber(s.code.avgComplexity) +
      pickNumber(s.code.pctHotspots) +
      pickNumber(s.code.pctFunctions) +
      pickNumber(s.code.pctLOC),
    // peer: to be integrated later, e.g., s.peer.score
  }));

  // Normalize each dimension
  const dims = Object.keys(raw[0] || {});
  const normVectors = {};
  dims.forEach(d => (normVectors[d] = normalize(raw.map(r => r[d]))));

  // Weighted sum (weights in %)
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
  // team.rules may store the exact sliders from RuleSettings; translate to our keys.
  // If you stored the same keys already, just return team.rules.
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
