import React, { useState } from "react";
import "./App.css";
import { Login } from "./components/login";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  return !isLoggedIn ? (
    <Login onLogin={() => setIsLoggedIn(true)} />
  ) : (
    <div className="App">
      <h1>Dashboard</h1>
      <button onClick={() => setIsLoggedIn(false)}>Logout</button>
    </div>
  );
}

export default App;

