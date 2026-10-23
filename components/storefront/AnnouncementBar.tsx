"use client";

import React, { useState, useEffect } from "react";
import { useStoreSettings } from "@/lib/context/store-context";
import { Sparkles, Phone, AlertCircle, X, Gift, Clock } from "lucide-react";

export function AnnouncementBar() {
  const { settings } = useStoreSettings();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = sessionStorage.getItem("mithaase_announcement_dismissed");
      if (dismissed === "true") setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("mithaase_announcement_dismissed", "true");
    }
  };

  if (isDismissed) return null;

  const isShutoff = Boolean(settings.store_shutoff || settings.store_status === "shutoff");
  const isClosed = isShutoff || settings.store_status !== "open" || !settings.accepts_orders;

  return (
    <aside
      aria-label="Announcement"
      className={`w-full ${
        isShutoff
          ? "bg-gradient-to-r from-red-950 via-[#3B0820] to-red-950 border-b border-red-500/40"
          : "bg-gradient-to-r from-[#3B0820] via-[#5A0E2B] to-[#3B0820] border-b border-[#D4AF37]/30"
      } text-xs py-2 px-3 sm:px-4 transition-all relative`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Festive Message / Alert */}
        <div className="flex items-center gap-2 text-[#FFF5E6] min-w-0 flex-1">
          {isShutoff ? (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
          ) : isClosed ? (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          ) : (
            <Sparkles className="w-4 h-4 text-[#F5D061] shrink-0" />
          )}
          <span className="font-medium truncate text-[11px] sm:text-xs">
            {isShutoff
              ? settings.shutoff_message || "Store is permanently shut off. Shopping disabled • Order history & receipts accessible."
              : isClosed
              ? settings.closure_message
              : settings.announcement_message}
          </span>
        </div>

        {/* Free First Delivery & Standard Flat Fee Offer with Cross Mark */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0 text-[#F5D061]">
          {/* First Delivery FREE Offer Badge (Hidden when store is shut off) */}
          {!isShutoff && (
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-[#2B0515]/90 to-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/40 text-[10px] sm:text-[11px] font-bold text-emerald-300 shadow-sm">
              <Gift className="w-3 h-3 text-[#F5D061] shrink-0" />
              <span>🎉 First Delivery FREE!</span>
              <span className="text-white/60 hidden md:inline">•</span>
              <span className="text-white/80 hidden md:inline">
                (Flat ₹{settings.default_delivery_fee} afterwards)
              </span>
              <span className="bg-[#D4AF37] text-[#16031E] px-1.5 py-0.2 rounded font-mono text-[9px] font-black hidden sm:inline ml-0.5">
                FREEDEL
              </span>
            </div>
          )}

          {/* Dynamic Shop Timing (Set by Admin) */}
          <div className="hidden lg:flex items-center gap-1.5 bg-black/30 px-2 py-0.5 rounded-full border border-white/10 text-[10px] sm:text-[11px] font-medium text-[#FFF8EE]">
            <Clock className="w-3 h-3 text-[#F5D061] shrink-0" />
            <span className="text-white/70">Shop Timing:</span>
            <span className="text-[#F5D061] font-bold">{settings.operating_hours}</span>
          </div>

          <a
            href={`tel:${settings.business_phone}`}
            className="hidden lg:flex items-center gap-1 hover:text-white transition-colors text-xs font-semibold"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>{settings.business_phone}</span>
          </a>

          {/* Dismiss Cross Mark Button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss announcement banner"
            className="p-1 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors shrink-0"
            title="Hide banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
