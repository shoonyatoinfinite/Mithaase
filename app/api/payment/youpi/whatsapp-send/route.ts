import { NextResponse } from "next/server";
import { notifyPaymentInstructions, getAppBaseUrl } from "@/lib/whatsapp/payment-notifications";
import { normalizeAndValidateWhatsAppPhone } from "@/lib/utils/phone";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      phone,
      orderRef,
      amount,
      subtotal,
      deliveryFee,
      discountAmount,
      couponCode,
      upiId,
      customerName,
      deliveryAddress,
      locality,
      origin,
    } = body;

    if (!phone) {
      return NextResponse.json({ error: "Customer phone number is required" }, { status: 400 });
    }

    const phoneVal = normalizeAndValidateWhatsAppPhone(phone);
    if (!phoneVal.isValid) {
      return NextResponse.json({ error: "Invalid WhatsApp phone number" }, { status: 400 });
    }

    const cleanPhone = phoneVal.dbFormat;
    const finalOrderRef = (orderRef || `MTH-${Date.now().toString().slice(-6)}`).trim();
    const finalAmount = Math.max(1, Math.round(Number(amount) || 0));
    const finalSubtotal = subtotal ? Math.round(Number(subtotal)) : finalAmount;
    const finalDeliveryCharge = deliveryFee != null ? Math.round(Number(deliveryFee)) : 0;
    const finalDiscount = discountAmount ? Math.round(Number(discountAmount)) : 0;
    const finalCouponCode = couponCode ? String(couponCode).trim().toUpperCase() : "";
    const finalUpiId = (upiId || process.env.NEXT_PUBLIC_STORE_UPI_ID || "shreeshyam@upi").trim();

    // Dynamically resolve real domain from headers, client origin, or Vercel URL (never hardcoded)
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const appBaseUrl = origin || (host ? `${proto}://${host}` : getAppBaseUrl());

    const formattedAmount = finalAmount.toFixed(2);
    const qrImageUrl = `${appBaseUrl}/api/payment/youpi/qr-image?orderRef=${encodeURIComponent(
      finalOrderRef
    )}&amount=${formattedAmount}&upiId=${encodeURIComponent(finalUpiId)}`;
    const upiIntentUri = `upi://pay?pa=${finalUpiId}&pn=${encodeURIComponent(
      "Mithaase"
    )}&cu=INR&am=${formattedAmount}&tr=${encodeURIComponent(
      finalOrderRef
    )}&tn=${encodeURIComponent(`Order ${finalOrderRef}`)}`;

    const orderBreakdownText =
      (finalDiscount > 0
        ? `🛒 *Subtotal:* ₹${finalSubtotal}\n🏷️ *Coupon (${finalCouponCode}):* -₹${finalDiscount}\n🚚 *Delivery:* ${finalDeliveryCharge === 0 ? "FREE" : `₹${finalDeliveryCharge}`}\n`
        : finalDeliveryCharge > 0
        ? `🛒 *Subtotal:* ₹${finalSubtotal}\n🚚 *Delivery:* ₹${finalDeliveryCharge}\n`
        : "");

    const sent = await notifyPaymentInstructions({
      phone: cleanPhone,
      orderRef: finalOrderRef,
      amount: finalAmount,
      subtotal: finalSubtotal,
      deliveryFee: finalDeliveryCharge,
      discountAmount: finalDiscount,
      couponCode: finalCouponCode,
      upiId: finalUpiId,
      customerName: customerName || "Customer",
      baseUrl: appBaseUrl,
    });

    const prefilledText =
      `🍬 *Mithaasé — UPI Payment QR & Details*\n\n` +
      `Hello *${customerName || "Customer"}*! Here are your payment details:\n\n` +
      `📦 *Order Ref:* ${finalOrderRef}\n` +
      orderBreakdownText +
      `💰 *Net Amount to Pay:* ₹${formattedAmount}\n` +
      `💳 *UPI ID:* ${finalUpiId}\n` +
      `⏳ *Time Limit:* Pay within 10 minutes\n\n` +
      `🖼️ *Direct QR Code Image:* \n👉 ${qrImageUrl}\n\n` +
      `⚡ *1-Tap Pay via UPI App (GPay, PhonePe, Paytm, CRED):* \n👉 ${upiIntentUri}\n\n` +
      `— *Shree Shyam Sweets (Mithaasé)*`;

    const waLink = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(prefilledText)}`;

    // Ensure active payment session is bound & activated on YouPI PG and delivery address is saved
    try {
      const { sql: dbSql } = await import("@/lib/neon/db");
      if (dbSql) {
        if (deliveryAddress && locality) {
          await dbSql.query(
            `UPDATE orders SET
               delivery_address = $1,
               locality = $2,
               updated_at = NOW()
             WHERE (order_ref = $3 OR order_number = $3)
               AND (delivery_address LIKE '%Pending%' OR delivery_address IS NULL);`,
            [deliveryAddress.trim(), locality.trim(), finalOrderRef]
          ).catch(() => {});
        }
        const pRows = await dbSql.query(
          `SELECT id, youpi_payment_id FROM payments 
           WHERE youpi_order_ref = $1 OR attempt_ref LIKE $2
           ORDER BY attempt_no DESC LIMIT 1;`,
          [finalOrderRef, `${finalOrderRef}%`]
        ).catch(() => []);
        if (pRows && pRows[0]?.youpi_payment_id) {
          const { activateYoupiSession } = await import("@/lib/payments/youpi-session");
          await activateYoupiSession({
            paymentId: pRows[0].youpi_payment_id,
            customerPhone: cleanPhone,
            customerName: customerName || "Customer",
          }).catch((actErr) => {
            console.warn("[WhatsApp Send] Session activation notice:", actErr);
          });
        }
      }
    } catch {}

    // Dispatch active payment session details to YouPI / Store Admin WhatsApp
    try {
      const { sql } = await import("@/lib/neon/db");
      let adminPhone = "8290683668";
      if (sql) {
        const sRows = await sql.query(`SELECT business_phone, whatsapp_number FROM store_settings WHERE id = 1 LIMIT 1;`).catch(() => []);
        if (sRows && sRows.length > 0) {
          const raw = (sRows[0].whatsapp_number || sRows[0].business_phone || "").replace(/[^0-9]/g, "");
          if (raw.length >= 10) adminPhone = raw.slice(-10);
        }
      }
      if (adminPhone) {
        const { sendWhatsAppMessage } = await import("@/lib/whatsapp/payment-notifications");
        const adminAlert =
          `🚨 *YouPI Active Payment Session Started*\n\n` +
          `A customer has verified WhatsApp OTP and initiated payment:\n\n` +
          `📦 *Order Ref:* ${finalOrderRef}\n` +
          `👤 *Customer:* ${customerName || "Customer"} (+91 ${cleanPhone})\n` +
          orderBreakdownText +
          `💰 *Payable Amount:* *₹${formattedAmount}*\n` +
          `💳 *UPI ID:* ${finalUpiId}\n` +
          `⏳ *Window:* 10 Minutes (Live on YouPI for Auto-Verification)\n\n` +
          `🖼️ *Direct QR:* ${qrImageUrl}\n` +
          `⚡ *UPI URI:* ${upiIntentUri}\n\n` +
          `— *Mithaasé Auto-Verification Engine*`;

        sendWhatsAppMessage(adminPhone, adminAlert).catch((waErr) => {
          console.warn("[Admin WA Session Alert Warning]:", waErr);
        });
      }
    } catch (adminErr) {
      console.warn("[Admin Notification Error]:", adminErr);
    }

    return NextResponse.json({
      success: true,
      delivered: sent,
      phone: cleanPhone,
      orderRef: finalOrderRef,
      qrImageUrl,
      upiIntentUri,
      waLink,
      message: sent
        ? `Payment QR & details dispatched to your WhatsApp (+91 ${cleanPhone}) ✓`
        : `Payment details & QR prepared. Tap "Open Chat" below to send to your WhatsApp.`,
    });
  } catch (error: any) {
    console.error("[WhatsApp Send Route Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to send WhatsApp message" },
      { status: 500 }
    );
  }
}

