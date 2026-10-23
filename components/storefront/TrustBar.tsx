"use client";

import React from "react";
import { Truck, Banknote, Smartphone, Clock, Sparkles } from "lucide-react";

export function TrustBar() {
  const items = [
    {
      icon: Truck,
      title: "Local Delivery",
      desc: "Flat ₹21 delivery fee to your doorstep in town",
    },
    {
      icon: Banknote,
      title: "Cash on Delivery",
      desc: "Inspect your fresh sweets and pay in cash",
    },
    {
      icon: Smartphone,
      title: "Direct UPI Accepted",
      desc: "Fast QR scan or UPI handle payment",
    },
    {
      icon: Clock,
      title: "Same-Day Delivery",
      desc: "Subject to daily batch availability and slot cutoff",
    },
  ];

  return (
    <section className="relative z-20 -mt-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 rounded-2xl bg-gradient-to-r from-[#2B0836] via-[#380A2B] to-[#2B0836] border border-[#D4AF37]/35 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        {items.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="flex items-start gap-3.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#FF6F00]/20 flex items-center justify-center shrink-0 border border-[#D4AF37]/30">
                <Icon className="w-5 h-5 text-[#F5D061]" />
              </div>
              <div className="flex flex-col">
                <h4 className="text-sm font-bold text-[#FFF8EE] flex items-center gap-1.5">
                  <span>{item.title}</span>
                </h4>
                <p className="text-xs text-[#D3BEB0] mt-0.5 leading-snug">
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
