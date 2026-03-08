// frontend/src/utils/api.js
// Centralised API base URL and fetch wrapper.
// All pages import apiFetch/API_URL from here instead of hardcoding localhost:5002.

export const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5002";

// Thin wrapper around fetch — prepends API_URL so callers only pass the path.
// Returns the raw Response so callers can call .json(), check .ok, etc. as normal.
export function apiFetch(path, options = {}) {
  return fetch(`${API_URL}${path}`, options);
}
