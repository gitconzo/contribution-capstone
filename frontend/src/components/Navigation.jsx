import React from "react";

export default function Navigation({
  currentPage,
  onNavigate,
  onLogout,
  onToggleDark,
  user,
}) {
  const isStudent = user?.role === "student";
  const isTeacher = user?.role === "teacher";

  const teacherMenuItems = [
    { key: "dashboard", label: "Dashboard" },
    { key: "rules", label: "Rule Settings" },
    { key: "upload", label: "Upload Data" },
    { key: "setup-team", label: "Setup Team" },
    { key: "lecturer-settings", label: "Settings" },
  ];

  const studentMenuItems = [
    { key: "student-dashboard", label: "My Progress" },
    { key: "settings", label: "Settings" },
  ];

  const menuItems = isStudent ? studentMenuItems : teacherMenuItems;

  const displayName = user?.name || (isTeacher ? "Lecturer" : "Student");
  const displayRole = isTeacher ? "Teacher" : isStudent ? "Student" : "";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        background: "#fff",
        borderBottom: "1px solid #e5e7eb",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "#000",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              flex: "0 0 auto",
            }}
            aria-hidden
          >
            👥
          </div>

          <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: "nowrap" }}>
            Project17
          </span>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginLeft: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {menuItems.map((item) => {
              const active = currentPage === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onNavigate?.(item.key)}
                  style={{
                    border: "1px solid #e5e7eb",
                    background: active ? "#000" : "#fff",
                    color: active ? "#fff" : "#374151",
                    fontSize: 13,
                    padding: "6px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: ".15s",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: "0 0 auto",
          }}
        >
          {user && (
            <span
              style={{
                fontSize: 12,
                color: "#6b7280",
                marginRight: 6,
                whiteSpace: "nowrap",
              }}
            >
              {displayName} {displayRole ? `(${displayRole})` : ""}
            </span>
          )}

          <button
            onClick={onToggleDark}
            style={{
              border: "1px solid #e5e7eb",
              background: "#fff",
              fontSize: 13,
              color: "#374151",
              cursor: "pointer",
              borderRadius: 8,
              padding: "6px 10px",
            }}
            title="Toggle dark mode"
          >
            Dark Mode
          </button>

          <button
            onClick={onLogout}
            style={{
              border: "1px solid #e5e7eb",
              background: "#fff",
              fontSize: 13,
              color: "#374151",
              cursor: "pointer",
              borderRadius: 8,
              padding: "6px 10px",
            }}
            title="Logout"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}