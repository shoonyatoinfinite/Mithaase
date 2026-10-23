import { NextResponse } from "next/server";
import { findCustomerByEmail, registerCustomer } from "@/lib/data/store";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const customer = await findCustomerByEmail(email);

    if (!customer) {
      return NextResponse.json({ exists: false, hasCompleteProfile: false });
    }

    const hasCompleteProfile = Boolean(
      customer.delivery_address &&
      customer.locality &&
      customer.phone &&
      customer.phone.replace(/[^0-9]/g, "").length >= 10
    );

    const { pin: _p, ...safeCustomer } = customer;

    return NextResponse.json({
      exists: true,
      hasCompleteProfile,
      customer: safeCustomer,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to check profile." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      email,
      name,
      phone,
      delivery_address,
      locality,
      landmark,
      delivery_instructions,
      latitude,
      longitude,
      map_url,
    } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    const cleanPhone = (phone || "").replace(/[^0-9]/g, "");
    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: "10-digit mobile number is required for Diwali delivery updates." }, { status: 400 });
    }

    if (!delivery_address || delivery_address.trim().length < 5) {
      return NextResponse.json({ error: "Full delivery address is required for sweet deliveries." }, { status: 400 });
    }

    const finalLat = typeof latitude === "number" ? latitude : 28.1907;
    const finalLng = typeof longitude === "number" ? longitude : 76.1624;
    const finalLocality = (locality || "").trim() || "Kothal Kalan, Mahendragarh";
    const finalMapUrl = map_url || `https://www.google.com/maps?q=${finalLat},${finalLng}`;

    // Auto-generate or reuse existing pin for Google account
    const existing = await findCustomerByEmail(email);
    const pin = existing?.pin || Math.floor(1000 + Math.random() * 9000).toString();

    const result = await registerCustomer({
      email,
      phone: cleanPhone,
      pin,
      name: (name || existing?.name || "Diwali Guest").trim(),
      delivery_address: delivery_address.trim(),
      locality: finalLocality,
      landmark: landmark ? landmark.trim() : undefined,
      delivery_instructions: delivery_instructions ? delivery_instructions.trim() : undefined,
      latitude: finalLat,
      longitude: finalLng,
      map_url: finalMapUrl,
    });

    if (!result.success || !result.customer) {
      return NextResponse.json({ error: result.error || "Failed to save profile." }, { status: 400 });
    }

    const { pin: _p, ...safeCustomer } = result.customer;

    const response = NextResponse.json({
      success: true,
      user: {
        email: safeCustomer.email,
        name: safeCustomer.name,
        phone: safeCustomer.phone,
        savedProfile: {
          customer_name: safeCustomer.name,
          customer_phone: safeCustomer.phone,
          delivery_address: safeCustomer.delivery_address,
          locality: safeCustomer.locality,
          landmark: safeCustomer.landmark,
          delivery_instructions: safeCustomer.delivery_instructions,
          latitude: safeCustomer.latitude,
          longitude: safeCustomer.longitude,
          map_url: safeCustomer.map_url,
          savedAt: safeCustomer.updated_at || safeCustomer.created_at,
        },
      },
    });

    response.cookies.set("mithaase_customer_session", encodeURIComponent(safeCustomer.email.toLowerCase()), {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: "Server error saving Google customer profile." }, { status: 500 });
  }
}
