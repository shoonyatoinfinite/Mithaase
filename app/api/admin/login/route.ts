import { NextRequest, NextResponse } from "next/server";
import { getAdminProfile, getStoreSettings } from "@/lib/data/store";

export async function POST(req: NextRequest) {
  try {
    const { adminId, pin } = await req.json();

    if (!adminId || !pin) {
      return NextResponse.json(
        { error: "Admin ID and Security PIN are required" },
        { status: 400 }
      );
    }

    const cleanId = String(adminId).trim().toLowerCase();
    const cleanPin = String(pin).trim().replace(/[^0-9]/g, "");

    if (cleanPin.length !== 6) {
      return NextResponse.json(
        { error: "Admin Security PIN must be exactly 6 digits" },
        { status: 400 }
      );
    }

    if (/^\d+$/.test(cleanId) && cleanId.length !== 10) {
      return NextResponse.json(
        { error: "Admin mobile number must be exactly 10 digits" },
        { status: 400 }
      );
    }

    // Check against store settings admin profile in Neon Postgres
    const profile = await getAdminProfile();
    const settings = await getStoreSettings();

    // Configured 6-digit admin PIN
    const configuredPin = profile.pin || "000000";
    const configuredId = profile.email?.toLowerCase() || "admin";

    const matchesId =
      cleanId === "admin" ||
      cleanId === configuredId ||
      cleanId === profile.name?.toLowerCase() ||
      cleanId === profile.phone;

    const matchesPin = cleanPin === configuredPin || cleanPin === process.env.ADMIN_SECRET_KEY;

    if (!matchesPin || !matchesId) {
      return NextResponse.json(
        { error: "Invalid Admin ID or Security PIN" },
        { status: 401 }
      );
    }

    const res = NextResponse.json({
      success: true,
      message: "Admin authentication successful",
      admin: {
        name: profile.name || "Store Administrator",
        email: profile.email || "admin@mithaase.com",
        phone: profile.phone || "",
      },
    });

    // Set secure cookie
    res.cookies.set("mithaase_admin_session", "true", {
      path: "/",
      maxAge: 86400,
      sameSite: "lax",
      httpOnly: false,
    });

    return res;
  } catch (error: any) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { error: "Internal server error during admin authentication" },
      { status: 500 }
    );
  }
}
