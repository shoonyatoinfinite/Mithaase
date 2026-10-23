import { NextResponse } from "next/server";
import { getCoupons, createCoupon } from "@/lib/data/store";

export async function GET() {
  try {
    const coupons = await getCoupons(false);
    return NextResponse.json(coupons);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch coupons" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.code || !body.discount_type || body.discount_value === undefined) {
      return NextResponse.json(
        { error: "Code, discount type, and discount value are required" },
        { status: 400 }
      );
    }

    const res = await createCoupon({
      code: body.code,
      description: body.description || "",
      discount_type: body.discount_type,
      discount_value: Number(body.discount_value),
      min_order_amount: Number(body.min_order_amount) || 0,
      max_discount_amount: body.max_discount_amount ? Number(body.max_discount_amount) : undefined,
      is_active: body.is_active ?? true,
    });

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json(res.coupon, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create coupon" }, { status: 500 });
  }
}
