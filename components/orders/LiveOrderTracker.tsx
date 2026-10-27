"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUserAuth } from "@/lib/context/user-auth-context";
import { Order, OrderStatus, PaymentStatus, StoreSettings } from "@/types";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { Diya } from "@/components/animations/Diya";
import { OrderReceipt } from "@/components/orders/OrderReceipt";
import { PaymentSelectionModal } from "@/components/checkout/PaymentSelectionModal";
import {
  CheckCircle2,
  Package,
  Truck,
  MessageSquare,
  Clock,
  Sparkles,
  RefreshCw,
  Receipt,
  AlertCircle,
  Bike,
  ShieldCheck,
  ArrowRight,
  Phone,
  Lock,
} from "lucide-react";

interface LiveOrderTrackerProps {
  initialOrder: Order;
  settings: StoreSettings;
}

const statusSteps: { key: OrderStatus; label: string; desc: string }[] = [
  { key: "pending_confirmation", label: "Request Placed", desc: "Received at sweet workshop" },
  { key: "confirmed", label: "Confirmed", desc: "Verified & queued for batching" },
  { key: "preparing", label: "Packing Fresh", desc: "Fresh sweets boxed with love" },
  { key: "ready_for_dispatch", label: "Ready", desc: "Sealed & assigned to delivery" },
  { key: "out_for_delivery", label: "Out for Delivery", desc: "En route to your doorstep pin" },
  { key: "delivered", label: "Delivered", desc: "Delivered fresh for Diwali" },
];

function getOrderStatusHeadline(status: OrderStatus, order?: Order) {
  if (order?.booking_status === "requested") {
    return {
      title: "After-Hours Booking",
      highlight: "Request Received 🌙",
      desc: "Store is currently closed. We have received your booking request details. No payment is required right now! Once our store manager approves, payment options will be unlocked for you.",
      iconColor: "text-amber-400 bg-amber-950/80 border-amber-400",
    };
  }
  if (order?.booking_status === "approved_for_payment") {
    return {
      title: "Booking Request Approved!",
      highlight: "Select Payment 💳",
      desc: "Great news! Our store manager approved your booking. Please choose your payment method below to finalize your order.",
      iconColor: "text-emerald-400 bg-emerald-950/80 border-emerald-400",
    };
  }
  if (order?.booking_status === "payment_selected") {
    return {
      title: "Payment Submitted —",
      highlight: "Awaiting Final Confirmation ⏳",
      desc: "Your payment preference has been recorded. Our store manager is reconfirming your order for fulfillment.",
      iconColor: "text-sky-400 bg-sky-950/80 border-sky-400",
    };
  }

  const isManualUpiPending =
    order &&
    order.payment_method === "upi" &&
    (!order.upi_reference?.startsWith("youpi:") || order.payment_status === "pending_verification") &&
    status === "pending_confirmation";

  if (isManualUpiPending) {
    return {
      title: "Manual Payment Received —",
      highlight: "Awaiting Admin Verification",
      desc: "Your order is NOT placed yet. Our admin is verifying your payment reference number. Once verified, your order will be confirmed and sent to the halwai workshop.",
      iconColor: "text-amber-400 bg-amber-950/80 border-amber-400",
    };
  }

  switch (status) {
    case "pending_confirmation":
      return {
        title: "Thank You! Your Order is",
        highlight: "Booked",
        desc: "Awaiting confirmation from our halwai workshop in Kothal Kalan.",
        iconColor: "text-amber-400 bg-amber-950/80 border-amber-400",
      };
    case "confirmed":
      return {
        title: "Order Confirmed &",
        highlight: "Verified",
        desc: "Our halwais have verified your booking and queued your fresh batch.",
        iconColor: "text-emerald-400 bg-emerald-950/80 border-emerald-400",
      };
    case "preparing":
      return {
        title: "Packing Fresh Diwali",
        highlight: "Mithai",
        desc: "Your sweets are being prepared in 100% pure desi ghee with love.",
        iconColor: "text-[#F5D061] bg-[#3B0E4D] border-[#D4AF37]",
      };
    case "ready_for_dispatch":
      return {
        title: "Packed & Sealed for",
        highlight: "Dispatch",
        desc: "Sealed in Diwali gift box and handed over to our Kothal Kalan rider fleet.",
        iconColor: "text-blue-400 bg-blue-950/80 border-blue-400",
      };
    case "out_for_delivery":
      return {
        title: "Out for Delivery! Rider",
        highlight: "On Road",
        desc: "Our delivery rider is navigating directly to your pinned doorstep location.",
        iconColor: "text-amber-400 bg-amber-950/80 border-amber-400",
      };
    case "delivered":
      return {
        title: "Order Successfully",
        highlight: "Delivered! 🎉",
        desc: "Your fresh festive sweets have been delivered to your doorstep. Happy Diwali!",
        iconColor: "text-emerald-400 bg-emerald-950/80 border-emerald-400",
      };
    case "cancelled":
      return {
        title: "Order",
        highlight: "Cancelled",
        desc: "This festival order has been cancelled.",
        iconColor: "text-rose-400 bg-rose-950/80 border-rose-400",
      };
    default:
      return {
        title: "Order Status",
        highlight: "Updated",
        desc: "Live order tracking active.",
        iconColor: "text-white bg-white/10 border-white/20",
      };
  }
}

