
const METRIC_META = {
  loc:                { label: "Lines of Code",         group: "code", description: "Total lines of code written, scored relative to the highest contributor in the team. Reflects raw coding output." },
  editedCode:         { label: "Edited Code",           group: "code", description: "Volume of code actively changed or refactored. Indicates ongoing engagement with the codebase beyond initial writes." },
  commits:            { label: "Commits",               group: "code", description: "Number of commits to the repository relative to the team's top committer. Reflects frequency of contribution." },
  functions:          { label: "Functions Written",     group: "code", description: "New functions or methods authored. A proxy for feature and logic contribution to the codebase." },
  hotspots:           { label: "Hotspot Contribution",  group: "code", description: "Work concentrated in frequently-changed files - a strong signal of code ownership and active maintenance responsibility." },
  codeComplexity:     { label: "Code Complexity",       group: "code", description: "Relative complexity of authored code. Higher values mean more complex code was written; interpret alongside commits and LOC." },
  avgSentenceLength:  { label: "Avg Sentence Length",   group: "docs", description: "Average sentence length across submitted documents. Shorter, clearer sentences typically improve document quality." },
  sentenceComplexity: { label: "Sentence Complexity",   group: "docs", description: "Structural variety and complexity of written sentences. Reflects depth of written communication in documentation." },
  wordCount:          { label: "Word Count",            group: "docs", description: "Total documentation volume relative to the highest contributor. Reflects quantity of written output." },
  readability:        { label: "Readability",           group: "docs", description: "Clarity and ease of reading for submitted documents. Scored using standard readability measures - higher is clearer." },
};

function metricBarColor(score) {
  if (score >= 75) return "#16a34a";
  if (score >= 50) return "#2563eb";
  if (score >= 30) return "#d97706";
  return "#dc2626";
}

function metricBadge(score) {
  if (score >= 75) return { text: "Strong",  bg: "#dcfce7", color: "#166534" };
  if (score >= 50) return { text: "Average", bg: "#dbeafe", color: "#1e40af" };
  if (score >= 30) return { text: "Low",     bg: "#fef3c7", color: "#92400e" };
  return                   { text: "Minimal",bg: "#fee2e2", color: "#991b1b" };
}

