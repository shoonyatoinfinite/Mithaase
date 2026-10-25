import { NextResponse } from "next/server";
import { sql } from "@/lib/neon/db";
import { serverCache } from "@/lib/cache/server-cache";

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

    // Check If-None-Match for 304 Not Modified
    const clientEtag = req.headers.get("if-none-match");
    if (clientEtag && clientEtag.includes(id)) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
          ETag: `"${id}"`,
        },
      });
    }

    // Check server in-memory cache first to avoid Neon query
    const cacheKey = `media_${id}`;
    let cached = serverCache.get<{ mimeType: string; buffer: Buffer }>(cacheKey);

    if (!cached) {
      if (!sql) {
        return new NextResponse("Database unavailable", { status: 503 });
      }

      const rows = await sql.query(
        `SELECT mime_type, data_base64 FROM media_assets WHERE id = $1 LIMIT 1;`,
        [id]
      );

      if (!rows || rows.length === 0) {
        return new NextResponse("Media Not Found", { status: 404 });
      }

      const row = rows[0];
      const cleanBase64 = (row.data_base64 || "").replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");
      const mimeType = row.mime_type || "image/jpeg";

      cached = { mimeType, buffer };
      // Cache media binary in memory for 1 hour
      serverCache.set(cacheKey, cached, 3600, ["media"]);
    }

    return new NextResponse(cached.buffer as any, {
      status: 200,
      headers: {
        "Content-Type": cached.mimeType,
        "Content-Length": cached.buffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: `"${id}"`,
      },
    });
  } catch (error: any) {
    console.error("[MEDIA] Fetch error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
