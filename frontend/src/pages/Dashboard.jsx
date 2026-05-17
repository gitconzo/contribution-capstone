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
  AlertTriangle,
  RefreshCw,
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
        text: "#0f172a",
        subtext: "#64748b",
        border: "#e5e7eb",
        inputBg: "#ffffff",
        mutedIcon: "#64748b",
        progressBg: "#e5e7eb",
        shadow: "0 6px 14px rgba(0,0,0,.04)",
        buttonBg: "#ffffff",
      };

  const loadScores = () => {
    if (!teamId) return;

    fetch(`${API}/api/scores?teamId=${encodeURIComponent(teamId)}`)
      .then((r) => r.json())
      .then(setScores)
      .catch(() => setScores(null));
  };

  useEffect(() => {
    (async () => {
      try {
        const [tres, ares] = await Promise.all([
          fetch(`${API}/api/teams`).then((r) => r.json()),
          fetch(`${API}/api/teams/active`).then((r) => r.json()),
        ]);

        setTeams(tres || []);
        setTeamId(ares?.teamId || tres?.[0]?.id || "");
      } catch {
        setTeams([]);
        setTeamId("");
      }
    })();
  }, []);

  useEffect(() => {
    loadScores();
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

    if (!list.length) return { avg: 0, high: "0/0", commits: 0, risk: 0 };

    const avg =
      Math.round(
        (list.reduce((sum, r) => sum + (r.score || 0), 0) / list.length) * 10
      ) / 10;

    const high = `${list.filter((r) => r.score >= 80).length}/${list.length}`;

    const commits = list.reduce(
      (sum, r) => sum + Math.round(r.raw?.codeCommits || 0),
      0
    );

    const risk = list.filter((r) => r.score < 60).length;

    return { avg, high, commits, risk };
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
      <div style={rowBetween({ gap: 16, flexWrap: "wrap" })}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              color: theme.text,
            }}
          >
            Project Dashboard
          </h1>
          <div style={{ color: theme.subtext, fontSize: 14, marginTop: 4 }}>
            Monitor team contribution, at-risk students, and performance metrics.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={loadScores} style={refreshBtn(theme)}>
            <RefreshCw size={15} />
            Refresh
          </button>

          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            style={selectBox(theme)}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={card(theme, { marginTop: 18 })}>
        <div style={{ fontWeight: 800, marginBottom: 6, fontSize: 16 }}>
          {scores?.team?.name || "—"}
        </div>

        <div style={{ color: theme.subtext, fontSize: 14 }}>
          {scores?.team?.code || ""}
        </div>

        <div
          style={{
            marginTop: 12,
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
          {kpis.risk > 0 && (
            <InfoInline
              icon={<AlertTriangle size={15} color="#dc2626" />}
              text={`${kpis.risk} At-risk students`}
            />
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          marginTop: 14,
        }}
      >
        <KpiCard
          theme={theme}
          title="Average Score"
          icon={<BarChart3 size={16} color={theme.mutedIcon} />}
        >
          <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>
            {kpis.avg}%
          </div>
          <Progress value={kpis.avg} theme={theme} />
        </KpiCard>

        <KpiCard
          theme={theme}
          title="High Contributors"
          icon={<UserRound size={16} color={theme.mutedIcon} />}
        >
          <div style={{ fontSize: 22, fontWeight: 800 }}>{kpis.high}</div>
          <div style={{ fontSize: 12, color: theme.subtext }}>
            Students scoring 80% or above
          </div>
        </KpiCard>

        <KpiCard
          theme={theme}
          title="Total Commits"
          icon={<GitCommitHorizontal size={16} color={theme.mutedIcon} />}
        >
          <div style={{ fontSize: 22, fontWeight: 800 }}>{kpis.commits}</div>
          <div style={{ fontSize: 12, color: theme.subtext }}>
            Across all team members
          </div>
        </KpiCard>

        <KpiCard
          theme={theme}
          title="At-risk Students"
          icon={<AlertTriangle size={16} color="#dc2626" />}
        >
          <div style={{ fontSize: 22, fontWeight: 800, color: "#dc2626" }}>
            {kpis.risk}
          </div>
          <div style={{ fontSize: 12, color: theme.subtext }}>
            Students scoring below 60%
          </div>
        </KpiCard>
      </div>

      <div style={card(theme, { marginTop: 18 })}>
        <div style={rowBetween({ gap: 14, flexWrap: "wrap" })}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Team Members</div>
            <div style={{ color: theme.subtext, fontSize: 13 }}>
              View and assess individual student contributions.
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

            <button style={ghostBtn(theme)}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ChevronDown size={15} />
                All Levels
              </span>
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
        {students.map((s) => (
          <div key={s.email || s.name} style={rowCard(theme)}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{s.name}</div>
                <Badge level={badgeFromScore(s.score)} />
              </div>

              <div style={{ color: theme.subtext, fontSize: 13, marginTop: 4 }}>
                {s.email}
              </div>

              {s.score < 60 && (
                <div style={atRiskWarning()}>
                  <AlertTriangle size={16} />
                  <span>At Risk</span>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 16,
                  marginTop: 14,
                  fontSize: 13,
                  lineHeight: 1.5,
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
                  label="Internal Meetings"
                  value={Math.round(s.raw?.internalMeetings || 0)}
                />

                <Metric
                  theme={theme}
                  label="Supervisor Meetings"
                  value={Math.round(s.raw?.supervisorMeetings || 0)}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                alignContent: "center",
                justifyItems: "end",
                gap: 6,
              }}
            >
              <div style={{ color: theme.subtext, fontSize: 12 }}>
                Overall Score
              </div>

              <div style={{ fontWeight: 800, color: scoreColor(s.score), fontSize: 18 }}>
                {s.score}
              </div>

              <div style={{ color: scoreColor(s.score), fontSize: 12, marginTop: -4 }}>
                %
              </div>

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

function KpiCard({ title, icon, children, theme }) {
  return (
    <div style={card(theme)}>
      <div style={rowBetween({ fontSize: 13, color: theme.subtext })}>
        <span>{title}</span>
        <span>{icon}</span>
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
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
    <div style={{ marginTop: 10 }}>
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
      <div style={{ color: theme.subtext, fontSize: 12, marginBottom: 2 }}>
        {label}:
      </div>
      <div style={{ fontWeight: 700, color: theme.text }}>{value}</div>
    </div>
  );
}

function Badge({ level }) {
  const base = {
    fontSize: 11,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontWeight: 700,
  };

  if (level === "high") {
    return (
      <span style={{ ...base, color: "#166534", borderColor: "#bbf7d0", background: "#f0fdf4" }}>
        High Contribution
      </span>
    );
  }

  if (level === "medium") {
    return (
      <span style={{ ...base, color: "#92400e", borderColor: "#fde68a", background: "#fffbeb" }}>
        Moderate Contribution
      </span>
    );
  }

  return (
    <span style={{ ...base, color: "#991b1b", borderColor: "#fecaca", background: "#fef2f2" }}>
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
    borderRadius: 16,
    padding: 18,
    boxShadow: theme.shadow,
    ...extra,
  };
}

function rowCard(theme) {
  return {
    ...card(theme),
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 18,
    alignItems: "center",
  };
}

function atRiskWarning() {
  return {
    marginTop: 10,
    padding: "7px 10px",
    borderRadius: 999,
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontWeight: 800,
    fontSize: 12,
    width: "fit-content",
  };
}

function inputBoxWithIcon(theme) {
  return {
    padding: "9px 12px 9px 32px",
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

function refreshBtn(theme) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    border: `1px solid ${theme.border}`,
    background: "#111827",
    color: "#ffffff",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 800,
  };
}

function ghostBtn(theme) {
  return {
    border: `1px solid ${theme.border}`,
    background: theme.buttonBg,
    color: theme.text,
    borderRadius: 10,
    padding: "9px 10px",
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
    fontWeight: 700,
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
