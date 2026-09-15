const SESSION_KEY = "finance-tracker-session-v1";

function apiUrl(path) {
  return path.startsWith("http") ? path : path;
}

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export async function requestOtp(email, baseUrl = "") {
  const response = await fetch(`${apiUrl(baseUrl)}/api/request-otp`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not send OTP.");
  return data;
}

export async function verifyOtp(email, code, baseUrl = "") {
  const response = await fetch(`${apiUrl(baseUrl)}/api/verify-otp`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not verify OTP.");
  saveSession({ email: data.email, token: data.token });
  return data;
}
