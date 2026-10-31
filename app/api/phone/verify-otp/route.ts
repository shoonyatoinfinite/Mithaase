import { NextResponse } from "next/server";
import crypto from "crypto";
import { sql } from "@/lib/neon/db";
import { getCustomerSessionFromRequest } from "@/lib/auth/session";
import { normalisePhone } from "@/lib/utils/phone";

export const dynamic = "force-dynamic";

function hashOtp(otp: string): string {
  const secret = process.env.OTP_HMAC_SECRET || process.env.SESSION_SECRET || "mithaase_otp_hmac_fallback_secret_32_bytes";
  return crypto.createHmac("sha256", secret).update(otp).digest("hex");
}

function timingSafeMatch(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const session = await getCustomerSessionFromRequest(req);
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: "Authentication required to verify OTP code." },
        { status: 401 }
      );
    }

    if (!sql) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const rawPhone = body.phone;
    const rawOtp = String(body.otp || "").trim();

    const cleanPhone = normalisePhone(rawPhone);
    if (!cleanPhone) {
      return NextResponse.json(
        { error: "Please provide a valid Indian mobile number." },
        { status: 400 }
      );
    }

    if (!rawOtp || rawOtp.length !== 6 || !/^[0-9]{6}$/.test(rawOtp)) {
      return NextResponse.json(
        { error: "Please enter the 6-digit verification code sent to your phone." },
        { status: 400 }
      );
    }

    // 1. Fetch latest unused OTP record for this user and phone
    const rows = await sql.query(
      `SELECT id, otp_hash, attempts, expires_at, used
       FROM phone_otps 
       WHERE user_id = $1 AND phone = $2 AND used = false
       ORDER BY created_at DESC 
       LIMIT 1;`,
      [session.userId, cleanPhone]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "No active verification code found. Please request a new code." },
        { status: 400 }
      );
    }

    const otpRow = rows[0];

    // 2. Check Expiry
    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      await sql.query(`UPDATE phone_otps SET used = true WHERE id = $1;`, [otpRow.id]).catch(() => {});
      return NextResponse.json(
        { error: "This verification code has expired. Please request a fresh code." },
        { status: 400 }
      );
    }

    // 3. Check Attempts: Max 5 attempts
    const currentAttempts = Number(otpRow.attempts || 0);
    if (currentAttempts >= 5) {
      await sql.query(`UPDATE phone_otps SET used = true WHERE id = $1;`, [otpRow.id]).catch(() => {});
      return NextResponse.json(
        { error: "Too many incorrect attempts. This code is now invalid. Please request a new code." },
        { status: 429 }
      );
    }

    // 4. Increment attempt counter in DB
    await sql.query(
      `UPDATE phone_otps 
       SET attempts = attempts + 1 
       WHERE id = $1;`,
      [otpRow.id]
    );

    // 5. Compare OTP hashes in constant time
    const inputHash = hashOtp(rawOtp);
    const isMatch = timingSafeMatch(inputHash, otpRow.otp_hash);

    if (!isMatch) {
      const remaining = 4 - currentAttempts;
      return NextResponse.json(
        {
          error: remaining > 0
            ? `Incorrect verification code. ${remaining} attempts remaining.`
            : "Incorrect verification code. Maximum attempts reached.",
        },
        { status: 400 }
      );
    }

    // 6. OTP is verified: Check if number is already bound to another account before binding
    const tenDigit = cleanPhone.replace(/[^0-9]/g, "").slice(-10);
    const existingOtherUser = await sql.query(
      `SELECT id FROM customer_accounts 
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

    try {
      await sql.query(
        `UPDATE phone_otps 
         SET used = true 
         WHERE id = $1;`,
        [otpRow.id]
      );

      const updateRes = await sql.query(
        `UPDATE customer_accounts 
         SET phone = $1, 
             phone_verified = true, 
             phone_verified_at = NOW(), 
             updated_at = NOW() 
         WHERE id = $2 
         RETURNING id, phone, phone_verified, phone_verified_at;`,
        [cleanPhone, session.userId]
      );

      if (!updateRes || updateRes.length === 0) {
        return NextResponse.json({ error: "Customer account not found." }, { status: 404 });
      }

      const updatedAccount = updateRes[0];

      return NextResponse.json({
        success: true,
        verified: true,
        message: "Mobile number verified successfully!",
        user: {
          id: updatedAccount.id,
          phone: updatedAccount.phone,
          phone_verified: updatedAccount.phone_verified,
          phone_verified_at: updatedAccount.phone_verified_at,
        },
      });
    } catch (dbErr: any) {
      // Gracefully handle partial unique index violation (race condition where number was verified elsewhere)
      if (dbErr.code === "23505" || dbErr.message?.includes("uq_customer_accounts_phone_verified")) {
        return NextResponse.json(
          { error: "This mobile number is already verified and bound to another account." },
          { status: 409 }
        );
      }
      throw dbErr;
    }
  } catch (err: any) {
    console.error("[PHONE_VERIFY_OTP] Server error:", err?.message || err);
    return NextResponse.json(
      { error: "Server error during phone verification. Please try again." },
      { status: 500 }
    );
  }
}

