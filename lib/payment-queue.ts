/**
 * Authoritative Database-Backed One-Customer-at-a-Time Payment Queue
 * Persists all queue states directly in Neon PostgreSQL.
 * Zero in-memory state, zero client trust, atomic slot claiming.
 */

import { sql, withTransaction } from "@/lib/neon/db";
import { notifyTurnStarted } from "@/lib/whatsapp/payment-notifications";
import { normalizeAndValidateWhatsAppPhone } from "@/lib/utils/phone";

export type QueueStatus = "none" | "queued" | "active" | "paid" | "expired" | "cancelled";

export interface QueueStateResult {
  queueStatus: QueueStatus;
  queuePosition: number;
  estimatedWaitSeconds: number;
  expiresAt: string | null;
  remainingSeconds: number;
  suggestCod: boolean;
  orderRef?: string;
  amount?: number;
  totalQueued?: number;
  customerPhone?: string;
  customerName?: string;
  paymentStatus?: string;
}

/**
 * Claims the single active payment slot atomically OR places the order into the queue.
 * Strictly limits each account/phone number to one queued or active order at a time.
 */
export async function claimOrEnqueueOrder(params: {
  orderId: string;
  phone: string;
  amount?: number;
}): Promise<{
  ok: boolean;
  status: QueueStatus;
  queuePosition: number;
  estimatedWaitSeconds: number;
  expiresAt: string | null;
  error?: string;
  conflict?: boolean;
}> {
  if (!sql) {
    return {
      ok: false,
      status: "none",
      queuePosition: 0,
      estimatedWaitSeconds: 0,
      expiresAt: null,
      error: "Database unavailable",
    };
  }

  const phoneVal = normalizeAndValidateWhatsAppPhone(params.phone);
  const cleanPhone = phoneVal.isValid ? phoneVal.dbFormat : params.phone.replace(/[^0-9]/g, "").slice(-10);

  return await withTransaction(async (client) => {
    // 1. Check if this customer phone already has another active or queued order
    const existingCustRows = await client.query(
      `SELECT id, order_ref, queue_status, queue_expires_at, queue_last_heartbeat_at
       FROM orders
       WHERE customer_phone = $1
         AND id <> $2
         AND queue_status IN ('queued', 'active')
       LIMIT 1;`,
      [cleanPhone, params.orderId]
    );

    if (existingCustRows.rows.length > 0) {
      const existing = existingCustRows.rows[0];
      // Check if existing active slot is actually stale
      const now = new Date();
      const isStaleActive =
        existing.queue_status === "active" &&
        ((existing.queue_expires_at && new Date(existing.queue_expires_at) <= now) ||
          (existing.queue_last_heartbeat_at &&
            new Date(existing.queue_last_heartbeat_at).getTime() < now.getTime() - 2 * 60 * 1000));

      if (isStaleActive) {
        // Expire stale order and release slot
        await client.query(
          `UPDATE orders SET queue_status = 'expired', updated_at = NOW() WHERE id = $1;`,
          [existing.id]
        );
      } else {
        return {
          ok: false,
          status: existing.queue_status as QueueStatus,
          queuePosition: 0,
          estimatedWaitSeconds: 0,
          expiresAt: existing.queue_expires_at ? new Date(existing.queue_expires_at).toISOString() : null,
          conflict: true,
          error: "You already have an active or queued payment session in progress on this mobile number.",
        };
      }
    }

    // 2. Fetch current state of this order
    const currentOrderRes = await client.query(
      `SELECT id, queue_status, queued_at, activated_at, queue_expires_at, queue_last_heartbeat_at
       FROM orders
       WHERE id = $1
       LIMIT 1;`,
      [params.orderId]
    );

    if (currentOrderRes.rows.length === 0) {
      return {
        ok: false,
        status: "none",
        queuePosition: 0,
        estimatedWaitSeconds: 0,
        expiresAt: null,
        error: "Order not found",
      };
    }

    const currentOrder = currentOrderRes.rows[0];
    const now = new Date();

    // If order is already paid, cancelled, or expired, don't re-enqueue
    if (["paid", "cancelled"].includes(currentOrder.queue_status)) {
      return {
        ok: true,
        status: currentOrder.queue_status as QueueStatus,
        queuePosition: 0,
        estimatedWaitSeconds: 0,
        expiresAt: currentOrder.queue_expires_at ? new Date(currentOrder.queue_expires_at).toISOString() : null,
      };
    }

    // If already active and valid, refresh heartbeat and return
    if (
      currentOrder.queue_status === "active" &&
      currentOrder.queue_expires_at &&
      new Date(currentOrder.queue_expires_at) > now
    ) {
      await client.query(
        `UPDATE orders SET queue_last_heartbeat_at = NOW() WHERE id = $1;`,
        [params.orderId]
      );
      return {
        ok: true,
        status: "active",
        queuePosition: 0,
        estimatedWaitSeconds: 0,
        expiresAt: new Date(currentOrder.queue_expires_at).toISOString(),
      };
    }

    // 3. Atomically check if any other order currently holds the single active slot
    const activeLockRes = await client.query(
      `SELECT id, queue_expires_at, queue_last_heartbeat_at
       FROM orders
       WHERE queue_status = 'active'
         AND id <> $1
       LIMIT 1
       FOR UPDATE;`,
      [params.orderId]
    );

    let isSlotAvailable = true;

    if (activeLockRes.rows.length > 0) {
      const activeSlot = activeLockRes.rows[0];
      const expiresAt = activeSlot.queue_expires_at ? new Date(activeSlot.queue_expires_at) : null;
      const lastHeartbeat = activeSlot.queue_last_heartbeat_at ? new Date(activeSlot.queue_last_heartbeat_at) : null;

      const isExpired = expiresAt && expiresAt <= now;
      const isDeadHeartbeat = lastHeartbeat && lastHeartbeat.getTime() < now.getTime() - 2 * 60 * 1000;

      if (isExpired || isDeadHeartbeat) {
        // Expire the dead active order
        await client.query(
          `UPDATE orders SET queue_status = 'expired', updated_at = NOW() WHERE id = $1;`,
          [activeSlot.id]
        );
        isSlotAvailable = true;
      } else {
        isSlotAvailable = false;
      }
    }

    // 4. If slot is available, claim ACTIVE slot directly (10 min + 30s buffer)
    if (isSlotAvailable) {
      const activateRes = await client.query(
        `UPDATE orders
         SET queue_status = 'active',
             activated_at = NOW(),
             queue_expires_at = NOW() + INTERVAL '10 minutes 30 seconds',
             queue_last_heartbeat_at = NOW(),
             queued_at = COALESCE(queued_at, NOW()),
             updated_at = NOW()
         WHERE id = $1
         RETURNING queue_expires_at;`,
        [params.orderId]
      );

      const expDate = activateRes.rows[0]?.queue_expires_at;
      return {
        ok: true,
        status: "active",
        queuePosition: 0,
        estimatedWaitSeconds: 0,
        expiresAt: expDate ? new Date(expDate).toISOString() : null,
      };
    }

    // 5. Slot is busy -> Place order in QUEUED state
    const queueRes = await client.query(
      `UPDATE orders
       SET queue_status = 'queued',
           queued_at = COALESCE(queued_at, NOW()),
           updated_at = NOW()
       WHERE id = $1
       RETURNING queued_at;`,
      [params.orderId]
    );

    const queuedAt = queueRes.rows[0]?.queued_at || now;

    // Calculate queue position (count of orders queued before or at this time)
    const posRes = await client.query(
      `SELECT COUNT(*)::int AS pos
       FROM orders
       WHERE queue_status = 'queued'
         AND queued_at <= $1;`,
      [queuedAt]
    );

    const position = Math.max(1, Number(posRes.rows[0]?.pos || 1));
    const estimatedWait = position * 600; // 10 minutes per person ahead

    return {
      ok: true,
      status: "queued",
      queuePosition: position,
      estimatedWaitSeconds: estimatedWait,
      expiresAt: null,
    };
  });
}

