import React, { useEffect, useState } from "react";

function App() {
  const [backendMessage, setBackendMessage] = useState("Loading...");

  useEffect(() => {
    fetch("http://localhost:5002/api/hello")
      .then((res) => res.json())
      .then((data) => setBackendMessage(data.message))
      .catch((err) => setBackendMessage("Error connecting to backend"));
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "2rem" }}>
      <h1>React + Node.js Test</h1>
      <p>Backend says: {backendMessage}</p>
    </div>
  );
}

export default App;
