import { NextResponse } from "next/server";
import { sql } from "@/lib/neon/db";
import { serverCache } from "@/lib/cache/server-cache";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let dataBase64 = "";
    let mimeType = "image/jpeg";
    let fileName = "upload.jpg";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      dataBase64 = body.base64 || body.data || "";
      mimeType = body.mimeType || "image/jpeg";
      fileName = body.fileName || "upload.jpg";

      // Detect mime type if data URL
      const mimeMatch = dataBase64.match(/^data:([^;]+);base64,/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      dataBase64 = Buffer.from(arrayBuffer).toString("base64");
      mimeType = file.type || "image/jpeg";
      fileName = file.name || "upload.jpg";
    } else {
      return NextResponse.json({ error: "Unsupported Content-Type" }, { status: 400 });
    }

    if (!dataBase64) {
      return NextResponse.json({ error: "Empty image data" }, { status: 400 });
    }

    const cleanBase64 = dataBase64.replace(/^data:[^;]+;base64,/, "");
    const sizeBytes = Math.floor((cleanBase64.length * 3) / 4);

    // Limit single file size to 10MB
    if (sizeBytes > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 10MB maximum limit" }, { status: 400 });
    }

    const mediaId = crypto.randomUUID();

    if (sql) {
      // Auto-ensure table exists if newly created Neon branch
      await sql.query(`
        CREATE TABLE IF NOT EXISTS media_assets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          mime_type VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
          file_name VARCHAR(255),
          size_bytes INT NOT NULL DEFAULT 0,
          data_base64 TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `).catch(() => {});

      await sql.query(
        `INSERT INTO media_assets (id, mime_type, file_name, size_bytes, data_base64)
         VALUES ($1, $2, $3, $4, $5);`,
        [mediaId, mimeType, fileName, sizeBytes, cleanBase64]
      );
    }

    // Pre-seed server in-memory cache so subsequent reads don't even touch the database
    const buffer = Buffer.from(cleanBase64, "base64");
    serverCache.set(`media_${mediaId}`, { mimeType, buffer }, 3600, ["media"]);

    const url = `/api/media/${mediaId}`;
    return NextResponse.json({
      success: true,
      id: mediaId,
      url,
      size: sizeBytes,
      mimeType,
    });
  } catch (error: any) {
    console.error("[MEDIA_UPLOAD] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to upload media" }, { status: 500 });
  }
}
