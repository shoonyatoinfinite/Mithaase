import { sql, withTransaction } from "@/lib/neon/db";

export function maskVpa(vpa?: string | null): string | null {
  if (!vpa || typeof vpa !== "string") return null;
  const trimmed = vpa.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) {
    return trimmed.length > 2 ? `***${trimmed.slice(-2)}` : "***";
  }
  const user = trimmed.slice(0, atIndex);
  const handle = trimmed.slice(atIndex);
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}***${handle}`;
}

export function sanitizeRawPayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const clone: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  const sensitiveKeys = [
    "payervpa",
    "payer_vpa",
    "customervpa",
    "customer_vpa",
    "vpa",
    "phone",
    "mobile",
    "secret",
    "token",
    "apikey",
    "key",
  ];
  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      const val = clone[key];
      clone[key] = typeof val === "string" ? maskVpa(val) : "[REDACTED]";
    }
  }
  return clone;
}

// Creates a new attempt, OR reuses a still-valid one (prevents row spam when the modal re-opens).
export async function createAttempt(args: {
  orderId: string;
  orderRef: string;
  amount: number;
  method: "qr" | "intent" | "manual";
}) {
  let lastErr: unknown;
  for (let retry = 0; retry < 3; retry++) {
    try {
      return await withTransaction(async (client) => {
        const reuseRes = await client.query(
          `SELECT id, attempt_ref, attempt_no, payee_vpa, youpi_payment_id, youpi_order_ref
           FROM payments
           WHERE order_id = $1
             AND method = $2
             AND status IN ('created','launched','pending')
             AND expires_at > now()
             AND amount_expected = $3
           ORDER BY attempt_no DESC
           LIMIT 1`,
          [args.orderId, args.method, args.amount]
        );
        const reuse = reuseRes.rows?.[0];
        if (reuse) return { ...reuse, reused: true };

        const nextRes = await client.query(
          `SELECT COALESCE(MAX(attempt_no), 0) + 1 AS next
           FROM payments WHERE order_id = $1`,
          [args.orderId]
        );
        const next = Number(nextRes.rows?.[0]?.next || 1);
        const attemptRef = `${args.orderRef}-A${next}`; // <= 35 chars, [A-Za-z0-9-]

        const insertRes = await client.query(
          `INSERT INTO payments (
             order_id, attempt_no, attempt_ref, amount_expected, method, status, expires_at
           )
           VALUES ($1, $2, $3, $4, $5, 'created', now() + interval '10 minutes 30 seconds')
           RETURNING id, attempt_ref, attempt_no`,
          [args.orderId, next, attemptRef, args.amount, args.method]
        );
        const p = insertRes.rows?.[0];

        await client.query(
          `UPDATE orders SET payment_status = 'pending'
           WHERE id = $1 AND payment_status <> 'paid'`,
          [args.orderId]
        );

        await client.query(
          `INSERT INTO payment_events (payment_id, order_id, source, event)
           VALUES ($1, $2, 'server', 'attempt_created')`,
          [p.id, args.orderId]
        );

        return {
          ...p,
          payee_vpa: null,
          youpi_payment_id: null,
          youpi_order_ref: null,
          reused: false,
        };
      });
    } catch (err: unknown) {
      lastErr = err;
      const error = err as { code?: string };
      if (error?.code === "23505" && retry < 2) continue; // concurrent attempt_no collision
      throw err;
    }
  }
  throw lastErr;
}

export async function attachYoupi(
  paymentId: string,
  orderId: string,
  data: { youpiPaymentId?: string | null; youpiOrderRef?: string | null; payeeVpa: string }
) {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE payments
       SET payee_vpa = $1,
           youpi_payment_id = $2,
           youpi_order_ref = $3
       WHERE id = $4`,
      [data.payeeVpa, data.youpiPaymentId ?? null, data.youpiOrderRef ?? null, paymentId]
    );

    await client.query(
      `INSERT INTO payment_events (payment_id, order_id, source, event, payload)
       VALUES ($1, $2, 'server', 'youpi_attached', $3::jsonb)`,
      [
        paymentId,
        orderId,
        JSON.stringify({ youpiPaymentId: data.youpiPaymentId ?? null }),
      ]
    );
  });
}

