// frontend/src/pages/UploadsReview.jsx
import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";

export default function UploadsReview({ darkMode, activeTeamId = "", teams = [], onBack }) {
  const [pendingUploads, setPendingUploads] = useState([]);
  const [loading, setLoading] = useState(false);

  const theme = darkMode
    ? {
        pageBg: "#0b1120",
        card: "#111827",
        text: "#f8fafc",
        subtext: "#94a3b8",
        border: "#1f2937",
        buttonBg: "#111827",
      }
    : {
        pageBg: "#f8fafc",
        card: "#ffffff",
        text: "#0f172a",
        subtext: "#64748b",
        border: "#e5e7eb",
        buttonBg: "#ffffff",
      };

  function formatDateTime(value) {
    if (!value) return "Unknown";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
  }

  function prettyType(value = "") {
    const map = {
      worklog: "Worklog",
      peer_review: "Peer Review",
      attendance: "Attendance Sheet",
      sprint_report: "Sprint Report",
      project_plan: "Project Plan",
    };
    return map[value] || value || "Unknown";
  }

  useEffect(() => {
    async function loadPendingUploads() {
      if (!activeTeamId) {
        setPendingUploads([]);
        return;
      }

      try {
        setLoading(true);
        const res = await apiFetch(
          `/api/uploads/pending?teamId=${encodeURIComponent(activeTeamId)}`
        );
        const data = await res.json();

        if (!res.ok) {
          console.error(data.error || "Failed to load pending uploads");
          setPendingUploads([]);
          return;
        }

        setPendingUploads(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load pending uploads:", error);
        setPendingUploads([]);
      } finally {
        setLoading(false);
      }
    }

    loadPendingUploads();
  }, [activeTeamId]);

  const currentTeam = teams.find((t) => t.id === activeTeamId);

  return (
    <div
    style={{
        padding: "80px 16px 24px",
        maxWidth: 980,
        margin: "0 auto",
        minHeight: "100vh",
        background: theme.pageBg,
        color: theme.text,
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <button
          onClick={() => onBack?.()}
          style={{
            border: `1px solid ${theme.border}`,
            background: theme.card,
            color: theme.text,
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 13,
            cursor: "pointer",
            marginBottom: 16,
          }}
        >
          ← Back
        </button>

        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: theme.text }}>
          Uploads Review
        </h1>
        <div style={{ marginTop: 6, color: theme.subtext, fontSize: 14 }}>
          Review student uploads waiting for approval
          {currentTeam ? ` for ${currentTeam.name} (${currentTeam.code || ""})` : ""}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {loading ? (
          <div
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div style={{ color: theme.subtext }}>Loading pending uploads...</div>
          </div>
        ) : pendingUploads.length === 0 ? (
          <div
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div style={{ color: theme.subtext }}>No pending uploads for this group.</div>
          </div>
        ) : (
          pendingUploads.map((file) => (
            <div
              key={file.id}
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: 14,
                padding: 16,
                boxShadow: "0 6px 14px rgba(0,0,0,.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <div style={{
                  fontWeight: 700,
                  color: theme.text,
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {file.original_name || "Unnamed file"}
                </div>

                <span style={{
                  padding: "3px 8px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  flexShrink: 0,
                  ...(
                    (file.approval_status || "pending") === "approved" || file.approval_status === "confirmed"
                      ? { background: "#dcfce7", color: "#166534" }
                      : file.approval_status === "rejected"
                      ? { background: "#fee2e2", color: "#991b1b" }
                      : { background: "#fef3c7", color: "#92400e" }
                  ),
                }}>
                  {(file.approval_status || "PENDING").toUpperCase()}
                </span>
              </div>

              <div style={{ display: "grid", gap: 4, fontSize: 14, color: theme.subtext }}>
                <div>
                  Uploaded by: <strong style={{ color: theme.text }}>
                    {file.uploaded_by_name || file.uploaded_by_email || "Unknown"}
                  </strong>
                </div>
                <div>
                  Type: <strong style={{ color: theme.text }}>
                    {prettyType(file.user_type || file.detected_type)}
                  </strong>
                </div>
                <div>
                  Uploaded: <strong style={{ color: theme.text }}>
                    {formatDateTime(file.upload_date)}
                  </strong>
                </div>
                <div>
                  Status: <strong style={{ color: theme.text }}>
                    {file.status || "pending"}
                  </strong>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button
                  onClick={async () => {
                    try {
                      const res = await apiFetch(`/api/uploads/${file.id}/download`);
                      const data = await res.json();
                      if (data.url) window.open(data.url, "_blank");
                    } catch (err) {
                      console.error("Failed to open file", err);
                    }
                  }}
                  style={uploadBtn({ border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8" })}
                >
                  View File
                </button>

                <button
                  onClick={async () => {
                    try {
                      const res = await apiFetch(`/api/uploads/${file.id}/approve`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ approvedBy: "Lecturer" }),
                      });
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data.error || "Approve failed");
                      }
                      setPendingUploads((prev) => prev.filter((f) => f.id !== file.id));
                      window.dispatchEvent(new Event("uploadsUpdated"));
                    } catch (err) {
                      console.error("Approve failed", err);
                    }
                  }}
                  style={uploadBtn({ border: "1px solid #86efac", background: "#dcfce7", color: "#166534" })}
                >
                  Approve
                </button>

                <button
                  onClick={async () => {
                    try {
                      const res = await apiFetch(`/api/uploads/${file.id}/reject`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ approvedBy: "Lecturer", declineReason: "Rejected by lecturer" }),
                      });
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data.error || "Reject failed");
                      }
                      setPendingUploads((prev) => prev.filter((f) => f.id !== file.id));
                      window.dispatchEvent(new Event("uploadsUpdated"));
                    } catch (err) {
                      console.error("Reject failed", err);
                    }
                  }}
                  style={uploadBtn({ border: "1px solid #fca5a5", background: "#fee2e2", color: "#991b1b" })}
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function uploadBtn(extra = {}) {
  return {
    border: "none",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    ...extra,
  };
}