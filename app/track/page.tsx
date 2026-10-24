import React from "react";
import { Navbar } from "@/components/storefront/Navbar";
import { Footer } from "@/components/storefront/Footer";
import { OrderNotFoundFallback } from "@/components/orders/OrderNotFoundFallback";

export const dynamic = "force-dynamic";

export default function TrackPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#16031E] overflow-x-hidden">
      <Navbar />
      <main className="flex-1 pt-24 sm:pt-28 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <OrderNotFoundFallback searchedId="Enter Order ID" />
      </main>
      <Footer />
    </div>
  );
}
