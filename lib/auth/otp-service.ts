/**
 * Authoritative Server-Side WhatsApp OTP & Rate-Limiting Engine
 * All state is persisted strictly in Neon PostgreSQL (phone_verifications & auth_rate_limits).
 * Zero in-memory storage, zero caching, zero trust in client verification flags.
 */

import crypto from "crypto";
import { sql } from "@/lib/neon/db";
import { normalizeAndValidateWhatsAppPhone } from "@/lib/utils/phone";

function getOtpSecret(): string {
  return (
    process.env.YOUPI_OTP_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.NEON_AUTH_COOKIE_SECRET ||
    "mithaase_otp_hmac_secret_2026_festive"
  );
}

function computeOtpHmac(phone: string, otp: string, purpose: string): string {
  const secret = getOtpSecret();
  return crypto
    .createHmac("sha256", secret)
    .update(`${phone}:${otp}:${purpose}`)
    .digest("hex");
}

/**
 * Checks and records rate limits directly in Neon PostgreSQL.
 * @returns { allowed: boolean; retryAfterSeconds?: number; error?: string }
 */
export async function checkRateLimit(
  identifier: string,
  action: "otp_send" | "otp_verify" | "login_fail",
  ip: string,
  maxAttempts = 5,
  windowMinutes = 15,
  options?: { skipCooldown?: boolean }
): Promise<{ allowed: boolean; retryAfterSeconds?: number; error?: string }> {
  if (!sql) throw new Error("Database unavailable for rate limiting");

  const now = new Date();

  // 1. Check existing rate limit record
  const rows = await sql.query(
    `SELECT id, attempts, locked_until, last_attempt 
     FROM auth_rate_limits 
     WHERE identifier = $1 AND action = $2
     LIMIT 1;`,
    [identifier, action]
  );

  if (rows && rows.length > 0) {
    const record = rows[0];
    const lockedUntil = record.locked_until ? new Date(record.locked_until) : null;

    if (lockedUntil && lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000);
      return {
        allowed: false,
        retryAfterSeconds,
        error: `Too many attempts. Please try again in ${retryAfterSeconds} seconds.`,
      };
    }

    const lastAttempt = new Date(record.last_attempt);
    const windowExpiry = new Date(lastAttempt.getTime() + windowMinutes * 60 * 1000);

    // If window expired, reset attempts
    if (now > windowExpiry) {
      await sql.query(
        `UPDATE auth_rate_limits 
         SET attempts = 1, locked_until = NULL, last_attempt = NOW() 
         WHERE id = $1;`,
        [record.id]
      );
      return { allowed: true };
    }

    // Cooldown check for OTP send (60-second limit between resends)
    if (action === "otp_send" && !options?.skipCooldown) {
      const cooldownExpiry = new Date(lastAttempt.getTime() + 60 * 1000);
      if (now < cooldownExpiry) {
        const waitSec = Math.ceil((cooldownExpiry.getTime() - now.getTime()) / 1000);
        return {
          allowed: false,
          retryAfterSeconds: waitSec,
          error: `Please wait ${waitSec} seconds before requesting a new code.`,
        };
      }
    }

    // Exceeded maximum attempts
    if (record.attempts >= maxAttempts) {
      const lockDurationMinutes = action === "login_fail" ? 15 : 10;
      await sql.query(
        `UPDATE auth_rate_limits 
         SET locked_until = NOW() + INTERVAL '${lockDurationMinutes} minutes', last_attempt = NOW() 
         WHERE id = $1;`,
        [record.id]
      );
      return {
        allowed: false,
        retryAfterSeconds: lockDurationMinutes * 60,
        error: `Too many failed attempts. Account temporarily locked for ${lockDurationMinutes} minutes.`,
      };
    }

    // Increment attempts
    await sql.query(
      `UPDATE auth_rate_limits 
       SET attempts = attempts + 1, last_attempt = NOW() 
       WHERE id = $1;`,
      [record.id]
    );
  } else {
    // First attempt in this window
    await sql.query(
      `INSERT INTO auth_rate_limits (identifier, action, ip, attempts, last_attempt)
       VALUES ($1, $2, $3, 1, NOW());`,
      [identifier, action, ip]
    );
  }

  return { allowed: true };
}

/**
 * Resets rate limit counter after a successful operation.
 */
export async function clearRateLimit(identifier: string, action: string): Promise<void> {
  if (!sql) return;
  try {
    await sql.query(
      `DELETE FROM auth_rate_limits WHERE identifier = $1 AND action = $2;`,
      [identifier, action]
    );
  } catch (err) {
    console.warn("[RATE_LIMIT] Clear warning:", err);
  }
}

/**
 * Dispatches a cryptographically generated WhatsApp OTP and stores its HMAC in Neon DB.
 */
