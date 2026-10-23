import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById, getStoreSettings } from "@/lib/data/store";
import { AnnouncementBar } from "@/components/storefront/AnnouncementBar";
import { Navbar } from "@/components/storefront/Navbar";
import { Footer } from "@/components/storefront/Footer";
import { Diya } from "@/components/animations/Diya";
import { LiveOrderTracker } from "@/components/orders/LiveOrderTracker";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getOrderById(orderId);
  const settings = await getStoreSettings();

  if (!order) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#16031E] overflow-x-hidden">
      <Navbar />

      <main className="flex-1 pt-24 sm:pt-28 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        {/* Live Order Tracker with Real-Time Dynamic Status Heading & Official Receipt */}
        <div className="mb-10">
          <LiveOrderTracker initialOrder={order} settings={settings} />
        </div>

        {/* Back to Home CTA */}
        <div className="text-center pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 gold-gradient-btn px-8 py-3.5 rounded-full text-sm font-bold shadow-xl active:scale-95 transition-all"
          >
            <span>Return to Home & Shop More</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
