import React from "react";

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
            v={`${Math.round(student.raw?.worklogHours || 0)}h`}
          />
          <Metric theme={theme} k="Documents" v={Math.round(student.raw?.documents || 0)} />
          <Metric theme={theme} k="Meetings" v={Math.round(student.raw?.meetings || 0)} />
        </div>
      </div>

      <div style={card(theme, { marginTop: 12 })}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: theme.text }}>
          Metric Breakdown (Normalized)
        </div>

        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "grid",
            gap: 8,
          }}
        >
          {Object.entries(student.breakdown || {}).map(([k, v]) => (
            <li key={k} style={row()}>
              <span
                style={{
                  width: 160,
                  textTransform: "capitalize",
                  color: theme.subtext,
                  fontSize: 12,
                }}
              >
                {k}
              </span>

              <span style={{ flex: 1 }}>
                <div
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: theme.progressBg,
                  }}
                >
                  <div
                    style={{
                      width: `${Math.round((v || 0) * 100)}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: "#2563eb",
                    }}
                  />
                </div>
              </span>

              <span
                style={{
                  width: 40,
                  textAlign: "right",
                  fontSize: 12,
                  color: theme.text,
                }}
              >
                {Math.round((v || 0) * 100)}
              </span>
            </li>
          ))}
        </ul>
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

function row() {
  return {
    display: "grid",
    gridTemplateColumns: "160px 1fr 40px",
    alignItems: "center",
    gap: 10,
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

