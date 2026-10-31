import { NextResponse } from "next/server";
import { getOrderById, updateOrderStatus, getStoreSettings } from "@/lib/data/store";
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
    const body = await req.json();
    const { otp, reason } = body;

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
          error: `Prepaid / Online UPI orders cannot be self-cancelled. Please contact store Admin at +91 ${adminHelpline} for cancellation and refund.`,
        },
        { status: 400 }
      );
    }

    // 2. Strict Eligibility Rule: Cancellation is ONLY possible BEFORE out_for_delivery
    if (order.order_status === "out_for_delivery") {
      return NextResponse.json(
        {
          error: "This order is already out for delivery with our rider and cannot be cancelled.",
        },
        { status: 400 }
      );
    }

    if (order.order_status === "delivered" || order.order_status === "cancelled") {
      return NextResponse.json(
        { error: `This order is already ${order.order_status}.` },
        { status: 400 }
      );
    }

    if (!otp || typeof otp !== "string" || otp.trim().length !== 6) {
      return NextResponse.json(
        { error: "Please enter a valid 6-digit OTP code." },
        { status: 400 }
      );
    }

    const cleanOtp = otp.trim();

    // 3. Verify OTP in database
    if (sql) {
      const rows = await sql.query(
        `SELECT id, otp_hash, attempts, expires_at 
         FROM order_cancel_otps 
         WHERE order_id = $1 AND used = false 
         ORDER BY created_at DESC 
         LIMIT 1;`,
        [order.id]
      );

      if (!rows || rows.length === 0) {
        return NextResponse.json(
          { error: "No active cancellation OTP found. Please request a new OTP." },
          { status: 400 }
        );
      }

      const activeOtp = rows[0];

      // Check expiry
      if (new Date(activeOtp.expires_at).getTime() < Date.now()) {
        await sql.query(`UPDATE order_cancel_otps SET used = true WHERE id = $1;`, [activeOtp.id]);
        return NextResponse.json(
          { error: "This OTP has expired. Please request a new OTP." },
          { status: 400 }
        );
      }

      // Check attempts
      if (Number(activeOtp.attempts) >= 5) {
        await sql.query(`UPDATE order_cancel_otps SET used = true WHERE id = $1;`, [activeOtp.id]);
        return NextResponse.json(
          { error: "Too many failed attempts. Please request a new OTP." },
          { status: 429 }
        );
      }

      // Timing-safe HMAC hash comparison
      const candidateHash = hashOtp(cleanOtp);
      const isMatch = crypto.timingSafeEqual(
        Buffer.from(candidateHash, "hex"),
        Buffer.from(activeOtp.otp_hash, "hex")
      );

      if (!isMatch) {
        await sql.query(
          `UPDATE order_cancel_otps 
           SET attempts = attempts + 1 
           WHERE id = $1;`,
          [activeOtp.id]
        );
        const remaining = 5 - (Number(activeOtp.attempts) + 1);
        return NextResponse.json(
          { error: `Incorrect OTP. You have ${remaining} attempt(s) remaining.` },
          { status: 400 }
        );
      }

      // Mark OTP as used
      await sql.query(
        `UPDATE order_cancel_otps 
         SET used = true 
         WHERE id = $1;`,
        [activeOtp.id]
      );
    }

    // 4. Cancel the order and restore stock
    const cancelReason = (reason || "Cancelled by customer via WhatsApp OTP verification").trim();
    const cancelResult = await updateOrderStatus(
      order.id,
      "cancelled",
      cancelReason,
      "Customer (WhatsApp OTP Verified)"
    );

    if (!cancelResult.success) {
      return NextResponse.json(
        { error: cancelResult.error || "Failed to cancel order." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Order #${order.order_number} has been successfully cancelled.`,
    });
  } catch (error: any) {
    console.error("[API] POST /api/orders/[id]/cancel/verify-otp error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify cancellation OTP" },
      { status: 500 }
    );
  }
}

