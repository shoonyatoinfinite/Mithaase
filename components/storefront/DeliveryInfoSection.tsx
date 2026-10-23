"use client";

import React from "react";
import { useStoreSettings } from "@/lib/context/store-context";
import { Truck, MapPin, Clock, ShieldCheck, IndianRupee } from "lucide-react";

export function DeliveryInfoSection() {
  const { settings } = useStoreSettings();

  return (
    <section id="delivery-info" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="rounded-3xl bg-gradient-to-br from-[#24062E] via-[#2F083C] to-[#1C0526] border border-[#D4AF37]/35 p-8 sm:p-12 shadow-2xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Details */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#580E1E] border border-[#D4AF37]/40 text-[#F5D061] text-xs font-bold uppercase tracking-wider mb-4">
              <Truck className="w-3.5 h-3.5" />
              <span>Doorstep Delivery Policy</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#FFF8EE] mb-4">
              Fast Local Delivery for Just <span className="gold-gradient-text">₹{settings.default_delivery_fee}</span>
            </h2>
            <p className="text-sm sm:text-base text-[#D3BEB0] leading-relaxed mb-6">
              During the festive rush of Diwali, avoid crowded markets and long queues. We deliver fresh sweets directly to your doorstep in food-safe sealed gift boxes.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10">
                <IndianRupee className="w-5 h-5 text-[#F5D061] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-white">Flat ₹{settings.default_delivery_fee} Per Order</h4>
                  <p className="text-xs text-[#D3BEB0] mt-0.5">Fixed nominal charge regardless of quantity or box weight.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10">
                <Clock className="w-5 h-5 text-[#F5D061] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-white">Hours & Cutoff</h4>
                  <p className="text-xs text-[#D3BEB0] mt-0.5">{settings.operating_hours}. Orders accepted until {settings.cutoff_time}.</p>
                </div>
              </div>
            </div>

            {/* Service Areas Chips */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2.5 block flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#F5D061]" />
                <span>Active Delivery Localities in Town</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {settings.service_areas.map((area, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-full bg-[#16031E] border border-[#D4AF37]/30 text-xs font-medium text-[#FFF8EE]"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Highlights Card */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="p-6 rounded-2xl bg-[#16031E]/80 border border-[#D4AF37]/30 backdrop-blur-md">
              <h4 className="text-base font-serif font-bold text-[#F5D061] mb-2 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
                <span>Hygiene & Safe Packaging</span>
              </h4>
              <p className="text-xs text-[#D3BEB0] leading-relaxed mb-4">
                All sweets are packed with food-grade protective inner liners and placed into gold-embossed boxes to preserve aroma and prevent damage during transit.
              </p>
              <div className="flex items-center justify-between text-xs font-semibold text-white/80 pt-3 border-t border-white/10">
                <span>Same-day Dispatch:</span>
                <span className={settings.same_day_delivery_enabled ? "text-emerald-400 font-bold" : "text-amber-400"}>
                  {settings.same_day_delivery_enabled ? "Available Today" : "Subject to slot capacity"}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-r from-[#580E1E] to-[#3B0820] border border-[#D4AF37]/40 text-center">
              <p className="text-xs text-[#FFF8EE]">
                Have a bulk order for family or society? Call us directly at{" "}
                <a href={`tel:${settings.business_phone}`} className="font-bold text-[#F5D061] underline">
                  {settings.business_phone}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
