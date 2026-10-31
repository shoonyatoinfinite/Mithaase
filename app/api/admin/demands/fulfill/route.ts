import { NextResponse } from "next/server";
import { fulfillProductDemands } from "@/lib/data/store";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    const result = await fulfillProductDemands(productId);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to notify customers" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully notified ${result.count} customer(s) via WhatsApp that the fresh batch is ready!`,
      count: result.count,
    });
  } catch (error) {
    console.error("[API] POST /api/admin/demands/fulfill error:", error);
    return NextResponse.json({ error: "Failed to fulfill demands" }, { status: 500 });
  }
}

