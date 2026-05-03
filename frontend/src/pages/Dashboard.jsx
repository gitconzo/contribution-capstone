// frontend/src/components/dashboard.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { apiFetch } from "../utils/api";
import {
  Users, Link as LinkIcon, BarChart3, UserRound,
  GitCommitHorizontal, Eye, ChevronDown, ChevronRight, Search, AlertTriangle,
} from "lucide-react";

// Format a date from API using UTC to avoid timezone shift (AEST = UTC+10 would shift midnight UTC back 1 day)
function fmtSprintDate(d) {
  if (!d) return "—";
  // Extract yyyy-mm-dd directly — avoids ALL timezone issues
  const str = typeof d === "string" ? d : String(d);
  const ymd = str.split("T")[0];
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  return `${parts[2]}-${parts[1]}-${parts[0]}`; // dd-mm-yyyy
}

// ── mirrors normalizeUploadRecord from UploadFile.js ──────────────────────
function normalizeUploadRecord(f = {}) {
  return {
    id:               f.id,
    teamId:           f.team_id      || f.teamId           || "unknown",
    originalName:     f.original_name|| f.originalName     || "unknown",
    size:             Number(f.size  || 0),
    uploadDate:       f.upload_date  || f.uploadDate       || null,
    detectedType:     f.detected_type|| f.detectedType     || "unknown",
    userType:         f.user_type    || f.userType         || "unknown",
    status:           f.status       || "unknown",
    approvalStatus:   f.approval_status || f.approvalStatus|| null,
    parseMessage:     f.parse_message|| f.parseMessage     || "",
    uploadedByName:   f.uploaded_by_name  || f.uploadedByName  || null,
    uploadedByEmail:  f.uploaded_by_email || f.uploadedByEmail || null,
    s3Key:            f.s3_key       || f.s3Key            || "",
  };
}

