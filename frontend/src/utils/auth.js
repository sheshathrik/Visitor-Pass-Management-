// Adjust ONLY this file if your app stores the logged-in user differently
// (e.g. an AuthContext instead of localStorage). Every page below calls
// getCurrentUser() / getCurrentRole() instead of touching storage directly,
// so fixing it here fixes it everywhere.

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem("user");
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore parse errors, fall through to null
  }
  return null;
}

export function getCurrentRole() {
  return getCurrentUser()?.role || null;
}
