import { NextResponse } from "next/server";
import { verifyWhatsAppOtp } from "@/lib/auth/otp-service";
import { createCustomerSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { sql } from "@/lib/neon/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = body.phone || body.mobileNumber || body.phoneNumber;
    const email = body.email ? String(body.email).trim().toLowerCase() : undefined;
    const cleanOtp = String(body.otp || "").trim();
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

    if (!cleanOtp) {
      return NextResponse.json({ error: "Verification code is required" }, { status: 400 });
    }

    // 1. If phone provided, verify WhatsApp OTP
    if (phone) {
      const result = await verifyWhatsAppOtp({
        rawPhone: phone,
        purpose: "signup",
        otp: cleanOtp,
        ip: clientIp,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        verified: true,
        mobileNumber: result.dbPhone,
        message: "WhatsApp verification completed successfully.",
      });
    }

    // 2. If email provided, verify from Neon DB phone_verifications table
    if (email && email.includes("@")) {
      if (!sql) {
        return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
      }

      const crypto = await import("crypto");
      const secret = process.env.YOUPI_OTP_SECRET || process.env.SESSION_SECRET || "mithaase_otp_secret";
      const expectedHmac = crypto.createHmac("sha256", secret).update(`${email}:${cleanOtp}:signup`).digest("hex");

      const rows = await sql.query(
        `SELECT id, otp_hash, expires_at, attempts, consumed_at 
         FROM phone_verifications 
         WHERE phone = $1 AND purpose = 'signup' 
         ORDER BY created_at DESC LIMIT 1;`,
        [email]
      );

      if (!rows || rows.length === 0 || rows[0].consumed_at) {
        return NextResponse.json({ error: "No active verification code found or already used." }, { status: 400 });
      }

      const record = rows[0];
      if (new Date() > new Date(record.expires_at)) {
        return NextResponse.json({ error: "Verification code has expired. Please request a new code." }, { status: 400 });
      }

      if (record.otp_hash !== expectedHmac) {
        await sql.query(`UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = $1;`, [record.id]);
        return NextResponse.json({ error: "Incorrect verification code. Please check and try again." }, { status: 400 });
      }

      await sql.query(`UPDATE phone_verifications SET consumed_at = NOW() WHERE id = $1;`, [record.id]);

      // Check if user already has an account
      const custRows = await sql.query(
        `SELECT id, email, phone, name, delivery_address, locality, landmark, delivery_instructions, latitude, longitude, map_url, phone_verified_at 
         FROM customer_accounts 
         WHERE LOWER(email) = $1 LIMIT 1;`,
        [email]
      );

      let responsePayload: any = {
        success: true,
        verified: true,
        email,
      };

      let token: string | null = null;
      if (custRows && custRows.length > 0) {
        const cust = custRows[0];
        responsePayload.user = {
          id: cust.id,
          email: cust.email,
          phone: cust.phone,
          name: cust.name,
          savedProfile: {
            customer_name: cust.name,
            customer_phone: cust.phone,
            delivery_address: cust.delivery_address,
            locality: cust.locality,
            landmark: cust.landmark,
            delivery_instructions: cust.delivery_instructions,
            latitude: cust.latitude ? Number(cust.latitude) : 28.1907,
            longitude: cust.longitude ? Number(cust.longitude) : 76.1624,
            map_url: cust.map_url,
          },
        };

        token = await createCustomerSession({
          userId: cust.id,
          phone: cust.phone,
          email: cust.email,
        });
      }

      const response = NextResponse.json(responsePayload);
      if (token) {
        response.cookies.set(SESSION_COOKIE_NAME, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 30 * 24 * 60 * 60,
        });
      }

      return response;
    }

    return NextResponse.json({ error: "Please provide a valid mobile number or email address." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Server error verifying code" }, { status: 500 });
  }
}