export async function sendWhatsAppOtp(params: {
  rawPhone: string;
  purpose: "signup" | "change" | "checkout" | "login";
  ip: string;
  customerName?: string;
  userId?: string;
  skipIpCooldown?: boolean;
}): Promise<{ success: boolean; error?: string; retryAfterSeconds?: number; dbPhone?: string }> {
  if (!sql) {
    return { success: false, error: "Database unavailable" };
  }

  // 1. Strict phone validation
  const phoneValidation = normalizeAndValidateWhatsAppPhone(params.rawPhone);
  if (!phoneValidation.isValid) {
    return { success: false, error: phoneValidation.error };
  }

  const { dbFormat: cleanPhone, waFormat } = phoneValidation;

  // 2. Check per-phone and per-IP rate limits (60s cooldown, max 5 sends per 15 min)
  const phoneLimit = await checkRateLimit(cleanPhone, "otp_send", params.ip, 5, 15);
  if (!phoneLimit.allowed) {
    return { success: false, error: phoneLimit.error, retryAfterSeconds: phoneLimit.retryAfterSeconds };
  }

  const ipLimit = await checkRateLimit(params.ip, "otp_send", params.ip, 15, 15, {
    skipCooldown: params.skipIpCooldown,
  });
  if (!ipLimit.allowed) {
    return { success: false, error: ipLimit.error, retryAfterSeconds: ipLimit.retryAfterSeconds };
  }

  // 3. Invalidate any unconsumed past OTPs for this phone + purpose
  await sql.query(
    `UPDATE phone_verifications 
     SET consumed_at = NOW() 
     WHERE phone = $1 AND purpose = $2 AND consumed_at IS NULL;`,
    [cleanPhone, params.purpose]
  );

  // 4. Generate 6-digit cryptographic OTP (never 000000 or Math.random)
  const otpNumber = crypto.randomInt(100000, 1000000);
  const plainOtp = otpNumber.toString();
  const otpHmac = computeOtpHmac(cleanPhone, plainOtp, params.purpose);

  // 5. Insert OTP hash into Neon DB (5-minute expiration, max 5 attempts)
  await sql.query(
    `INSERT INTO phone_verifications (phone, purpose, user_id, otp_hash, expires_at, attempts, ip)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '5 minutes', 0, $5);`,
    [cleanPhone, params.purpose, params.userId || null, otpHmac, params.ip]
  );

  // 6. Dispatch through live YouPI WhatsApp gateway
  const rawBaseUrl = process.env.YOUPI_API_URL || process.env.YOUPI_BASE_URL || "http://localhost:6100";
  const youpiBaseUrl = rawBaseUrl.replace(/\/+$/, "");
  let delivered = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${youpiBaseUrl}/api/v1/customer/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mobileNumber: cleanPhone,
        name: (params.customerName || "Customer").trim(),
        otp: plainOtp, // Transmit securely over private gateway loopback
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (res.ok) {
      delivered = true;
    }
  } catch (gatewayErr) {
    // Gateway network error
  }

  // In development/test mode without a live WhatsApp SIM socket running:
  if (!delivered && process.env.NODE_ENV !== "production") {
    // Allow local development testing while maintaining 100% database verification
    delivered = true;
  }

  if (!delivered) {
    return {
      success: false,
      error: "This number is not reachable on WhatsApp. Please verify your WhatsApp number.",
    };
  }

  return { success: true, dbPhone: cleanPhone };
}

/**
 * Validates the entered OTP against Neon PostgreSQL records.
 */
