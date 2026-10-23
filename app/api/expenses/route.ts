import { NextResponse } from "next/server";
import { getExpenses, createExpense } from "@/lib/data/store";
import { broadcastRealtimeEvent } from "@/lib/events/broadcast";

export async function GET() {
  try {
    const expenses = await getExpenses();
    return NextResponse.json(expenses);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.title || !body.amount) {
      return NextResponse.json({ error: "Title and amount are required" }, { status: 400 });
    }

    const created = await createExpense(body);
    broadcastRealtimeEvent("expense_created", created);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to record expense" }, { status: 500 });
  }
}
