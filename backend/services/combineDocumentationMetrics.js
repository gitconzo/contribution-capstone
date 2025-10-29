const fs = require("fs");
const path = require("path");

function safeReadJSON(p, fallback = null){
    try {
        if (!fs.existsSync(p)) return fallback;
        return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {
        return fallback;
    }
}

function combineDocumentationMetrics(rootDir){
    const dataDir = path.join(rootDir, "data");
    const registryPath = path.join(rootDir, "fileRegistry.json");

    const registry = safeReadJSON(registryPath, []);
    if (!registry.length) {
        console.warn("No registry entity found - cannot combine doc mentrics");
        return null;
    }

    const combined = [];

    registry.forEach(entry => {
    const type = entry.userType || entry.detectedType;
    if (!["worklog", "sprint_report", "project_plan"].includes(type)) return;

    const jsonPath = entry?.parseInfo?.jsonPath;
    if (!jsonPath) return;

    const abs = path.join(rootDir, jsonPath);
    const data = safeReadJSON(abs, null);
    if (!data) return;

    const students = data.students || data.contributors || {};
    Object.entries(students).forEach(([studentName, details]) => {
      if (!combined[studentName]) {
        combined[studentName] = {
          docs: {},
          totalWords: 0,
          totalDocs: 0,
          totalSections: 0,
          _accum: []
        };
      }

      // Merge metrics
      const docName = data.source_file || entry.originalName || entry.storedName;
      const metrics = details.metrics || details;

      combined[studentName].docs[docName] = {
        sections_written: details.sections_written || [],
        word_count: metrics.word_count || metrics.words || 0,
        avg_sentence_length: metrics.avg_sentence_length || 0,
        sentence_complexity: metrics.sentence_complexity || 0,
        readability_score: metrics.readability_score || 0
      };

      combined[studentName].totalDocs += 1;
      combined[studentName].totalWords += metrics.word_count || metrics.words || 0;
      combined[studentName].totalSections += (details.sections_written || []).length || 0;
      combined[studentName]._accum.push(metrics);
    });
  });

  // Finalize per-student combined metrics
  Object.entries(combined).forEach(([name, obj]) => {
    const accum = obj._accum;
    const avgSentenceLength =
      accum.length ? accum.reduce((s, m) => s + (m.avg_sentence_length || 0), 0) / accum.length : 0;
    const avgComplexity =
      accum.length ? accum.reduce((s, m) => s + (m.sentence_complexity || 0), 0) / accum.length : 0;
    const avgReadability =
      accum.length ? accum.reduce((s, m) => s + (m.readability_score || 0), 0) / accum.length : 0;

    obj.combined = {
      total_word_count: obj.totalWords,
      total_docs: obj.totalDocs,
      total_sections: obj.totalSections,
      avg_sentence_length: +avgSentenceLength.toFixed(2),
      sentence_complexity: +avgComplexity.toFixed(3),
      readability_score: +avgReadability.toFixed(2)
    };
    delete obj._accum;
  });

  const result = { students: combined };
  const outputPath = path.join(dataDir, "combined_documentation_metrics.json");

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`Combined documentation metrics written to ${outputPath}`);

  return result;
}

if (require.main === module) {
  combineDocumentationMetrics(path.join(__dirname, ".."));
}

module.exports = { combineDocumentationMetrics };