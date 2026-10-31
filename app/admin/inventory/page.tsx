"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Product, InventoryMovement, ProductDemandSummary } from "@/types";
import {
  Layers,
  Sparkles,
  History,
  Check,
  RefreshCw,
  MessageCircle,
  AlertCircle,
  Users,
  ChevronDown,
  ChevronUp,
  Loader2,
  Calendar,
} from "lucide-react";

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [demands, setDemands] = useState<ProductDemandSummary[]>([]);
  const [activeTab, setActiveTab] = useState<"stock" | "demands" | "history">("stock");
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

  const [expandedDemandProductId, setExpandedDemandProductId] = useState<string | null>(null);
  const [isNotifyingProductId, setIsNotifyingProductId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [prodRes, movRes, demRes] = await Promise.all([
        fetch("/api/products?admin=true"),
        fetch("/api/inventory"),
        fetch("/api/admin/demands"),
      ]);
      if (prodRes.ok) setProducts(await prodRes.json());
      if (movRes.ok) setMovements(await movRes.json());
      if (demRes.ok) {
        const d = await demRes.json();
        setDemands(d.demands || []);
      }
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

  const handleFulfillDemands = async (productId: string, productName: string) => {
    if (!confirm(`Are you sure you want to approve this fresh batch of ${productName} and send WhatsApp notifications to all interested customers?`)) {
      return;
    }

    setIsNotifyingProductId(productId);
    try {
      const res = await fetch("/api/admin/demands/fulfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback(`🎉 Success! WhatsApp notification sent to ${data.count} customer(s) for ${productName}.`);
        fetchData();
      } else {
        setFeedback(data.error || "Failed to dispatch WhatsApp messages.");
      }
    } catch {
      setFeedback("Network error while notifying customers.");
    } finally {
      setIsNotifyingProductId(null);
    }
  };

  const highDemandCount = demands.filter((d) => d.isTargetReached).length;

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-[#FFF8EE]">
              Inventory, Stock & <span className="gold-gradient-text">10+ KG Demands</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#D3BEB0] mt-1">
              Log fresh batches, record kitchen wastage, monitor 10+ kg special batch demands, and audit movements.
            </p>
          </div>

          <button
            onClick={() => fetchData()}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#D4AF37] border border-[#D4AF37]/30 flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* 10+ KG High Demand Alert Banner if any sweet is ready for batch preparation */}
        {highDemandCount > 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-[#D4AF37]/20 to-amber-500/20 border-2 border-[#D4AF37] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-xl">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-amber-400/20 text-[#F5D061] shrink-0">
                <Sparkles className="w-5 h-5 animate-spin" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#F5D061]">
                  🎯 10+ KG Special Batch Demand Reached! ({highDemandCount} sweet{highDemandCount > 1 ? "s" : ""})
                </h3>
                <p className="text-xs text-[#FFF8EE]/80 mt-0.5">
                  Community pre-order requests have crossed the 10 kg threshold. You can now prepare a kitchen batch and notify customers.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("demands")}
              className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#F5D061] text-[#16031E] font-bold text-xs shrink-0 transition-colors shadow-md cursor-pointer"
            >
              View 10+ KG Demands
            </button>
          </div>
        )}

        {feedback && (
          <div className="p-4 rounded-2xl bg-white/5 border border-[#D4AF37]/40 text-xs text-[#F5D061] flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("stock")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "stock"
                ? "bg-[#D4AF37] text-[#16031E] shadow-md"
                : "bg-white/5 text-[#D3BEB0] hover:text-white hover:bg-white/10"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Live Portion Stock Quantities</span>
          </button>

          <button
            onClick={() => setActiveTab("demands")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer relative ${
              activeTab === "demands"
                ? "bg-[#D4AF37] text-[#16031E] shadow-md"
                : "bg-white/5 text-[#D3BEB0] hover:text-white hover:bg-white/10"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Special Batch Demands (10+ KG Target)</span>
            {demands.length > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  highDemandCount > 0
                    ? "bg-rose-500 text-white animate-pulse"
                    : "bg-white/20 text-white"
                }`}
              >
                {demands.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "history"
                ? "bg-[#D4AF37] text-[#16031E] shadow-md"
                : "bg-white/5 text-[#D3BEB0] hover:text-white hover:bg-white/10"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Stock Movement Audit Trail</span>
          </button>
        </div>

        {/* TAB 1: Live Portion Stock Levels Grid */}
        {activeTab === "stock" && (
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
                      const isOut = variant.stock_quantity <= 0;
                      const isLow = !isOut && variant.stock_quantity <= variant.low_stock_threshold;
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
                                isOut
                                  ? "bg-rose-950 text-rose-300 border border-rose-500/50"
                                  : isLow
                                  ? "bg-amber-950 text-amber-300 border border-amber-500/40"
                                  : "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                              }`}
                            >
                              {isOut ? "0 left (Sold Out)" : `${variant.stock_quantity} left`}
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
                              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-[#D4AF37] hover:text-[#16031E] border border-white/10 text-xs font-semibold transition-all cursor-pointer"
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
        )}

        {/* TAB 2: Special Batch Demands (10+ KG Goal) */}
        {activeTab === "demands" && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-[#1C0324] border border-[#D4AF37]/25 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div>
                  <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#F5D061]" />
                    <span>Customer Special Batch Requests & Pre-orders</span>
                  </h2>
                  <p className="text-xs text-[#D3BEB0] mt-0.5">
                    Customers express interest for out-of-stock sweets. Once total requested quantity reaches 10 kg, prepare the batch and send auto-WhatsApp alerts!
                  </p>
                </div>
              </div>

              {demands.length === 0 ? (
                <div className="py-12 text-center text-[#D3BEB0] space-y-2">
                  <Sparkles className="w-8 h-8 text-[#D4AF37]/40 mx-auto" />
                  <p className="text-sm font-semibold">No pending customer requests at the moment.</p>
                  <p className="text-xs text-white/40">
                    When items go out of stock, customers can request fresh batches from the storefront.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {demands.map((item) => {
                    const isExpanded = expandedDemandProductId === item.productId;
                    const percent = Math.min(100, Math.round((item.totalKg / 10.0) * 100));
                    const isTargetReached = item.isTargetReached;

                    return (
                      <div
                        key={item.productId}
                        className={`rounded-2xl border transition-all ${
                          isTargetReached
                            ? "bg-gradient-to-r from-[#2B0733] to-[#1C0324] border-[#D4AF37] shadow-xl"
                            : "bg-white/5 border-white/10"
                        } p-5 space-y-4`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            {item.imageUrl && (
                              <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-[#D4AF37]/30 shrink-0 bg-[#16031E]">
                                <Image
                                  src={item.imageUrl}
                                  alt={item.productName}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-serif font-bold text-white">
                                  {item.productName}
                                </h3>
                                {isTargetReached ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/20 text-[#F5D061] border border-amber-500/40 animate-pulse">
                                    🎯 10+ KG Goal Reached!
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/10 text-white/70">
                                    {10 - item.totalKg > 0 ? `${(10 - item.totalKg).toFixed(1)} kg needed` : "In Progress"}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-[#D3BEB0] mt-1">
                                <span>
                                  Total Demand: <strong className="text-[#F5D061]">{item.totalKg.toFixed(1)} kg</strong>
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5" />
                                  <strong>{item.customerCount} customers</strong>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Button: Approve & Send WhatsApp */}
                          <div className="flex items-center gap-2 self-start sm:self-center">
                            <button
                              type="button"
                              disabled={isNotifyingProductId === item.productId}
                              onClick={() => handleFulfillDemands(item.productId, item.productName)}
                              className="px-4 py-2.5 rounded-xl font-bold text-xs gold-gradient-btn flex items-center gap-2 shadow-lg disabled:opacity-50 transition-all cursor-pointer"
                            >
                              {isNotifyingProductId === item.productId ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Sending WhatsApp...</span>
                                </>
                              ) : (
                                <>
                                  <MessageCircle className="w-3.5 h-3.5 text-[#16031E]" />
                                  <span>Approve & Notify Customers</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setExpandedDemandProductId(isExpanded ? null : item.productId)
                              }
                              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                              title={isExpanded ? "Collapse Customers" : "View Customers"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar towards 10 KG */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-white/60">Community Batch Target Progress:</span>
                            <span className="font-bold text-[#F5D061]">{percent}% (10 kg Goal)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F5D061] transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>

                        {/* Expandable Customer Pre-order List */}
                        {isExpanded && (
                          <div className="pt-3 border-t border-white/10 space-y-3">
                            <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider">
                              Interested Customers for this Sweet ({item.demands.length} requests)
                            </h4>

                            <div className="overflow-x-auto rounded-xl border border-white/10">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="bg-white/5 border-b border-white/10 text-white/50 text-[10px] uppercase">
                                    <th className="py-2.5 px-3">Customer</th>
                                    <th className="py-2.5 px-3">WhatsApp Number</th>
                                    <th className="py-2.5 px-3">Quantity</th>
                                    <th className="py-2.5 px-3">Registered On</th>
                                    <th className="py-2.5 px-3">Notes</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {item.demands.map((d) => (
                                    <tr key={d.id} className="hover:bg-white/5">
                                      <td className="py-2 px-3 font-semibold text-white">
                                        {d.customer_name}
                                      </td>
                                      <td className="py-2 px-3 font-mono text-emerald-400">
                                        +91 {d.customer_phone.replace(/[^0-9]/g, "").slice(-10)}
                                      </td>
                                      <td className="py-2 px-3 font-bold text-[#F5D061]">
                                        {d.quantity_kg} kg
                                      </td>
                                      <td className="py-2 px-3 text-white/50">
                                        {new Date(d.created_at).toLocaleDateString("en-IN", {
                                          month: "short",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </td>
                                      <td className="py-2 px-3 text-white/70 italic max-w-xs truncate">
                                        {d.notes || "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Stock Movement Audit Trail */}
        {activeTab === "history" && (
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
        )}

        {/* Stock Adjustment Modal */}
        {selectedVariant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
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
                  className="p-1 rounded-full text-white/50 hover:text-white cursor-pointer"
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
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl gold-gradient-btn font-bold text-[#16031E] cursor-pointer"
                  >
                    Confirm Adjustment
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
