// frontend/src/App.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { apiFetch } from "./utils/api";
import { isAuthed, setAuthed, clearAuthed } from "./utils/auth";

import { TeamProvider } from "./context/TeamContext";
import Navigation from "./components/Navigation";
import Dashboard from "./pages/Dashboard";
import UploadFile from "./pages/UploadFile";
import RuleSettings from "./pages/RuleSettings";
import StudentDetail from "./pages/StudentDetail";
import SprintTasksDetail from "./pages/SprintTasksDetail";
import SprintTasksSM from "./pages/SprintTasksSM";
import SetupTeam from "./pages/SetupTeam";
import StudentDashboard from "./pages/StudentDashboard";
import StudentSettings from "./pages/StudentSettings";
import LecturerSettings from "./pages/LecturerSettings";
import { Login } from "./pages/Login";
import ForgotUsername from "./pages/ForgotUsername";
import ForgotPassword from "./pages/ForgotPassword";
import ExportReport from "./pages/ExportReport";
import FileExplorer from "./pages/FileExplorer";
import DefaultPasswordNotice from "./components/DefaultPasswordNotice";

function Shell() {
  const [selectedStudent,   setSelectedStudent]   = useState(null);
  const [selectedTasksTeam, setSelectedTasksTeam] = useState(null); // { id, name }
  const [smTaskTeam,        setSmTaskTeam]        = useState(null); // { id, students }
  const [authed, setAuthedState] = useState(() => isAuthed());

  const [teams, setTeams] = useState([]);
  const [showDefaultPasswordNotice, setShowDefaultPasswordNotice] = useState(false);

  const [dark, setDark] = useState(() => localStorage.getItem("p17_dark") === "1");
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const [studentTeams,          setStudentTeams]          = useState(() => { try { return JSON.parse(sessionStorage.getItem("studentTeamsCache") || "[]"); } catch { return []; } });
  const [studentScores,         setStudentScores]         = useState(null);
  const [studentSelectedTeamId, setStudentSelectedTeamId] = useState(() => localStorage.getItem("studentSelectedTeamId") || "");
  const [studentLoading,        setStudentLoading]        = useState(true);
  const [studentUploads,        setStudentUploads]        = useState([]);
  const [studentUploadsLoading, setStudentUploadsLoading] = useState(false);

  const refreshStudentUploads = useCallback(async (tid, email) => {
    if (!tid || !email) return;
    setStudentUploadsLoading(true);
    try {
      const data = await apiFetch(`/api/uploads/student?teamId=${encodeURIComponent(tid)}&email=${encodeURIComponent(email)}`).then(r => r.json()).catch(() => []);
      setStudentUploads(Array.isArray(data) ? data : []);
    } finally { setStudentUploadsLoading(false); }
  }, []);

  const refreshStudentDashboard = useCallback(async (currentUser) => {
    const u = currentUser || user;
    if (!u?.email) return;
    setStudentLoading(true);
    try {
      const all     = await apiFetch("/api/teams").then(r => r.json()).catch(() => []);
      const allList = Array.isArray(all) ? all : [];
      const email   = (u.email || "").trim().toLowerCase();
      const matched = allList.filter(t => (t.students || []).some(s => (s.email || "").trim().toLowerCase() === email));
      setStudentTeams(matched);
      sessionStorage.setItem("studentTeamsCache", JSON.stringify(matched));
      const savedId = localStorage.getItem("studentSelectedTeamId");
      const initId  = matched.find(t => t.id === savedId)?.id || matched[0]?.id || "";
      setStudentSelectedTeamId(initId);
      if (initId) {
        const [data] = await Promise.all([
          apiFetch(`/api/scores?teamId=${encodeURIComponent(initId)}`).then(r => r.json()).catch(() => null),
          refreshStudentUploads(initId, u.email),
        ]);
        setStudentScores(data || null);
      }
    } finally { setStudentLoading(false); }
  }, [user, refreshStudentUploads]);

  const handleStudentTeamChange = useCallback(async (id) => {
    localStorage.setItem("studentSelectedTeamId", id);
    setStudentSelectedTeamId(id);
    const [data] = await Promise.all([
      apiFetch(`/api/scores?teamId=${encodeURIComponent(id)}`).then(r => r.json()).catch(() => null),
      refreshStudentUploads(id, user?.email),
    ]);
    setStudentScores(data || null);
  }, [refreshStudentUploads, user?.email]);

  useEffect(() => {
    apiFetch("/api/teams")
      .then(r => r.json())
      .catch(() => [])
      .then(data => setTeams(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    if (authed && user?.role === "student" && user?.usingDefaultPassword) setShowDefaultPasswordNotice(true);
    else setShowDefaultPasswordNotice(false);
  }, [authed, user]);

  useEffect(() => {
    if (authed && user?.role === "student") refreshStudentDashboard(user);
  }, [authed, user, refreshStudentDashboard]);

  const isStudent = user?.role === "student";
  const isTeacher = !isStudent;

  const nav = useNavigate();
  const { pathname } = useLocation();

  const current = useMemo(() => {
    if (pathname === "/") return "dashboard";
    if (pathname.startsWith("/rules"))             return "rules";
    if (pathname.startsWith("/upload"))            return "upload";
    if (pathname.startsWith("/setup-team"))        return "setup-team";
    if (pathname.startsWith("/export"))            return "export";
    if (pathname.startsWith("/files"))             return "files";
    if (pathname.startsWith("/student-dashboard")) return "student-dashboard";
    if (pathname.startsWith("/settings"))          return "settings";
    if (pathname.startsWith("/lecturer-settings")) return "lecturer-settings";
    return "";
  }, [pathname]);

  const goto = (key) => {
    const map = { dashboard:"/", rules:"/rules", upload:"/upload", "setup-team":"/setup-team", export:"/export", files:"/files", "student-dashboard":"/student-dashboard", settings:"/settings", "lecturer-settings":"/lecturer-settings" };
    if (map[key]) nav(map[key]);
  };

  useEffect(() => {
    const cl = document.body.classList;
    if (dark) { cl.add("p17-dark"); localStorage.setItem("p17_dark", "1"); }
    else       { cl.remove("p17-dark"); localStorage.setItem("p17_dark", "0"); }
  }, [dark]);

  const handleLogin = (userData) => { setAuthed(); setAuthedState(true); setUser(userData ?? null); nav("/"); };
  const handleLogout = () => {
    clearAuthed();
    localStorage.removeItem(`dashboardTeamId_${user?.email}`);
    ["p17_authed","token","user"].forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem("studentTeamsCache");
    setAuthedState(false); setUser(null); nav("/login");
  };

  const publicPaths = ["/login", "/forgot-username", "/forgot-password"];
  if (!authed && !publicPaths.includes(pathname)) return <Navigate to="/login" replace />;

  if (authed) {
    return (
      <TeamProvider userId={user?.email || ""}>
        <DefaultPasswordNotice
          visible={showDefaultPasswordNotice}
          onClose={() => setShowDefaultPasswordNotice(false)}
          onChangePassword={() => { setShowDefaultPasswordNotice(false); nav("/settings"); }}
        />
        <Navigation currentPage={current} onNavigate={goto} onLogout={handleLogout} onToggleDark={() => setDark(d => !d)} darkMode={dark} user={user} />
        <div style={{ paddingTop:64, minHeight:"100vh", background: dark ? "#0b1120" : "#f8fafc" }}>
          <Routes>

            <Route path="/" element={
              isTeacher ? (
                <Dashboard
                  darkMode={dark}
                  onViewStudent={s => { setSelectedStudent(s); nav("/student"); }}
                  onViewTasks={(tid, tname) => { setSelectedTasksTeam({ id: tid, name: tname }); nav("/sprint-tasks"); }}
                />
              ) : <Navigate to="/student-dashboard" replace />
            }/>

            <Route path="/student-dashboard" element={
              isStudent ? (
                <StudentDashboard darkMode={dark} studentTeams={studentTeams} scores={studentScores} selectedTeamId={studentSelectedTeamId} onTeamChange={handleStudentTeamChange} loading={studentLoading} onRefreshTeams={() => refreshStudentDashboard(user)} onManageTasks={(tid, students) => { setSmTaskTeam({ id: tid, students }); nav("/sprint-tasks-sm"); }} />
              ) : <Navigate to="/" replace />
            }/>

            <Route path="/settings" element={
              isStudent ? (
                <StudentSettings darkMode={dark} studentTeams={studentTeams} selectedTeamId={studentSelectedTeamId} onTeamChange={handleStudentTeamChange} onRefreshTeams={() => refreshStudentDashboard(user)} studentUploads={studentUploads} uploadsLoading={studentUploadsLoading} onRefreshUploads={() => refreshStudentUploads(studentSelectedTeamId, user?.email)} />
              ) : <Navigate to="/" replace />
            }/>

            <Route path="/lecturer-settings" element={
              isTeacher ? <LecturerSettings darkMode={dark} teams={teams} /> : <Navigate to="/student-dashboard" replace />
            }/>

            <Route path="/student" element={
              isTeacher ? <StudentDetail darkMode={dark} student={selectedStudent} onBack={() => nav("/")} /> : <Navigate to="/student-dashboard" replace />
            }/>

            {/* ── Sprint Tasks Detail (lecturer) ── */}
            <Route path="/sprint-tasks" element={
              isTeacher ? (
                <SprintTasksDetail
                  darkMode={dark}
                  teamId={selectedTasksTeam?.id}
                  teamName={selectedTasksTeam?.name}
                  onBack={() => nav("/")}
                />
              ) : <Navigate to="/student-dashboard" replace />
            }/>

            {/* ── Sprint Task Management (Scrum Master) ── */}
            <Route path="/sprint-tasks-sm" element={
              isStudent ? (
                <SprintTasksSM
                  darkMode={dark}
                  teamId={smTaskTeam?.id}
                  teamStudents={smTaskTeam?.students || []}
                  savedUserEmail={user?.email}
                  onBack={() => nav("/student-dashboard")}
                />
              ) : <Navigate to="/" replace />
            }/>

            <Route path="/upload"     element={isTeacher ? <UploadFile darkMode={dark} />    : <Navigate to="/student-dashboard" replace />} />
            <Route path="/rules"      element={isTeacher ? <RuleSettings darkMode={dark} />   : <Navigate to="/student-dashboard" replace />} />
            <Route path="/setup-team" element={isTeacher ? <SetupTeam darkMode={dark} teams={teams} onTeamsChange={setTeams} /> : <Navigate to="/student-dashboard" replace />} />
            <Route path="/export"     element={isTeacher ? <ExportReport darkMode={dark} />   : <Navigate to="/student-dashboard" replace />} />
            <Route path="/files"      element={isTeacher ? <FileExplorer darkMode={dark} teams={teams} /> : <Navigate to="/student-dashboard" replace />} />

            <Route path="/login"           element={<Navigate to={isStudent?"/student-dashboard":"/"} replace />} />
            <Route path="/forgot-username" element={<Navigate to={isStudent?"/student-dashboard":"/"} replace />} />
            <Route path="/forgot-password" element={<Navigate to={isStudent?"/student-dashboard":"/"} replace />} />
            <Route path="*"               element={<Navigate to={isStudent?"/student-dashboard":"/"} replace />} />
          </Routes>
        </div>
      </TeamProvider>
    );
  }

  return (
    <Routes>
      <Route path="/login"           element={<Login onLogin={handleLogin} />} />
      <Route path="/forgot-username" element={<ForgotUsername />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="*"               element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() { return <Shell />; }