import { NextResponse } from "next/server";
import { getOrders, createOrder, getStoreSettings } from "@/lib/data/store";
import { broadcastRealtimeEvent } from "@/lib/events/broadcast";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;
    const email = searchParams.get("email") || undefined;

    const cookieHeader = req.headers.get("cookie") || "";
    const hasAdminSession = cookieHeader.includes("mithaase_admin_session=true");
    const hasRiderSession = cookieHeader.includes("mithaase_rider_session=true");

    // Extract customer session cookie if present
    const customerCookieMatch = cookieHeader.match(/mithaase_customer_session=([^;]+)/);
    const authenticatedCustomerEmail = customerCookieMatch
      ? decodeURIComponent(customerCookieMatch[1]).trim().toLowerCase()
      : null;

    const authHeaderEmail = req.headers.get("x-customer-auth-email")?.trim().toLowerCase();

    // 1. If querying orders for a specific email (customer receipts):
    if (email) {
      const targetEmail = email.trim().toLowerCase();
      const isAuthorizedCustomer =
        (authenticatedCustomerEmail && authenticatedCustomerEmail === targetEmail) ||
        (authHeaderEmail && authHeaderEmail === targetEmail);

      // Deny if neither admin, rider, nor authenticated customer matching this email
      if (!hasAdminSession && !hasRiderSession && !isAuthorizedCustomer) {
        return NextResponse.json(
          {
            error:
              "Access Denied: Authentication required to view receipts. Please log in with your email and PIN.",
          },
          { status: 401 }
        );
      }

      const orders = await getOrders(status, search, targetEmail);
      return NextResponse.json(orders);
    }

    const isRiderRequest = hasRiderSession || req.headers.get("x-role") === "rider" || searchParams.get("role") === "rider";

    // 2. If querying all orders without email (Staff Admin/Rider):
    if (!hasAdminSession && !hasRiderSession && !isRiderRequest) {
      // If customer is querying without email param, return only their own orders if authenticated
      if (authenticatedCustomerEmail || authHeaderEmail) {
        const userEmail = authenticatedCustomerEmail || authHeaderEmail;
        const orders = await getOrders(status, search, userEmail || undefined);
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
    const body = await req.json();

    // 0. Store status verification
    const settings = await getStoreSettings();
    if (!settings.accepts_orders || settings.store_status !== "open") {
      return NextResponse.json(
        {
          error:
            settings.closure_message ||
            "Store is currently closed for online orders. Kindly visit our shop directly or order during operating hours.",
          storeClosed: true,
          operatingHours: settings.operating_hours || "8:00 AM - 10:00 PM",
          shopAddress: settings.shop_address,
          businessPhone: settings.business_phone,
        },
        { status: 403 }
      );
    }

    // 1. Validation
    if (!body.customer_name || body.customer_name.trim().length < 2) {
      return NextResponse.json({ error: "Please enter a valid customer name" }, { status: 400 });
    }

    if (!body.customer_email || !body.customer_email.includes("@")) {
      return NextResponse.json(
        { error: "Please verify your email with OTP before placing an order." },
        { status: 401 }
      );
    }

    const cleanPhone = (body.customer_phone || "").replace(/[^0-9]/g, "");
    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: "Please enter a valid 10-digit mobile number" }, { status: 400 });
    }

    if (!body.delivery_address || body.delivery_address.trim().length < 5) {
      return NextResponse.json({ error: "Please enter your full delivery address" }, { status: 400 });
    }

    if (!body.locality || body.locality.trim().length < 2) {
      return NextResponse.json({ error: "Please select or enter your village/locality" }, { status: 400 });
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Your cart is empty" }, { status: 400 });
    }

    const result = await createOrder({
      customer_name: body.customer_name,
      customer_email: body.customer_email.trim(),
      customer_phone: cleanPhone,
      delivery_address: body.delivery_address,
      locality: body.locality,
      landmark: body.landmark,
      delivery_instructions: body.delivery_instructions,
      payment_method: body.payment_method === "upi" ? "upi" : "cod",
      upi_reference: body.upi_reference,
      upi_screenshot: body.upi_screenshot,
      coupon_code: body.coupon_code,
      discount_amount: typeof body.discount_amount === "number" ? body.discount_amount : undefined,
      latitude: typeof body.latitude === "number" ? body.latitude : undefined,
      longitude: typeof body.longitude === "number" ? body.longitude : undefined,
      map_url: body.map_url,
      items: body.items,
    });

    if (!result.success || !result.order) {
      return NextResponse.json({ error: result.error || "Failed to place order" }, { status: 400 });
    }

    // Broadcast new order creation real-time event to Admin dashboard and store
    broadcastRealtimeEvent("order_created", result.order);

    return NextResponse.json(result.order, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Server error processing order" }, { status: 500 });
  }
}
