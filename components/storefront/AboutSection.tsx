"use client";

import React from "react";
import Image from "next/image";
import { Diya } from "@/components/animations/Diya";
import { Sparkles, Heart, Award, Shield } from "lucide-react";

export function AboutSection() {
  const highlights = [
    {
      icon: Sparkles,
      title: "Pure Desi Ghee",
      description: "Crafted exclusively with clarified butter and rich dairy mawa for authentic Indian aroma.",
    },
    {
      icon: Award,
      title: "Artisanal Craftsmanship",
      description: "Traditional sweet-making recipes preserved and perfected by experienced halwais.",
    },
    {
      icon: Shield,
      title: "Spotless Cleanliness",
      description: "Strict kitchen hygiene and food safety standards observed during festive preparation.",
    },
    {
      icon: Heart,
      title: "Festive Joy",
      description: "Dedicated to bringing sweetness and prosperity to your Diwali celebrations and pujas.",
    },
  ];

  return (
    <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Festive Visual */}
        <div className="lg:col-span-5 relative">
          <div className="relative aspect-[4/3] sm:aspect-square rounded-3xl overflow-hidden border-2 border-[#D4AF37]/50 shadow-2xl">
            <Image
              src="/images/hero_diwali_sweets.jpg"
              alt="Shree Shyam Sweets traditional feast"
              fill
              sizes="(max-width: 1024px) 100vw, 480px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#16031E] via-transparent to-transparent opacity-70" />

            {/* Diya at base */}
            <div className="absolute bottom-6 left-6 z-10 flex items-center gap-3">
              <Diya size="md" />
              <div className="text-left">
                <p className="text-xs font-bold text-[#F5D061] uppercase tracking-wider">Shree Shyam Sweets</p>
                <p className="text-sm font-serif font-black text-white">Mithaasé Diwali Special</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Narrative & Values */}
        <div className="lg:col-span-7 flex flex-col items-start">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#580E1E] border border-[#D4AF37]/40 text-[#F5D061] text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Our Commitment to Pure Taste</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-black text-[#FFF8EE] mb-6 leading-tight">
            Crafting Festive Sweets <br />
            with <span className="gold-gradient-text">Pure Dedication</span>
          </h2>

          <p className="text-sm sm:text-base text-[#D3BEB0] leading-relaxed mb-8">
            At <strong>Shree Shyam Sweets</strong>, Diwali is not merely another season — it is the pinnacle of celebration. Every sweet on our counter is created with uncompromised attention to pure cow milk, premium dry fruits, genuine saffron, and certified pure silver vark.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            {highlights.map((h, i) => {
              const Icon = h.icon;
              return (
                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#D4AF37]/40 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/20 flex items-center justify-center mb-2.5">
                    <Icon className="w-4 h-4 text-[#F5D061]" />
                  </div>
                  <h4 className="text-sm font-bold text-[#FFF8EE] mb-1">{h.title}</h4>
                  <p className="text-xs text-[#D3BEB0] leading-snug">{h.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
