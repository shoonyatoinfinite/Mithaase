import { NextResponse } from "next/server";

declare global {
  // eslint-disable-next-line no-var
  var __mithaase_otps: Map<string, { otp: string; expiresAt: number }> | undefined;
}

const otpStore = global.__mithaase_otps || new Map();

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: "Email and OTP code are required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();


    const record = otpStore.get(normalizedEmail);

    if (!record) {
      return NextResponse.json(
        { error: "No verification code requested for this email, or code has expired. Please request a new code." },
        { status: 400 }
      );
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(normalizedEmail);
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new code." },
        { status: 400 }
      );
    }

    if (record.otp !== cleanOtp) {
      return NextResponse.json(
        { error: "Incorrect verification code. Please check and try again." },
        { status: 400 }
      );
    }

    // OTP matched! Clean up
    otpStore.delete(normalizedEmail);

    const response = NextResponse.json({
      success: true,
      user: {
        email: normalizedEmail,
        verifiedAt: new Date().toISOString(),
      },
    });

    response.cookies.set("mithaase_customer_session", encodeURIComponent(normalizedEmail), {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: "Server error verifying code" }, { status: 500 });
  }
}
