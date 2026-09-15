const twilio = require("twilio");
const { response, normalizeEmail, signToken } = require("./_auth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" } };
  if (event.httpMethod !== "POST") return response(405, { error: "Method not allowed" });

  try {
    const { email, code } = JSON.parse(event.body || "{}");
    const normalized = normalizeEmail(email);
    const otp = String(code || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(normalized) || !/^\d{4,10}$/.test(otp)) {
      return response(400, { error: "Enter the email and OTP you received." });
    }

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID || !process.env.AUTH_SECRET) {
      return response(500, { error: "Authentication service is not configured on the server." });
    }

    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const check = await client.verify.v2.services(TWILIO_VERIFY_SERVICE_SID).verificationChecks.create({
      to: normalized,
      code: otp,
    });

    if (check.status !== "approved") return response(401, { error: "Invalid or expired OTP." });

    return response(200, { ok: true, email: normalized, token: signToken(normalized) });
  } catch (error) {
    console.error("verify-otp", error);
    return response(500, { error: "Could not verify the OTP. Please try again." });
  }
};
