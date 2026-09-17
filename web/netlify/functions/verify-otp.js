import twilio from "twilio";
import {
  logProviderError,
  missingEnvironment,
  normalizeEmail,
  passwordValidationError,
  checkPassword,
  createPassword,
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
  let password;
  try {
    ({ email, code, password } = JSON.parse(event.body || "{}"));
  } catch {
    return response(400, { error: "Request body must be valid JSON.", requestId: id });
  }

  const normalized = normalizeEmail(email);
  const otp = String(code || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(normalized) || !/^\d{4,10}$/.test(otp)) {
    return response(400, { error: "Enter the email and OTP you received.", requestId: id });
  }
  const passwordError = passwordValidationError(password);
  if (passwordError) return response(400, { error: passwordError, requestId: id });

  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const check = await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID).verificationChecks.create({
      to: normalized,
      code: otp,
    });

    if (check.status !== "approved") return response(401, { error: "Invalid or expired OTP.", requestId: id });
    let passwordState;
    try {
      passwordState = await checkPassword(normalized, password);
    } catch (error) {
      logProviderError("password-check", id, error);
      return response(502, { error: "Could not check your password. Please try again.", requestId: id });
    }
    if (!passwordState.valid) {
      return response(401, { error: "Incorrect password. Request a new code to try again.", requestId: id });
    }
    if (!passwordState.exists && !(await createPassword(normalized, password))) {
      return response(409, { error: "This account was created with a different password. Request a new code and try again.", requestId: id });
    }
    console.info("verify-otp approved", { requestId: id, verificationSid: check.sid, status: check.status });
    return response(200, {
      ok: true,
      email: normalized,
      token: signToken(normalized),
      passwordCreated: !passwordState.exists,
    });
  } catch (error) {
    logProviderError("verify-otp", id, error);
    return response(502, { error: "Could not verify the OTP. Please try again.", requestId: id });
  }
}
