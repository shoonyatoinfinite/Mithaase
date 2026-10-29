import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

/**
 * Serves a dynamic PNG QR Code for WhatsApp previews, customer downloads, and instant scanning.
 * Completely public with zero authentication gates so WhatsApp and customers can render the image directly.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderRef = (searchParams.get("orderRef") || `MTH-${Date.now().toString().slice(-6)}`).trim();
    const rawAmount = searchParams.get("amount") || "1";
    const amount = Math.max(1, Math.round(Number(rawAmount) || 1));
    const upiId = (
      searchParams.get("upiId") ||
      process.env.NEXT_PUBLIC_STORE_UPI_ID ||
      "shreeshyam@upi"
    ).trim();
    const payeeName = (
      searchParams.get("name") ||
      process.env.NEXT_PUBLIC_STORE_UPI_NAME ||
      "Shree Shyam Sweets"
    ).trim();

    const formattedAmount = amount.toFixed(2);
    const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
      payeeName
    )}&cu=INR&am=${formattedAmount}&tr=${encodeURIComponent(orderRef)}&tn=${encodeURIComponent(
      `Order ${orderRef}`
    )}`;

    const pngBuffer = await QRCode.toBuffer(upiUri, {
      type: "png",
      width: 480,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#16031E",
        light: "#FFFFFF",
      },
    });

    return new Response(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": pngBuffer.length.toString(),
        "Cache-Control": "public, max-age=600, s-maxage=600",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate QR image";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
