"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Diya } from "@/components/animations/Diya";
import { Chakri } from "@/components/animations/Chakri";
import { Sparkles, ArrowDown, ChevronRight, ShieldCheck, Truck, Clock } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center pt-8 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background Ambience: Deep Royal Purple & Maroon Vignette */}
      <div className="absolute inset-0 bg-radial-gradient from-[#2E0736] via-[#1A0324] to-[#100117] pointer-events-none" />

      {/* Decorative Hanging Festive String Lights */}
      <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none flex justify-around opacity-75 overflow-hidden">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="w-px h-6 sm:h-10 bg-gradient-to-b from-amber-200/50 to-amber-500/80" />
            <div
              className="w-2.5 h-2.5 rounded-full bg-amber-300 shadow-[0_0_10px_#FFA000] animate-pulse"
              style={{ animationDelay: `${(i % 5) * 0.4}s` }}
            />
          </div>
        ))}
      </div>

      {/* Floating Golden Chakri Cracker (Subtle decorative corner element) */}
      <div className="hidden lg:block absolute -top-10 -right-10 pointer-events-none opacity-40">
        <Chakri size={180} speed="slow" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Festive Editorial Copy & Actions */}
        <div className="lg:col-span-7 text-center lg:text-left flex flex-col items-center lg:items-start">
          {/* Festive Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#580E1E] to-[#3B0820] border border-[#D4AF37]/50 text-[#F5D061] text-xs sm:text-sm font-semibold tracking-wider uppercase mb-6 shadow-[0_2px_12px_rgba(212,175,55,0.25)]">
            <Sparkles className="w-4 h-4 text-[#F5D061]" />
            <span>Shubh Deepawali 2026 Collection</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-6xl xl:text-7xl font-serif font-black tracking-tight text-[#FFF8EE] leading-[1.1] mb-5 sm:mb-6">
            Make This <span className="gold-gradient-text">Diwali</span> <br />
            Sweeter.
          </h1>

          {/* Supporting Text */}
          <p className="text-sm sm:text-lg text-[#D3BEB0] max-w-xl leading-relaxed mb-6 sm:mb-8">
            Celebrate the festival of lights with pure desi ghee mithai, handcrafted gift hampers, and delicious seasonal specials from <strong className="text-[#FFF8EE] font-semibold">Shree Shyam Sweets</strong>.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto mb-8 sm:mb-10">
            <a
              href="#shop"
              id="hero-explore-btn"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 gold-gradient-btn px-8 py-4 rounded-full text-base font-bold shadow-xl active:scale-95 text-center"
            >
              <span>Explore Our Sweets</span>
              <ArrowDown className="w-4 h-4" />
            </a>

            <a
              href="#diwali-specials"
              id="hero-order-btn"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#2E0736] hover:bg-[#400B16] text-[#F5D061] hover:text-[#FFF8EE] px-8 py-4 rounded-full text-base font-semibold border border-[#D4AF37]/50 shadow-lg hover:border-[#F5D061] transition-all active:scale-95"
            >
              <span>Order for Diwali</span>
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          {/* Quick Value Proofs */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/10 w-full max-w-lg">
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
              <div className="flex items-center gap-1.5 text-[#F5D061] text-xs font-semibold mb-1">
                <Truck className="w-4 h-4" />
                <span>₹21 Flat Fee</span>
              </div>
              <p className="text-[11px] text-[#D3BEB0]">Local doorstep delivery</p>
            </div>

            <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
              <div className="flex items-center gap-1.5 text-[#F5D061] text-xs font-semibold mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>COD & UPI</span>
              </div>
              <p className="text-[11px] text-[#D3BEB0]">Pay on delivery or UPI</p>
            </div>

            <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
              <div className="flex items-center gap-1.5 text-[#F5D061] text-xs font-semibold mb-1">
                <Clock className="w-4 h-4" />
                <span>Fresh Daily</span>
              </div>
              <p className="text-[11px] text-[#D3BEB0]">Pure Desi Ghee</p>
            </div>
          </div>
        </div>

        {/* Right Column: Hero Visual Arrangement with Glowing Diyas */}
        <div className="lg:col-span-5 relative flex items-center justify-center">
          <div className="relative w-full max-w-[480px] aspect-square">
            {/* Ambient Radial Golden Glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#FFA000]/25 via-[#D4AF37]/20 to-transparent rounded-3xl blur-2xl pointer-events-none" />

            {/* Main Festive Feast Image */}
            <div className="relative w-full h-full rounded-3xl overflow-hidden border-2 border-[#D4AF37]/60 shadow-[0_20px_50px_rgba(0,0,0,0.8)] group">
              <Image
                src="/images/hero_diwali_sweets.jpg"
                alt="Shree Shyam Sweets Royal Diwali Mithai Thali with Kaju Katli, Gulab Jamun, and Diyas"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 480px"
                className="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#16031E]/80 via-transparent to-black/20" />

              {/* Floating Diya on Bottom Corner */}
              <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-[#20052B]/85 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-[#D4AF37]/40 shadow-lg">
                <Diya size="sm" />
                <div className="flex flex-col text-left">
                  <span className="text-[10px] text-[#F5D061] font-semibold tracking-wider uppercase">Authentic Taste</span>
                  <span className="text-xs font-bold text-[#FFF8EE]">100% Pure Desi Ghee</span>
                </div>
              </div>
            </div>

            {/* Glowing Corner Diya Decor */}
            <div className="absolute -bottom-5 -right-5 z-20">
              <Diya size="lg" />
            </div>
            <div className="absolute -top-4 -left-4 z-20 hidden sm:block">
              <Diya size="md" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
