"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/context/cart-context";
import { useStoreSettings } from "@/lib/context/store-context";
import { AnnouncementBar } from "@/components/storefront/AnnouncementBar";
import { Navbar } from "@/components/storefront/Navbar";
import { Footer } from "@/components/storefront/Footer";
import { StoreClosedModal } from "@/components/storefront/StoreClosedModal";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, ArrowLeft, ShieldCheck, Truck, Scale, Clock } from "lucide-react";

export default function CartPage() {
  const router = useRouter();
  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    subtotal,
    itemCount,
    totalWeightKg,
    maxWeightKg,
    isWeightLimitReached,
    setBulkModalOpen,
    isHydrated,
  } = useCart();
  const { settings, isStoreClosed, isStoreShutoff } = useStoreSettings();
  const [isStoreClosedModalOpen, setIsStoreClosedModalOpen] = useState(false);
  const [isSessionExpiredNotice, setIsSessionExpiredNotice] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("sessionExpired=1")) {
      setIsSessionExpiredNotice(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const deliveryFee = subtotal > 0 ? Number(settings.default_delivery_fee) || 21 : 0;
  const finalTotal = subtotal > 0 ? subtotal + deliveryFee : 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#16031E] overflow-x-hidden max-w-full w-full">
      <Navbar />

      <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Session Expired Notice */}
        {isSessionExpiredNotice && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-950/90 border-2 border-amber-500/60 text-amber-200 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-xl animate-in fade-in">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
              <span>
                <strong>Payment Session Timed Out:</strong> Your 5-minute payment session expired and was cancelled. Your cart items are preserved. Please proceed to checkout when ready.
              </span>
            </div>
            <button
              onClick={() => setIsSessionExpiredNotice(false)}
              className="text-white/60 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 shrink-0 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif font-black text-[#FFF8EE]">
              Your Festive <span className="gold-gradient-text">Mithai Cart</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#D3BEB0] mt-1">
              {itemCount} {itemCount === 1 ? "item" : "items"} ready for Diwali delivery
            </p>
          </div>

          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-red-400/80 hover:text-red-300 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Cart</span>
            </button>
          )}
        </div>

        {items.length === 0 ? (
          /* Empty Cart State */
          <div className="py-20 px-4 text-center max-w-md mx-auto rounded-3xl bg-[#20052B] border border-[#D4AF37]/30 shadow-2xl">
            <div className="w-20 h-20 rounded-full bg-[#3B0E4D] border border-[#D4AF37]/40 flex items-center justify-center mx-auto mb-6 text-[#F5D061]">
              <ShoppingBag className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-[#FFF8EE] mb-2">
              Your Cart is Empty
            </h2>
            <p className="text-sm text-[#D3BEB0] leading-relaxed mb-8">
              Explore our handcrafted collection of Kaju Katli, Gulab Jamun, and Diwali gift hampers to fill your cart.
            </p>
            <Link
              href="/#shop"
              className="inline-flex items-center gap-2 gold-gradient-btn px-8 py-3.5 rounded-full text-sm font-bold shadow-xl active:scale-95"
            >
              <span>Explore Sweets</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          /* Active Cart Grid */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Cart Items List */}
            <div className="lg:col-span-8 space-y-4">
              {cartError && (
                <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs sm:text-sm flex items-center justify-between gap-2 shadow-lg animate-in fade-in">
                  <span>{cartError}</span>
                  <button
                    onClick={() => setCartError(null)}
                    className="text-white/60 hover:text-white text-xs px-2 py-0.5 rounded bg-black/30"
                  >
                    ✕
                  </button>
                </div>
              )}

              {items.map((item) => (
                <div
                  key={item.variantId}
                  className="p-4 sm:p-5 rounded-2xl bg-[#20052B] border border-[#D4AF37]/25 hover:border-[#D4AF37]/50 shadow-md transition-all flex flex-col sm:flex-row items-center gap-4"
                >
                  {/* Thumbnail */}
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-[#16031E]">
                    <Image
                      src={item.imageUrl}
                      alt={item.productName}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="text-base font-serif font-bold text-[#FFF8EE]">
                      {item.productName}
                    </h3>
                    <p className="text-xs text-[#F5D061] font-semibold mt-0.5">
                      Portion: {item.variantName}
                    </p>
                    <p className="text-xs text-white/50 mt-1">
                      ₹{item.price} per {item.unit || "unit"}
                    </p>
                    {item.maxStock > 0 && item.quantity >= item.maxStock && (
                      <span className="text-[10px] text-amber-400 font-bold block mt-1">
                        ⚠️ Max available stock reached ({item.maxStock} in stock)
                      </span>
                    )}
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center bg-[#16031E] border border-white/15 rounded-lg p-1">
                    <button
                      onClick={() => {
                        setCartError(null);
                        updateQuantity(item.variantId, item.quantity - 1);
                      }}
                      className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white rounded hover:bg-white/10 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => {
                        const res = updateQuantity(item.variantId, item.quantity + 1);
                        if (!res.success && res.error) {
                          setCartError(res.error);
                        } else {
                          setCartError(null);
                        }
                      }}
                      disabled={typeof item.maxStock === "number" && item.quantity >= item.maxStock}
                      className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-white/10 transition-colors"
                      aria-label="Increase quantity"
                      title={typeof item.maxStock === "number" && item.quantity >= item.maxStock ? `Max stock (${item.maxStock}) reached` : "Increase quantity"}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Line Total & Remove */}
                  <div className="flex items-center gap-4 justify-between sm:justify-end w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                    <span className="text-lg font-bold font-serif text-[#F5D061]">
                      ₹{item.price * item.quantity}
                    </span>
                    <button
                      onClick={() => removeItem(item.variantId)}
                      className="p-2 text-white/40 hover:text-red-400 transition-colors rounded-lg hover:bg-white/5"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="pt-4 flex justify-between items-center text-xs text-[#D3BEB0]">
                <Link href="/#shop" className="hover:text-white flex items-center gap-1.5 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Continue Shopping Sweets</span>
                </Link>
                <span>Prices verified fresh</span>
              </div>
            </div>

            {/* Order Summary & Proceed to Checkout */}
            <div className="lg:col-span-4">
              <div className="p-6 rounded-3xl bg-[#24062E] border-2 border-[#D4AF37]/40 shadow-2xl sticky top-28">
                <h3 className="text-xl font-serif font-bold text-[#FFF8EE] pb-4 mb-4 border-b border-white/10">
                  Order Summary
                </h3>

                {/* Total Weight Meter */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5 mb-5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-white/70 font-semibold flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-[#F5D061]" />
                      <span>Order Weight:</span>
                    </span>
                    <span className={`font-bold font-mono ${isWeightLimitReached ? "text-rose-400" : "text-[#F5D061]"}`}>
                      {totalWeightKg.toFixed(1)} kg / {maxWeightKg} kg max
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isWeightLimitReached ? "bg-rose-500" : "bg-gradient-to-r from-emerald-400 to-[#D4AF37]"
                      }`}
                      style={{ width: `${Math.min(100, (totalWeightKg / maxWeightKg) * 100)}%` }}
                    />
                  </div>
                  <div className="pt-1 flex items-center justify-between text-[10px]">
                    <span className="text-white/40">Standard delivery cap: 20 kg</span>
                    <button
                      type="button"
                      onClick={() => setBulkModalOpen(true)}
                      className="text-[#F5D061] hover:underline font-bold"
                    >
                      Bulk Orders ↗
                    </button>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-[#D3BEB0] mb-6">
                  <div className="flex justify-between">
                    <span>Items Subtotal</span>
                    <span className="font-semibold text-white">₹{subtotal}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[#F5D061]" />
                      <span>Local Doorstep Delivery</span>
                    </span>
                    <span className="font-semibold text-[#F5D061]">₹{deliveryFee}</span>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex justify-between items-baseline text-base font-bold text-[#FFF8EE]">
                    <span>Total Payable</span>
                    <span className="text-2xl font-serif text-[#F5D061]">₹{finalTotal}</span>
                  </div>
                </div>

                {/* Store Shutoff Banner in Cart Summary */}
                {isStoreShutoff ? (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-red-950/90 to-[#2B0515] border border-red-500/50 mb-4 text-xs text-white space-y-2">
                    <div className="flex items-center gap-2 text-red-300 font-bold">
                      <Clock className="w-4 h-4 animate-pulse" />
                      <span>Store Permanently Shut Off</span>
                    </div>
                    <p className="text-[11px] text-red-200/90">
                      {settings.shutoff_message || "All shopping has been disabled. You can view your past orders and receipts."}
                    </p>
                    <Link
                      href="/orders"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F5D061] hover:underline pt-1"
                    >
                      <span>View Past Orders & Receipts &rarr;</span>
                    </Link>
                  </div>
                ) : isStoreClosed ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsStoreClosedModalOpen(true)}
                    className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-950/90 to-rose-950/90 border border-amber-500/50 mb-4 cursor-pointer hover:border-amber-400 transition-all text-xs text-white"
                  >
                    <div className="flex items-center gap-2 text-[#F5D061] font-bold">
                      <Clock className="w-4 h-4 animate-pulse" />
                      <span>Store Currently Closed</span>
                    </div>
                    <p className="text-[11px] text-amber-200/90 mt-1">
                      Online orders paused. Tap here to view opening timings ({settings.operating_hours || "8:00 AM - 10:00 PM"}) or visit shop directly.
                    </p>
                  </div>
                ) : null}

                {isStoreShutoff ? (
                  <Link
                    href="/orders"
                    className="w-full py-4 rounded-full font-bold text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 text-center mb-4 transition-all bg-white/10 hover:bg-white/20 text-[#FFF8EE] border border-white/20"
                  >
                    <span>View Past Orders & Receipts</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    id="cart-proceed-checkout-btn"
                    onClick={() => {
                      if (isStoreClosed) {
                        setIsStoreClosedModalOpen(true);
                      } else {
                        router.push("/checkout");
                      }
                    }}
                    className={`w-full py-4 rounded-full font-bold text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 text-center mb-4 transition-all ${
                      isStoreClosed
                        ? "bg-gradient-to-r from-amber-700 to-rose-700 hover:from-amber-600 hover:to-rose-600 text-white border border-amber-400/60"
                        : "gold-gradient-btn"
                    }`}
                  >
                    <span>
                      {isStoreClosed
                        ? "Store Closed — View Timings & Address"
                        : "Proceed to Checkout"}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <div className="flex items-center justify-center gap-2 text-[11px] text-[#D3BEB0]">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Cash on Delivery & Direct UPI Supported</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Store Closed Modal */}
      <StoreClosedModal
        isOpen={isStoreClosedModalOpen}
        onClose={() => setIsStoreClosedModalOpen(false)}
        settings={settings}
      />

      <Footer />
    </div>
  );
}
