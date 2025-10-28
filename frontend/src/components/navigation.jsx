import React from "react";

export function Navigation({ currentPage, onNavigate, onLogout }) {
  const menuItems = [
    { key: "dashboard", label: "Dashboard" },
    { key: "rules", label: "Rule Settings" },
    { key: "upload", label: "Upload Data" },
    { key: "export", label: "Export Report" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        width: "100%",
        background: "#fff",
        borderBottom: "1px solid #e5e7eb",
        padding: "10px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 10,
      }}
    >
      {/* left side - logo and title */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
          }}
        >
          👥
        </div>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Project17</span>

        {/* main tabs */}
        <div style={{ display: "flex", gap: 10, marginLeft: 16 }}>
          {menuItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              style={{
                border: "none",
                background:
                  currentPage === item.key ? "#000" : "transparent",
                color: currentPage === item.key ? "#fff" : "#374151",
                fontSize: 13,
                padding: "6px 12px",
                borderRadius: 8,
                cursor: "pointer",
                transition: "0.2s",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* right side - actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          style={{
            border: "none",
            background: "transparent",
            fontSize: 13,
            color: "#374151",
            cursor: "pointer",
          }}
        >
          🌙 Dark Mode
        </button>
        <button
          onClick={onLogout}
          style={{
            border: "none",
            background: "transparent",
            fontSize: 13,
            color: "#374151",
            cursor: "pointer",
          }}
        >
          🚪 Logout
        </button>
      </div>
    </div>
  );
}
