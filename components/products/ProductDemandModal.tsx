"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Product } from "@/types";
import { X, Sparkles, CheckCircle2, MessageCircle, AlertCircle, Loader2 } from "lucide-react";

interface ProductDemandModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onDemandRegistered?: (newTotalKg: number) => void;
}

export function ProductDemandModal({
  product,
  isOpen,
  onClose,
  onDemandRegistered,
}: ProductDemandModalProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [quantityKg, setQuantityKg] = useState<number>(1.0);
  const [notes, setNotes] = useState("");
  
  const [totalKg, setTotalKg] = useState<number>(0);
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  // Auto-fill logged-in customer info
  useEffect(() => {
    if (!isOpen) return;
    setIsSuccess(false);
    setErrorMsg("");

    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.authenticated && data.user) {
          if (data.user.name) setCustomerName(data.user.name);
          if (data.user.phone) setCustomerPhone(data.user.phone.replace(/[^0-9]/g, "").slice(-10));
          if (data.user.email) setCustomerEmail(data.user.email);
        }
      })
      .catch(() => {});

    // Fetch existing demand stats for this product
    setIsLoadingStats(true);
    fetch(`/api/products/demand?productId=${encodeURIComponent(product.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.totalKg === "number") {
          setTotalKg(data.totalKg);
          setCustomerCount(data.customerCount || 0);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingStats(false));
  }, [isOpen, product.id]);

  if (!isOpen) return null;

  const targetKg = 10.0;
  const progressPercent = Math.min(100, Math.round((totalKg / targetKg) * 100));
  const remainingKg = Math.max(0, targetKg - totalKg);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const cleanPhone = customerPhone.replace(/[^0-9]/g, "").slice(-10);
    if (!customerName.trim()) {
      setErrorMsg("Please enter your name.");
      return;
    }
    if (cleanPhone.length !== 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (quantityKg <= 0) {
      setErrorMsg("Please enter a quantity greater than 0 kg.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/products/demand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          customerName: customerName.trim(),
          customerPhone: cleanPhone,
          customerEmail: customerEmail.trim() || undefined,
          quantityKg,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsSuccess(true);
        if (typeof data.totalKg === "number") {
          setTotalKg(data.totalKg);
          if (onDemandRegistered) onDemandRegistered(data.totalKg);
        }
      } else {
        setErrorMsg(data.error || "Failed to submit request. Please try again.");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#180320] border-2 border-[#D4AF37]/40 rounded-3xl p-6 sm:p-7 shadow-2xl text-white max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {isSuccess ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 mx-auto flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h3 className="text-xl font-serif font-black text-[#F5D061]">
              डिमांड दर्ज हो गई! (Request Registered)
            </h3>

            <p className="text-xs sm:text-sm text-[#D3BEB0] max-w-sm mx-auto leading-relaxed">
              धन्यवाद <strong className="text-white">{customerName}</strong> जी! आपका{" "}
              <strong className="text-[#F5D061]">{quantityKg} kg {product.name}</strong> का आग्रह दर्ज हो चुका है।
            </p>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-[#D3BEB0] space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold">
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Notification Active</span>
              </div>
              <p>
                जैसे ही हमारे कारीगर इसका विशेष शुद्ध देसी घी का बैच तैयार करेंगे, आपको आपके WhatsApp नंबर{" "}
                <strong className="text-white">+91 {customerPhone}</strong> पर तुरंत आर्डर लिंक प्राप्त होगा!
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl font-bold text-xs gold-gradient-btn shadow-lg"
            >
              समझ गया / Done
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header with Product Preview */}
            <div className="flex items-center gap-4 pb-4 border-b border-white/10">
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-[#D4AF37]/40 shrink-0 bg-[#25072F]">
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/20 text-[#F5D061] border border-amber-500/30 mb-1">
                  <Sparkles className="w-3 h-3" /> Special Halwai Batch Request
                </span>
                <h2 className="text-base sm:text-lg font-serif font-bold text-white leading-snug">
                  {product.name}
                </h2>
                <span className="text-[11px] text-rose-400 font-semibold">
                  Currently Sold Out
                </span>
              </div>
            </div>

            {/* Explanatory Banner & Community Progress */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#2A0538] to-[#1C0324] border border-[#D4AF37]/30 space-y-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-[#F5D061] shrink-0 mt-0.5" />
                <p className="text-[11px] sm:text-xs text-[#FFF8EE] leading-relaxed">
                  यह मिठाई अभी आउट ऑफ स्टॉक है। जैसे ही ग्राहकों की कुल मांग{" "}
                  <strong className="text-[#F5D061]">10 kg</strong> तक पहुंचेगी, हमारे हलवाई इसका विशेष शुद्ध देसी घी का ताज़ा बैच तैयार करेंगे!
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#D3BEB0]">
                    Current Demand: <strong className="text-white">{totalKg.toFixed(1)} kg</strong>
                  </span>
                  <span className="text-[#F5D061] font-bold">
                    {progressPercent}% (Goal: 10 kg)
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden p-0.5 border border-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F5D061] transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-white/50 text-right">
                  {remainingKg > 0 ? (
                    <span>Only <strong>{remainingKg.toFixed(1)} kg</strong> more needed to schedule batch</span>
                  ) : (
                    <span className="text-emerald-400 font-bold">🎯 10+ KG Target reached! Batch preparation eligible</span>
                  )}
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Demand Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#D3BEB0] block mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#D3BEB0] block mb-1">
                    WhatsApp Mobile No. *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-white/40">+91</span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="9876543210"
                      className="w-full pl-10 pr-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              </div>

              {/* Quantity Selection */}
              <div>
                <label className="text-[11px] font-bold text-[#D3BEB0] block mb-1.5">
                  Requested Quantity (मात्रा) *
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[
                    { label: "500g", val: 0.5 },
                    { label: "1 kg", val: 1.0 },
                    { label: "2 kg", val: 2.0 },
                    { label: "5 kg", val: 5.0 },
                  ].map((chip) => (
                    <button
                      key={chip.val}
                      type="button"
                      onClick={() => setQuantityKg(chip.val)}
                      className={`py-1.5 text-xs rounded-xl font-bold border transition-all ${
                        quantityKg === chip.val
                          ? "bg-[#D4AF37] text-[#16031E] border-[#F5D061] shadow-md"
                          : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/50">Or custom kg:</span>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="50"
                    value={quantityKg}
                    onChange={(e) => setQuantityKg(parseFloat(e.target.value) || 1)}
                    className="w-24 px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                  <span className="text-xs text-white/70">kg</span>
                </div>
              </div>

              {/* Special Note */}
              <div>
                <label className="text-[11px] font-bold text-[#D3BEB0] block mb-1">
                  Optional Note (e.g. required for family function / pooja)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Need fresh box for Diwali get-together"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs gold-gradient-btn flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#16031E]" />
                    <span>Submit Demand & Get WhatsApp Alert (मांग दर्ज करें)</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

