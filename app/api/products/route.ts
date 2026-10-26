import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getProducts, getAllProductsAdmin, createProduct } from "@/lib/data/store";
import { broadcastRealtimeEvent } from "@/lib/events/broadcast";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("category") || undefined;
    const admin = searchParams.get("admin") === "true";

    if (admin) {
      const products = await getAllProductsAdmin();
      return NextResponse.json(products, {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      });
    }

    const products = await getProducts(categoryId);
    return NextResponse.json(products, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { isAdminAuthenticated } = await import("@/lib/auth/session");
    if (!isAdminAuthenticated(req)) {
      return NextResponse.json({ error: "Unauthorized: Admin login required" }, { status: 401 });
    }
    const body = await req.json();
    if (!body.name || !body.description) {
      return NextResponse.json({ error: "Name and description are required" }, { status: 400 });
    }
    const created = await createProduct(body);

    try {
      revalidatePath("/", "page");
      revalidatePath("/admin/products", "page");
      revalidatePath("/api/products");
    } catch (err) {
      console.error("[API] revalidatePath error:", err);
    }

    broadcastRealtimeEvent("product_updated", created);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
