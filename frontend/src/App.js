import React, { useState } from "react";
import UploadFile from "./pages/UploadFile";

function App() {
  const [activeTab, setActiveTab] = useState("upload");

  return (
    <div className="App">
      <header className="App-header">
        <h1>Contribution Analysis Prototype</h1>

        {/* Navigation Tabs */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === "upload" ? "active" : ""}`}
            onClick={() => setActiveTab("upload")}
          >
            Upload Files
          </button>
          <button
            className={`tab ${activeTab === "scores" ? "active" : ""}`}
            onClick={() => setActiveTab("scores")}
          >
            Contribution Scores
          </button>
        </div>

        <div className="tab-content">
          {activeTab === "upload" && <UploadFile />}

          {activeTab === "scores" && (
            <div style={{ marginTop: "2rem" }}>
              <h2>Scores (API Connected)</h2>
              <p>
                This section will show contribution scores calculated from Git/
                Docs/Attendance.
              </p>
              <button
                onClick={() =>
                  window.open("http://localhost:5002/api/scores", "_blank")
                }
                className="action-button"
              >
                View Live Scores JSON
              </button>
            </div>
          )}
        </div>
      </header>
    </div>
  );
}

export default App;
