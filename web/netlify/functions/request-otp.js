import twilio from "twilio";
import {
  logProviderError,
  missingEnvironment,
  normalizeEmail,
  requestId,
  response,
  corsHeaders,
} from "./_auth.js";

const REQUIRED_ENVIRONMENT = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_VERIFY_SERVICE_SID",
];

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders() };
  if (event.httpMethod !== "POST") return response(405, { error: "Method not allowed" });

  const id = requestId(event);
  const missing = missingEnvironment(REQUIRED_ENVIRONMENT);
  if (missing.length) {
    console.error("request-otp is missing required environment variables", { requestId: id, missing });
    return response(500, { error: "OTP service is not configured on the server.", requestId: id });
  }

  let email;
  try {
    ({ email } = JSON.parse(event.body || "{}"));
  } catch {
    return response(400, { error: "Request body must be valid JSON.", requestId: id });
  }

  const normalized = normalizeEmail(email);
  if (!/^\S+@\S+\.\S+$/.test(normalized)) {
    return response(400, { error: "Please enter a valid email address.", requestId: id });
  }
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const verification = await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID).verifications.create({
      channel: "email",
      to: normalized,
    });

    console.info("request-otp accepted", { requestId: id, verificationSid: verification.sid, status: verification.status });
    return response(200, { ok: true, message: "OTP sent to your email.", requestId: id });
  } catch (error) {
    logProviderError("request-otp", id, error);
    return response(502, { error: "Could not send the OTP. Please try again.", requestId: id });
  }
}
