import React, { useState } from "react";
import "./login.css"; 

export function Setupteam({ onSetupComplete }) {
  const [teamName, setTeamName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const [error, setError] = useState("");

  const canSave = teamName.trim() && projectCode.trim();

  function handleChooseFile(e) {
    const file = e.target.files?.[0];
    if (file && !file.name.toLowerCase().endsWith(".csv")) {
      setError("Please choose a .csv file.");
      setCsvFile(null);
      return;
    }
    setError("");
    setCsvFile(file || null);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSave) {
      setError("Please fill in Team Name and Project Code.");
      return;
    }

    // (Optional) Persist locally so Dashboard can use later
    localStorage.setItem(
      "teamInfo",
      JSON.stringify({
        teamName: teamName.trim(),
        projectCode: projectCode.trim(),
        repoUrl: repoUrl.trim(),
        csvFileName: csvFile?.name || null,
      })
    );

    setError("");
    onSetupComplete?.();
  }

  return (
    <div className="p17-page">
      {/* Header */}
      <header className="stp-header">
        <div className="stp-header-icon" aria-hidden>
          {/* people icon */}
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11Zm-8 0c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11Zm0 2c-2.67 0-8 1.34-8 4v1.5A1.5 1.5 0 0 0 1.5 20h13a1.5 1.5 0 0 0 1.5-1.5V17c0-2.66-5.33-4-8-4Zm8 0c-.46 0-.98.03-1.53.08 1.86.93 3.53 2.38 3.53 4.92v1.5c0 .18-.02.35-.06.5H22.5a1.5 1.5 0 0 0 1.5-1.5V17c0-2.66-5.33-4-8-4Z"/>
          </svg>
        </div>
        <h1 className="stp-title">Setup Teams and Connect Data Sources</h1>
        <p className="stp-subtitle">
          Configure your team project and connect external data sources
        </p>
        <span className="stp-divider" aria-hidden />
      </header>

      {/* Main Card */}
      <section className="stp-card">
        <div className="stp-card-head">
          <h2>Team Configuration</h2>
          <p>Enter your team details and connect to your project repository</p>
        </div>

        <form className="stp-form" onSubmit={handleSubmit}>
          {/* Team Name */}
          <div className="stp-field">
            <label className="stp-label">
              <span className="stp-ico" aria-hidden>
                {/* user group icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.2 0 4-2 4-4.5S14.2 3 12 3 8 5 8 7.5 9.8 12 12 12Zm0 2c-3.3 0-10 1.7-10 5v1.5c0 .8.7 1.5 1.5 1.5h17c.8 0 1.5-.7 1.5-1.5V19c0-3.3-6.7-5-10-5Z"/>
                </svg>
              </span>
              Team Name
            </label>
            <input
              className="stp-input"
              type="text"
              placeholder="e.g., Team P17"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
            <p className="stp-help">Enter a name to identify your team</p>
          </div>

          {/* Project Code */}
          <div className="stp-field">
            <label className="stp-label">
              <span className="stp-ico" aria-hidden>
                {/* document icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 2.5L18.5 9H14V4.5Z"/>
                </svg>
              </span>
              Project Code
            </label>
            <input
              className="stp-input"
              type="text"
              placeholder="e.g., COS40005"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
            />
            <p className="stp-help">Enter the course or project identifier</p>
          </div>

          {/* Repo URL (optional) */}
          <div className="stp-field">
            <label className="stp-label">
              <span className="stp-ico" aria-hidden>
                {/* link icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.9 12a4.1 4.1 0 0 1 4.1-4.1h3v2.2h-3a1.9 1.9 0 1 0 0 3.8h3v2.2h-3A4.1 4.1 0 0 1 3.9 12Zm6-1.9h4.2v3.8H9.9v-3.8ZM16 7.9h3a4.1 4.1 0 0 1 0 8.2h-3v-2.2h3a1.9 1.9 0 1 0 0-3.8h-3V7.9Z"/>
                </svg>
              </span>
              Repository URL
            </label>
            <input
              className="stp-input"
              type="url"
              placeholder="e.g., https://github.com/username/project"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
            <p className="stp-help">Optional: Link to your GitHub, GitLab, or Bitbucket repository</p>
          </div>

          {/* CSV Upload (optional) */}
          <div className="stp-field">
            <label className="stp-label">
              <span className="stp-ico" aria-hidden>
                {/* upload icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3l4 4h-3v6h-2V7H8l4-4Zm-7 14v2h14v-2H5Z"/>
                </svg>
              </span>
              Upload Student Data (CSV)
            </label>

            <div className="stp-upload">
              <label className="stp-upload-btn">
                <input type="file" accept=".csv" onChange={handleChooseFile} />
                <span className="stp-upload-ico" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3l4 4h-3v6h-2V7H8l4-4Zm-7 14v2h14v-2H5Z"/>
                  </svg>
                </span>
                Choose CSV File
              </label>
              {csvFile && <span className="stp-upload-name">{csvFile.name}</span>}
            </div>

            <p className="stp-help">Optional: Upload a CSV file with student names and email addresses</p>
          </div>

          {/* Error + Save */}
          {error && <div className="p17-error" style={{ marginTop: 8 }}>{error}</div>}

          <button type="submit" className={`stp-save ${!canSave ? "is-disabled" : ""}`} disabled={!canSave}>
            <span className="stp-save-ico" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9Zm-1-5.59-3.3-3.3 1.4-1.41 1.9 1.89 4.9-4.9 1.41 1.41L11 15.41Z"/>
              </svg>
            </span>
            Save Team
          </button>

          {!canSave && (
            <p className="stp-note">Please fill in the required fields (Team Name and Project Code) to continue</p>
          )}
        </form>
      </section>

      {/* Tips Card */}
      <section className="stp-tips">
        <span className="stp-divider" aria-hidden />
        <div className="stp-tips-card">
          <ul>
            <li>
              <span className="stp-tip-ico" aria-hidden>💡</span>
              You can add students manually later or import them from your uploaded CSV file.
            </li>
            <li>
              <span className="stp-tip-ico" aria-hidden>🔗</span>
              Connecting a repository URL allows automatic tracking of commits and contributions.
            </li>
            <li>
              <span className="stp-tip-ico" aria-hidden>📊</span>
              After setup, you can configure assessment rules and upload additional project data.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
