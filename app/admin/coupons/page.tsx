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
  const [discountType, setDiscountType] = useState<CouponDiscountType>("percentage");
  const [discountValue, setDiscountValue] = useState<number>(10);
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
    setDiscountType(c.discount_type);
    setDiscountValue(c.discount_value);
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

    if (discountType !== "free_delivery" && (!discountValue || discountValue <= 0)) {
      setFormError("Discount value must be greater than 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCoupon) {
        // Update existing coupon
        const res = await fetch(`/api/admin/coupons/${editingCoupon.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: cleanCode,
            description: description.trim(),
            discount_type: discountType,
            discount_value: discountType === "free_delivery" ? 0 : Number(discountValue),
            min_order_amount: Number(minOrderAmount) || 0,
            max_discount_amount: maxDiscountAmount ? Number(maxDiscountAmount) : undefined,
            is_active: isActive,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update coupon.");
        setActionNotice(`Coupon ${cleanCode} updated successfully!`);
      } else {
        // Create new coupon
        const res = await fetch("/api/admin/coupons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: cleanCode,
            description: description.trim(),
            discount_type: discountType,
            discount_value: discountType === "free_delivery" ? 0 : Number(discountValue),
            min_order_amount: Number(minOrderAmount) || 0,
            max_discount_amount: maxDiscountAmount ? Number(maxDiscountAmount) : undefined,
            is_active: isActive,
          }),
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
              Configure festive promo codes, flat ₹ discounts, percentage off, and free delivery
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
            <span className="text-[11px] text-white/50">Currently usable by customers</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#1C0324] border border-[#D4AF37]/20 shadow-md">
            <span className="text-xs text-white/60 block font-semibold">Total Redemptions</span>
            <span className="text-2xl font-serif font-black text-[#F5D061] mt-1 block">
              {totalRedemptions}
            </span>
            <span className="text-[11px] text-[#D4AF37]">Orders placed with coupons</span>
          </div>
        </div>

        {/* Coupons List Table */}
        <div className="rounded-3xl bg-[#1C0324] border border-[#D4AF37]/30 shadow-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#F5D061]" />
              <h3 className="font-serif font-bold text-white text-base">Configured Coupons</h3>
            </div>
            <span className="text-xs text-white/50">{coupons.length} coupons</span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-white/60 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-[#D4AF37]" />
              <span>Loading coupons...</span>
            </div>
          ) : coupons.length === 0 ? (
            <div className="p-12 text-center text-white/60 space-y-3">
              <Ticket className="w-10 h-10 text-white/30 mx-auto" />
              <p className="text-sm">No coupon codes configured yet.</p>
              <button
                onClick={openCreateModal}
                className="py-2 px-4 rounded-xl gold-gradient-btn text-xs font-bold"
              >
                + Create First Coupon
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-white/10 text-white/60 uppercase tracking-wider text-[11px] bg-white/[0.02]">
                    <th className="py-3.5 px-4 font-semibold">Code & Type</th>
                    <th className="py-3.5 px-4 font-semibold">Discount Offer</th>
                    <th className="py-3.5 px-4 font-semibold">Conditions</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Uses</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {coupons.map((c) => (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Code & Type */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#F5D061] shrink-0 font-bold">
                            {c.discount_type === "percentage" ? (
                              <Percent className="w-4 h-4" />
                            ) : c.discount_type === "free_delivery" ? (
                              <Truck className="w-4 h-4" />
                            ) : (
                              <Banknote className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <span className="font-mono font-bold text-sm text-white tracking-wider block">
                              {c.code}
                            </span>
                            <span className="text-[11px] text-white/50 block">
                              {c.description || (
                                c.discount_type === "percentage"
                                  ? `${c.discount_value}% Festive Discount`
                                  : c.discount_type === "free_delivery"
                                  ? "Free Delivery Offer"
                                  : `Flat ₹${c.discount_value} OFF`
                              )}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Discount Offer */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#D4AF37]/15 text-[#F5D061] border border-[#D4AF37]/30">
                          {c.discount_type === "percentage" && `${c.discount_value}% OFF`}
                          {c.discount_type === "flat_amount" && `₹${c.discount_value} FLAT OFF`}
                          {c.discount_type === "free_delivery" && "FREE DELIVERY"}
                        </span>
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
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 transition-colors"
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
                  ))}
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
                    placeholder="e.g. SHUBHDIWALI, DIWALI50, FREEDEL"
                    className="w-full bg-[#110115] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-white font-mono uppercase outline-none text-sm"
                  />
                  <span className="text-[10px] text-white/40 mt-1 block">
                    Customer enters this exact code at checkout.
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
                    placeholder="e.g. 10% Diwali Discount on orders above ₹200"
                    className="w-full bg-[#110115] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-white outline-none"
                  />
                </div>

                {/* Discount Type Selector */}
                <div>
                  <label className="block font-semibold text-white/80 mb-1.5">
                    Discount Type <span className="text-rose-400">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDiscountType("percentage")}
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
                      onClick={() => setDiscountType("flat_amount")}
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
                      onClick={() => setDiscountType("free_delivery")}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        discountType === "free_delivery"
                          ? "bg-[#D4AF37] text-[#16031E] font-bold border-[#F5D061]"
                          : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                      }`}
                    >
                      <Truck className="w-4 h-4 mx-auto mb-1" />
                      <span className="block text-[11px]">Free Delivery</span>
                    </button>
                  </div>
                </div>

                {/* Discount Value (if not free delivery) */}
                {discountType !== "free_delivery" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-white/80 mb-1">
                        {discountType === "percentage" ? "Percentage Off (%)" : "Flat Amount Off (₹)"}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={discountType === "percentage" ? 100 : 5000}
                        value={discountValue}
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
