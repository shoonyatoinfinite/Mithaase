import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/neon/db";
import { normalizeAndValidateWhatsAppPhone } from "@/lib/utils/phone";
import { checkRateLimit, clearRateLimit } from "@/lib/auth/otp-service";
import { createCustomerSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawIdentifier = (body.identifier || body.email || body.phone || "").trim();
    const rawSecret = (body.pin || body.secret || body.password || "").trim();

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

    if (!rawIdentifier || !rawSecret) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    // 1. Rate limiting check (max 5 failed attempts per 15 min lock)
    const rateCheck = await checkRateLimit(rawIdentifier.toLowerCase(), "login_fail", clientIp, 5, 15);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.error }, { status: 429 });
    }

    // 2. Normalize identifier as either 10-digit phone or lowercase email
    const normEmail = rawIdentifier.toLowerCase();
    const phoneVal = normalizeAndValidateWhatsAppPhone(rawIdentifier);
    const cleanPhone = phoneVal.isValid ? phoneVal.dbFormat : "INVALID_PHONE";

    // 3. Query Neon PostgreSQL directly (zero caching, zero in-memory fallback)
    const rows = await sql.query(
      `SELECT id, email, phone, pin, pin_hash, name, delivery_address, locality, landmark, delivery_instructions, latitude, longitude, map_url, phone_verified_at, created_at, updated_at 
       FROM customer_accounts 
       WHERE LOWER(email) = $1 OR phone = $2 
       LIMIT 1;`,
      [normEmail, cleanPhone]
    );

    if (!rows || rows.length === 0) {
      // Generic error preventing user enumeration
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const customer = rows[0];
    let passwordMatches = false;

    // 4. Authenticate against bcrypt pin_hash
    if (customer.pin_hash) {
      try {
        passwordMatches = await bcrypt.compare(rawSecret, customer.pin_hash);
      } catch {
        passwordMatches = false;
      }
    }

    // 5. Fallback for legacy plain-text PIN: constant-time comparison + auto-rehash
    if (!passwordMatches && customer.pin) {
      const dbPin = String(customer.pin).trim();
      const inputBuf = Buffer.from(rawSecret.padEnd(32, " "));
      const dbBuf = Buffer.from(dbPin.padEnd(32, " "));

      if (crypto.timingSafeEqual(inputBuf, dbBuf)) {
        passwordMatches = true;

        // Auto-rehash: Convert plain text PIN to bcrypt hash and nullify plain PIN
        try {
          const newHash = await bcrypt.hash(rawSecret, 10);
          await sql.query(
            `UPDATE customer_accounts 
             SET pin_hash = $1, pin = NULL, updated_at = NOW() 
             WHERE id = $2;`,
            [newHash, customer.id]
          );
        } catch (rehashErr) {
          console.warn("[LOGIN] Rehash warning:", rehashErr);
        }
      }
    }

    if (!passwordMatches) {
      // Failed attempt counted in Neon DB
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    // 6. Clear rate limits upon successful login
    await clearRateLimit(rawIdentifier.toLowerCase(), "login_fail");

    // 7. Create signed HttpOnly session
    const token = await createCustomerSession({
      userId: customer.id,
      phone: customer.phone,
      email: customer.email,
    });

    const safeUser = {
      id: customer.id,
      email: customer.email,
      phone: customer.phone,
      name: customer.name,
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
        map_url: customer.map_url || "",
        savedAt: customer.updated_at,
      },
    };

    const response = NextResponse.json({
      success: true,
      user: safeUser,
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (error: any) {
    console.error("[LOGIN] Error:", error);
    return NextResponse.json({ error: "Server error during customer login." }, { status: 500 });
  }
}
