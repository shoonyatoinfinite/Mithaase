import { NextResponse } from "next/server";
import { getCoupons, validateAndCalculateCoupon } from "@/lib/data/store";

export async function GET() {
  try {
    const coupons = await getCoupons(true);
    return NextResponse.json(coupons);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch coupons" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const subtotal = Number(body.subtotal) || 0;
    const deliveryCharge = Number(body.deliveryCharge ?? body.deliveryFee ?? 21) || 0;

    if (!code) {
      return NextResponse.json({ valid: false, error: "Coupon code is required" }, { status: 400 });
    }

    const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail : typeof body.email === "string" ? body.email : undefined;
    const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone : typeof body.phone === "string" ? body.phone : undefined;

    const result = await validateAndCalculateCoupon(
      code,
      subtotal,
      deliveryCharge,
      customerEmail,
      customerPhone
    );

    if (!result.valid) {
      return NextResponse.json(
        {
          valid: false,
          error: result.message || "Invalid coupon code",
          message: result.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      coupon: result.coupon,
      discount_amount: result.discountAmount,
      discountAmount: result.discountAmount,
      final_delivery_charge: result.finalDeliveryCharge,
      finalDeliveryCharge: result.finalDeliveryCharge,
      message: result.message,
    });
  } catch (error) {
    console.error("Coupon validation API error:", error);
    return NextResponse.json({ valid: false, error: "Failed to validate coupon" }, { status: 500 });
  }
}
