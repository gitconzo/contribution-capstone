import React, { useEffect, useMemo, useState } from "react";

const API = "http://localhost:5002";

// Temporary mapping between student login accounts and GitHub contribution authors
const AUTHOR_MAP = {
  "student@university.edu": "KAAzadi",
  "student2@university.edu": "fourthedesign",
  "student3@university.edu": "Angel Bowers",
  "Student One": "KAAzadi",
  "Student Two": "fourthedesign",
  "Student Three": "Angel Bowers",
};

function normalizeText(value = "") {
  return String(value).trim().toLowerCase().replace(/\s+/g, "");
}

function getProgressColor(status) {
  if (status === "On Track") return "#166534";
  if (status === "Needs Attention") return "#92400e";
  return "#991b1b";
}

function getProgressBg(status) {
  if (status === "On Track") return "#dcfce7";
  if (status === "Needs Attention") return "#fef3c7";
  return "#fee2e2";
}

function MetricCard({ title, value, subtitle }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 18,
        boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>{value}</div>
      {subtitle && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>{subtitle}</div>}
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: 22,
        boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
      }}
    >
      <h3 style={{ margin: "0 0 16px 0", fontSize: 18, color: "#111827" }}>{title}</h3>
      {children}
    </div>
  );
}

function ProgressBar({ label, value }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div>
      <div
        style={{
          fontSize: 14,
          color: "#374151",
          marginBottom: 6,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{label}</span>
        <span>{safeValue}%</span>
      </div>

      <div style={{ height: 10, background: "#e5e7eb", borderRadius: 999 }}>
        <div
          style={{
            width: `${safeValue}%`,
            height: "100%",
            background: "#111827",
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

function getStatus(score = 0) {
  if (score >= 70) return "On Track";
  if (score >= 40) return "Needs Attention";
  return "At Risk";
}

function normalizeStudentRecord(record, user) {
  if (!record) return null;

  const raw = record.raw || {};
  const breakdown = record.breakdown || {};

  const commits =
    Math.round(raw.codeCommits || 0) ||
    Math.round(raw.commits || 0) ||
    Math.round(raw.totalCommits || 0) ||
    Math.round(record.commits || 0) ||
    0;

  const worklogHours =
    Math.round(raw.worklogHours || 0) ||
    Math.round(record.worklogHours || 0) ||
    0;

  const documents =
    Math.round(raw.documents || 0) ||
    Math.round(record.documents || 0) ||
    0;

  const meetings =
    Math.round(raw.meetings || 0) ||
    Math.round(record.meetings || 0) ||
    0;

  return {
    displayName: user?.name || record.name || record.author || "Student",
    email: record.email || user?.email || "N/A",
    score: Number(record.score || 0),
    rank: Number(record.rank || 0),
    commits,
    worklogHours,
    documents,
    meetings,
    percent: record.percent || "",
    breakdown,
    raw,
  };
}

function matchStudentRecord(ranking = [], user) {
  if (!user) return null;

  const email = normalizeText(user.email || "");
  const name = normalizeText(user.name || "");
  const githubAuthor = normalizeText(
    user.githubAuthor || AUTHOR_MAP[user.email] || AUTHOR_MAP[user.name] || ""
  );

  return (
    ranking.find((r) => normalizeText(r.email || "") === email) ||
    ranking.find((r) => normalizeText(r.name || "") === name) ||
    ranking.find((r) => normalizeText(r.author || "") === githubAuthor) ||
    ranking.find((r) => normalizeText(r.author || "").includes(githubAuthor)) ||
    ranking.find((r) => githubAuthor.includes(normalizeText(r.author || ""))) ||
    null
  );
}

function average(values = []) {
  const valid = values.filter((v) => Number.isFinite(v));
  if (!valid.length) return 0;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function safePercentFromRatio(value, max) {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return Math.round((value / max) * 100);
}

export default function StudentDashboard() {
  const savedUser = useMemo(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  }, []);

  const [team, setTeam] = useState(null);
  const [scores, setScores] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState("");
  const [showSecurityNotice, setShowSecurityNotice] = useState(
    savedUser?.usingDefaultPassword === true
  );

  useEffect(() => {
    const savedPhoto = localStorage.getItem("student_profile_photo");
    if (savedPhoto) {
      setProfilePhoto(savedPhoto);
    }
  }, []);

  useEffect(() => {
    if (!showSecurityNotice) return;

    const timer = setTimeout(() => {
      setShowSecurityNotice(false);
    }, 25000);

    return () => clearTimeout(timer);
  }, [showSecurityNotice]);

  useEffect(() => {
    async function loadData() {
      try {
        const [teamsRes, activeRes] = await Promise.all([
          fetch(`${API}/api/teams`).then((r) => r.json()),
          fetch(`${API}/api/teams/active`).then((r) => r.json()),
        ]);

        const activeTeamId = activeRes?.id || teamsRes?.[0]?.id || "";

        if (!activeTeamId) {
          setScores(null);
          setTeam(null);
          return;
        }

        const scoreData = await fetch(
          `${API}/api/scores?teamId=${encodeURIComponent(activeTeamId)}`
        ).then((r) => r.json());

        setScores(scoreData || null);
        setTeam(scoreData?.team || activeRes || null);
      } catch (error) {
        console.error("Failed to load student dashboard data:", error);
        setScores(null);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const ranking = scores?.ranking || [];
  const matchedRecord = matchStudentRecord(ranking, savedUser);
  const student = normalizeStudentRecord(matchedRecord, savedUser);

  const expectedAuthor =
    savedUser?.githubAuthor || AUTHOR_MAP[savedUser?.email] || AUTHOR_MAP[savedUser?.name] || "No mapping found";

  const availableAuthors = ranking.map((r) => r.author || r.name || r.email || "Unknown");

  const teamSize = ranking.length || 0;
  const progressStatus = getStatus(student?.score || 0);

  const contributionBreakdown = useMemo(() => {
    if (!student || !ranking.length) {
      return {
        githubActivity: 0,
        worklogContribution: 0,
        documentationContribution: 0,
        meetingParticipation: 0,
      };
    }

    const codeBreakdown = student.breakdown || {};
    const raw = student.raw || {};

    const githubActivity = Math.round(
      average([
        (codeBreakdown.loc || 0) * 100,
        (codeBreakdown.editedCode || 0) * 100,
        (codeBreakdown.commits || 0) * 100,
        (codeBreakdown.functions || 0) * 100,
        (codeBreakdown.hotspots || 0) * 100,
        (codeBreakdown.codeComplexity || 0) * 100,
      ])
    );

    const documentationContribution = Math.round(
      average([
        (codeBreakdown.avgSentenceLength || 0) * 100,
        (codeBreakdown.sentenceComplexity || 0) * 100,
        (codeBreakdown.wordCount || 0) * 100,
        (codeBreakdown.readability || 0) * 100,
      ])
    );

    const maxWorklogHours = Math.max(
      ...ranking.map((r) => Number(r.raw?.worklogHours || r.worklogHours || 0)),
      0
    );

    const maxMeetings = Math.max(
      ...ranking.map((r) => Number(r.raw?.meetings || r.meetings || 0)),
      0
    );

    let worklogContribution = 0;
    if (maxWorklogHours > 0) {
      worklogContribution = safePercentFromRatio(
        Number(raw.worklogHours || student.worklogHours || 0),
        maxWorklogHours
      );
    }

    let meetingParticipation = 0;
    if (Number.isFinite(raw.attendance)) {
      meetingParticipation = Math.round((raw.attendance || 0) * 100);
    } else if (maxMeetings > 0) {
      meetingParticipation = safePercentFromRatio(
        Number(raw.meetings || student.meetings || 0),
        maxMeetings
      );
    }

    return {
      githubActivity,
      worklogContribution,
      documentationContribution,
      meetingParticipation,
    };
  }, [student, ranking]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 24,
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Student Dashboard</h2>
          <p style={{ color: "#6b7280" }}>Loading your contribution data...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div style={{ padding: 24 }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 24,
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Student Dashboard</h2>
          <p style={{ color: "#6b7280" }}>
            Your student record could not be matched with the current team contribution data.
          </p>
          <p style={{ color: "#6b7280" }}>
            Logged in as: <strong>{savedUser?.name || savedUser?.email || "Unknown user"}</strong>
          </p>
          <p style={{ color: "#6b7280" }}>
            Expected GitHub author: <strong>{expectedAuthor}</strong>
          </p>
          <p style={{ color: "#6b7280" }}>
            Available ranking authors: <strong>{availableAuthors.join(", ") || "No authors found"}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: "#f9fafb", minHeight: "100vh" }}>
      <style>{`
        @keyframes slideInToast {
          from {
            opacity: 0;
            transform: translateY(-10px) translateX(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0) translateX(0);
          }
        }
      `}</style>

      {showSecurityNotice && (
        <div
          style={{
            position: "fixed",
            top: 86,
            right: 24,
            width: 360,
            maxWidth: "calc(100vw - 32px)",
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid #fca5a5",
            borderLeft: "5px solid #dc2626",
            borderRadius: 16,
            boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
            padding: "14px 14px 14px 16px",
            zIndex: 1200,
            animation: "slideInToast 0.28s ease-out",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 12 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: "#fef2f2",
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  flexShrink: 0,
                  border: "1px solid #fecaca",
                }}
              >
                ⚠
              </div>

              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#111827",
                    marginBottom: 4,
                  }}
                >
                  Security Reminder
                </div>

                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "#4b5563",
                  }}
                >
                  Your account is still using the default password. Please update it in{" "}
                  <strong style={{ color: "#111827" }}>Settings</strong> for better security.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSecurityNotice(false)}
              style={{
                border: "none",
                background: "transparent",
                color: "#6b7280",
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
                padding: 2,
                flexShrink: 0,
              }}
              aria-label="Close notification"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 20,
            padding: 24,
            marginBottom: 22,
            boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  width: 82,
                  height: 82,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "2px solid #d1d5db",
                  background: "#e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {profilePhoto ? (
                  <img
                    src={profilePhoto}
                    alt="Profile"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 30 }}>👤</span>
                )}
              </div>

              <div>
                <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 6 }}>
                  Student Contribution Dashboard
                </div>
                <h1 style={{ margin: 0, fontSize: 30, color: "#111827" }}>
                  Welcome, {student.displayName}
                </h1>
                <p style={{ margin: "8px 0 0 0", color: "#6b7280" }}>
                  Email: {student.email} | Team: {team?.name || "Active Team"}
                </p>
              </div>
            </div>

            <div
              style={{
                position: "relative",
                display: "inline-block",
              }}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 999,
                  background: getProgressBg(progressStatus),
                  color: getProgressColor(progressStatus),
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {progressStatus}
              </div>

              {showTooltip && (
                <div
                  style={{
                    position: "absolute",
                    top: "120%",
                    right: 0,
                    width: 220,
                    background: "#111827",
                    color: "#fff",
                    padding: 12,
                    borderRadius: 10,
                    fontSize: 13,
                    lineHeight: 1.7,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.2)",
                    zIndex: 20,
                  }}
                >
                  0–40% → At Risk
                  <br />
                  40–70% → Needs Attention
                  <br />
                  70–100% → On Track
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 18,
            marginBottom: 22,
          }}
        >
          <MetricCard
            title="Contribution Score"
            value={`${student.score}%`}
            subtitle="Overall contribution score"
          />
          <MetricCard
            title="GitHub Commits"
            value={student.commits}
            subtitle="Recorded code contribution"
          />
          <MetricCard
            title="Worklog Hours"
            value={`${student.worklogHours}h`}
            subtitle="Tracked worklog contribution"
          />
          <MetricCard
            title="Team Rank"
            value={`${student.rank} / ${teamSize}`}
            subtitle="Your current position in the team"
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 18,
          }}
        >
          <SectionCard title="Contribution Breakdown">
            <div style={{ display: "grid", gap: 14 }}>
              <ProgressBar label="GitHub Activity" value={contributionBreakdown.githubActivity} />
              <ProgressBar label="Worklog Contribution" value={contributionBreakdown.worklogContribution} />
              <ProgressBar label="Documentation Contribution" value={contributionBreakdown.documentationContribution} />
              <ProgressBar label="Meeting Participation" value={contributionBreakdown.meetingParticipation} />
            </div>
          </SectionCard>

          <SectionCard title="Personal Progress Summary">
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Current Score</div>
                <div style={{ fontWeight: 600, color: "#111827" }}>{student.score}%</div>
              </div>

              <div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Code Contribution</div>
                <div style={{ color: "#111827" }}>{student.commits} recorded commits</div>
              </div>

              <div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Documentation Contribution</div>
                <div style={{ color: "#111827" }}>{student.documents} documented contributions</div>
              </div>

              <div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Meeting Participation</div>
                <div style={{ color: "#111827" }}>{student.meetings} recorded meetings</div>
              </div>

              <div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Rank Summary</div>
                <div style={{ color: "#111827" }}>
                  You are currently ranked <strong>{student.rank}</strong> out of{" "}
                  <strong>{teamSize}</strong> team members based on current contribution data.
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}