const crypto = require("crypto");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

function response(statusCode, body) {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify(body) };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function signToken(email) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  const payload = { email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyToken(token) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !token) return null;
  const [encoded, signature] = String(token).split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (!payload.email || !payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

module.exports = { corsHeaders, response, normalizeEmail, signToken, verifyToken };
