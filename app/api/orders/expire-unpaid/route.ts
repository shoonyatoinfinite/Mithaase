import { NextResponse } from "next/server";
import crypto from "crypto";
import { sql, withTransaction } from "@/lib/neon/db";
import { isAdminAuthenticated } from "@/lib/auth/session";
import { serverCache } from "@/lib/cache/server-cache";
import { broadcastRealtimeEvent } from "@/lib/events/broadcast";
import { expireStaleQueueSlots } from "@/lib/payment-queue";

export const dynamic = "force-dynamic";

async function processExpiration(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isAdmin = isAdminAuthenticated(req);

    // Vercel Cron sends CRON_SECRET or runs internally
    if (cronSecret && !isCronAuthorized && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    // 1. Expire stale active queue slots and promote next queued order
    const queueSweep = await expireStaleQueueSlots().catch(() => ({ expiredCount: 0, promotedCount: 0 }));

    // 2. Find orders pending payment older than 15 minutes
    const expiredOrders = await sql.query(
      `SELECT id, order_number 
       FROM orders 
       WHERE payment_method = 'upi' 
         AND payment_status IN ('unpaid', 'pending_verification')
         AND order_status = 'pending_confirmation'
         AND created_at < NOW() - INTERVAL '15 minutes'
       LIMIT 50;`
    );

    if (!expiredOrders || expiredOrders.length === 0) {
      return NextResponse.json({ expiredCount: 0, message: "No expired orders to process" });
    }

    let processedCount = 0;

    for (const exp of expiredOrders) {
      await withTransaction(async (client) => {
        // Atomically cancel order ONLY IF not already cancelled
        const cancelRes = await client.query(
          `UPDATE orders SET
             order_status = 'cancelled',
             cancellation_reason = 'Payment time limit exceeded (15 minutes)',
             updated_at = NOW()
           WHERE id = $1 AND order_status <> 'cancelled'
           RETURNING id, order_number;`,
          [exp.id]
        );

        if (cancelRes.rowCount === 0) {
          // Already cancelled by another process
          return;
        }

        // Fetch items to restore stock exactly once
        const itemsRes = await client.query(
          `SELECT variant_id, quantity, product_name_snapshot, variant_name_snapshot 
           FROM order_items 
           WHERE order_id = $1 AND variant_id IS NOT NULL;`,
          [exp.id]
        );

        for (const item of itemsRes.rows) {
          const qty = Number(item.quantity);
          const updateRes = await client.query(
            `UPDATE product_variants 
             SET stock_quantity = stock_quantity + $1, updated_at = NOW() 
             WHERE id = $2
             RETURNING stock_quantity;`,
            [qty, item.variant_id]
          );

          const stockAfter = updateRes.rows[0]?.stock_quantity || 0;

          await client.query(
            `INSERT INTO inventory_movements (
               variant_id, product_name, variant_name, movement_type, 
               quantity_change, stock_after, reason, related_order_id, created_by
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
            [
              item.variant_id,
              item.product_name_snapshot,
              item.variant_name_snapshot,
              "order_cancellation",
              qty,
              stockAfter,
              `Stock restored: unpaid order ${exp.order_number} expired`,
              exp.id,
              "System",
            ]
          );
        }

        // Record history
        await client.query(
          `INSERT INTO order_status_history (id, order_id, previous_status, new_status, changed_by, note, created_at)
           VALUES ($1, $2, 'pending_confirmation', 'cancelled', 'System', 'Unpaid UPI order automatically expired after 15 minutes; inventory restored', NOW());`,
          [crypto.randomUUID(), exp.id]
        );

        processedCount++;
      });

      // Dispatch cancellation email alert to customer
      try {
        const { sendOrderCancelledNotification } = await import("@/lib/notifications/order-notifications");
        sendOrderCancelledNotification(exp.id, "Payment time limit exceeded (15 minutes)").catch(() => {});
      } catch {}
    }

    if (processedCount > 0) {
      // Invalidate caches and bump catalog_version in database
      await sql.query(
        `UPDATE store_settings SET catalog_version = COALESCE(catalog_version, 1) + 1, updated_at = NOW() WHERE id = 1;`
      ).catch(() => {});

      serverCache.invalidateTag("products");
      serverCache.invalidateTag("orders");
      broadcastRealtimeEvent("inventory_updated", { reason: "unpaid_orders_expired" });
    }

    return NextResponse.json({
      success: true,
      processedCount,
      queueExpiredCount: queueSweep.expiredCount,
      queuePromotedCount: queueSweep.promotedCount,
      message: `Successfully processed queue expirations and ${processedCount} unpaid orders.`,
    });
  } catch (error: any) {
    console.error("[EXPIRE_UNPAID] Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to expire unpaid orders" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return processExpiration(req);
}

export async function POST(req: Request) {
  return processExpiration(req);
}
