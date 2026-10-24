import { NextResponse } from "next/server";
import crypto from "crypto";
import { updatePaymentStatus, getOrderById } from "@/lib/data/store";
import { broadcastRealtimeEvent } from "@/lib/events/broadcast";

export const dynamic = "force-dynamic";

/**
 * YouPI PG Authoritative Webhook Endpoint
 * Header: X-Gateway-Signature: sha256=<hex>
 * Payload: { event: "SUCCESS", orderId, utr, amount, amountPaise, paymentId }
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-gateway-signature") || "";
    const webhookSecret = process.env.YOUPI_WEBHOOK_SECRET;

    // Verify HMAC-SHA256 signature if secret is configured
    if (webhookSecret) {
      const expectedSignature =
        "sha256=" +
        crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

      const sigBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (
        sigBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
      ) {
        console.warn("[YouPI Webhook] Signature verification failed!");
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 401 }
        );
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { event, orderId, utr, paymentId } = payload;

    if (event === "SUCCESS" && orderId) {
      console.log(`[YouPI Webhook] Order ${orderId} confirmed paid! UTR: ${utr}`);

      const existingOrder = await getOrderById(orderId);
      if (existingOrder) {
        // Mark payment as paid in database with verified bank UTR
        await updatePaymentStatus(orderId, "paid", utr || paymentId);

        const updated = await getOrderById(orderId);
        if (updated) {
          // Broadcast real-time update to Admin and customer tracking views
          broadcastRealtimeEvent("order_status_updated", updated);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[YouPI Webhook] Error processing event:", err);
    return NextResponse.json(
      { error: err?.message || "Webhook processing error" },
      { status: 500 }
    );
  }
}
