import { NextResponse } from "next/server";
import { getStoreSettings, updateStoreSettings } from "@/lib/data/store";
import { broadcastRealtimeEvent } from "@/lib/events/broadcast";

export async function GET() {
  try {
    const settings = await getStoreSettings();
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const updated = await updateStoreSettings(body);
    broadcastRealtimeEvent("settings_updated", updated);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
