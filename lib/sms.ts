/**
 * SMS Gateway Helper for Mithaasé
 * Dispatches transactional SMS via SMSGate (Android Gateway cloud mode).
 * 
 * Strict Security Rules:
 * - Credentials from SMSGATE_USER and SMSGATE_PASS env vars.
 * - Throw on non-2xx HTTP responses.
 * - Log only the HTTP status code. NEVER log the message body, OTP, or phone number in full.
 */

export async function sendSms(phone: string, text: string): Promise<void> {
  const user = process.env.SMSGATE_USER?.trim();
  const pass = process.env.SMSGATE_PASS?.trim();

  if (!user || !pass) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[SMS] SMSGate credentials missing in local dev. Skipping dispatch.");
      return;
    }
    throw new Error("SMS gateway credentials are not configured.");
  }

  const basicAuth = Buffer.from(`${user}:${pass}`).toString("base64");

  const response = await fetch("https://api.sms-gate.app/3rdparty/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify({
      textMessage: { text },
      phoneNumbers: [phone],
      ttl: 600,
    }),
  });

  console.log(`[SMS] Gateway dispatch status code: ${response.status}`);

  if (!response.ok) {
    throw new Error(`SMS gateway error: HTTP status ${response.status}`);
  }
}

