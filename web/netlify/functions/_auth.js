import crypto from "node:crypto";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

export function corsHeaders() {
  return CORS_HEADERS;
}

export function response(statusCode, body) {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify(body) };
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
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
