import { NextResponse } from "next/server";
import { verifyCustomerLogin } from "@/lib/data/store";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { identifier, email, phone, secret, pin, password } = body;
    const targetIdentifier = (identifier || email || phone || "").trim();
    const targetSecret = (secret || pin || password || "").trim();

    if (!targetIdentifier) {
      return NextResponse.json({ error: "Please enter your registered email address or mobile number." }, { status: 400 });
    }

    const isEmail = targetIdentifier.includes("@");
    const cleanPhone = targetIdentifier.replace(/[^0-9]/g, "");
    if (!isEmail && cleanPhone.length < 10) {
      return NextResponse.json({ error: "Please enter a valid email address or 10-digit mobile number." }, { status: 400 });
    }

    if (!targetSecret || targetSecret.length < 4) {
      return NextResponse.json({ error: "Please enter your account password or 6-digit PIN." }, { status: 400 });
    }

    const result = await verifyCustomerLogin(targetIdentifier, targetSecret);

    if (!result.success || !result.customer) {
      return NextResponse.json({ error: result.error || "Login failed." }, { status: 401 });
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
    return NextResponse.json({ error: "Server error during customer login." }, { status: 500 });
  }
}
