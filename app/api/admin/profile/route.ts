import { NextResponse } from "next/server";
import { getAdminProfile, updateAdminProfile } from "@/lib/data/store";

export async function GET() {
  try {
    const profile = await getAdminProfile();
    const { pin: _pin, ...safeProfile } = profile;
    return NextResponse.json(safeProfile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch admin profile" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { name, phone, pin } = body;
    // Email is strictly non-editable
    if (phone) {
      const cleanPhone = phone.trim().replace(/[^0-9]/g, "");
      if (cleanPhone.length !== 10) {
        return NextResponse.json({ error: "Admin mobile number must be exactly 10 digits." }, { status: 400 });
      }
    }

    if (pin) {
      const cleanPin = pin.trim().replace(/[^0-9]/g, "");
      if (cleanPin.length !== 6) {
        return NextResponse.json({ error: "Admin Security PIN must be exactly 6 digits." }, { status: 400 });
      }
    }

    const result = await updateAdminProfile({ name, phone, pin });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const { pin: _pin, ...safeProfile } = result.profile!;
    return NextResponse.json({ success: true, profile: safeProfile });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update admin profile" }, { status: 500 });
  }
}
