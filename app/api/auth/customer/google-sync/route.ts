import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/neon/db";
import { normalizeAndValidateWhatsAppPhone } from "@/lib/utils/phone";
import { createCustomerSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const rows = await sql.query(
      `SELECT id, email, phone, name, delivery_address, locality, landmark, delivery_instructions, latitude, longitude, map_url, phone_verified_at, created_at, updated_at
       FROM customer_accounts 
       WHERE LOWER(email) = $1 LIMIT 1;`,
      [email.trim().toLowerCase()]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ exists: false, hasCompleteProfile: false });
    }

    const customer = rows[0];
    const hasCompletePhone = Boolean(customer.phone && customer.phone.replace(/[^0-9]/g, "").length >= 10);
    const hasCompleteProfile = Boolean(
      customer.delivery_address &&
      customer.locality &&
      hasCompletePhone
    );

    const userObj = {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      phone_verified_at: customer.phone_verified_at,
      authProvider: "google" as const,
      savedProfile: {
        customer_name: customer.name,
        customer_phone: customer.phone,
        delivery_address: customer.delivery_address,
        locality: customer.locality,
        landmark: customer.landmark,
        delivery_instructions: customer.delivery_instructions,
        latitude: customer.latitude ? Number(customer.latitude) : 28.1907,
        longitude: customer.longitude ? Number(customer.longitude) : 76.1624,
        map_url: customer.map_url,
        savedAt: customer.updated_at || customer.created_at,
      },
    };

    const token = await createCustomerSession({
      userId: customer.id,
      phone: customer.phone || "",
      email: customer.email,
    });

    const response = NextResponse.json({
      exists: true,
      hasCompleteProfile,
      user: userObj,
      customer: userObj.savedProfile,
    });

    if (hasCompleteProfile) {
      response.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
    }

    return response;
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

    const phoneValidation = normalizeAndValidateWhatsAppPhone(phone || "");
    if (!phoneValidation.isValid) {
      return NextResponse.json({ error: phoneValidation.error }, { status: 400 });
    }

    const cleanPhone = phoneValidation.dbFormat;
    const normEmail = email.trim().toLowerCase();

    if (!delivery_address || delivery_address.trim().length < 4) {
      return NextResponse.json({ error: "Full delivery address is required for sweet deliveries." }, { status: 400 });
    }

    const finalLat = typeof latitude === "number" ? latitude : 28.1907;
    const finalLng = typeof longitude === "number" ? longitude : 76.1624;
    const finalLocality = (locality || "").trim() || "Kothal Kalan, Mahendragarh";
    const finalMapUrl = map_url || `https://www.google.com/maps?q=${finalLat},${finalLng}`;

    if (!sql) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    // Check store shutoff status: prevent new customer creation if permanently closed
    const settingsRows = await sql.query(
      `SELECT store_status, store_shutoff, shutoff_message FROM store_settings WHERE id = 1 LIMIT 1;`
    );
    if (settingsRows && settingsRows.length > 0) {
      const s = settingsRows[0];
      if (s.store_shutoff || s.store_status === "shutoff") {
        const existingCust = await sql.query(
          `SELECT id FROM customer_accounts WHERE LOWER(email) = $1 OR phone = $2 LIMIT 1;`,
          [normEmail, cleanPhone]
        );
        if (!existingCust || existingCust.length === 0) {
          return NextResponse.json(
            { error: s.shutoff_message || "The store is permanently closed. New customer signups are currently disabled." },
            { status: 403 }
          );
        }
      }
    }

    // Default 6-digit pin for Google users if not already assigned
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    const pinHash = await bcrypt.hash(randomPin, 10);

    const rows = await sql.query(
      `INSERT INTO customer_accounts (
         email, phone, pin_hash, name, delivery_address, locality, landmark,
         delivery_instructions, latitude, longitude, map_url, phone_verified_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       ON CONFLICT (phone) DO UPDATE SET
         email = EXCLUDED.email,
         name = EXCLUDED.name,
         delivery_address = EXCLUDED.delivery_address,
         locality = EXCLUDED.locality,
         landmark = COALESCE(EXCLUDED.landmark, customer_accounts.landmark),
         delivery_instructions = COALESCE(EXCLUDED.delivery_instructions, customer_accounts.delivery_instructions),
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         map_url = EXCLUDED.map_url,
         phone_verified_at = COALESCE(customer_accounts.phone_verified_at, NOW()),
         updated_at = NOW()
       RETURNING id, email, phone, name, delivery_address, locality, landmark, delivery_instructions, latitude, longitude, map_url, phone_verified_at, created_at, updated_at;`,
      [
        normEmail,
        cleanPhone,
        pinHash,
        (name || "Diwali Guest").trim(),
        delivery_address.trim(),
        finalLocality,
        landmark ? landmark.trim() : null,
        delivery_instructions ? delivery_instructions.trim() : null,
        finalLat,
        finalLng,
        finalMapUrl,
      ]
    );

    const customer = rows[0];

    // Establish cryptographically signed session
    const token = await createCustomerSession({
      userId: customer.id,
      phone: customer.phone,
      email: customer.email,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        phone_verified_at: customer.phone_verified_at,
        savedProfile: {
          customer_name: customer.name,
          customer_phone: customer.phone,
          delivery_address: customer.delivery_address,
          locality: customer.locality,
          landmark: customer.landmark,
          delivery_instructions: customer.delivery_instructions,
          latitude: customer.latitude ? Number(customer.latitude) : 28.1907,
          longitude: customer.longitude ? Number(customer.longitude) : 76.1624,
          map_url: customer.map_url,
          savedAt: customer.updated_at || customer.created_at,
        },
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    response.cookies.set("mithaase_customer_session", encodeURIComponent(customer.email.toLowerCase()), {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    console.error("[GOOGLE_SYNC] Error:", error);
    return NextResponse.json({ error: error?.message || "Server error saving Google customer profile." }, { status: 500 });
  }
}
