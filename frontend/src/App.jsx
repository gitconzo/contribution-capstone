import React, { useEffect, useMemo, useState } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { isAuthed, setAuthed, clearAuthed } from "./utils/auth";

import Navigation from "./components/Navigation";
import Dashboard from "./pages/Dashboard";
import UploadFile from "./pages/UploadFile";
import RuleSettings from "./pages/RuleSettings";
import StudentDetail from "./pages/StudentDetail";
import SetupTeam from "./pages/SetupTeam";
import StudentDashboard from "./pages/StudentDashboard";
import StudentSettings from "./pages/StudentSettings";
import LecturerSettings from "./pages/LecturerSettings";
import { Login } from "./pages/Login";
import ForgotUsername from "./pages/ForgotUsername";
import ForgotPassword from "./pages/ForgotPassword";

function Shell() {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [authed, setAuthedState] = useState(() => isAuthed());
  const [dark, setDark] = useState(false);

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const isTeacher = user?.role === "teacher";
  const isStudent = user?.role === "student";

  const nav = useNavigate();
  const { pathname } = useLocation();

  const current = useMemo(() => {
    if (pathname === "/") return "dashboard";
    if (pathname.startsWith("/rules")) return "rules";
    if (pathname.startsWith("/upload")) return "upload";
    if (pathname.startsWith("/setup-team")) return "setup-team";
    if (pathname.startsWith("/student-dashboard")) return "student-dashboard";
    if (pathname.startsWith("/settings")) return "settings";
    if (pathname.startsWith("/lecturer-settings")) return "lecturer-settings";
    return "";
  }, [pathname]);

  const goto = (key) => {
    if (key === "dashboard") nav("/");
    else if (key === "rules") nav("/rules");
    else if (key === "upload") nav("/upload");
    else if (key === "setup-team") nav("/setup-team");
    else if (key === "student-dashboard") nav("/student-dashboard");
    else if (key === "settings") nav("/settings");
    else if (key === "lecturer-settings") nav("/lecturer-settings");
  };

  useEffect(() => {
    const cl = document.body.classList;
    if (dark) cl.add("p17-dark");
    else cl.remove("p17-dark");
  }, [dark]);

  const handleLogin = (userData) => {
    setAuthed();
    setAuthedState(true);
    setUser(userData ?? null);
    nav("/");
  };

  const handleLogout = () => {
    clearAuthed();
    localStorage.removeItem("p17_authed");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setAuthedState(false);
    setUser(null);
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
          user={user}
        />
        <div style={{ paddingTop: 64 }}>
          <Routes>
            <Route
              path="/"
              element={
                isTeacher ? (
                  <Dashboard
                    onViewStudent={(s) => {
                      setSelectedStudent(s);
                      nav("/student");
                    }}
                  />
                ) : (
                  <Navigate to="/student-dashboard" replace />
                )
              }
            />

            <Route
              path="/student-dashboard"
              element={isStudent ? <StudentDashboard /> : <Navigate to="/" replace />}
            />

            <Route
              path="/settings"
              element={isStudent ? <StudentSettings /> : <Navigate to="/" replace />}
            />

            <Route
              path="/lecturer-settings"
              element={isTeacher ? <LecturerSettings /> : <Navigate to="/student-dashboard" replace />}
            />

            <Route
              path="/student"
              element={
                isTeacher ? (
                  <StudentDetail student={selectedStudent} onBack={() => nav("/")} />
                ) : (
                  <Navigate to="/student-dashboard" replace />
                )
              }
            />

            <Route
              path="/upload"
              element={isTeacher ? <UploadFile /> : <Navigate to="/student-dashboard" replace />}
            />
            <Route
              path="/rules"
              element={isTeacher ? <RuleSettings /> : <Navigate to="/student-dashboard" replace />}
            />
            <Route
              path="/setup-team"
              element={isTeacher ? <SetupTeam /> : <Navigate to="/student-dashboard" replace />}
            />

            <Route
              path="/login"
              element={<Navigate to={isStudent ? "/student-dashboard" : "/"} replace />}
            />
            <Route
              path="/forgot-username"
              element={<Navigate to={isStudent ? "/student-dashboard" : "/"} replace />}
            />
            <Route
              path="/forgot-password"
              element={<Navigate to={isStudent ? "/student-dashboard" : "/"} replace />}
            />
            <Route
              path="*"
              element={<Navigate to={isStudent ? "/student-dashboard" : "/"} replace />}
            />
          </Routes>
        </div>
      </>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login onLogin={handleLogin} />} />
      <Route path="/forgot-username" element={<ForgotUsername />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return <Shell />;
}