// frontend/src/components/dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/api";
import { Users, Link as LinkIcon, BarChart3, UserRound, GitCommitHorizontal, Eye, ChevronDown, Search } from "lucide-react";

export default function Dashboard({ onViewStudent, darkMode }) {
  const [teamId, setTeamId] = useState(() => localStorage.getItem("dashboardTeamId") || "");
  const [teams, setTeams] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("dashboardTeamsCache") || "[]"); } catch { return []; }
  });
  const [scores, setScores] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("dashboardScoresCache") || "null"); } catch { return null; }
  });
  const [teamStudents, setTeamStudents] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("dashboardStudentsCache") || "[]"); } catch { return []; }
  });
  const [query, setQuery] = useState("");
  const [peerReview, setPeerReview] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [resetting, setResetting] = useState(false);

  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState("overall");
  const [sprintScores, setSprintScores] = useState(null);

  const theme = darkMode
    ? {
        pageBg: "#0b1120",
        card: "#111827",
        cardSoft: "#0f172a",
        text: "#f8fafc",
        subtext: "#94a3b8",
        border: "#1f2937",
        inputBg: "#0f172a",
        mutedIcon: "#94a3b8",
        progressBg: "#1f2937",
        shadow: "0 8px 20px rgba(0,0,0,.28)",
        buttonBg: "#111827",
      }
    : {
        pageBg: "#f8fafc",
        card: "#ffffff",
        cardSoft: "#ffffff",
        text: "#0f172a",
        subtext: "#64748b",
        border: "#e5e7eb",
        inputBg: "#ffffff",
        mutedIcon: "#64748b",
        progressBg: "#e5e7eb",
        shadow: "0 6px 14px rgba(0,0,0,.04)",
        buttonBg: "#ffffff",
      };

  useEffect(() => {
    (async () => {
      const [allTeams, activeTeam] = await Promise.all([
        apiFetch("/api/teams").then(r => r.json()),
        apiFetch("/api/teams/active").then(r => r.json()),
      ]);
      const resolvedTeams = Array.isArray(allTeams) ? allTeams : [];
      const resolvedId = activeTeam?.id || resolvedTeams[0]?.id || "";
      setTeams(resolvedTeams);
      sessionStorage.setItem("dashboardTeamsCache", JSON.stringify(resolvedTeams));
      if (resolvedId && resolvedId !== teamId) {
        setTeamId(resolvedId);
        localStorage.setItem("dashboardTeamId", resolvedId);
        setScores(null);
        setTeamStudents([]);
        sessionStorage.removeItem("dashboardScoresCache");
        sessionStorage.removeItem("dashboardStudentsCache");
      }
      if (resolvedId) {
        apiFetch(`/api/sprints/team/${resolvedId}`)
          .then(r => r.json())
          .then(data => setSprints(Array.isArray(data) ? data : []))
          .catch(() => setSprints([]));
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!teamId) return;
    // Don't re-fetch on peerReview toggle when peer review is off and we have cached scores
    if (selectedSprint !== "overall") return;
    const url = `/api/scores?teamId=${encodeURIComponent(teamId)}${peerReview ? "&usePeerReview=true" : ""}`;
    apiFetch(url)
      .then(r => r.json())
      .then(data => {
        setScores(data);
        if (!peerReview) sessionStorage.setItem("dashboardScoresCache", JSON.stringify(data));
      })
      .catch(() => setScores(null));

    apiFetch(`/api/teams/${encodeURIComponent(teamId)}`)
      .then(r => r.json())
      .then(data => {
        const students = data.students || [];
        setTeamStudents(students);
        sessionStorage.setItem("dashboardStudentsCache", JSON.stringify(students));
      })
      .catch(() => setTeamStudents([]));
  }, [teamId, peerReview, selectedSprint]);


  useEffect(() => {
    if (!teamId || selectedSprint === "overall") {
      setSprintScores(null);
      return;
    }
    apiFetch(`/api/sprints/${selectedSprint}/scores/${teamId}`)
      .then(r => r.json())
      .then(data => setSprintScores(data))
      .catch(() => setSprintScores(null));
  }, [selectedSprint, teamId]);

  const activeScores = selectedSprint === "overall" ? scores : sprintScores;

  const students = useMemo(() => {
    const list = activeScores?.ranking?.length
      ? activeScores.ranking
      : teamStudents.map((s) => ({
          name: s.name,
          email: s.email,
          score: 0,
          breakdown: {},
          raw: {},
        }));
  
    const q = query.trim().toLowerCase();
  
    return list.filter((s) => {
      const matchesQuery =
        !q ||
        (s.name || "").toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q);
  
      const level = badgeFromScore(s.score || 0);
      const matchesLevel =
        selectedLevel === "all" || level === selectedLevel;
  
      return matchesQuery && matchesLevel;
    });
  }, [activeScores, teamStudents, query, selectedLevel]);

  // ---- Compute per-student CODE-ONLY weighted sums and max → Code Score %
  const codeScoreByKey = useMemo(() => {
    const ranking = activeScores?.ranking || [];
    if (!ranking.length) return new Map();

    const weights = activeScores?.weights || {};
    const defaultWeights = {
      loc: 12, editedCode: 10, commits: 7,
      functions: 12, hotspots: 10, codeComplexity: 9
    };
    const w = {
      loc: weights.loc ?? defaultWeights.loc,
      editedCode: weights.editedCode ?? defaultWeights.editedCode,
      commits: weights.commits ?? defaultWeights.commits,
      functions: weights.functions ?? defaultWeights.functions,
      hotspots: weights.hotspots ?? defaultWeights.hotspots,
      codeComplexity: weights.codeComplexity ?? defaultWeights.codeComplexity
    };
    const codeDims = ["loc", "editedCode", "commits", "functions", "hotspots", "codeComplexity"];

    const sums = ranking.map(r =>
      codeDims.reduce((sum, d) => sum + ((r.breakdown?.[d] || 0) * (w[d] || 0)), 0)
    );

    const maxSum = Math.max(...sums, 1);
    const map = new Map();
    ranking.forEach((r, idx) => {
      const pct = Math.round((sums[idx] / maxSum) * 100);
      map.set(r.email || r.name, pct);
    });
    return map;
  }, [activeScores]);

  const kpis = useMemo(() => {
    const list = activeScores?.ranking || [];
    if (!list.length) return { avg: 0, high: "0/0", commits: 0 };
    const avg = Math.round((list.reduce((s, r) => s + (r.score || 0), 0) / list.length) * 10) / 10;
    const high = `${list.filter(r => r.score >= 80).length}/${list.length}`;
    return { avg, high, commits: 0 };
  }, [activeScores]);


  const handleReset = async () => {
    if (!window.confirm("This will clear all scores and analysis for this team. Uploaded files will be kept. Are you sure?")) return;
    setResetting(true);
    try {
      const res = await apiFetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      if (!res.ok) throw new Error("Reset failed");
      setScores(null);
      alert("Scores reset. Re-upload documents and re-run GitHub analysis to recalculate.");
    } catch (e) {
      alert(e.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div
      style={{
        padding: "80px 16px 24px",
        maxWidth: 1120,
        margin: "0 auto",
        minHeight: "100vh",
        background: theme.pageBg,
        color: theme.text,
      }}
    >
      {/* header */}
      <div style={rowBetween()}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: theme.text }}>
            Project Dashboard
          </h1>
          <div style={{ color: theme.subtext, fontSize: 14 }}>
            Monitor team contribution and performance metrics
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={handleReset}
          disabled={resetting}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: `1px solid #dc2626`,
            background: resetting ? "#fee2e2" : theme.buttonBg,
            cursor: resetting ? "not-allowed" : "pointer",
            fontSize: 13,
            color: "#dc2626",
            fontWeight: 500,
          }}
        >
          {resetting ? "Resetting..." : "Reset Scores"}
        </button>

         <button
          onClick={() => setPeerReview(v => !v)}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: `1px solid ${peerReview ? "#16a34a" : theme.border}`,
            background: peerReview ? "#f0fdf4" : theme.buttonBg,
            cursor: "pointer",
            fontSize: 13,
            color: peerReview ? "#16a34a" : theme.text,
            fontWeight: peerReview ? 600 : 400,
          }}
        >
          {peerReview ? "✓ Peer Review On" : "Peer Review Off"}
        </button>

        {sprints.length > 0 && (
          <select
            value={selectedSprint}
            onChange={e => {
              setSelectedSprint(e.target.value);
              setSprintScores(null);
            }}
            style={selectBox(theme)}
          >
            <option value="overall">Overall Score</option>
            {sprints.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.start_date} → {s.end_date})
              </option>
            ))}
          </select>
        )}

        <select
          value={teamId}
          onChange={async (e) => {
            const newTeamId = e.target.value;
            setTeamId(newTeamId);
            setSelectedSprint("overall");
            setSprintScores(null);
            localStorage.setItem("dashboardTeamId", newTeamId);
            setScores(null);
            setTeamStudents([]);
            apiFetch(`/api/sprints/team/${newTeamId}`)
              .then(r => r.json())
              .then(data => setSprints(Array.isArray(data) ? data : []))
              .catch(() => setSprints([]));
            sessionStorage.removeItem("dashboardScoresCache");
            sessionStorage.removeItem("dashboardStudentsCache");
            await apiFetch("/api/teams/active", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: newTeamId }),
            });
          }}
          style={{ ...selectBox(theme), minWidth: 160, width: "auto" }}
          title="Select project or team"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.code})
            </option>
          ))}
        </select>
        </div> 
      </div>

      {/* project card */}
      <div style={card(theme, { marginTop: 16, padding: 16 })}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: theme.text }}>
          {activeScores?.team?.name || "—"}
        </div>
        <div style={{ color: theme.subtext, fontSize: 14 }}>
          {activeScores?.team?.code || ""}
        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 18,
            color: theme.subtext,
            fontSize: 13,
            flexWrap: "wrap",
          }}
        >
          <InfoInline
            icon={<Users size={15} color={theme.mutedIcon} />}
            text={`${activeScores?.studentsCount || 0} Students`}
          />
          <InfoInline
  icon={<LinkIcon size={15} color={theme.mutedIcon} />}
  text={
    activeScores?.team?.repo?.url ||
    activeScores?.team?.repo_url ||
    activeScores?.team?.repoUrl ||
    activeScores?.team?.repository_url ||
    activeScores?.team?.repo ||
    teams.find((t) => t.id === teamId)?.repo?.url ||
    teams.find((t) => t.id === teamId)?.repo_url ||
    teams.find((t) => t.id === teamId)?.repoUrl ||
    teams.find((t) => t.id === teamId)?.repository_url ||
    teams.find((t) => t.id === teamId)?.repo ||
    "Repository not connected"
  }
