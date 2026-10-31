import { NextResponse } from "next/server";
import {
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  updateBookingStatus,
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
    const { id } = await params;
    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const isAdmin = isAdminAuthenticated(req);
    const isRider = isRiderAuthenticated(req);
    const customerSession = await getCustomerSessionFromRequest(req);

    const isOrderOwner =
      customerSession &&
      ((order.customer_email && customerSession.email && order.customer_email.toLowerCase() === customerSession.email.toLowerCase()) ||
        (order.customer_phone && customerSession.phone && order.customer_phone === customerSession.phone));

    const body = await req.json();

    // Check if this is an authorized customer selecting payment or requesting bill email
    const isCustomerPaymentSelection =
      isOrderOwner &&
      body.booking_status === "payment_selected" &&
      order.booking_status === "approved_for_payment";

    const isCustomerSendBill = isOrderOwner && body.action === "send_bill";

    // Strict Server-Side Role Enforcement
    if (!isAdmin && !isRider && !isCustomerPaymentSelection && !isCustomerSendBill) {
      return NextResponse.json(
        { error: "Forbidden: Staff administrator, rider, or authorized customer action required." },
        { status: 403 }
      );
    }

    if (isCustomerSendBill) {
      const { sendOrderDeliveredNotification } = await import("@/lib/notifications/order-notifications");
      await sendOrderDeliveredNotification(order.id);
      return NextResponse.json({ success: true, message: "Official bill and receipt sent to customer email" });
    }

    // Customer Payment Selection Handler
    if (isCustomerPaymentSelection) {
      const payRes = await updateBookingStatus(
        id,
        "payment_selected",
        "Customer",
        body.note,
        {
          payment_method: body.payment_method === "upi" ? "upi" : "cod",
          upi_reference: body.payment_method === "upi" ? body.upi_reference : undefined,
          upi_screenshot: body.payment_method === "upi" ? body.upi_screenshot : undefined,
        }
      );
      if (!payRes.success) {
        return NextResponse.json({ error: payRes.error || "Failed to submit payment selection" }, { status: 400 });
      }
    }

    // Admin Booking Status Updates (Approve Request or Reapprove/Confirm Order)
    if (isAdmin && body.booking_status) {
      const bookRes = await updateBookingStatus(
        id,
        body.booking_status,
        "Admin",
        body.note,
        body.payment_method ? {
          payment_method: body.payment_method,
          upi_reference: body.upi_reference,
          upi_screenshot: body.upi_screenshot,
        } : undefined
      );
      if (!bookRes.success) {
        return NextResponse.json({ error: bookRes.error || "Failed to update booking status" }, { status: 400 });
      }
    }

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

      if (body.order_status === "out_for_delivery") {
        const { sendOrderOutForDeliveryNotification } = await import("@/lib/notifications/order-notifications");
        sendOrderOutForDeliveryNotification(
          id,
          body.rider_name || body.changed_by,
          body.rider_phone,
          body.changed_by,
          body.note
        ).catch(() => {});
      } else if (body.order_status === "delivered") {
        const { sendOrderDeliveredNotification } = await import("@/lib/notifications/order-notifications");
        sendOrderDeliveredNotification(
          id,
          body.rider_name || body.changed_by,
          body.rider_phone,
          body.changed_by,
          body.note
        ).catch(() => {});
      }
    }

    // Only Admin can update payment status, delivery queue, or refunds
    if (isAdmin) {
      if (body.action === "send_confirmation") {
        const { sendOrderConfirmedNotification } = await import("@/lib/notifications/order-notifications");
        await sendOrderConfirmedNotification(order.id);
        return NextResponse.json({ success: true, message: "Confirmation notification sent successfully" });
      }

      if (body.action === "send_bill") {
        const { sendOrderDeliveredNotification } = await import("@/lib/notifications/order-notifications");
        await sendOrderDeliveredNotification(order.id);
        return NextResponse.json({ success: true, message: "Delivery bill sent successfully" });
      }

      if (body.action === "send_cancellation") {
        const { sendOrderCancelledNotification } = await import("@/lib/notifications/order-notifications");
        await sendOrderCancelledNotification(order.id, body.note || order.cancellation_reason);
        return NextResponse.json({ success: true, message: "Cancellation alert sent successfully" });
      }

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
