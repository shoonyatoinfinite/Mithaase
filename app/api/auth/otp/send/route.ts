import { NextResponse } from "next/server";
import { sendOtpEmail } from "@/lib/email/mailer";

// Store active OTPs in memory: email -> { otp: string, expiresAt: number }
declare global {
  // eslint-disable-next-line no-var
  var __mithaase_otps: Map<string, { otp: string; expiresAt: number }> | undefined;
}

if (!global.__mithaase_otps) {
  global.__mithaase_otps = new Map();
}

const otpStore = global.__mithaase_otps;

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes("@") || !email.includes(".")) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Generate secure 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(normalizedEmail, { otp, expiresAt });

    // Send real email via SMTP
    const emailResult = await sendOtpEmail(normalizedEmail, otp);

    if (!emailResult.success) {
      return NextResponse.json(
        { error: emailResult.error || "Failed to deliver email verification code. Please check email settings." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `A 6-digit security code has been sent to ${normalizedEmail}. Please check your inbox or spam folder.`,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate verification code" }, { status: 500 });
  }
}
