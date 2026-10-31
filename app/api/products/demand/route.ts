import { NextResponse } from "next/server";
import { recordProductDemand, getProductDemandByProduct } from "@/lib/data/store";
import { normalisePhone } from "@/lib/utils/phone";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    const data = await getProductDemandByProduct(productId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] GET /api/products/demand error:", error);
    return NextResponse.json({ error: "Failed to fetch demand data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      productId,
      productName,
      variantName,
      customerName,
      customerPhone,
      customerEmail,
      quantityKg,
      notes,
    } = body;

    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    if (!customerName || !customerName.trim()) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    const cleanPhone = (customerPhone || "").replace(/[^0-9]/g, "").slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return NextResponse.json(
        { error: "Please provide a valid 10-digit mobile number for WhatsApp notification." },
        { status: 400 }
      );
    }

    const qty = Math.max(0.25, Number(quantityKg) || 1.0);

    const result = await recordProductDemand({
      productId,
      productName,
      variantName,
      customerName: customerName.trim(),
      customerPhone: cleanPhone,
      customerEmail: customerEmail?.trim(),
      quantityKg: qty,
      notes: notes?.trim(),
    });

    return NextResponse.json({
      ...result,
      message: "Demand registered successfully! You will receive a WhatsApp message when the fresh batch is ready.",
    });
  } catch (error) {
    console.error("[API] POST /api/products/demand error:", error);
    return NextResponse.json({ error: "Failed to record customer demand" }, { status: 500 });
  }
}
