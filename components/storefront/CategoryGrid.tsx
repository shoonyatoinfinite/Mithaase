"use client";

import React, { useState, useEffect } from "react";
import { Category, Product } from "@/types";
import { ProductCard } from "@/components/products/ProductCard";
import { Sparkles, Filter } from "lucide-react";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { saveCatalogToCache } from "@/lib/cache/indexed-db";

interface CategoryGridProps {
  categories: Category[];
  products: Product[];
}

export function CategoryGrid({ categories, products }: CategoryGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [productList, setProductList] = useState<Product[]>(products);

  useEffect(() => {
    setProductList(products);
    if (products.length > 0) {
      saveCatalogToCache(products, categories, Date.now().toString());
    }
  }, [products, categories]);

  // Listen for real-time price & product updates pushed by admin
  useRealtime({
    events: ["product_updated"],
    enablePollingFallback: false,
    onEvent: async (payload) => {
      if (payload.type === "product_updated" && payload.data) {
        const updated = payload.data as Product;
        setProductList((prev) => {
          const exists = prev.some((p) => p.id === updated.id);
          const next = exists
            ? prev.map((p) => (p.id === updated.id ? updated : p))
            : [updated, ...prev];
          saveCatalogToCache(next, categories, Date.now().toString());
          return next;
        });
      }
    },
  });

  const filteredProducts =
    selectedCategory === "all"
      ? productList
      : productList.filter((p) => p.category_id === selectedCategory);

  return (
    <section id="shop" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full overflow-hidden">
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 sm:mb-12 gap-6 w-full">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#380A2B] border border-[#D4AF37]/40 text-[#F5D061] text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Festive Mithai Catalogue</span>
          </div>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-serif font-black text-[#FFF8EE] leading-tight">
            Traditional <span className="gold-gradient-text">Indian Sweets</span>
          </h2>
          <p className="text-xs sm:text-base text-[#D3BEB0] mt-2 leading-relaxed">
            Choose from freshly prepared Barfi, Gulab Jamun, Kalakand, Rasgulla, and our signature Diwali gift platters.
          </p>
        </div>

        {/* Category Pill Filters (Responsive Wrap - No Horizontal Scrolling) */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-bold transition-all border ${
              selectedCategory === "all"
                ? "bg-[#D4AF37] text-[#16031E] border-[#F5D061] shadow-[0_2px_12px_rgba(212,175,55,0.4)]"
                : "bg-[#25072F] text-[#D3BEB0] border-white/10 hover:border-white/20 hover:text-white"
            }`}
          >
            All Sweets ({productList.length})
          </button>
          {categories.map((cat) => {
            const count = productList.filter((p) => p.category_id === cat.id).length;
            if (count === 0) return null;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-semibold transition-all border ${
                  selectedCategory === cat.id
                    ? "bg-[#D4AF37] text-[#16031E] border-[#F5D061] shadow-[0_2px_12px_rgba(212,175,55,0.4)]"
                    : "bg-[#25072F] text-[#D3BEB0] border-white/10 hover:border-white/20 hover:text-white"
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Cards Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-16 bg-[#20052B] rounded-3xl border border-white/10">
          <p className="text-base text-[#D3BEB0]">No sweets currently found in this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}
