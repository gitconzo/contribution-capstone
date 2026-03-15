// backend/routes/uploads/POST.js
const path = require("path");
const { execFile } = require("child_process");
const multer = require("multer");
const router = require("express").Router();
const { ROOT_DIR, UPLOAD_DIR, PARSED_DIR, REGISTRY_PATH } = require("../../utils/config");
const { readJson, writeJson } = require("../../utils/fileUtils");
const { pyBin } = require("../../utils/processUtils");
const { combineDocumentationMetrics } = require("../../services/combineDocumentationMetrics");

function loadRegistry() { return readJson(REGISTRY_PATH); }
function saveRegistry(data) { writeJson(REGISTRY_PATH, data); }

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `${base}__${ts}${ext}`);
  },
});
const upload = multer({ storage });

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
router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const registry = loadRegistry();
  const detectedType = detectTypeFromName(req.file.originalname, req.body?.userType || null);

  const entry = {
    id: path.basename(req.file.filename),
    originalName: req.file.originalname,
    storedName: req.file.filename,
    storedPath: path.join("uploads", req.file.filename),
    mimetype: req.file.mimetype,
    size: req.file.size,
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
router.post("/confirm", (req, res) => {
  const { id, type } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing id" });

  const registry = loadRegistry();
  const entry = registry.find(r => r.id === id);
  if (!entry) return res.status(404).json({ error: "Upload not found" });

  const finalType = type && type !== "unknown" ? type : (entry.detectedType || "unknown");
  entry.userType = finalType;
  entry.status = "confirmed";

  const absPath = path.join(ROOT_DIR, entry.storedPath);
  const ext = path.extname(absPath).toLowerCase();

  const finish = () => { saveRegistry(registry); res.json(entry); };

  const parsers = {
    attendance: {
      exts: [".xlsx", ".xls"],
      script: path.join(ROOT_DIR, "parsers", "attendance.py"),
      outPath: path.join(PARSED_DIR, "attendance.json"),
      label: "Attendance",
      combine: false,
    },
    worklog: {
      exts: [".docx", ".pdf"],
      script: path.join(ROOT_DIR, "parsers", "worklog_parser.py"),
      outPath: path.join(PARSED_DIR, "worklog.json"),
      label: "Worklog",
      combine: false,
    },
    sprint_report: {
      exts: [".docx"],
      script: path.join(ROOT_DIR, "parsers", "parse_sprint_report_docx.py"),
      outPath: path.join(PARSED_DIR, `sprint_report_${Date.now()}.json`),
      label: "Sprint report",
      combine: true,
    },
    project_plan: {
      exts: [".docx"],
      script: path.join(ROOT_DIR, "parsers", "parse_project_plan_docx.py"),
      outPath: path.join(PARSED_DIR, `project_plan_${Date.now()}.json`),
      label: "Project Plan",
      combine: true,
    },
  };

  const parser = parsers[finalType];
  if (parser && parser.exts.includes(ext)) {
    execFile(pyBin(), [parser.script, absPath, parser.outPath], { cwd: ROOT_DIR }, (err, stdout, stderr) => {
      if (err) {
        entry.status = "parse_failed";
        entry.parseInfo = { message: `${parser.label} parse failed: ${stderr || err.message}` };
      } else {
        entry.status = "parsed";
        entry.parseInfo = {
          jsonPath: path.relative(ROOT_DIR, parser.outPath),
          message: `${parser.label} parsed successfully`,
        };
        if (parser.combine) {
          try { combineDocumentationMetrics(ROOT_DIR); } catch (e) {
            console.error("Failed to combine documentation metrics:", e);
          }
        }
      }
      finish();
    });
    return;
  }

  entry.parseInfo = { message: "No parser run for this type." };
  finish();
});

module.exports = router;
