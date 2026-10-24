"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ShoppingBag, ArrowRight, Receipt, HelpCircle } from "lucide-react";

interface OrderNotFoundFallbackProps {
  searchedId: string;
}

export function OrderNotFoundFallback({ searchedId }: OrderNotFoundFallbackProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = query.trim();
    if (!clean) return;
    setIsSearching(true);
    router.push(`/order-confirmation/${encodeURIComponent(clean)}`);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-16 px-4">
      <div className="p-6 sm:p-10 rounded-3xl bg-[#20052B] border border-[#D4AF37]/40 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-[#D4AF37]/50 flex items-center justify-center mx-auto text-[#F5D061]">
          <Receipt className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full bg-[#3B0E4D] border border-[#D4AF37]/30 text-[#F5D061] text-xs font-semibold uppercase tracking-wider">
            Order Tracker
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif font-black text-white">
            Order #{searchedId} Not Found
          </h1>
          <p className="text-sm text-[#D3BEB0] max-w-md mx-auto leading-relaxed">
            We couldn&apos;t find an active order matching this identifier. Please verify your Order Number (e.g. <span className="text-[#F5D061] font-mono font-bold">SSS-2026-1001</span>) or enter it below to track.
          </p>
        </div>

        {/* Search Box */}
        <form onSubmit={handleSearch} className="max-w-md mx-auto flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter Order # or ID..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#D4AF37] transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={!query.trim() || isSearching}
            className="px-6 py-3 rounded-xl gold-gradient-btn text-xs font-bold shadow-md hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all shrink-0"
          >
            {isSearching ? "Searching..." : "Track Live ⚡"}
          </button>
        </form>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all"
          >
            <Receipt className="w-4 h-4 text-[#F5D061]" />
            <span>View All My Orders</span>
          </Link>

          <Link
            href="/#shop"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full gold-gradient-btn text-xs font-bold transition-all shadow-md"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Browse Sweets Shop</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
