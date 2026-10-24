"use client";

import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Coupon, CouponDiscountType } from "@/types";
import {
  Ticket,
  Plus,
  Percent,
  Banknote,
  Truck,
  CheckCircle2,
  Trash2,
  Edit2,
  RefreshCw,
  AlertCircle,
  X,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Form State
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "flat_amount" | "none">("percentage");
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [includeFreeDelivery, setIncludeFreeDelivery] = useState<boolean>(false);
  const [minOrderAmount, setMinOrderAmount] = useState<number>(0);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number | undefined>(undefined);
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Coupons
  const fetchCoupons = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/coupons");
      const data = await res.json();
      if (Array.isArray(data)) {
        setCoupons(data);
      }
    } catch (e) {
      console.error("Failed to load coupons", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const openCreateModal = () => {
    setEditingCoupon(null);
    setCode("");
    setDescription("");
    setDiscountType("percentage");
    setDiscountValue(10);
    setIncludeFreeDelivery(false);
    setMinOrderAmount(0);
    setMaxDiscountAmount(undefined);
    setIsActive(true);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (c: Coupon) => {
    setEditingCoupon(c);
    setCode(c.code);
    setDescription(c.description || "");
    const isFreeDelOnly = c.discount_type === "free_delivery" && (!c.discount_value || c.discount_value <= 0);
    setDiscountType(isFreeDelOnly ? "none" : (c.discount_type as any));
    setDiscountValue(c.discount_value || 0);
    setIncludeFreeDelivery(Boolean(c.free_delivery || c.discount_type === "free_delivery" || c.code === "FREEDEL"));
    setMinOrderAmount(c.min_order_amount || 0);
    setMaxDiscountAmount(c.max_discount_amount);
    setIsActive(c.is_active);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 2) {
      setFormError("Please enter a valid coupon code (at least 2 characters).");
      return;
    }

    const hasDiscount = discountType !== "none" && discountValue > 0;
    if (!hasDiscount && !includeFreeDelivery) {
      setFormError("Please select a discount value or enable Free Delivery.");
      return;
    }

    const payloadDiscountType: CouponDiscountType = hasDiscount 
      ? (discountType as "percentage" | "flat_amount") 
      : "free_delivery";
    const payloadDiscountValue = hasDiscount ? Number(discountValue) : 0;

    setIsSubmitting(true);
    try {
      const payload = {
        code: cleanCode,
        description: description.trim(),
        discount_type: payloadDiscountType,
        discount_value: payloadDiscountValue,
        free_delivery: includeFreeDelivery || payloadDiscountType === "free_delivery",
        min_order_amount: Number(minOrderAmount) || 0,
        max_discount_amount: maxDiscountAmount ? Number(maxDiscountAmount) : undefined,
        is_active: isActive,
      };

      if (editingCoupon) {
        // Update existing coupon
        const res = await fetch(`/api/admin/coupons/${editingCoupon.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update coupon.");
        setActionNotice(`Coupon ${cleanCode} updated successfully!`);
      } else {
        // Create new coupon
        const res = await fetch("/api/admin/coupons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create coupon.");
        setActionNotice(`New coupon ${cleanCode} created successfully!`);
      }

      setIsModalOpen(false);
      fetchCoupons();
    } catch (err: any) {
      setFormError(err.message || "Operation failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (c: Coupon) => {
    try {
      const res = await fetch(`/api/admin/coupons/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !c.is_active }),
      });
      if (res.ok) {
        setActionNotice(`Coupon ${c.code} is now ${!c.is_active ? "ACTIVE" : "INACTIVE"}.`);
        fetchCoupons();
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteCoupon = async (c: Coupon) => {
    if (!confirm(`Are you sure you want to delete coupon ${c.code}?`)) return;
    try {
      const res = await fetch(`/api/admin/coupons/${c.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setActionNotice(`Coupon ${c.code} deleted.`);
        fetchCoupons();
      }
    } catch {
      // ignore
    }
  };

  // Metrics
  const totalCoupons = coupons.length;
  const activeCoupons = coupons.filter((c) => c.is_active).length;
  const totalRedemptions = coupons.reduce((sum, c) => sum + (c.usage_count || 0), 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <Ticket className="w-6 h-6 text-[#F5D061]" />
              <h1 className="text-2xl sm:text-3xl font-serif font-black text-white">
                Coupons & Offers
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#D3BEB0] mt-1">
              Configure promo codes, flat ₹ discounts, percentage off, free delivery, or combined offers
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchCoupons}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={openCreateModal}
              className="py-2.5 px-4 rounded-xl gold-gradient-btn text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Coupon</span>
            </button>
          </div>
        </div>

        {/* Notice Banner */}
        {actionNotice && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between gap-2 shadow-lg animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionNotice}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="text-white/60 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-[#1C0324] border border-[#D4AF37]/20 shadow-md">
            <span className="text-xs text-white/60 block font-semibold">Total Promo Codes</span>
            <span className="text-2xl font-serif font-black text-white mt-1 block">
              {totalCoupons}
            </span>
            <span className="text-[11px] text-[#D4AF37]">Available in system</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#1C0324] border border-[#D4AF37]/20 shadow-md">
            <span className="text-xs text-white/60 block font-semibold">Active Offers</span>
            <span className="text-2xl font-serif font-black text-emerald-400 mt-1 block">
              {activeCoupons}
            </span>
            <span className="text-[11px] text-white/40">Ready at checkout</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#1C0324] border border-[#D4AF37]/20 shadow-md">
            <span className="text-xs text-white/60 block font-semibold">Total Redemptions</span>
            <span className="text-2xl font-serif font-black text-[#F5D061] mt-1 block">
              {totalRedemptions}
            </span>
            <span className="text-[11px] text-white/40">Orders saved money</span>
          </div>
        </div>

        {/* Coupons List Table */}
        <div className="bg-[#1C0324] border border-[#D4AF37]/20 rounded-3xl p-5 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
            <h2 className="text-base sm:text-lg font-serif font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#F5D061]" />
              <span>Configured Promo Offers</span>
            </h2>
            <span className="text-xs text-white/50">{coupons.length} coupons</span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-white/50 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#F5D061]" />
              <span>Loading coupons...</span>
            </div>
          ) : coupons.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Ticket className="w-10 h-10 text-white/20 mx-auto" />
              <p className="text-sm font-bold text-white">No coupons created yet</p>
              <p className="text-xs text-white/40">Click Create Coupon to add your first promo offer.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-white/50 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Coupon Code</th>
                    <th className="py-3 px-4">Offer Breakdown</th>
                    <th className="py-3 px-4">Conditions</th>
                    <th className="py-3 px-4 text-center">Uses</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {coupons.map((c) => {
                    const isFreeDel = Boolean(c.free_delivery || c.discount_type === "free_delivery" || c.code === "FREEDEL");
                    const hasDiscount = c.discount_value > 0 && c.discount_type !== "free_delivery";
                    return (
                      <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                        {/* Code & Description */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#F5D061] shrink-0 font-bold">
                              %
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-sm text-white tracking-wider block">
                                  {c.code}
                                </span>
                                {c.code.toUpperCase() === "FREEDEL" && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                                    1st Order Only
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-white/50 block">
                                {c.description || (
                                  hasDiscount && isFreeDel
                                    ? `${c.discount_type === "percentage" ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`} + Free Delivery`
                                    : isFreeDel
                                    ? "Free Doorstep Delivery"
                                    : c.discount_type === "percentage"
                                    ? `${c.discount_value}% Festive Discount`
                                    : `Flat ₹${c.discount_value} OFF`
                                )}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Discount Offer */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {hasDiscount && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#D4AF37]/15 text-[#F5D061] border border-[#D4AF37]/30">
                                {c.discount_type === "percentage" && `${c.discount_value}% OFF`}
                                {c.discount_type === "flat_amount" && `₹${c.discount_value} FLAT OFF`}
                              </span>
                            )}
                            {isFreeDel && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <Truck className="w-3 h-3 text-emerald-400" />
                                <span>FREE DELIVERY</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Conditions */}
                        <td className="py-3.5 px-4 text-white/70">
                          <div>
                            <span>
                              Min Order:{" "}
                              <strong className="text-white">
                                {c.min_order_amount ? `₹${c.min_order_amount}` : "None"}
                              </strong>
                            </span>
                            {c.discount_type === "percentage" && c.max_discount_amount && (
                              <span className="block text-[11px] text-white/50">
                                Max Cap: ₹{c.max_discount_amount}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Uses */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 rounded-full bg-white/5 font-mono text-white/80 font-bold">
                            {c.usage_count || 0}
                          </span>
                        </td>

                        {/* Status Toggle */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(c)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                              c.is_active
                                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60"
                                : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                c.is_active ? "bg-emerald-400 animate-pulse" : "bg-white/30"
                              }`}
                            />
                            <span>{c.is_active ? "Active" : "Inactive"}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(c)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCoupon(c)}
                              className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create / Edit Coupon Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-lg bg-[#1C0324] border-2 border-[#D4AF37]/50 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 my-auto">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-[#F5D061]" />
                  <h3 className="text-lg font-serif font-bold text-white">
                    {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : "Create New Coupon Code"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-white/60 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                {/* Coupon Code */}
                <div>
                  <label className="block font-semibold text-white/80 mb-1">
                    Coupon Code <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. DIWALI50, SHUBH20, NEWDIS"
                    className="w-full bg-[#110115] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-white font-mono uppercase outline-none text-sm"
                  />
                  <span className="text-[10px] text-white/40 mt-1 block">
                    Customer enters this exact promo code at checkout.
                  </span>
                </div>

                {/* Description */}
                <div>
                  <label className="block font-semibold text-white/80 mb-1">
                    Customer Offer Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Flat ₹50 OFF + FREE Doorstep Delivery on orders above ₹299"
                    className="w-full bg-[#110115] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-white outline-none"
                  />
                </div>

                {/* Sweets Discount Type Selector */}
                <div>
                  <label className="block font-semibold text-white/80 mb-1.5">
                    Sweets Cart Discount
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDiscountType("percentage");
                        if (!discountValue) setDiscountValue(10);
                      }}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        discountType === "percentage"
                          ? "bg-[#D4AF37] text-[#16031E] font-bold border-[#F5D061]"
                          : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                      }`}
                    >
                      <Percent className="w-4 h-4 mx-auto mb-1" />
                      <span className="block text-[11px]">Percentage %</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDiscountType("flat_amount");
                        if (!discountValue) setDiscountValue(50);
                      }}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        discountType === "flat_amount"
                          ? "bg-[#D4AF37] text-[#16031E] font-bold border-[#F5D061]"
                          : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                      }`}
                    >
                      <Banknote className="w-4 h-4 mx-auto mb-1" />
                      <span className="block text-[11px]">Flat ₹ Off</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDiscountType("none");
                        setDiscountValue(0);
                        setIncludeFreeDelivery(true);
                      }}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        discountType === "none"
                          ? "bg-[#D4AF37] text-[#16031E] font-bold border-[#F5D061]"
                          : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                      }`}
                    >
                      <Truck className="w-4 h-4 mx-auto mb-1" />
                      <span className="block text-[11px]">No Cart Off</span>
                    </button>
                  </div>
                </div>

                {/* Discount Value Inputs */}
                {discountType !== "none" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-white/80 mb-1">
                        {discountType === "percentage" ? "Percentage Off (%)" : "Flat Amount Off (₹)"}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={discountType === "percentage" ? 100 : 5000}
                        value={discountValue || ""}
                        onChange={(e) => setDiscountValue(Number(e.target.value))}
                        className="w-full bg-[#110115] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-white outline-none"
                      />
                    </div>

                    {discountType === "percentage" && (
                      <div>
                        <label className="block font-semibold text-white/80 mb-1">
                          Max Discount Cap (₹) (Optional)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={maxDiscountAmount ?? ""}
                          onChange={(e) =>
                            setMaxDiscountAmount(e.target.value ? Number(e.target.value) : undefined)
                          }
                          placeholder="e.g. 150"
                          className="w-full bg-[#110115] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-white outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* COMBINED OFFER: Free Delivery Toggle Card */}
                <div
                  className={`p-3.5 rounded-2xl border transition-all ${
                    includeFreeDelivery
                      ? "bg-emerald-950/50 border-emerald-500/50 shadow-md"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          includeFreeDelivery
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-white/10 text-white/50"
                        }`}
                      >
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-white text-xs block">
                          Combine with 100% FREE Doorstep Delivery 🚚
                        </span>
                        <span className="text-[10px] text-white/50 block">
                          Waives the standard ₹21 delivery fee (valid for ALL customers, not just 1st order)
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={includeFreeDelivery}
                      onChange={(e) => setIncludeFreeDelivery(e.target.checked)}
                      className="w-5 h-5 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer shrink-0 ml-3"
                    />
                  </label>
                </div>

                {/* Offer Summary Preview */}
                <div className="p-3 rounded-xl bg-white/5 border border-[#D4AF37]/30 text-xs text-[#FFF8EE] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#F5D061] shrink-0" />
                  <div className="text-[11px]">
                    <strong className="text-[#F5D061]">Combined Offer Preview: </strong>
                    {discountType === "percentage" && discountValue > 0 ? `${discountValue}% OFF Subtotal` : ""}
                    {discountType === "flat_amount" && discountValue > 0 ? `Flat ₹${discountValue} OFF Subtotal` : ""}
                    {includeFreeDelivery && (discountValue > 0 && discountType !== "none" ? " + " : "")}
                    {includeFreeDelivery ? "100% FREE Doorstep Delivery (₹21 Saved)" : ""}
                    {!includeFreeDelivery && discountType === "none" ? "Please select a discount or enable free delivery" : ""}
                  </div>
                </div>

                {/* Min Order Value */}
                <div>
                  <label className="block font-semibold text-white/80 mb-1">
                    Minimum Order Value (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                    placeholder="0 for no minimum"
                    className="w-full bg-[#110115] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-white outline-none"
                  />
                  <span className="text-[10px] text-white/40 mt-1 block">
                    Coupon only applies if cart subtotal reaches this amount.
                  </span>
                </div>

                {/* Active Toggle */}
                <div className="pt-2 flex items-center justify-between border-t border-white/10">
                  <div>
                    <span className="font-semibold text-white block">Active Coupon</span>
                    <span className="text-[11px] text-white/50">
                      Enable for customer checkout immediately
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-5 h-5 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Buttons */}
                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 px-4 rounded-xl gold-gradient-btn font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{editingCoupon ? "Save Changes" : "Create Coupon"}</span>
                    )}
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
