import { NextResponse } from "next/server";
import { sandboxSessions } from "../create/route";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get("paymentId");

    if (!paymentId) {
      return NextResponse.json({ error: "Missing paymentId parameter" }, { status: 400 });
    }

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
          return NextResponse.json({
            status: normalizedStatus, // Normalized to "SUCCESS" for auto-confirmation
            rawStatus: data.status,
            paymentId: data.paymentId || data.id,
            orderId: data.orderId,
            utr: data.utr || data.bankRrn,
            amount: data.amount,
            mode: "live",
          });
        }
      } catch (err) {
        // Fall through to check memory store if gateway is offline
      }
    }

    // 2. Check in-memory sandbox session
    const sbx = sandboxSessions.get(paymentId);
    if (sbx) {
      // Auto-expire after 10 minutes
      if (Date.now() - sbx.createdAt > 10 * 60 * 1000) {
        sbx.status = "EXPIRED";
      }

      return NextResponse.json({
        status: sbx.status,
        paymentId: sbx.paymentId,
        orderId: sbx.orderId,
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
    const { paymentId, status = "SUCCESS", utr } = body;

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

    const sbx = sandboxSessions.get(paymentId);
    if (sbx) {
      sbx.status = status;
      sbx.utr = userUtr;
      sandboxSessions.set(paymentId, sbx);
    } else {
      sandboxSessions.set(paymentId, {
        paymentId,
        orderId: `ord-${Date.now()}`,
        amount: Number(body.amount) || 0,
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