/>
          
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          marginTop: 12,
        }}
      >
        <KpiCard
          theme={theme}
          title="Average Score"
          icon={<BarChart3 size={16} color={theme.mutedIcon} />}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: "#16a34a" }}>
            {kpis.avg}%
          </div>
          <Progress value={kpis.avg} theme={theme} />
        </KpiCard>

        <KpiCard
          theme={theme}
          title="High Contributors"
          icon={<UserRound size={16} color={theme.mutedIcon} />}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: theme.text }}>
            {kpis.high}
          </div>
          <div style={{ fontSize: 12, color: theme.subtext }}>
            Students scoring 80% or above
          </div>
        </KpiCard>

        <KpiCard
          theme={theme}
          title="Total Commits"
          icon={<GitCommitHorizontal size={16} color={theme.mutedIcon} />}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: theme.text }}>
            {kpis.commits}
          </div>
          <div style={{ fontSize: 12, color: theme.subtext }}>
            Across all team members
          </div>
        </KpiCard>
      </div>

      {/* search header */}
      <div style={card(theme, { marginTop: 16, paddingBottom: 10 })}>
        <div style={rowBetween()}>
          <div>
            <div style={{ fontWeight: 700, color: theme.text }}>Team Members</div>
            <div style={{ color: theme.subtext, fontSize: 13 }}>
              View and assess individual student contributions
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Search
                size={15}
                color={theme.mutedIcon}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search students..."
                style={inputBoxWithIcon(theme)}
              />
            </div>

            <div style={{ position: "relative" }}>
  <ChevronDown
    size={15}
    color={theme.mutedIcon}
    style={{
      position: "absolute",
      right: 10,
      top: "50%",
      transform: "translateY(-50%)",
      pointerEvents: "none",
    }}
  />
  <select
    value={selectedLevel}
    onChange={(e) => setSelectedLevel(e.target.value)}
    style={{
      ...ghostBtn(theme),
      paddingRight: 30,
      appearance: "none",
      minWidth: 130,
    }}
    title="Filter by contribution level"
  >
    <option value="all">All Levels</option>
    <option value="high">High Contributor</option>
    <option value="medium">Medium Contributor</option>
    <option value="low">Low Contributor</option>
  </select>