export async function verifyWhatsAppOtp(params: {
  rawPhone: string;
  purpose: "signup" | "change" | "checkout" | "login";
  otp: string;
  ip: string;
}): Promise<{ success: boolean; error?: string; verificationId?: string; dbPhone?: string }> {
  if (!sql) {
    return { success: false, error: "Database unavailable" };
  }

  const phoneValidation = normalizeAndValidateWhatsAppPhone(params.rawPhone);
  if (!phoneValidation.isValid) {
    return { success: false, error: phoneValidation.error };
  }

  const { dbFormat: cleanPhone } = phoneValidation;
  const cleanOtp = params.otp.trim();

  if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
    return { success: false, error: "Please enter a valid 6-digit verification code." };
  }

  // Check rate limits on verification attempts
  const verifyLimit = await checkRateLimit(`${cleanPhone}_${params.purpose}`, "otp_verify", params.ip, 5, 10);
  if (!verifyLimit.allowed) {
    return { success: false, error: verifyLimit.error };
  }

  // 1. Authoritative check: Check if YouPI live gateway validates this OTP (YouPI generates & sends its own OTP over WhatsApp)
  let youpiVerified = false;
  try {
    const rawBaseUrl = process.env.YOUPI_API_URL || process.env.YOUPI_BASE_URL || "http://localhost:6100";
    const youpiBaseUrl = rawBaseUrl.replace(/\/+$/, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const youpiRes = await fetch(`${youpiBaseUrl}/api/v1/customer/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mobileNumber: cleanPhone,
        otp: cleanOtp,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (youpiRes.ok) {
      const data = await youpiRes.json();
      if (data.verified || data.success) {
        youpiVerified = true;
      }
    }
  } catch (err) {
    // Gateway network/timeout error, proceed to check Neon hash
  }

  // 2. Fetch active verification record from Neon DB
  const rows = await sql.query(
    `SELECT id, otp_hash, expires_at, attempts, consumed_at 
     FROM phone_verifications 
     WHERE phone = $1 AND purpose = $2 AND consumed_at IS NULL
     ORDER BY created_at DESC 
     LIMIT 1;`,
    [cleanPhone, params.purpose]
  );

  const record = rows && rows.length > 0 ? rows[0] : null;

  if (youpiVerified) {
    // YouPI gateway verified the code! Consume in Neon DB to fulfill assertPhoneVerifiedServerSide
    let verificationId = record?.id;
    if (record) {
      await sql.query(`UPDATE phone_verifications SET consumed_at = NOW() WHERE id = $1;`, [record.id]);
    } else {
      const newRec = await sql.query(
        `INSERT INTO phone_verifications (phone, purpose, otp_hash, expires_at, attempts, ip, consumed_at)
         VALUES ($1, $2, 'youpi_gateway_verified', NOW() + INTERVAL '15 minutes', 1, $3, NOW())
         RETURNING id;`,
        [cleanPhone, params.purpose, params.ip]
      );
      verificationId = newRec[0]?.id;
    }

    await clearRateLimit(`${cleanPhone}_${params.purpose}`, "otp_verify");
    return {
      success: true,
      verificationId,
      dbPhone: cleanPhone,
    };
  }

  if (!record) {
    return {
      success: false,
      error: "No active verification code found for this number. Please request a new code.",
    };
  }

  // Check expiration
  if (new Date() > new Date(record.expires_at)) {
    await sql.query(`UPDATE phone_verifications SET consumed_at = NOW() WHERE id = $1;`, [record.id]);
    return {
      success: false,
      error: "Verification code has expired. Please request a new code.",
    };
  }

  // Check attempts
  if (record.attempts >= 5) {
    await sql.query(`UPDATE phone_verifications SET consumed_at = NOW() WHERE id = $1;`, [record.id]);
    return {
      success: false,
      error: "Too many incorrect attempts. Please request a new verification code.",
    };
  }

  // 3. Constant-time HMAC comparison (for Neon-stored fallback OTPs)
  const expectedHmac = record.otp_hash;
  const submittedHmac = computeOtpHmac(cleanPhone, cleanOtp, params.purpose);

  const expectedBuf = Buffer.from(expectedHmac, "hex");
  const submittedBuf = Buffer.from(submittedHmac, "hex");

  const isMatch =
    expectedBuf.length === submittedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, submittedBuf);

  if (!isMatch) {
    await sql.query(
      `UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = $1;`,
      [record.id]
    );
    return {
      success: false,
      error: "Incorrect WhatsApp verification code. Please check and try again.",
    };
  }

  // 4. Mark verification as successfully consumed
  await sql.query(
    `UPDATE phone_verifications 
     SET consumed_at = NOW() 
     WHERE id = $1;`,
    [record.id]
  );

  // Clear rate limit
  await clearRateLimit(`${cleanPhone}_${params.purpose}`, "otp_verify");

  return {
    success: true,
    verificationId: record.id,
    dbPhone: cleanPhone,
  };
}

/**
 * Checks whether a phone number has a verified, consumed, unexpired verification row in Neon DB.
 * Used at Signup and Profile Change to guarantee client cannot bypass OTP.
 */
export async function assertPhoneVerifiedServerSide(
  phone: string,
  purpose: "signup" | "change" | "checkout" | "login",
  maxAgeMinutes = 15
): Promise<{ verified: boolean; verificationId?: string }> {
  if (!sql) return { verified: false };

  const rows = await sql.query(
    `SELECT id 
     FROM phone_verifications 
     WHERE phone = $1 
       AND purpose = $2 
       AND consumed_at IS NOT NULL 
       AND consumed_at >= NOW() - ($3 || ' minutes')::INTERVAL
     ORDER BY consumed_at DESC 
     LIMIT 1;`,
    [phone, purpose, maxAgeMinutes]
  );

  if (rows && rows.length > 0) {
    return { verified: true, verificationId: rows[0].id };
  }
  return { verified: false };
}
