import { NextResponse } from "next/server";
import { getRiders, createRider } from "@/lib/data/store";
import { isAdminAuthenticated } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    if (!isAdminAuthenticated(req)) {
      return NextResponse.json({ error: "Unauthorized: Admin login required" }, { status: 401 });
    }
    const riders = await getRiders();
    return NextResponse.json(riders);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch riders" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!isAdminAuthenticated(req)) {
      return NextResponse.json({ error: "Unauthorized: Admin login required" }, { status: 401 });
    }
    const body = await req.json();
    const result = await createRider(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result.rider, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create rider" }, { status: 500 });
  }
}
