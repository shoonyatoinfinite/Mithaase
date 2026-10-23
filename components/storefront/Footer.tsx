"use client";

import React from "react";
import Link from "next/link";
import { useStoreSettings } from "@/lib/context/store-context";
import { Diya } from "@/components/animations/Diya";
import { Phone, MapPin, Clock, MessageSquare, Shield, Heart, Bike } from "lucide-react";

export function Footer() {
  const { settings } = useStoreSettings();
  const cleanPhone = settings.whatsapp_number.replace(/[^0-9]/g, "");
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=Hello%20Shree%20Shyam%20Sweets,%20I%20would%20like%20to%20inquire%20about%20Diwali%20sweets.`;

  return (
    <footer className="w-full bg-[#100117] border-t border-[#D4AF37]/20 pt-16 pb-12 text-[#D3BEB0] text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-white/10">
          {/* Brand Info */}
          <div className="lg:col-span-4 flex flex-col items-start">
            <Link href="/" className="flex items-center gap-3 mb-4 group">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#3B0820] border border-[#D4AF37]">
                <Diya size="sm" className="scale-75" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-serif font-black tracking-wider text-[#FFF8EE] group-hover:text-[#F5D061] transition-colors">
                  Mithaasé
                </span>
                <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold">
                  {settings.store_name}
                </span>
              </div>
            </Link>

            <p className="text-xs text-[#D3BEB0] leading-relaxed mb-6">
              Authentic Indian festival sweets prepared with 100% pure desi ghee, fresh mawa, and timeless halwai craftsmanship. Delivered straight to your doorstep for Diwali.
            </p>

            {/* WhatsApp Direct Action Button */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-[#0A2612] px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat on WhatsApp</span>
            </a>
          </div>

          {/* Quick Nav Links */}
          <div className="lg:col-span-2">
            <h4 className="text-sm font-serif font-bold text-[#FFF8EE] mb-4">Navigation</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/" className="hover:text-[#F5D061] transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <a href="#shop" className="hover:text-[#F5D061] transition-colors">
                  Shop Sweets
                </a>
              </li>
              <li>
                <a href="#diwali-specials" className="hover:text-[#F5D061] transition-colors">
                  Diwali Hampers
                </a>
              </li>
              <li>
                <a href="#delivery-info" className="hover:text-[#F5D061] transition-colors">
                  Delivery Policy
                </a>
              </li>
              <li>
                <Link href="/cart" className="hover:text-[#F5D061] transition-colors">
                  View Cart
                </Link>
              </li>
              <li>
                <Link href="/orders" className="hover:text-[#F5D061] text-amber-300 font-semibold transition-colors">
                  My Orders & Receipts 🧾
                </Link>
              </li>
            </ul>
          </div>

          {/* Shop Timings & Status */}
          <div className="lg:col-span-3">
            <h4 className="text-sm font-serif font-bold text-[#FFF8EE] mb-4">Hours & Operations</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-[#F5D061] shrink-0 mt-0.5" />
                <div>
                  <span className="text-white font-medium block">Counter Hours:</span>
                  <span>{settings.operating_hours}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-white font-medium block">Daily Order Cutoff:</span>
                  <span>{settings.cutoff_time} (Same-day dispatch)</span>
                </div>
              </div>

              <div className="pt-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      settings.store_status === "open" ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                    }`}
                  />
                  <span className="capitalize font-semibold text-white">
                    Store: {settings.store_status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Details & Address */}
          <div className="lg:col-span-3">
            <h4 className="text-sm font-serif font-bold text-[#FFF8EE] mb-4">Contact & Location</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#F5D061] shrink-0 mt-0.5" />
                <span>{settings.shop_address}</span>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-[#F5D061] shrink-0 mt-0.5" />
                <a href={`tel:${settings.business_phone}`} className="hover:text-white transition-colors">
                  {settings.business_phone}
                </a>
              </div>

              <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-[#D3BEB0]">
                Flat ₹{settings.default_delivery_fee} delivery charge applied at checkout.
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Admin Link */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <p className="text-[11px] text-[#D3BEB0]/70 flex items-center justify-center gap-1">
            <span>© 2026 {settings.store_name}. Crafted with</span>
            <Heart className="w-3 h-3 text-red-500 fill-red-500 inline" />
            <span>for Diwali Celebrations.</span>
          </p>

          <div className="flex items-center gap-5 text-[11px]">
            <Link
              href="/rider"
              className="text-[#D3BEB0]/70 hover:text-[#F5D061] flex items-center gap-1.5 transition-colors font-medium"
            >
              <Bike className="w-3.5 h-3.5 text-amber-400" />
              <span>Rider Portal</span>
            </Link>
            <span className="text-white/20">•</span>
            <Link
              href="/admin/login"
              className="text-[#D3BEB0]/70 hover:text-[#F5D061] flex items-center gap-1.5 transition-colors font-medium"
            >
              <Shield className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Staff & Admin Login</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
