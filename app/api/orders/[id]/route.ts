import { NextResponse } from "next/server";
import {
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  setOrderDeliveryQueue,
  processOrderRefund,
} from "@/lib/data/store";
import { OrderStatus, PaymentStatus } from "@/types";
import { broadcastRealtimeEvent } from "@/lib/events/broadcast";
import {
  isAdminAuthenticated,
  isRiderAuthenticated,
  getCustomerSessionFromRequest,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const isAdmin = isAdminAuthenticated(req);
    const isRider = isRiderAuthenticated(req);
    const customerSession = await getCustomerSessionFromRequest(req);

    // IDOR Protection: Verify ownership
    const isOrderOwner =
      customerSession &&
      ((order.customer_email && customerSession.email && order.customer_email.toLowerCase() === customerSession.email.toLowerCase()) ||
        (order.customer_phone && customerSession.phone && order.customer_phone === customerSession.phone));

    if (!isAdmin && !isRider && !isOrderOwner) {
      return NextResponse.json(
        { error: "Access Denied: You are not authorized to view this order." },
        { status: 403 }
      );
    }

    // Rider Privacy Sanitization on delivered orders
    if (isRider && !isAdmin && order.order_status === "delivered") {
      return NextResponse.json({
        ...order,
        customer_name: "Customer (Delivered)",
        customer_email: undefined,
        customer_phone: "🔒 Redacted",
        delivery_address: "🔒 Hidden for privacy",
        locality: "",
        landmark: undefined,
        delivery_instructions: undefined,
        subtotal: 0,
        discount_amount: 0,
        delivery_charge: 0,
        total_amount: 0,
        items: [],
        pickup_photo: undefined,
        delivery_proof_photo: undefined,
        latitude: undefined,
        longitude: undefined,
        map_url: undefined,
        delivered_lat: undefined,
        delivered_lng: undefined,
        delivered_location_name: undefined,
        delivered_map_url: undefined,
        upi_reference: undefined,
        upi_screenshot: undefined,
      });
    }

    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = isAdminAuthenticated(req);
    const isRider = isRiderAuthenticated(req);

    // Strict Server-Side Role Enforcement
    if (!isAdmin && !isRider) {
      return NextResponse.json(
        { error: "Forbidden: Staff administrator or rider login required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    if (body.order_status) {
      // Riders can only update their active delivery progression
      if (isRider && !isAdmin) {
        const allowedRiderStatuses = ["out_for_delivery", "delivered"];
        if (!allowedRiderStatuses.includes(body.order_status)) {
          return NextResponse.json(
            { error: "Riders are not authorized to perform this status transition." },
            { status: 403 }
          );
        }
      }

      const deliveryDetails =
        body.delivered_at || body.delivered_lat !== undefined || body.delivered_lng !== undefined || body.delivered_location_name || body.delivered_map_url
          ? {
              delivered_at: body.delivered_at,
              delivered_lat: typeof body.delivered_lat === "number" ? body.delivered_lat : undefined,
              delivered_lng: typeof body.delivered_lng === "number" ? body.delivered_lng : undefined,
              delivered_location_name: body.delivered_location_name,
              delivered_map_url: body.delivered_map_url,
            }
          : undefined;

      const res = await updateOrderStatus(
        id,
        body.order_status as OrderStatus,
        body.note,
        body.changed_by || (isAdmin ? "Admin" : "Rider"),
        body.delivery_proof_photo,
        body.pickup_photo,
        deliveryDetails
      );
      if (!res.success) {
        return NextResponse.json({ error: res.error || "Failed to update status" }, { status: 400 });
      }
    }

    // Only Admin can update payment status, delivery queue, or refunds
    if (isAdmin) {
      if (body.payment_status) {
        await updatePaymentStatus(id, body.payment_status as PaymentStatus, body.upi_reference);
      }

      if (body.delivery_queued !== undefined) {
        await setOrderDeliveryQueue(id, Boolean(body.delivery_queued), body.delivery_group_id);
      }

      if (body.action === "refund" || body.refund_txn_id) {
        const refundRes = await processOrderRefund(
          id,
          body.refund_txn_id,
          body.refund_screenshot,
          body.refund_note,
          body.changed_by || "Admin"
        );
        if (!refundRes.success) {
          return NextResponse.json({ error: refundRes.error || "Failed to process refund" }, { status: 400 });
        }
      }
    }

    const updated = await getOrderById(id);

    if (updated) {
      broadcastRealtimeEvent("order_status_updated", updated);
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
