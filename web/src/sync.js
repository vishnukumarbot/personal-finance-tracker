const PRODUCTION_API = "https://vishnugfinancetracker.netlify.app";

function apiBase() {
  const configured = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (configured) return configured;
  if (import.meta.env.DEV) return PRODUCTION_API;
  return "";
}

async function callCloud(session, options = {}) {
  if (!session?.token) throw new Error("Your session has expired. Please log in again.");
  const response = await fetch(`${apiBase()}/api/transactions`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${session.token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const error = new Error(data.error || "Could not synchronize your transactions.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export function getCloudState(session) {
  return callCloud(session);
}

export function changeCloudState(session, action, payload = {}) {
  return callCloud(session, { method: "POST", body: { action, ...payload } });
}
