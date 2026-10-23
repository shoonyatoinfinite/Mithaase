"use client";

import React from "react";
import Link from "next/link";
import { StoreSettings } from "@/types";
import { Diya } from "@/components/animations/Diya";
import {
  AlertTriangle,
  Receipt,
  User,
  MapPin,
  Phone,
  Clock,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

interface StoreShutoffNoticeProps {
  settings: StoreSettings;
}

export function StoreShutoffNotice({ settings }: StoreShutoffNoticeProps) {
  const phone = settings.business_phone || "+91 9876543210";
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const address =
    settings.shop_address ||
    "Shop No. 12, Main Chowk, Kothal Kalan, Mahendragarh, Haryana 123029";
  const message =
    settings.shutoff_message ||
    "Our online shopping portal is currently permanently shut off. All product listings and new order bookings are disabled. Customers can log in to view past orders and official receipts.";

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
      <div className="relative p-6 sm:p-10 rounded-3xl bg-gradient-to-b from-[#2B0515] via-[#1F0426] to-[#12021A] border-2 border-[#D4AF37] shadow-[0_15px_60px_rgba(0,0,0,0.85)] text-center space-y-6 overflow-hidden">
        {/* Festive Golden Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#D4AF37] via-[#F5D061] to-[#D4AF37]" />

        {/* Diya & Emergency Shutoff Badge */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-[#4A0A1E] border-2 border-[#D4AF37] flex items-center justify-center shadow-[0_0_25px_rgba(212,175,55,0.4)]">
            <Diya size="sm" />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
            <span>Store Temporarily Shut Off • Shopping Disabled</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-serif font-black text-white">
            {settings.store_name || "Shree Shyam Sweets"}{" "}
            <span className="gold-gradient-text">Shopping Shut Off</span>
          </h2>
        </div>

        {/* Shutoff Message Card */}
        <div className="max-w-2xl mx-auto p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 text-xs sm:text-sm text-[#EAD8C7] leading-relaxed shadow-inner">
          <p className="font-semibold text-white/95 mb-1 text-sm">Notice to Valued Customers:</p>
          <p className="text-white/80">{message}</p>
        </div>

        {/* Key Allowed Actions Card: View Past Orders & Receipts */}
        <div className="max-w-xl mx-auto p-5 rounded-2xl bg-gradient-to-r from-purple-950/50 to-[#25072F] border border-[#D4AF37]/40 space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#F5D061] uppercase tracking-wider">
            <Receipt className="w-4 h-4 text-[#F5D061]" />
            <span>Customer Portal Accessible</span>
          </div>
          <p className="text-xs text-white/75 leading-relaxed">
            Existing customers can continue to log in with their email/PIN or Google account to view past orders, track past deliveries, and print tax receipts.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/orders"
              className="w-full sm:w-auto py-3 px-6 rounded-full gold-gradient-btn font-bold text-xs flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all text-[#16031E]"
            >
              <Receipt className="w-4 h-4 text-[#16031E]" />
              <span>View Past Orders & Receipts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              href="/checkout"
              className="w-full sm:w-auto py-3 px-6 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/20 transition-all active:scale-95"
            >
              <User className="w-3.5 h-3.5 text-[#F5D061]" />
              <span>Sign In / Profile</span>
            </Link>
          </div>
        </div>

        {/* Physical Shop Information */}
        <div className="max-w-lg mx-auto pt-2 border-t border-white/10 text-xs text-white/70 space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-white/80">
            <MapPin className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
            <span>{address}</span>
          </div>
          <div className="flex items-center justify-center gap-4 text-[11px] text-[#F5D061]">
            <a href={`tel:${cleanPhone}`} className="hover:underline flex items-center gap-1 font-mono">
              <Phone className="w-3 h-3" />
              <span>{phone}</span>
            </a>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Hours: {settings.operating_hours || "8:00 AM - 10:00 PM"}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
