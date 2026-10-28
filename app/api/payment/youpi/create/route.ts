import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// In-memory sandbox storage for local testing when YouPI PG is not yet booted
export const sandboxSessions = new Map<
  string,
  {
    paymentId: string;
    orderId: string;
    amount: number;
    customerName: string;
    customerPhone: string;
    status: "PENDING" | "SUCCESS" | "FAILED" | "EXPIRED";
    utr?: string;
    createdAt: number;
  }
>();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, customerName, customerPhone, customerEmail, orderId } = body;
    const finalAmount = Math.max(1, Math.round(Number(amount) || 0));

    if (!finalAmount || finalAmount <= 0) {
      return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
    }

    const cleanPhone = (customerPhone || "").replace(/[^0-9]/g, "");
    const generatedOrderId = orderId || `ord-${Date.now()}`;
    const rawBaseUrl = process.env.YOUPI_API_URL || process.env.YOUPI_BASE_URL || "http://localhost:6100";
    const youpiBaseUrl = rawBaseUrl.replace(/\/+$/, "");
    const merchantKey = process.env.YOUPI_MERCHANT_KEY || "00000000-0000-0000-0000-000000000001";

    // Attempt to connect to live YouPI-PG Gateway (Render free tier may take 8-15s on cold starts)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const gatewayRes = await fetch(`${youpiBaseUrl}/api/v1/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Merchant-Id": merchantKey,
          "Idempotency-Key": `idem_${generatedOrderId}`,
        },
        body: JSON.stringify({
          orderId: generatedOrderId,
          amount: finalAmount,
          currency: "INR",
          customer: {
            name: customerName || "Guest Customer",
            phoneNumber: cleanPhone,
            email: customerEmail || "",
          },
          description: `Mithaase Sweets - Order #${generatedOrderId}`,
          returnUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/order-confirmation/${generatedOrderId}`,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (gatewayRes.ok) {
        const data = await gatewayRes.json();
        const pId = data.paymentId || data.id;
        let finalCheckoutUrl = data.checkoutUrl;
        if (
          !finalCheckoutUrl ||
          finalCheckoutUrl.includes("localhost") ||
          finalCheckoutUrl.includes("127.0.0.1")
        ) {
          finalCheckoutUrl = `${youpiBaseUrl}/checkout/${pId}`;
        }

        // Fetch live state from YouPI-PG to obtain configured payeeVpa & payeeName
        let payeeVpa = "";
        let payeeName = "";
        try {
          const stateRes = await fetch(`${youpiBaseUrl}/api/v1/checkout/${pId}/state`, {
            signal: AbortSignal.timeout(5000),
          });
          if (stateRes.ok) {
            const stateData = await stateRes.json();
            payeeVpa = stateData.payeeVpa || stateData.vpa || "";
            payeeName = stateData.payeeName || stateData.merchantName || "";
          }
        } catch (stateErr) {
          console.warn("[YouPI] State fetch warning:", stateErr);
        }

        return NextResponse.json({
          success: true,
          mode: "live",
          paymentId: pId,
          orderId: generatedOrderId,
          checkoutUrl: finalCheckoutUrl,
          amount: finalAmount,
          gatewayUrl: youpiBaseUrl,
          payeeVpa,
          payeeName,
        });
      }
    } catch (netErr) {
      // YouPI Gateway is either not running locally or unreachable; fallback seamlessly to Sandbox Mode
      console.log("[YouPI] Live gateway unreachable at", youpiBaseUrl, "- using local Sandbox session");
    }

    // Sandbox Session for zero-friction testing
    const sandboxPaymentId = `yp_sbx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    sandboxSessions.set(sandboxPaymentId, {
      paymentId: sandboxPaymentId,
      orderId: generatedOrderId,
      amount: finalAmount,
      customerName: customerName || "Customer",
      customerPhone: cleanPhone,
      status: "PENDING",
      createdAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      paymentId: sandboxPaymentId,
      orderId: generatedOrderId,
      checkoutUrl: null,
      amount: Number(amount),
      payeeVpa: process.env.NEXT_PUBLIC_STORE_UPI_ID || "",
      payeeName: process.env.NEXT_PUBLIC_STORE_UPI_NAME || "",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to initialize YouPI payment session" },
      { status: 500 }
    );
  }
}
