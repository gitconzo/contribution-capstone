// frontend/src/utils/styles.js
// Shared inline-style helpers used across page components.
// Centralises the duplicated card/btn/input/layout helpers and the score colour logic.

// Base card container.
export function card(extra = {}) {
  return {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 14,
    boxShadow: "0 4px 12px rgba(0,0,0,.04)",
    ...extra,
  };
}

// Card with a two-column grid layout (content | action).
export function rowCard(extra = {}) {
  return {
    ...card(),
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 16,
    alignItems: "center",
    ...extra,
  };
}

// Text input / textarea / select box.
export function inputBox(extra = {}) {
  return {
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 14,
    background: "#fff",
    ...extra,
  };
}

// Filled black action button.
export function solidBtn(extra = {}) {
  return {
    background: "#000",
    color: "#fff",
    border: "none",
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    ...extra,
  };
}

// Outlined ghost button (white background).
export function outlineBtn(extra = {}) {
  return {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 10,
    padding: "6px 10px",
    fontSize: 13,
    cursor: "pointer",
    ...extra,
  };
}

// Flex row with space-between + centered alignment.
export function rowBetween(extra = {}) {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    ...extra,
  };
}

// Returns a colour string based on a 0-100 score value.
export function scoreColor(s = 0) {
  if (s >= 90) return "#16a34a";
  if (s >= 80) return "#22c55e";
  if (s >= 70) return "#2563eb";
  if (s >= 60) return "#ca8a04";
  if (s >= 50) return "#ea580c";
  return "#dc2626";
}
