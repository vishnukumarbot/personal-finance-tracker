const SESSION_KEY = "finance-tracker-session-v1";
const configuredApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const API_BASE_URL = configuredApiBaseUrl
  || (import.meta.env.DEV ? "https://vishnugfinancetracker.netlify.app" : "");

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function apiError(data, fallback) {
  const message = data.error || fallback;
  return data.requestId ? `${message} (Reference: ${data.requestId})` : message;
}

async function responseData(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return {
      error: "Authentication returned an unexpected response. Please try again.",
    };
  }
  return response.json().catch(() => ({ error: "The server returned an invalid response." }));
}

function tokenIsCurrent(token) {
  try {
    const encoded = String(token || "").split(".")[0];
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(window.atob(base64));
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function getSession() {
  try {
    const session = JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null");
    if (!session?.email || !tokenIsCurrent(session.token)) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // The in-memory session is still cleared by App.
  }
}

export async function requestOtp(email) {
  const response = await fetch(apiUrl("/api/request-otp"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: String(email || "").trim().toLowerCase() }),
  });
  const data = await responseData(response);
  if (!response.ok || data.error) throw new Error(apiError(data, "Could not send OTP."));
  return data;
}

export async function verifyOtp(email, code, password, { resetPassword = false } = {}) {
  const response = await fetch(apiUrl("/api/verify-otp"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: String(email || "").trim().toLowerCase(),
      code: String(code || "").trim(),
      password: String(password || ""),
      resetPassword,
    }),
  });
  const data = await responseData(response);
  if (!response.ok || data.error) throw new Error(apiError(data, "Could not verify OTP."));

  const session = { email: data.email, token: data.token };
  saveSession(session);
  return session;
}
