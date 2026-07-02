// backend/utils/processUtils.js
// Helpers for spawning child processes — centralises pyBin() and promise-wrapped execFile.
const { execFile } = require("child_process");

// Interpreter to run parser scripts with. Override via PYTHON_BIN (e.g. on hosts
// where the deps live under a specific interpreter like "python3.11").
// Default: Windows uses "python", everything else uses "python3".
function pyBin() {
  return process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
}

// Runs an executable and returns a Promise resolving to { stdout, stderr }.
function runFile(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 100 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr && stderr.trim()) || err.message));
      resolve({ stdout, stderr });
    });
  });
}

// Convenience wrapper: runs a Python script using pyBin().
function runPython(scriptPath, args = [], opts = {}) {
  return runFile(pyBin(), [scriptPath, ...args], opts);
}

module.exports = { pyBin, runFile, runPython };
