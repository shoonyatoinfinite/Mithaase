import { NextResponse } from "next/server";
import { getAllProductDemandsSummary } from "@/lib/data/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summaries = await getAllProductDemandsSummary();
    return NextResponse.json({ demands: summaries });
  } catch (error) {
    console.error("[API] GET /api/admin/demands error:", error);
    return NextResponse.json({ error: "Failed to fetch demands" }, { status: 500 });
  }
}

