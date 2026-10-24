import { NextResponse } from "next/server";
import { findCustomerByIdentifier, registerCustomer, getOrders } from "@/lib/data/store";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let identifier = searchParams.get("email") || searchParams.get("phone") || searchParams.get("identifier");

    if (!identifier) {
      // Check cookie
      const cookieHeader = req.headers.get("cookie") || "";
      const match = cookieHeader.match(/mithaase_customer_session=([^;]+)/);
      if (match && match[1]) {
        identifier = decodeURIComponent(match[1]);
      }
    }

    if (!identifier) {
      return NextResponse.json({ success: false, error: "Identifier required" }, { status: 400 });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const customer = await findCustomerByIdentifier(cleanIdentifier);

    if (customer) {
      return NextResponse.json({
        success: true,
        user: {
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          savedProfile: {
            customer_name: customer.name,
            customer_phone: customer.phone,
            delivery_address: customer.delivery_address,
            locality: customer.locality,
            landmark: customer.landmark,
            delivery_instructions: customer.delivery_instructions,
            latitude: customer.latitude,
            longitude: customer.longitude,
            map_url: customer.map_url,
            savedAt: customer.updated_at || customer.created_at,
          },
        },
      });
    }

    // Fallback: Check past orders for this customer to auto-restore profile
    const pastOrders = await getOrders(undefined, undefined, cleanIdentifier);
    if (pastOrders && pastOrders.length > 0) {
      const latest = pastOrders[0];
      const autoProfile = {
        customer_name: latest.customer_name,
        customer_phone: latest.customer_phone,
        delivery_address: latest.delivery_address,
        locality: latest.locality,
        landmark: latest.landmark,
        delivery_instructions: latest.delivery_instructions,
        latitude: latest.latitude,
        longitude: latest.longitude,
        map_url: latest.map_url,
        savedAt: latest.created_at,
      };

      // Also persist to customer_accounts table
      await registerCustomer({
        email: latest.customer_email || cleanIdentifier,
        phone: latest.customer_phone,
        pin: "123456",
        name: latest.customer_name,
        delivery_address: latest.delivery_address,
        locality: latest.locality,
        landmark: latest.landmark,
        delivery_instructions: latest.delivery_instructions,
        latitude: latest.latitude || 28.1907,
        longitude: latest.longitude || 76.1624,
        map_url: latest.map_url || `https://www.google.com/maps?q=${latest.latitude || 28.1907},${latest.longitude || 76.1624}`,
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        user: {
          email: latest.customer_email || cleanIdentifier,
          name: latest.customer_name,
          phone: latest.customer_phone,
          savedProfile: autoProfile,
        },
      });
    }

    return NextResponse.json({ success: false, notFound: true, message: "No customer profile found" }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Server error fetching profile" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      email,
      phone,
      name,
      delivery_address,
      locality,
      landmark,
      delivery_instructions,
      latitude,
      longitude,
      map_url,
    } = body;

    const normEmail = (email || "").trim().toLowerCase();
    const cleanPhone = (phone || "").trim().replace(/[^0-9]/g, "");

    if (!normEmail && cleanPhone.length < 10) {
      return NextResponse.json({ success: false, error: "Valid email or 10-digit mobile number required" }, { status: 400 });
    }

    const targetEmail = normEmail || `cust_${cleanPhone}@mithaase.in`;
    const targetPhone = cleanPhone || "9999999999";
    const targetName = (name || "Customer").trim();
    const targetAddress = (delivery_address || "").trim();
    const targetLocality = (locality || "").trim() || "Kothal Kalan, Mahendragarh";
    const targetLat = typeof latitude === "number" ? latitude : 28.1907;
    const targetLng = typeof longitude === "number" ? longitude : 76.1624;
    const targetMapUrl = map_url || `https://www.google.com/maps?q=${targetLat},${targetLng}`;

    const regResult = await registerCustomer({
      email: targetEmail,
      phone: targetPhone,
      pin: "123456",
      name: targetName,
      delivery_address: targetAddress,
      locality: targetLocality,
      landmark: landmark ? landmark.trim() : undefined,
      delivery_instructions: delivery_instructions ? delivery_instructions.trim() : undefined,
      latitude: targetLat,
      longitude: targetLng,
      map_url: targetMapUrl,
    });

    if (!regResult.success || !regResult.customer) {
      return NextResponse.json({ success: false, error: regResult.error || "Failed to update profile" }, { status: 400 });
    }

    const savedProfile = {
      customer_name: regResult.customer.name,
      customer_phone: regResult.customer.phone,
      delivery_address: regResult.customer.delivery_address,
      locality: regResult.customer.locality,
      landmark: regResult.customer.landmark,
      delivery_instructions: regResult.customer.delivery_instructions,
      latitude: regResult.customer.latitude,
      longitude: regResult.customer.longitude,
      map_url: regResult.customer.map_url,
      savedAt: regResult.customer.updated_at || regResult.customer.created_at,
    };

    return NextResponse.json({
      success: true,
      user: {
        email: regResult.customer.email,
        name: regResult.customer.name,
        phone: regResult.customer.phone,
        savedProfile,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to save customer profile" }, { status: 500 });
  }
}
