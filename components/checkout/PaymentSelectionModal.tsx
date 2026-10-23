"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { StoreSettings } from "@/types";
import {
  Banknote,
  Smartphone,
  QrCode,
  Copy,
  Check,
  Upload,
  AlertCircle,
  X,
  Lock,
  ExternalLink,
  ShieldCheck,
  ImageIcon,
} from "lucide-react";

interface PaymentSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  customerName: string;
  customerPhone: string;
  locality: string;
  settings: StoreSettings;
  isSubmitting: boolean;
  onConfirmOrder: (data: {
    paymentMethod: "cod" | "upi";
    upiReference?: string;
    upiScreenshot?: string;
  }) => Promise<void>;
}

export function PaymentSelectionModal({
  isOpen,
  onClose,
  amount,
  customerName,
  customerPhone,
  locality,
  settings,
  isSubmitting,
  onConfirmOrder,
}: PaymentSelectionModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<"cod" | "upi">("cod");
  const [upiFlow, setUpiFlow] = useState<"app" | "qr">("app");
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [transactionId, setTransactionId] = useState("");
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string>("");
  const [screenshotName, setScreenshotName] = useState<string>("");
  const [validationError, setValidationError] = useState<string>("");
  const [openingApp, setOpeningApp] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Standard UPI URI format with prefilled payee, UPI ID, amount, and note
  const upiId = settings.upi_id || "shreeshyam@upi";
  const payeeName = settings.upi_payee_name || "Shree Shyam Sweets";
  const paymentNote = `Mithaase Order - ${customerName.trim() || "Customer"}`;
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    payeeName
  )}&am=${amount}&cu=INR&tn=${encodeURIComponent(paymentNote)}`;

  // Dedicated app scheme / intent URLs
  const getUpiUrlForApp = (app: "gpay" | "phonepe" | "paytm" | "bhim" | "generic") => {
    const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
    const params = `pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
      payeeName
    )}&am=${amount}&cu=INR&tn=${encodeURIComponent(paymentNote)}`;

    switch (app) {
      case "gpay":
        if (isAndroid) {
          return `intent://pay?${params}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
        }
        return `tez://upi/pay?${params}`;
      case "phonepe":
        if (isAndroid) {
          return `intent://pay?${params}#Intent;scheme=upi;package=com.phonepe.app;end`;
        }
        return `phonepe://pay?${params}`;
      case "paytm":
        if (isAndroid) {
          return `intent://pay?${params}#Intent;scheme=paytmmp;package=net.one97.paytm;end`;
        }
        return `paytmmp://pay?${params}`;
      case "bhim":
        if (isAndroid) {
          return `intent://pay?${params}#Intent;scheme=upi;package=in.org.npci.upiapp;end`;
        }
        return `upi://pay?${params}`;
      default:
        return `upi://pay?${params}`;
    }
  };

  const handleOpenUpiApp = (app: "gpay" | "phonepe" | "paytm" | "bhim" | "generic", appName: string) => {
    const targetUrl = getUpiUrlForApp(app);
    setOpeningApp(appName);

    try {
      if (typeof window !== "undefined") {
        window.location.href = targetUrl;
      }
    } catch (err) {
      console.warn("Could not navigate to custom UPI scheme, falling back to upiUri:", err);
      if (typeof window !== "undefined") {
        window.location.href = upiUri;
      }
    }
  };

  // Generate QR Code data URL when amount or UPI ID changes
  useEffect(() => {
    QRCode.toDataURL(upiUri, {
      width: 280,
      margin: 1.5,
      color: {
        dark: "#16031E",
        light: "#FFFFFF",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR Code generation error:", err));
  }, [upiUri]);

  if (!isOpen) return null;

  const handleCopy = (text: string, type: "upi" | "phone") => {
    navigator.clipboard.writeText(text);
    if (type === "upi") {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    } else {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setValidationError("Screenshot file must be under 8MB");
      return;
    }

    setScreenshotName(file.name);
    setValidationError("");

    const reader = new FileReader();
    reader.onload = (event) => {
      setScreenshotDataUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (selectedMethod === "cod") {
      await onConfirmOrder({ paymentMethod: "cod" });
      return;
    }

    // Validation for UPI
    if (!transactionId.trim()) {
      setValidationError("Please enter the 12-digit UPI Reference / UTR Number from your payment app.");
      return;
    }

    if (!screenshotDataUrl) {
      setValidationError("Please upload the payment screenshot as proof to confirm your order.");
      return;
    }

    await onConfirmOrder({
      paymentMethod: "upi",
      upiReference: transactionId.trim(),
      upiScreenshot: screenshotDataUrl,
    });
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl bg-[#1C0324] border-2 border-[#D4AF37]/50 shadow-[0_10px_50px_rgba(0,0,0,0.8)] overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-[#2B0530] via-[#1C0324] to-[#2B0530]">
          <div>
            <span className="text-[10px] text-[#F5D061] uppercase tracking-wider font-bold block">
              Step 3: Select Payment
            </span>
            <h2 className="text-xl sm:text-2xl font-serif font-black text-[#FFF8EE]">
              Choose How to <span className="gold-gradient-text">Pay</span>
            </h2>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Summary Strip */}
        <div className="px-5 sm:px-6 py-3 bg-[#130119] border-b border-white/5 flex items-center justify-between text-xs text-[#D3BEB0]">
          <div>
            <span>Delivery for </span>
            <strong className="text-white font-semibold">{customerName}</strong>
            <span className="opacity-70"> ({locality})</span>
          </div>
          <div className="text-right">
            <span className="text-white/50 text-[11px] block">Payable Amount</span>
            <span className="text-lg font-serif font-bold text-[#F5D061]">₹{amount}</span>
          </div>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {validationError && (
            <div className="p-3.5 rounded-2xl bg-red-950/90 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Payment Method Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* COD Card */}
            <div
              onClick={() => setSelectedMethod("cod")}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                selectedMethod === "cod"
                  ? "bg-[#580E1E]/80 border-[#F5D061] shadow-lg ring-1 ring-[#F5D061]"
                  : "bg-white/[0.03] border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#F5D061]">
                    <Banknote className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-white">Cash on Delivery</span>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedMethod === "cod" ? "border-[#D4AF37] bg-[#D4AF37]" : "border-white/30"
                  }`}
                >
                  {selectedMethod === "cod" && <div className="w-1.5 h-1.5 rounded-full bg-[#16031E]" />}
                </div>
              </div>
              <p className="text-[11px] text-[#D3BEB0] leading-relaxed">
                Pay ₹{amount} cash in hand when sweets are delivered to your doorstep.
              </p>
            </div>

            {/* Direct UPI Card */}
            <div
              onClick={() => setSelectedMethod("upi")}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                selectedMethod === "upi"
                  ? "bg-[#580E1E]/80 border-[#F5D061] shadow-lg ring-1 ring-[#F5D061]"
                  : "bg-white/[0.03] border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-[#F5D061]">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-white">Direct UPI Online</span>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedMethod === "upi" ? "border-[#D4AF37] bg-[#D4AF37]" : "border-white/30"
                  }`}
                >
                  {selectedMethod === "upi" && <div className="w-1.5 h-1.5 rounded-full bg-[#16031E]" />}
                </div>
              </div>
              <p className="text-[11px] text-[#D3BEB0] leading-relaxed">
                Pay via preferred UPI app or scan our shop QR code with prefilled amount.
              </p>
            </div>
          </div>

          {/* UPI DETAILS & OPTIONS */}
          {selectedMethod === "upi" && (
            <div className="p-4 sm:p-5 rounded-3xl bg-[#14011B] border border-[#D4AF37]/30 space-y-5">
              {/* Toggle: Choose App vs Scan QR */}
              <div className="flex p-1 rounded-2xl bg-white/5 border border-white/10">
                <button
                  type="button"
                  onClick={() => setUpiFlow("app")}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    upiFlow === "app"
                      ? "bg-[#D4AF37] text-[#16031E] shadow-md"
                      : "text-[#D3BEB0] hover:text-white"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Option 1: Choose UPI App</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUpiFlow("qr")}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    upiFlow === "qr"
                      ? "bg-[#D4AF37] text-[#16031E] shadow-md"
                      : "text-[#D3BEB0] hover:text-white"
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Option 2: Scan Shop QR Code</span>
                </button>
              </div>

              {/* OPTION 1: CHOOSE APP (Prefilled UPI Link) */}
              {upiFlow === "app" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-[#23052A] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-white/50 uppercase font-semibold block">
                          Payee Name
                        </span>
                        <span className="text-white font-bold">{payeeName}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-white/50 uppercase font-semibold block">
                          Amount Pre-filled
                        </span>
                        <span className="text-[#F5D061] font-serif font-black text-base">
                          ₹{amount}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <div>
                        <span className="text-[10px] text-white/50 uppercase font-semibold block">
                          Store UPI ID
                        </span>
                        <span className="font-mono text-[#F5D061] text-xs font-bold">{upiId}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(upiId, "upi")}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[11px] font-semibold flex items-center gap-1 border border-white/10 transition-colors"
                      >
                        {copiedUpi ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedUpi ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Quick-Launch UPI App Buttons */}
                  <div className="space-y-3">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-white/60 block">
                      Tap Your UPI App to Pay ₹{amount} (Pre-filled):
                    </label>

                    {/* Universal Launch Button */}
                    <a
                      href={getUpiUrlForApp("generic")}
                      onClick={(e) => {
                        e.preventDefault();
                        handleOpenUpiApp("generic", "Default UPI App");
                      }}
                      className="w-full py-3 px-4 rounded-xl gold-gradient-btn font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all text-center cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>Open Any UPI App (₹{amount})</span>
                      <ExternalLink className="w-3.5 h-3.5 ml-1" />
                    </a>

                    {/* Dedicated Branded App Buttons Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {/* Google Pay */}
                      <a
                        href={getUpiUrlForApp("gpay")}
                        onClick={(e) => {
                          e.preventDefault();
                          handleOpenUpiApp("gpay", "Google Pay");
                        }}
                        className="p-3 rounded-2xl bg-[#1B2234] hover:bg-[#232C43] border border-[#4285F4]/40 hover:border-[#4285F4] text-white flex flex-col items-center justify-center gap-1.5 transition-all text-center group active:scale-95 shadow-md cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold">
                          <span className="text-[#4285F4]">G</span>
                          <span className="text-[#EA4335]">P</span>
                          <span className="text-[#FBBC05]">a</span>
                          <span className="text-[#34A853]">y</span>
                        </div>
                        <span className="font-bold text-xs text-white group-hover:text-[#4285F4] transition-colors">
                          Google Pay
                        </span>
                        <span className="text-[9px] text-[#4285F4]/80 font-medium">Auto-open</span>
                      </a>

                      {/* PhonePe */}
                      <a
                        href={getUpiUrlForApp("phonepe")}
                        onClick={(e) => {
                          e.preventDefault();
                          handleOpenUpiApp("phonepe", "PhonePe");
                        }}
                        className="p-3 rounded-2xl bg-[#251036] hover:bg-[#34164D] border border-[#A855F7]/40 hover:border-[#A855F7] text-white flex flex-col items-center justify-center gap-1.5 transition-all text-center group active:scale-95 shadow-md cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#5F259F] text-white flex items-center justify-center text-xs font-black shadow-inner">
                          Pe
                        </div>
                        <span className="font-bold text-xs text-white group-hover:text-[#C084FC] transition-colors">
                          PhonePe
                        </span>
                        <span className="text-[9px] text-[#C084FC]/80 font-medium">Auto-open</span>
                      </a>

                      {/* Paytm */}
                      <a
                        href={getUpiUrlForApp("paytm")}
                        onClick={(e) => {
                          e.preventDefault();
                          handleOpenUpiApp("paytm", "Paytm");
                        }}
                        className="p-3 rounded-2xl bg-[#08223B] hover:bg-[#0D2F52] border border-[#00BAF2]/40 hover:border-[#00BAF2] text-white flex flex-col items-center justify-center gap-1.5 transition-all text-center group active:scale-95 shadow-md cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#002E6E] text-[#00BAF2] border border-[#00BAF2]/40 flex items-center justify-center text-[10px] font-black shadow-inner">
                          Paytm
                        </div>
                        <span className="font-bold text-xs text-white group-hover:text-[#38BDF8] transition-colors">
                          Paytm
                        </span>
                        <span className="text-[9px] text-[#38BDF8]/80 font-medium">Auto-open</span>
                      </a>

                      {/* BHIM / Other */}
                      <a
                        href={getUpiUrlForApp("bhim")}
                        onClick={(e) => {
                          e.preventDefault();
                          handleOpenUpiApp("bhim", "BHIM UPI");
                        }}
                        className="p-3 rounded-2xl bg-[#17261B] hover:bg-[#203626] border border-emerald-500/40 hover:border-emerald-500 text-white flex flex-col items-center justify-center gap-1.5 transition-all text-center group active:scale-95 shadow-md cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-full bg-emerald-900 text-emerald-300 border border-emerald-500/40 flex items-center justify-center text-[10px] font-black shadow-inner">
                          BHIM
                        </div>
                        <span className="font-bold text-xs text-white group-hover:text-emerald-300 transition-colors">
                          BHIM UPI
                        </span>
                        <span className="text-[9px] text-emerald-400/80 font-medium">Auto-open</span>
                      </a>
                    </div>

                    {/* Active App Opening Notice */}
                    {openingApp && (
                      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/90 to-[#2A0835] border border-emerald-500/50 text-xs text-emerald-200 flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl animate-pulse">🚀</span>
                          <div>
                            <strong className="text-white block font-bold">
                              Opening {openingApp}...
                            </strong>
                            <span className="text-[11px] text-emerald-300/90">
                              Approve ₹{amount} in your app, then copy & paste the 12-digit UTR below.
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenUpiApp("generic", "Preferred UPI")}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#F5D061] text-[10px] font-bold shrink-0 ml-2 border border-white/10"
                        >
                          Didn't Open?
                        </button>
                      </div>
                    )}

                    {/* Hint for Desktop Users */}
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] text-white/60 flex items-center gap-2">
                      <span className="text-sm">💡</span>
                      <span>
                        App links open directly on your mobile device. If on a computer, select <strong>&quot;Option 2: Scan Shop QR Code&quot;</strong> above.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* OPTION 2: SCAN SHOP QR CODE */}
              {upiFlow === "qr" && (
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="p-3 bg-white rounded-2xl shadow-xl inline-block border-4 border-[#D4AF37]/50">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Shop UPI QR Code"
                        className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center text-gray-500 text-xs">
                        Loading QR Code...
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="px-3 py-1 rounded-full bg-[#D4AF37]/20 border border-[#F5D061]/40 text-[#F5D061] text-xs font-bold inline-block">
                      Amount: ₹{amount}
                    </span>
                    <p className="text-xs text-[#D3BEB0]">
                      Scan using Google Pay, PhonePe, Paytm, BHIM, or any UPI app.
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                    <span className="font-mono text-[#F5D061]">{upiId}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(upiId, "upi")}
                      className="text-white/70 hover:text-white"
                    >
                      {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* MANDATORY PAYMENT CONFIRMATION INPUTS (UTR + Screenshot) */}
              <div className="pt-4 border-t border-white/10 space-y-4">
                <div className="flex items-center gap-1.5 text-xs text-[#F5D061] font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Payment Verification Requirements</span>
                </div>

                {/* 1. 12-Digit UTR / Transaction ID */}
                <div>
                  <label className="block text-xs font-bold text-white mb-1.5">
                    1. 12-Digit UPI Transaction ID / UTR *
                  </label>
                  <input
                    type="text"
                    required
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="e.g. 429381920194 (found in payment success screen)"
                    className="w-full bg-[#1C0324] border border-white/20 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-white/30 font-mono outline-none"
                  />
                </div>

                {/* 2. Payment Screenshot Upload */}
                <div>
                  <label className="block text-xs font-bold text-white mb-1.5">
                    2. Upload Payment Screenshot *
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {screenshotDataUrl ? (
                    <div className="p-3 rounded-2xl bg-[#23052A] border border-emerald-500/40 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={screenshotDataUrl}
                          alt="Uploaded payment proof"
                          className="w-12 h-12 rounded-lg object-cover border border-white/20"
                        />
                        <div className="text-left text-xs">
                          <span className="font-semibold text-emerald-300 block line-clamp-1">
                            {screenshotName || "Payment Screenshot"}
                          </span>
                          <span className="text-[10px] text-white/50">Attached & Verified</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-white/20 hover:border-[#D4AF37]/60 bg-white/[0.02] hover:bg-white/[0.05] transition-all flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer"
                    >
                      <Upload className="w-5 h-5 text-[#F5D061]" />
                      <span className="text-xs font-semibold text-white">
                        Click to Upload Payment Screenshot
                      </span>
                      <span className="text-[10px] text-white/40">
                        Supports JPG, PNG, WebP (Max 8MB)
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 sm:py-4 rounded-full gold-gradient-btn font-black text-sm flex items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all"
            >
              {isSubmitting ? (
                <span>Confirming Order...</span>
              ) : selectedMethod === "cod" ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Confirm COD Order (₹{amount})</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Confirm Payment & Place Order (₹{amount})</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-white/40 text-center mt-2">
              🔒 End-to-end encrypted festival booking for Shree Shyam Sweets.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
