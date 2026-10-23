"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Product, InventoryMovement } from "@/types";
import {
  Layers,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  History,
  Check,
  RefreshCw,
  Search,
} from "lucide-react";

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<{
    id: string;
    productName: string;
    variantName: string;
    currentStock: number;
  } | null>(null);

  const [quantityChange, setQuantityChange] = useState<number>(10);
  const [movementType, setMovementType] = useState<
    "addition" | "reduction" | "correction" | "wastage"
  >("addition");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [prodRes, movRes] = await Promise.all([
        fetch("/api/products?admin=true"),
        fetch("/api/inventory"),
      ]);
      if (prodRes.ok) setProducts(await prodRes.json());
      if (movRes.ok) setMovements(await movRes.json());
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariant || !reason.trim()) return;

    // Calculate signed quantity
    let change = Math.abs(quantityChange);
    if (movementType === "reduction" || movementType === "wastage") {
      change = -change;
    }

    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variant_id: selectedVariant.id,
          quantity_change: change,
          movement_type: movementType,
          reason,
          created_by: "Admin",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback(`Stock adjusted successfully. New stock: ${data.newStock}`);
        setSelectedVariant(null);
        setReason("");
        fetchData();
      } else {
        setFeedback(data.error || "Failed to adjust stock.");
      }
    } catch {
      setFeedback("Failed to submit stock adjustment.");
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-[#FFF8EE]">
              Inventory & <span className="gold-gradient-text">Stock Audit</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#D3BEB0] mt-1">
              Log fresh batches, record kitchen wastage, update threshold alerts, and track historical movements.
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

        {feedback && (
          <div className="p-4 rounded-2xl bg-white/5 border border-[#D4AF37]/40 text-xs text-[#F5D061] flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Current Stock Levels Grid */}
        <div className="p-6 rounded-3xl bg-[#1C0324] border border-[#D4AF37]/25 shadow-xl">
          <h2 className="text-lg font-serif font-bold text-white mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#F5D061]" />
            <span>Live Portion Stock Quantities</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/50 uppercase text-[10px]">
                  <th className="py-3 px-3">Sweet Name</th>
                  <th className="py-3 px-3">Portion / Unit</th>
                  <th className="py-3 px-3">Unit Price</th>
                  <th className="py-3 px-3">Available Stock</th>
                  <th className="py-3 px-3">Threshold Alert</th>
                  <th className="py-3 px-3 text-right">Adjust Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {products.flatMap((prod) =>
                  prod.variants.map((variant) => {
                    const isLow = variant.stock_quantity <= variant.low_stock_threshold;
                    return (
                      <tr key={variant.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-3 font-semibold text-white">
                          {prod.name}
                        </td>
                        <td className="py-3 px-3 text-white/80">
                          {variant.variant_name} ({variant.unit})
                        </td>
                        <td className="py-3 px-3 font-serif font-bold text-[#F5D061]">
                          ₹{variant.price}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              isLow
                                ? "bg-red-950 text-red-300 border border-red-500/40"
                                : "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                            }`}
                          >
                            {variant.stock_quantity} left
                          </span>
                        </td>
                        <td className="py-3 px-3 text-white/60">
                          ≤ {variant.low_stock_threshold} units
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() =>
                              setSelectedVariant({
                                id: variant.id,
                                productName: prod.name,
                                variantName: variant.variant_name,
                                currentStock: variant.stock_quantity,
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-[#D4AF37] hover:text-[#16031E] border border-white/10 text-xs font-semibold transition-all"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stock Adjustment Modal */}
        {selectedVariant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl bg-[#1C0324] border-2 border-[#D4AF37]/50 p-6 shadow-2xl space-y-5 text-xs">
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-serif font-bold text-white">
                    Adjust Stock
                  </h3>
                  <p className="text-xs text-[#F5D061] mt-0.5">
                    {selectedVariant.productName} ({selectedVariant.variantName})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedVariant(null)}
                  className="p-1 rounded-full text-white/50 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleStockAdjustment} className="space-y-4">
                <div>
                  <span className="text-white/60 block mb-1">Current Stock:</span>
                  <span className="text-xl font-bold font-serif text-white">
                    {selectedVariant.currentStock} units
                  </span>
                </div>

                <div>
                  <label className="block text-white/80 font-semibold mb-1">Adjustment Type</label>
                  <select
                    value={movementType}
                    onChange={(e: any) => setMovementType(e.target.value)}
                    className="w-full bg-[#16031E] border border-white/20 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="addition">Addition (Fresh production batch)</option>
                    <option value="reduction">Reduction (Inventory count adjustment)</option>
                    <option value="wastage">Wastage (Spoilage / damaged box)</option>
                    <option value="correction">Correction</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white/80 font-semibold mb-1">Quantity Units</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quantityChange}
                    onChange={(e) => setQuantityChange(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-[#16031E] border border-white/20 rounded-xl px-3 py-2 text-white font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-white/80 font-semibold mb-1">Reason / Note *</label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Afternoon fresh batch from kitchen"
                    className="w-full bg-[#16031E] border border-white/20 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedVariant(null)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl gold-gradient-btn font-bold text-[#16031E]"
                  >
                    Confirm Adjustment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Audit Log / Movement History */}
        <div className="p-6 rounded-3xl bg-[#1C0324] border border-[#D4AF37]/25 shadow-xl">
          <h2 className="text-lg font-serif font-bold text-white mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-[#F5D061]" />
            <span>Inventory Movement Audit Trail</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/50 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Date / Time</th>
                  <th className="py-2.5 px-3">Sweet & Portion</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Change</th>
                  <th className="py-2.5 px-3">Stock After</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-white/5">
                    <td className="py-2.5 px-3 text-white/60">
                      {new Date(m.created_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {m.product_name} ({m.variant_name})
                    </td>
                    <td className="py-2.5 px-3 capitalize text-white/80">
                      {m.movement_type.replace(/_/g, " ")}
                    </td>
                    <td className="py-2.5 px-3 font-bold font-mono">
                      <span className={m.quantity_change > 0 ? "text-emerald-400" : "text-rose-400"}>
                        {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-white/90">{m.stock_after}</td>
                    <td className="py-2.5 px-3 text-white/70 max-w-xs truncate">{m.reason}</td>
                    <td className="py-2.5 px-3 text-white/50">{m.created_by}</td>
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
