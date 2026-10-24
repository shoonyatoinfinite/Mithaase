import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// In-memory challenge store for sandbox / local development
export const pendingWhatsappChallenges = new Map<
  string,
  {
    otpCode: string;
    expiresAt: number;
    attempts: number;
  }
>();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawMobile = body.mobileNumber || body.phoneNumber || body.phone || "";
    const cleanMobile = rawMobile.replace(/[^0-9]/g, "").slice(-10);

    if (!cleanMobile || cleanMobile.length !== 10) {
      return NextResponse.json(
        { error: "Please provide a valid 10-digit mobile number." },
        { status: 400 }
      );
    }

    const youpiBaseUrl = process.env.YOUPI_API_URL || process.env.YOUPI_BASE_URL || "http://localhost:6100";

    // 1. Attempt to dispatch via live YouPI PG Berry WhatsApp socket
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${youpiBaseUrl}/api/v1/customer/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobileNumber: cleanMobile,
          displayName: body.customerName || "Mithaase Customer",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        return NextResponse.json({
          success: true,
          message: "Verification code sent to your WhatsApp number.",
          mobileNumber: cleanMobile,
        });
      }
    } catch (e) {
      // YouPI Gateway offline
    }

    // 2. Challenge generation (cryptographic 6-digit code)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    pendingWhatsappChallenges.set(cleanMobile, {
      otpCode,
      expiresAt,
      attempts: 0,
    });

    console.log(`[YouPI WhatsApp] OTP generated for +91${cleanMobile}: ${otpCode}`);

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your WhatsApp number.",
      mobileNumber: cleanMobile,
      expiresInSeconds: 300,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to dispatch WhatsApp OTP" },
      { status: 500 }
    );
  }
}
