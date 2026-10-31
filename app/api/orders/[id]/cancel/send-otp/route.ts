import { NextResponse } from "next/server";
import { getOrderById, getStoreSettings } from "@/lib/data/store";
import { sendWhatsAppMessage } from "@/lib/whatsapp/payment-notifications";
import { sql } from "@/lib/neon/db";
import crypto from "crypto";

function hashOtp(otp: string): string {
  const secret = process.env.OTP_HMAC_SECRET || "mithaase_otp_hmac_secret_key_default";
  return crypto.createHmac("sha256", secret).update(otp).digest("hex");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await getOrderById(id);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const settings = await getStoreSettings();
    const adminHelpline = (settings?.whatsapp_number || settings?.business_phone || "").trim();

    // 1. Strict Eligibility Rule: Only COD orders can be self-cancelled
    if (order.payment_method?.toLowerCase() !== "cod") {
      return NextResponse.json(
        {
          error: `Prepaid / Online UPI orders cannot be self-cancelled. Please contact store Admin or Helpline at +91 ${adminHelpline} for cancellation and refund processing.`,
          isPrepaid: true,
          adminPhone: adminHelpline,
        },
        { status: 400 }
      );
    }

    // 2. Strict Eligibility Rule: Cancellation is ONLY possible BEFORE out_for_delivery
    if (order.order_status === "out_for_delivery") {
      return NextResponse.json(
        {
          error: "This order is already out for delivery with our rider and cannot be cancelled.",
          isOutForDelivery: true,
        },
        { status: 400 }
      );
    }

    if (order.order_status === "delivered") {
      return NextResponse.json(
        { error: "This order has already been delivered." },
        { status: 400 }
      );
    }

    if (order.order_status === "cancelled") {
      return NextResponse.json(
        { error: "This order is already cancelled." },
        { status: 400 }
      );
    }

    const cleanPhone = (order.customer_phone || "").replace(/[^0-9]/g, "").slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return NextResponse.json(
        { error: "No valid mobile number linked to this order to send WhatsApp OTP." },
        { status: 400 }
      );
    }

    // 3. Invalidate previous unused OTPs for this order
    if (sql) {
      await sql.query(
        `UPDATE order_cancel_otps 
         SET used = true 
         WHERE order_id = $1 AND used = false;`,
        [order.id]
      ).catch(() => {});
    }

    // 4. Generate 6-digit OTP & HMAC Hash
    const otpInt = crypto.randomInt(100000, 1000000);
    const otpString = otpInt.toString();
    const otpHash = hashOtp(otpString);
    const otpId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    if (sql) {
      await sql.query(
        `INSERT INTO order_cancel_otps (id, order_id, phone, otp_hash, expires_at, attempts, used, created_at)
         VALUES ($1, $2, $3, $4, $5, 0, false, NOW());`,
        [otpId, order.id, cleanPhone, otpHash, expiresAt.toISOString()]
      );
    }

    // 5. Dispatch WhatsApp OTP message
    const waMessage =
      `🔐 *Mithaasé — Order Cancellation OTP*\n\n` +
      `Hello *${order.customer_name}*, your OTP to cancel Cash on Delivery order *#${order.order_number}* is:\n\n` +
      `👉 *${otpString}*\n\n` +
      `This OTP is valid for 5 minutes. Do not share this OTP with anyone.\n` +
      `If you did not request this cancellation, please contact our helpline immediately at +91 ${adminHelpline}.\n\n` +
      `— Shree Shyam Sweets (Mithaasé)`;

    const sent = await sendWhatsAppMessage(cleanPhone, waMessage);
    if (!sent) {
      console.warn(`[Cancel OTP] WhatsApp dispatch returned false for phone ${cleanPhone}`);
    }

    return NextResponse.json({
      success: true,
      message: `OTP sent via WhatsApp to +91 ${cleanPhone.slice(0, 2)}******${cleanPhone.slice(-2)}`,
      phoneHint: `+91 ${cleanPhone.slice(0, 2)}******${cleanPhone.slice(-2)}`,
    });
  } catch (error: any) {
    console.error("[API] POST /api/orders/[id]/cancel/send-otp error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to dispatch cancellation OTP" },
      { status: 500 }
    );
  }
}

