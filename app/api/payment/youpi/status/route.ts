import { NextResponse } from "next/server";
import { sandboxSessions } from "../create/route";
import { expireStaleAttempts, markVerified } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get("paymentId");

    if (!paymentId) {
      return NextResponse.json({ error: "Missing paymentId parameter" }, { status: 400 });
    }

    // Lazily expire stale attempts older than expires_at
    expireStaleAttempts().catch(() => {});

    const rawBaseUrl = process.env.YOUPI_API_URL || process.env.YOUPI_BASE_URL || "http://localhost:6100";
    const youpiBaseUrl = rawBaseUrl.replace(/\/+$/, "");

    // 1. Check if it's a live YouPI session
    if (!paymentId.startsWith("yp_sbx_")) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(`${youpiBaseUrl}/api/v1/payments/${paymentId}`, {
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          let normalizedStatus = data.status || "PENDING";
          if (normalizedStatus === "COMPLETED" || normalizedStatus === "PAID") {
            normalizedStatus = "SUCCESS";
          }

          if (normalizedStatus === "SUCCESS") {
            const utr = data.utr || data.bankRrn || `YOUPI-${paymentId}`;
            const amountReceived = Number(data.amount || 0);

            // Server-side authoritative verification & exact amount check
            const vRes = await markVerified({
              youpiPaymentId: data.paymentId || data.id || paymentId,
              attemptRef: data.orderId,
              amountReceived,
              upiTxnRef: utr,
              payerVpaRaw: data.payerVpa || data.customerVpa || null,
              source: "youpi_poll",
              raw: data,
            });

            if (vRes?.status === "mismatch") {
              return NextResponse.json({
                status: "FAILED",
                error: "Amount mismatch: Payment received does not match expected amount.",
                mismatch: true,
                paymentId,
                mode: "live",
              });
            }

            // In-flight safety fallback: if no payments row matches (started before deploy), run legacy update
            if (!vRes && (data.orderId || paymentId)) {
              const targetRef = data.orderId || paymentId;
              try {
                const { sql: dbSql } = await import("@/lib/neon/db");
                if (dbSql) {
                  await dbSql.query(
                    `UPDATE orders SET
                       payment_status = 'paid',
                       gateway_transaction_id = COALESCE($1, gateway_transaction_id),
                       upi_reference = COALESCE($2, upi_reference),
                       order_status = CASE WHEN order_status = 'pending_confirmation' THEN 'confirmed' ELSE order_status END,
                       updated_at = NOW()
                     WHERE (id = $3 OR order_number = $3) AND payment_status <> 'paid';`,
                    [paymentId || null, utr, targetRef]
                  );
                }
              } catch (legacyErr) {
                console.warn("[YouPI Status] Legacy fallback order update warning:", legacyErr);
              }
            }
          }

          return NextResponse.json({
            status: normalizedStatus,
            rawStatus: data.status,
            paymentId: data.paymentId || data.id,
            orderId: data.orderId,
            utr: data.utr || data.bankRrn,
            amount: data.amount,
            mode: "live",
          });
        }
      } catch (err) {
        // Fall through to check sandbox store if gateway is offline
      }
    }

    // 2. Check in-memory sandbox session
    const sbx = sandboxSessions.get(paymentId);
    if (sbx) {
      // Auto-expire after 10 minutes
      if (Date.now() - sbx.createdAt > 10 * 60 * 1000) {
        sbx.status = "EXPIRED";
      }

      if (sbx.status === "SUCCESS") {
        const utr = sbx.utr || `SBX-${sbx.paymentId}`;
        const vRes = await markVerified({
          youpiPaymentId: sbx.paymentId,
          attemptRef: sbx.attemptRef,
          amountReceived: sbx.amount,
          upiTxnRef: utr,
          payerVpaRaw: "sandbox@upi",
          source: "youpi_poll",
          raw: sbx,
        });

        if (vRes?.status === "mismatch") {
          return NextResponse.json({
            status: "FAILED",
            error: "Amount mismatch",
            mismatch: true,
            mode: "sandbox",
          });
        }
      }

      return NextResponse.json({
        status: sbx.status,
        paymentId: sbx.paymentId,
        orderId: sbx.orderId,
        orderRef: sbx.orderRef,
        attemptRef: sbx.attemptRef,
        utr: sbx.utr,
        amount: sbx.amount,
        mode: "sandbox",
      });
    }

    return NextResponse.json({ status: "PENDING", paymentId, mode: "unknown" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch payment status" },
      { status: 500 }
    );
  }
}

// POST endpoint to verify payment status and process instant confirmation
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { paymentId, status = "SUCCESS", utr, amount, attemptRef } = body;

    if (!paymentId) {
      return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });
    }

    const userUtr = utr && typeof utr === "string" && utr.trim().length >= 6 ? utr.trim() : null;
    if (!userUtr) {
      return NextResponse.json(
        { error: "Valid 12-digit UPI Reference / UTR Number is required to confirm payment." },
        { status: 400 }
      );
    }

    expireStaleAttempts().catch(() => {});

    if (status === "SUCCESS") {
      const vRes = await markVerified({
        youpiPaymentId: paymentId,
        attemptRef,
        amountReceived: Number(amount) || 0,
        upiTxnRef: userUtr,
        payerVpaRaw: body.payerVpa || null,
        source: "youpi_poll",
        raw: body,
      });

      if (vRes?.status === "mismatch") {
        return NextResponse.json(
          { error: "Amount mismatch detected. Payment cannot be marked as paid." },
          { status: 400 }
        );
      }
    }

    const sbx = sandboxSessions.get(paymentId);
    if (sbx) {
      sbx.status = status;
      sbx.utr = userUtr;
      sandboxSessions.set(paymentId, sbx);
    } else {
      sandboxSessions.set(paymentId, {
        paymentId,
        orderId: `ord-${Date.now()}`,
        orderRef: `MTH-SBX-${Date.now().toString().slice(-4)}`,
        attemptRef: attemptRef || `ATT-${Date.now()}`,
        amount: Number(amount) || 0,
        customerName: "Customer",
        customerPhone: "",
        status: status as any,
        utr: userUtr,
        createdAt: Date.now(),
      });
    }

    return NextResponse.json({
      success: true,
      status: "SUCCESS",
      utr: userUtr,
      paymentId,
      message: "Payment successfully verified and confirmed",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to verify status" }, { status: 500 });
  }
}
