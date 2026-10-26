import { NextResponse } from "next/server";
import { getCoupons, createCoupon } from "@/lib/data/store";
import { isAdminAuthenticated } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    if (!isAdminAuthenticated(req)) {
      return NextResponse.json({ error: "Unauthorized: Admin login required" }, { status: 401 });
    }
    const coupons = await getCoupons(false);
    return NextResponse.json(coupons);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch coupons" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!isAdminAuthenticated(req)) {
      return NextResponse.json({ error: "Unauthorized: Admin login required" }, { status: 401 });
    }

    const body = await req.json();

    const isFreeDel = Boolean(body.free_delivery || body.discount_type === "free_delivery");
    const discountType = body.discount_type || (isFreeDel ? "free_delivery" : "flat_amount");
    const discountValue = Number(body.discount_value) || 0;

    if (!body.code) {
      return NextResponse.json(
        { error: "Coupon code is required" },
        { status: 400 }
      );
    }

    const res = await createCoupon({
      code: body.code,
      description: body.description || "",
      discount_type: discountType,
      discount_value: discountValue,
      min_order_amount: Number(body.min_order_amount) || 0,
      max_discount_amount: body.max_discount_amount ? Number(body.max_discount_amount) : undefined,
      free_delivery: isFreeDel,
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
