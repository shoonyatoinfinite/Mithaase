"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Order } from "@/types";
import {
  Search,
  X,
  MapPin,
  Phone,
  Truck,
  ExternalLink,
  CheckCircle2,
  Package,
  Clock,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Smartphone,
  Banknote,
} from "lucide-react";

export function AdminQuickOrderTracker() {
  const [digits, setDigits] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchedOrder, setSearchedOrder] = useState<Order | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = async (queryDigits?: string) => {
    const inputDigits = (queryDigits !== undefined ? queryDigits : digits).trim();
    if (!inputDigits) {
      setErrorMsg("Please enter the last 4 digits of the order number.");
      return;
    }

    setIsSearching(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/orders?search=${encodeURIComponent(inputDigits)}`);
      if (!res.ok) throw new Error("Failed to look up orders");
      const list: Order[] = await res.json();

      // Find the order ending with or containing those digits
      const matched = list.find((o) =>
        o.order_number.endsWith(inputDigits) || o.order_number.includes(inputDigits)
      );

      if (matched) {
        setSearchedOrder(matched);
        setIsOpen(true);
      } else {
        setErrorMsg(`No active order found ending in "${inputDigits}".`);
        setSearchedOrder(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to find order.");
      setSearchedOrder(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
    setDigits(val);
    setErrorMsg("");

    if (val.length === 4) {
      handleSearch(val);
    }
  };

  const cleanPhone = (searchedOrder?.customer_phone || "").replace(/[^0-9]/g, "");
  const mapsUrl =
    searchedOrder?.map_url ||
    (searchedOrder?.latitude && searchedOrder?.longitude
      ? `https://www.google.com/maps?q=${searchedOrder.latitude},${searchedOrder.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${searchedOrder?.delivery_address}, ${searchedOrder?.locality}`
        )}`);

  return (
    <div className="relative w-full sm:w-auto">
      {/* Search Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        className="flex items-center gap-2 w-full"
      >
        <div className="relative flex-1 min-w-0 w-full sm:w-auto sm:min-w-[280px]">
          <Search className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-3" />
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={digits}
            onChange={handleInputChange}
            placeholder="Track: Last 4 digits (e.g. 1004)"
            className="w-full bg-[#1A0322] border border-[#D4AF37]/40 focus:border-[#F5D061] rounded-xl pl-10 pr-16 py-2 text-xs text-white placeholder-white/40 font-mono outline-none shadow-inner"
          />
          {digits && (
            <button
              type="button"
              onClick={() => {
                setDigits("");
                setSearchedOrder(null);
                setIsOpen(false);
                setErrorMsg("");
              }}
              className="absolute right-9 top-2.5 text-white/40 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="submit"
            disabled={isSearching}
            className="absolute right-2 top-1.5 px-2 py-1 rounded-lg bg-[#D4AF37]/20 hover:bg-[#D4AF37]/40 text-[#F5D061] text-[10px] font-bold"
          >
            {isSearching ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Track"}
          </button>
        </div>
      </form>

      {errorMsg && (
        <div className="absolute top-full left-0 mt-1.5 z-50 p-2.5 rounded-xl bg-red-950/95 border border-red-500/50 text-red-200 text-xs shadow-xl animate-fadeIn flex items-center gap-1.5 max-w-[calc(100vw-2rem)]">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Real-time Order Quick Tracker Popover */}
      {isOpen && searchedOrder && (
        <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 z-50 w-full sm:w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl bg-[#1C0324] border-2 border-[#D4AF37] shadow-[0_10px_40px_rgba(0,0,0,0.85)] p-4 text-xs text-white space-y-3 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div>
              <span className="text-[10px] text-[#F5D061] font-bold uppercase tracking-wider block">
                Real-Time Order Tracking
              </span>
              <strong className="text-sm font-serif font-black text-white">
                {searchedOrder.order_number}
              </strong>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-950 border border-amber-500/40 text-amber-300">
                {searchedOrder.order_status.replace(/_/g, " ")}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-white/50 text-[10px] block">Customer</span>
                <span className="font-bold text-white block">{searchedOrder.customer_name}</span>
                <a
                  href={`tel:+91${cleanPhone}`}
                  className="text-[#F5D061] hover:underline flex items-center gap-1 font-mono text-[11px]"
                >
                  <Phone className="w-3 h-3" />
                  <span>+91 {searchedOrder.customer_phone}</span>
                </a>
              </div>

              <div className="text-right">
                <span className="text-white/50 text-[10px] block">Amount</span>
                <span className="font-serif font-bold text-[#F5D061] text-sm">
                  ₹{searchedOrder.total_amount}
                </span>
                <span className="text-[10px] text-white/70 block uppercase">
                  {searchedOrder.payment_method === "upi" ? "⚡ UPI Online" : "💰 COD"}
                </span>
              </div>
            </div>

            {/* Address & GPS */}
            <div className="p-2 rounded-xl bg-white/[0.03] border border-white/10 space-y-1 text-[11px]">
              <div className="flex items-start gap-1.5 text-white/90">
                <MapPin className="w-3 h-3 text-[#F5D061] shrink-0 mt-0.5" />
                <span>
                  {searchedOrder.delivery_address}, {searchedOrder.locality}
                </span>
              </div>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#F5D061] hover:underline flex items-center gap-1 font-bold pt-0.5"
              >
                <Truck className="w-3 h-3" />
                <span>Go to Pinned Doorstep Location</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            {/* Sweets items */}
            <div className="text-[11px] space-y-1">
              <span className="text-white/50 block font-semibold">Items:</span>
              <div className="max-h-20 overflow-y-auto space-y-0.5 pr-1">
                {searchedOrder.items.map((it) => (
                  <div key={it.id} className="flex justify-between text-white/80">
                    <span>
                      {it.product_name_snapshot} ({it.variant_name_snapshot})
                    </span>
                    <strong className="text-[#F5D061] font-mono">× {it.quantity}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Link */}
          <div className="pt-2 border-t border-white/10 flex justify-end gap-2">
            <Link
              href={`/order-confirmation/${searchedOrder.id}`}
              target="_blank"
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#F5D061] font-bold text-[11px] flex items-center gap-1"
            >
              <span>Live Tracker</span>
              <ExternalLink className="w-3 h-3" />
            </Link>

            <Link
              href={`/admin/orders?selected=${searchedOrder.id}`}
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 rounded-lg gold-gradient-btn font-bold text-[11px] flex items-center gap-1"
            >
              <span>Manage Order</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
