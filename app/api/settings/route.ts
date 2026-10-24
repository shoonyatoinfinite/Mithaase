import { NextResponse } from "next/server";
import { getStoreSettings, updateStoreSettings } from "@/lib/data/store";
import { broadcastRealtimeEvent } from "@/lib/events/broadcast";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const settings = await getStoreSettings();
    return NextResponse.json(settings, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
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
