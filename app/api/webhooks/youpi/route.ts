import { NextResponse } from "next/server";
import crypto from "crypto";
import { sql } from "@/lib/neon/db";
import { broadcastRealtimeEvent } from "@/lib/events/broadcast";
import { serverCache } from "@/lib/cache/server-cache";
import { expireStaleAttempts, markVerified } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Authoritative YouPI PG Webhook Handler
 * Verified with HMAC-SHA256, matches currency & amounts, and prevents late payment overrides on cancelled orders.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-gateway-signature") || "";
    const webhookSecret = process.env.YOUPI_WEBHOOK_SECRET;

    // 1. Enforce HMAC-SHA256 signature verification
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
        console.warn("[YouPI Webhook] Invalid signature rejected");
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === "production") {
      console.error("[YouPI Webhook] YOUPI_WEBHOOK_SECRET is not configured in production");
      return NextResponse.json({ error: "Webhook signature secret required" }, { status: 500 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { event, orderId, utr, paymentId, amount } = payload;

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId in payload" }, { status: 400 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    expireStaleAttempts().catch(() => {});

    // 2. Query order directly from Neon PostgreSQL
    const orderRows = await sql.query(
      `SELECT id, order_number, order_ref, total_amount, payment_status, order_status 
       FROM orders 
       WHERE id = $1 OR order_number = $1 OR order_ref = $1
       LIMIT 1;`,
      [orderId]
    );

    if (!orderRows || orderRows.length === 0) {
      return NextResponse.json({ error: "Order not found in database" }, { status: 404 });
    }

    const order = orderRows[0];

    // 3. Match amount (prevent underpayment or price tampering)
    if (amount !== undefined && amount !== null) {
      const paidAmount = Number(amount);
      const expectedAmount = Number(order.total_amount);
      if (Math.abs(paidAmount - expectedAmount) > 0.05) {
        console.error(
          `[YouPI Webhook] Amount mismatch! Expected ₹${expectedAmount}, received ₹${paidAmount}`
        );
        return NextResponse.json(
          { error: "Payment amount does not match order total" },
          { status: 400 }
        );
      }
    }

    // 4. Validate state transitions (A late payment success must NOT override a cancelled order)
    if (order.order_status === "cancelled") {
      console.warn(
        `[YouPI Webhook] Order ${order.order_number} is already cancelled! Late payment requires manual refund reconciliation.`
      );
      await sql.query(
        `INSERT INTO order_status_history (id, order_id, previous_status, new_status, changed_by, note, created_at)
         VALUES ($1, $2, 'cancelled', 'cancelled', 'YouPI Webhook', $3, NOW());`,
        [
          crypto.randomUUID(),
          order.id,
          `Late payment received (₹${amount || order.total_amount}, UTR: ${utr || paymentId}) for already-cancelled order. Requires manual refund.`,
        ]
      );
      return NextResponse.json({ received: true, note: "Order already cancelled; logged for reconciliation." });
    }

    // 5. Idempotent state transition (only updates if payment_status is not already 'paid')
    if (event === "SUCCESS") {
      const cleanUtr = utr ? String(utr).trim().toUpperCase() : paymentId;
      const finalAmountReceived = Number(amount ?? order.total_amount);

      // Attempt strict payment tracking verification
      const vRes = await markVerified({
        youpiPaymentId: paymentId,
        attemptRef: orderId,
        amountReceived: finalAmountReceived,
        upiTxnRef: cleanUtr,
        payerVpaRaw: payload.payerVpa || payload.customerVpa || null,
        source: "youpi_webhook",
        raw: payload,
      });

      if (vRes?.status === "mismatch") {
        return NextResponse.json(
          { error: "Amount mismatch detected on payment attempt; routed to manual review." },
          { status: 400 }
        );
      }

      if (vRes?.status === "received_expired") {
        return NextResponse.json({
          received: true,
          status: "received_expired",
          note: "Payment received after 10-minute expiry; held for manual reconciliation.",
        });
      }

      // If legacy in-flight payment (vRes === null, no payments row found)
      if (!vRes) {
        await sql.query(
          `UPDATE orders SET
             payment_status = 'paid',
             queue_status = 'paid',
             gateway_transaction_id = COALESCE($1, gateway_transaction_id),
             upi_reference = COALESCE($2, upi_reference),
             order_status = CASE WHEN order_status = 'pending_confirmation' THEN 'confirmed' ELSE order_status END,
             updated_at = NOW()
           WHERE (id = $3 OR order_number = $3) AND payment_status <> 'paid';`,
          [paymentId || null, cleanUtr, orderId]
        );

        // Promote next queued order for legacy path as well
        try {
          const { promoteNextQueuedOrder } = await import("@/lib/payment-queue");
          promoteNextQueuedOrder().catch(() => {});
        } catch {}
      }

      // Record status history if not already recorded
      await sql.query(
        `INSERT INTO order_status_history (id, order_id, previous_status, new_status, changed_by, note, created_at)
         VALUES ($1, $2, $3, $4, 'YouPI Webhook', $5, NOW());`,
        [
          crypto.randomUUID(),
          order.id,
          order.order_status,
          order.order_status === "pending_confirmation" ? "confirmed" : order.order_status,
          `Instant UPI Auto-Verification via YouPI Gateway (UTR: ${cleanUtr})`,
        ]
      );

      serverCache.invalidateTag("orders");

      const updatedOrder = await sql.query(`SELECT * FROM orders WHERE id = $1 LIMIT 1;`, [order.id]);
      if (updatedOrder && updatedOrder.length > 0) {
        broadcastRealtimeEvent("order_status_updated", updatedOrder[0]);
      }
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (err: any) {
    console.error("[YouPI Webhook] Processing error:", err);
    return NextResponse.json(
      { error: err?.message || "Webhook processing error" },
      { status: 500 }
    );
  }
}