/**
 * Lightweight query to poll queue position and remaining active time
 */
export async function getQueueState(orderId: string): Promise<QueueStateResult> {
  if (!sql) {
    return {
      queueStatus: "none",
      queuePosition: 0,
      estimatedWaitSeconds: 0,
      expiresAt: null,
      remainingSeconds: 0,
      suggestCod: false,
    };
  }

  const rows = await sql.query(
    `SELECT id, order_ref, total_amount, customer_phone, customer_name, queue_status, queued_at, activated_at, 
            queue_expires_at, queue_last_heartbeat_at, payment_status
     FROM orders
     WHERE id = $1 OR order_number = $1 OR order_ref = $1
     LIMIT 1;`,
    [orderId]
  );

  if (!rows || rows.length === 0) {
    return {
      queueStatus: "none",
      queuePosition: 0,
      estimatedWaitSeconds: 0,
      expiresAt: null,
      remainingSeconds: 0,
      suggestCod: false,
    };
  }

  const order = rows[0];
  const status = (order.queue_status || "none") as QueueStatus;
  const now = Date.now();

  let remainingSeconds = 0;
  let queuePosition = 0;
  let estimatedWaitSeconds = 0;
  let suggestCod = false;

  if (status === "active" && order.queue_expires_at) {
    const expTime = new Date(order.queue_expires_at).getTime();
    remainingSeconds = Math.max(0, Math.ceil((expTime - now) / 1000));

    // Lazy cleanup: if active slot expired, trigger background expiration
    if (remainingSeconds === 0) {
      expireStaleQueueSlots().catch(() => {});
    }
  } else if (status === "queued" && order.queued_at) {
    const posRes = await sql.query(
      `SELECT COUNT(*)::int AS pos
       FROM orders
       WHERE queue_status = 'queued'
         AND queued_at <= $1;`,
      [order.queued_at]
    );
    queuePosition = Math.max(1, Number(posRes?.[0]?.pos || 1));
    estimatedWaitSeconds = queuePosition * 600;

    const queuedTime = new Date(order.queued_at).getTime();
    const waitedMinutes = (now - queuedTime) / (60 * 1000);
    if (waitedMinutes > 25) {
      suggestCod = true;
    }
  }

  return {
    queueStatus: status,
    queuePosition,
    estimatedWaitSeconds,
    expiresAt: order.queue_expires_at ? new Date(order.queue_expires_at).toISOString() : null,
    remainingSeconds,
    suggestCod,
    orderRef: order.order_ref,
    amount: Number(order.total_amount) || 0,
    customerPhone: order.customer_phone || "",
    customerName: order.customer_name || "",
    paymentStatus: order.payment_status || "unpaid",
  };
}

