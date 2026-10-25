"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Product } from "@/types";
import { useCart } from "@/lib/context/cart-context";
import { Diya } from "@/components/animations/Diya";
import { Sparkles, ShoppingBag, Flame, Clock, Gift, Check } from "lucide-react";
import { useRealtime } from "@/lib/hooks/useRealtime";

interface DiwaliSpecialsProps {
  products: Product[];
}

export function DiwaliSpecials({ products }: DiwaliSpecialsProps) {
  const { addItem, items } = useCart();
  const [addedVariantId, setAddedVariantId] = useState<string | null>(null);
  const [productList, setProductList] = useState<Product[]>(products);

  useEffect(() => {
    setProductList(products);
  }, [products]);

  // Listen for real-time price & product updates pushed by admin
  useRealtime({
    events: ["product_updated"],
    enablePollingFallback: false,
    onEvent: async (payload) => {
      if (payload.type === "product_updated" && payload.data) {
        const updated = payload.data as Product;
        setProductList((prev) => {
          const exists = prev.some((p) => p.id === updated.id);
          if (exists) {
            return prev.map((p) => (p.id === updated.id ? updated : p));
          } else {
            return [updated, ...prev];
          }
        });
      }
    },
  });

  // Find Hamper & Paneer Sabji from updated productList
  const hamper = productList.find((p) => p.slug === "shubh-deepawali-royal-hamper") || productList[0];
  const paneerSabji = productList.find((p) => p.slug === "diwali-special-paneer-sabji") || productList[productList.length - 1];

  const inCartHamper = hamper ? items.find((it) => it.productId === hamper.id) : null;

  const handleAddSpecial = (prod: Product, variantIndex?: number) => {
    let v =
      variantIndex !== undefined
        ? prod.variants[variantIndex]
        : prod.variants.find(
            (va) =>
              va.variant_name.toLowerCase().includes("1 kg") ||
              va.variant_name.toLowerCase().includes("1kg") ||
              va.variant_name.toLowerCase().includes("1000ml") ||
              va.variant_name.toLowerCase().includes("1l")
          ) || prod.variants[0];

    if (!v) return;
    const effectiveStock = v.stock_quantity > 0 ? v.stock_quantity : 50;
    addItem({
      productId: prod.id,
      variantId: v.id,
      productName: prod.name,
      variantName: v.variant_name,
      unit: v.unit,
      price: v.price,
      imageUrl: prod.image_url,
      maxStock: effectiveStock,
    });
    setAddedVariantId(v.id);
    setTimeout(() => setAddedVariantId(null), 1500);
  };

  return (
    <section id="diwali-specials" className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-gradient-to-b from-[#1C0425] via-[#33093F] to-[#1C0425]">
      {/* Decorative Golden Orbs in Background */}
      <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-[#FF6F00]/10 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Title */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#580E1E] border border-[#F5D061]/50 text-[#F5D061] text-xs font-bold uppercase tracking-wider mb-4 shadow-lg">
            <Gift className="w-3.5 h-3.5 text-[#F5D061]" />
            <span>Curated Festival Exclusives</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-serif font-black text-[#FFF8EE] tracking-tight">
            Diwali <span className="gold-gradient-text">Signatures & Hampers</span>
          </h2>
          <p className="text-sm sm:text-base text-[#D3BEB0] mt-3">
            Handpicked luxury gift hampers and our once-a-year festival kitchen delicacies, prepared freshly on Diwali.
          </p>
        </div>

        {/* Feature 1: Luxury Mithai Hamper Box (Wide Feature Card) */}
        {hamper && (
          <div className="mb-12 rounded-3xl bg-gradient-to-r from-[#2B0736] via-[#3F0A38] to-[#2B0736] border-2 border-[#D4AF37]/45 p-6 sm:p-10 shadow-[0_15px_40px_rgba(0,0,0,0.6)] relative overflow-hidden group">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Image with decorative Diya */}
              <div className="lg:col-span-6 relative aspect-[4/3] rounded-2xl overflow-hidden border border-[#D4AF37]/50 shadow-2xl">
                <Image
                  src={hamper.image_url}
                  alt={hamper.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 600px"
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute bottom-4 left-4 z-10">
                  <Diya size="md" />
                </div>
              </div>

              {/* Copy & Details */}
              <div className="lg:col-span-6 flex flex-col items-start">
                <span className="px-3 py-1 rounded-full bg-[#881337] text-[#F5D061] text-xs font-bold uppercase tracking-wider mb-3">
                  Royal Presentation Box
                </span>
                <h3 className="text-2xl sm:text-4xl font-serif font-bold text-[#FFF8EE] mb-4">
                  {hamper.name}
                </h3>
                <p className="text-sm sm:text-base text-[#D3BEB0] leading-relaxed mb-6">
                  {hamper.description}
                </p>

                <div className="flex flex-wrap gap-4 items-center mb-8">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-white/50 uppercase font-semibold">Special Festive Price</span>
                    <span className="text-3xl font-serif font-black text-[#F5D061]">
                      ₹{hamper.variants[0]?.price}
                    </span>
                  </div>
                  <div className="h-8 w-px bg-white/10 hidden sm:block" />
                  <div className="text-xs text-[#D3BEB0]">
                    <span className="font-semibold text-white block">Includes 4 Sweets + Dry Fruits</span>
                    <span>Contains 2 complimentary hand-painted clay diyas</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                  <button
                    onClick={() => handleAddSpecial(hamper, 0)}
                    className="gold-gradient-btn px-8 py-3.5 rounded-full text-sm font-bold shadow-xl flex items-center justify-center gap-2 active:scale-95 flex-1 sm:flex-initial"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{inCartHamper ? `Add More (${inCartHamper.quantity} in Cart)` : "Add Hamper to Cart"}</span>
                  </button>
                  <Link
                    href={`/product/${hamper.slug}`}
                    className="px-5 py-3.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-semibold text-white transition-colors"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature 2: Diwali Day Special Shahi Paneer Sabji */}
        {paneerSabji && (
          <div className="rounded-3xl bg-gradient-to-r from-[#3B0C18] via-[#4D1120] to-[#3B0C18] border-2 border-amber-500/40 p-6 sm:p-10 shadow-[0_15px_40px_rgba(0,0,0,0.6)] relative overflow-hidden group">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Copy & Details */}
              <div className="lg:col-span-6 flex flex-col items-start order-2 lg:order-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 rounded-full bg-amber-600/90 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-200" />
                    <span>Diwali Day Exclusive Special</span>
                  </span>
                  <span className="px-3 py-1 rounded-full bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                    Fresh Kitchen Batch
                  </span>
                </div>

                <h3 className="text-2xl sm:text-4xl font-serif font-bold text-[#FFF8EE] mb-4">
                  {paneerSabji.name}
                </h3>
                <p className="text-sm sm:text-base text-[#D3BEB0] leading-relaxed mb-6">
                  {paneerSabji.description}
                </p>

                <div className="grid grid-cols-2 gap-4 mb-6 w-full max-w-sm">
                  {paneerSabji.variants.map((v, i) => {
                    const inCartPaneer = items.find(
                      (it) => it.productId === paneerSabji.id && it.variantId === v.id
                    );
                    const isJustAdded = addedVariantId === v.id;
                    return (
                      <div key={v.id} className="p-3 rounded-xl bg-white/5 border border-white/10 relative flex flex-col justify-between">
                        {inCartPaneer && (
                          <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full bg-[#E65100] text-white text-[9px] font-black border border-white/20">
                            {inCartPaneer.quantity} in cart
                          </span>
                        )}
                        <div>
                          <span className="text-xs font-semibold text-white/90 block leading-tight">{v.variant_name}</span>
                          <span className="text-xl font-bold font-serif text-[#F5D061] mt-1 block">₹{v.price}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddSpecial(paneerSabji, i)}
                          className={`mt-2.5 w-full py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-md ${
                            isJustAdded
                              ? "bg-emerald-500 text-white"
                              : "bg-[#D4AF37] hover:bg-[#F5D061] text-[#16031E] active:scale-95"
                          }`}
                        >
                          {isJustAdded ? (
                            <>
                              <Check className="w-3 h-3 text-white" />
                              <span>Added!</span>
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="w-3 h-3" />
                              <span>{inCartPaneer ? `Add (+1)` : "Add"}</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-amber-300/80 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Prepared freshly on order for lunch & dinner on Diwali festive days.</span>
                </p>
              </div>

              {/* Image */}
              <div className="lg:col-span-6 relative aspect-[4/3] rounded-2xl overflow-hidden border border-amber-500/40 shadow-2xl order-1 lg:order-2">
                <Image
                  src={paneerSabji.image_url}
                  alt={paneerSabji.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 600px"
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute top-4 right-4 z-10">
                  <Diya size="sm" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
