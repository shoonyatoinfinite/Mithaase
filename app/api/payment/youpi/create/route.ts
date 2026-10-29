import { NextResponse } from "next/server";
import crypto from "crypto";
import { sql } from "@/lib/neon/db";
import { createAttempt, attachYoupi, markAttemptFailed } from "@/lib/payments";
import { generateOrderRef } from "@/lib/utils/order-ref";
import { activateYoupiSession } from "@/lib/payments/youpi-session";

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
    const {
      amount,
      subtotal,
      deliveryFee,
      discountAmount,
      couponCode,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      locality,
      orderId,
      items,
      method = "intent",
      customerVerified = false,
    } = body;
    const finalAmount = Math.max(1, Math.round(Number(amount) || 0));
    const finalSubtotal = subtotal ? Math.round(Number(subtotal)) : finalAmount;
    const finalDeliveryCharge = deliveryFee != null ? Math.round(Number(deliveryFee)) : 0;
    const finalDiscount = discountAmount ? Math.round(Number(discountAmount)) : 0;
    const finalCouponCode = couponCode ? String(couponCode).trim().toUpperCase() : null;

    if (!finalAmount || finalAmount <= 0) {
      return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
    }

    const cleanPhone = (customerPhone || "").replace(/[^0-9]/g, "");
    const requestedOrderId = orderId || `ord-${Date.now()}`;

    // Resolve real delivery address and locality
    let resolvedDeliveryAddress = (deliveryAddress || "").trim();
    let resolvedLocality = (locality || "").trim();

    if ((!resolvedDeliveryAddress || !resolvedLocality) && sql && cleanPhone) {
      try {
        const custAccRows = await sql.query(
          `SELECT delivery_address, locality FROM customer_accounts WHERE phone = $1 OR phone = $2 LIMIT 1;`,
          [cleanPhone, `+91${cleanPhone}`]
        ).catch(() => []);
        if (custAccRows && custAccRows.length > 0) {
          if (!resolvedDeliveryAddress && custAccRows[0].delivery_address) {
            resolvedDeliveryAddress = custAccRows[0].delivery_address.trim();
          }
          if (!resolvedLocality && custAccRows[0].locality) {
            resolvedLocality = custAccRows[0].locality.trim();
          }
        }
      } catch {}
    }

    const finalDeliveryAddress = resolvedDeliveryAddress || "Doorstep Delivery";
    const finalLocality = resolvedLocality || "Local Area";
    const rawBaseUrl = process.env.YOUPI_API_URL || process.env.YOUPI_BASE_URL || "https://youpi-pg-yer7.onrender.com";
    const youpiBaseUrl = rawBaseUrl.replace(/\/+$/, "");
    const merchantId = process.env.YOUPI_MERCHANT_ID || "00000000-0000-0000-0000-000000000001";
    const merchantKey = process.env.YOUPI_MERCHANT_KEY || "";
    let adminToken = process.env.YOUPI_ADMIN_TOKEN || process.env.ADMIN_API_TOKEN || "";

    if (!adminToken && process.env.NODE_ENV !== "production") {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const localSecretPath = path.resolve(process.cwd(), "../YouPI-PG/data/.secrets/admin_api_token");
        if (fs.existsSync(localSecretPath)) {
          adminToken = fs.readFileSync(localSecretPath, "utf8").trim();
        }
      } catch {}
    }

    // 1. Ensure order exists in orders table and has an order_ref with correct subtotal & discount
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
          }
          await sql.query(
            `UPDATE orders SET
               order_ref = $1,
               subtotal = $2,
               discount_amount = $3,
               delivery_charge = $4,
               total_amount = $5,
               coupon_code = COALESCE($6, orders.coupon_code),
               delivery_address = CASE WHEN orders.delivery_address LIKE '%Pending%' OR orders.delivery_address IS NULL THEN $7 ELSE orders.delivery_address END,
               locality = CASE WHEN orders.locality LIKE '%Pending%' OR orders.locality IS NULL THEN $8 ELSE orders.locality END,
               updated_at = NOW()
             WHERE id = $9;`,
            [finalOrderRef, finalSubtotal, finalDiscount, finalDeliveryCharge, finalAmount, finalCouponCode, finalDeliveryAddress, finalLocality, ord.id]
          ).catch(() => {});
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
               delivery_address, locality, subtotal, discount_amount, delivery_charge,
               total_amount, coupon_code, payment_method,
               payment_status, order_status, source, created_at, updated_at
             ) VALUES (
               $1, $2, $3, $4, $5, $6, $7, $8,
               $9, $10, $11, $12, $13, 'upi', 'unpaid', 'pending_confirmation', 'online', NOW(), NOW()
             )
             ON CONFLICT (id) DO UPDATE SET
               subtotal = EXCLUDED.subtotal,
               discount_amount = EXCLUDED.discount_amount,
               delivery_charge = EXCLUDED.delivery_charge,
               total_amount = EXCLUDED.total_amount,
               coupon_code = COALESCE(EXCLUDED.coupon_code, orders.coupon_code),
               delivery_address = CASE WHEN orders.delivery_address LIKE '%Pending%' OR orders.delivery_address IS NULL THEN EXCLUDED.delivery_address ELSE orders.delivery_address END,
               locality = CASE WHEN orders.locality LIKE '%Pending%' OR orders.locality IS NULL THEN EXCLUDED.locality ELSE orders.locality END;`,
            [
              targetOrderId,
              orderNumber,
              finalOrderRef,
              customerName || "Customer",
              customerEmail || null,
              cleanPhone || "0000000000",
              finalDeliveryAddress,
              finalLocality,
              finalSubtotal,
              finalDiscount,
              finalDeliveryCharge,
              finalAmount,
              finalCouponCode,
            ]
          ).catch((e: unknown) => {
            // If order_ref column doesn't exist yet on orders table, insert without order_ref
            return sql.query(
              `INSERT INTO orders (
                 id, order_number, customer_name, customer_email, customer_phone,
                 delivery_address, locality, subtotal, total_amount, payment_method,
                 payment_status, order_status, source, created_at, updated_at
               ) VALUES (
                 $1, $2, $3, $4, $5, $6, $7,
                 $8, $8, 'upi', 'unpaid', 'pending_confirmation', 'online', NOW(), NOW()
               )
               ON CONFLICT (id) DO NOTHING;`,
              [
                targetOrderId,
                orderNumber,
                customerName || "Customer",
                customerEmail || null,
                cleanPhone || "0000000000",
                finalDeliveryAddress,
                finalLocality,
                finalAmount,
              ]
            ).catch(() => {});
          });
        }
      } catch (dbErr) {
        console.warn("[YouPI Create] Order lookup/init warning:", dbErr);
      }

      // 1b. Insert or sync order items for this pending order
      if (Array.isArray(items) && items.length > 0) {
        try {
          const isValidUUID = (s?: string | null) =>
            Boolean(s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s));

          // Clean any previous draft items for this order before re-inserting
          await sql.query(`DELETE FROM order_items WHERE order_id = $1;`, [targetOrderId]).catch(() => {});

          for (const it of items) {
            const itemId = crypto.randomUUID();
            const prodId = isValidUUID(it.productId) ? it.productId : (isValidUUID(it.product_id) ? it.product_id : null);
            const varId = isValidUUID(it.variantId) ? it.variantId : (isValidUUID(it.variant_id) ? it.variant_id : null);
            const pName = (it.productName || it.product_name_snapshot || "Sweet").toString().slice(0, 200);
            const vName = (it.variantName || it.variant_name_snapshot || "").toString().slice(0, 100);
            const qty = Math.max(1, Number(it.quantity) || 1);
            const uPrice = Math.max(0, Number(it.unitPrice ?? it.unit_price ?? it.price ?? 0));
            const lTotal = Math.max(0, Number(it.lineTotal ?? it.line_total ?? (uPrice * qty)));
            const img = it.imageUrl || it.image_url || null;

            await sql.query(
              `INSERT INTO order_items (
                 id, order_id, product_id, variant_id, product_name_snapshot,
                 variant_name_snapshot, quantity, unit_price, line_total, image_url
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (id) DO NOTHING;`,
              [itemId, targetOrderId, prodId, varId, pName, vName, qty, uPrice, lTotal, img]
            ).catch((e: unknown) => {
              console.warn("[YouPI Create] order_items insert warning:", e);
            });
          }
        } catch (itemsErr) {
          console.warn("[YouPI Create] items processing warning:", itemsErr);
        }
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

    // 3. If attempt is reused and has already-attached real YouPI data, ensure it is activated and return
    // Guard against dummy fallback IDs (yp_fb_ or yp_sbx_)
    const isRealGatewayPayment =
      attempt.youpi_payment_id &&
      !attempt.youpi_payment_id.startsWith("yp_fb_") &&
      !attempt.youpi_payment_id.startsWith("yp_sbx_");

    if (attempt.reused && isRealGatewayPayment && attempt.payee_vpa) {
      if (customerVerified && cleanPhone) {
        try {
          const actResult = await activateYoupiSession({
            youpiBaseUrl,
            paymentId: attempt.youpi_payment_id!,
            customerPhone: cleanPhone,
            customerName,
            customerEmail,
            merchantKey,
            adminToken,
          });
          if (actResult.success) {
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
              payeeVpa: actResult.payeeVpa || attempt.payee_vpa,
              payeeName: actResult.payeeName || process.env.NEXT_PUBLIC_STORE_UPI_NAME || "Shree Shyam Sweets",
              reused: true,
            });
          }
        } catch (actErr) {
          console.warn("[YouPI Create] Reused session activation notice:", actErr);
        }
      } else {
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
    }

    // 4. Call live YouPI-PG Gateway passing attempt_ref in orderId and metadata
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const appBaseUrl = host
      ? `${proto}://${host}`
      : process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://mithaase.vercel.app");

    try {
      const controller = new AbortController();
      // 12000ms timeout accommodates cloud container spin-up and network latency
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const gatewayHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Merchant-Id": merchantId,
        "Idempotency-Key": `idem_${attempt.attempt_ref}`,
      };
      if (merchantKey) {
        gatewayHeaders["X-Merchant-Key"] = merchantKey;
      }
      if (adminToken) {
        gatewayHeaders["Authorization"] = `Bearer ${adminToken}`;
      }

      const gatewayRes = await fetch(`${youpiBaseUrl}/api/v1/payments`, {
        method: "POST",
        headers: gatewayHeaders,
        body: JSON.stringify({
          orderId: attempt.attempt_ref, // Links YouPI payment directly to our attempt_ref
          amount: finalAmount,
          currency: "INR",
          customerVerified: Boolean(customerVerified),
          customer: {
            name: customerName || "Customer",
            mobileNumber: cleanPhone,
            phoneNumber: cleanPhone,
            email: cleanPhone ? `${cleanPhone}@customer.youpi.local` : (customerEmail || ""),
            realEmail: customerEmail || "",
          },
          description: `Mithaase - Order ${finalOrderRef} (${attempt.attempt_ref})`,
          returnUrl: `${appBaseUrl}/track/${finalOrderRef}`,
          metadata: {
            orderId: targetOrderId,
            orderRef: finalOrderRef,
            attemptRef: attempt.attempt_ref,
            subtotal: finalSubtotal,
            discountAmount: finalDiscount,
            couponCode: finalCouponCode,
            deliveryFee: finalDeliveryCharge,
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

        // Authoritatively activate payment session on YouPI PG so admin counter & auto-verification detect it immediately
        let payeeVpa = "";
        let payeeName = "";
        let upiUri = "";

        if (customerVerified || cleanPhone) {
          try {
            const actResult = await activateYoupiSession({
              youpiBaseUrl,
              paymentId: pId,
              customerPhone: cleanPhone,
              customerName,
              customerEmail,
              merchantKey,
              adminToken,
            });
            if (actResult.success) {
              if (actResult.payeeVpa) payeeVpa = actResult.payeeVpa;
              if (actResult.payeeName) payeeName = actResult.payeeName;
              if (actResult.upiUri) upiUri = actResult.upiUri;
            }
          } catch (actErr) {
            console.warn("[YouPI Create] Session activation notice:", actErr);
          }
        }

        // Fetch live state from YouPI-PG if payeeVpa not yet resolved
        if (!payeeVpa) {
          try {
            const stateRes = await fetch(`${youpiBaseUrl}/api/v1/checkout/${pId}/state`, {
              signal: AbortSignal.timeout(5000),
            });
            if (stateRes.ok) {
              const stateData = await stateRes.json();
              payeeVpa = stateData.payeeVpa || stateData.vpa || "";
              payeeName = stateData.payeeName || stateData.merchantName || "";
              if (!upiUri && stateData.upiUri) upiUri = stateData.upiUri;
            }
          } catch (stateErr) {
            console.warn("[YouPI] State fetch warning:", stateErr);
          }
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
