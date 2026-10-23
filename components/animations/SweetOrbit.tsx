"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Diya } from "./Diya";
import { Sparkles, ArrowRight } from "lucide-react";

interface OrbitItem {
  name: string;
  image: string;
  price: string;
  portion: string;
  angle: number; // degrees
  radius: number; // px from center
  duration: number; // seconds for full orbit
  reverse?: boolean;
}

export function SweetOrbit() {
  const items: OrbitItem[] = [
    { name: "Shahi Kaju Katli", image: "/images/kaju_katli.jpg", price: "₹280", portion: "250g", angle: 0, radius: 210, duration: 32 },
    { name: "Gulab Jamun", image: "/images/gulab_jamun.jpg", price: "₹240", portion: "500g", angle: 72, radius: 210, duration: 32 },
    { name: "Malai Kalakand", image: "/images/kalakand.jpg", price: "₹210", portion: "250g", angle: 144, radius: 210, duration: 32 },
    { name: "Spongy Rasgulla", image: "/images/rasgulla.jpg", price: "₹200", portion: "500g", angle: 216, radius: 210, duration: 32 },
    { name: "Royal Mithai Box", image: "/images/diwali_hamper.jpg", price: "₹1250", portion: "1 kg", angle: 288, radius: 210, duration: 32 },
  ];

  return (
    <section className="relative py-24 px-4 overflow-hidden bg-gradient-to-b from-[#16031E] via-[#24062E] to-[#16031E]">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-[#FF6F00]/15 via-[#D4AF37]/20 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#3B0E4D] border border-[#D4AF37]/40 text-[#F5D061] text-xs font-semibold tracking-wider uppercase mb-4 shadow-md">
            <Sparkles className="w-3.5 h-3.5 text-[#F5D061]" />
            <span>Signature Diwali Celebration</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-[#FFF8EE] tracking-tight mb-4">
            The Orbit of <span className="gold-gradient-text">Festive Delights</span>
          </h2>
          <p className="text-sm md:text-base text-[#D3BEB0] leading-relaxed">
            Every Diwali delicacy at Shree Shyam Sweets is handcrafted with pure desi ghee and decades of traditional craftsmanship.
          </p>
        </div>

        {/* Orbit Stage */}
        <div className="relative w-full max-w-[620px] h-[400px] sm:h-[540px] md:h-[620px] mx-auto flex items-center justify-center scale-[0.68] xs:scale-[0.8] sm:scale-95 md:scale-100 origin-center">
          {/* Concentric Golden Orbit Rings */}
          <div className="absolute w-[440px] h-[440px] rounded-full border border-[#D4AF37]/25 pointer-events-none" />
          <div className="absolute w-[340px] h-[340px] rounded-full border border-dashed border-[#F5D061]/20 pointer-events-none animate-chakri-slow" />
          <div className="absolute w-[240px] h-[240px] rounded-full border border-[#D4AF37]/20 pointer-events-none" />

          {/* Central Core: Golden Diya & Brand Emblem */}
          <div className="relative z-20 flex flex-col items-center justify-center w-36 h-36 rounded-full bg-gradient-to-b from-[#3B0E4D] to-[#1C0526] border-2 border-[#D4AF37] shadow-[0_0_35px_rgba(212,175,55,0.4)] text-center p-3">
            <Diya size="md" className="-mt-1" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#F5D061] mt-1">Shree Shyam</span>
            <span className="text-xs font-serif font-black tracking-wide text-[#FFF8EE]">MITHAASÉ</span>
          </div>

          {/* Orbiting Sweet Cards */}
          <div className="absolute inset-0 w-full h-full animate-chakri-slow will-change-transform">
            {items.map((item, index) => {
              const rad = (item.angle * Math.PI) / 180;
              const x = Math.round(Math.cos(rad) * item.radius);
              const y = Math.round(Math.sin(rad) * item.radius);

              return (
                <div
                  key={index}
                  className="absolute top-1/2 left-1/2 w-28 h-28 -ml-14 -mt-14"
                  style={{
                    transform: `translate(${x}px, ${y}px)`,
                  }}
                >
                  {/* Counter-rotate card so sweet and text remain upright! */}
                  <div className="w-full h-full [animation:chakriSpin_14s_linear_infinite_reverse] flex flex-col items-center group">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-[#D4AF37] shadow-[0_6px_20px_rgba(0,0,0,0.6)] group-hover:scale-110 group-hover:border-[#FFF2A8] transition-all duration-300">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="(max-width: 640px) 64px, 80px"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    {/* Floating Pill Tag */}
                    <div className="mt-1.5 px-2.5 py-1 rounded-full bg-[#20052B]/95 border border-[#D4AF37]/50 shadow-md backdrop-blur-sm text-center">
                      <p className="text-[10px] font-bold text-[#FFF8EE] truncate max-w-[95px] leading-tight">
                        {item.name}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Orbit CTA */}
        <div className="text-center mt-12">
          <Link
            href="/#shop"
            className="inline-flex items-center gap-2 gold-gradient-btn px-6 py-3 rounded-full text-sm font-bold shadow-lg"
          >
            <span>Order Your Diwali Selection</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
