import { NextResponse } from "next/server";
import { sql } from "@/lib/neon/db";
import { serverCache } from "@/lib/cache/server-cache";
import {
  isAdminAuthenticated,
  isRiderAuthenticated,
  getCustomerSessionFromRequest,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id.length < 5) {
      return new NextResponse("Invalid Media ID", { status: 400 });
    }

    if (!sql) {
      return new NextResponse("Database unavailable", { status: 503 });
    }

    // 1. Fetch media metadata first (never select huge data_base64 until authorization passes)
    const metaRows = await sql.query(
      `SELECT id, mime_type, file_name, size_bytes FROM media_assets WHERE id = $1 LIMIT 1;`,
      [id]
    );

    if (!metaRows || metaRows.length === 0) {
      return new NextResponse("Media Not Found", { status: 404 });
    }

    const meta = metaRows[0];
    const fileName = (meta.file_name || "").toLowerCase();
    const isSensitive =
      fileName.includes("upi") ||
      fileName.includes("payment") ||
      fileName.includes("delivery") ||
      fileName.includes("pickup") ||
      fileName.includes("refund");

    // 2. Authorization Check for Sensitive Photos (UPI Receipts, Delivery Proofs)
    if (isSensitive) {
      const isAdmin = isAdminAuthenticated(req);
      const isRider = isRiderAuthenticated(req);
      const customerSession = await getCustomerSessionFromRequest(req);

      if (!isAdmin && !isRider) {
        if (!customerSession) {
          return new NextResponse("Unauthorized: Login required to access transaction media.", { status: 401 });
        }

        // Verify order ownership in Neon DB
        const mediaUrl = `/api/media/${id}`;
        const ownerCheck = await sql.query(
          `SELECT id FROM orders 
           WHERE (upi_screenshot = $1 OR delivery_proof_photo = $1 OR pickup_photo = $1 OR refund_screenshot = $1)
             AND (LOWER(customer_email) = $2 OR customer_phone = $3)
           LIMIT 1;`,
          [mediaUrl, customerSession.email.toLowerCase(), customerSession.phone]
        );

        if (!ownerCheck || ownerCheck.length === 0) {
          return new NextResponse("Access Denied: You do not own this order media.", { status: 403 });
        }
      }
    }

    // 3. ETag support for browser caching
    const clientEtag = req.headers.get("if-none-match");
    if (clientEtag && clientEtag.includes(id)) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "Cache-Control": isSensitive ? "private, no-cache, no-store" : "public, max-age=31536000, immutable",
          ETag: `"${id}"`,
        },
      });
    }

    // 4. Retrieve data_base64
    const cacheKey = `media_${id}`;
    let cached = serverCache.get<{ mimeType: string; buffer: Buffer }>(cacheKey);

    if (!cached) {
      const dataRows = await sql.query(
        `SELECT data_base64 FROM media_assets WHERE id = $1 LIMIT 1;`,
        [id]
      );

      if (!dataRows || dataRows.length === 0) {
        return new NextResponse("Media data not found", { status: 404 });
      }

      const cleanBase64 = (dataRows[0].data_base64 || "").replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");
      const mimeType = meta.mime_type || "image/jpeg";

      cached = { mimeType, buffer };
      if (!isSensitive) {
        serverCache.set(cacheKey, cached, 3600, ["media"]);
      }
    }

    return new NextResponse(cached.buffer as any, {
      status: 200,
      headers: {
        "Content-Type": cached.mimeType,
        "Content-Length": cached.buffer.length.toString(),
        "Cache-Control": isSensitive ? "private, no-cache, no-store, must-revalidate" : "public, max-age=31536000, immutable",
        ETag: `"${id}"`,
      },
    });
  } catch (error: any) {
    console.error("[MEDIA] Fetch error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
