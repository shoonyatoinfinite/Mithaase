"use client";

import React from "react";
import { useStoreSettings } from "@/lib/context/store-context";
import { Diya } from "@/components/animations/Diya";
import { MessageSquare, Phone, X, AlertTriangle, Sparkles, Truck, ShieldCheck, Scale } from "lucide-react";

interface BulkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWeightKg?: number;
}

export function BulkOrderModal({ isOpen, onClose, currentWeightKg = 20 }: BulkOrderModalProps) {
  const { settings } = useStoreSettings();

  if (!isOpen) return null;

  const cleanPhone = settings.whatsapp_number.replace(/[^0-9]/g, "");
  const whatsappBulkUrl = `https://wa.me/${cleanPhone}?text=Hello%20Shree%20Shyam%20Sweets,%20I%20am%20looking%20to%20place%20a%20bulk%20Diwali%20order%20exceeding%2020kg.%20Please%20share%20your%20wholesale%20rates%20and%20delivery%20options.`;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#1C0324] border-2 border-[#D4AF37]/50 shadow-[0_10px_50px_rgba(0,0,0,0.85)] overflow-hidden my-auto p-6 sm:p-8 space-y-6 text-center">
        {/* Top Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Diya & Scale Icon */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#580E1E] to-[#2B0938] border-2 border-[#D4AF37] flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(212,175,55,0.4)]">
          <Scale className="w-8 h-8 text-[#F5D061]" />
        </div>

        {/* Heading */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[#F5D061] text-[11px] font-bold uppercase tracking-wider mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>20 kg Max Order Limit Reached</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-black text-[#FFF8EE]">
            Need a <span className="gold-gradient-text">Bulk Sweet Order?</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#D3BEB0] mt-2 leading-relaxed">
            Our standard online express delivery is capped at <strong>20 kg</strong> per order to ensure maximum freshness and careful handling on our bikes & scooters.
          </p>
        </div>

        {/* Weight Status Gauge */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-white/60 font-semibold">Current Order Weight:</span>
            <span className="text-[#F5D061] font-bold font-mono text-sm">
              {currentWeightKg.toFixed(1)} kg / 20 kg Max
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-rose-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (currentWeightKg / 20) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-white/50 mt-2 text-left">
            For corporate gifting, marriage functions, or community Diwali pooja orders over 20 kg, please reach out to us directly for dedicated van transport and special festive pricing!
          </p>
        </div>

        {/* Contact CTAs */}
        <div className="space-y-2.5">
          <a
            href={whatsappBulkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-[#092211] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all text-center"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Inquire Bulk Order on WhatsApp</span>
          </a>

          <a
            href={`tel:${settings.business_phone}`}
            className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all text-center"
          >
            <Phone className="w-4 h-4 text-[#F5D061]" />
            <span>Call Shop Directly: {settings.business_phone}</span>
          </a>
        </div>

        <button
          onClick={onClose}
          className="text-xs text-[#D3BEB0] hover:text-white underline transition-colors"
        >
          Continue Shopping with Existing Cart
        </button>
      </div>
    </div>
  );
}
