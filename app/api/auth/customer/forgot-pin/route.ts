import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/neon/db";
import { sendOtpEmail, sendPinResetEmail } from "@/lib/email/mailer";
import { sendWhatsAppOtp, verifyWhatsAppOtp, checkRateLimit, clearRateLimit } from "@/lib/auth/otp-service";
import { normalizeAndValidateWhatsAppPhone } from "@/lib/utils/phone";

export const dynamic = "force-dynamic";

function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const visible = name.length > 2 ? `${name.slice(0, 2)}***${name.slice(-1)}` : `${name.slice(0, 1)}***`;
  return `${visible}@${domain}`;
}

function maskPhone(phone: string): string {
  const clean = phone.replace(/[^0-9]/g, "").slice(-10);
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 2)}****${clean.slice(-4)}`;
  }
  return phone;
}

export async function POST(req: Request) {
  try {
    if (!sql) {
      return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    }

    const body = await req.json();
    const action = body.action || "request"; // "request" | "verify_email" | "verify_whatsapp_and_reset"
    const rawIdentifier = String(body.identifier || "").trim();
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

    if (!rawIdentifier) {
      return NextResponse.json({ error: "Please enter your registered mobile number or email." }, { status: 400 });
    }

    // Rate limit per IP
    const ipLimit = await checkRateLimit(clientIp, "otp_send", clientIp, 15, 15);
    if (!ipLimit.allowed && action === "request") {
      return NextResponse.json({ error: ipLimit.error }, { status: 429 });
    }

    // 1. Locate customer account in Neon PostgreSQL
    const cleanPhone = rawIdentifier.replace(/[^0-9]/g, "").slice(-10);
    const hasValidPhone = cleanPhone.length === 10;
    const normEmail = rawIdentifier.toLowerCase();

    const custRows = await sql.query(
      `SELECT id, name, email, phone 
       FROM customer_accounts 
       WHERE LOWER(email) = $1 
          OR ($2 = TRUE AND (phone = $3 OR RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = $3))
       LIMIT 1;`,
      [normEmail, hasValidPhone, cleanPhone]
    );

    if (!custRows || custRows.length === 0) {
      return NextResponse.json(
        { error: "No account found matching this identifier. Please verify or register a new account." },
        { status: 404 }
      );
    }

    const customer = custRows[0];

    // ==========================================
    // ACTION 1: REQUEST - SEND EMAIL OTP
    // ==========================================
    if (action === "request") {
      const otpNumber = crypto.randomInt(100000, 1000000);
      const plainOtp = otpNumber.toString();
      const secret = process.env.YOUPI_OTP_SECRET || process.env.SESSION_SECRET || "mithaase_otp_secret";
      const otpHmac = crypto.createHmac("sha256", secret).update(`${customer.email}:${plainOtp}:forgot_pin_email`).digest("hex");

      // Invalidate past email OTPs for forgot_pin
      await sql.query(
        `UPDATE phone_verifications 
         SET consumed_at = NOW() 
         WHERE phone = $1 AND purpose = 'forgot_pin_email' AND consumed_at IS NULL;`,
        [customer.email]
      );

      // Store new OTP in Neon
      await sql.query(
        `INSERT INTO phone_verifications (phone, purpose, user_id, otp_hash, expires_at, attempts, ip)
         VALUES ($1, 'forgot_pin_email', $2, $3, NOW() + INTERVAL '10 minutes', 0, $4);`,
        [customer.email, customer.id, otpHmac, clientIp]
      );

      const emailResult = await sendOtpEmail(customer.email, plainOtp);
      if (!emailResult.success) {
        return NextResponse.json({ error: "Failed to dispatch email verification code. Please try again." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        step: "email_sent",
        maskedEmail: maskEmail(customer.email),
        maskedPhone: maskPhone(customer.phone),
        message: `A 6-digit verification code has been dispatched to ${maskEmail(customer.email)}.`,
      });
    }

    // ==========================================
    // ACTION 2: VERIFY EMAIL & DISPATCH WHATSAPP OTP
    // ==========================================
    if (action === "verify_email") {
      const emailOtp = String(body.emailOtp || body.otp || "").trim();
      if (!emailOtp || emailOtp.length !== 6) {
        return NextResponse.json({ error: "Please enter the 6-digit email verification code." }, { status: 400 });
      }

      const secret = process.env.YOUPI_OTP_SECRET || process.env.SESSION_SECRET || "mithaase_otp_secret";
      const expectedHmac = crypto.createHmac("sha256", secret).update(`${customer.email}:${emailOtp}:forgot_pin_email`).digest("hex");

      const rows = await sql.query(
        `SELECT id, otp_hash, expires_at, attempts, consumed_at 
         FROM phone_verifications 
         WHERE phone = $1 AND purpose = 'forgot_pin_email' AND consumed_at IS NULL
         ORDER BY created_at DESC LIMIT 1;`,
        [customer.email]
      );

      if (!rows || rows.length === 0) {
        return NextResponse.json({ error: "No active verification code found for this email. Please request a new code." }, { status: 400 });
      }

      const rec = rows[0];
      if (new Date() > new Date(rec.expires_at)) {
        await sql.query(`UPDATE phone_verifications SET consumed_at = NOW() WHERE id = $1;`, [rec.id]);
        return NextResponse.json({ error: "Email verification code has expired. Please request a new code." }, { status: 400 });
      }

      if (rec.otp_hash !== expectedHmac) {
        await sql.query(`UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = $1;`, [rec.id]);
        return NextResponse.json({ error: "Incorrect email verification code. Please check and try again." }, { status: 400 });
      }

      // Automatically dispatch WhatsApp OTP to registered customer phone
      // Bypass IP cooldown collision from the immediate prior email OTP request
      const waSend = await sendWhatsAppOtp({
        rawPhone: customer.phone,
        purpose: "change",
        ip: clientIp,
        customerName: customer.name,
        userId: customer.id,
        skipIpCooldown: true,
      });

      if (!waSend.success) {
        return NextResponse.json(
          { error: waSend.error || "Failed to dispatch WhatsApp OTP. Please verify your phone." },
          { status: 400 }
        );
      }

      // Mark email OTP as consumed ONLY AFTER WhatsApp OTP was successfully dispatched
      await sql.query(`UPDATE phone_verifications SET consumed_at = NOW() WHERE id = $1;`, [rec.id]);

      return NextResponse.json({
        success: true,
        step: "whatsapp_sent",
        emailVerified: true,
        maskedPhone: maskPhone(customer.phone),
        message: `Email verified successfully. A WhatsApp verification code has been dispatched to ${maskPhone(customer.phone)}.`,
      });
    }

    // ==========================================
    // ACTION 3: VERIFY WHATSAPP & RESET PIN
    // ==========================================
    if (action === "verify_whatsapp_and_reset") {
      const whatsappOtp = String(body.whatsappOtp || body.otp || "").trim();
      if (!whatsappOtp || whatsappOtp.length !== 6) {
        return NextResponse.json({ error: "Please enter the 6-digit WhatsApp verification code." }, { status: 400 });
      }

      // 1. Verify WhatsApp OTP
      const waVerify = await verifyWhatsAppOtp({
        rawPhone: customer.phone,
        purpose: "change",
        otp: whatsappOtp,
        ip: clientIp,
      });

      if (!waVerify.success) {
        return NextResponse.json({ error: waVerify.error || "Incorrect WhatsApp verification code." }, { status: 400 });
      }

      // 2. Use user-specified 6-digit PIN or generate a random one
      let finalPin = "";
      const rawNewPin = String(body.newPin || body.pin || "").replace(/[^0-9]/g, "").trim();
      if (rawNewPin && rawNewPin.length === 6) {
        finalPin = rawNewPin;
      } else {
        const pinNum = crypto.randomInt(100000, 1000000);
        finalPin = pinNum.toString();
      }

      const pinHash = await bcrypt.hash(finalPin, 10);

      // 3. Atomically update Neon customer_accounts
      await sql.query(
        `UPDATE customer_accounts 
         SET pin_hash = $1, pin = NULL, updated_at = NOW() 
         WHERE id = $2;`,
        [pinHash, customer.id]
      );

      // 4. Dispatch new PIN to Email
      await sendPinResetEmail(customer.email, customer.name, finalPin);

      // 5. Clear any login lockout rate limits for this customer
      await clearRateLimit(customer.email.toLowerCase(), "login_fail");
      if (customer.phone) {
        await clearRateLimit(customer.phone, "login_fail");
      }

      return NextResponse.json({
        success: true,
        resetCompleted: true,
        message: `Your 6-digit security PIN has been successfully reset! A confirmation with your new PIN has been sent to your registered email (${maskEmail(customer.email)}).`,
      });
    }

    return NextResponse.json({ error: "Invalid action requested" }, { status: 400 });
  } catch (error: any) {
    console.error("[FORGOT_PIN_ROUTE] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
