import React, { useState } from "react";

function App() {
  const [scores, setScores] = useState(null);

  const fetchScores = () => {
    fetch("http://localhost:5002/api/scores")
      .then((res) => res.json())
      .then((data) => setScores(data))
      .catch((err) => console.error("Error fetching scores:", err));
  };

  return (
    <div style={{ textAlign: "center", marginTop: "2rem" }}>
      <h1>React + Node.js Contribution Scores</h1>
      <button onClick={fetchScores}>Get Contribution Scores</button>

      {scores && (
        <div style={{ marginTop: "1rem" }}>
          <h2>Scores:</h2>
          <ul>
            {Object.entries(scores).map(([author, score]) => (
              <li key={author}>
                {author}: {score}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