export function LiveOrderTracker({ initialOrder, settings }: LiveOrderTrackerProps) {
  const router = useRouter();
  const { isAuthenticated, isHydrated } = useUserAuth();
  const [order, setOrder] = useState<Order>(initialOrder);
  const [lastUpdatedNotice, setLastUpdatedNotice] = useState<string | null>(null);
  const [pulseNewStatus, setPulseNewStatus] = useState<boolean>(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const handleSelectApprovedPayment = async (data: {
    paymentMethod: "cod" | "upi";
    upiReference?: string;
    upiScreenshot?: string;
  }) => {
    setIsSubmittingPayment(true);
    setPaymentError("");
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_status: "payment_selected",
          payment_method: data.paymentMethod,
          upi_reference: data.upiReference,
          upi_screenshot: data.upiScreenshot,
        }),
      });
      const updated = await res.json();
      if (!res.ok) {
        throw new Error(updated.error || "Failed to submit payment selection.");
      }
      setOrder(updated);
      setIsPaymentModalOpen(false);
    } catch (err: any) {
      setPaymentError(err.message || "Failed to submit payment selection.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Tracking page is publicly accessible to any customer with their order link

  // Pull latest order state from API
  const refreshOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${initialOrder.id}?t=${Date.now()}`);
      if (res.ok) {
        const fresh: Order = await res.json();
        setOrder((prev) => {
          if (
            prev.order_status !== fresh.order_status ||
            prev.payment_status !== fresh.payment_status
          ) {
            setLastUpdatedNotice(
              `⚡ Status updated: "${fresh.order_status.replace(/_/g, " ").toUpperCase()}"`
            );
            setPulseNewStatus(true);
            setTimeout(() => setPulseNewStatus(false), 3500);
          }
          return fresh;
        });
      }
    } catch {
      // ignore
    }
  }, [initialOrder.id]);

  // Hook into Real-Time Event Broadcaster via SSE
  const { isConnected } = useRealtime({
    events: ["order_status_updated"],
    enablePollingFallback: true,
    pollingIntervalMs: 3500,
    onEvent: (payload) => {
      if (payload.data?.id === order.id || payload.data?.order_number === order.order_number) {
        setOrder((prev) => {
          const newStatus = (payload.data.order_status || prev.order_status) as OrderStatus;
          const newPay = (payload.data.payment_status || prev.payment_status) as PaymentStatus;
          const newBooking = (payload.data.booking_status || prev.booking_status);
          if (prev.order_status !== newStatus || prev.payment_status !== newPay || prev.booking_status !== newBooking) {
            setLastUpdatedNotice(
              `⚡ Live update: Order status is now "${newStatus.replace(/_/g, " ").toUpperCase()}"!`
            );
            setPulseNewStatus(true);
            setTimeout(() => setPulseNewStatus(false), 4000);
          }
          return {
            ...prev,
            order_status: newStatus,
            payment_status: newPay,
            booking_status: newBooking,
          };
        });
      } else if (payload.data?.isFallbackTick) {
        refreshOrder();
      }
    },
  });

  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    await refreshOrder();
    setTimeout(() => setIsManualRefreshing(false), 500);
  };

  const currentStepIndex = statusSteps.findIndex((s) => s.key === order.order_status);
  const isDelivered = order.order_status === "delivered";
  const isPaid = order.payment_status === "paid";
  const isCancelled = order.order_status === "cancelled";
  const isManualUpiPending =
    order.booking_status !== "requested" &&
    order.booking_status !== "approved_for_payment" &&
    order.payment_method === "upi" &&
    (!order.upi_reference?.startsWith("youpi:") || order.payment_status === "pending_verification") &&
    order.order_status === "pending_confirmation";
  const headline = getOrderStatusHeadline(order.order_status, order);

  const cleanPhone = settings.whatsapp_number.replace(/[^0-9]/g, "");
  const whatsappTrackUrl = `https://wa.me/${cleanPhone}?text=Hello%20Shree%20Shyam%20Sweets,%20I%20am%20inquiring%20about%20my%20order%20${order.order_number}`;

  if (isHydrated && !isAuthenticated) {
    return (
      <div className="py-20 text-center space-y-3">
        <p className="text-sm text-[#D3BEB0]">Session ended. Redirecting to shop...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full max-w-full">
      {/* ============================================================== */}
      {/* DYNAMIC HEADER: Updates according to live order updates!        */}
      {/* ============================================================== */}
      <div className="text-center">
        <div
          className={`inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 shadow-2xl mb-4 transition-all duration-500 ${
            headline.iconColor
          } ${pulseNewStatus ? "scale-110 animate-bounce" : ""}`}
        >
          {isDelivered ? (
            <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
          ) : order.order_status === "out_for_delivery" ? (
            <Bike className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" />
          ) : order.order_status === "preparing" ? (
            <Package className="w-8 h-8 sm:w-10 sm:h-10" />
          ) : isManualUpiPending ? (
            <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400 animate-pulse" />
          ) : (
            <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <Diya size="sm" />
          <h1 className="text-2xl sm:text-4xl font-serif font-black text-[#FFF8EE] transition-all">
            {headline.title} <span className="gold-gradient-text">{headline.highlight}</span>
          </h1>
          <Diya size="sm" />
        </div>

        <p className="text-xs sm:text-sm text-[#D3BEB0] max-w-md mx-auto leading-relaxed">
          {headline.desc}
        </p>

        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
          <span className="text-white/50">Order Number:</span>
          <strong className="text-[#F5D061] font-mono tracking-wider">{order.order_number}</strong>
        </div>

        {/* AFTER-HOURS BOOKING REQUEST RECEIVED BANNER */}
        {order.booking_status === "requested" && (
          <div className="mt-5 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-purple-950/90 via-[#23042A] to-purple-950/90 border-2 border-[#D4AF37]/70 shadow-2xl text-left space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center text-[#F5D061] shrink-0 shadow-inner">
                <Clock className="w-5 h-5 animate-pulse text-[#F5D061]" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    After-Hours Booking Request Received — No Upfront Payment Required
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#D4AF37]/20 text-[#F5D061] border border-[#D4AF37]/40">
                    Awaiting Store Approval
                  </span>
                </div>
                <p className="text-xs text-[#E8D4C8] leading-relaxed">
                  Our shop is currently closed for instant deliveries. We have received your booking request for <strong>₹{order.total_amount != null ? order.total_amount : order.subtotal}</strong>. Our store manager will review your request. <strong>No payment is needed right now</strong>. Once approved, you will be notified right here to select your payment method (UPI or COD).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* APPROVED FOR PAYMENT ACTION CARD */}
        {order.booking_status === "approved_for_payment" && (
          <div className="mt-5 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-950/95 via-[#1E0528] to-emerald-950/95 border-2 border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.3)] text-left space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300 shrink-0 shadow-inner">
                <Sparkles className="w-6 h-6 text-emerald-300 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-serif font-black text-white">
                    🎉 Booking Request Approved by Store Manager!
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-emerald-100/90 leading-relaxed">
                  Your booking request for <strong>₹{order.total_amount != null ? order.total_amount : order.subtotal}</strong> has been approved! Please choose your payment method (Online UPI or Cash on Delivery) now to finalize your order.
                </p>
              </div>
            </div>

            {paymentError && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              className="w-full py-4 px-6 rounded-2xl gold-gradient-btn text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all text-[#16031E] cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Choose Payment Method (UPI / Cash on Delivery)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* PAYMENT SELECTED - AWAITING FINAL REAPPROVAL */}
        {order.booking_status === "payment_selected" && (
          <div className="mt-5 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-950/90 via-[#1E062B] to-sky-950/90 border-2 border-sky-400/70 shadow-2xl text-left space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-400/20 border border-sky-400/50 flex items-center justify-center text-sky-300 shrink-0 shadow-inner">
                <Clock className="w-5 h-5 animate-pulse text-sky-400" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Payment Submitted — Awaiting Store Manager Reapproval
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-400/20 text-sky-300 border border-sky-400/40">
                    Final Confirmation
                  </span>
                </div>
                <p className="text-xs text-sky-100/90 leading-relaxed">
                  You selected <strong>{order.payment_method === "upi" ? "Online UPI" : "Cash on Delivery (COD)"}</strong>
                  {order.payment_method === "upi" && order.upi_reference ? ` (Ref: ${order.upi_reference})` : ""}.
                  Our store manager will reapprove and confirm your order shortly for kitchen preparation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* MANUAL UPI URGENT ADMIN CONTACT & NOTICE BANNER */}
        {isManualUpiPending && (
          <div className="mt-5 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-950/90 via-[#22071F] to-amber-950/90 border-2 border-amber-400/60 shadow-2xl text-left space-y-3.5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
                <Clock className="w-5 h-5 animate-pulse text-amber-400" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Admin Verification Required Before Order Placement
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    Awaiting Verification
                  </span>
                </div>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  You submitted manual UPI Ref: <strong className="text-[#F5D061] font-mono">{order.upi_reference || "N/A"}</strong>. This order is <strong>not automatically confirmed</strong>. It will be accepted into the kitchen only after admin verification.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#16031E] border border-amber-400/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">Need your sweets urgently?</span>
                <span className="text-[11px] text-white/60">Contact the store admin right away to fast-track verification & batching</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <a
                  href={`tel:${settings.business_phone || "9306859388"}`}
                  className="flex-1 sm:flex-none py-2 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#16031E] font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <Phone className="w-3.5 h-3.5 text-[#16031E]" />
                  <span>Call Admin</span>
                </a>
                <a
                  href={`https://wa.me/91${(settings.business_phone || "9306859388").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                    `Hello Admin, I have submitted a manual UPI payment of ₹${order.total_amount} with Ref No: ${order.upi_reference} for Order ${order.order_number}. I need it urgently, please verify my payment and confirm the order.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp Admin</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Sync Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-[#D4AF37]/20 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isConnected ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isConnected ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          </span>
          <span className="text-xs font-semibold text-white/80">
            {isConnected ? "Real-time Live Sync Connected" : "Connecting Live Feed..."}
          </span>
          <span className="text-[10px] text-[#D4AF37] px-2 py-0.5 rounded-full bg-[#D4AF37]/10 font-mono hidden sm:inline-block">
            Auto-updates live
          </span>
        </div>

        <button
          onClick={handleManualRefresh}
          className="text-[11px] text-[#F5D061] hover:text-white flex items-center gap-1 font-medium transition-colors"
          title="Force refresh status"
        >
          <RefreshCw className={`w-3 h-3 ${isManualRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh Live</span>
        </button>
      </div>

      {/* Real-time Alert Toast if status was updated right now */}
      {lastUpdatedNotice && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950 to-[#25072F] border-2 border-emerald-400 text-emerald-200 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-[0_4px_25px_rgba(16,185,129,0.3)] animate-pulse">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{lastUpdatedNotice}</span>
          </div>
          <button
            onClick={() => setLastUpdatedNotice(null)}
            className="text-white/60 hover:text-white text-xs px-2 py-1 rounded bg-black/30"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Order Status Progress Tracker Box */}
      <div
        className={`p-5 sm:p-8 rounded-3xl bg-[#20052B] border transition-all duration-500 shadow-xl ${
          pulseNewStatus
            ? "border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.4)] scale-[1.01]"
            : "border-[#D4AF37]/35"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-white/10">
          <div>
            <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
              Live Stage
            </span>
            <h2 className="text-lg sm:text-xl font-serif font-bold text-[#FFF8EE] flex items-center gap-2">
              <span>{order.order_status.replace(/_/g, " ").toUpperCase()}</span>
              {isDelivered && <span className="text-emerald-400 text-sm">✓ Done</span>}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs px-3 py-1 rounded-full font-bold border flex items-center gap-1.5 ${
                order.payment_method === "upi"
                  ? "bg-purple-950/80 border-purple-500/50 text-purple-200"
                  : isPaid
                  ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-300"
                  : "bg-amber-950/80 border-amber-500/50 text-amber-300"
              }`}
            >
              {order.payment_method === "upi" ? (
                <>
                  <span>{isPaid ? "✅ Paid Online via UPI" : "⚡ Paid via UPI (Verified)"}</span>
                  {order.upi_reference && (
                    <span className="font-mono text-[10px] opacity-75">
                      • Ref: {order.upi_reference}
                    </span>
                  )}
                </>
              ) : isPaid ? (
                <span>✅ Payment: Paid in Full</span>
              ) : (
                <span>💰 Payment: Cash on Delivery (COD)</span>
              )}
            </span>
          </div>
        </div>

        {/* Progress Step Nodes */}
        {!isCancelled ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 pt-6">
            {statusSteps.map((step, idx) => {
              const isCompleted = currentStepIndex >= idx;
              const isCurrent = currentStepIndex === idx;

              return (
                <div
                  key={step.key}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    isCurrent
                      ? "bg-[#3B0820] border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.4)] scale-105"
                      : isCompleted
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                      : "bg-white/[0.02] border-white/5 opacity-50"
                  }`}
                >
                  <div
                    className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs font-bold mb-2 ${
                      isCurrent
                        ? "bg-[#D4AF37] text-[#16031E] animate-pulse"
                        : isCompleted
                        ? "bg-emerald-500 text-white"
                        : "bg-white/10 text-white/50"
                    }`}
                  >
                    {isCompleted ? "✓" : idx + 1}
                  </div>
                  <strong className="block text-xs text-white truncate font-semibold">
                    {step.label}
                  </strong>
                  <span className="text-[10px] text-[#D3BEB0] block mt-0.5 line-clamp-2">
                    {step.desc}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          /* Cancelled Order & Live Refund Tracking Box */
          <div className="pt-6">
            {order.refund_status === "refunded" || order.payment_status === "refunded" ? (
              <div className="p-5 sm:p-7 rounded-3xl bg-gradient-to-r from-emerald-950/90 via-[#1C0526] to-emerald-950/90 border-2 border-emerald-400 shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300 bg-emerald-900/60 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                      Refund Processed & Completed
                    </span>
                    <h3 className="text-lg sm:text-2xl font-serif font-black text-white mt-1">
                      ₹{order.refund_amount || order.total_amount} Transferred to Your Account
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-black/40 p-4 rounded-2xl border border-white/10">
                  <div>
                    <span className="text-white/50 block font-medium">Refund UTR / Txn ID:</span>
                    <span className="font-mono font-bold text-[#F5D061] text-sm block mt-0.5">
                      {order.refund_txn_id || "Verified UPI Return"}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/50 block font-medium">Refund Date:</span>
                    <span className="text-white/90 block mt-0.5">
                      {order.refunded_at
                        ? new Date(order.refunded_at).toLocaleString("en-IN")
                        : "Completed"}
                    </span>
                  </div>
                  {order.cancellation_reason && (
                    <div className="sm:col-span-2 pt-1 border-t border-white/10">
                      <span className="text-white/50 block font-medium">Cancellation Reason:</span>
                      <span className="text-rose-200 block mt-0.5">{order.cancellation_reason}</span>
                    </div>
                  )}
                </div>

                {order.refund_screenshot && (
                  <div className="space-y-2 pt-1">
                    <span className="text-xs font-bold text-emerald-300 block">
                      Official Bank Refund Transfer Receipt:
                    </span>
                    <div className="inline-block relative rounded-2xl overflow-hidden border-2 border-emerald-400/60 shadow-lg group">
                      <img
                        src={order.refund_screenshot}
                        alt="Official Refund Proof"
                        className="max-h-60 max-w-full object-cover rounded-xl"
                      />
                      <a
                        href={order.refund_screenshot}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity gap-1"
                      >
                        <span>View Full Screen Refund Receipt ↗</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : order.payment_method === "upi" || order.payment_status === "paid" ? (
              <div className="p-5 sm:p-7 rounded-3xl bg-gradient-to-r from-amber-950/90 via-[#2B0E1E] to-rose-950/90 border-2 border-amber-500/70 shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-300 shrink-0">
                    <Clock className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300 bg-amber-900/60 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                      Refund In Progress
                    </span>
                    <h3 className="text-lg sm:text-2xl font-serif font-black text-white mt-1">
                      Refund of ₹{order.total_amount} Initiated
                    </h3>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed">
                  This order was paid online via UPI. Our shop administrator has initiated the refund process. The amount will be transferred back to your UPI account and the official bank transaction screenshot will be uploaded here.
                </p>

                {order.cancellation_reason && (
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs">
                    <span className="text-white/50 block font-medium">Cancellation Note:</span>
                    <span className="text-rose-200 block mt-0.5">{order.cancellation_reason}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-rose-950/80 via-[#20052B] to-rose-950/80 border-2 border-rose-500/50 shadow-2xl space-y-2">
                <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                  <span>Order Cancelled</span>
                </div>
                <p className="text-xs text-white/70">
                  {order.cancellation_reason || "This order was cancelled. No payment was collected (Cash on Delivery)."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Live helper status note */}
        <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#D3BEB0]">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#F5D061]" />
            <span>
              Store Location: <strong>Shop No. 12, Main Chowk, Kothal Kalan, Mahendragarh</strong>
            </span>
          </div>

          <div className="text-[11px] text-white/40">
            Order Ref: <span className="font-mono text-white/80 font-bold">{order.order_number}</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* OFFICIAL RECEIPT SECTION: Shown when Delivered & Paid Success!  */}
      {/* ============================================================== */}
      {isDelivered && isPaid ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif font-bold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#F5D061]" />
              <span>Official Delivery & Payment Receipt</span>
            </h2>
            <Link
              href="/orders"
              className="text-xs text-[#F5D061] hover:underline flex items-center gap-1 font-semibold"
            >
              <span>View All My Orders</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <OrderReceipt order={order} settings={settings} />
        </div>
      ) : (
        /* Order Snapshot & Recipient Details before delivery */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8">
          {/* Purchased Items snapshot */}
          <div className="md:col-span-7 p-5 sm:p-6 rounded-3xl bg-[#20052B] border border-white/10 shadow-lg">
            <h3 className="text-base sm:text-lg font-serif font-bold text-[#FFF8EE] mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-[#F5D061]" />
              <span>Purchased Sweets</span>
            </h3>

            <div className="divide-y divide-white/5 mb-6">
              {order.items.map((item) => (
                <div key={item.id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-semibold text-white block text-sm">
                      {item.product_name_snapshot}
                    </span>
                    <span className="text-[#D3BEB0]">
                      Portion: {item.variant_name_snapshot} × {item.quantity}
                    </span>
                  </div>
                  <span className="font-serif font-bold text-white text-sm">
                    ₹{item.line_total}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-white/10 space-y-2 text-xs text-[#D3BEB0]">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-semibold text-white">₹{order.subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span>Doorstep Delivery Fee</span>
                <span className="font-semibold text-[#F5D061]">
                  {Number(order.delivery_charge) === 0 ? (
                    <span className="text-emerald-400 font-bold">
                      FREE {order.coupon_code ? `(${order.coupon_code})` : ""}
                    </span>
                  ) : (
                    `₹${order.delivery_charge}`
                  )}
                </span>
              </div>
              {/* Prominent Coupon & Savings Box */}
              {(Number(order.discount_amount) > 0 || order.coupon_code || Number(order.delivery_charge) === 0) && (
                <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 space-y-1 my-2">
                  <div className="flex items-center justify-between text-emerald-300 font-bold text-xs">
                    <span className="flex items-center gap-1.5">
                      <span>🏷️ Coupon Applied:</span>
                      <span className="font-mono text-[#F5D061] uppercase bg-black/40 px-2 py-0.5 rounded border border-[#D4AF37]/40">
                        {order.coupon_code || "SPECIAL OFFER"}
                      </span>
                    </span>
                    {Number(order.discount_amount) > 0 && (
                      <span className="font-mono text-emerald-400 font-black">
                        -₹{Number(order.discount_amount)} OFF
                      </span>
                    )}
                  </div>
                  {Number(order.delivery_charge) === 0 && (
                    <div className="text-[11px] text-emerald-300/80 flex justify-between">
                      <span>Free Delivery Waiver:</span>
                      <span className="font-bold text-emerald-300">Saved ₹21</span>
                    </div>
                  )}
                  {Number(order.discount_amount) > 0 && (
                    <div className="text-[10px] text-emerald-300/70 pt-0.5 border-t border-emerald-500/20">
                      Total savings on this order: ₹{Number(order.discount_amount) + (Number(order.delivery_charge) === 0 ? 21 : 0)}!
                    </div>
                  )}
                </div>
              )}
              <div className="pt-2 border-t border-white/10 flex justify-between text-base font-bold text-[#FFF8EE]">
                <span>{order.payment_method === "cod" ? "Total Payable (COD)" : "Total Amount"}</span>
                <span className="text-xl font-serif text-[#F5D061]">
                  ₹{order.total_amount != null ? order.total_amount : order.subtotal}
                </span>
              </div>

              <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-white/50">Payment Mode:</span>
                <span className="font-semibold text-white flex items-center gap-1.5">
                  {order.booking_status === "requested" ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-amber-300 font-bold">Pending Store Approval (No Payment Yet)</span>
                    </>
                  ) : order.payment_method === "upi" ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      <span className="text-purple-300 font-bold">Direct UPI Online</span>
                      {order.upi_reference && (
                        <span className="font-mono text-[10px] text-[#F5D061] bg-black/40 px-2 py-0.5 rounded border border-[#D4AF37]/30">
                          Ref: {order.upi_reference}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-amber-300 font-bold">Cash on Delivery (COD)</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Delivery & WhatsApp contact */}
          <div className="md:col-span-5 p-5 sm:p-6 rounded-3xl bg-[#20052B] border border-white/10 shadow-lg flex flex-col justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-serif font-bold text-[#FFF8EE] mb-4 flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#F5D061]" />
                <span>Delivery Recipient</span>
              </h3>

              <div className="space-y-3 text-xs text-[#D3BEB0] mb-6">
                <div>
                  <span className="text-white/50 block">Customer Name</span>
                  <span className="text-white font-bold text-sm">{order.customer_name}</span>
                </div>
                <div>
                  <span className="text-white/50 block">Phone Number</span>
                  <span className="text-white font-mono font-medium">+91 {order.customer_phone}</span>
                </div>
                <div>
                  <span className="text-white/50 block">Delivery Address</span>
                  <span className="text-white leading-relaxed block">
                    {order.delivery_address}, {order.locality}
                  </span>
                  {order.landmark && (
                    <span className="text-[#F5D061] text-[11px] block mt-0.5">
                      Landmark: {order.landmark}
                    </span>
                  )}
                  {order.latitude && order.longitude && (
                    <span className="text-emerald-400 text-[10px] font-mono block mt-0.5">
                      GPS Pin: {order.latitude.toFixed(4)}° N, {order.longitude.toFixed(4)}° E (Kothal Kalan)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <a
                href={whatsappTrackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-[#0B2513] font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all text-center"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Direct WhatsApp Inquiry</span>
              </a>

              <Link
                href="/orders"
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-[#F5D061] font-semibold text-xs flex items-center justify-center gap-2 transition-all text-center"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>View My Orders & Receipts</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Payment Selection Modal for Approved Booking Requests */}
      {isPaymentModalOpen && (
        <PaymentSelectionModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          amount={order.total_amount != null ? order.total_amount : order.subtotal}
          customerName={order.customer_name}
          customerPhone={order.customer_phone}
          locality={order.locality}
          settings={settings}
          isSubmitting={isSubmittingPayment}
          onConfirmOrder={handleSelectApprovedPayment}
        />
      )}
    </div>
  );
}
