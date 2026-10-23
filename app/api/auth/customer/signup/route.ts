import { NextResponse } from "next/server";
import { registerCustomer } from "@/lib/data/store";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      email,
      phone,
      password,
      pin,
      name,
      delivery_address,
      locality,
      landmark,
      delivery_instructions,
      latitude,
      longitude,
      map_url,
    } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email address is required." }, { status: 400 });
    }

    const cleanPhone = (phone || "").replace(/[^0-9]/g, "");
    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: "Valid 10-digit mobile number is required." }, { status: 400 });
    }

    if (password && password.trim().length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    }

    const cleanPin = (pin || "").toString().replace(/[^0-9]/g, "");
    if (!cleanPin || cleanPin.length !== 6) {
      return NextResponse.json({ error: "Please set a 6-digit numeric security PIN." }, { status: 400 });
    }

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
    }

    if (!delivery_address || delivery_address.trim().length < 4) {
      return NextResponse.json({ error: "Please provide your full delivery address." }, { status: 400 });
    }

    // Default to Kothal Kalan, Mahendragarh, Haryana if coordinates are missing
    const finalLat = typeof latitude === "number" ? latitude : 28.1907;
    const finalLng = typeof longitude === "number" ? longitude : 76.1624;
    const finalLocality = (locality || "").trim() || "Kothal Kalan, Mahendragarh";
    const finalMapUrl = map_url || `https://www.google.com/maps?q=${finalLat},${finalLng}`;

    const result = await registerCustomer({
      email,
      phone: cleanPhone,
      password: password ? password.trim() : undefined,
      pin: cleanPin,
      name: name.trim(),
      delivery_address: delivery_address.trim(),
      locality: finalLocality,
      landmark: landmark ? landmark.trim() : undefined,
      delivery_instructions: delivery_instructions ? delivery_instructions.trim() : undefined,
      latitude: finalLat,
      longitude: finalLng,
      map_url: finalMapUrl,
    });

    if (!result.success || !result.customer) {
      return NextResponse.json({ error: result.error || "Failed to create account." }, { status: 400 });
    }

    const { pin: _removedPin, ...safeCustomer } = result.customer;

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
          savedAt: safeCustomer.created_at,
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
    return NextResponse.json({ error: "Server error during customer registration." }, { status: 500 });
  }
}
