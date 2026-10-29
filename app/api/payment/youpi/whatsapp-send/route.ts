import { NextResponse } from "next/server";
import { notifyPaymentInstructions, getAppBaseUrl } from "@/lib/whatsapp/payment-notifications";
import { normalizeAndValidateWhatsAppPhone } from "@/lib/utils/phone";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, orderRef, amount, upiId, customerName, origin } = body;

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

    const sent = await notifyPaymentInstructions({
      phone: cleanPhone,
      orderRef: finalOrderRef,
      amount: finalAmount,
      upiId: finalUpiId,
      customerName: customerName || "Customer",
      baseUrl: appBaseUrl,
    });

    const prefilledText =
      `🍬 *Mithaasé — UPI Payment QR & Details*\n\n` +
      `Hello *${customerName || "Customer"}*! Here are your payment details:\n\n` +
      `📦 *Order Ref:* ${finalOrderRef}\n` +
      `💰 *Exact Amount:* ₹${formattedAmount}\n` +
      `💳 *UPI ID:* ${finalUpiId}\n` +
      `⏳ *Time Limit:* Pay within 10 minutes\n\n` +
      `🖼️ *Direct QR Code Image:* \n👉 ${qrImageUrl}\n\n` +
      `⚡ *1-Tap Pay via UPI App:* \n👉 ${upiIntentUri}\n\n` +
      `— *Shree Shyam Sweets (Mithaasé)*`;

    const waLink = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(prefilledText)}`;

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

