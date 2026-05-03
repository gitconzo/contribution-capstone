// frontend/src/utils/api.js
// Centralised API base URL and fetch wrapper.
// All pages import apiFetch/API_URL from here instead of hardcoding localhost:5002.

export const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5002";

// Thin wrapper around fetch — prepends API_URL and attaches the Cognito idToken
// so every request is authenticated without callers needing to think about it.
export function apiFetch(path, options = {}) {
  const token = localStorage.getItem("idToken") || localStorage.getItem("token") || "";
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(`${API_URL}${path}`, { ...options, headers });
}
