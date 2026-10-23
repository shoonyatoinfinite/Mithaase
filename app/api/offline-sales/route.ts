import { NextResponse } from "next/server";
import { getOfflineSales, createOfflineSale } from "@/lib/data/store";
import { broadcastRealtimeEvent } from "@/lib/events/broadcast";

export async function GET() {
  try {
    const sales = await getOfflineSales();
    return NextResponse.json(sales);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch offline sales" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    const result = await createOfflineSale(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to record sale" }, { status: 400 });
    }

    broadcastRealtimeEvent("offline_sale_created", result.sale);

    return NextResponse.json(result.sale, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Server error processing offline sale" }, { status: 500 });
  }
}
