const twilio = require("twilio");
const { response, normalizeEmail } = require("./_auth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" } };
  if (event.httpMethod !== "POST") return response(405, { error: "Method not allowed" });

  try {
    const { email } = JSON.parse(event.body || "{}");
    const normalized = normalizeEmail(email);
    if (!/^\S+@\S+\.\S+$/.test(normalized)) return response(400, { error: "Please enter a valid email address." });

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
      return response(500, { error: "OTP service is not configured on the server." });
    }

    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    await client.verify.v2.services(TWILIO_VERIFY_SERVICE_SID).verifications.create({
      channel: "email",
      to: normalized,
    });

    return response(200, { ok: true, message: "OTP sent to your email." });
  } catch (error) {
    console.error("request-otp", error);
    return response(500, { error: "Could not send the OTP. Please try again." });
  }
};
