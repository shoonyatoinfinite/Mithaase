"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Product, ProductVariant } from "@/types";
import {
  Package,
  Plus,
  Edit2,
  Check,
  X,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Search,
} from "lucide-react";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/products?admin=true");
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSaveSuccess("");

    try {
      if (isCreating) {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingProduct),
        });
        if (res.ok) {
          setSaveSuccess("New product added successfully!");
          setEditingProduct(null);
          setIsCreating(false);
          fetchProducts();
        }
      } else {
        const res = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingProduct),
        });
        if (res.ok) {
          setSaveSuccess("Product updated successfully!");
          setEditingProduct(null);
          fetchProducts();
        }
      }
    } catch {
      // ignore
    }
  };

  const handleVariantPriceChange = (variantId: string, newPrice: number) => {
    if (!editingProduct) return;
    setEditingProduct({
      ...editingProduct,
      variants: editingProduct.variants.map((v) =>
        v.id === variantId ? { ...v, price: newPrice } : v
      ),
    });
  };

  const handleVariantStockChange = (variantId: string, newStock: number) => {
    if (!editingProduct) return;
    setEditingProduct({
      ...editingProduct,
      variants: editingProduct.variants.map((v) =>
        v.id === variantId ? { ...v, stock_quantity: newStock } : v
      ),
    });
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-[#FFF8EE]">
              Products & <span className="gold-gradient-text">Pricing</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#D3BEB0] mt-1">
              Configure mithai names, prices, portion sizes, inventory thresholds, and seasonal availability.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsCreating(true);
                setEditingProduct({
                  id: "",
                  name: "",
                  slug: "",
                  description: "",
                  category_id: "cat-1",
                  image_url: "/images/kaju_katli.jpg",
                  is_active: true,
                  is_featured: false,
                  badge: "Festive Special",
                  variants: [
                    { id: "new-v1", product_id: "", variant_name: "250g", unit: "Box", price: 250, stock_quantity: 20, low_stock_threshold: 5, is_active: true },
                    { id: "new-v2", product_id: "", variant_name: "500g", unit: "Box", price: 480, stock_quantity: 15, low_stock_threshold: 5, is_active: true },
                  ],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
              }}
              className="px-4 py-2 rounded-xl gold-gradient-btn text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Sweet</span>
            </button>

            <button
              onClick={() => fetchProducts()}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#D4AF37] border border-white/10"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-950 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sweets by name or category..."
            className="w-full bg-[#1C0324] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/30 outline-none"
          />
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((p) => {
            const minPrice = Math.min(...p.variants.map((v) => v.price));
            const totalStock = p.variants.reduce((sum, v) => sum + v.stock_quantity, 0);

            return (
              <div
                key={p.id}
                className="rounded-3xl bg-[#1C0324] border border-[#D4AF37]/25 overflow-hidden shadow-xl flex flex-col justify-between"
              >
                <div>
                  {/* Thumbnail & Badges */}
                  <div className="relative aspect-[16/9] w-full bg-[#16031E]">
                    <Image
                      src={p.image_url}
                      alt={p.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 350px"
                      className="object-cover"
                    />
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                      {p.badge && (
                        <span className="px-2 py-0.5 rounded-full bg-[#881337] text-[#F5D061] text-[10px] font-bold">
                          {p.badge}
                        </span>
                      )}
                      {p.is_featured && (
                        <span className="px-2 py-0.5 rounded-full bg-[#D4AF37] text-[#16031E] text-[10px] font-bold">
                          Featured
                        </span>
                      )}
                    </div>

                    <div className="absolute top-3 right-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.is_active ? "bg-emerald-950 text-emerald-300" : "bg-red-950 text-red-300"
                        }`}
                      >
                        {p.is_active ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5">
                    <span className="text-[11px] font-semibold text-[#D4AF37] uppercase">
                      {p.category_name || "Mithai"}
                    </span>
                    <h3 className="text-base font-serif font-bold text-white mb-2 line-clamp-1">
                      {p.name}
                    </h3>
                    <p className="text-xs text-[#D3BEB0] line-clamp-2 leading-relaxed mb-4">
                      {p.description}
                    </p>

                    {/* Variants and Stock */}
                    <div className="space-y-1.5 pt-3 border-t border-white/10 text-xs">
                      {p.variants.map((v) => (
                        <div key={v.id} className="flex justify-between items-center text-white/80">
                          <span>{v.variant_name}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-serif font-bold text-[#F5D061]">₹{v.price}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                v.stock_quantity <= v.low_stock_threshold
                                  ? "bg-red-950 text-red-300 font-bold"
                                  : "bg-white/10 text-white/70"
                              }`}
                            >
                              Stock: {v.stock_quantity}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Edit Button */}
                <div className="p-4 border-t border-white/10 bg-white/[0.02]">
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setEditingProduct(JSON.parse(JSON.stringify(p)));
                    }}
                    className="w-full py-2 rounded-xl bg-white/5 hover:bg-[#D4AF37] hover:text-[#16031E] border border-white/10 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Sweet & Prices</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Edit / Create Modal */}
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#1C0324] border-2 border-[#D4AF37]/50 p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <h3 className="text-xl font-serif font-bold text-[#FFF8EE]">
                  {isCreating ? "Add New Sweet to Menu" : `Edit ${editingProduct.name}`}
                </h3>
                <button
                  onClick={() => setEditingProduct(null)}
                  className="p-2 rounded-full bg-white/5 text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
                <div>
                  <label className="block text-white/70 font-semibold mb-1">Sweet Name *</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-white text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-white/70 font-semibold mb-1">Description *</label>
                  <textarea
                    rows={3}
                    required
                    value={editingProduct.description}
                    onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2 text-white outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/70 font-semibold mb-1">Image URL</label>
                    <input
                      type="text"
                      value={editingProduct.image_url}
                      onChange={(e) => setEditingProduct({ ...editingProduct, image_url: e.target.value })}
                      className="w-full bg-[#16031E] border border-white/15 rounded-xl px-4 py-2 text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-white/70 font-semibold mb-1">Festive Badge</label>
                    <input
                      type="text"
                      value={editingProduct.badge || ""}
                      onChange={(e) => setEditingProduct({ ...editingProduct, badge: e.target.value })}
                      placeholder="e.g. Bestseller, Diwali Special"
                      className="w-full bg-[#16031E] border border-white/15 rounded-xl px-4 py-2 text-white outline-none"
                    />
                  </div>
                </div>

                {/* Variants Editor (Portions, Prices, Stock) */}
                <div className="pt-3 border-t border-white/10">
                  <label className="block font-bold text-[#F5D061] uppercase tracking-wider mb-2">
                    Variants, Prices & Stock Levels
                  </label>
                  <div className="space-y-3">
                    {editingProduct.variants.map((v) => (
                      <div
                        key={v.id}
                        className="p-3 rounded-2xl bg-white/5 border border-white/10 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center"
                      >
                        <div className="font-bold text-white text-sm sm:col-span-1">
                          {v.variant_name} ({v.unit})
                        </div>
                        <div>
                          <label className="text-[10px] text-white/50 block">Price (₹)</label>
                          <input
                            type="number"
                            min={0}
                            value={v.price}
                            onChange={(e) => handleVariantPriceChange(v.id, Number(e.target.value))}
                            className="w-full bg-[#16031E] border border-white/15 rounded-lg px-2.5 py-1.5 text-white font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/50 block">Stock Qty</label>
                          <input
                            type="number"
                            min={0}
                            value={v.stock_quantity}
                            onChange={(e) => handleVariantStockChange(v.id, Number(e.target.value))}
                            className="w-full bg-[#16031E] border border-white/15 rounded-lg px-2.5 py-1.5 text-white font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/50 block">Low Alert At</label>
                          <input
                            type="number"
                            min={0}
                            value={v.low_stock_threshold}
                            onChange={(e) => {
                              const thresh = Number(e.target.value);
                              setEditingProduct({
                                ...editingProduct,
                                variants: editingProduct.variants.map((va) =>
                                  va.id === v.id ? { ...va, low_stock_threshold: thresh } : va
                                ),
                              });
                            }}
                            className="w-full bg-[#16031E] border border-white/15 rounded-lg px-2.5 py-1.5 text-white font-bold"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-6 pt-3 border-t border-white/10">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingProduct.is_active}
                      onChange={(e) => setEditingProduct({ ...editingProduct, is_active: e.target.checked })}
                      className="rounded"
                    />
                    <span className="font-semibold text-white">Active in Storefront</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingProduct.is_featured}
                      onChange={(e) => setEditingProduct({ ...editingProduct, is_featured: e.target.checked })}
                      className="rounded"
                    />
                    <span className="font-semibold text-white">Feature in Highlights</span>
                  </label>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl gold-gradient-btn text-xs font-bold shadow-lg"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
