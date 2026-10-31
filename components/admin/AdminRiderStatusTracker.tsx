"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Order, Rider } from "@/types";
import {
  Bike,
  Search,
  X,
  Phone,
  MapPin,
  ExternalLink,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Package,
} from "lucide-react";

export function AdminRiderStatusTracker() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const [ridersRes, ordersRes] = await Promise.all([
        fetch("/api/admin/riders"),
        fetch("/api/orders?status=out_for_delivery"),
      ]);

      if (ridersRes.ok) {
        const ridersData: Rider[] = await ridersRes.json();
        setRiders(ridersData || []);
        if (ridersData && ridersData.length > 0 && !selectedRider) {
          setSelectedRider(ridersData[0]);
        }
      }

      if (ordersRes.ok) {
        const ordersData: Order[] = await ordersRes.json();
        setActiveOrders(ordersData || []);
      }
    } catch {
      setErrorMsg("Failed to load rider fleet data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // Determine which active orders belong to a specific rider
  const getRiderActiveOrders = (rider: Rider): Order[] => {
    if (!rider) return [];
    const rName = rider.name.toLowerCase().trim();
    const rPhone = rider.phone.replace(/[^0-9]/g, "").slice(-10);
    const rId = rider.id.toLowerCase();

    return activeOrders.filter((order) => {
      if (order.order_status !== "out_for_delivery") return false;

      // Check status history for who marked it out_for_delivery
      const historyEntry = order.status_history?.find(
        (h) => h.new_status === "out_for_delivery"
      );
      if (historyEntry) {
        const changedBy = (historyEntry.changed_by || "").toLowerCase();
        const note = (historyEntry.note || "").toLowerCase();
        if (
          changedBy.includes(rName) ||
          note.includes(rName) ||
          (rPhone && (changedBy.includes(rPhone) || note.includes(rPhone))) ||
          changedBy.includes(rId)
        ) {
          return true;
        }
      }

      // Check note or general history
      const hasNoteMatch = (order.status_history || []).some((h) =>
        (h.note || "").toLowerCase().includes(rName)
      );
      return hasNoteMatch;
    });
  };

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanQ = query.trim().toLowerCase();
    if (!cleanQ) {
      setErrorMsg("Please enter a rider ID, mobile number, or name.");
      return;
    }
    setErrorMsg("");

    const matched = riders.find((r) => {
      const phoneDigits = r.phone.replace(/[^0-9]/g, "");
      return (
        r.id.toLowerCase().includes(cleanQ) ||
        r.name.toLowerCase().includes(cleanQ) ||
        phoneDigits.includes(cleanQ) ||
        (r.assigned_area && r.assigned_area.toLowerCase().includes(cleanQ))
      );
    });

    if (matched) {
      setSelectedRider(matched);
    } else {
      setErrorMsg(`No rider found matching "${query}".`);
    }
  };

  return (
    <>
      {/* Top Nav Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#F5D061] text-xs font-bold border border-white/10 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
        title="Check Live Rider Status (Delivering vs Free)"
      >
        <span>🛵 Riders</span>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center animate-fadeIn"
        >
          <div className="relative w-full max-w-2xl bg-[#1C0526] text-[#FFF8EE] rounded-3xl border border-[#D4AF37]/40 shadow-2xl overflow-hidden p-5 sm:p-7 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center text-[#F5D061] shadow-inner">
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-lg sm:text-xl text-white">
                    Rider Live Status Tracker
                  </h3>
                  <p className="text-[11px] text-[#D3BEB0]">
                    Real-time fleet activity: check if a rider is <strong className="text-emerald-400">Free</strong> or <strong className="text-amber-400">Delivering</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchData}
                  disabled={isLoading}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                  title="Refresh Rider Status"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#D4AF37]" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/70 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Close Tracker"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Rider ID / Phone Search Form */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setErrorMsg("");
                  }}
                  placeholder="Enter Rider ID, Phone (+91...) or Name..."
                  className="w-full bg-[#2A083B] border border-white/15 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2.5 rounded-xl gold-gradient-btn text-xs font-black shrink-0 shadow-md cursor-pointer"
              >
                Track Status
              </button>
            </form>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Quick Fleet Select Chips */}
            {riders.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[#D3BEB0] uppercase tracking-wider block">
                  Select Rider to Inspect:
                </span>
                <div className="flex flex-wrap gap-2">
                  {riders.map((r) => {
                    const activeCount = getRiderActiveOrders(r).length;
                    const isBusy = activeCount > 0;
                    const isSelected = selectedRider?.id === r.id;

                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedRider(r);
                          setErrorMsg("");
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#D4AF37]/20 border-[#D4AF37] text-white shadow-md ring-1 ring-[#D4AF37]"
                            : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isBusy ? "bg-amber-400 shadow-[0_0_8px_#F59E0B]" : "bg-emerald-400 shadow-[0_0_8px_#10B981]"
                          }`}
                        />
                        <span>{r.name}</span>
                        <span className="text-[10px] opacity-70 font-mono">
                          {isBusy ? `(${activeCount} Out)` : "(Free)"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Selected Rider Card */}
            {selectedRider ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#280838] border border-[#D4AF37]/30 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-serif font-black text-base sm:text-lg text-white">
                        {selectedRider.name}
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                        ID: {selectedRider.id.slice(0, 8)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#D3BEB0] mt-1 font-mono">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-[#D4AF37]" />
                        +91 {selectedRider.phone}
                      </span>
                      {selectedRider.assigned_area && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#D4AF37]" />
                          {selectedRider.assigned_area}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Big Status Badge */}
                  <div>
                    {getRiderActiveOrders(selectedRider).length > 0 ? (
                      <div className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-300 font-bold text-xs flex items-center gap-2 shadow-sm">
                        <Bike className="w-4 h-4 animate-bounce text-amber-400" />
                        <span>🛵 DELIVERING ({getRiderActiveOrders(selectedRider).length} Active)</span>
                      </div>
                    ) : (
                      <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-bold text-xs flex items-center gap-2 shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>🟢 FREE / AVAILABLE</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Details & Active Deliveries */}
                {getRiderActiveOrders(selectedRider).length > 0 ? (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-amber-300 block">
                      Currently Delivering These Orders:
                    </span>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {getRiderActiveOrders(selectedRider).map((ord) => (
                        <div
                          key={ord.id}
                          className="p-3 rounded-xl bg-black/30 border border-amber-400/30 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <strong className="text-white font-mono">#{ord.order_number}</strong>
                              <span className="text-white/60">•</span>
                              <span className="text-[#F5D061] font-semibold">{ord.customer_name}</span>
                            </div>
                            <p className="text-[11px] text-[#D3BEB0] leading-snug">
                              📍 {ord.delivery_address}, {ord.locality}
                            </p>
                            <span className="text-[10px] text-white/50 font-mono block">
                              Phone: +91 {ord.customer_phone}
                            </span>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-white block">
                              ₹{ord.total_amount}
                            </span>
                            <span className="text-[10px] text-amber-400 font-semibold block">
                              {ord.payment_method === "cod" ? "COD" : "UPI"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                    <p className="text-xs font-bold text-emerald-300">
                      Rider is currently free and idle.
                    </p>
                    <p className="text-[11px] text-emerald-200/70">
                      No active orders out for delivery. Ready to receive next dispatch batch.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {/* Footer Quick Links */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#D3BEB0] border-t border-white/10">
              <span>Fleet fleet data syncs live with active dispatches.</span>
              <div className="flex items-center gap-3">
                <Link
                  href="/rider"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-[#F5D061] hover:underline font-bold"
                >
                  <span>Open Rider Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/admin/riders"
                  className="inline-flex items-center gap-1 text-white/80 hover:text-white hover:underline"
                >
                  <span>Manage Fleet Settings</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

