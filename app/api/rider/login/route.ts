import { NextResponse } from "next/server";
import { verifyRiderLogin } from "@/lib/data/store";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { identifier, pin } = body;

    const result = await verifyRiderLogin(identifier, pin);
    if (!result.success || !result.rider) {
      return NextResponse.json({ error: result.error || "Invalid Rider credentials." }, { status: 401 });
    }

    const { pin: _pin, ...safeRider } = result.rider;

    const response = NextResponse.json({
      success: true,
      rider: safeRider,
    });

    response.cookies.set("mithaase_rider_session", encodeURIComponent(safeRider.id), {
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Rider login error." }, { status: 500 });
  }
}
