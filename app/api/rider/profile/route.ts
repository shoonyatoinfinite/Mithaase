import { NextResponse } from "next/server";
import { getRiderById, updateRider } from "@/lib/data/store";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Rider ID required" }, { status: 400 });

    const rider = await getRiderById(id);
    if (!rider) return NextResponse.json({ error: "Rider not found" }, { status: 404 });

    const { pin: _pin, ...safeRider } = rider;
    return NextResponse.json(safeRider);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch rider profile" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, phone, vehicle_number, vehicle_type, pin } = body;
    if (!id) return NextResponse.json({ error: "Rider ID required" }, { status: 400 });

    // Note: Email is intentionally excluded to enforce "cannot change email" rule
    if (phone) {
      const cleanPhone = phone.trim().replace(/[^0-9]/g, "");
      if (cleanPhone.length !== 10) {
        return NextResponse.json({ error: "Rider mobile number must be exactly 10 digits." }, { status: 400 });
      }
    }

    if (pin && pin.trim().length > 0) {
      const cleanPin = pin.trim().replace(/[^0-9]/g, "");
      if (cleanPin.length !== 6) {
        return NextResponse.json({ error: "Rider security PIN must be exactly 6 digits." }, { status: 400 });
      }
    }

    const result = await updateRider(id, {
      name,
      phone: phone ? phone.trim().replace(/[^0-9]/g, "") : undefined,
      vehicle_number,
      vehicle_type,
      ...(pin && pin.trim() ? { pin: pin.trim().replace(/[^0-9]/g, "") } : {}),
    });

    if (!result.success || !result.rider) {
      return NextResponse.json({ error: result.error || "Failed to update rider profile" }, { status: 400 });
    }

    const { pin: _pin, ...safeRider } = result.rider;
    return NextResponse.json({ success: true, rider: safeRider });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update rider profile" }, { status: 500 });
  }
}
