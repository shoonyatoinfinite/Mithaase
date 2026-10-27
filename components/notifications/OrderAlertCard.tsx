"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Order } from "@/types";
import {
  Bell,
  X,
  MapPin,
  Phone,
  Truck,
  ExternalLink,
  CheckCircle2,
  Package,
  Eye,
  Banknote,
  Smartphone,
  ShieldCheck,
  Clock,
  Bike,
  Check,
  Zap,
} from "lucide-react";

interface OrderAlertCardProps {
  order: Order;
  title: string;
  subtitle?: string;
  badgeType?: "new_order" | "packed_ready";
  mode?: "admin" | "rider";
  onDismiss: () => void;
  onAccept?: (order: Order) => Promise<void> | void;
  onDeliver?: (order: Order) => Promise<void> | void;
  onQueue?: (order: Order) => void;
  actionHref?: string;
  actionLabel?: string;
}

export function OrderAlertCard({
  order,
  title,
  subtitle,
  badgeType = "new_order",
  mode,
  onDismiss,
  onAccept,
  onDeliver,
  onQueue,
  actionHref,
  actionLabel = "View Details",
}: OrderAlertCardProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(10);
  const [selectedImageModal, setSelectedImageModal] = useState<{ url: string; title: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const isRiderMode = mode === "rider" || badgeType === "packed_ready";

  const handleQueueClick = () => {
    if (onQueue) {
      onQueue(order);
    } else {
      onDismiss();
    }
  };

  const handleAcceptClick = async () => {
    setIsProcessing(true);
    try {
      if (onAccept) {
        await onAccept(order);
      } else {
        await fetch(`/api/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_status: "confirmed",
            note: "Order accepted by Admin via alert card",
            changed_by: "Admin",
          }),
        });
        setActionFeedback("✅ Order Accepted!");
        setTimeout(() => onDismiss(), 600);
      }
    } catch (e) {
      console.error("Accept order error:", e);
      onDismiss();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeliverClick = async () => {
    setIsProcessing(true);
    try {
      if (onDeliver) {
        await onDeliver(order);
      } else {
        await fetch(`/api/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_status: "out_for_delivery",
            note: "Delivery accepted by rider",
            changed_by: "Rider",
          }),
        });
        setActionFeedback("🛵 Out for Delivery!");
        setTimeout(() => onDismiss(), 600);
      }
    } catch (e) {
      console.error("Deliver order error:", e);
      onDismiss();
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleQueueClick();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onDismiss]);

  const custName = order.customer_name || (order as any).name || "Customer";
  const custPhone = order.customer_phone || (order as any).phone || "";
  const cleanPhone = custPhone.replace(/[^0-9]/g, "");
  const deliveryAddr = order.delivery_address || (order as any).address || "";
  const locality = order.locality || "";
  const fullAddress = [deliveryAddr, locality].filter(Boolean).join(", ") || "Kothal Kalan";
  const mapsUrl =
    order.map_url ||
    (order.latitude && order.longitude
      ? `https://www.google.com/maps?q=${order.latitude},${order.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`);

  return (
    <>
      <div className="fixed top-3 sm:top-4 left-3 right-3 sm:left-auto sm:right-4 z-[999999] max-w-md sm:w-full animate-slideInRight">
        <div className="rounded-3xl bg-[#1D0325] border-2 border-[#D4AF37] shadow-[0_10px_40px_rgba(0,0,0,0.9)] overflow-hidden text-[#FFF8EE] flex flex-col">
          {/* Top 10-Second Progress Countdown Bar */}
          <div className="w-full h-1.5 bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F5D061] transition-all duration-1000 ease-linear"
              style={{ width: `${(secondsRemaining / 10) * 100}%` }}
            />
          </div>

          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-[#3B0E4D] to-[#1C0324]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#D4AF37] text-[#16031E] flex items-center justify-center font-bold shadow-md animate-bounce">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#F5D061] block">
                  {badgeType === "new_order" ? "⚡ New Online Order" : "🛵 Packed & Ready"}
                </span>
                <h3 className="text-base font-serif font-black text-white leading-tight">
                  {order.order_number}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#F5D061] px-2 py-0.5 rounded-full bg-black/40 border border-[#D4AF37]/30">
                {secondsRemaining}s
              </span>
              <button
                type="button"
                onClick={onDismiss}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body Information */}
          <div className="p-4 space-y-3 text-xs">
            {/* Customer & Location */}
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/10">
              <div>
                <span className="text-white/50 text-[10px] block">Customer</span>
                <strong className="text-sm text-white block">{custName}</strong>
                {custPhone ? (
                  <a
                    href={`tel:+91${cleanPhone}`}
                    className="text-[#F5D061] hover:underline flex items-center gap-1 mt-0.5 font-mono text-[11px]"
                  >
                    <Phone className="w-3 h-3" />
                    <span>+91 {custPhone}</span>
                  </a>
                ) : (
                  <span className="text-white/40 text-[10px]">No phone recorded</span>
                )}
              </div>

              <div className="text-right">
                <span className="text-white/50 text-[10px] block">Total Amount</span>
                <span className="text-lg font-serif font-black text-[#F5D061]">
                  ₹{order.total_amount}
                </span>
              </div>
            </div>

            {/* Address & Google Maps Pin */}
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#F5D061] shrink-0 mt-0.5" />
                <span className="text-white/90 text-xs leading-snug">
                  {fullAddress}
                </span>
              </div>
              {order.landmark && (
                <div className="text-[11px] text-[#F5D061] pl-5">
                  Landmark: {order.landmark}
                </div>
              )}
              {order.delivery_instructions && (
                <div className="text-[10px] text-amber-200/80 pl-5 italic">
                  Note: {order.delivery_instructions}
                </div>
              )}
              <div className="pt-1 flex items-center justify-between">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#2B0E38] hover:bg-[#3D144F] border border-[#D4AF37]/50 text-[#F5D061] text-[11px] font-bold shadow-sm transition-all"
                >
                  <Truck className="w-3 h-3" />
                  <span>Go to Location (Google Maps)</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>

                {order.latitude && order.longitude && (
                  <span className="text-[10px] text-emerald-400 font-mono">
                    📍 Pin Verified
                  </span>
                )}
              </div>
            </div>

            {/* Purchased Sweets Preview */}
            <div className="space-y-1 text-white/80">
              <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider block">
                Sweets in Order ({order.items?.length || 0}):
              </span>
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                {order.items && order.items.length > 0 ? (
                  order.items.map((it: any, idx: number) => {
                    const itemName = it.product_name_snapshot || it.productName || it.name || "Sweet Box";
                    const itemVariant = it.variant_name_snapshot || it.variantName || it.unit || "";
                    const itemImg = it.image_url || it.imageUrl;
                    const itemQty = it.quantity || 1;
                    return (
                      <div
                        key={it.id || `${it.product_id || it.productId || idx}-${it.variant_id || it.variantId || idx}`}
                        className="flex justify-between items-center text-[11px] bg-black/20 px-2 py-1.5 rounded-lg border border-white/5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {itemImg && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedImageModal({
                                  url: itemImg,
                                  title: `${itemName} ${itemVariant ? `(${itemVariant})` : ""}`,
                                })
                              }
                              className="w-6 h-6 rounded shrink-0 overflow-hidden border border-white/20 hover:border-[#D4AF37] transition-all"
                              title="Click to view item image"
                            >
                              <img
                                src={itemImg}
                                alt={itemName}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          )}
                          <span className="truncate">
                            {itemName} {itemVariant ? `(${itemVariant})` : ""}
                          </span>
                        </div>
                        <strong className="text-[#F5D061] font-mono shrink-0 ml-1">× {itemQty}</strong>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[11px] text-white/50 italic px-2 py-1">
                    Order details loading...
                  </div>
                )}
              </div>
            </div>

            {/* Payment Details & Screenshot Proof */}
            <div className="p-2.5 rounded-xl bg-black/30 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-white/50 block">Payment Method</span>
                  <span className="font-bold flex items-center gap-1.5 text-xs">
                    {order.payment_method === "cod" ? (
                      <>
                        <Banknote className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-amber-300">Cash on Delivery (COD)</span>
                        <span className="text-[10px] text-amber-200/80 font-normal">
                          ({order.payment_status === "paid" ? "Paid ✓" : `Collect ₹${order.total_amount}`})
                        </span>
                      </>
                    ) : order.upi_reference?.toLowerCase().startsWith("youpi:") ? (
                      <>
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Auto-Confirmed UPI</span>
                        <span className="text-[10px] text-emerald-400 font-mono">
                          (Verified ✓)
                        </span>
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-purple-300">Manual UPI</span>
                        {order.upi_reference && (
                          <span className="text-[10px] text-[#F5D061] font-mono">
                            (UTR: {order.upi_reference})
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </div>

                {(order.payment_method === "upi" || order.upi_screenshot) && order.upi_screenshot && (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedImageModal({
                        url: order.upi_screenshot!,
                        title: `UPI Payment Proof (Ref: ${order.upi_reference || "Attached"})`,
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-purple-950 hover:bg-purple-900 border border-purple-500/50 text-purple-200 text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all"
                  >
                    <Eye className="w-3 h-3 text-[#F5D061]" />
                    <span>View Image 📸</span>
                  </button>
                )}
              </div>

              {/* Prominent Image Preview Banner if UPI Screenshot Attached */}
              {order.upi_screenshot && (
                <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-500/30 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedImageModal({
                          url: order.upi_screenshot!,
                          title: `Customer UPI Proof - Ref: ${order.upi_reference || "Verified"}`,
                        })
                      }
                      className="relative group shrink-0"
                    >
                      <img
                        src={order.upi_screenshot}
                        alt="UPI Proof"
                        className="w-10 h-10 rounded object-cover border border-purple-400 group-hover:scale-105 transition-transform"
                      />
                      <span className="absolute inset-0 bg-black/40 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 text-[8px] text-white">
                        Zoom
                      </span>
                    </button>
                    <div className="text-[10px]">
                      <span className="text-purple-300 font-bold block">📸 UPI Screenshot Proof</span>
                      <span className="text-white/60">Amount: ₹{order.total_amount}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedImageModal({
                        url: order.upi_screenshot!,
                        title: `Customer UPI Proof - Ref: ${order.upi_reference || "Verified"}`,
                      })
                    }
                    className="text-[10px] text-[#F5D061] underline hover:text-white"
                  >
                    Click to enlarge
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons: Accept / Deliver / Queue */}
          <div className="p-3 bg-[#16031E] border-t border-white/10 flex items-center justify-between gap-2">
            {actionFeedback ? (
              <div className="w-full py-2 px-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-bold text-center animate-fadeIn">
                {actionFeedback}
              </div>
            ) : (
              <>
                <div>
                  {actionHref ? (
                    <Link
                      href={actionHref}
                      onClick={onDismiss}
                      className="text-[11px] text-[#F5D061] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>{actionLabel}</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  ) : (
                    <span className="text-[10px] text-white/40 font-mono">
                      Auto-queues in {secondsRemaining}s
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Option 1: Queue */}
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleQueueClick}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border border-white/15"
                    title="Keep in Queue"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Queue</span>
                  </button>

                  {/* Option 2: Accept (Admin) or Deliver (Rider) */}
                  {isRiderMode ? (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleDeliverClick}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-[#D4AF37] hover:from-amber-400 hover:to-[#F5D061] text-[#16031E] text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-900/40 transition-all active:scale-95"
                    >
                      {isProcessing ? (
                        <span className="w-3.5 h-3.5 border-2 border-[#16031E] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Bike className="w-4 h-4 text-[#16031E]" />
                      )}
                      <span>Deliver</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleAcceptClick}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-900/40 transition-all active:scale-95"
                    >
                      {isProcessing ? (
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      )}
                      <span>Accept</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Enlarged Image Preview Modal */}
      {selectedImageModal && (
        <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="relative max-w-lg w-full bg-[#1C0324] border-2 border-[#D4AF37] rounded-3xl p-5 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <span className="text-xs text-[#F5D061] font-bold">Image Preview</span>
                <h4 className="text-white font-bold text-sm">{selectedImageModal.title}</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedImageModal(null)}
                className="p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative max-h-[65vh] overflow-auto rounded-xl border border-white/20 bg-black flex items-center justify-center p-1">
              <img
                src={selectedImageModal.url}
                alt="Enlarged preview"
                className="max-h-[65vh] max-w-full object-contain rounded-lg"
              />
            </div>

            <div className="text-xs text-[#D3BEB0] flex justify-between items-center pt-2">
              <span>Order: #{order.order_number}</span>
              <span className="font-bold text-emerald-400">Total: ₹{order.total_amount}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
