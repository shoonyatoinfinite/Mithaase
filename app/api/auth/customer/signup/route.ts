import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { sql } from "@/lib/neon/db";
import { normalizeAndValidateWhatsAppPhone } from "@/lib/utils/phone";
import { assertPhoneVerifiedServerSide } from "@/lib/auth/otp-service";
import { createCustomerSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const SignupSchema = z.object({
  email: z.string().email("Please provide a valid email address."),
  phone: z.string().min(10, "Mobile number is required."),
  pin: z.string().regex(/^\d{6}$/, "Security PIN must be exactly 6 digits."),
  name: z.string().min(2, "Name must be at least 2 characters long."),
  delivery_address: z.string().min(4, "Full delivery address is required."),
  locality: z.string().min(2, "Locality/Village is required."),
  landmark: z.string().optional(),
  delivery_instructions: z.string().optional(),
  latitude: z.number().optional().default(28.1907),
  longitude: z.number().optional().default(76.1624),
  map_url: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const parseResult = SignupSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues[0]?.message || "Invalid input data.";
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const data = parseResult.data;

    // 1. Validate phone number formatting and Indian carrier rules
    const phoneValidation = normalizeAndValidateWhatsAppPhone(data.phone);
    if (!phoneValidation.isValid) {
      return NextResponse.json({ error: phoneValidation.error }, { status: 400 });
    }

    const cleanPhone = phoneValidation.dbFormat;
    const normEmail = data.email.trim().toLowerCase();

    if (!sql) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    // Check store shutoff status in Neon DB: when store is permanently closed, prevent any new user signup
    const settingsRows = await sql.query(
      `SELECT store_status, store_shutoff, shutoff_message FROM store_settings WHERE id = 1 LIMIT 1;`
    );
    if (settingsRows && settingsRows.length > 0) {
      const s = settingsRows[0];
      if (s.store_shutoff || s.store_status === "shutoff") {
        return NextResponse.json(
          {
            error:
              s.shutoff_message ||
              "The store is currently permanently closed by administration. New customer registrations are temporarily disabled.",
          },
          { status: 403 }
        );
      }
    }

    // 2. Authoritative Server-Side WhatsApp Reachability Verification Check
    // Format validation does NOT prove reachability; a consumed OTP row in Neon proves it.
    const verification = await assertPhoneVerifiedServerSide(cleanPhone, "signup", 15);
    if (!verification.verified && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          error:
            "Mobile number has not been verified via WhatsApp OTP. Format validation does not prove WhatsApp reachability; please complete WhatsApp verification.",
        },
        { status: 400 }
      );
    }

    // 3. Cryptographic password/PIN hashing using bcrypt
    const pinHash = await bcrypt.hash(data.pin, 10);

    const finalMapUrl =
      data.map_url || `https://www.google.com/maps?q=${data.latitude},${data.longitude}`;

    // 4. Atomic Database Insert into customer_accounts (with phone uniqueness constraint)
    try {
      const rows = await sql.query(
        `INSERT INTO customer_accounts (
           email, phone, pin_hash, name, delivery_address, locality, 
           landmark, delivery_instructions, latitude, longitude, map_url, 
           phone_verified_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
         RETURNING id, email, phone, name, delivery_address, locality, landmark, delivery_instructions, latitude, longitude, map_url, phone_verified_at, created_at, updated_at;`,
        [
          normEmail,
          cleanPhone,
          pinHash,
          data.name.trim(),
          data.delivery_address.trim(),
          data.locality.trim(),
          data.landmark ? data.landmark.trim() : null,
          data.delivery_instructions ? data.delivery_instructions.trim() : null,
          data.latitude,
          data.longitude,
          finalMapUrl,
        ]
      );

      const customer = rows[0];

      // 5. Establish secure signed HttpOnly session
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
          phone: customer.phone,
          name: customer.name,
          savedProfile: {
            customer_name: customer.name,
            customer_phone: customer.phone,
            delivery_address: customer.delivery_address,
            locality: customer.locality,
            landmark: customer.landmark,
            delivery_instructions: customer.delivery_instructions,
            latitude: Number(customer.latitude),
            longitude: Number(customer.longitude),
            map_url: customer.map_url,
            savedAt: customer.updated_at,
          },
        },
      });

      response.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      return response;
    } catch (dbErr: any) {
      // Postgres error code 23505 = unique_violation
      if (dbErr.code === "23505" || dbErr.message?.includes("duplicate key")) {
        return NextResponse.json(
          { error: "An account with this email address or mobile number already exists." },
          { status: 409 }
        );
      }
      console.error("[SIGNUP] Database error:", dbErr);
      return NextResponse.json(
        { error: "Failed to create account in database. Please try again." },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[SIGNUP] Server error:", error);
    return NextResponse.json(
      { error: error?.message || "Server error during registration." },
      { status: 500 }
    );
  }
}
