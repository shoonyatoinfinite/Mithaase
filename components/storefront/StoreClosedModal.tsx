"use client";

import React from "react";
import Link from "next/link";
import { StoreSettings } from "@/types";
import { Diya } from "@/components/animations/Diya";
import {
  Store,
  Clock,
  MapPin,
  Phone,
  MessageCircle,
  ExternalLink,
  X,
  AlertTriangle,
  ArrowRight,
  ShoppingBag,
} from "lucide-react";

interface StoreClosedModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  customMessage?: string;
}

export function StoreClosedModal({
  isOpen,
  onClose,
  settings,
  customMessage,
}: StoreClosedModalProps) {
  if (!isOpen) return null;

  const phone = settings.business_phone || "+91 9876543210";
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const address =
    settings.shop_address ||
    "Shop No. 12, Main Chowk, Kothal Kalan, Mahendragarh, Haryana 123029";
  const mapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${settings.store_name || "Shree Shyam Sweets"}, ${address}`
  )}`;
  const hours = settings.operating_hours || "8:00 AM - 10:00 PM";
  const message =
    customMessage ||
    settings.closure_message ||
    "We are currently not accepting new online orders. Store will reopen for deliveries during operating hours.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-closed-title"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-gradient-to-b from-[#23042E] via-[#1A0324] to-[#110118] border-2 border-[#D4AF37] rounded-3xl p-6 sm:p-7 shadow-[0_10px_60px_rgba(0,0,0,0.9)] space-y-5 text-center relative my-auto">
        {/* Close Icon */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Diya / Header Badge */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-[#400B16] border-2 border-[#D4AF37] flex items-center justify-center shadow-[0_0_25px_rgba(212,175,55,0.4)]">
            <Diya size="sm" className="scale-90" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold tracking-wide">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Store Currently Closed for Online Orders</span>
          </div>
          <h2
            id="store-closed-title"
            className="text-2xl sm:text-3xl font-serif font-black text-white"
          >
            We Are Taking a <span className="gold-gradient-text">Short Break</span>
          </h2>
        </div>

        {/* Closure Message Box */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-[#EAD8C7] leading-relaxed text-left space-y-1.5 shadow-inner">
          <p className="font-semibold text-white/90">Store Status Notice:</p>
          <p className="text-white/80">{message}</p>
        </div>

        {/* Store Timings Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 to-[#1F0728] border border-[#D4AF37]/35 text-left space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#F5D061]">
            <Clock className="w-4 h-4 text-[#D4AF37]" />
            <span>New Opening Timings</span>
          </div>
          <div className="pl-6 space-y-1 text-xs">
            <p className="font-bold text-white text-sm">
              Daily Hours: <span className="text-[#F5D061] font-mono">{hours}</span>
            </p>
            <p className="text-white/60 text-[11px] leading-relaxed">
              Online booking and doorstep dispatch will resume during our next scheduled opening shift.
            </p>
          </div>
        </div>

        {/* Visit Shop Directly Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/30 to-[#1F0728] border border-amber-500/30 text-left space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Store className="w-4 h-4 text-amber-400" />
              <span>Kindly Visit Our Shop Directly</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30">
              Over-the-Counter Available
            </span>
          </div>

          <div className="pl-6 space-y-2">
            <div className="flex items-start gap-1.5 text-xs text-white/80">
              <MapPin className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
              <span className="leading-snug">{address}</span>
            </div>

            <div className="pt-1 flex flex-wrap gap-2">
              <a
                href={mapSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all active:scale-95"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#F5D061]" />
                <span>Open in Google Maps</span>
              </a>

              <a
                href={`tel:${cleanPhone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/30 transition-all active:scale-95"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Shop: {phone}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto flex-1 py-3 px-5 rounded-full gold-gradient-btn text-xs font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-[#16031E]" />
            <span>Browse Sweets Menu</span>
          </button>

          <a
            href={`https://wa.me/${cleanPhone.replace(/^0+/, "")}?text=${encodeURIComponent(
              `Namaste! I would like to enquire about sweets at ${settings.store_name || "Shree Shyam Sweets"}.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto py-3 px-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Chat on WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
}
