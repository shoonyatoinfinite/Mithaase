import { NextRequest, NextResponse } from "next/server";
import { cancelQueueSlot } from "@/lib/payment-queue";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, reason } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const ok = await cancelQueueSlot(String(orderId), reason || "User cancelled payment");

    return NextResponse.json({ ok, success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Cancel error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

