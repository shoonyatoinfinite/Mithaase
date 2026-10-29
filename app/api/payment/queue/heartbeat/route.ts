import { NextRequest, NextResponse } from "next/server";
import { heartbeatQueueSlot } from "@/lib/payment-queue";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const ok = await heartbeatQueueSlot(String(orderId));

    return NextResponse.json({ ok });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Heartbeat error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

