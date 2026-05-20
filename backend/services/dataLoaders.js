// backend/services/dataLoaders.js
// Loads data from S3, the database, and local files + shapes it into the format the aggregator expects

const path = require("path");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { s3 } = require("../utils/s3");
const { safeReadJson } = require("../utils/fileUtils");
const db = require("../utils/db");
const { pickNumber } = require("./scoring");

// Downloads a JSON file from S3 and parses it
// Streams the response body in chunks to avoid loading the entire file into memory at once
async function downloadJsonFromS3(key) {
  const command = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key });
  const response = await s3.send(command);

  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf-8");
  return JSON.parse(text);
}

// Returns the average of a specific field across an array of metric objects
function averageField(metricsArray, fieldName) {
  if (!metricsArray.length) return 0;
  let total = 0;
  for (const metric of metricsArray) {
    total += metric[fieldName] || 0;
  }
  return total / metricsArray.length;
}

// Combines sprint and project plan parsed JSONs into per-student doc metrics in memory
// Avoids needing to write or read from a local combined_documentation_metrics.json file
function combineDocsInMemory(sprintData, projectData) {
  const combinedByStudent = {};
  const allDocs = [...sprintData, ...projectData];

  // First pass: accumulate raw totals per student across all documents
  for (const docData of allDocs) {
    const studentsInDoc = docData.students || docData.contributors || {};

    for (const [studentName, details] of Object.entries(studentsInDoc)) {
      if (!combinedByStudent[studentName]) {
        combinedByStudent[studentName] = {
          metricsAccum: [],
          totalDocs: 0,
          totalWordCount: 0,
          totalSections: 0,
        };
      }

      const metrics = details.metrics || details;
      const wordCount = metrics.word_count || metrics.words || 0;
      const sectionCount = (details.sections_written || []).length || 0;

      combinedByStudent[studentName].metricsAccum.push(metrics);
      combinedByStudent[studentName].totalDocs += 1;
      combinedByStudent[studentName].totalWordCount += wordCount;
      combinedByStudent[studentName].totalSections += sectionCount;
    }
  }

  // Second pass: compute averages and build the final output shape
  const students = {};
  for (const [studentName, studentData] of Object.entries(combinedByStudent)) {
    const metricsAccum = studentData.metricsAccum;

    students[studentName] = {
      combined: {
        total_word_count: studentData.totalWordCount,
        total_docs: studentData.totalDocs,
        total_sections: studentData.totalSections,
        avg_sentence_length: +averageField(metricsAccum, "avg_sentence_length").toFixed(2),
        sentence_complexity: +averageField(metricsAccum, "sentence_complexity").toFixed(3),
        readability_score: +averageField(metricsAccum, "readability_score").toFixed(2),
      }
    };
  }

  return { students };
}

// Queries the database for all parsed files belonging to the team
// Downloads each parsed JSON from S3, falling back to local file path if S3 fails
async function loadParsedArtifacts(rootDir, teamId) {
  const results = { attendance: [], worklog: [], sprint: [], project: [] };

  const queryResult = await db.query(
    `SELECT * FROM file_registry
     WHERE status = 'parsed'
     AND ($1::text IS NULL OR team_id = $1)`,
    [teamId || null]
  );

  const entries = queryResult.rows.map(row => ({
    userType: row.user_type,
    detectedType: row.detected_type,
    parseInfo: {
      s3ParsedKey: row.s3_parsed_key,
      jsonPath: row.json_path,
    },
  }));

  for (const entry of entries) {
    const type = entry.userType || entry.detectedType || "unknown";
    let parsedData = null;

    // Prefer S3 — if the file was uploaded via S3, download the parsed JSON from there
    if (entry.parseInfo?.s3ParsedKey) {
      try {
        parsedData = await downloadJsonFromS3(entry.parseInfo.s3ParsedKey);
      } catch (downloadError) {
        console.warn(`S3 download failed for ${entry.parseInfo.s3ParsedKey}:`, downloadError.message);
      }
    }

    // Fall back to reading the local file if S3 failed or this is an older entry without an S3 key
    if (!parsedData && entry.parseInfo?.jsonPath) {
      parsedData = safeReadJson(path.join(rootDir, entry.parseInfo.jsonPath), null);
    }

    if (!parsedData) continue;

    if (type === "attendance")   results.attendance.push(parsedData);
    else if (type === "worklog")       results.worklog.push(parsedData);
    else if (type === "sprint_report") results.sprint.push(parsedData);
    else if (type === "project_plan")  results.project.push(parsedData);
  }

  return results;
}

// Extracts per-student attendance percentage and meeting counts from a parsed attendance JSON
function extractAttendanceMetrics(attendanceJson) {
  const result = {};
  if (!attendanceJson) return result;

  if (attendanceJson.AttendanceSummary && typeof attendanceJson.AttendanceSummary === "object") {
    Object.entries(attendanceJson.AttendanceSummary).forEach(([name, percentage]) => {
      const cleanName = name.replace(/\s*\(.*?\)\s*/g, "").trim();
      result[cleanName] = { attendance: pickNumber(percentage), hours: 0, meetings: 0 };
    });
  }

  if (attendanceJson.WeeklyAttendance && Array.isArray(attendanceJson.WeeklyAttendance)) {
    const meetingCounts = {};

    attendanceJson.WeeklyAttendance.forEach(week => {
      const absentees = new Set(
        (week.Absentees || []).map(name => name.replace(/\s*\(.*?\)\s*/g, "").trim())
      );

      if (attendanceJson.AttendanceSummary) {
        Object.keys(attendanceJson.AttendanceSummary).forEach(name => {
          const cleanName = name.replace(/\s*\(.*?\)\s*/g, "").trim();
          if (!meetingCounts[cleanName]) meetingCounts[cleanName] = 0;
          if (!absentees.has(cleanName) && !absentees.has(name)) {
            meetingCounts[cleanName]++;
          }
        });
      }
    });

    Object.entries(meetingCounts).forEach(([name, count]) => {
      if (!result[name]) result[name] = { attendance: 0, hours: 0, meetings: 0 };
      result[name].meetings = count;
    });
  }

  return result;
}

module.exports = {
  downloadJsonFromS3,
  loadParsedArtifacts,
  extractAttendanceMetrics,
  combineDocsInMemory,
};
