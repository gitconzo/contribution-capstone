// frontend/src/App.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { apiFetch } from "./utils/api";
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
import ExportReport from "./pages/ExportReport";
import DefaultPasswordNotice from "./components/DefaultPasswordNotice";

function Shell() {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [authed, setAuthedState] = useState(() => isAuthed());
  
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState("");
  const [scores, setScores] = useState(null);
  const [teamStudents, setTeamStudents] = useState([]);
  const [showDefaultPasswordNotice, setShowDefaultPasswordNotice] = useState(false);


  // Fetch scores and students for a given team
  const refreshDashboard = useCallback(async (id) => {
    if (!id) return;
    const [scoreData, teamData] = await Promise.all([
      apiFetch(`/api/scores?teamId=${encodeURIComponent(id)}`).then(r => r.json()).catch(() => null),
      apiFetch(`/api/teams/${encodeURIComponent(id)}`).then(r => r.json()).catch(() => null),
    ]);
    setScores(scoreData);
    setTeamStudents(teamData?.students || []);
  }, []);

  // when user switches teams update active team on server + refresh dashboard data
  const handleTeamChange = useCallback(async (id) => {
    setTeamId(id);
    await apiFetch("/api/teams/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    refreshDashboard(id);
  }, [refreshDashboard]);

  // Fetch all teams and the active team, then load dashboard data (on first load)
  useEffect(() => {
    (async () => {
      const [allTeams, activeTeam] = await Promise.all([
        apiFetch("/api/teams").then(r => r.json()).catch(() => []),
        apiFetch("/api/teams/active").then(r => r.json()).catch(() => null),
      ]);
      const activeId = activeTeam?.id || allTeams?.[0]?.id || "";
      setTeams(allTeams || []);
      setTeamId(activeId);
      refreshDashboard(activeId);
    })();
  }, [refreshDashboard]);

  const [dark, setDark] = useState(() => {
    return localStorage.getItem("p17_dark") === "1";
  });

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  useEffect(() => {
    if (authed && user?.role === "student" && user?.usingDefaultPassword) {
      setShowDefaultPasswordNotice(true);
    } else {
      setShowDefaultPasswordNotice(false);
    }
  }, [authed, user]);

  const isStudent = user?.role === "student";
  const isTeacher = !isStudent; // default to teacher if no role set (backwards compat)

  const nav = useNavigate();
  const { pathname } = useLocation();

  const current = useMemo(() => {
    if (pathname === "/") return "dashboard";
    if (pathname.startsWith("/rules")) return "rules";
    if (pathname.startsWith("/upload")) return "upload";
    if (pathname.startsWith("/setup-team")) return "setup-team";
    if (pathname.startsWith("/export")) return "export";
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
    else if (key === "export") nav("/export");
    else if (key === "student-dashboard") nav("/student-dashboard");
    else if (key === "settings") nav("/settings");
    else if (key === "lecturer-settings") nav("/lecturer-settings");
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

  const publicPaths = ["/login", "/forgot-username", "/forgot-password"];
  if (!authed && !publicPaths.includes(pathname)) {
    return <Navigate to="/login" replace />;
  }

  if (authed) {
    return (
      <>
  <DefaultPasswordNotice
    visible={showDefaultPasswordNotice}
    onClose={() => setShowDefaultPasswordNotice(false)}
    onChangePassword={() => {
      setShowDefaultPasswordNotice(false);
      nav("/settings");
    }}
  />
        <Navigation
          currentPage={current}
          onNavigate={goto}
          onLogout={handleLogout}
          onToggleDark={() => setDark((d) => !d)}
          darkMode={dark}
          user={user}
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
                isTeacher ? (
                  <Dashboard
                    darkMode={dark}
                    teams={teams}
                    teamId={teamId}
                    scores={scores}
                    teamStudents={teamStudents}
                    onTeamChange={handleTeamChange}
                    onTeamsChange={setTeams}
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
              element={isStudent ? <StudentDashboard darkMode={dark} /> : <Navigate to="/" replace />}
            />

            <Route
              path="/settings"
              element={isStudent ? <StudentSettings darkMode={dark} /> : <Navigate to="/" replace />}
            />

            <Route
              path="/lecturer-settings"
              element={isTeacher ? <LecturerSettings darkMode={dark} /> : <Navigate to="/student-dashboard" replace />}
            />

            <Route
              path="/student"
              element={
                isTeacher ? (
                  <StudentDetail
                    darkMode={dark}
                    student={selectedStudent}
                    onBack={() => nav("/")}
                  />
                ) : (
                  <Navigate to="/student-dashboard" replace />
                )
              }
            />

            <Route
              path="/upload"
              element={isTeacher ? <UploadFile darkMode={dark} /> : <Navigate to="/student-dashboard" replace />}
            />
            <Route
              path="/rules"
              element={isTeacher ? <RuleSettings darkMode={dark} /> : <Navigate to="/student-dashboard" replace />}
            />
            <Route
              path="/setup-team"
              element={isTeacher ? <SetupTeam darkMode={dark} teams={teams} onTeamsChange={setTeams} /> : <Navigate to="/student-dashboard" replace />}
            />
            <Route
              path="/export"
              element={isTeacher ? <ExportReport darkMode={dark} /> : <Navigate to="/student-dashboard" replace />}
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
