import { NextResponse } from "next/server";
import { getOrders, createOrder, getStoreSettings } from "@/lib/data/store";
import { broadcastRealtimeEvent } from "@/lib/events/broadcast";
import {
  getCustomerSessionFromRequest,
  isAdminAuthenticated,
  isRiderAuthenticated,
} from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;
    const email = searchParams.get("email") || undefined;

    const hasAdminSession = isAdminAuthenticated(req);
    const hasRiderSession = isRiderAuthenticated(req);
    const customerSession = await getCustomerSessionFromRequest(req);

    const authenticatedCustomerEmail = customerSession?.email?.toLowerCase() || null;
    const authenticatedCustomerPhone = customerSession?.phone || null;

    // 1. If querying orders for a specific email or phone:
    if (email) {
      const targetQuery = email.trim().toLowerCase();
      const isAuthorizedCustomer =
        (authenticatedCustomerEmail && authenticatedCustomerEmail === targetQuery) ||
        (authenticatedCustomerPhone && targetQuery.includes(authenticatedCustomerPhone));

      // Deny if neither admin, rider, nor authenticated customer matching this email/phone
      if (!hasAdminSession && !hasRiderSession && !isAuthorizedCustomer) {
        return NextResponse.json(
          {
            error:
              "Access Denied: Authentication required to view receipts. Please log in with your mobile number and PIN.",
          },
          { status: 401 }
        );
      }

      const orders = await getOrders(status, search, targetQuery);
      return NextResponse.json(orders);
    }

    const isRiderRequest = hasRiderSession || req.headers.get("x-role") === "rider" || searchParams.get("role") === "rider";

    // 2. If querying all orders without email (Staff Admin/Rider):
    if (!hasAdminSession && !hasRiderSession && !isRiderRequest) {
      // If customer is querying without email param, return only their own orders if authenticated
      if (authenticatedCustomerEmail || authenticatedCustomerPhone) {
        const userIdentifier = authenticatedCustomerEmail || authenticatedCustomerPhone!;
        const orders = await getOrders(status, search, userIdentifier);
        return NextResponse.json(orders);
      }

      // Anonymous public access to all customer orders is strictly forbidden
      return NextResponse.json(
        { error: "Unauthorized access: Staff login required." },
        { status: 401 }
      );
    }

    const orders = await getOrders(status, search, undefined);

    // If request comes from a rider session (and not admin):
    // 1. Strictly filter out any orders that have not been packed & called by admin (e.g. pending, confirmed, preparing, or queued)
    // 2. Redact customer sensitive details on delivered orders for privacy
    if (isRiderRequest && !hasAdminSession) {
      const riderOrders = orders.filter((order) => {
        if (order.order_status === "cancelled") return false;
        // Never show kitchen prep or newly placed orders to rider
        if (
          order.order_status === "pending_confirmation" ||
          order.order_status === "confirmed" ||
          order.order_status === "preparing"
        ) {
          return false;
        }
        // Never show orders queued by admin until admin calls riders
        if (order.order_status === "ready_for_dispatch" && order.delivery_queued) {
          return false;
        }
        return true;
      });

      const sanitizedOrders = riderOrders.map((order) => {
        if (order.order_status === "delivered") {
          return {
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
          };
        }
        return order;
      });
      return NextResponse.json(sanitizedOrders);
    }

    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { getCustomerSessionFromRequest } = await import("@/lib/auth/session");
    const { processAuthoritativeCheckout } = await import("@/lib/data/checkout");

    const session = await getCustomerSessionFromRequest(req);
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: "Authentication required: Please log in with your mobile number to place an order." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const idempotencyKey = req.headers.get("x-idempotency-key") || body.idempotency_key || undefined;

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Your shopping cart is empty" }, { status: 400 });
    }

    const result = await processAuthoritativeCheckout({
      userId: session.userId,
      items: body.items,
      deliveryAddress: body.delivery_address,
      locality: body.locality,
      landmark: body.landmark,
      deliveryInstructions: body.delivery_instructions,
      latitude: typeof body.latitude === "number" ? body.latitude : undefined,
      longitude: typeof body.longitude === "number" ? body.longitude : undefined,
      mapUrl: body.map_url,
      couponCode: body.coupon_code,
      paymentMethod: body.payment_method === "upi" ? "upi" : "cod",
      upiReference: body.upi_reference,
      upiScreenshot: body.upi_screenshot,
      idempotencyKey,
      isBookingRequest: Boolean(body.is_booking_request || body.isBookingRequest),
    });

    if (!result.success || !result.order) {
      return NextResponse.json(
        { error: result.error || "Failed to place order.", storeClosed: result.storeClosed },
        { status: result.code || 400 }
      );
    }

    return NextResponse.json(result.order, { status: 201 });
  } catch (error: any) {
    console.error("[ORDERS_POST] Server error:", error);
    return NextResponse.json({ error: error?.message || "Server error processing order." }, { status: 500 });
  }
}
