import { NextResponse } from "next/server";
import crypto from "crypto";
import { sql } from "@/lib/neon/db";
import { createAttempt, attachYoupi, markAttemptFailed } from "@/lib/payments";
import { generateOrderRef } from "@/lib/utils/order-ref";
import { notifyPaymentInstructions } from "@/lib/whatsapp/payment-notifications";

export const dynamic = "force-dynamic";

// In-memory sandbox storage for local testing when YouPI PG is offline
export const sandboxSessions = new Map<
  string,
  {
    paymentId: string;
    orderId: string;
    orderRef: string;
    attemptRef: string;
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
    const { amount, customerName, customerPhone, customerEmail, orderId, method = "intent" } = body;
    const finalAmount = Math.max(1, Math.round(Number(amount) || 0));

    if (!finalAmount || finalAmount <= 0) {
      return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
    }

    const cleanPhone = (customerPhone || "").replace(/[^0-9]/g, "");
    const requestedOrderId = orderId || `ord-${Date.now()}`;
    const rawBaseUrl = process.env.YOUPI_API_URL || process.env.YOUPI_BASE_URL || "http://localhost:6100";
    const youpiBaseUrl = rawBaseUrl.replace(/\/+$/, "");
    const merchantKey = process.env.YOUPI_MERCHANT_KEY || "00000000-0000-0000-0000-000000000001";

    // 1. Ensure order exists in orders table and has an order_ref
    let targetOrderId = requestedOrderId;
    let finalOrderRef = "";

    if (sql) {
      try {
        const orderRows = await sql.query(
          `SELECT id, order_number, order_ref, total_amount FROM orders WHERE id = $1 OR order_number = $1 LIMIT 1;`,
          [requestedOrderId]
        ).catch(() => null);

        if (orderRows && orderRows.length > 0) {
          const ord = orderRows[0];
          targetOrderId = ord.id;
          if (ord.order_ref && ord.order_ref.trim()) {
            finalOrderRef = ord.order_ref.trim();
          } else {
            finalOrderRef = generateOrderRef();
            await sql.query(`UPDATE orders SET order_ref = $1 WHERE id = $2;`, [finalOrderRef, ord.id]).catch(() => {});
          }
        } else {
          // Pre-create pending order row so foreign key constraint in payments table is satisfied
          finalOrderRef = generateOrderRef();
          targetOrderId = requestedOrderId.startsWith("SSS-") ? requestedOrderId : crypto.randomUUID();
          const orderNumber = requestedOrderId.startsWith("SSS-")
            ? requestedOrderId
            : `SSS-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

          await sql.query(
            `INSERT INTO orders (
               id, order_number, order_ref, customer_name, customer_email, customer_phone,
               delivery_address, locality, subtotal, total_amount, payment_method,
               payment_status, order_status, source, created_at, updated_at
             ) VALUES (
               $1, $2, $3, $4, $5, $6, 'Pending checkout address', 'Pending Locality',
               $7, $7, 'upi', 'unpaid', 'pending_confirmation', 'online', NOW(), NOW()
             )
             ON CONFLICT (id) DO NOTHING;`,
            [
              targetOrderId,
              orderNumber,
              finalOrderRef,
              customerName || "Customer",
              customerEmail || null,
              cleanPhone || "0000000000",
              finalAmount,
            ]
          ).catch((e: unknown) => {
            // If order_ref column doesn't exist yet on orders table, insert without order_ref
            return sql.query(
              `INSERT INTO orders (
                 id, order_number, customer_name, customer_email, customer_phone,
                 delivery_address, locality, subtotal, total_amount, payment_method,
                 payment_status, order_status, source, created_at, updated_at
               ) VALUES (
                 $1, $2, $3, $4, $5, 'Pending checkout address', 'Pending Locality',
                 $6, $6, 'upi', 'unpaid', 'pending_confirmation', 'online', NOW(), NOW()
               )
               ON CONFLICT (id) DO NOTHING;`,
              [
                targetOrderId,
                orderNumber,
                customerName || "Customer",
                customerEmail || null,
                cleanPhone || "0000000000",
                finalAmount,
              ]
            ).catch(() => {});
          });
        }
      } catch (dbErr) {
        console.warn("[YouPI Create] Order lookup/init warning:", dbErr);
      }
    }
    if (!finalOrderRef) {
      finalOrderRef = generateOrderRef();
    }

    // 2. Create or reuse payment attempt row in Neon DB
    let attempt: {
      id: string;
      attempt_ref: string;
      attempt_no: number;
      payee_vpa?: string | null;
      youpi_payment_id?: string | null;
      youpi_order_ref?: string | null;
      reused?: boolean;
    };

    const attemptMethod: "qr" | "intent" | "manual" = method === "qr" ? "qr" : "intent";

    try {
      attempt = await createAttempt({
        orderId: targetOrderId,
        orderRef: finalOrderRef,
        amount: finalAmount,
        method: attemptMethod,
      });
    } catch (attemptErr: any) {
      console.warn("[YouPI Create] createAttempt warning (payments table may be pending migration):", attemptErr?.message);
      // Graceful in-memory fallback so user is NEVER blocked from paying
      attempt = {
        id: crypto.randomUUID(),
        attempt_ref: `${finalOrderRef}-A1`,
        attempt_no: 1,
        payee_vpa: null,
        youpi_payment_id: null,
        youpi_order_ref: null,
        reused: false,
      };
    }

    // 3. If attempt is reused and has already-attached YouPI data, return immediately (zero row spam)
    if (attempt.reused && attempt.youpi_payment_id && attempt.payee_vpa) {
      if (cleanPhone && attempt.payee_vpa) {
        notifyPaymentInstructions({
          phone: cleanPhone,
          orderRef: finalOrderRef,
          amount: finalAmount,
          upiId: attempt.payee_vpa,
          customerName: customerName || "Customer",
        }).catch(() => {});
      }
      return NextResponse.json({
        success: true,
        mode: "live",
        paymentId: attempt.youpi_payment_id,
        orderId: targetOrderId,
        orderRef: finalOrderRef,
        attemptRef: attempt.attempt_ref,
        checkoutUrl: `${youpiBaseUrl}/checkout/${attempt.youpi_payment_id}`,
        amount: finalAmount,
        gatewayUrl: youpiBaseUrl,
        payeeVpa: attempt.payee_vpa,
        payeeName: process.env.NEXT_PUBLIC_STORE_UPI_NAME || "Shree Shyam Sweets",
        reused: true,
      });
    }

    // 4. Call live YouPI-PG Gateway passing attempt_ref in orderId and metadata
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const appBaseUrl = host
      ? `${proto}://${host}`
      : process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://mithaase.vercel.app");

    try {
      const controller = new AbortController();
      // Fast 3500ms timeout prevents freezing when Render/gateway is sleeping
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const gatewayRes = await fetch(`${youpiBaseUrl}/api/v1/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Merchant-Id": merchantKey,
          "Idempotency-Key": `idem_${attempt.attempt_ref}`,
        },
        body: JSON.stringify({
          orderId: attempt.attempt_ref, // Links YouPI payment directly to our attempt_ref
          amount: finalAmount,
          currency: "INR",
          customer: {
            name: customerName || "Guest Customer",
            phoneNumber: cleanPhone,
            email: customerEmail || "",
          },
          description: `Mithaase - Order ${finalOrderRef} (${attempt.attempt_ref})`,
          returnUrl: `${appBaseUrl}/order-confirmation/${finalOrderRef}`,
          metadata: {
            orderId: targetOrderId,
            orderRef: finalOrderRef,
            attemptRef: attempt.attempt_ref,
          },
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

        if (!payeeVpa) {
          payeeVpa = process.env.NEXT_PUBLIC_STORE_UPI_ID || "";
        }
        if (!payeeName) {
          payeeName = process.env.NEXT_PUBLIC_STORE_UPI_NAME || "Shree Shyam Sweets";
        }

        // 6. Attach YouPI gateway identifiers to payments row
        try {
          await attachYoupi(attempt.id, targetOrderId, {
            youpiPaymentId: pId,
            youpiOrderRef: data.orderId || attempt.attempt_ref,
            payeeVpa,
          });
        } catch (attachErr) {
          console.error("[YouPI Create] attachYoupi failed:", attachErr);
        }

        // Dispatch WhatsApp Payment Instructions
        if (cleanPhone && payeeVpa) {
          notifyPaymentInstructions({
            phone: cleanPhone,
            orderRef: finalOrderRef,
            amount: finalAmount,
            upiId: payeeVpa,
            customerName: customerName || "Customer",
            baseUrl: appBaseUrl,
          }).catch((waErr) => {
            console.warn("[YouPI Create] WhatsApp instructions dispatch warning:", waErr);
          });
        }

        return NextResponse.json({
          success: true,
          mode: "live",
          paymentId: pId,
          orderId: targetOrderId,
          orderRef: finalOrderRef,
          attemptRef: attempt.attempt_ref,
          checkoutUrl: finalCheckoutUrl,
          amount: finalAmount,
          gatewayUrl: youpiBaseUrl,
          payeeVpa,
          payeeName,
        });
      } else {
        const errorText = await gatewayRes.text().catch(() => "");
        const errorReason = `Gateway returned ${gatewayRes.status}: ${errorText.slice(0, 200)}`;
        console.warn("[YouPI] Live gateway returned non-200:", gatewayRes.status, errorText);

        await markAttemptFailed(attempt.id, targetOrderId, errorReason).catch(() => {});
      }
    } catch (netErr: any) {
      const netMsg = netErr?.message || "Gateway unreachable / timeout";
      console.warn("[YouPI] Live gateway unreachable at", youpiBaseUrl, netMsg);

      await markAttemptFailed(attempt.id, targetOrderId, netMsg).catch(() => {});
    }

    // 7. Resilient Fallback to Store VPA: ensures customer can ALWAYS pay via UPI & QR even if gateway is cold-starting
    const storeVpa = process.env.NEXT_PUBLIC_STORE_UPI_ID || "shreeshyam@upi";
    const storeName = process.env.NEXT_PUBLIC_STORE_UPI_NAME || "Shree Shyam Sweets";
    const fallbackPaymentId = `yp_fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      await attachYoupi(attempt.id, targetOrderId, {
        youpiPaymentId: fallbackPaymentId,
        youpiOrderRef: attempt.attempt_ref,
        payeeVpa: storeVpa,
      }).catch(() => {});
    } catch { }

    sandboxSessions.set(fallbackPaymentId, {
      paymentId: fallbackPaymentId,
      orderId: targetOrderId,
      orderRef: finalOrderRef,
      attemptRef: attempt.attempt_ref,
      amount: finalAmount,
      customerName: customerName || "Customer",
      customerPhone: cleanPhone,
      status: "PENDING",
      createdAt: Date.now(),
    });

    if (cleanPhone && storeVpa) {
      notifyPaymentInstructions({
        phone: cleanPhone,
        orderRef: finalOrderRef,
        amount: finalAmount,
        upiId: storeVpa,
        customerName: customerName || "Customer",
        baseUrl: appBaseUrl,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      mode: "live",
      paymentId: fallbackPaymentId,
      orderId: targetOrderId,
      orderRef: finalOrderRef,
      attemptRef: attempt.attempt_ref,
      checkoutUrl: null,
      amount: finalAmount,
      payeeVpa: storeVpa,
      payeeName: storeName,
    });
  } catch (error: any) {
    console.error("[YouPI Create] Unexpected route error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to initialize YouPI payment session" },
      { status: 500 }
    );
  }
}
