import { NextResponse } from "next/server";
import { verifyWhatsAppOtp } from "@/lib/auth/otp-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawMobile = body.mobileNumber || body.phoneNumber || body.phone || "";
    const otp = String(body.otp || body.code || "").trim();
    const purpose = body.purpose || "signup"; // "signup" | "change" | "checkout" | "login"

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

    const result = await verifyWhatsAppOtp({
      rawPhone: rawMobile,
      purpose,
      otp,
      ip: clientIp,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      verified: true,
      message: "WhatsApp number verified successfully.",
      mobileNumber: result.dbPhone,
      verificationId: result.verificationId,
    });
  } catch (error: any) {
    console.error("[OTP_VERIFY] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to verify WhatsApp OTP" },
      { status: 500 }
    );
  }
}
