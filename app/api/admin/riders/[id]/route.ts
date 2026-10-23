import { NextResponse } from "next/server";
import { updateRider, deleteRider, getRiderById } from "@/lib/data/store";

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const rider = await getRiderById(id);
    if (!rider) return NextResponse.json({ error: "Rider not found" }, { status: 404 });
    return NextResponse.json(rider);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch rider" }, { status: 500 });
  }
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const body = await req.json();
    const result = await updateRider(id, body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result.rider);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update rider" }, { status: 500 });
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const success = await deleteRider(id);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete rider" }, { status: 500 });
  }
}
