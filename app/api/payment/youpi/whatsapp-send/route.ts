import { NextResponse } from "next/server";
import { notifyPaymentInstructions } from "@/lib/whatsapp/payment-notifications";
import { normalizeAndValidateWhatsAppPhone } from "@/lib/utils/phone";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, orderRef, amount, upiId, customerName } = body;

    if (!phone) {
      return NextResponse.json({ error: "Customer phone number is required" }, { status: 400 });
    }

    const phoneVal = normalizeAndValidateWhatsAppPhone(phone);
    if (!phoneVal.isValid) {
      return NextResponse.json({ error: "Invalid WhatsApp phone number" }, { status: 400 });
    }

    const cleanPhone = phoneVal.dbFormat;
    const finalOrderRef = orderRef || `MTH-${Date.now().toString().slice(-6)}`;
    const finalAmount = Math.max(1, Math.round(Number(amount) || 0));
    const finalUpiId = (upiId || process.env.NEXT_PUBLIC_STORE_UPI_ID || "shreeshyam@upi").trim();

    const sent = await notifyPaymentInstructions({
      phone: cleanPhone,
      orderRef: finalOrderRef,
      amount: finalAmount,
      upiId: finalUpiId,
      customerName: customerName || "Customer",
    });

    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://mithaase.com");

    const waLink = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(
      `🍬 Mithaasé Payment Details\nOrder Ref: ${finalOrderRef}\nAmount: ₹${finalAmount.toFixed(2)}\nUPI ID: ${finalUpiId}\nPay here: ${appBaseUrl}/pay/${encodeURIComponent(finalOrderRef)}`
    )}`;

    return NextResponse.json({
      success: true,
      delivered: sent,
      phone: cleanPhone,
      orderRef: finalOrderRef,
      waLink,
      message: sent
        ? `Payment instructions sent to your WhatsApp (+91 ${cleanPhone})`
        : `Payment link prepared for WhatsApp (+91 ${cleanPhone})`,
    });
  } catch (error: any) {
    console.error("[WhatsApp Send Route Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to send WhatsApp message" },
      { status: 500 }
    );
  }
}
