import { NextResponse } from "next/server";
import { getInventoryMovements, adjustVariantStock } from "@/lib/data/store";
import { broadcastRealtimeEvent } from "@/lib/events/broadcast";

export async function GET() {
  try {
    const movements = await getInventoryMovements();
    return NextResponse.json(movements);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch inventory movements" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { variant_id, quantity_change, movement_type, reason, created_by } = body;

    if (!variant_id || quantity_change === undefined || !reason) {
      return NextResponse.json({ error: "variant_id, quantity_change, and reason are required" }, { status: 400 });
    }

    const result = await adjustVariantStock(
      variant_id,
      Number(quantity_change),
      movement_type || "correction",
      reason,
      created_by || "Admin"
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to adjust stock" }, { status: 400 });
    }

    broadcastRealtimeEvent("inventory_updated", {
      variant_id,
      quantity_change,
      new_stock: result.newStock,
      movement_type,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Failed to adjust stock" }, { status: 500 });
  }
}
