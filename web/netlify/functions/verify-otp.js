import twilio from "twilio";
import {
  logProviderError,
  missingEnvironment,
  normalizeEmail,
  requestId,
  response,
  signToken,
  corsHeaders,
} from "./_auth.js";

const REQUIRED_ENVIRONMENT = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_VERIFY_SERVICE_SID",
  "AUTH_SECRET",
];

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders() };
  if (event.httpMethod !== "POST") return response(405, { error: "Method not allowed" });

  const id = requestId(event);
  const missing = missingEnvironment(REQUIRED_ENVIRONMENT);
  if (missing.length) {
    console.error("verify-otp is missing required environment variables", { requestId: id, missing });
    return response(500, { error: "Authentication service is not configured on the server.", requestId: id });
  }

  let email;
  let code;
  try {
    ({ email, code } = JSON.parse(event.body || "{}"));
  } catch {
    return response(400, { error: "Request body must be valid JSON.", requestId: id });
  }

  const normalized = normalizeEmail(email);
  const otp = String(code || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(normalized) || !/^\d{4,10}$/.test(otp)) {
    return response(400, { error: "Enter the email and OTP you received.", requestId: id });
  }
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const check = await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID).verificationChecks.create({
      to: normalized,
      code: otp,
    });

    if (check.status !== "approved") return response(401, { error: "Invalid or expired OTP.", requestId: id });
    console.info("verify-otp approved", { requestId: id, verificationSid: check.sid, status: check.status });
    return response(200, { ok: true, email: normalized, token: signToken(normalized) });
  } catch (error) {
    logProviderError("verify-otp", id, error);
    return response(502, { error: "Could not verify the OTP. Please try again.", requestId: id });
  }
}
