import React, { useEffect, useMemo, useState } from "react";

export default function Dashboard({ onViewStudent }) {
  const [teamId, setTeamId] = useState("");
  const [teams, setTeams] = useState([]);
  const [scores, setScores] = useState(null);
  const [query, setQuery] = useState("");

  const API = "http://localhost:5002";

  useEffect(() => {
    (async () => {
      const [tres, ares] = await Promise.all([
        fetch(`${API}/api/teams`).then(r => r.json()),
        fetch(`${API}/api/teams/active`).then(r => r.json()),
      ]);
      setTeams(tres || []);
      setTeamId(ares?.id || tres?.[0]?.id || "");
    })();
  }, []);

  useEffect(() => {
    if (!teamId) return;
    fetch(`${API}/api/scores?teamId=${encodeURIComponent(teamId)}`)
      .then(r => r.json())
      .then(setScores)
      .catch(() => setScores(null));
  }, [teamId]);

  const students = useMemo(() => {
    const list = scores?.ranking || [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(s =>
      (s.name || "").toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q)
    );
  }, [scores, query]);

  const kpis = useMemo(() => {
    const list = scores?.ranking || [];
    if (!list.length) return { avg: 0, high: "0/0", commits: 0 };
    
    const avg = Math.round((list.reduce((s, r) => s + (r.score || 0), 0) / list.length) * 10) / 10;
    const high = `${list.filter(r => r.score >= 80).length}/${list.length}`;
    
    return { avg, high, commits: 0 };
  }, [scores]);

  return (
    <div style={{ padding: "80px 16px 24px", maxWidth: 1120, margin: "0 auto" }}>
      <div style={rowBetween()}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Project Dashboard</h1>
          <div style={{ color: "#64748b", fontSize: 14 }}>
            Monitor team contribution and performance metrics
          </div>
        </div>

        <select
          value={teamId}
          onChange={async (e) => {
            const newTeamId = e.target.value;
            setTeamId(newTeamId);
            await fetch(`${API}/api/teams/active`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: newTeamId }),
            });
          }}
          style={selectBox()}
          title="select project / team"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.code})
            </option>
          ))}
        </select>
      </div>

      <div style={card({ marginTop: 16 })}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{scores?.team?.name || "—"}</div>
        <div style={{ color: "#64748b", fontSize: 14 }}>{scores?.team?.code || ""}</div>
        <div style={{ marginTop: 10, display: "flex", gap: 16, color: "#334155", fontSize: 13 }}>
          <span>👥 {scores?.studentsCount || 0} students</span>
          <span>🔗 {scores?.team?.repo?.url ? 
            <a href={scores.team.repo.url} target="_blank" rel="noopener noreferrer" 
               style={{ color: "#2563eb", textDecoration: "none" }}>
              {scores.team.repo.owner}/{scores.team.repo.repo}
            </a> : "No repo"}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 12 }}>
        <KpiCard title="Average Score" icon="📊">
          <div style={{ fontSize: 20, fontWeight: 700, color: "#16a34a" }}>{kpis.avg}%</div>
          <Progress value={kpis.avg} />
        </KpiCard>
        <KpiCard title="High Contributors" icon="👤">
          <div style={{ fontSize: 20, fontWeight: 700 }}>{kpis.high}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Students scoring ≥ 80%</div>
        </KpiCard>
        <KpiCard title="Total Commits" icon="💻">
          <div style={{ fontSize: 20, fontWeight: 700 }}>{kpis.commits}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Across all team members</div>
        </KpiCard>
      </div>

      <div style={card({ marginTop: 16, paddingBottom: 10 })}>
        <div style={rowBetween()}>
          <div>
            <div style={{ fontWeight: 700 }}>Team Members</div>
            <div style={{ color: "#64748b", fontSize: 13 }}>
              View and assess individual student contributions
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search students…"
              style={inputBox()}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {students.length === 0 && (
          <div style={card()}>
            <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
              No student data available. Upload documents and configure team settings.
            </div>
          </div>
        )}
        
        {students.map((s) => {
          const breakdown = s.breakdown || {};
          const raw = s.raw || {};
          
          // Get weights from scores response (dynamic from RuleSettings)
          const weights = scores?.weights || {};
          
          // Calculate weighted doc score using the rule weights
          // Fallback to default weights if not loaded
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
          
          // Word count from raw data
          const wordCount = raw.wordCount || 0;
          
          // Attendance percentage - use the pre-calculated percentage from AttendanceSummary
          const attendance = Math.round((raw.attendance || 0) * 100);
          
          return (
            <div key={s.email || s.name} style={rowCard()}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>{s.name}</div>
                  <Badge level={badgeFromScore(s.score)} />
                </div>
                <div style={{ color: "#64748b", fontSize: 13 }}>{s.email}</div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 10, fontSize: 13 }}>
                  <Metric label="Code Score" value="—" />
                  <Metric label="Doc Score" value={docScore > 0 ? `${docScore}%` : '—'} />
                  <Metric label="Word Count" value={wordCount > 0 ? wordCount : '—'} />
                  <Metric label="Attendance" value={attendance > 0 ? `${attendance}%` : '—'} />
                </div>
              </div>

              <div style={{ display: "grid", alignContent: "center", justifyItems: "end", gap: 6 }}>
                <div style={{ color: "#64748b", fontSize: 12 }}>Overall Score</div>
                <div style={{ fontWeight: 700, color: scoreColor(s.score), fontSize: 32 }}>
                  {Math.round(s.score) || '—'}
                </div>
                <div style={{ color: scoreColor(s.score), fontSize: 12, marginTop: -8 }}>%</div>
                <button onClick={() => onViewStudent?.(s)} style={linkBtn()}>
                  👁 View Details
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiCard({ title, icon, children }) {
  return (
    <div style={card()}>
      <div style={rowBetween({ fontSize: 13, color: "#64748b" })}>
        <span>{title}</span><span>{icon}</span>
      </div>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

function Progress({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "#16a34a" }} />
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div style={{ color: "#64748b", fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Badge({ level }) {
  const base = { fontSize: 11, padding: "2px 8px", borderRadius: 999, border: "1px solid" };
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

function card(extra = {}) {
  return {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 6px 14px rgba(0,0,0,.04)",
    ...extra
  };
}

function rowCard() {
  return {
    ...card(),
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 16,
    alignItems: "center"
  };
}

function inputBox() {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#fff",
    fontSize: 14,
    minWidth: 240
  };
}

function selectBox() {
  return { ...inputBox(), minWidth: 300 };
}

function linkBtn() {
  return {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 10,
    padding: "6px 10px",
    fontSize: 13,
    cursor: "pointer"
  };
}

function rowBetween(extra = {}) {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    ...extra
  };
}