function getStatusBadgeStyle(status = "") {
  const v = String(status).toLowerCase();
  if (v.includes("parsed") || v.includes("complete") || v.includes("confirmed"))
    return { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" };
  if (v.includes("pending") || v.includes("uploaded") || v.includes("processing"))
    return { background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" };
  if (v.includes("fail") || v.includes("error") || v.includes("rejected"))
    return { background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5" };
  return { background: "#e5e7eb", color: "#374151", border: "1px solid #d1d5db" };
}

function formatFileSize(bytes) {
  const v = Number(bytes || 0);
  if (!v) return "-";
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDisplayDate(d) {
  if (!d) return "Unknown";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard({ onViewStudent, onViewTasks, onTeamSelect, darkMode }) {
  const [teamId, setTeamId] = useState(() => localStorage.getItem("dashboardTeamId") || "");

  // Notify parent of initial teamId so FileExplorer/UploadFile start with the right team
  useEffect(() => {
    if (teamId) onTeamSelect?.(teamId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [teams, setTeams] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("dashboardTeamsCache") || "[]"); } catch { return []; }
  });
  const [scores, setScores] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("dashboardScoresCache") || "null"); } catch { return null; }
  });
  const [teamStudents, setTeamStudents] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("dashboardStudentsCache") || "[]"); } catch { return []; }
  });
  const [query, setQuery]               = useState("");
  const [peerReview, setPeerReview]     = useState(false);
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [resetting, setResetting]       = useState(false);

  // ── Pending uploads ──
  const [pendingUploads, setPendingUploads] = useState([]);
  const [uploadsOpen, setUploadsOpen]       = useState(false);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  
  // ── Current sprint ──
  const [currentSprint, setCurrentSprint] = useState(null);
  const [allSprints, setAllSprints]       = useState([]);
  const [selectedSprintId, setSelectedSprintId] = useState("overall");
  const [sprintScores, setSprintScores] = useState(null);
  const [sprintAnalyzing, setSprintAnalyzing] = useState(false);
  

  // ── Auto-approve setting ──
  const [autoApproveUploads, setAutoApproveUploads] = useState(true);

  // ── Tasks ──
  const [tasksBySprintId, setTasksBySprintId] = useState({});
  const [tasksLoading,    setTasksLoading]    = useState(false);


  const theme = darkMode
    ? {
        pageBg: "#0b1120", card: "#111827", cardSoft: "#0f172a",
        text: "#f8fafc", subtext: "#94a3b8", border: "#1f2937",
        inputBg: "#0f172a", mutedIcon: "#94a3b8", progressBg: "#1f2937",
        shadow: "0 8px 20px rgba(0,0,0,.28)", buttonBg: "#111827",
        tableRow: "#0f172a",
      }
    : {
        pageBg: "#f8fafc", card: "#ffffff", cardSoft: "#ffffff",
        text: "#0f172a", subtext: "#64748b", border: "#e5e7eb",
        inputBg: "#ffffff", mutedIcon: "#64748b", progressBg: "#e5e7eb",
        shadow: "0 6px 14px rgba(0,0,0,.04)", buttonBg: "#ffffff",
        tableRow: "#f9f9f9",
      };

  // ── Load pending uploads for this team ──
  const loadPendingUploads = useCallback(async (tid) => {
    if (!tid) { setPendingUploads([]); return; }
    try {
      setUploadsLoading(true);
      const res  = await apiFetch(`/api/uploads/pending?teamId=${encodeURIComponent(tid)}`);
      const data = await res.json();
      setPendingUploads(Array.isArray(data) ? data.map(normalizeUploadRecord) : []);
    } catch { setPendingUploads([]); }
    finally  { setUploadsLoading(false); }
  }, []);

  useEffect(() => {
    (async () => {
      const [allTeams, activeTeam] = await Promise.all([
        apiFetch("/api/teams").then(r => r.json()),
        apiFetch("/api/teams/active").then(r => r.json()),
      ]);
      const resolvedTeams = Array.isArray(allTeams) ? allTeams : [];
      const resolvedId    = activeTeam?.id || resolvedTeams[0]?.id || "";
      setTeams(resolvedTeams);
      sessionStorage.setItem("dashboardTeamsCache", JSON.stringify(resolvedTeams));
      if (resolvedId && resolvedId !== teamId) {
        setTeamId(resolvedId);
        localStorage.setItem("dashboardTeamId", resolvedId);
        onTeamSelect?.(resolvedId);
        setScores(null); setTeamStudents([]);
        sessionStorage.removeItem("dashboardScoresCache");
        sessionStorage.removeItem("dashboardStudentsCache");
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!teamId) return;
    const url = `/api/scores?teamId=${encodeURIComponent(teamId)}${peerReview ? "&usePeerReview=true" : ""}`;
    apiFetch(url).then(r => r.json())
      .then(data => { setScores(data); if (!peerReview) sessionStorage.setItem("dashboardScoresCache", JSON.stringify(data)); })
      .catch(() => setScores(null));

    apiFetch(`/api/teams/${encodeURIComponent(teamId)}`).then(r => r.json())
      .then(data => { const s = data.students || []; setTeamStudents(s); sessionStorage.setItem("dashboardStudentsCache", JSON.stringify(s)); })
      .catch(() => setTeamStudents([]));

    loadPendingUploads(teamId);
    
    // Load sprints and find current one based on today's date
    apiFetch(`/api/teams/${encodeURIComponent(teamId)}/sprints`).then(r => r.json())
      .then(data => {
        const sprints = Array.isArray(data) ? data : [];
        setAllSprints(sprints);
        const today = new Date(); today.setHours(0,0,0,0);
        const active = sprints.find(sp => {
          const start = new Date(sp.start_date); start.setHours(0,0,0,0);
          const end   = new Date(sp.end_date);   end.setHours(23,59,59,999);
          return today >= start && today <= end;
        }) || null;
        setCurrentSprint(active);
      })
      .catch(() => { setAllSprints([]); setCurrentSprint(null); });

    // Load team's auto_approve_uploads setting
    apiFetch(`/api/teams/${encodeURIComponent(teamId)}`)
      .then(r => r.json())
      .then(data => setAutoApproveUploads(data.auto_approve_uploads !== false))
      .catch(() => setAutoApproveUploads(true));

    // Load team's auto_approve_uploads setting
    apiFetch(`/api/teams/${encodeURIComponent(teamId)}`)
      .then(r => r.json())
      .then(data => setAutoApproveUploads(data.auto_approve_uploads !== false))
      .catch(() => setAutoApproveUploads(true));

    // Load tasks for this team
    setTasksLoading(true);
    apiFetch(`/api/teams/${encodeURIComponent(teamId)}/tasks`)
      .then(r => r.json())
      .then(data => {
        const grouped = {};
        (Array.isArray(data) ? data : []).forEach(t => {
          if (!grouped[t.sprint_id]) grouped[t.sprint_id] = [];
          grouped[t.sprint_id].push(t);
        });
        setTasksBySprintId(grouped);
      })
      .catch(() => setTasksBySprintId({}))
      .finally(() => setTasksLoading(false));

    setUploadsOpen(false);
  }, [teamId, peerReview, loadPendingUploads]);

  useEffect(() => {
  if (!teamId || selectedSprintId === "overall") {
    setSprintScores(null);
    return;
  }
  apiFetch(`/api/teams/${teamId}/sprints/${selectedSprintId}/scores`)
    .then(r => r.json())
    .then(data => setSprintScores(data))
    .catch(() => setSprintScores(null));
}, [selectedSprintId, teamId]);

  useEffect(() => {
    const handler = () => loadPendingUploads(teamId);
    window.addEventListener("uploadsUpdated", handler);
    return () => window.removeEventListener("uploadsUpdated", handler);
  }, [teamId, loadPendingUploads]);

  const activeScores = selectedSprintId === "overall" ? scores : sprintScores;
  const students = useMemo(() => {
    const studentMap = new Map(teamStudents.map(s => [s.email, s]));
    const list = activeScores?.ranking?.length
      ? activeScores.ranking.map(r => ({ ...r, role: studentMap.get(r.email)?.role || "member" }))
      : teamStudents.map(s => ({ name: s.name, email: s.email, role: s.role || "member", score: 0, breakdown: {}, raw: {} }));
    const q = query.trim().toLowerCase();
    return list.filter(s => {
      const mq = !q || (s.name||"").toLowerCase().includes(q) || (s.email||"").toLowerCase().includes(q);
      const ml = selectedLevel === "all" || badgeFromScore(s.score||0) === selectedLevel;
      return mq && ml;
    });
  }, [activeScores, teamStudents, query, selectedLevel]);

  const codeScoreByKey = useMemo(() => {
    const ranking = activeScores?.ranking || [];
    if (!ranking.length) return new Map();
    const w = activeScores?.weights || {};
    const dw = { loc:12, editedCode:10, commits:7, functions:12, hotspots:10, codeComplexity:9 };
    const ww = { loc:w.loc??dw.loc, editedCode:w.editedCode??dw.editedCode, commits:w.commits??dw.commits, functions:w.functions??dw.functions, hotspots:w.hotspots??dw.hotspots, codeComplexity:w.codeComplexity??dw.codeComplexity };
    const dims = ["loc","editedCode","commits","functions","hotspots","codeComplexity"];
    const sums = ranking.map(r => dims.reduce((s,d) => s+((r.breakdown?.[d]||0)*(ww[d]||0)),0));
    const maxSum = Math.max(...sums, 1);
    const map = new Map();
    ranking.forEach((r,i) => map.set(r.email||r.name, Math.round((sums[i]/maxSum)*100)));
    return map;
  }, [activeScores]);

  const kpis = useMemo(() => {
    const list = activeScores?.ranking || [];
    if (!list.length) return { avg: 0, high: "0/0", commits: 0 };
    const avg = Math.round((list.reduce((s,r) => s+(r.score||0),0)/list.length)*10)/10;
    return { avg, high:`${list.filter(r=>r.score>=80).length}/${list.length}`, commits:0 };
  }, [activeScores]);

  const handleReset = async () => {
    if (!window.confirm("This will clear all scores and analysis for this team. Uploaded files will be kept. Are you sure?")) return;
    setResetting(true);
    try {
      const res = await apiFetch("/api/reset", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({teamId}) });
      if (!res.ok) throw new Error("Reset failed");
      setScores(null);
      alert("Scores reset. Re-upload documents and re-run GitHub analysis to recalculate.");
    } catch(e) { alert(e.message); }
    finally { setResetting(false); }
  };

  // ── Upload actions (mirror UploadFile.js exactly) ──
  const handleView = async (fileId) => {
    try { const res = await apiFetch(`/api/uploads/${fileId}/download`); const {url} = await res.json(); window.open(url,"_blank"); } catch { alert("Failed to open file"); }
  };
  const handleDownload = async (fileId, fileName) => {
    try { const res = await apiFetch(`/api/uploads/${fileId}/download`); const {url} = await res.json(); const a=document.createElement("a"); a.href=url; a.download=fileName||"file"; a.click(); } catch { alert("Failed to download"); }
  };
  const handleApprove = async (fileId) => {
    try {
      const res = await apiFetch(`/api/uploads/${fileId}/approve`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({approvedBy:"Lecturer"}) });
      if (!res.ok) throw new Error("Approve failed");
      setPendingUploads(prev => prev.map(f => f.id===fileId ? {...f, approvalStatus:"approved", status:"confirmed"} : f));
      window.dispatchEvent(new Event("uploadsUpdated"));
    } catch(e) { alert(e.message); }
  };
  const handleReject = async (fileId) => {
    try {
      const res = await apiFetch(`/api/uploads/${fileId}/reject`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({approvedBy:"Lecturer", declineReason:"Rejected by lecturer"}) });
      if (!res.ok) throw new Error("Reject failed");
      setPendingUploads(prev => prev.map(f => f.id===fileId ? {...f, approvalStatus:"rejected", status:"rejected"} : f));
      window.dispatchEvent(new Event("uploadsUpdated"));
    } catch(e) { alert(e.message); }
  };
  const handleReparse = async (fileId) => {
    try {
      const res = await apiFetch(`/api/uploads/${fileId}/reparse`, { method:"POST", headers:{"Content-Type":"application/json"} });
      if (!res.ok) throw new Error("Re-parse failed");
      const updated = normalizeUploadRecord(await res.json());
      setPendingUploads(prev => prev.map(f => f.id===fileId ? {...f, status:updated.status, parseMessage:updated.parseMessage} : f));
    } catch(e) { alert(e.message); }
  };
  const handleDelete = async (fileId) => {
    if (!window.confirm("Delete this file?")) return;
    try {
      const res = await apiFetch(`/api/uploads/${fileId}`, { method:"DELETE" });
      if (!res.ok) { const d=await res.json().catch(()=>{}); throw new Error(d?.error||"Delete failed"); }
      setPendingUploads(prev => prev.filter(f => f.id!==fileId));
      window.dispatchEvent(new Event("uploadsUpdated"));
    } catch(e) { alert(e.message); }
  };

  // ── Table styles (mirrors UploadFile.js) ──
  const tableCellStyle = { padding:"12px", textAlign:"left", color:theme.text, borderTop:`1px solid ${theme.border}`, borderBottom:`1px solid ${theme.border}`, verticalAlign:"top", overflowWrap:"anywhere", wordBreak:"break-word" };
  const tableStyle     = { width:"100%", borderCollapse:"separate", borderSpacing:"0 8px", color:theme.text, tableLayout:"auto", minWidth:"700px" };
  const thStyle        = { textAlign:"left", color:theme.subtext, fontSize:"12px", padding:"0 12px 6px 12px", fontWeight:600 };
  const tableRowStyle  = { background:theme.tableRow, boxShadow: darkMode ? "none" : "0 1px 3px rgba(0,0,0,0.08)" };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:"80px 16px 24px", maxWidth:1120, margin:"0 auto", minHeight:"100vh", background:theme.pageBg, color:theme.text }}>

      {/* ── Header ── */}
      <div style={rowBetween()}>
        <div>
          <h1 style={{ margin:0, fontSize:24, fontWeight:700, color:theme.text }}>Project Dashboard</h1>
          <div style={{ color:theme.subtext, fontSize:14 }}>Monitor team contribution and performance metrics</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={handleReset} disabled={resetting} style={{ padding:"8px 14px", borderRadius:10, border:"1px solid #dc2626", background:resetting?"#fee2e2":theme.buttonBg, cursor:resetting?"not-allowed":"pointer", fontSize:13, color:"#dc2626", fontWeight:500 }}>
            {resetting ? "Resetting..." : "Reset Scores"}
          </button>
          <button onClick={() => setPeerReview(v=>!v)} style={{ padding:"8px 14px", borderRadius:10, border:`1px solid ${peerReview?"#16a34a":theme.border}`, background:peerReview?"#f0fdf4":theme.buttonBg, cursor:"pointer", fontSize:13, color:peerReview?"#16a34a":theme.text, fontWeight:peerReview?600:400 }}>
            {peerReview ? "✓ Peer Review On" : "Peer Review Off"}
          </button>
          
          <select
            value={teamId}
            onChange={async e => {
              const newId = e.target.value;
              setTeamId(newId); localStorage.setItem("dashboardTeamId", newId);
              onTeamSelect?.(newId);
              setSelectedSprintId("overall"); setSprintScores(null);
              setScores(null); setTeamStudents([]);
              sessionStorage.removeItem("dashboardScoresCache"); sessionStorage.removeItem("dashboardStudentsCache");
              await apiFetch("/api/teams/active", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id:newId}) });
            }}
            style={selectBox(theme)} title="Select project or team"
          >
            {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
          </select>
        </div>
      </div>

      {/* ── Project card ── */}
      <div style={card(theme, { marginTop:16, padding:16 })}>
        <div style={{ fontWeight:700, marginBottom:6, color:theme.text }}>{scores?.team?.name||"—"}</div>
        <div style={{ color:theme.subtext, fontSize:14 }}>{scores?.team?.code||""}</div>
        <div style={{ marginTop:10, display:"flex", gap:18, color:theme.subtext, fontSize:13, flexWrap:"wrap" }}>
          <InfoInline icon={<Users size={15} color={theme.mutedIcon}/>} text={`${scores?.studentsCount||0} Students`}/>
          <InfoInline
            icon={<LinkIcon size={15} color={theme.mutedIcon}/>}
            text={scores?.team?.repo?.url || scores?.team?.repo_url || teams.find(t=>t.id===teamId)?.repo?.url || "Repository not connected"}
          />
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <select
                value={selectedSprintId}
                onChange={e => { setSelectedSprintId(e.target.value); setSprintScores(null); }}
                style={{ padding:"6px 10px", borderRadius:8, border:`1px solid ${theme.border}`, background:theme.inputBg, color:theme.text, fontSize:13, outline:"none", minWidth:160 }}
              >
                <option value="overall">Overall Score</option>
                {allSprints.map(s => (
                  <option key={s.id} value={s.id}>Sprint {s.sprint_number}</option>
                ))}
              </select>
              {selectedSprintId !== "overall" && (
                <button
                  disabled={sprintAnalyzing}
                  onClick={async () => {
                    setSprintAnalyzing(true);
                    try {
                      await apiFetch(`/api/teams/${teamId}/sprints/${selectedSprintId}/analyze`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({}),
                      });
                      const poll = setInterval(async () => {
                        const st = await apiFetch(`/api/teams/${teamId}/sprints/${selectedSprintId}/status`).then(r => r.json());
                        if (st.status === "complete" || st.status === "error") {
                          clearInterval(poll);
                          setSprintAnalyzing(false);
                          if (st.status === "complete") {
                            apiFetch(`/api/teams/${teamId}/sprints/${selectedSprintId}/scores`)
                              .then(r => r.json())
                              .then(data => setSprintScores(data))
                              .catch(() => {});
                          }
                        }
                      }, 4000);
                    } catch { setSprintAnalyzing(false); }
                  }}
                  style={{ padding:"6px 12px", borderRadius:8, border:"none", background:sprintAnalyzing?"#6b7280":"#111827", color:"#fff", fontSize:12, fontWeight:600, cursor:sprintAnalyzing?"not-allowed":"pointer" }}
                >
                  {sprintAnalyzing ? "Analysing..." : "Analyse Sprint"}
                </button>
              )}
              {selectedSprintId !== "overall" && sprintScores && (
                <span style={{ fontSize:12, color:"#16a34a", fontWeight:600 }}>Sprint scores loaded</span>
              )}
            </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", marginTop:12 }}>
        <KpiCard theme={theme} title="Average Score" icon={<BarChart3 size={16} color={theme.mutedIcon}/>}>
          <div style={{ fontSize:20, fontWeight:700, color:"#16a34a" }}>{kpis.avg}%</div>
          <Progress value={kpis.avg} theme={theme}/>
        </KpiCard>
        <KpiCard theme={theme} title="High Contributors" icon={<UserRound size={16} color={theme.mutedIcon}/>}>
          <div style={{ fontSize:20, fontWeight:700, color:theme.text }}>{kpis.high}</div>
          <div style={{ fontSize:12, color:theme.subtext }}>Students scoring 80% or above</div>
        </KpiCard>
        <KpiCard theme={theme} title="Total Commits" icon={<GitCommitHorizontal size={16} color={theme.mutedIcon}/>}>
          <div style={{ fontSize:20, fontWeight:700, color:theme.text }}>{kpis.commits}</div>
          <div style={{ fontSize:12, color:theme.subtext }}>Across all team members</div>
        </KpiCard>
      </div>


      {/* ════════════════════════════════════════════════════
          CURRENT SPRINT BANNER
      ════════════════════════════════════════════════════ */}
      {allSprints.length > 0 && (
        <div style={{ marginTop:14, borderRadius:12, border:`1px solid ${currentSprint ? "#6ee7b7" : theme.border}`, background: currentSprint ? (darkMode ? "#052e16" : "#f0fdf4") : (darkMode ? "#111827" : "#f9fafb"), padding:"14px 18px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ textAlign:"center", minWidth:52 }}>
                <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color: currentSprint ? "#16a34a" : theme.subtext }}>Sprint</div>
                <div style={{ fontSize:28, fontWeight:800, lineHeight:1, color: currentSprint ? "#16a34a" : theme.subtext }}>{currentSprint ? currentSprint.sprint_number : "—"}</div>
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color: currentSprint ? (darkMode ? "#86efac" : "#166534") : theme.subtext }}>
                  {currentSprint ? "Sprint in Progress" : "No Active Sprint"}
                </div>
                {currentSprint ? (
                  <div style={{ fontSize:13, color: darkMode ? "#6ee7b7" : "#16a34a", marginTop:2 }}>
                    {fmtSprintDate(currentSprint.start_date)}
                    {" → "}
                    {fmtSprintDate(currentSprint.end_date)}
                  </div>
                ) : (
                  <div style={{ fontSize:12, color:theme.subtext, marginTop:2 }}>Check Setup Team to configure sprint dates</div>
                )}
              </div>
            </div>

            

            <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
              {currentSprint?.scrum_master_name && (
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:10, color:theme.subtext, textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>Scrum Master</div>
                  <span style={{ fontSize:12, fontWeight:600, color:"#92400e", background:"#fef3c7", padding:"3px 10px", borderRadius:999, border:"1px solid #fde68a" }}>{currentSprint.scrum_master_name}</span>
                </div>
              )}
              {currentSprint && (() => {
                const end = new Date(currentSprint.end_date); end.setHours(23,59,59,999);
                const today = new Date();
                const daysLeft = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
                const total = Math.ceil((new Date(currentSprint.end_date) - new Date(currentSprint.start_date)) / (1000*60*60*24)) + 1;
                const elapsed = total - daysLeft;
                const pct = Math.round((elapsed / total) * 100);
                return (
                  <div style={{ textAlign:"center", minWidth:110 }}>
                    <div style={{ fontSize:10, color:theme.subtext, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{daysLeft === 1 ? "Last day!" : `${daysLeft} days left`}</div>
                    <div style={{ height:6, borderRadius:999, background: darkMode?"#1f2937":"#d1fae5", width:110 }}>
                      <div style={{ height:"100%", borderRadius:999, background:"#16a34a", width:`${Math.min(pct,100)}%` }}/>
                    </div>
                    <div style={{ fontSize:10, color:theme.subtext, marginTop:3 }}>{pct}% through</div>
                  </div>
                );
              })()}
              {!currentSprint && allSprints.length > 0 && (() => {
                const today = new Date(); today.setHours(0,0,0,0);
                const upcoming = allSprints
                  .filter(s => new Date(s.start_date) > today)
                  .sort((a,b) => new Date(a.start_date) - new Date(b.start_date))[0];
                return upcoming ? (
                  <div style={{ fontSize:12, color:theme.subtext }}>
                    Next: <strong style={{ color:theme.text }}>Sprint {upcoming.sprint_number}</strong> starts {fmtSprintDate(upcoming.start_date)}
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}
      {/* ══════════════════════════════════════════════════════
          ⚠ PENDING UPLOADS ALERT BANNER
      ══════════════════════════════════════════════════════ */}
      {!autoApproveUploads && (uploadsLoading || pendingUploads.length > 0) && (
        <div style={{ marginTop:14, borderRadius:12, border:"1px solid #fde68a", background:darkMode?"#1c1708":"#fffbeb", overflow:"hidden" }}>

          {/* Banner row */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <AlertTriangle size={18} color="#d97706"/>
              <div>
                <div style={{ fontWeight:700, color:darkMode?"#fbbf24":"#92400e", fontSize:14 }}>Pending Upload Reviews</div>
                <div style={{ fontSize:13, color:darkMode?"#fcd34d":"#b45309", marginTop:1 }}>
                  {uploadsLoading
                    ? "Checking for pending uploads…"
                    : `${pendingUploads.length} upload${pendingUploads.length!==1?"s":""} waiting for lecturer review`}
                </div>
              </div>
            </div>
            <button
              onClick={() => setUploadsOpen(v=>!v)}
              style={{ padding:"7px 16px", borderRadius:8, border:"1px solid #f59e0b", background:darkMode?"#292007":"#fff", color:darkMode?"#fbbf24":"#92400e", fontWeight:700, fontSize:13, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}
            >
              {uploadsOpen ? "Hide Uploads ▲" : "View Uploads ▼"}
            </button>
          </div>

          {/* ── Inline uploads review — mirrors UploadFile table exactly ── */}
          {uploadsOpen && (
            <div style={{ borderTop:"1px solid #fde68a", padding:"14px 16px" }}>

              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, color:theme.text }}>Uploads Review</div>
                  <div style={{ fontSize:12, color:theme.subtext, marginTop:2 }}>Review and action each upload — same controls as Upload Data page</div>
                </div>
                <span style={{ fontSize:12, color:theme.subtext }}>{pendingUploads.length} pending</span>
              </div>

              {pendingUploads.length === 0 ? (
                <div style={{ color:theme.subtext, fontSize:13 }}>No pending uploads.</div>
              ) : (
                <div style={{ width:"100%", overflowX:"auto" }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>File Name</th>
                        <th style={thStyle}>File Type</th>
                        <th style={thStyle}>Uploaded By</th>
                        <th style={thStyle}>Size</th>
                        <th style={thStyle}>Upload Date</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingUploads.map(f => {
                        const badgeStyle    = getStatusBadgeStyle(f.status);
                        const isParseFailed = String(f.status).toLowerCase() === "parse_failed";
                        const isPending     = f.approvalStatus === "pending" || !f.approvalStatus;
                        return (
                          <tr key={f.id} style={tableRowStyle}>
                            <td style={{ ...tableCellStyle, borderLeft:`1px solid ${theme.border}`, borderTopLeftRadius:10, borderBottomLeftRadius:10 }}>
                              <div style={{ fontWeight:600 }}>{f.originalName}</div>
                              {f.parseMessage && (
                                <div style={{ fontSize:11, color:"#b91c1c", marginTop:3 }}>{f.parseMessage}</div>
                              )}
                            </td>
                            <td style={tableCellStyle}>{f.userType !== "unknown" ? f.userType : f.detectedType}</td>
                            <td style={tableCellStyle}>{f.uploadedByName || f.uploadedByEmail || "Unknown"}</td>
                            <td style={tableCellStyle}>{formatFileSize(f.size)}</td>
                            <td style={tableCellStyle}>{formatDisplayDate(f.uploadDate)}</td>
                            <td style={tableCellStyle}>
                              <span style={{ ...badgeStyle, borderRadius:6, padding:"3px 8px", fontSize:11, fontWeight:700, letterSpacing:"0.05em", display:"inline-block", whiteSpace:"nowrap" }}>
                                {(f.status||"unknown").toUpperCase()}
                              </span>
                            </td>
                            {/* ── Inline action buttons ── */}
                            <td style={{ ...tableCellStyle, borderRight:`1px solid ${theme.border}`, borderTopRightRadius:10, borderBottomRightRadius:10, verticalAlign:"middle" }}>
                              <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
                                <InlineBtn label="View"     color="#1d4ed8" bg="#eff6ff"  border="#93c5fd" onClick={() => handleView(f.id)} />
                                <InlineBtn label="Download" color={theme.text} bg={theme.buttonBg} border={theme.border} onClick={() => handleDownload(f.id, f.originalName)} />
                                {isPending && <>
                                  <InlineBtn label="Approve"  color="#166534" bg="#dcfce7" border="#86efac" onClick={() => handleApprove(f.id)} />
                                  <InlineBtn label="Reject"   color="#991b1b" bg="#fee2e2" border="#fca5a5" onClick={() => handleReject(f.id)} />
                                </>}
                                {isParseFailed &&
                                  <InlineBtn label="Re-parse" color="#1d4ed8" bg="#eff6ff" border="#93c5fd" onClick={() => handleReparse(f.id)} />
                                }
                                <InlineBtn label="Delete"   color="#991b1b" bg="#fee2e2" border="#fca5a5" onClick={() => handleDelete(f.id)} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {/* ── Sprint Tasks Overview button ── */}
      {allSprints.length > 0 && (
        <div style={{ marginTop:14 }}>
          <button
            onClick={() => onViewTasks?.(teamId, scores?.team?.name || teams.find(t=>t.id===teamId)?.name || "Team")}
            style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", background:theme.card, border:`1px solid ${theme.border}`, borderRadius:14, cursor:"pointer", boxShadow:theme.shadow }}
          >
            <div style={{ textAlign:"left" }}>
              <div style={{ fontWeight:700, color:theme.text, fontSize:15 }}>Sprint Tasks Overview</div>
              <div style={{ fontSize:12, color:theme.subtext, marginTop:2 }}>View all assigned tasks across students and sprints</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:13, fontWeight:600, color:"#1d4ed8", background:"#dbeafe", padding:"4px 12px", borderRadius:999 }}>
                {tasksLoading ? "..." : `${Object.values(tasksBySprintId).flat().length} tasks`}
              </span>
              <ChevronRight size={18} color={theme.subtext}/>
            </div>
          </button>
        </div>
      )}

      {/* ── Team Members header ── */}
      <div style={card(theme, { marginTop:14, paddingBottom:10 })}>
        <div style={rowBetween()}>
          <div>
            <div style={{ fontWeight:700, color:theme.text }}>Team Members</div>
            <div style={{ color:theme.subtext, fontSize:13 }}>View and assess individual student contributions</div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <div style={{ position:"relative" }}>
              <Search size={15} color={theme.mutedIcon} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }}/>
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search students..." style={inputBoxWithIcon(theme)}/>
            </div>
            <div style={{ position:"relative" }}>
              <ChevronDown size={15} color={theme.mutedIcon} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}/>
              <select value={selectedLevel} onChange={e=>setSelectedLevel(e.target.value)} style={{ ...ghostBtn(theme), paddingRight:30, appearance:"none", minWidth:130 }}>
                <option value="all">All Levels</option>
                <option value="high">High Contributor</option>
                <option value="medium">Medium Contributor</option>
                <option value="low">Low Contributor</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Student rows ── */}
      <div style={{ display:"grid", gap:10, marginTop:10 }}>
        {students.length === 0 && (
          <div style={card(theme)}>
            <div style={{ textAlign:"center", padding:"20px", color:theme.subtext }}>
              No student data available. Upload documents and configure team settings.
            </div>
          </div>
        )}
        {students.map(s => {
          const breakdown = s.breakdown||{};
          const raw       = s.raw||{};
          const weights   = activeScores?.weights||{};
          const docWeights = { avgSentenceLength:weights.avgSentenceLength??5, sentenceComplexity:weights.sentenceComplexity??5, wordCount:weights.wordCount??7, readability:weights.readability??11 };
          const docMetrics = { avgSentenceLength:breakdown.avgSentenceLength||0, sentenceComplexity:breakdown.sentenceComplexity||0, wordCount:breakdown.wordCount||0, readability:breakdown.readability||0 };
          const totalDocWeight   = Object.values(docWeights).reduce((s,w)=>s+w,0);
          const weightedDocScore = totalDocWeight>0 ? Object.entries(docMetrics).reduce((s,[k,v])=>s+(v*docWeights[k]),0)/totalDocWeight : 0;
          const docScore   = Math.round(weightedDocScore*100);
          const codeScore  = codeScoreByKey.get(s.email||s.name)??0;
          const wordCount  = raw.wordCount||0;
          const attendance = Math.round((raw.attendance||0)*100);

          return (
            <div key={s.email||s.name} style={rowCard(theme)}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  <div style={{ fontWeight:700, color:theme.text }}>{s.name}</div>
                  {s.role && String(s.role).split(",").map(r => r.trim()).filter(Boolean).map(r => {
                    const cfg = r==="leader" ? { bg:"#dbeafe", color:"#1d4ed8", label:"leader" } : r==="scrum_master" ? { bg:"#fef3c7", color:"#92400e", label:"scrum master" } : { bg:"#e5e7eb", color:"#374151", label:r.replace(/_/g," ") };
                    return (<span key={r} style={{ fontSize:11, padding:"2px 8px", borderRadius:999, border:"1px solid", fontWeight:600, background:cfg.bg, color:cfg.color }}>{cfg.label}</span>);
                  })}
                  <Badge level={badgeFromScore(s.score)}/>
                </div>
                <div style={{ color:theme.subtext, fontSize:13, marginTop:2 }}>{s.email}</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:14, marginTop:12, fontSize:13 }}>
                  <Metric theme={theme} label="Code Score" value={`${codeScore}%`}/>
                  <Metric theme={theme} label="Doc Score"  value={docScore>0?`${docScore}%`:"—"}/>
                  <Metric theme={theme} label="Word Count" value={wordCount>0?wordCount:"—"}/>
                  <Metric theme={theme} label="Attendance" value={attendance>0?`${attendance}%`:"—"}/>
                </div>
              </div>
              <div style={{ display:"grid", alignContent:"center", justifyItems:"end", gap:6 }}>
                <div style={{ color:theme.subtext, fontSize:12 }}>Overall Score</div>
                <div style={{ fontWeight:700, color:scoreColor(s.score), fontSize:32 }}>{Math.round(s.score)||"—"}</div>
                {activeScores?.peerReviewApplied && s.peerMultiplier && (
                  <div style={{ fontSize:11, color:theme.subtext, marginTop:2 }}>Base: {Math.round(s.baseScore)}% × {s.peerMultiplier}</div>
                )}
                <div style={{ color:scoreColor(s.score), fontSize:12, marginTop:-8 }}>%</div>
                <button onClick={() => onViewStudent?.(s)} style={linkBtn(theme)}>
                  <span style={{ display:"flex", alignItems:"center", gap:8 }}><Eye size={15}/>View Details</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Lecturer sprint task group ──────────────────────────────────────────── */

/* ── Small components ─────────────────────────────────────────────────────── */
function InlineBtn({ label, color, bg, border, onClick }) {
  return (
    <button onClick={onClick} style={{ padding:"4px 10px", borderRadius:6, border:`1px solid ${border}`, background:bg, color, fontSize:11, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
      {label}
    </button>
  );
}
function KpiCard({ title, icon, children, theme }) {
  return (
    <div style={card(theme)}>
      <div style={rowBetween({ fontSize:13, color:theme.subtext })}>
        <span>{title}</span><span style={{ display:"flex", alignItems:"center" }}>{icon}</span>
      </div>
      <div style={{ marginTop:8 }}>{children}</div>
    </div>
  );
}
function InfoInline({ icon, text }) {
  return <div style={{ display:"flex", alignItems:"center", gap:6 }}>{icon}<span>{text}</span></div>;
}
function Progress({ value, theme }) {
  const pct = Math.max(0, Math.min(100, Number(value)||0));
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ height:8, borderRadius:999, background:theme.progressBg }}>
        <div style={{ width:`${pct}%`, height:"100%", borderRadius:999, background:"#16a34a" }}/>
      </div>
    </div>
  );
}
function Metric({ label, value, theme }) {
  return (
    <div>
      <div style={{ color:theme.subtext, fontSize:12 }}>{label}:</div>
      <div style={{ fontWeight:600, color:theme.text, marginTop:2 }}>{value}</div>
    </div>
  );
}
function Badge({ level }) {
  const base = { fontSize:11, padding:"2px 8px", borderRadius:999, border:"1px solid", fontWeight:600 };
  if (level==="high")   return <span style={{ ...base, color:"#065f46", borderColor:"#a7f3d0", background:"#ecfdf5" }}>high contributor</span>;
  if (level==="medium") return <span style={{ ...base, color:"#92400e", borderColor:"#fde68a", background:"#fffbeb" }}>medium contributor</span>;
  return <span style={{ ...base, color:"#991b1b", borderColor:"#fecaca", background:"#fef2f2" }}>low contributor</span>;
}
function badgeFromScore(s=0) { if (s>=80) return "high"; if (s>=60) return "medium"; return "low"; }
function scoreColor(s=0) {
  if (s>=90) return "#16a34a"; if (s>=80) return "#22c55e"; if (s>=70) return "#2563eb";
  if (s>=60) return "#ca8a04"; if (s>=50) return "#ea580c"; return "#dc2626";
}
function card(theme, extra={}) { return { background:theme.card, border:`1px solid ${theme.border}`, borderRadius:14, padding:14, boxShadow:theme.shadow, ...extra }; }
function rowCard(theme) { return { ...card(theme), display:"grid", gridTemplateColumns:"1fr auto", gap:16, alignItems:"center" }; }
function inputBoxWithIcon(theme) { return { padding:"8px 12px 8px 32px", borderRadius:10, border:`1px solid ${theme.border}`, background:theme.inputBg, color:theme.text, fontSize:14, minWidth:240, outline:"none" }; }
function selectBox(theme) { return { padding:"10px 12px", borderRadius:10, border:`1px solid ${theme.border}`, background:theme.inputBg, color:theme.text, fontSize:14, minWidth:300, outline:"none" }; }
function ghostBtn(theme) { return { border:`1px solid ${theme.border}`, background:theme.buttonBg, color:theme.text, borderRadius:10, padding:"8px 10px", fontSize:13, cursor:"pointer" }; }
function linkBtn(theme) { return { border:`1px solid ${theme.border}`, background:theme.buttonBg, borderRadius:10, padding:"8px 12px", fontSize:13, cursor:"pointer", fontWeight:600, color:theme.text }; }
function rowBetween(extra={}) { return { display:"flex", justifyContent:"space-between", alignItems:"center", ...extra }; }