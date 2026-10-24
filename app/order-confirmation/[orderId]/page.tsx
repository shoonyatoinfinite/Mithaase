import React from "react";
import Link from "next/link";
import { getOrderById, getStoreSettings } from "@/lib/data/store";
import { Navbar } from "@/components/storefront/Navbar";
import { Footer } from "@/components/storefront/Footer";
import { LiveOrderTracker } from "@/components/orders/LiveOrderTracker";
import { OrderNotFoundFallback } from "@/components/orders/OrderNotFoundFallback";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const decodedId = decodeURIComponent(orderId || "").trim();
  const order = await getOrderById(decodedId);
  const settings = await getStoreSettings();

  return (
    <div className="min-h-screen flex flex-col bg-[#16031E] overflow-x-hidden">
      <Navbar />

      <main className="flex-1 pt-24 sm:pt-28 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        {order ? (
          <>
            {/* Live Order Tracker with Real-Time Dynamic Status Heading & Official Receipt */}
            <div className="mb-10">
              <LiveOrderTracker initialOrder={order} settings={settings} />
            </div>

            {/* Back to Home CTA */}
            <div className="text-center pt-4">
              <Link
                href="/#shop"
                className="inline-flex items-center gap-2 gold-gradient-btn px-8 py-3.5 rounded-full text-sm font-bold shadow-xl active:scale-95 transition-all"
              >
                <span>Return to Home & Shop More</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </>
        ) : (
          <OrderNotFoundFallback searchedId={decodedId} />
        )}
      </main>

      <Footer />
    </div>
  );
}
