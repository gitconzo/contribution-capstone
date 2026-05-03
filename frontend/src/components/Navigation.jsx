// frontend/src/components/Navigation.jsx
import React from "react";
import { Users, LayoutDashboard, Settings, Upload, UserPlus, Download, Moon, Sun, LogOut, FolderOpen } from "lucide-react";

export default function Navigation({
  currentPage,
  onNavigate,
  onLogout,
  onToggleDark,
  darkMode,
  user,
}) {
  const isStudent = user?.role === "student";

  const menuItems = isStudent
    ? [
        { key: "student-dashboard", label: "Dashboard", icon: <LayoutDashboard size={15} /> },
        { key: "settings", label: "Settings", icon: <Settings size={15} /> },
      ]
    : [
        { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={15} /> },
        { key: "rules", label: "Rules", icon: <Settings size={15} /> },
        { key: "upload", label: "Upload", icon: <Upload size={15} /> },
        { key: "setup-team", label: "Teams", icon: <UserPlus size={15} /> },
        { key: "export", label: "Export", icon: <Download size={15} /> },
        { key: "files", label: "Files", icon: <FolderOpen size={15} /> },
        { key: "lecturer-settings", label: "Settings", icon: <Settings size={15} /> },
      ];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        background: darkMode ? "#0f172a" : "#fff",
        borderBottom: darkMode ? "1px solid #1f2937" : "1px solid #e5e7eb",
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
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <button
            onClick={() => onNavigate?.(isStudent ? "student-dashboard" : "dashboard")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              flex: "0 0 auto",
            }}
            title="Go to dashboard"
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: darkMode
                  ? "0 0 0 1px #1f2937"
                  : "0 4px 10px rgba(0,0,0,.12)",
              }}
              aria-hidden
            >
              <Users size={21} color="#fff" strokeWidth={2.2} />
            </div>

            <span
              style={{
                fontWeight: 800,
                fontSize: 18,
                color: darkMode ? "#f8fafc" : "#111827",
                whiteSpace: "nowrap",
                letterSpacing: "0.2px",
              }}
            >
              Project17
            </span>
          </button>

          <div
            style={{
              display: "flex",
              gap: 5,
              marginLeft: 8,
              flexWrap: "nowrap",
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
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    border: active
                      ? "1px solid #000"
                      : darkMode
                      ? "1px solid #334155"
                      : "1px solid #e5e7eb",
                    background: active ? "#000" : darkMode ? "#111827" : "#fff",
                    color: active ? "#fff" : darkMode ? "#e5e7eb" : "#4b5563",
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "7px 9px",
                    borderRadius: 10,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center" }}>{item.icon}</span>
                  <span>{item.label}</span>
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
          <button
            onClick={onToggleDark}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              border: darkMode ? "1px solid #334155" : "1px solid #e5e7eb",
              background: darkMode ? "#111827" : "#fff",
              fontSize: 13,
              fontWeight: 500,
              color: darkMode ? "#e5e7eb" : "#4b5563",
              cursor: "pointer",
              borderRadius: 10,
              padding: "8px 12px",
              whiteSpace: "nowrap",
            }}
            title="Toggle dark mode"
          >
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>
          </button>

          <button
            onClick={onLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              border: darkMode ? "1px solid #334155" : "1px solid #e5e7eb",
              background: darkMode ? "#111827" : "#fff",
              fontSize: 13,
              fontWeight: 500,
              color: darkMode ? "#e5e7eb" : "#4b5563",
              cursor: "pointer",
              borderRadius: 10,
              padding: "8px 12px",
              whiteSpace: "nowrap",
            }}
            title="Logout"
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
