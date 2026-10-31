"use client";

import React, { useState, useEffect } from "react";
import { Order } from "@/types";
import {
  X,
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
  Loader2,
  PhoneCall,
  Clock,
  ShieldAlert,
} from "lucide-react";

interface CancelOrderModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onCancelled: () => void;
  adminPhone?: string;
}

export function CancelOrderModal({
  order,
  isOpen,
  onClose,
  onCancelled,
  adminPhone,
}: CancelOrderModalProps) {
  const [step, setStep] = useState<"init" | "otp" | "success">("init");
  const [otp, setOtp] = useState("");
  const [reason, setReason] = useState("Ordered by mistake");
  const [customReason, setCustomReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [phoneHint, setPhoneHint] = useState("");
  const [countdown, setCountdown] = useState(0);

  const cleanAdminPhone = (adminPhone || "8290683668").replace(/[^0-9]/g, "").slice(-10);

  useEffect(() => {
    if (!isOpen) {
      setStep("init");
      setOtp("");
      setErrorMsg("");
      setCountdown(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  if (!isOpen) return null;

  const isCod = order.payment_method?.toLowerCase() === "cod";
  const isOutForDelivery = order.order_status === "out_for_delivery";
  const isDelivered = order.order_status === "delivered";
  const isAlreadyCancelled = order.order_status === "cancelled";

  // Handle Send OTP
  const handleSendOtp = async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/orders/${order.id}/cancel/send-otp`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPhoneHint(data.phoneHint || "");
        setStep("otp");
        setCountdown(30);
      } else {
        setErrorMsg(data.error || "Failed to send WhatsApp OTP.");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Verify OTP & Cancel Order
  const handleVerifyOtpAndCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      setErrorMsg("Please enter the 6-digit OTP code sent on WhatsApp.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");
    const finalReason = reason === "Other" && customReason.trim() ? customReason.trim() : reason;

    try {
      const res = await fetch(`/api/orders/${order.id}/cancel/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otp: otp.trim(),
          reason: finalReason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStep("success");
        onCancelled();
      } else {
        setErrorMsg(data.error || "Failed to verify OTP.");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const adminWaUrl = `https://wa.me/91${cleanAdminPhone}?text=${encodeURIComponent(
    `Hello Shree Shyam Sweets, I want to cancel my prepaid online order #${order.order_number} (Ref: ${order.order_ref || order.upi_reference || ""}) and request a refund.`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#180320] border-2 border-rose-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* CASE 1: Order is already Out for Delivery or Delivered */}
        {isOutForDelivery || isDelivered ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-500/20 border-2 border-rose-400 mx-auto flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-serif font-black text-rose-300">
              Cancellation Not Available
            </h3>

            <p className="text-xs sm:text-sm text-[#D3BEB0] leading-relaxed">
              Order <strong className="text-white">#{order.order_number}</strong> is already{" "}
              <strong className="text-[#F5D061] uppercase">
                {isOutForDelivery ? "Out for Delivery with Rider" : "Delivered"}
              </strong>
              . Once dispatched, orders cannot be self-cancelled.
            </p>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white/70">
              If you have an urgent delivery issue, please contact store management:
              <div className="mt-2 text-center">
                <a
                  href={`tel:+91${cleanAdminPhone}`}
                  className="font-bold text-[#F5D061] inline-flex items-center gap-1.5"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>+91 {cleanAdminPhone}</span>
                </a>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-xs cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        ) : !isCod ? (
          /* CASE 2: Non-COD (Prepaid UPI) Order */
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-400 mx-auto flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-serif font-black text-[#F5D061]">
              Prepaid Order Cancellation
            </h3>

            <p className="text-xs sm:text-sm text-[#D3BEB0] leading-relaxed">
              This order was paid online via <strong className="text-white">UPI / Instant Payment</strong>.
              For payment security and refund processing, prepaid orders cannot be self-cancelled directly.
            </p>

            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 to-[#25072F] border border-purple-500/40 text-xs text-[#D3BEB0] space-y-2">
              <span className="font-bold text-white block">
                How to cancel & claim your refund:
              </span>
              <p>
                Please tap below to message store Admin directly on WhatsApp with your Order #{order.order_number}.
                Admin will cancel the order and process your refund.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <a
                href={adminWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-[#0B2513] font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Contact Admin on WhatsApp (+91 {cleanAdminPhone})</span>
              </a>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 text-xs font-semibold cursor-pointer"
              >
                Back to Order
              </button>
            </div>
          </div>
        ) : step === "success" ? (
          /* CASE 3: Successfully Cancelled */
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 mx-auto flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h3 className="text-xl font-serif font-black text-emerald-300">
              Order Cancelled Successfully
            </h3>

            <p className="text-xs sm:text-sm text-[#D3BEB0] leading-relaxed">
              Your Cash on Delivery order <strong className="text-white">#{order.order_number}</strong> has been cancelled.
              Fresh inventory has been returned to the workshop.
            </p>

            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl font-bold text-xs gold-gradient-btn shadow-lg cursor-pointer"
            >
              Done / Close
            </button>
          </div>
        ) : step === "init" ? (
          /* CASE 4: COD Order - Step 1: Request OTP */
          <div className="space-y-5">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-400/50 mx-auto flex items-center justify-center text-rose-400 mb-2">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-serif font-black text-white">
                Cancel Cash on Delivery Order?
              </h3>
              <p className="text-xs text-[#D3BEB0]">
                Order <strong className="text-[#F5D061]">#{order.order_number}</strong> (₹{order.total_amount})
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-[#D3BEB0] space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>WhatsApp OTP Verification Required</span>
              </div>
              <p>
                To prevent accidental cancellation, a 6-digit confirmation code will be sent to your registered WhatsApp number:
              </p>
              <div className="font-mono font-bold text-white text-sm bg-black/40 p-2 rounded-lg border border-white/10 text-center">
                +91 {order.customer_phone}
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={handleSendOtp}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending WhatsApp OTP...</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4" />
                    <span>Send WhatsApp OTP to Cancel (OTP भेजें)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 text-xs font-semibold cursor-pointer"
              >
                No, Keep My Order
              </button>
            </div>
          </div>
        ) : (
          /* CASE 5: COD Order - Step 2: Enter OTP & Select Reason */
          <form onSubmit={handleVerifyOtpAndCancel} className="space-y-4">
            <div className="text-center space-y-1">
              <h3 className="text-base font-serif font-bold text-white">
                Enter WhatsApp Cancellation OTP
              </h3>
              <p className="text-xs text-[#D3BEB0]">
                We sent a 6-digit code to <strong className="text-emerald-400">{phoneHint || `+91 ${order.customer_phone}`}</strong>
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            {/* 6-Digit OTP Input */}
            <div>
              <label className="text-[11px] font-bold text-white/70 block mb-1.5 text-center">
                Enter 6-Digit OTP *
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="• • • • • •"
                className="w-full text-center text-2xl font-mono font-black tracking-[0.5em] py-3 rounded-xl bg-white/5 border border-white/20 text-[#F5D061] focus:outline-none focus:border-rose-400 placeholder-white/20"
              />
            </div>

            {/* Resend Timer */}
            <div className="text-center text-xs text-white/50">
              {countdown > 0 ? (
                <span>Resend OTP in <strong>{countdown}s</strong></span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isLoading}
                  className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                >
                  Resend OTP on WhatsApp
                </button>
              )}
            </div>

            {/* Cancellation Reason Selector */}
            <div>
              <label className="text-[11px] font-bold text-white/70 block mb-1.5">
                Reason for Cancellation (कारण चुनें) *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#25072F] border border-white/20 text-xs text-white outline-none focus:border-[#D4AF37]"
              >
                <option value="Ordered by mistake">Ordered by mistake (गलती से आर्डर हो गया)</option>
                <option value="Delivery address change required">Change in delivery address</option>
                <option value="Selected wrong sweets / portions">Selected wrong sweets or quantity</option>
                <option value="Delivery time delay">Delivery timing not suitable</option>
                <option value="Other">Other reason (अन्य कारण)</option>
              </select>

              {reason === "Other" && (
                <input
                  type="text"
                  required
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Please specify reason..."
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/20 text-xs text-white mt-2 outline-none"
                />
              )}
            </div>

            {/* Confirm Cancellation CTA */}
            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying OTP & Cancelling...</span>
                  </>
                ) : (
                  <span>Verify OTP & Cancel Order (कैंसिल कन्फर्म करें)</span>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 text-xs font-semibold cursor-pointer"
              >
                Go Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

