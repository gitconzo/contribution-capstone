// frontend/src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";

import Navigation from "./components/Navigation";
import Dashboard from "./pages/Dashboard";
import UploadFile from "./pages/UploadFile";
import RuleSettings from "./pages/RuleSettings";
import StudentDetail from "./pages/StudentDetail";
import SetupTeam from "./pages/SetupTeam";
import { Login } from "./pages/Login";
import ExportReport from "./pages/ExportReport";

function Shell() {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [authed, setAuthed] = useState(() => {
    return localStorage.getItem("p17_authed") === "1";
  });

  const [dark, setDark] = useState(() => {
    return localStorage.getItem("p17_dark") === "1";
  });

  const nav = useNavigate();
  const { pathname } = useLocation();

  const current = useMemo(() => {
    if (pathname === "/") return "dashboard";
    if (pathname.startsWith("/rules")) return "rules";
    if (pathname.startsWith("/upload")) return "upload";
    if (pathname.startsWith("/setup-team")) return "setup-team";
    if (pathname.startsWith("/export")) return "export";
    return "";
  }, [pathname]);

  const goto = (key) => {
    if (key === "dashboard") nav("/");
    else if (key === "rules") nav("/rules");
    else if (key === "upload") nav("/upload");
    else if (key === "setup-team") nav("/setup-team");
    else if (key === "export") nav("/export");
  };

  useEffect(() => {
    const cl = document.body.classList;

    if (dark) {
      cl.add("p17-dark");
      localStorage.setItem("p17_dark", "1");
    } else {
      cl.remove("p17-dark");
      localStorage.setItem("p17_dark", "0");
    }
  }, [dark]);

  const handleLogin = () => {
    setAuthed(true);
    localStorage.setItem("p17_authed", "1");
    nav("/");
  };

  const handleLogout = () => {
    setAuthed(false);
    localStorage.removeItem("p17_authed");
    nav("/login");
  };

  if (!authed && pathname !== "/login") {
    return <Navigate to="/login" replace />;
  }

  if (authed) {
    return (
      <>
        <Navigation
          currentPage={current}
          onNavigate={goto}
          onLogout={handleLogout}
          onToggleDark={() => setDark((d) => !d)}
          darkMode={dark}
        />

        <div
          style={{
            paddingTop: 64,
            minHeight: "100vh",
            background: dark ? "#0b1120" : "#f8fafc",
          }}
        >
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  darkMode={dark}
                  onViewStudent={(s) => {
                    setSelectedStudent(s);
                    nav("/student");
                  }}
                />
              }
            />

            <Route
              path="/student"
              element={
                <StudentDetail
                  darkMode={dark}
                  student={selectedStudent}
                  onBack={() => nav("/")}
                />
              }
            />

            <Route path="/upload" element={<UploadFile darkMode={dark} />} />
            <Route path="/rules" element={<RuleSettings darkMode={dark} />} />
            <Route path="/setup-team" element={<SetupTeam darkMode={dark} />} />
            <Route path="/export" element={<ExportReport darkMode={dark} />} />

            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login onLogin={handleLogin} />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return <Shell />;
}

