import { NextResponse } from "next/server";
import { getDashboardMetrics, getOrders } from "@/lib/data/store";

export async function GET() {
  try {
    const metrics = await getDashboardMetrics();
    const orders = await getOrders();
    const recentOrders = orders.slice(0, 5);

    return NextResponse.json({
      metrics,
      recentOrders,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
