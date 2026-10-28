import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon/db";

export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set(["launch_clicked", "app_open_fallback"]);

// In-memory sliding-window rate limit (max 60 events per IP/attempt per minute)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { attemptRef, event, app, exp, ua } = (body ?? {}) as Record<string, unknown>;

  const isOptStr = (v: unknown, max: number) =>
    v === undefined || v === null || (typeof v === "string" && v.length <= max);

  if (
    typeof attemptRef !== "string" ||
    attemptRef.length === 0 ||
    attemptRef.length > 64 ||
    typeof event !== "string" ||
    !ALLOWED_EVENTS.has(event) ||
    !isOptStr(app, 32) ||
    !isOptStr(exp, 16) ||
    !isOptStr(ua, 160)
  ) {
    return NextResponse.json({ ok: false, error: "Validation failed" }, { status: 400 });
  }

  // Rate limit by attemptRef or client IP
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`event_${attemptRef}_${clientIp}`)) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  if (!sql) {
    return NextResponse.json({ ok: false, error: "Database unavailable" }, { status: 503 });
  }

  try {
    const paymentRows = await sql.query(
      `SELECT id, order_id, status FROM payments WHERE attempt_ref = $1 LIMIT 1;`,
      [attemptRef]
    );

    if (!paymentRows || paymentRows.length === 0) {
      return NextResponse.json({ ok: false, error: "Payment attempt not found" }, { status: 404 });
    }

    const p = paymentRows[0];

    // Informational state transition only (NEVER marks order paid)
    if (event === "launch_clicked" && p.status === "created") {
      await sql.query(
        `UPDATE payments
         SET status = 'launched',
             app_clicked = $1,
             launched_at = NOW()
         WHERE id = $2;`,
        [(app as string) ?? null, p.id]
      );
    }

    await sql.query(
      `INSERT INTO payment_events (payment_id, order_id, source, event, payload)
       VALUES ($1, $2, 'client', $3, $4::jsonb);`,
      [
        p.id,
        p.order_id,
        event,
        JSON.stringify({
          app: (app as string) ?? null,
          exp: (exp as string) ?? null,
          ua: (ua as string) ?? null,
        }),
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("[PaymentEvent] Error recording event:", error);
    return NextResponse.json({ ok: false, error: "Failed to record event" }, { status: 500 });
  }
}
