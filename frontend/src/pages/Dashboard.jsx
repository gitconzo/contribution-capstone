import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  Link as LinkIcon,
  BarChart3,
  UserRound,
  GitCommitHorizontal,
  Eye,
  ChevronDown,
  Search,
} from "lucide-react";

export default function Dashboard({ onViewStudent, darkMode }) {
  const [teamId, setTeamId] = useState("");
  const [teams, setTeams] = useState([]);
  const [scores, setScores] = useState(null);
  const [query, setQuery] = useState("");

  const API = "http://localhost:5002";

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
      const [tres, ares] = await Promise.all([
        fetch(`${API}/api/teams`).then((r) => r.json()),
        fetch(`${API}/api/teams/active`).then((r) => r.json()),
      ]);
      setTeams(tres || []);
      setTeamId(ares?.teamId || tres?.[0]?.id || "");
    })();
  }, []);

  useEffect(() => {
    if (!teamId) return;
    fetch(`${API}/api/scores?teamId=${encodeURIComponent(teamId)}`)
      .then((r) => r.json())
      .then(setScores)
      .catch(() => setScores(null));
  }, [teamId]);

  const students = useMemo(() => {
    const list = scores?.ranking || [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q)
    );
  }, [scores, query]);

  const kpis = useMemo(() => {
    const list = scores?.ranking || [];
    if (!list.length) return { avg: 0, high: "0/0", commits: 0 };
    const avg =
      Math.round(
        (list.reduce((sum, r) => sum + (r.score || 0), 0) / list.length) * 10
      ) / 10;
    const high = `${list.filter((r) => r.score >= 80).length}/${list.length}`;
    const commits = list.reduce(
      (sum, r) => sum + Math.round(r.raw?.codeCommits || 0),
      0
    );
    return { avg, high, commits };
  }, [scores]);

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

        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          style={selectBox(theme)}
          title="Select project or team"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.code})
            </option>
          ))}
        </select>
      </div>

      {/* project card */}
      <div style={card(theme, { marginTop: 16, padding: 16 })}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: theme.text }}>
          {scores?.team?.name || "—"}
        </div>
        <div style={{ color: theme.subtext, fontSize: 14 }}>
          {scores?.team?.code || ""}
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
            text={`${scores?.studentsCount || 0} Students`}
          />
          <InfoInline
            icon={<LinkIcon size={15} color={theme.mutedIcon} />}
            text={scores?.team?.repo?.url || "Repository not connected"}
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

            <button style={ghostBtn(theme)} title="All Levels">
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ChevronDown size={15} />
                All Levels
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* rows */}
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {students.map((s) => (
          <div key={s.email || s.name} style={rowCard(theme)}>
            <div>
              <div
                style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
              >
                <div style={{ fontWeight: 700, color: theme.text }}>{s.name}</div>
                <Badge level={badgeFromScore(s.score)} />
              </div>

              <div style={{ color: theme.subtext, fontSize: 13, marginTop: 2 }}>
                {s.email}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 14,
                  marginTop: 12,
                  fontSize: 13,
                }}
              >
                <Metric
                  theme={theme}
                  label="Code Contribution"
                  value={Math.round(s.raw?.codeCommits || 0)}
                />
                <Metric
                  theme={theme}
                  label="Work Hours"
                  value={`${Math.round(s.raw?.worklogHours || 0)}h`}
                />
                <Metric
                  theme={theme}
                  label="Documentation"
                  value={Math.round(s.raw?.documents || 0)}
                />
                <Metric
                  theme={theme}
                  label="Meetings"
                  value={Math.round(s.raw?.meetings || 0)}
                />
              </div>
            </div>

            <div
              style={{ display: "grid", alignContent: "center", justifyItems: "end", gap: 6 }}
            >
              <div style={{ color: theme.subtext, fontSize: 12 }}>Overall Score</div>
              <div style={{ fontWeight: 700, color: scoreColor(s.score), fontSize: 16 }}>
                {s.score}
              </div>
              <div style={{ color: scoreColor(s.score), fontSize: 12, marginTop: -4 }}>%</div>

              <button onClick={() => onViewStudent?.(s)} style={linkBtn(theme)}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Eye size={15} />
                  View Details
                </span>
              </button>
            </div>
          </div>
        ))}
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
      <div style={{ fontWeight: 600, color: theme.text }}>{value}</div>
    </div>
  );
}

function Badge({ level }) {
  const base = {
    fontSize: 11,
    padding: "3px 9px",
    borderRadius: 999,
    border: "1px solid",
    fontWeight: 600,
    letterSpacing: "0.1px",
    textTransform: "capitalize",
  };

  if (level === "high") {
    return (
      <span
        style={{
          ...base,
          color: "#166534",
          borderColor: "#bbf7d0",
          background: "#f0fdf4",
        }}
      >
        High Contribution
      </span>
    );
  }

  if (level === "medium") {
    return (
      <span
        style={{
          ...base,
          color: "#92400e",
          borderColor: "#fde68a",
          background: "#fffbeb",
        }}
      >
        Moderate Contribution
      </span>
    );
  }

  return (
    <span
      style={{
        ...base,
        color: "#991b1b",
        borderColor: "#fecaca",
        background: "#fef2f2",
      }}
    >
      Low Contribution
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

