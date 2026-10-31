import { NextResponse } from "next/server";
import crypto from "crypto";
import { sql } from "@/lib/neon/db";
import { getCustomerSessionFromRequest } from "@/lib/auth/session";
import { normalisePhone } from "@/lib/utils/phone";
import { sendSms } from "@/lib/sms";

export const dynamic = "force-dynamic";

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

function hashOtp(otp: string): string {
  const secret = process.env.OTP_HMAC_SECRET || process.env.SESSION_SECRET || "mithaase_otp_hmac_fallback_secret_32_bytes";
  return crypto.createHmac("sha256", secret).update(otp).digest("hex");
}

export async function POST(req: Request) {
  try {
    const session = await getCustomerSessionFromRequest(req);
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: "Authentication required to verify phone number." },
        { status: 401 }
      );
    }

    if (!sql) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const rawPhone = body.phone;
    const cleanPhone = normalisePhone(rawPhone);

    if (!cleanPhone) {
      return NextResponse.json(
        { error: "Please provide a valid 10-digit Indian mobile number." },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(req);

    // 1. Delete expired OTPs from database
    await sql.query(`DELETE FROM phone_otps WHERE expires_at < NOW();`).catch(() => {});

    // 2. Reject if number is already linked or verified on another account
    const tenDigit = cleanPhone.replace(/[^0-9]/g, "").slice(-10);
    const existingOtherUser = await sql.query(
      `SELECT id, email, phone_verified FROM customer_accounts 
       WHERE (phone = $1 OR phone = $2 OR phone LIKE $3) 
         AND id != $4 
         AND LOWER(email) != LOWER($5) 
       LIMIT 1;`,
      [`+91${tenDigit}`, tenDigit, `%${tenDigit}`, session.userId, (session.email || "").toLowerCase()]
    );

    if (existingOtherUser && existingOtherUser.length > 0) {
      return NextResponse.json(
        { error: "This mobile number is already linked to another account. Please use a different mobile number." },
        { status: 409 }
      );
    }

    // 3. Database rate limit: max 3 sends per 10 minutes per user, per phone, and per IP
    const rateLimitCheck = await sql.query(
      `SELECT 
         COUNT(*) FILTER (WHERE user_id = $1) as user_count,
         COUNT(*) FILTER (WHERE phone = $2) as phone_count,
         COUNT(*) FILTER (WHERE ip = $3) as ip_count
       FROM phone_otps 
       WHERE created_at > NOW() - INTERVAL '10 minutes';`,
      [session.userId, cleanPhone, clientIp]
    );

    const counts = rateLimitCheck[0] || {};
    const userCount = Number(counts.user_count || 0);
    const phoneCount = Number(counts.phone_count || 0);
    const ipCount = Number(counts.ip_count || 0);

    if (userCount >= 3 || phoneCount >= 3 || ipCount >= 10) {
      return NextResponse.json(
        { error: "Too many verification requests. Please wait 10 minutes before requesting a new OTP." },
        { status: 429 }
      );
    }

    // 4. Invalidate previous unused OTPs for this user
    await sql.query(
      `UPDATE phone_otps 
       SET used = true 
       WHERE user_id = $1 AND used = false;`,
      [session.userId]
    );

    // 5. Generate secure 6-digit OTP and HMAC hash
    const otpInt = crypto.randomInt(100000, 1000000);
    const otpString = otpInt.toString();
    const otpHash = hashOtp(otpString);
    const otpId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // 6. Insert new OTP row
    await sql.query(
      `INSERT INTO phone_otps (id, user_id, phone, otp_hash, ip, expires_at, attempts, used, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0, false, NOW());`,
      [otpId, session.userId, cleanPhone, otpHash, clientIp, expiresAt.toISOString()]
    );

    // 7. Dispatch SMS via SMSGate helper
    const smsMessage = `Your Mithaasé profile verification code is ${otpString}. Valid for 5 minutes. Do not share this code with anyone.`;
    try {
      await sendSms(cleanPhone, smsMessage);
    } catch (smsErr) {
      // If sending fails, delete the usable OTP row and return a generic error
      await sql.query(`DELETE FROM phone_otps WHERE id = $1;`, [otpId]).catch(() => {});
      console.warn("[PHONE_SEND_OTP] Failed to deliver SMS");
      return NextResponse.json(
        { error: "Failed to dispatch SMS code. Please verify your mobile network and try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent via SMS.",
      phone: cleanPhone,
    });
  } catch (err: any) {
    console.error("[PHONE_SEND_OTP] Server error:", err?.message || err);
    return NextResponse.json(
      { error: "An unexpected error occurred while sending the code." },
      { status: 500 }
    );
  }
}

