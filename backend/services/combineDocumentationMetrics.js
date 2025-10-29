const fs = require("fs");
const path = require("path");

function safeReadJSON(p, fallback = null) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (e) {
    console.error(`Error reading JSON from ${p}:`, e.message);
    return fallback;
  }
}

function combineDocumentationMetrics(rootDir) {
  const dataDir = path.join(rootDir, "data");
  const registryPath = path.join(rootDir, "fileRegistry.json");
  
  console.log(`Looking for registry at: ${registryPath}`);
  const registry = safeReadJSON(registryPath, []);
  
  if (!registry.length) {
    console.warn("No registry entries found - cannot combine doc metrics");
    return null;
  }

  console.log(`Found ${registry.length} registry entries`);

  const combined = {};
  const processedFiles = new Set(); // Track which JSON files we've already processed
  
  registry.forEach((entry, idx) => {
    const type = entry.userType || entry.detectedType;
    console.log(`Entry ${idx}: type=${type}, status=${entry.status}`);
    
    // Only process parsed documentation files
    if (!["worklog", "sprint_report", "project_plan"].includes(type)) {
      return;
    }
    
    // Check if file was successfully parsed
    if (entry.status !== "parsed") {
      console.warn(`Skipping ${entry.originalName} - status is ${entry.status}`);
      return;
    }

    const jsonPath = entry?.parseInfo?.jsonPath;
    if (!jsonPath) {
      console.warn(`No jsonPath for ${entry.originalName}`);
      return;
    }

    // Skip if we've already processed this JSON file
    const normalizedJsonPath = jsonPath.replace(/\\/g, '/');
    if (processedFiles.has(normalizedJsonPath)) {
      console.log(`Already processed ${normalizedJsonPath}, skipping duplicate`);
      return;
    }
    processedFiles.add(normalizedJsonPath);

    const abs = path.join(rootDir, jsonPath);
    console.log(`Reading parsed data from: ${abs}`);
    
    const data = safeReadJSON(abs, null);
    if (!data) {
      console.warn(`Failed to read data from ${abs}`);
      return;
    }

    const students = data.students || data.contributors || {};
    console.log(`Found ${Object.keys(students).length} students in ${entry.originalName}`);

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

      // FIX: Strip timestamp from stored filename to get original filename
      // Format: "filename__timestamp.ext" -> "filename.ext"
      let docKey = data.source_file || entry.originalName || entry.storedName;
      
      // If using storedName (which has timestamp), strip it
      if (entry.storedName && entry.storedName.includes('__')) {
        const parts = entry.storedName.split('__');
        if (parts.length === 2) {
          const baseName = parts[0];
          const ext = path.extname(parts[1]);
          docKey = baseName + ext;
        }
      }
      
      const metrics = details.metrics || details;
      
      // Only add if this specific document hasn't been added for this student yet
      // Use docKey (original filename without timestamp) to prevent duplicates
      if (!combined[studentName].docs[docKey]) {
        combined[studentName].docs[docKey] = {
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
        
        console.log(`Added ${docKey} data for ${studentName}: ${metrics.word_count || 0} words`);
      } else {
        console.log(`Skipping duplicate document ${docKey} for ${studentName} (already processed)`);
      }
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
    delete obj.totalWords;
    delete obj.totalDocs;
    delete obj.totalSections;
  });

  const result = { students: combined };
  const outputPath = path.join(dataDir, "combined_documentation_metrics.json");
  
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`Combined documentation metrics written to ${outputPath}`);
  console.log(`Total students: ${Object.keys(combined).length}`);
  console.log(`Processed unique JSON files: ${processedFiles.size}`);
  
  return result;
}

if (require.main === module) {
  combineDocumentationMetrics(path.join(__dirname, ".."));
}

module.exports = { combineDocumentationMetrics };