import { NextResponse } from "next/server";
import { updateCoupon, deleteCoupon } from "@/lib/data/store";
import { isAdminAuthenticated } from "@/lib/auth/session";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAdminAuthenticated(req)) {
      return NextResponse.json({ error: "Unauthorized: Admin login required" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const res = await updateCoupon(id, body);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json(res.coupon);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update coupon" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAdminAuthenticated(req)) {
      return NextResponse.json({ error: "Unauthorized: Admin login required" }, { status: 401 });
    }

    const { id } = await params;
    const ok = await deleteCoupon(id);
    if (!ok) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete coupon" }, { status: 500 });
  }
}