export default function StudentDetail({ student, onBack, darkMode }) {
  const theme = darkMode
    ? {
        pageBg: "#0b1120",
        card: "#111827",
        text: "#f8fafc",
        subtext: "#94a3b8",
        border: "#1f2937",
        progressBg: "#1f2937",
        buttonBg: "#111827",
        shadow: "0 8px 20px rgba(0,0,0,.28)",
      }
    : {
        pageBg: "#f8fafc",
        card: "#ffffff",
        text: "#111827",
        subtext: "#6b7280",
        border: "#e5e7eb",
        progressBg: "#e5e7eb",
        buttonBg: "#ffffff",
        shadow: "0 4px 12px rgba(0,0,0,.04)",
      };

  if (!student) {
    return (
      <div
        style={{
          padding: "80px 16px",
          maxWidth: 960,
          margin: "0 auto",
          minHeight: "100vh",
          background: theme.pageBg,
          color: theme.text,
        }}
      >
        <button onClick={onBack} style={btn(theme)}>
          ← Back
        </button>
        <p style={{ color: theme.subtext }}>Student not found.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "80px 16px",
        maxWidth: 1000,
        margin: "0 auto",
        minHeight: "100vh",
        background: theme.pageBg,
        color: theme.text,
      }}
    >
      <button onClick={onBack} style={btn(theme)}>
        ← Back
      </button>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          marginTop: 8,
        }}
      >
        <div>
          <h1 style={{ margin: "8px 0 2px", fontSize: 22, color: theme.text }}>
            {student.name}
          </h1>
          <div style={{ color: theme.subtext, fontSize: 13 }}>{student.email}</div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ color: theme.subtext, fontSize: 12 }}>Overall Score</div>
          <div
            style={{
              fontWeight: 700,
              color: scoreCol(student.score),
              lineHeight: 1,
              fontSize: 18,
            }}
          >
            {student.score}
          </div>
          <div
            style={{
              color: scoreCol(student.score),
              fontSize: 12,
              marginTop: -2,
            }}
          >
            %
          </div>
        </div>
      </div>

      <div style={card(theme, { marginTop: 12 })}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 18,
          }}
        >
          <Metric theme={theme} k="Code Commits" v={Math.round(student.raw?.codeCommits || 0)} />
          <Metric
            theme={theme}
            k="Work Hours"
            v={`${Math.round(student.raw?.hours || 0)}h`}
          />
          <Metric theme={theme} k="Documents" v={Math.round(student.raw?.documents || 0)} />
          <Metric theme={theme} k="Meetings" v={Math.round(student.raw?.meetings || 0)} />
        </div>
      </div>

      <div style={card(theme, { marginTop: 12 })}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>Score Contribution by Metric</div>
          <div style={{ fontSize: 12, color: theme.subtext, marginTop: 5, lineHeight: 1.65 }}>
            Each metric is scored <strong style={{ color: theme.text }}>relative to the highest performer in the team</strong> - a score of 100 means this student leads the team on that metric; 0 means no recorded contribution. The overall score is a weighted average across all metrics below.
          </div>
        </div>

        {(() => {
          const breakdown = student.breakdown || {};
          const allEntries = Object.entries(breakdown);
          const codeEntries = allEntries.filter(([k]) => METRIC_META[k]?.group === "code");
          const docEntries  = allEntries.filter(([k]) => METRIC_META[k]?.group === "docs");
          const sorted = [...allEntries].sort(([, a], [, b]) => b - a);
          const best   = sorted[0];
          const worst  = sorted[sorted.length - 1];

          const MetricRow = ([k, v]) => {
            const score = Math.round((v || 0) * 100);
            const meta  = METRIC_META[k] || { label: k, description: "" };
            const badge = metricBadge(score);
            const color = metricBarColor(score);
            return (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr 52px", gap: 12, alignItems: "start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{meta.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 999, background: badge.bg, color: badge.color }}>{badge.text}</span>
                  </div>
                  <div style={{ fontSize: 11, color: theme.subtext, marginBottom: 7, lineHeight: 1.55 }}>{meta.description}</div>
                  <div style={{ height: 7, borderRadius: 999, background: theme.progressBg }}>
                    <div style={{ width: `${score}%`, height: "100%", borderRadius: 999, background: color }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", paddingTop: 2 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: color, lineHeight: 1 }}>{score}</div>
                  <div style={{ fontSize: 10, color: theme.subtext }}>/ 100</div>
                </div>
              </div>
            );
          };

          return (
            <>
              {best && worst && (
                <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 160, background: "#dcfce7", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#166534", marginBottom: 2 }}>▲ Strongest Metric</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#14532d" }}>{METRIC_META[best[0]]?.label || best[0]}</div>
                    <div style={{ fontSize: 12, color: "#166534" }}>{Math.round((best[1] || 0) * 100)} / 100</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 160, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#991b1b", marginBottom: 2 }}>▼ Weakest Metric</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#7f1d1d" }}>{METRIC_META[worst[0]]?.label || worst[0]}</div>
                    <div style={{ fontSize: 12, color: "#991b1b" }}>{Math.round((worst[1] || 0) * 100)} / 100</div>
                  </div>
                </div>
              )}

              <div style={{ fontSize: 11, fontWeight: 700, color: theme.subtext, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Code Metrics</div>
              <div style={{ display: "grid", gap: 14, marginBottom: 22 }}>
                {codeEntries.map(MetricRow)}
              </div>

              <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: theme.subtext, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Documentation Metrics</div>
                <div style={{ display: "grid", gap: 14 }}>
                  {docEntries.map(MetricRow)}
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

function card(theme, extra = {}) {
  return {
    background: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: 14,
    boxShadow: theme.shadow,
    ...extra,
  };
}


function btn(theme) {
  return {
    border: `1px solid ${theme.border}`,
    background: theme.buttonBg,
    color: theme.text,
    borderRadius: 10,
    padding: "6px 10px",
    fontSize: 12,
    cursor: "pointer",
  };
}

function Metric({ k, v, theme }) {
  return (
    <div>
      <div style={{ color: theme.subtext, fontSize: 12 }}>{k}:</div>
      <div style={{ fontWeight: 600, color: theme.text }}>{v}</div>
    </div>
  );
}

function scoreCol(n) {
  if (n >= 90) return "#16a34a";
  if (n >= 80) return "#22c55e";
  if (n >= 70) return "#2563eb";
  if (n >= 60) return "#ca8a04";
  if (n >= 50) return "#ea580c";
  return "#dc2626";
}
