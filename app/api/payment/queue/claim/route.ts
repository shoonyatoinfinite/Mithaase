import { NextRequest, NextResponse } from "next/server";
import { claimOrEnqueueOrder } from "@/lib/payment-queue";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, phone, amount } = body;

    if (!orderId || !phone) {
      return NextResponse.json(
        { error: "orderId and phone are required to claim payment slot." },
        { status: 400 }
      );
    }

    const result = await claimOrEnqueueOrder({
      orderId: String(orderId),
      phone: String(phone),
      amount: Number(amount) || 0,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error || "Unable to claim queue slot",
          conflict: result.conflict,
          status: result.status,
          queuePosition: result.queuePosition,
          estimatedWaitSeconds: result.estimatedWaitSeconds,
          expiresAt: result.expiresAt,
        },
        { status: result.conflict ? 409 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      queuePosition: result.queuePosition,
      estimatedWaitSeconds: result.estimatedWaitSeconds,
      expiresAt: result.expiresAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal queue error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

