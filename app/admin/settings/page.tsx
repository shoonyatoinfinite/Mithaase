"use client";

import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StoreSettings } from "@/types";
import { useStoreSettings } from "@/lib/context/store-context";
import {
  Settings,
  Store,
  Truck,
  Clock,
  Phone,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Save,
  Plus,
  X,
  Smartphone,
  ShieldAlert,
  Power,
  Receipt,
  EyeOff,
  RotateCcw,
} from "lucide-react";

export default function AdminSettingsPage() {
  const { settings, refreshSettings } = useStoreSettings();
  const [formData, setFormData] = useState<StoreSettings>(settings);
  const [isDirty, setIsDirty] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [newArea, setNewArea] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Only sync formData from server on initial load or when user has no unsaved local edits
  useEffect(() => {
    if (!isInitialized && settings) {
      setFormData(settings);
      setIsInitialized(true);
    } else if (!isDirty && settings) {
      setFormData(settings);
    }
  }, [settings, isDirty, isInitialized]);

  const updateField = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setSaveSuccess("");
    setErrorMessage("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess("");
    setErrorMessage("");

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const savedData = await res.json();
        setFormData(savedData);
        setIsDirty(false);
        setSaveSuccess("Store operating controls updated successfully!");
        await refreshSettings();
      } else {
        const errJson = await res.json().catch(() => ({}));
        setErrorMessage(errJson.error || "Failed to save settings.");
      }
    } catch {
      setErrorMessage("Network error saving settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddArea = () => {
    if (!newArea.trim()) return;
    if (!formData.service_areas.includes(newArea.trim())) {
      updateField("service_areas", [...formData.service_areas, newArea.trim()]);
    }
    setNewArea("");
  };

  const handleRemoveArea = (areaToRemove: string) => {
    updateField(
      "service_areas",
      formData.service_areas.filter((a) => a !== areaToRemove)
    );
  };

  const handleDiscard = () => {
    setFormData(settings);
    setIsDirty(false);
    setSaveSuccess("Discarded unsaved changes.");
    setErrorMessage("");
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="pb-6 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-[#FFF8EE]">
              Store Operating <span className="gold-gradient-text">Controls</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#D3BEB0] mt-1">
              Permanent store shutoff switch, emergency closure, delivery charges (default ₹21), timings, and shop contact information.
            </p>
          </div>

          {isDirty && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs shrink-0">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Unsaved Changes</span>
            </div>
          )}
        </div>

        {saveSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-red-950/90 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-8 text-xs">
          {/* Card 0: Permanent Store Shutoff Master Control */}
          <div
            className={`p-6 rounded-3xl border-2 transition-all shadow-2xl space-y-5 ${
              formData.store_shutoff || formData.store_status === "shutoff"
                ? "bg-gradient-to-br from-red-950/90 via-[#2B0515] to-[#16031E] border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.25)]"
                : "bg-[#1C0324] border-[#D4AF37]/25 hover:border-[#D4AF37]/40"
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldAlert
                    className={`w-5 h-5 ${
                      formData.store_shutoff || formData.store_status === "shutoff"
                        ? "text-red-400 animate-pulse"
                        : "text-[#D4AF37]"
                    }`}
                  />
                  <h2 className="text-base font-serif font-black text-white">
                    Permanent Store Shutoff (Shopping Disabled & Items Hidden)
                  </h2>
                </div>
                <p className="text-[11px] text-[#D3BEB0] max-w-xl">
                  Disables all shopping and completely hides listed sweets from the storefront. Customers can still log in to view their past orders and tax receipts.
                </p>
              </div>

              {/* Master Shutoff Toggle */}
              <button
                type="button"
                id="toggle-permanent-shutoff-btn"
                onClick={() => {
                  const newShutoff = !formData.store_shutoff;
                  setFormData((prev) => ({
                    ...prev,
                    store_shutoff: newShutoff,
                    store_status: newShutoff ? "shutoff" : "open",
                    accepts_orders: !newShutoff,
                  }));
                  setIsDirty(true);
                  setSaveSuccess("");
                }}
                className={`px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-2 transition-all shadow-lg active:scale-95 shrink-0 ${
                  formData.store_shutoff || formData.store_status === "shutoff"
                    ? "bg-red-600 hover:bg-red-500 text-white border border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                    : "bg-white/10 hover:bg-white/20 text-white/80 border border-white/20"
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>
                  {formData.store_shutoff || formData.store_status === "shutoff"
                    ? "SHUTOFF ACTIVE: ENABLED"
                    : "Store Active (Normal)"}
                </span>
              </button>
            </div>

            {/* Shutoff Active Warning Details */}
            {(formData.store_shutoff || formData.store_status === "shutoff") && (
              <div className="p-4 rounded-2xl bg-red-950/70 border border-red-500/50 text-xs text-red-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Store is currently Permanently Shut Off:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-red-200/90 pl-1">
                  <li>All listed sweets and catalog items are hidden from public visitors.</li>
                  <li>Cart checkout and Buy Now buttons are disabled.</li>
                  <li>Returning and new customers can still sign in to access their past orders and tax receipts.</li>
                </ul>
              </div>
            )}

            <div>
              <label className="block text-white/80 font-semibold mb-1 text-xs">
                Shutoff Notice Message (Displayed to customers on storefront, cart & receipts banner)
              </label>
              <textarea
                rows={3}
                value={formData.shutoff_message || ""}
                onChange={(e) => updateField("shutoff_message", e.target.value)}
                placeholder="Our online shopping portal is currently permanently shut off. All product listings and new order bookings are disabled. Customers can log in to view past orders and official receipts."
                className="w-full bg-[#16031E] border border-white/15 focus:border-red-400 rounded-xl px-4 py-2.5 text-white outline-none resize-none text-xs"
              />
            </div>
          </div>

          {/* Card 1: Store Operational Status */}
          <div className="p-6 rounded-3xl bg-[#1C0324] border border-[#D4AF37]/25 shadow-xl space-y-5">
            <h2 className="text-base font-serif font-bold text-white flex items-center gap-2">
              <Store className="w-4 h-4 text-[#F5D061]" />
              <span>Store Status & Online Order Acceptance</span>
            </h2>

            <div>
              <label className="block text-white/70 font-semibold mb-2">Store Operational Mode</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: "open", label: "Open", desc: "Accepting orders normally", color: "border-emerald-500 text-emerald-400" },
                  { id: "paused", label: "Paused", desc: "Rush hour pause", color: "border-amber-500 text-amber-400" },
                  { id: "closed", label: "Closed", desc: "Temporarily closed", color: "border-amber-500 text-amber-400" },
                  { id: "shutoff", label: "Shutoff", desc: "Items hidden & orders blocked", color: "border-red-500 text-red-400" },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      const isShutoff = mode.id === "shutoff";
                      setFormData((prev) => ({
                        ...prev,
                        store_status: mode.id as any,
                        store_shutoff: isShutoff,
                        accepts_orders: mode.id === "open",
                      }));
                      setIsDirty(true);
                      setSaveSuccess("");
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      formData.store_status === mode.id
                        ? `bg-white/10 ${mode.color} shadow-lg font-bold`
                        : "bg-[#16031E] border-white/10 text-white/50"
                    }`}
                  >
                    <span className="block text-sm font-bold capitalize">{mode.label}</span>
                    <span className="text-[10px] opacity-80">{mode.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-white/70 font-semibold mb-1">
                Announcement Message (Shown in top banner when open)
              </label>
              <textarea
                rows={2}
                value={formData.announcement_message}
                onChange={(e) => updateField("announcement_message", e.target.value)}
                className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2 text-white outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-white/70 font-semibold mb-1">
                Closure Message (Shown when store is paused/closed)
              </label>
              <textarea
                rows={2}
                value={formData.closure_message}
                onChange={(e) => updateField("closure_message", e.target.value)}
                className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2 text-white outline-none resize-none"
              />
            </div>
          </div>

          {/* Card 2: Delivery & Timings */}
          <div className="p-6 rounded-3xl bg-[#1C0324] border border-[#D4AF37]/25 shadow-xl space-y-5">
            <h2 className="text-base font-serif font-bold text-white flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#F5D061]" />
              <span>Delivery Charges & Localities</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/70 font-semibold mb-1">
                  Default Delivery Fee (₹) *
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={formData.default_delivery_fee}
                  onChange={(e) => updateField("default_delivery_fee", Number(e.target.value))}
                  className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-white font-bold text-sm outline-none"
                />
                <p className="text-[10px] text-white/50 mt-1">
                  Default: ₹21 per order for local town deliveries.
                </p>
              </div>

              <div>
                <label className="block text-white/70 font-semibold mb-1">
                  Minimum Order Value (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.minimum_order_value}
                  onChange={(e) => updateField("minimum_order_value", Number(e.target.value))}
                  className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-white font-bold text-sm outline-none"
                />
                <p className="text-[10px] text-white/50 mt-1">Set to 0 to allow any order amount.</p>
              </div>
            </div>

            {/* Shop Timings & Operating Hours Controls */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#F5D061]" />
                  <span>Shop Timing & Operating Hours Controls</span>
                </h3>
                <p className="text-[11px] text-white/60 mt-1">
                  Shop timings can vary depending on festival rush, sweet preparation batches, or special occasions. Any changes set here update across the customer storefront, FAQs, and delivery info in real time.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-white/70 font-semibold mb-1">Active Shop Timing (Counter Hours)</label>
                  <input
                    type="text"
                    value={formData.operating_hours}
                    onChange={(e) => updateField("operating_hours", e.target.value)}
                    placeholder="e.g. 8:00 AM - 10:00 PM"
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2 text-white font-semibold outline-none"
                  />
                  {/* Quick Timing Presets */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      "8:00 AM - 10:00 PM",
                      "7:00 AM - 11:00 PM",
                      "6:00 AM - Midnight",
                      "9:00 AM - 9:00 PM",
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => updateField("operating_hours", preset)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                          formData.operating_hours === preset
                            ? "bg-[#D4AF37] text-[#16031E] font-bold border-[#D4AF37]"
                            : "bg-white/5 border-white/10 text-white/70 hover:text-white"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-white/70 font-semibold mb-1">Daily Order Cutoff Time</label>
                  <input
                    type="text"
                    value={formData.cutoff_time}
                    onChange={(e) => updateField("cutoff_time", e.target.value)}
                    placeholder="e.g. 20:00 (8:00 PM)"
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2 text-white font-semibold outline-none"
                  />
                  {/* Quick Cutoff Presets */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      "20:00 (8:00 PM)",
                      "21:30 (9:30 PM)",
                      "22:00 (10:00 PM)",
                      "23:00 (11:00 PM)",
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => updateField("cutoff_time", preset)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                          formData.cutoff_time === preset
                            ? "bg-[#D4AF37] text-[#16031E] font-bold border-[#D4AF37]"
                            : "bg-white/5 border-white/10 text-white/70 hover:text-white"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Service Areas */}
            <div>
              <label className="block text-white/70 font-semibold mb-2">
                Supported Delivery Localities
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.service_areas.map((area) => (
                  <span
                    key={area}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#16031E] border border-[#D4AF37]/30 text-white"
                  >
                    <span>{area}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveArea(area)}
                      className="text-white/40 hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                  placeholder="Add new locality or village name..."
                  className="flex-1 bg-[#16031E] border border-white/15 rounded-xl px-4 py-2 text-white outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddArea}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold"
                >
                  Add Area
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Contact & UPI Details */}
          <div className="p-6 rounded-3xl bg-[#1C0324] border border-[#D4AF37]/25 shadow-xl space-y-5">
            <h2 className="text-base font-serif font-bold text-white flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#F5D061]" />
              <span>Contact & UPI Configuration</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/70 font-semibold mb-1">Business Calling Phone</label>
                <input
                  type="text"
                  value={formData.business_phone}
                  onChange={(e) => updateField("business_phone", e.target.value)}
                  className="w-full bg-[#16031E] border border-white/15 rounded-xl px-4 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-white/70 font-semibold mb-1">WhatsApp Hotline</label>
                <input
                  type="text"
                  value={formData.whatsapp_number}
                  onChange={(e) => updateField("whatsapp_number", e.target.value)}
                  className="w-full bg-[#16031E] border border-white/15 rounded-xl px-4 py-2 text-white outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/70 font-semibold mb-1">Official Store UPI ID</label>
                <input
                  type="text"
                  value={formData.upi_id}
                  onChange={(e) => updateField("upi_id", e.target.value)}
                  placeholder="e.g. shreeshyam@upi"
                  className="w-full bg-[#16031E] border border-white/15 rounded-xl px-4 py-2 text-white font-mono font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-white/70 font-semibold mb-1">UPI Payee Name</label>
                <input
                  type="text"
                  value={formData.upi_payee_name}
                  onChange={(e) => updateField("upi_payee_name", e.target.value)}
                  className="w-full bg-[#16031E] border border-white/15 rounded-xl px-4 py-2 text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-white/70 font-semibold mb-1">Shop Address</label>
              <input
                type="text"
                value={formData.shop_address}
                onChange={(e) => updateField("shop_address", e.target.value)}
                className="w-full bg-[#16031E] border border-white/15 rounded-xl px-4 py-2 text-white outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div>
              {isDirty && (
                <span className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Unsaved changes in form (background refresh paused)</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {isDirty && (
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white font-bold text-xs transition-all flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Discard Changes</span>
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="px-8 py-3.5 rounded-full gold-gradient-btn font-bold text-sm shadow-xl active:scale-95 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? "Saving Settings..." : "Save Operating Controls"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
