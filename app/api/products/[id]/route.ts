import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getProductById, updateProduct } from "@/lib/data/store";
import { broadcastRealtimeEvent } from "@/lib/events/broadcast";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdminAuthenticated } = await import("@/lib/auth/session");
    if (!isAdminAuthenticated(req)) {
      return NextResponse.json({ error: "Unauthorized: Admin login required" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const updated = await updateProduct(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Invalidate Next.js cache so user-side pages immediately serve the updated price
    try {
      revalidatePath("/", "page");
      revalidatePath("/admin/products", "page");
      revalidatePath(`/product/${updated.slug}`, "page");
      revalidatePath("/api/products");
    } catch (err) {
      console.error("[API] revalidatePath error:", err);
    }

    // Broadcast realtime event to all listening user clients and admin dashboard
    broadcastRealtimeEvent("product_updated", updated);

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}
