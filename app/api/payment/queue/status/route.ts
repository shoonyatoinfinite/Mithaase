import { NextRequest, NextResponse } from "next/server";
import { getQueueState } from "@/lib/payment-queue";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const state = await getQueueState(orderId);

    return NextResponse.json({
      success: true,
      ...state,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal queue status error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

