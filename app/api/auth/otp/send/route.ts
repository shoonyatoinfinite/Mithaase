import { NextResponse } from "next/server";
import { sendWhatsAppOtp } from "@/lib/auth/otp-service";
import { normalizeAndValidateWhatsAppPhone } from "@/lib/utils/phone";
import { sendOtpEmail } from "@/lib/email/mailer";
import { sql } from "@/lib/neon/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = body.phone || body.mobileNumber || body.phoneNumber;
    const email = body.email ? String(body.email).trim().toLowerCase() : undefined;
    const customerName = body.name || body.customerName || "Customer";
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

    if (sql) {
      const settingsRows = await sql.query(
        `SELECT store_status, store_shutoff, shutoff_message FROM store_settings WHERE id = 1 LIMIT 1;`
      );
      if (settingsRows && settingsRows.length > 0) {
        const s = settingsRows[0];
        if (s.store_shutoff || s.store_status === "shutoff") {
          return NextResponse.json(
            { error: s.shutoff_message || "The store is permanently closed. New customer signups are currently disabled." },
            { status: 403 }
          );
        }
      }
    }

    // 1. If phone is provided, send WhatsApp OTP (Primary Reachability Requirement)
    if (phone) {
      const result = await sendWhatsAppOtp({
        rawPhone: phone,
        purpose: "signup",
        ip: clientIp,
        customerName,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error, retryAfterSeconds: result.retryAfterSeconds },
          { status: result.retryAfterSeconds ? 429 : 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "WhatsApp verification code dispatched.",
        mobileNumber: result.dbPhone,
      });
    }

    // 2. If email provided, dispatch via SMTP and persist hash in Neon DB
    if (email && email.includes("@")) {
      if (!sql) {
        return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
      }

      const crypto = await import("crypto");
      const otpNumber = crypto.randomInt(100000, 1000000);
      const plainOtp = otpNumber.toString();
      const secret = process.env.YOUPI_OTP_SECRET || process.env.SESSION_SECRET || "mithaase_otp_secret";
      const otpHmac = crypto.createHmac("sha256", secret).update(`${email}:${plainOtp}:signup`).digest("hex");

      // Invalidate past email OTPs
      await sql.query(
        `UPDATE phone_verifications 
         SET consumed_at = NOW() 
         WHERE phone = $1 AND purpose = 'signup' AND consumed_at IS NULL;`,
        [email]
      );

      // Store in phone_verifications table in Neon DB (no in-memory map!)
      await sql.query(
        `INSERT INTO phone_verifications (phone, purpose, otp_hash, expires_at, attempts, ip)
         VALUES ($1, 'signup', $2, NOW() + INTERVAL '10 minutes', 0, $3);`,
        [email, otpHmac, clientIp]
      );

      const emailResult = await sendOtpEmail(email, plainOtp);
      if (!emailResult.success) {
        return NextResponse.json(
          { error: emailResult.error || "Failed to deliver email verification code." },
          { status: 503 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `A 6-digit security code has been sent to ${email}.`,
      });
    }

    return NextResponse.json({ error: "Please provide a valid mobile number or email address." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate verification code" }, { status: 500 });
  }
}