/**
 * Pings heartbeat from the payment page every ~15 seconds.
 * Extends last seen time so the active slot is not released due to inactivity.
 */
export async function heartbeatQueueSlot(orderId: string): Promise<boolean> {
  if (!sql) return false;
  try {
    const res = await sql.query(
      `UPDATE orders
       SET queue_last_heartbeat_at = NOW()
       WHERE (id = $1 OR order_number = $1 OR order_ref = $1)
         AND queue_status = 'active';`,
      [orderId]
    );
    return (res as unknown as { rowCount?: number })?.rowCount ? true : false;
  } catch (err) {
    console.warn("[Queue Heartbeat] Heartbeat warning:", err);
    return false;
  }
}

/**
 * Cancels user's queue position or active turn, releasing slot immediately for the next customer
 */
export async function cancelQueueSlot(orderId: string, reason = "User cancelled payment"): Promise<boolean> {
  if (!sql) return false;

  let wasActive = false;

  await withTransaction(async (client) => {
    const res = await client.query(
      `UPDATE orders
       SET queue_status = 'cancelled',
           order_status = CASE WHEN order_status = 'pending_confirmation' THEN 'cancelled' ELSE order_status END,
           cancellation_reason = $2,
           updated_at = NOW()
       WHERE (id = $1 OR order_number = $1 OR order_ref = $1)
         AND queue_status IN ('queued', 'active')
       RETURNING id, queue_status;`,
      [orderId, reason]
    );

    if (res.rows.length > 0 && res.rows[0].queue_status === "cancelled") {
      wasActive = true;
    }
  });

  if (wasActive) {
    // Promote next in line
    promoteNextQueuedOrder().catch(() => {});
  }

  return true;
}

