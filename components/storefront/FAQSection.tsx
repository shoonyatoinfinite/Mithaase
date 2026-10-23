"use client";

import React, { useState } from "react";
import { ChevronDown, HelpCircle, Sparkles } from "lucide-react";
import { useStoreSettings } from "@/lib/context/store-context";

export function FAQSection() {
  const { settings } = useStoreSettings();
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: "How does the local delivery work and is first delivery free?",
      a: `Yes! Your first delivery is 100% FREE with promo code FREEDEL during checkout! For all subsequent festival orders, we deliver across town for a flat fee of ₹${settings.default_delivery_fee} per order. There are no distance markups or surge pricing.`,
    },
    {
      q: "How can I track my live order status in real-time?",
      a: "Once you log in and place an order, a live tracking icon appears in the top navigation bar showing your order's real-time stage (Placed → Confirmed → Prepared in Kitchen → Packed → Out for Delivery → Delivered). You can tap it anytime for live progress.",
    },
    {
      q: "How do you verify delivery completion at my doorstep?",
      a: "Our delivery fleet uses real-time GPS satellite location verification and captures a live in-app photo of the sweet box at your doorstep upon handover. Pre-saved photos from the gallery cannot be uploaded. Once completed, your official delivery receipt includes the verified timestamp, GPS location, and photo proof.",
    },
    {
      q: "How are sweets verified and packed before dispatch?",
      a: "Every order undergoes strict item-by-item verification by our Halwai kitchen team. Admin verifies each individual sweet box and pack on an inspection checklist before the order can be marked as packed and handed to the delivery rider.",
    },
    {
      q: "How do I securely access my official order receipts?",
      a: "For customer privacy and security, public email searches are completely disabled. You can securely access all your previous orders, live tracking history, and tax invoices anytime by logging in with your registered email and 4-digit security PIN.",
    },
    {
      q: "What payment methods are supported?",
      a: "We support both instant UPI payments (Google Pay, PhonePe, Paytm, BHIM) and Cash on Delivery (COD). For UPI, you can tap to launch your payment app directly or scan our official QR code and attach your payment reference for immediate confirmation.",
    },
    {
      q: "How are the sweets packaged for gifting?",
      a: "All sweets are packed fresh in standard hygienic, food-grade boxes (normal packs) with festive presentation tags, ensuring fresh taste, cleanliness, and gift-ready elegance.",
    },
    {
      q: "Can I order Diwali Day Special Paneer Sabji in advance?",
      a: "Yes! Paneer Sabji is specially prepared fresh in small batches on festival days. You can pre-order it via the website for scheduled lunchtime or evening delivery while stock lasts.",
    },
    {
      q: "What are your shop timings and cutoff hours?",
      a: `Shop timings can vary depending on festival rush, baking schedules, and holidays, and are managed live by our store admin. Currently, our counter is set to ${settings.operating_hours}, with online delivery orders accepted until ${settings.cutoff_time}. Any changes in timing reflect here immediately.`,
    },
  ];

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#3B0E4D] border border-[#D4AF37]/40 text-[#F5D061] text-xs font-bold uppercase tracking-wider mb-3 shadow-md">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Help & Clarifications</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-serif font-black text-[#FFF8EE]">
          Frequently Asked <span className="gold-gradient-text">Questions</span>
        </h2>
        <p className="text-sm text-[#D3BEB0] mt-2">
          Everything you need to know about ordering, live GPS tracking, doorstep proof, and festive preparations.
        </p>
      </div>

      <div className="space-y-3.5">
        {faqs.map((faq, index) => {
          const isOpen = openIdx === index;
          return (
            <div
              key={index}
              className="rounded-2xl bg-[#20052B] border border-[#D4AF37]/25 overflow-hidden transition-all duration-200"
            >
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : index)}
                className="w-full py-4 px-6 text-left flex items-center justify-between gap-4 text-sm sm:text-base font-semibold text-[#FFF8EE] hover:text-[#F5D061] transition-colors"
                aria-expanded={isOpen}
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-[#D4AF37] shrink-0 transition-transform duration-300 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-[#D3BEB0] leading-relaxed border-t border-white/5">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
