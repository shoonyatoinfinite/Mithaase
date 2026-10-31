import { NextResponse } from "next/server";
import { batchDispatchOrders } from "@/lib/data/store";
import { broadcastRealtimeEvent } from "@/lib/events/broadcast";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderIds = Array.isArray(body.orderIds) ? body.orderIds : [];

    if (orderIds.length === 0) {
      return NextResponse.json({ error: "No orders provided for group dispatch." }, { status: 400 });
    }

    const result = await batchDispatchOrders(orderIds, body.changed_by || "Admin");

    if (!result.success || result.orders.length === 0) {
      return NextResponse.json({ error: "Failed to dispatch grouped orders." }, { status: 400 });
    }

    // Broadcast individual status updates & notify rider fleet via WhatsApp
    const { sendOrderAssignedToRiderNotification } = await import("@/lib/notifications/order-notifications");
    for (const order of result.orders) {
      broadcastRealtimeEvent("order_status_updated", order);
      sendOrderAssignedToRiderNotification(order).catch(() => {});
    }

    // Broadcast group dispatch event to rider fleet
    broadcastRealtimeEvent("group_delivery_dispatched", {
      count: result.orders.length,
      orderIds: result.orders.map((o) => o.id),
      orderNumbers: result.orders.map((o) => o.order_number),
      localities: Array.from(new Set(result.orders.map((o) => o.locality).filter(Boolean))),
      orders: result.orders,
    });

    return NextResponse.json({
      success: true,
      message: `Group of ${result.orders.length} deliveries dispatched to rider fleet!`,
      count: result.orders.length,
      orders: result.orders,
    });
  } catch (error) {
    return NextResponse.json({ error: "Server error during group dispatch." }, { status: 500 });
  }
}
