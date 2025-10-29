import React, { useState } from "react";
import Login from "./components/login";
import SetupTeam from "./components/setupteam";
import Navigation from "./components/navigation";
import ExportReport from "./components/exportreport";
import StudentDetails from "./components/studentdetails";
import Dashboard from "./components/dashboard";
import "./App.css";

function App() {
  const [currentPage, setCurrentPage] = useState("login");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogin = () => {
    setIsLoggedIn(true);
    setCurrentPage("dashboard");
  };

  const handleNavigate = (page) => {
    setCurrentPage(page);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentPage("login");
  };

  const renderPage = () => {
    if (!isLoggedIn) return <Login onLogin={handleLogin} />;

    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;
      case "setupteam":
        return <SetupTeam />;
      case "exportreport":
        return <ExportReport />;
      case "studentdetails":
        return <StudentDetails />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="App">
      {isLoggedIn && (
        <Navigation
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      )}
      <main>{renderPage()}</main>
    </div>
  );
}

export default App;

