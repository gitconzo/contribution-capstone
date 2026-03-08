// frontend/src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { isAuthed, setAuthed, clearAuthed } from "./utils/auth";

import Navigation from "./components/Navigation";
import Dashboard from "./pages/Dashboard";
import UploadFile from "./pages/UploadFile";
import RuleSettings from "./pages/RuleSettings";
import StudentDetail from "./pages/StudentDetail";
import SetupTeam from "./pages/SetupTeam";
import { Login } from "./pages/Login";

function Shell() {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [authed, setAuthedState] = useState(() => isAuthed());
  const [dark, setDark] = useState(false);

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
    if (dark) cl.add("p17-dark");
    else cl.remove("p17-dark");
  }, [dark]);

  const handleLogin = () => {
    setAuthed();
    setAuthedState(true);
    nav("/");
  };

  const handleLogout = () => {
    clearAuthed();
    setAuthedState(false);
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
        />
        <div style={{ paddingTop: 64 }}>
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  onViewStudent={(s) => {
                    setSelectedStudent(s);
                    nav("/student");
                  }}
                />
              }
            />
            <Route
              path="/student"
              element={<StudentDetail student={selectedStudent} onBack={() => nav("/")} />}
            />
            <Route path="/upload" element={<UploadFile />} />
            <Route path="/rules" element={<RuleSettings />} />
            <Route path="/setup-team" element={<SetupTeam />} />
            <Route path="/export" element={<div style={{ padding: 20 }}>Export screen (coming soon)</div>} />
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