/**
 * Atomically promotes the earliest queued customer to the single active slot
 */
export async function promoteNextQueuedOrder(): Promise<{
  promoted: boolean;
  orderId?: string;
  orderRef?: string;
  phone?: string;
}> {
  if (!sql) return { promoted: false };

  return await withTransaction(async (client) => {
    const now = new Date();

    // Check if an active slot is currently occupied and valid
    const currentActiveRes = await client.query(
      `SELECT id, queue_expires_at, queue_last_heartbeat_at
       FROM orders
       WHERE queue_status = 'active'
       LIMIT 1
       FOR UPDATE;`
    );

    if (currentActiveRes.rows.length > 0) {
      const active = currentActiveRes.rows[0];
      const isExpired = active.queue_expires_at && new Date(active.queue_expires_at) <= now;
      const isDead =
        active.queue_last_heartbeat_at &&
        new Date(active.queue_last_heartbeat_at).getTime() < now.getTime() - 2 * 60 * 1000;

      if (!isExpired && !isDead) {
        // Slot is still active and valid; cannot promote next
        return { promoted: false };
      }

      // Expire stale slot
      await client.query(
        `UPDATE orders SET queue_status = 'expired', updated_at = NOW() WHERE id = $1;`,
        [active.id]
      );
    }

    // Find the next queued order
    const nextQueuedRes = await client.query(
      `SELECT id, order_ref, customer_phone, customer_name, total_amount
       FROM orders
       WHERE queue_status = 'queued'
       ORDER BY queued_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED;`
    );

    if (nextQueuedRes.rows.length === 0) {
      return { promoted: false };
    }

    const nextOrder = nextQueuedRes.rows[0];

    // Promote to active with 10 min 30 sec window
    await client.query(
      `UPDATE orders
       SET queue_status = 'active',
           activated_at = NOW(),
           queue_expires_at = NOW() + INTERVAL '10 minutes 30 seconds',
           queue_last_heartbeat_at = NOW(),
           updated_at = NOW()
       WHERE id = $1;`,
      [nextOrder.id]
    );

    // Notify customer on WhatsApp that their turn has started
    if (nextOrder.customer_phone && nextOrder.order_ref) {
      notifyTurnStarted({
        phone: nextOrder.customer_phone,
        orderRef: nextOrder.order_ref,
        customerName: nextOrder.customer_name,
      }).catch((err) => console.warn("[Queue Promotion] WhatsApp notify failed:", err));
    }

    return {
      promoted: true,
      orderId: nextOrder.id,
      orderRef: nextOrder.order_ref,
      phone: nextOrder.customer_phone,
    };
  });
}

/**
 * Expires stale active orders (>10m30s or >2m dead heartbeat) and promotes the next queued order.
 */
export async function expireStaleQueueSlots(): Promise<{ expiredCount: number; promotedCount: number }> {
  if (!sql) return { expiredCount: 0, promotedCount: 0 };

  const now = new Date();
  let expiredCount = 0;

  const expiredRes = await sql.query(
    `UPDATE orders
     SET queue_status = 'expired',
         updated_at = NOW()
     WHERE queue_status = 'active'
       AND (
         queue_expires_at <= NOW()
         OR (queue_last_heartbeat_at IS NOT NULL AND queue_last_heartbeat_at < NOW() - INTERVAL '2 minutes')
       )
     RETURNING id, order_ref;`
  );

  expiredCount = expiredRes?.length || 0;

  let promotedCount = 0;
  if (expiredCount > 0) {
    const promo = await promoteNextQueuedOrder().catch(() => ({ promoted: false }));
    if (promo.promoted) promotedCount = 1;
  }

  return { expiredCount, promotedCount };
}