</div>
          </div>
        </div>
      </div>

      {/* rows */}
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {students.length === 0 && (
          <div style={card(theme)}>
            <div style={{ textAlign: "center", padding: "20px", color: theme.subtext }}>
              No student data available. Upload documents and configure team settings.
            </div>
          </div>
        )}

        {students.map((s) => {
          const breakdown = s.breakdown || {};
          const raw = s.raw || {};

          const weights = activeScores?.weights || {};
          const docWeights = {
            avgSentenceLength: weights.avgSentenceLength ?? 5,
            sentenceComplexity: weights.sentenceComplexity ?? 5,
            wordCount: weights.wordCount ?? 7,
            readability: weights.readability ?? 11
          };
          const docMetrics = {
            avgSentenceLength: breakdown.avgSentenceLength || 0,
            sentenceComplexity: breakdown.sentenceComplexity || 0,
            wordCount: breakdown.wordCount || 0,
            readability: breakdown.readability || 0
          };
          const totalDocWeight = Object.values(docWeights).reduce((sum, w) => sum + w, 0);
          const weightedDocScore = totalDocWeight > 0
            ? Object.entries(docMetrics).reduce((sum, [key, value]) => {
                return sum + (value * docWeights[key]);
              }, 0) / totalDocWeight
            : 0;
          const docScore = Math.round(weightedDocScore * 100);

          const codeScore = codeScoreByKey.get(s.email || s.name) ?? 0;
          const wordCount = raw.wordCount || 0;
          const attendance = Math.round((raw.attendance || 0) * 100);

          return (
            <div key={s.email || s.name} style={rowCard(theme)}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700, color: theme.text }}>{s.name}</div>
                  <Badge level={badgeFromScore(s.score)} />
                </div>
                <div style={{ color: theme.subtext, fontSize: 13, marginTop: 2 }}>{s.email}</div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 14,
                    marginTop: 12,
                    fontSize: 13,
                  }}
                >
                  <Metric theme={theme} label="Code Score" value={`${codeScore}%`} />
                  <Metric theme={theme} label="Doc Score" value={docScore > 0 ? `${docScore}%` : "—"} />
                  <Metric theme={theme} label="Word Count" value={wordCount > 0 ? wordCount : "—"} />
                  <Metric theme={theme} label="Attendance" value={attendance > 0 ? `${attendance}%` : "—"} />
                </div>
              </div>

              <div style={{ display: "grid", alignContent: "center", justifyItems: "end", gap: 6 }}>
                <div style={{ color: theme.subtext, fontSize: 12 }}>Overall Score</div>
                <div style={{ fontWeight: 700, color: scoreColor(s.score), fontSize: 32 }}>
                  {Math.round(s.score) || "—"}
                </div>
                {activeScores?.peerReviewApplied && s.peerMultiplier && (
                  <div style={{ fontSize: 11, color: theme.subtext, marginTop: 2 }}>
                    Base: {Math.round(s.baseScore)}% × {s.peerMultiplier}
                  </div>
                )}
                <div style={{ color: scoreColor(s.score), fontSize: 12, marginTop: -8 }}>%</div>

                <button onClick={() => onViewStudent?.(s)} style={linkBtn(theme)}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Eye size={15} />
                    View Details
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* helpers / small components */
function KpiCard({ title, icon, children, theme }) {
  return (
    <div style={card(theme)}>
      <div style={rowBetween({ fontSize: 13, color: theme.subtext })}>
        <span>{title}</span>
        <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>
      </div>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

function InfoInline({ icon, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {icon}
      <span>{text}</span>
    </div>
  );
}

function Progress({ value, theme }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 8, borderRadius: 999, background: theme.progressBg }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            background: "#16a34a",
          }}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, theme }) {
  return (
    <div>
      <div style={{ color: theme.subtext, fontSize: 12 }}>{label}:</div>
      <div style={{ fontWeight: 600, color: theme.text, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Badge({ level }) {
  const base = {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid",
    fontWeight: 600,
  };
  if (level === "high") return (
    <span style={{ ...base, color: "#065f46", borderColor: "#a7f3d0", background: "#ecfdf5" }}>
      high contributor
    </span>
  );
  if (level === "medium") return (
    <span style={{ ...base, color: "#92400e", borderColor: "#fde68a", background: "#fffbeb" }}>
      medium contributor
    </span>
  );
  return (
    <span style={{ ...base, color: "#991b1b", borderColor: "#fecaca", background: "#fef2f2" }}>
      low contributor
    </span>
  );
}

function badgeFromScore(s = 0) {
  if (s >= 80) return "high";
  if (s >= 60) return "medium";
  return "low";
}

function scoreColor(s = 0) {
  if (s >= 90) return "#16a34a";
  if (s >= 80) return "#22c55e";
  if (s >= 70) return "#2563eb";
  if (s >= 60) return "#ca8a04";
  if (s >= 50) return "#ea580c";
  return "#dc2626";
}

function card(theme, extra = {}) {
  return {
    background: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: 14,
    padding: 14,
    boxShadow: theme.shadow,
    ...extra,
  };
}

function rowCard(theme) {
  return {
    ...card(theme),
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 16,
    alignItems: "center",
  };
}

function inputBoxWithIcon(theme) {
  return {
    padding: "8px 12px 8px 32px",
    borderRadius: 10,
    border: `1px solid ${theme.border}`,
    background: theme.inputBg,
    color: theme.text,
    fontSize: 14,
    minWidth: 240,
    outline: "none",
  };
}

function selectBox(theme) {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${theme.border}`,
    background: theme.inputBg,
    color: theme.text,
    fontSize: 14,
    minWidth: 300,
    outline: "none",
  };
}

function ghostBtn(theme) {
  return {
    border: `1px solid ${theme.border}`,
    background: theme.buttonBg,
    color: theme.text,
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 13,
    cursor: "pointer",
  };
}

function linkBtn(theme) {
  return {
    border: `1px solid ${theme.border}`,
    background: theme.buttonBg,
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 600,
    color: theme.text,
  };
}

function rowBetween(extra = {}) {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    ...extra,
  };
}
