import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const PASSWORD_STORE = "finance-tracker-users";
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

export function corsHeaders() {
  return CORS_HEADERS;
}

export function response(statusCode, body) {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify(body) };
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function passwordValidationError(password) {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be no more than ${PASSWORD_MAX_LENGTH} characters.`;
  }
  return "";
}

function passwordKey(email) {
  return `users/${crypto.createHash("sha256").update(email).digest("hex")}`;
}

function passwordDigest(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("base64url");
}

function newPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  return { version: 1, salt, digest: passwordDigest(password, salt) };
}

function digestMatches(password, record) {
  if (record?.version !== 1 || !record.salt || !record.digest) return false;
  const actual = Buffer.from(passwordDigest(password, record.salt));
  const expected = Buffer.from(record.digest);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export async function checkPassword(email, password) {
  const record = await getStore(PASSWORD_STORE).get(passwordKey(email), { type: "json" });
  return record ? { exists: true, valid: digestMatches(password, record) } : { exists: false, valid: true };
}

export async function createPassword(email, password) {
  const store = getStore(PASSWORD_STORE);
  const result = await store.setJSON(
    passwordKey(email),
    newPasswordRecord(password),
    { onlyIfNew: true },
  );

  if (result.modified) return true;

  // Another request created the account first; only accept the same password.
  const record = await store.get(passwordKey(email), { type: "json" });
  return digestMatches(password, record);
}

export async function resetPassword(email, password) {
  await getStore(PASSWORD_STORE).setJSON(passwordKey(email), newPasswordRecord(password));
}

export function requestId(event) {
  return event.headers?.["x-nf-request-id"] || crypto.randomUUID();
}

export function missingEnvironment(names) {
  return names.filter((name) => !process.env[name]);
}

export function logProviderError(operation, id, error) {
  // Log actionable provider details without logging credentials, request bodies, or OTPs.
  console.error(`${operation} failed`, {
    requestId: id,
    name: error?.name || "Error",
    status: error?.status || error?.statusCode,
    code: error?.code,
    message: error?.message || "Unknown provider error",
  });
}

export function signToken(email) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  const payload = { email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyToken(token) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !token) return null;
  try {
    const [encoded, signature] = String(token).split(".");
    if (!encoded || !signature) return null;
    const actual = Buffer.from(signature);
    const expected = Buffer.from(crypto.createHmac("sha256", secret).update(encoded).digest("base64url"));
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.email || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
