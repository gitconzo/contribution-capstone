// frontend/src/utils/auth.js
// Thin wrappers around the localStorage auth flag used in App.jsx.

const KEY = "capstone_authed";

export const isAuthed = () => localStorage.getItem(KEY) === "1";
export const setAuthed = () => localStorage.setItem(KEY, "1");
export const clearAuthed = () => localStorage.removeItem(KEY);
