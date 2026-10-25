import { NextResponse } from "next/server";
import { serverCache } from "@/lib/cache/server-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  let version = serverCache.get<string>("catalog_version");
  if (!version) {
    version = "1729880000"; // fallback baseline timestamp
    serverCache.set("catalog_version", version, 300, ["catalog"]);
  }

  return NextResponse.json(
    {
      version,
      timestamp: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
