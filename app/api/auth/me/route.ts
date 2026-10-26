import { NextResponse } from "next/server";
import { getCustomerSessionFromRequest, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { sql } from "@/lib/neon/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getCustomerSessionFromRequest(req);
    if (!session || !session.userId) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    // Direct, live query to Neon PostgreSQL (no serverCache, no in-memory store)
    const rows = await sql.query(
      `SELECT id, email, phone, name, delivery_address, locality, landmark, delivery_instructions, latitude, longitude, map_url, phone_verified_at, created_at, updated_at
       FROM customer_accounts 
       WHERE id = $1 
       LIMIT 1;`,
      [session.userId]
    );

    if (!rows || rows.length === 0) {
      // User was deleted from DB; clear invalid session cookie
      const res = NextResponse.json({ authenticated: false, user: null }, { status: 401 });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    const c = rows[0];

    const safeUser = {
      id: c.id,
      email: c.email,
      phone: c.phone,
      name: c.name,
      phone_verified_at: c.phone_verified_at ? new Date(c.phone_verified_at).toISOString() : null,
      savedProfile: {
        customer_name: c.name,
        customer_phone: c.phone,
        delivery_address: c.delivery_address,
        locality: c.locality,
        landmark: c.landmark || undefined,
        delivery_instructions: c.delivery_instructions || undefined,
        latitude: c.latitude ? Number(c.latitude) : 28.1907,
        longitude: c.longitude ? Number(c.longitude) : 76.1624,
        map_url: c.map_url || "",
        savedAt: c.updated_at || c.created_at,
      },
    };

    return NextResponse.json({
      authenticated: true,
      user: safeUser,
    });
  } catch (error: any) {
    console.error("[AUTH_ME] Error:", error);
    return NextResponse.json({ error: "Server error fetching user profile" }, { status: 500 });
  }
}
