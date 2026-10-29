import { NextResponse } from "next/server";
import { sql } from "@/lib/neon/db";
import { cancelQueueSlot } from "@/lib/payment-queue";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { paymentId, orderId, orderRef, reason = "Payment cancelled by user" } = body;

    const rawBaseUrl = process.env.YOUPI_API_URL || process.env.YOUPI_BASE_URL || "https://youpi-pg-yer7.onrender.com";
    const youpiBaseUrl = rawBaseUrl.replace(/\/+$/, "");

    // 1. Cancel on live YouPI gateway to immediately release slot and queue
    if (paymentId && !paymentId.startsWith("yp_sbx_") && !paymentId.startsWith("yp_fb_")) {
      try {
        await fetch(`${youpiBaseUrl}/api/v1/checkout/${paymentId}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(4000),
        }).catch(() => {});
      } catch (gatewayErr) {
        console.warn("[YouPI Cancel] Gateway cancel notice:", gatewayErr);
      }
    }

    // 2. Cancel queue slot in Neon DB if orderId provided
    if (orderId) {
      await cancelQueueSlot(String(orderId), reason).catch(() => {});
    }

    // 3. Mark payment attempt as cancelled in Neon payments table
    if (sql && (paymentId || orderId || orderRef)) {
      try {
        await sql.query(
          `UPDATE payments 
           SET status = 'cancelled', updated_at = NOW() 
           WHERE youpi_payment_id = $1 OR order_id = $2 OR youpi_order_ref = $3;`,
          [paymentId || "none", orderId || "none", orderRef || "none"]
        ).catch(() => {});
      } catch {}
    }

    return NextResponse.json({
      success: true,
      cancelled: true,
      message: "Payment session cancelled and receiving slot released.",
    });
  } catch (error: any) {
    console.error("[YouPI Cancel] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to cancel payment session" },
      { status: 500 }
    );
  }
}

