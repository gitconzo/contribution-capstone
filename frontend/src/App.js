import React, { useState } from "react";
import UploadFile from "./pages/UploadFile";
import RuleSettings from "./pages/RuleSettings";

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

          <button
            className={`tab ${activeTab === "rules" ? "active" : ""}`}
            onClick={() => setActiveTab("rules")}
          >
            Rule Settings
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === "upload" && <UploadFile />}

          {activeTab === "scores" && (
            <div style={{ marginTop: "2rem" }}>
              <h2>Scores (API Connected)</h2>
              <p>
                This section will show contribution scores calculated from
                Git/Docs/Attendance.
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

          {activeTab === "rules" && <RuleSettings />}
        </div>
      </header>
      
      <style>{`
        .tabs {
          display: flex;
          justify-content: center;
          margin: 20px 0;
        }
        .tab {
          background: #f3f3f3;
          border: 1px solid #ccc;
          padding: 10px 20px;
          margin: 0 5px;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s ease;
          font-weight: 500;
        }
        .tab:hover {
          background: #e5e5e5;
        }
        .tab.active {
          background: #000;
          color: #fff;
          border-color: #000;
        }
        .tab-content {
          background: #fff;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        .action-button {
          background: #000;
          color: #fff;
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          margin-top: 10px;
        }
        .action-button:hover {
          background: #333;
        }
      `}</style>
    </div>
  );
}

export default App;