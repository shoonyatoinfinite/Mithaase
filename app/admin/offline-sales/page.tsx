"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Product, OfflineSale } from "@/types";
import {
  Banknote,
  Plus,
  Trash2,
  CheckCircle2,
  Smartphone,
  RefreshCw,
  ShoppingBag,
  IndianRupee,
} from "lucide-react";

export default function AdminOfflineSalesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<OfflineSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Sale Form State
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi">("cash");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [saleCart, setSaleCart] = useState<
    Array<{
      productId: string;
      variantId: string;
      productName: string;
      variantName: string;
      price: number;
      quantity: number;
      maxStock: number;
    }>
  >([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [prodRes, saleRes] = await Promise.all([
        fetch("/api/products?admin=true"),
        fetch("/api/offline-sales"),
      ]);
      if (prodRes.ok) {
        const prodData: Product[] = await prodRes.json();
        setProducts(prodData);
        if (prodData.length > 0) {
          setSelectedProductId(prodData[0].id);
          if (prodData[0].variants.length > 0) {
            setSelectedVariantId(prodData[0].variants[0].id);
          }
        }
      }
      if (saleRes.ok) setSales(await saleRes.json());
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentProduct = products.find((p) => p.id === selectedProductId);
  const currentVariant = currentProduct?.variants.find((v) => v.id === selectedVariantId);

  const handleAddItemToSaleCart = () => {
    if (!currentProduct || !currentVariant) return;
    if (currentVariant.stock_quantity < saleQuantity) {
      setErrorMessage(`Only ${currentVariant.stock_quantity} in stock for ${currentProduct.name} (${currentVariant.variant_name})`);
      return;
    }

    setErrorMessage("");
    setSaleCart((prev) => {
      const idx = prev.findIndex((i) => i.variantId === currentVariant.id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx].quantity += saleQuantity;
        return updated;
      }
      return [
        ...prev,
        {
          productId: currentProduct.id,
          variantId: currentVariant.id,
          productName: currentProduct.name,
          variantName: currentVariant.variant_name,
          price: currentVariant.price,
          quantity: saleQuantity,
          maxStock: currentVariant.stock_quantity,
        },
      ];
    });

    setSaleQuantity(1);
  };

  const handleRemoveItem = (variantId: string) => {
    setSaleCart((prev) => prev.filter((i) => i.variantId !== variantId));
  };

  const cartSubtotal = saleCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const finalSaleTotal = Math.max(0, cartSubtotal - discountAmount);

  const handleRecordSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saleCart.length === 0) {
      setErrorMessage("Please add at least one sweet to the sale.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/offline-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_method: paymentMethod,
          discount_amount: discountAmount,
          customer_name: customerName || "Counter Customer",
          customer_phone: customerPhone,
          items: saleCart.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
            unit_price: i.price,
          })),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(`Counter sale ${data.sale_number} recorded successfully! Inventory deducted.`);
        setSaleCart([]);
        setDiscountAmount(0);
        setCustomerName("");
        setCustomerPhone("");
        fetchData();
      } else {
        setErrorMessage(data.error || "Failed to record sale.");
      }
    } catch {
      setErrorMessage("Failed to record counter sale.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-[#FFF8EE]">
              Shop Counter <span className="gold-gradient-text">POS & Offline Sales</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#D3BEB0] mt-1">
              Record walk-in sales at the sweet shop counter. Automatically deducts portion stock and syncs reports.
            </p>
          </div>

          <button
            onClick={() => fetchData()}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#D4AF37] border border-[#D4AF37]/30 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-red-950/90 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Sales Terminal Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Sweet Selector Form */}
          <div className="lg:col-span-7 p-6 rounded-3xl bg-[#1C0324] border border-[#D4AF37]/25 shadow-xl space-y-6">
            <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#F5D061]" />
              <span>Select Sweets for Counter Sale</span>
            </h2>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-white/70 font-semibold mb-1.5">Select Mithai Item</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setSelectedProductId(pid);
                    const p = products.find((pr) => pr.id === pid);
                    if (p && p.variants.length > 0) {
                      setSelectedVariantId(p.variants[0].id);
                    }
                  }}
                  className="w-full bg-[#16031E] border border-white/20 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white text-sm outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {currentProduct && currentProduct.variants.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/70 font-semibold mb-1.5">Package Portion / Size</label>
                    <select
                      value={selectedVariantId}
                      onChange={(e) => setSelectedVariantId(e.target.value)}
                      className="w-full bg-[#16031E] border border-white/20 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white text-sm outline-none"
                    >
                      {currentProduct.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.variant_name} — ₹{v.price} ({v.stock_quantity} left)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-white/70 font-semibold mb-1.5">Units / Boxes</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={saleQuantity}
                        onChange={(e) => setSaleQuantity(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-[#16031E] border border-white/20 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white font-bold text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddItemToSaleCart}
                        className="px-4 py-3 rounded-xl gold-gradient-btn font-bold text-xs shrink-0 flex items-center gap-1 shadow-md"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cart Preview in Terminal */}
            <div className="pt-4 border-t border-white/10">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-3">
                Items in Counter Transaction ({saleCart.length})
              </h3>

              {saleCart.length === 0 ? (
                <p className="text-xs text-white/40 italic py-4 text-center">
                  No items added yet. Select a sweet and click Add.
                </p>
              ) : (
                <div className="divide-y divide-white/5 rounded-2xl bg-white/5 border border-white/10 p-3">
                  {saleCart.map((item) => (
                    <div key={item.variantId} className="py-2.5 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-semibold text-white block">{item.productName}</span>
                        <span className="text-[#D3BEB0] text-[11px]">
                          {item.variantName} × {item.quantity} (@ ₹{item.price})
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-serif font-bold text-[#F5D061]">
                          ₹{item.price * item.quantity}
                        </span>
                        <button
                          onClick={() => handleRemoveItem(item.variantId)}
                          className="text-white/40 hover:text-red-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Checkout & Billing */}
          <div className="lg:col-span-5 p-6 rounded-3xl bg-[#1C0324] border-2 border-[#D4AF37]/35 shadow-xl space-y-6">
            <h2 className="text-lg font-serif font-bold text-[#FFF8EE] flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-[#F5D061]" />
              <span>Billing & Payment Method</span>
            </h2>

            <form onSubmit={handleRecordSale} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={`py-3 px-4 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                    paymentMethod === "cash"
                      ? "bg-emerald-950 text-emerald-300 border-emerald-400 shadow-lg"
                      : "bg-[#16031E] text-white/60 border-white/10"
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Cash Payment</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("upi")}
                  className={`py-3 px-4 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                    paymentMethod === "upi"
                      ? "bg-purple-950 text-purple-300 border-purple-400 shadow-lg"
                      : "bg-[#16031E] text-white/60 border-white/10"
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>UPI Payment</span>
                </button>
              </div>

              <div>
                <label className="block text-white/70 font-semibold mb-1">
                  Discount (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-[#16031E] border border-white/20 rounded-xl px-3 py-2 text-white font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-white/70 font-semibold mb-1">
                  Customer Name (Optional)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Walk-in Customer / Society Box"
                  className="w-full bg-[#16031E] border border-white/20 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              {/* Total Calculation */}
              <div className="pt-4 border-t border-white/10 space-y-2">
                <div className="flex justify-between text-white/70">
                  <span>Gross Subtotal</span>
                  <span>₹{cartSubtotal}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-rose-400">
                    <span>Discount</span>
                    <span>-₹{discountAmount}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-white/10 flex justify-between text-base font-bold text-white">
                  <span>Collected Amount</span>
                  <span className="text-2xl font-serif text-[#F5D061]">₹{finalSaleTotal}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || saleCart.length === 0}
                className={`w-full py-3.5 rounded-full font-bold text-sm shadow-xl transition-all ${
                  saleCart.length === 0 || isSubmitting
                    ? "bg-white/10 text-white/40 cursor-not-allowed"
                    : "gold-gradient-btn"
                }`}
              >
                {isSubmitting ? "Recording..." : `Confirm Counter Sale (₹${finalSaleTotal})`}
              </button>
            </form>
          </div>
        </div>

        {/* Counter Sales History Table */}
        <div className="p-6 rounded-3xl bg-[#1C0324] border border-[#D4AF37]/25 shadow-xl">
          <h2 className="text-lg font-serif font-bold text-white mb-4 flex items-center gap-2">
            <Banknote className="w-5 h-5 text-[#F5D061]" />
            <span>Recorded Counter Transactions</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/50 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Sale ID</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Items</th>
                  <th className="py-2.5 px-3">Payment</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Cashier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-white/5">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#F5D061]">
                      {s.sale_number}
                    </td>
                    <td className="py-2.5 px-3 text-white/60">
                      {new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-2.5 px-3 text-white">
                      {s.items.map((it) => `${it.product_name_snapshot} (${it.quantity})`).join(", ")}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white/10 text-white">
                        {s.payment_method}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-serif font-bold text-white">
                      ₹{s.total_amount}
                    </td>
                    <td className="py-2.5 px-3 text-white/50">{s.created_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
