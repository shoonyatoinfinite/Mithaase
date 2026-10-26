import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/neon/db";
import { getCustomerSessionFromRequest } from "@/lib/auth/session";
import { normalizeAndValidateWhatsAppPhone } from "@/lib/utils/phone";
import { assertPhoneVerifiedServerSide } from "@/lib/auth/otp-service";

export const dynamic = "force-dynamic";

const UpdateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long.").optional(),
  phone: z.string().min(10).optional(),
  delivery_address: z.string().min(4, "Address must be at least 4 characters long.").optional(),
  locality: z.string().min(2, "Locality is required.").optional(),
  landmark: z.string().optional(),
  delivery_instructions: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  map_url: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getCustomerSessionFromRequest(req);
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: "Unauthorized: Active customer session required." },
        { status: 401 }
      );
    }

    if (!sql) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const rows = await sql.query(
      `SELECT id, email, phone, name, delivery_address, locality, landmark, delivery_instructions, latitude, longitude, map_url, phone_verified_at, created_at, updated_at
       FROM customer_accounts 
       WHERE id = $1 
       LIMIT 1;`,
      [session.userId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Customer account not found" }, { status: 404 });
    }

    const customer = rows[0];
    return NextResponse.json({
      success: true,
      user: {
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
          landmark: customer.landmark || undefined,
          delivery_instructions: customer.delivery_instructions || undefined,
          latitude: customer.latitude ? Number(customer.latitude) : 28.1907,
          longitude: customer.longitude ? Number(customer.longitude) : 76.1624,
          map_url: customer.map_url || "",
          savedAt: customer.updated_at,
        },
      },
    });
  } catch (error: any) {
    console.error("[PROFILE_GET] Error:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getCustomerSessionFromRequest(req);
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: "Unauthorized: Active customer session required." },
        { status: 401 }
      );
    }

    if (!sql) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const body = await req.json();
    const parse = UpdateProfileSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.issues[0]?.message || "Invalid input data." },
        { status: 400 }
      );
    }

    const data = parse.data;

    // Fetch current user record to compare phone changes
    const currentRows = await sql.query(
      `SELECT id, phone FROM customer_accounts WHERE id = $1 LIMIT 1;`,
      [session.userId]
    );

    if (!currentRows || currentRows.length === 0) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const currentCustomer = currentRows[0];
    let newCleanPhone = currentCustomer.phone;
    let phoneChanged = false;

    if (data.phone) {
      const phoneValidation = normalizeAndValidateWhatsAppPhone(data.phone);
      if (!phoneValidation.isValid) {
        return NextResponse.json({ error: phoneValidation.error }, { status: 400 });
      }

      if (phoneValidation.dbFormat !== currentCustomer.phone) {
        phoneChanged = true;
        newCleanPhone = phoneValidation.dbFormat;

        // Atomically require consumed WhatsApp OTP verification for new phone number
        const verification = await assertPhoneVerifiedServerSide(newCleanPhone, "change", 15);
        if (!verification.verified && process.env.NODE_ENV === "production") {
          return NextResponse.json(
            {
              error:
                "Changing your mobile number requires completing WhatsApp OTP verification for the new number.",
            },
            { status: 400 }
          );
        }
      }
    }

    // Direct, live parameterized UPDATE on Neon PostgreSQL
    try {
      const rows = await sql.query(
        `UPDATE customer_accounts SET
           name = COALESCE($1, name),
           phone = $2,
           delivery_address = COALESCE($3, delivery_address),
           locality = COALESCE($4, locality),
           landmark = COALESCE($5, landmark),
           delivery_instructions = COALESCE($6, delivery_instructions),
           latitude = COALESCE($7, latitude),
           longitude = COALESCE($8, longitude),
           map_url = COALESCE($9, map_url),
           phone_verified_at = CASE WHEN $10 = true THEN NOW() ELSE phone_verified_at END,
           updated_at = NOW()
         WHERE id = $11
         RETURNING id, email, phone, name, delivery_address, locality, landmark, delivery_instructions, latitude, longitude, map_url, phone_verified_at, updated_at;`,
        [
          data.name ? data.name.trim() : null,
          newCleanPhone,
          data.delivery_address ? data.delivery_address.trim() : null,
          data.locality ? data.locality.trim() : null,
          data.landmark ? data.landmark.trim() : null,
          data.delivery_instructions ? data.delivery_instructions.trim() : null,
          data.latitude !== undefined ? data.latitude : null,
          data.longitude !== undefined ? data.longitude : null,
          data.map_url || null,
          phoneChanged,
          session.userId,
        ]
      );

      const updated = rows[0];
      return NextResponse.json({
        success: true,
        user: {
          id: updated.id,
          email: updated.email,
          phone: updated.phone,
          name: updated.name,
          phone_verified_at: updated.phone_verified_at,
          savedProfile: {
            customer_name: updated.name,
            customer_phone: updated.phone,
            delivery_address: updated.delivery_address,
            locality: updated.locality,
            landmark: updated.landmark || undefined,
            delivery_instructions: updated.delivery_instructions || undefined,
            latitude: Number(updated.latitude),
            longitude: Number(updated.longitude),
            map_url: updated.map_url || "",
            savedAt: updated.updated_at,
          },
        },
      });
    } catch (err: any) {
      if (err.code === "23505" || err.message?.includes("duplicate key")) {
        return NextResponse.json(
          { error: "This mobile number is already in use by another account." },
          { status: 409 }
        );
      }
      console.error("[PROFILE_PUT] DB error:", err);
      return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[PROFILE_PUT] Server error:", error);
    return NextResponse.json({ error: "Server error updating profile." }, { status: 500 });
  }
}
