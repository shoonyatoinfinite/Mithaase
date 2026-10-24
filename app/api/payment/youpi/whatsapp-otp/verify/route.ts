import { NextResponse } from "next/server";
import { pendingWhatsappChallenges } from "../send/route";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawMobile = body.mobileNumber || body.phoneNumber || body.phone || "";
    const cleanMobile = rawMobile.replace(/[^0-9]/g, "").slice(-10);
    const otp = String(body.otp || body.code || "").trim();

    if (!cleanMobile || !otp) {
      return NextResponse.json(
        { error: "Mobile number and 6-digit WhatsApp OTP are required." },
        { status: 400 }
      );
    }

    const youpiBaseUrl = process.env.YOUPI_API_URL || process.env.YOUPI_BASE_URL || "http://localhost:6100";

    // 1. Attempt verification with live YouPI Gateway
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${youpiBaseUrl}/api/v1/customer/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobileNumber: cleanMobile,
          otp,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({
          success: true,
          verified: true,
          mode: "live",
          message: "WhatsApp number successfully verified via YouPI.",
          mobileNumber: cleanMobile,
        });
      }
    } catch (e) {
      // YouPI Gateway offline; proceed to sandbox verification
    }

    // Verification against generated challenge
    const challenge = pendingWhatsappChallenges.get(cleanMobile);
    const isMatched = challenge && challenge.otpCode === otp;

    if (!isMatched) {
      if (challenge) {
        challenge.attempts += 1;
        if (challenge.attempts >= 5) {
          pendingWhatsappChallenges.delete(cleanMobile);
          return NextResponse.json(
            { error: "Too many incorrect attempts. Please request a new WhatsApp OTP." },
            { status: 429 }
          );
        }
      }
      return NextResponse.json(
        { error: "Invalid WhatsApp verification code. Please check and try again." },
        { status: 400 }
      );
    }

    if (challenge && Date.now() > challenge.expiresAt) {
      pendingWhatsappChallenges.delete(cleanMobile);
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new OTP." },
        { status: 400 }
      );
    }

    // Clear challenge after successful verification
    pendingWhatsappChallenges.delete(cleanMobile);

    return NextResponse.json({
      success: true,
      verified: true,
      message: "WhatsApp number successfully verified.",
      mobileNumber: cleanMobile,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to verify WhatsApp OTP" },
      { status: 500 }
    );
  }
}
