import { NextResponse } from "next/server";
import { sendWhatsAppOtp } from "@/lib/auth/otp-service";
import { getCustomerSessionFromRequest } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawMobile = body.mobileNumber || body.phoneNumber || body.phone || "";
    const purpose = body.purpose || "signup"; // "signup" | "change" | "checkout" | "login"
    const customerName = body.customerName || body.name || "Customer";

    if (purpose === "signup") {
      const { sql } = await import("@/lib/neon/db");
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
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const session = await getCustomerSessionFromRequest(req);

    const result = await sendWhatsAppOtp({
      rawPhone: rawMobile,
      purpose,
      ip: clientIp,
      customerName,
      userId: session?.userId,
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
      expiresInSeconds: 300,
    });
  } catch (error: any) {
    console.error("[OTP_SEND] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to dispatch WhatsApp OTP" },
      { status: 500 }
    );
  }
}
