// backend/routes/uploads/POST.js
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const router = require("express").Router();
const { ROOT_DIR, PARSED_DIR, REGISTRY_PATH } = require("../../utils/config");
const { readJson, writeJson } = require("../../utils/fileUtils");
const { pyBin } = require("../../utils/processUtils");
const { combineDocumentationMetrics } = require("../../services/combineDocumentationMetrics");
const { downloadToFile, uploadFile } = require("../../utils/s3");

function loadRegistry() { return readJson(REGISTRY_PATH); }
function saveRegistry(data) { writeJson(REGISTRY_PATH, data); }

function detectTypeFromName(filename, userGuess) {
  if (userGuess && userGuess !== "unknown") return userGuess;
  const lower = (filename || "").toLowerCase();
  if (lower.includes("attendance")) return "attendance";
  if (lower.includes("worklog")) return "worklog";
  if (lower.includes("sprint")) return "sprint_report";
  if (lower.includes("peer")) return "peer_review";
  if (lower.includes("project") && lower.includes("plan")) return "project_plan";
  return "unknown";
}

// POST /api/uploads
// Called after the frontend has uploaded the file directly to S3 via presigned URL. --> Registers the upload in the local registry using the S3 key.
router.post("/", (req, res) => {
  const { s3Key, storedName, originalName, size, mimetype, teamId, userType } = req.body || {};
  if (!s3Key || !originalName) return res.status(400).json({ error: "Missing s3Key or originalName" });

  const registry = loadRegistry();
  const detectedType = detectTypeFromName(originalName, userType || null);

  const entry = {
    id: storedName || path.basename(s3Key),
    originalName,
    storedName: storedName || path.basename(s3Key),
    s3Key,
    teamId: teamId || null,
    mimetype: mimetype || null,
    size: size || null,
    uploadDate: new Date().toISOString(),
    detectedType,
    userType: null,
    status: "uploaded",
    parseInfo: null,
  };

  registry.push(entry);
  saveRegistry(registry);
  res.json(entry);
});

// POST /api/uploads/confirm
// Downloads the file from S3 to a temp path, runs the parser, uploads parsed JSON back to S3.
router.post("/confirm", async (req, res) => {
  const { id, type } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing id" });

  const registry = loadRegistry();
  const entry = registry.find(r => r.id === id);
  if (!entry) return res.status(404).json({ error: "Upload not found" });

  const finalType = type && type !== "unknown" ? type : (entry.detectedType || "unknown");
  entry.userType = finalType;
  entry.status = "confirmed";

  const ext = path.extname(entry.originalName).toLowerCase();
  const baseName = path.basename(entry.originalName, ext);
  const parsedName = `${baseName}-parsed.json`;
  const finish = () => { saveRegistry(registry); res.json(entry); };

  const parsers = {
    attendance: {
      exts: [".xlsx", ".xls"],
      script: path.join(ROOT_DIR, "parsers", "attendance.py"),
      outName: parsedName,
      label: "Attendance",
      combine: false,
    },
    worklog: {
      exts: [".docx", ".pdf"],
      script: path.join(ROOT_DIR, "parsers", "worklog_parser.py"),
      outName: parsedName,
      label: "Worklog",
      combine: false,
    },
    sprint_report: {
      exts: [".docx"],
      script: path.join(ROOT_DIR, "parsers", "parse_sprint_report_docx.py"),
      outName: parsedName,
      label: "Sprint report",
      combine: true,
    },
    project_plan: {
      exts: [".docx"],
      script: path.join(ROOT_DIR, "parsers", "parse_project_plan_docx.py"),
      outName: parsedName,
      label: "Project Plan",
      combine: true,
    },
    peer_review: { 
    exts: [".docx"],
    script: path.join(ROOT_DIR, "parsers", "parse_peer_review_docx.py"),
    outName: parsedName,
    label: "Peer Review",
    combine: false,
  },
  };

  const parser = parsers[finalType];
  if (!parser || !parser.exts.includes(ext)) {
    entry.parseInfo = { message: "No parser run for this type." };
    return finish();
  }

  try {
    // Download the file from S3 to a temp location for the parser
    const tempInput = path.join(os.tmpdir(), entry.storedName);
    const tempOutput = path.join(os.tmpdir(), parser.outName);
    await downloadToFile(entry.s3Key, tempInput);

    execFile(pyBin(), [parser.script, tempInput, tempOutput], { cwd: ROOT_DIR }, async (err, _stdout, stderr) => {
      if (err) {
        entry.status = "parse_failed";
        entry.parseInfo = { message: `${parser.label} parse failed: ${stderr || err.message}` };
        return finish();
      }

      // Upload parsed JSON to S3 under teamId/parsed/
      const teamId = entry.teamId || "unknown";
      const s3ParsedKey = `${teamId}/parsed/${parser.outName}`;
      try {
        await uploadFile(s3ParsedKey, tempOutput, "application/json");

        // Also copy to local PARSED_DIR so aggregator can still read it
        const fs = require("fs");
        fs.copyFileSync(tempOutput, path.join(PARSED_DIR, parser.outName));

        entry.status = "parsed";
        entry.parseInfo = {
          s3ParsedKey,
          jsonPath: path.relative(ROOT_DIR, path.join(PARSED_DIR, parser.outName)),
          message: `${parser.label} parsed successfully`,
        };

        if (parser.combine) {
          try { combineDocumentationMetrics(ROOT_DIR); } catch (e) {
            console.error("Failed to combine documentation metrics:", e);
          }
        }
      } catch (uploadErr) {
        console.error("Failed to upload parsed JSON to S3:", uploadErr);
        entry.status = "parse_failed";
        entry.parseInfo = { message: `Parse succeeded but S3 upload failed: ${uploadErr.message}` };
      }
      finish();
    });
  } catch (downloadErr) {
    console.error("Failed to download from S3 for parsing:", downloadErr);
    entry.status = "parse_failed";
    entry.parseInfo = { message: `Failed to download file from S3: ${downloadErr.message}` };
    finish();
  }
});

module.exports = router;
