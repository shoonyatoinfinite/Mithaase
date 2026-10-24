import { NextResponse } from "next/server";

declare global {
  // eslint-disable-next-line no-var
  var __mithaase_otps: Map<string, { otp: string; expiresAt: number }> | undefined;
}

const otpStore = global.__mithaase_otps || new Map();

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: "Email and OTP code are required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();


    const record = otpStore.get(normalizedEmail);

    if (!record) {
      return NextResponse.json(
        { error: "No verification code requested for this email, or code has expired. Please request a new code." },
        { status: 400 }
      );
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(normalizedEmail);
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new code." },
        { status: 400 }
      );
    }

    if (record.otp !== cleanOtp) {
      return NextResponse.json(
        { error: "Incorrect verification code. Please check and try again." },
        { status: 400 }
      );
    }

    // OTP matched! Clean up
    otpStore.delete(normalizedEmail);

    // Look up customer from DB to restore their saved profile
    const { findCustomerByEmail, getOrders } = await import("@/lib/data/store");
    let customer = await findCustomerByEmail(normalizedEmail);
    let savedProfile: any = null;

    if (customer) {
      savedProfile = {
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
      };
    } else {
      // Fallback: check recent orders
      const pastOrders = await getOrders(undefined, undefined, normalizedEmail);
      if (pastOrders && pastOrders.length > 0) {
        const latest = pastOrders[0];
        savedProfile = {
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
      }
    }

    const response = NextResponse.json({
      success: true,
      user: {
        email: normalizedEmail,
        name: customer?.name || savedProfile?.customer_name,
        phone: customer?.phone || savedProfile?.customer_phone,
        savedProfile,
        verifiedAt: new Date().toISOString(),
      },
    });

    response.cookies.set("mithaase_customer_session", encodeURIComponent(normalizedEmail), {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: "Server error verifying code" }, { status: 500 });
  }
}
