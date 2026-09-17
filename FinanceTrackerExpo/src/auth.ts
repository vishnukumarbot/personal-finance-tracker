import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./config";

const SESSION_KEY = "finance-tracker-session-v1";

export async function getSession() {
  try { const raw = await AsyncStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export async function saveSession(session: any) { await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
export async function clearSession() { await AsyncStorage.removeItem(SESSION_KEY); }

async function call(path: string, body: object) {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error || "Request failed.");
  return data;
}

export const requestOtp = (email: string) => call("/api/request-otp", { email });
export async function verifyOtp(email: string, code: string, password: string, resetPassword = false) { const data = await call("/api/verify-otp", { email, code, password, resetPassword }); await saveSession(data); return data; }
