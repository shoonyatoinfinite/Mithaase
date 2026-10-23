"use client";

import React from "react";
import { CartItem } from "@/types";
import { Sparkles, ShoppingBag, ArrowRight, Merge, RefreshCw, X, Check } from "lucide-react";

interface CartReconciliationModalProps {
  isOpen: boolean;
  currentItems: CartItem[];
  savedAccountItems: CartItem[];
  onMerge: () => void;
  onKeepCurrent: () => void;
  onRestorePrevious: () => void;
  onClose: () => void;
}

export function CartReconciliationModal({
  isOpen,
  currentItems,
  savedAccountItems,
  onMerge,
  onKeepCurrent,
  onRestorePrevious,
  onClose,
}: CartReconciliationModalProps) {
  if (!isOpen) return null;

  const currentSubtotal = currentItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const savedSubtotal = savedAccountItems.reduce((acc, it) => acc + it.price * it.quantity, 0);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl my-auto rounded-3xl bg-[#1C0324] border-2 border-[#D4AF37]/50 shadow-[0_10px_50px_rgba(0,0,0,0.85)] p-6 sm:p-8 space-y-6 text-center animate-in fade-in zoom-in-95 duration-200 text-left">
        {/* Top Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3B0E4D] border border-[#D4AF37]/40 text-[#F5D061] text-[11px] font-bold tracking-wider uppercase shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#F5D061]" />
            <span>Cart Items Detected</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-black text-[#FFF8EE]">
            Merge Your <span className="gold-gradient-text">Sweets Cart?</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#D3BEB0] max-w-md mx-auto leading-relaxed">
            You added sweets during this visit, and you also have items saved from your previous account visit. How would you like to proceed?
          </p>
        </div>

        {/* Side-by-Side Comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          {/* Current Session Cart */}
          <div className="p-4 rounded-2xl bg-[#260533] border border-[#D4AF37]/30 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="font-bold text-[#F5D061] flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-[#F5D061]" />
                <span>Current Visit</span>
              </span>
              <span className="font-mono text-white/80 font-semibold">
                {currentItems.length} item{currentItems.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
              {currentItems.map((item) => (
                <div key={item.variantId} className="flex justify-between text-[11px] text-[#D3BEB0]">
                  <span className="truncate pr-2">
                    {item.productName} ({item.variantName})
                  </span>
                  <span className="font-mono text-white shrink-0">
                    x{item.quantity} • ₹{item.price * item.quantity}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-white/10 flex justify-between font-bold text-white text-xs">
              <span>Subtotal:</span>
              <span className="text-[#F5D061] font-mono">₹{currentSubtotal}</span>
            </div>
          </div>

          {/* Saved Account Cart */}
          <div className="p-4 rounded-2xl bg-[#260533] border border-white/15 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="font-bold text-white/90 flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-[#D4AF37]" />
                <span>Previous Account Cart</span>
              </span>
              <span className="font-mono text-white/80 font-semibold">
                {savedAccountItems.length} item{savedAccountItems.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
              {savedAccountItems.map((item) => (
                <div key={item.variantId} className="flex justify-between text-[11px] text-[#D3BEB0]">
                  <span className="truncate pr-2">
                    {item.productName} ({item.variantName})
                  </span>
                  <span className="font-mono text-white shrink-0">
                    x{item.quantity} • ₹{item.price * item.quantity}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-white/10 flex justify-between font-bold text-white text-xs">
              <span>Subtotal:</span>
              <span className="text-[#F5D061] font-mono">₹{savedSubtotal}</span>
            </div>
          </div>
        </div>

        {/* 3 User Options */}
        <div className="space-y-2.5 pt-2">
          {/* Option 1: Merge Both (Recommended) */}
          <button
            type="button"
            onClick={onMerge}
            className="w-full py-3.5 px-4 rounded-2xl gold-gradient-btn font-bold text-sm flex items-center justify-between shadow-xl active:scale-[0.99] transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <Merge className="w-4 h-4 text-[#16031E]" />
              <span className="text-[#16031E]">Combine Both Carts</span>
            </div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#16031E] bg-[#FFF2A8]/70 px-2 py-0.5 rounded-full">
              Recommended
            </span>
          </button>

          {/* Option 2: Keep Current Items */}
          <button
            type="button"
            onClick={onKeepCurrent}
            className="w-full py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs flex items-center justify-between active:scale-[0.99] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#F5D061]" />
              <span>Keep Current Visit Items Only</span>
            </div>
            <span className="text-[10px] text-white/50">Replace account cart</span>
          </button>

          {/* Option 3: Restore Previous Cart */}
          <button
            type="button"
            onClick={onRestorePrevious}
            className="w-full py-2.5 px-4 rounded-2xl bg-transparent hover:bg-white/5 text-[#D3BEB0] hover:text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Discard current items and restore previous account cart</span>
          </button>
        </div>
      </div>
    </div>
  );
}