export async function markAttemptFailed(paymentId: string, orderId: string, reason: string) {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE payments SET status = 'failed' WHERE id = $1 AND status <> 'verified'`,
      [paymentId]
    );

    await client.query(
      `INSERT INTO payment_events (payment_id, order_id, source, event, payload)
       VALUES ($1, $2, 'server', 'youpi_create_failed', $3::jsonb)`,
      [
        paymentId,
        orderId,
        JSON.stringify({ reason: String(reason).slice(0, 300) }),
      ]
    );
  });
}

// Returns null when no payments row matches (legacy / in-flight payment). Caller MUST then run the old
// legacy verification path unchanged. Never throw for "not found".
export async function markVerified(args: {
  youpiPaymentId?: string;
  attemptRef?: string;
  amountReceived: number;
  upiTxnRef: string;
  payerVpaRaw?: string | null;
  source?: "youpi_webhook" | "youpi_poll";
  raw: unknown;
}) {
  const eventSource = args.source ?? "youpi_webhook";
  const safePayload = JSON.stringify(sanitizeRawPayload(args.raw));
  const maskedPayer = maskVpa(args.payerVpaRaw);

  return await withTransaction(async (client) => {
    const pRes = await client.query(
      `SELECT * FROM payments
       WHERE (youpi_payment_id IS NOT NULL AND youpi_payment_id = $1)
          OR (attempt_ref IS NOT NULL AND attempt_ref = $2)
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [args.youpiPaymentId ?? null, args.attemptRef ?? null]
    );
    const p = pRes.rows?.[0];

    if (!p) {
      console.warn("[payments] markVerified: no payments row, falling back to legacy flow");
      return null;
    }
    if (p.status === "verified") return p; // idempotent: duplicate webhook/poll

    const ok = Number(args.amountReceived).toFixed(2) === Number(p.amount_expected).toFixed(2);

    if (!ok) {
      // Overpay or underpay: never silently confirmed, routed to manual review
      await client.query(
        `UPDATE payments SET status = 'manual_review', amount_received = $1 WHERE id = $2`,
        [args.amountReceived, p.id]
      );
      await client.query(
        `UPDATE orders SET payment_status = 'failed' WHERE id = $1 AND payment_status <> 'paid'`,
        [p.order_id]
      );
      await client.query(
        `INSERT INTO payment_events (payment_id, order_id, source, event, payload)
         VALUES ($1, $2, $3, 'amount_mismatch', $4::jsonb)`,
        [p.id, p.order_id, eventSource, safePayload]
      );
      return { ...p, status: "mismatch" };
    }

    // Check if payment arrived after expiry
    const isLatePayment = p.expires_at && new Date(p.expires_at) < new Date();
    if (isLatePayment && p.status === "expired") {
      // Payment received but expired: record for manual reconciliation in admin
      await client.query(
        `UPDATE payments
         SET status = 'received_expired', amount_received = $1,
             upi_txn_ref = $2, payer_vpa_masked = $3, verified_at = now()
         WHERE id = $4`,
        [args.amountReceived, args.upiTxnRef, maskedPayer, p.id]
      );

      await client.query(
        `UPDATE orders
         SET payment_status = 'pending_verification',
             upi_reference = COALESCE(upi_reference, $1),
             cancellation_reason = 'Payment received after 10-minute expiry (held for admin reconciliation)',
             updated_at = now()
         WHERE id = $2`,
        [args.upiTxnRef, p.order_id]
      );

      await client.query(
        `INSERT INTO payment_events (payment_id, order_id, source, event, payload)
         VALUES ($1, $2, $3, 'received_after_expiry', $4::jsonb)`,
        [p.id, p.order_id, eventSource, safePayload]
      );

      return { ...p, status: "received_expired" };
    }

    // Standard in-window verified payment
    await client.query(
      `UPDATE payments
       SET status = 'verified', amount_received = $1,
           upi_txn_ref = $2, payer_vpa_masked = $3, verified_at = now()
       WHERE id = $4`,
      [args.amountReceived, args.upiTxnRef, maskedPayer, p.id]
    );

    await client.query(
      `UPDATE orders
       SET payment_status = 'paid',
           queue_status = 'paid',
           upi_reference = COALESCE(upi_reference, $1),
           order_status = CASE WHEN order_status = 'pending_confirmation' THEN 'confirmed' ELSE order_status END,
           updated_at = now()
       WHERE id = $2`,
      [args.upiTxnRef, p.order_id]
    );

    await client.query(
      `INSERT INTO payment_events (payment_id, order_id, source, event, payload)
       VALUES ($1, $2, $3, 'verified', $4::jsonb)`,
      [p.id, p.order_id, eventSource, safePayload]
    );

    // Promote next customer in line immediately
    try {
      const { promoteNextQueuedOrder } = await import("@/lib/payment-queue");
      promoteNextQueuedOrder().catch(() => {});
    } catch {}

    return { ...p, status: "verified" };
  });
}

// Lazy expiry: call from the status-check/poll path (or a cron if one exists)
export async function expireStaleAttempts() {
  if (!sql) return;
  try {
    await sql.query(
      `UPDATE payments SET status = 'expired'
       WHERE status IN ('created','launched','pending') AND expires_at < now()`
    );
  } catch (err) {
    console.warn("[payments] expireStaleAttempts error:", err);
  }
}
