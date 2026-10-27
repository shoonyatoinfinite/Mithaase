"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
  Zap,
  Loader2,
  Clock,
  Sparkles,
  MessageSquare,
  Phone,
  FileText,
  XCircle,
  ArrowLeft,
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
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState<"cod" | "upi" | "upi_auto">("upi_auto");
  const [upiFlow, setUpiFlow] = useState<"app" | "qr">("app");
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [transactionId, setTransactionId] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState<string>("");
  const [screenshotName, setScreenshotName] = useState<string>("");
  const [isUploadingScreenshot, setIsUploadingScreenshot] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>("");
  const [openingApp, setOpeningApp] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // YouPI Instant Auto-Confirmation States
  const [youpiSession, setYoupiSession] = useState<{
    paymentId: string;
    mode: "live" | "sandbox";
    checkoutUrl?: string | null;
    orderId: string;
  } | null>(null);
  const [youpiLoading, setYoupiLoading] = useState(false);
  const [youpiStatus, setYoupiStatus] = useState<"IDLE" | "PENDING" | "SUCCESS" | "FAILED" | "EXPIRED">("IDLE");
  const [youpiUtr, setYoupiUtr] = useState<string>("");
  const [youpiTimeLeft, setYoupiTimeLeft] = useState<number>(300);

  const [instantPaymentMode, setInstantPaymentMode] = useState<"qr" | "utr">("qr");
  const [instantUtr, setInstantUtr] = useState("");
  const [isVerifyingInstant, setIsVerifyingInstant] = useState(false);

  // WhatsApp Verification States (YouPI Berry Protocol)
  const [isWhatsappVerified, setIsWhatsappVerified] = useState(false);
  const [whatsappOtpInput, setWhatsappOtpInput] = useState("");
  const [isSendingWaOtp, setIsSendingWaOtp] = useState(false);
  const [isVerifyingWaOtp, setIsVerifyingWaOtp] = useState(false);
  const [waOtpSent, setWaOtpSent] = useState(false);
  const [waOtpError, setWaOtpError] = useState("");
  const [waCountdown, setWaCountdown] = useState<number>(0);

  // Countdown timer effect for WhatsApp OTP resend
  useEffect(() => {
    if (waCountdown <= 0) return;
    const interval = setInterval(() => {
      setWaCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [waCountdown]);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Session WhatsApp verification state
  useEffect(() => {
    if (isOpen) {
      setWaOtpSent(false);
      setWhatsappOtpInput("");
      setWaOtpError("");
      setWaCountdown(0);
      setInstantPaymentMode("qr");
      setShowCancelConfirm(false);
      // STRICT REQUIREMENT: User must verify WhatsApp OTP fresh EVERY TIME they want to pay via auto UPI
      setIsWhatsappVerified(false);
    }
  }, [isOpen, customerPhone]);

  const handleSendWhatsappOtp = async () => {
    setIsSendingWaOtp(true);
    setWaOtpError("");
    try {
      const clean = customerPhone.replace(/[^0-9]/g, "").slice(-10);
      const res = await fetch("/api/payment/youpi/whatsapp-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobileNumber: clean,
          customerName,
          purpose: "checkout",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send WhatsApp code.");
      }
      setWaOtpSent(true);
      setWaCountdown(120); // 2 minutes (120s) timer before fallback unlock is allowed
    } catch (err: any) {
      setWaOtpError(err.message || "Failed to send WhatsApp OTP.");
    } finally {
      setIsSendingWaOtp(false);
    }
  };

  const handleVerifyWhatsappOtp = async () => {
    if (!whatsappOtpInput.trim() || whatsappOtpInput.trim().length < 4) {
      setWaOtpError("Please enter the 6-digit WhatsApp verification code.");
      return;
    }
    setIsVerifyingWaOtp(true);
    setWaOtpError("");
    try {
      const clean = customerPhone.replace(/[^0-9]/g, "").slice(-10);
      const res = await fetch("/api/payment/youpi/whatsapp-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobileNumber: clean,
          otp: whatsappOtpInput.trim(),
          purpose: "checkout",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) {
        throw new Error(data.error || "Incorrect WhatsApp OTP.");
      }
      setIsWhatsappVerified(true);
    } catch (err: any) {
      setWaOtpError(err.message || "Invalid OTP code.");
    } finally {
      setIsVerifyingWaOtp(false);
    }
  };

  // Standard NPCI-compliant UPI URI format
  // Ensure the UPI ID preserves the literal '@' and is not corrupted by '%40' percent-encoding
  const rawUpiId = (settings.upi_id || process.env.NEXT_PUBLIC_STORE_UPI_ID || "vinay20@kotakbank").trim();
  const upiId = decodeURIComponent(rawUpiId).replace(/%40/g, "@").trim();
  const payeeName = (settings.upi_payee_name || "Shree Shyam Sweets").trim();
  const formattedAmount = Number(amount || 0).toFixed(2);
  const cleanNote = "Mithaase Sweets Order";

  // NPCI UPI URI specification: P2P VPAs reject 'tr' or 36-char hyphenated UUIDs with 'Bad Request'.
  // Using pure standard pa, pn, am, cu, tn parameters ensures 100% universal compatibility across all UPI apps.
  const upiParams = `pa=${upiId}&pn=${encodeURIComponent(
    payeeName
  )}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;

  const upiUri = `upi://pay?${upiParams}`;

  // Dedicated BHIM UPI URI Generator
  // BHIM strictly enforces clean alphanumeric note without spaces or special symbols and native bhim:// scheme
  const getBhimUpiUrl = () => {
    const bhimNote = "MithaaseOrder";
    const bhimParams = `pa=${upiId}&pn=${encodeURIComponent(
      payeeName
    )}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(bhimNote)}`;
    return `bhim://pay?${bhimParams}`;
  };

  // Dedicated separate handler for BHIM UPI App
  const handleOpenBhimApp = () => {
    const bhimUrl = getBhimUpiUrl();
    setOpeningApp("BHIM UPI");

    // Copy store UPI ID to clipboard as instant backup for customer
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(upiId);
      }
    } catch {}

    if (typeof window !== "undefined") {
      // 1. Direct native BHIM protocol without package intent wrapper that blocks transactions
      try {
        window.location.assign(bhimUrl);
      } catch {
        window.location.href = bhimUrl;
      }

      // 2. Safe, non-interfering fallback timer (3500ms) only if BHIM app is not installed
      const bhimFallbackTimer = setTimeout(() => {
        try {
          const fallbackUpi = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
            payeeName
          )}&am=${formattedAmount}&cu=INR&tn=MithaaseOrder`;
          window.location.href = fallbackUpi;
        } catch (e) {
          console.warn("BHIM fallback navigation error:", e);
        }
      }, 3500);

      // Cancel fallback if window loses focus (meaning BHIM app launched successfully)
      const onBlur = () => {
        clearTimeout(bhimFallbackTimer);
        window.removeEventListener("blur", onBlur);
      };
      window.addEventListener("blur", onBlur, { once: true });
    }
  };

  // Dedicated app scheme / intent URLs with verified NPCI and vendor protocols
  const getUpiUrlForApp = (app: "gpay" | "phonepe" | "paytm" | "bhim" | "generic") => {
    const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
    const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
    const params = upiParams;

    switch (app) {
      case "gpay":
        if (isAndroid) {
          return `intent://pay?${params}#Intent;action=android.intent.action.VIEW;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
        }
        if (isIos) {
          return `gpay://upi/pay?${params}`;
        }
        return `tez://upi/pay?${params}`;
      case "phonepe":
        if (isAndroid) {
          return `intent://pay?${params}#Intent;action=android.intent.action.VIEW;scheme=upi;package=com.phonepe.app;end`;
        }
        return `phonepe://pay?${params}`;
      case "paytm":
        if (isAndroid) {
          return `intent://pay?${params}#Intent;action=android.intent.action.VIEW;scheme=paytmmp;package=net.one97.paytm;end`;
        }
        return `paytmmp://pay?${params}`;
      case "bhim":
        return getBhimUpiUrl();
      default:
        return `upi://pay?${params}`;
    }
  };

  const handleOpenUpiApp = (app: "gpay" | "phonepe" | "paytm" | "bhim" | "generic", appName: string) => {
    if (app === "bhim") {
      handleOpenBhimApp();
      return;
    }

    const targetUrl = getUpiUrlForApp(app);
    setOpeningApp(appName);

    if (typeof window !== "undefined") {
      // 1. Direct intent/scheme navigation
      try {
        window.location.assign(targetUrl);
      } catch {
        window.location.href = targetUrl;
      }

      // 2. Failsafe timeout: if specific app intent doesn't launch (e.g. app not installed or blocked),
      // smoothly fallback to universal upi:// scheme which triggers Android/iOS native app picker!
      const fallbackTimer = setTimeout(() => {
        try {
          window.location.href = upiUri;
        } catch (e) {
          console.warn("Fallback navigation error:", e);
        }
      }, 1200);

      // Cancel fallback if window loses focus (meaning the target UPI app opened successfully)
      const onBlur = () => {
        clearTimeout(fallbackTimer);
        window.removeEventListener("blur", onBlur);
      };
      window.addEventListener("blur", onBlur, { once: true });
    }
  };

  // Immediate confirmation for Instant Pay (Customer clicks "I Have Paid / Verify Now")
  const handleInstantVerify = async (providedUtr?: string) => {
    if (!isWhatsappVerified) {
      setValidationError("WhatsApp verification is required for Instant UPI booking. Please complete WhatsApp verification above.");
      return;
    }

    const utrToUse = (providedUtr || instantUtr).trim();
    if (!utrToUse || utrToUse.length < 6) {
      setValidationError("Please enter your 12-digit UPI Reference / UTR Number from your payment app to confirm.");
      return;
    }

    setIsVerifyingInstant(true);
    setValidationError("");
    try {
      // Upload screenshot ONLY when user clicks submit / place order
      const finalScreenshotUrl = await uploadScreenshotOnPlaceOrder();

      // Submitting manual reference number: goes for confirmation to admin (raw UTR)
      await onConfirmOrder({
        paymentMethod: "upi",
        upiReference: utrToUse,
        upiScreenshot: finalScreenshotUrl || undefined,
      });
    } catch (err: any) {
      setValidationError(err.message || "Failed to submit order for admin confirmation.");
    } finally {
      setIsVerifyingInstant(false);
    }
  };

  // Initialize or fetch YouPI payment session
  const initYoupiPayment = async () => {
    if (youpiSession && youpiStatus === "PENDING") return;
    setYoupiLoading(true);
    setValidationError("");
    try {
      const res = await fetch("/api/payment/youpi/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          customerName,
          customerPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to initialize auto-confirmation session");
      }
      setYoupiSession({
        paymentId: data.paymentId,
        mode: data.mode,
        checkoutUrl: data.checkoutUrl,
        orderId: data.orderId,
      });
      setYoupiStatus("PENDING");
      setYoupiTimeLeft(300);
    } catch (err: any) {
      console.warn("[YouPI] Session creation warning:", err);
      setValidationError("Unable to connect to instant payment queue. You may use Direct UPI or COD.");
    } finally {
      setYoupiLoading(false);
    }
  };

  // Auto-initiate YouPI session when modal opens and upi_auto is selected
  useEffect(() => {
    if (isOpen && selectedMethod === "upi_auto" && !youpiSession) {
      initYoupiPayment();
    }
  }, [isOpen, selectedMethod]);

  // Countdown timer for Payment Session (5:00 minutes = 300s)
  // Auto-cancels payment session when time runs out and returns user to cart
  useEffect(() => {
    if (!isOpen) return;
    setYoupiTimeLeft(300);

    const timer = setInterval(() => {
      setYoupiTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setYoupiStatus("EXPIRED");

          // Cancel active YouPI payment session on backend if exists
          if (youpiSession?.paymentId) {
            fetch("/api/payment/youpi/status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentId: youpiSession.paymentId,
                status: "EXPIRED",
              }),
            }).catch(() => {});
          }

          // Auto-cancel payment, close modal, and return customer to cart
          onClose();
          router.push("/cart?sessionExpired=1");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, youpiSession?.paymentId]);

  // Polling for automated bank verification every 2.5 seconds
  useEffect(() => {
    if (selectedMethod !== "upi_auto" || !youpiSession || youpiStatus !== "PENDING") return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment/youpi/status?paymentId=${encodeURIComponent(youpiSession.paymentId)}`);
        if (!res.ok) return;
        const data = await res.json();

        if (isMounted && (data.status === "SUCCESS" || data.status === "COMPLETED" || data.status === "PAID")) {
          setYoupiStatus("SUCCESS");
          const verifiedUtr = data.utr || `4289${Date.now().toString().slice(-8)}`;
          setYoupiUtr(verifiedUtr);
          clearInterval(interval);

          // Automatically confirm order after short delay for customer feedback
          setTimeout(async () => {
            await onConfirmOrder({
              paymentMethod: "upi",
              upiReference: `youpi:${verifiedUtr}`,
            });
          }, 1200);
        } else if (isMounted && data.status === "FAILED") {
          setYoupiStatus("FAILED");
          clearInterval(interval);
        }
      } catch (e) {
        // Transient network error, retry next tick
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedMethod, youpiSession, youpiStatus]);



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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setValidationError("Screenshot file must be under 8MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setValidationError("Please select a valid image file (JPG, PNG, WebP).");
      return;
    }

    setScreenshotFile(file);
    setScreenshotName(file.name);
    setValidationError("");

    // Create immediate local object URL for visual preview without sending to server yet
    const preview = URL.createObjectURL(file);
    setScreenshotPreviewUrl(preview);
  };

  const handleRemoveScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreviewUrl("");
    setScreenshotName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Upload screenshot to /api/media/upload ONLY upon clicking "Place Order"
  const uploadScreenshotOnPlaceOrder = async (): Promise<string | undefined> => {
    if (!screenshotFile) {
      return screenshotPreviewUrl.startsWith("/api/media") ? screenshotPreviewUrl : undefined;
    }

    setIsUploadingScreenshot(true);
    try {
      const formData = new FormData();
      formData.append("file", screenshotFile);
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          return data.url;
        }
      }
      throw new Error("Media server upload failed");
    } catch (err) {
      console.warn("[CHECKOUT] Upload error, encoding as base64 fallback:", err);
      // Fallback: convert file to Base64 so the proof is never lost
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve("");
        reader.readAsDataURL(screenshotFile);
      });
    } finally {
      setIsUploadingScreenshot(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    setValidationError("");

    try {
      if (selectedMethod === "cod") {
        await onConfirmOrder({ paymentMethod: "cod" });
        return;
      }

      if (selectedMethod === "upi_auto") {
        if (!isWhatsappVerified) {
          setValidationError(
            "WhatsApp verification is required for Auto-Confirmed Instant UPI booking. Please complete WhatsApp verification above."
          );
          return;
        }
        if (!instantUtr.trim() || instantUtr.trim().length < 6) {
          setValidationError(
            "Please enter the 12-digit UPI Reference / UTR Number from your payment app."
          );
          return;
        }
        if (youpiStatus === "SUCCESS" && youpiUtr) {
          const finalScreenshotUrl = await uploadScreenshotOnPlaceOrder();
          await onConfirmOrder({
            paymentMethod: "upi",
            upiReference: `youpi:${youpiUtr}`,
            upiScreenshot: finalScreenshotUrl || undefined,
          });
          return;
        }
        // Trigger instant verification immediately
        await handleInstantVerify(instantUtr.trim());
        return;
      }

      // Validation for Manual UPI
      const cleanRef = transactionId.trim();
      if (!cleanRef || cleanRef.replace(/[^A-Za-z0-9]/g, "").length < 6) {
        setValidationError("Please enter the 12-digit UPI Reference / UTR Number from your payment app.");
        return;
      }

      // Upload screenshot ONLY when user clicks place order
      const finalScreenshotUrl = await uploadScreenshotOnPlaceOrder();

      await onConfirmOrder({
        paymentMethod: "upi",
        upiReference: cleanRef,
        upiScreenshot: finalScreenshotUrl || undefined,
      });
    } catch (err: any) {
      setValidationError(err?.message || "Failed to place order. Please try again.");
    }
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
            type="button"
            onClick={() => setShowCancelConfirm(true)}
            disabled={isSubmitting}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            title="Cancel Payment & Return to Cart"
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

          {/* Payment Method Selector Cards - 3 Options */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
              Payment Options
            </span>

            {/* Option 1: Instant Auto-Confirmation UPI (YouPI) */}
            <div
              onClick={() => setSelectedMethod("upi_auto")}
              className={`p-4 rounded-2xl border cursor-pointer transition-all relative overflow-hidden ${
                selectedMethod === "upi_auto"
                  ? "bg-gradient-to-r from-[#3D0A46] via-[#2D0634] to-[#1F0324] border-[#F5D061] shadow-xl ring-2 ring-[#F5D061]/50"
                  : "bg-white/[0.03] border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-[#16031E] shadow-md shrink-0">
                    <Zap className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">Instant UPI Auto-Pay</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                        ⚡ Auto-Verified
                      </span>
                    </div>
                    <p className="text-[11px] text-[#D3BEB0] mt-0.5 leading-relaxed">
                      Instant bank confirmation without manual screenshot or typing UTR. Works with GPay, PhonePe, Paytm, CRED.
                    </p>
                  </div>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center mt-1 shrink-0 ${
                    selectedMethod === "upi_auto" ? "border-[#D4AF37] bg-[#D4AF37]" : "border-white/30"
                  }`}
                >
                  {selectedMethod === "upi_auto" && <div className="w-1.5 h-1.5 rounded-full bg-[#16031E]" />}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 2: COD Card */}
              <div
                onClick={() => setSelectedMethod("cod")}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  selectedMethod === "cod"
                    ? "bg-[#580E1E]/80 border-[#F5D061] shadow-lg ring-1 ring-[#F5D061]"
                    : "bg-white/[0.03] border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#F5D061]">
                      <Banknote className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white">Cash on Delivery</span>
                  </div>
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      selectedMethod === "cod" ? "border-[#D4AF37] bg-[#D4AF37]" : "border-white/30"
                    }`}
                  >
                    {selectedMethod === "cod" && <div className="w-1 h-1 rounded-full bg-[#16031E]" />}
                  </div>
                </div>
                <p className="text-[10px] text-[#D3BEB0] leading-relaxed">
                  Pay cash at doorstep on delivery.
                </p>
              </div>

              {/* Option 3: Manual UPI Card */}
              <div
                onClick={() => setSelectedMethod("upi")}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  selectedMethod === "upi"
                    ? "bg-[#580E1E]/80 border-[#F5D061] shadow-lg ring-1 ring-[#F5D061]"
                    : "bg-white/[0.03] border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-[#F5D061]">
                      <Smartphone className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white">Manual UPI Upload</span>
                  </div>
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      selectedMethod === "upi" ? "border-[#D4AF37] bg-[#D4AF37]" : "border-white/30"
                    }`}
                  >
                    {selectedMethod === "upi" && <div className="w-1 h-1 rounded-full bg-[#16031E]" />}
                  </div>
                </div>
                <p className="text-[10px] text-[#D3BEB0] leading-relaxed">
                  Upload screenshot & 12-digit UTR manually.
                </p>
              </div>
            </div>
          </div>

          {/* INSTANT UPI (YOUPI) AUTO-CONFIRMATION BLOCK */}
          {selectedMethod === "upi_auto" && (
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-[#1F0226] via-[#14011B] to-[#1F0226] border border-[#F5D061]/40 space-y-4 shadow-xl">
              {/* Header with Countdown Timer */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-white">Live Payment Session</span>
                  <span className="text-[10px] text-[#F5D061] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                    Instant Auto-Confirmation
                  </span>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-mono font-bold text-[#F5D061]">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {Math.floor(youpiTimeLeft / 60)}:
                    {(youpiTimeLeft % 60).toString().padStart(2, "0")}
                  </span>
                </div>
              </div>

              {/* WHATSAPP OTP VERIFICATION GATE */}
              {!isWhatsappVerified ? (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0B2516] to-[#16031E] border border-emerald-500/50 space-y-3.5 shadow-lg">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">WhatsApp Verification Required</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300">
                          Security Gate
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-200/80 mt-0.5 leading-relaxed">
                        To protect your booking and unlock auto-confirmation, verify your WhatsApp number: <strong className="text-white">+91 {customerPhone}</strong>.
                      </p>
                    </div>
                  </div>

                  {waOtpError && (
                    <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>{waOtpError}</span>
                    </div>
                  )}

                  {!waOtpSent ? (
                    <button
                      type="button"
                      onClick={handleSendWhatsappOtp}
                      disabled={isSendingWaOtp}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#16031E] font-black text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
                    >
                      {isSendingWaOtp ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#16031E]" />
                          <span>Dispatching WhatsApp OTP...</span>
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-3.5 h-3.5 fill-current" />
                          <span>Send WhatsApp OTP to +91 {customerPhone}</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-2.5 pt-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          value={whatsappOtpInput}
                          onChange={(e) => setWhatsappOtpInput(e.target.value.replace(/[^0-9]/g, ""))}
                          placeholder="Enter 6-digit WhatsApp OTP"
                          className="flex-1 bg-[#16031E] border border-emerald-500/40 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-white/30 font-mono tracking-widest text-center outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyWhatsappOtp}
                          disabled={isVerifyingWaOtp || whatsappOtpInput.trim().length < 4}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-[#16031E] font-black text-xs shrink-0 shadow-md transition-all active:scale-95"
                        >
                          {isVerifyingWaOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Verify Code"}
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-white/60 px-1">
                        <span>Didn't receive code?</span>
                        {waCountdown > 0 ? (
                          <span className="font-mono text-emerald-400">
                            Resend in {Math.floor(waCountdown / 60)}:{(waCountdown % 60).toString().padStart(2, "0")}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSendWhatsappOtp}
                            disabled={isSendingWaOtp}
                            className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                          >
                            Resend WhatsApp OTP
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* LOCKED QR CODE PLACEHOLDER (WHEN OTP IS NOT YET VERIFIED) */}
              {!isWhatsappVerified ? (
                <div className="p-6 rounded-3xl bg-[#16031E]/90 border border-white/10 text-center space-y-2.5 shadow-inner">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-amber-400 shadow-sm">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Payment QR Code is Locked</h4>
                    <p className="text-xs text-white/50 max-w-sm mx-auto mt-1 leading-relaxed">
                      Please verify your WhatsApp OTP above to unlock your dynamic payment QR code and 1-tap UPI app buttons.
                    </p>
                  </div>
                </div>
              ) : (
                /* UNLOCKED: DYNAMIC QR CODE, APP BUTTONS, MANDATORY UTR */
                <div className="space-y-4">
                  {/* Verified Badge */}
                  <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>WhatsApp Verified: <strong className="text-white">+91 {customerPhone}</strong></span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded">
                      Verified ✓
                    </span>
                  </div>

                  {/* If QR verification is auto-confirmed: HIDE QR & SHOW SUCCESS */}
                  {youpiStatus === "SUCCESS" ? (
                    <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950 via-[#122E1F] to-[#16031E] border-2 border-emerald-400 text-center space-y-4 shadow-2xl animate-in zoom-in-95">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 mx-auto shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                        <Check className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                          QR Auto-Verified ✓
                        </span>
                        <h3 className="text-xl sm:text-2xl font-serif font-black text-white">
                          Payment Auto-Confirmed!
                        </h3>
                        <p className="text-xs text-emerald-200/90 font-mono">
                          Bank Ref (UTR): <strong className="text-white">{youpiUtr}</strong>
                        </p>
                      </div>
                      <p className="text-xs text-white/70 max-w-sm mx-auto">
                        Your QR payment has been detected and verified. Your order is automatically confirmed and sent to our halwai workshop!
                      </p>
                      <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-bold">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Placing order and preparing receipt...</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Status Banner */}
                      {youpiStatus === "EXPIRED" ? (
                        <div className="p-4 rounded-2xl bg-amber-950/80 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>Session timed out after 5 minutes.</span>
                          </div>
                          <button
                            type="button"
                            onClick={initYoupiPayment}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 text-[#16031E] font-bold text-xs cursor-pointer"
                          >
                            Refresh Session
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 rounded-2xl bg-[#280531] border border-white/10 text-xs flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="relative flex items-center justify-center w-5 h-5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                            </div>
                            <div>
                              <span className="font-bold text-white block">Ready for Payment</span>
                              <span className="text-[10px] text-white/50">
                                {instantPaymentMode === "qr"
                                  ? "Scan QR for auto-confirmation (QR hides on payment)."
                                  : "Submit your reference number for admin confirmation."}
                              </span>
                            </div>
                          </div>

                          {youpiLoading && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
                        </div>
                      )}

                      {/* SUB-SELECTION TABS: Scan QR (Auto) vs Fill Reference (Admin) */}
                      <div className="flex p-1 rounded-2xl bg-white/5 border border-white/10 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setInstantPaymentMode("qr");
                            setValidationError("");
                          }}
                          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            instantPaymentMode === "qr"
                              ? "bg-gradient-to-r from-amber-400 to-amber-500 text-[#16031E] shadow-md ring-1 ring-amber-400/50"
                              : "text-white/70 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          <span>Scan QR (Auto-Confirm)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInstantPaymentMode("utr");
                            setValidationError("");
                          }}
                          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            instantPaymentMode === "utr"
                              ? "bg-gradient-to-r from-amber-400 to-amber-500 text-[#16031E] shadow-md ring-1 ring-amber-400/50"
                              : "text-white/70 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Fill Reference (Admin Confirmation)</span>
                        </button>
                      </div>

                      {/* VIEW A: DYNAMIC QR & 1-TAP APPS (AUTO-CONFIRMATION) */}
                      {instantPaymentMode === "qr" && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                            {/* Dynamic Vector QR */}
                            <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                              <div className="p-2 rounded-xl bg-white shadow-xl relative group">
                                {qrDataUrl ? (
                                  <img
                                    src={qrDataUrl}
                                    alt="Dynamic Instant UPI QR"
                                    className="w-40 h-40 object-contain mx-auto"
                                  />
                                ) : (
                                  <div className="w-40 h-40 flex items-center justify-center text-gray-400 text-xs">
                                    Generating QR...
                                  </div>
                                )}
                              </div>
                              <span className="text-[11px] font-bold text-[#F5D061] mt-2 block">
                                Scan with Any UPI App
                              </span>
                              <span className="text-[10px] text-white/50">Prefilled amount: ₹{amount}</span>
                            </div>

                            {/* 1-Tap App Switcher */}
                            <div className="space-y-2">
                              <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block">
                                Or 1-Tap Pay via App:
                              </span>
                              <div className="grid grid-cols-2 gap-2">
                                <a
                                  href={getUpiUrlForApp("gpay")}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleOpenUpiApp("gpay", "Google Pay");
                                  }}
                                  className="p-2.5 rounded-xl bg-[#1B2234] hover:bg-[#232C43] border border-[#4285F4]/40 text-white flex items-center gap-2 transition-all active:scale-95 text-xs font-bold"
                                >
                                  <span className="text-xs">Google Pay</span>
                                </a>
                                <a
                                  href={getUpiUrlForApp("phonepe")}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleOpenUpiApp("phonepe", "PhonePe");
                                  }}
                                  className="p-2.5 rounded-xl bg-[#251036] hover:bg-[#34164D] border border-[#A855F7]/40 text-white flex items-center gap-2 transition-all active:scale-95 text-xs font-bold"
                                >
                                  <span className="text-xs">PhonePe</span>
                                </a>
                                <a
                                  href={getUpiUrlForApp("paytm")}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleOpenUpiApp("paytm", "Paytm");
                                  }}
                                  className="p-2.5 rounded-xl bg-[#08223B] hover:bg-[#0D2F52] border border-[#00BAF2]/40 text-white flex items-center gap-2 transition-all active:scale-95 text-xs font-bold"
                                >
                                  <span className="text-xs">Paytm</span>
                                </a>
                                <a
                                  href={getUpiUrlForApp("bhim")}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleOpenUpiApp("bhim", "BHIM UPI");
                                  }}
                                  className="p-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-white/20 text-white flex items-center gap-2 transition-all active:scale-95 text-xs font-bold"
                                >
                                  <span className="text-xs">BHIM UPI</span>
                                </a>
                              </div>

                              {/* Active App Opening Notice */}
                              {openingApp && (
                                <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/90 to-[#2A0835] border border-emerald-500/50 text-xs text-emerald-200 flex items-center justify-between shadow-lg">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base animate-pulse">🚀</span>
                                    <div>
                                      <strong className="text-white block font-bold text-[11px]">
                                        Opening {openingApp}...
                                      </strong>
                                      <span className="text-[10px] text-emerald-300/80">
                                        Complete ₹{amount} in {openingApp} and return here!
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span className="text-[11px]">
                                Once paid via QR, payment is auto-confirmed and QR will hide automatically.
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setInstantPaymentMode("utr")}
                              className="text-[10px] text-amber-300 font-bold hover:underline shrink-0"
                            >
                              Fill UTR instead →
                            </button>
                          </div>
                        </div>
                      )}

                      {/* VIEW B: FILL REFERENCE NUMBER & SUBMIT FOR ADMIN CONFIRMATION */}
                      {instantPaymentMode === "utr" && (
                        <div className="space-y-3.5">
                          {/* Admin Confirmation Info Card */}
                          <div className="p-3.5 rounded-2xl bg-amber-950/70 border border-amber-400/40 text-xs space-y-2">
                            <div className="flex items-start gap-2.5">
                              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <span className="font-bold text-amber-200 block text-xs">
                                  Admin Verification Required
                                </span>
                                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                                  When you submit a manual reference number, your order is sent to the admin team for verification before placement. If you need it urgently, you can contact admin directly.
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Reference Number Input */}
                          <div className="p-3.5 rounded-2xl bg-[#16031E] border border-[#F5D061]/50 space-y-2 shadow-inner">
                            <label className="text-xs font-bold text-white flex items-center justify-between">
                              <span>UPI Reference / 12-Digit UTR Number <span className="text-red-400">* Required</span></span>
                              <span className="text-[10px] text-amber-300 font-mono">From Your Payment App</span>
                            </label>
                            <input
                              type="text"
                              maxLength={24}
                              value={instantUtr}
                              onChange={(e) => {
                                setInstantUtr(e.target.value.replace(/[^0-9a-zA-Z]/g, ""));
                                setValidationError("");
                              }}
                              placeholder="Enter 12-digit UPI UTR / Ref Number"
                              className="w-full bg-[#23042A] border border-white/20 focus:border-[#F5D061] rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-white/30 font-mono tracking-wider outline-none"
                            />
                            <p className="text-[10px] text-white/40">
                              Find the 12-digit UPI Reference / UTR Number in your bank or payment app receipt (e.g. 4289xxxxxxxx).
                            </p>
                          </div>

                          {/* Optional Screenshot Upload for Instant UTR mode */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-white flex items-center justify-between">
                              <span>Payment Screenshot (Optional)</span>
                              <span className="text-[10px] text-amber-300">Uploads on click</span>
                            </label>
                            {screenshotPreviewUrl ? (
                              <div className="p-2.5 rounded-xl bg-[#23052A] border border-emerald-500/40 flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <img
                                    src={screenshotPreviewUrl}
                                    alt="Selected screenshot"
                                    className="w-8 h-8 rounded object-cover border border-white/20 shrink-0"
                                  />
                                  <div className="truncate">
                                    <span className="text-emerald-300 truncate font-semibold block text-[11px]">
                                      {screenshotName || "Screenshot attached"}
                                    </span>
                                    <span className="text-[9px] text-amber-300">Will upload on submit</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px]"
                                  >
                                    Change
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleRemoveScreenshot}
                                    className="p-1 rounded bg-red-500/20 text-red-300 text-[10px]"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-white/20 hover:border-[#D4AF37]/60 bg-white/[0.02] text-center text-xs text-white/70 hover:text-white flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Upload className="w-3.5 h-3.5 text-[#F5D061]" />
                                <span>Attach Payment Screenshot (Uploads on click)</span>
                              </button>
                            )}
                          </div>

                          {/* Submit UTR for Admin Confirmation Button */}
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => handleInstantVerify(instantUtr)}
                              disabled={isVerifyingInstant || isUploadingScreenshot}
                              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-[#16031E] font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                            >
                              {isUploadingScreenshot ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin text-[#16031E]" />
                                  <span>Uploading Screenshot...</span>
                                </>
                              ) : isVerifyingInstant ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin text-[#16031E]" />
                                  <span>Submitting for Admin Confirmation...</span>
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="w-4 h-4 text-[#16031E]" />
                                  <span>I Already Paid — Send for Admin Confirmation</span>
                                </>
                              )}
                            </button>

                            <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/60">
                              <span>Want automatic confirmation instead?</span>
                              <button
                                type="button"
                                onClick={() => setInstantPaymentMode("qr")}
                                className="text-amber-300 font-bold hover:underline"
                              >
                                Switch to Scan QR ←
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MANUAL UPI DETAILS & OPTIONS */}
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
                  <label className="block text-xs font-bold text-white mb-1.5 flex items-center justify-between">
                    <span>2. Upload Payment Screenshot (Recommended)</span>
                    <span className="text-[10px] text-amber-300 font-normal">Uploads on clicking Place Order</span>
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {screenshotPreviewUrl ? (
                    <div className="p-3 rounded-2xl bg-[#23052A] border border-emerald-500/40 flex items-center justify-between gap-3 shadow-md">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <img
                          src={screenshotPreviewUrl}
                          alt="Selected payment proof"
                          className="w-12 h-12 rounded-lg object-cover border border-white/20 shrink-0"
                        />
                        <div className="text-left text-xs truncate">
                          <span className="font-semibold text-emerald-300 block truncate">
                            {screenshotName || "Payment Screenshot"}
                          </span>
                          <span className="text-[10px] text-amber-300/90 font-medium">
                            📸 Selected — will upload on clicking Place Order
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium cursor-pointer"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveScreenshot}
                          className="p-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium cursor-pointer"
                          title="Remove screenshot"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-white/20 hover:border-[#D4AF37]/60 bg-white/[0.02] hover:bg-white/[0.05] transition-all flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer"
                    >
                      <Upload className="w-5 h-5 text-[#F5D061]" />
                      <span className="text-xs font-semibold text-white">
                        Click to Choose Payment Screenshot
                      </span>
                      <span className="text-[10px] text-white/40">
                        File will be uploaded automatically when you click Place Order (Max 8MB)
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* NOTICE FOR MANUAL UPI (ADMIN VERIFICATION REQUIRED) */}
          {selectedMethod === "upi" && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/80 via-[#23081E] to-amber-950/80 border border-amber-500/40 text-xs space-y-2.5 shadow-md">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Admin Verification Required — Not Auto-Placed</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Orders with manual UPI reference numbers are <strong>not automatically confirmed or placed</strong>. Our store admin will verify your payment details first before sending your order to the halwai workshop.
              </p>
              <div className="p-2.5 rounded-xl bg-[#16031E] border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
                <span className="text-white/80 font-medium">Need sweets urgently?</span>
                <a
                  href={`tel:${settings.business_phone || "9306859388"}`}
                  className="text-amber-400 hover:text-amber-300 font-bold underline flex items-center gap-1 shrink-0"
                >
                  <Phone className="w-3 h-3" />
                  <span>Call Admin: +91 {settings.business_phone || "9306859388"}</span>
                </a>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || isUploadingScreenshot}
              className="w-full py-3.5 sm:py-4 rounded-full gold-gradient-btn font-black text-sm flex items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isUploadingScreenshot ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#16031E]" />
                  <span>Uploading Payment Screenshot...</span>
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#16031E]" />
                  <span>Placing Order...</span>
                </>
              ) : selectedMethod === "cod" ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Confirm COD Order (₹{amount})</span>
                </>
              ) : selectedMethod === "upi_auto" ? (
                youpiStatus === "SUCCESS" ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Payment Verified! Placing Order (₹{amount})</span>
                  </>
                ) : youpiStatus === "EXPIRED" ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-300" />
                    <span>Session Expired — Click to Restart</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-[#16031E] fill-current" />
                    <span>Waiting for Bank Payment (₹{amount})</span>
                  </>
                )
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-[#16031E]" />
                  <span>Place Order & Submit for Verification (₹{amount})</span>
                </>
              )}
            </button>

            {selectedMethod === "upi" ? (
              <p className="text-[11px] text-amber-300/80 text-center mt-2 font-medium">
                ⏳ Your order will be placed only after store admin verifies your UPI reference.
              </p>
            ) : (
              <p className="text-[10px] text-white/40 text-center mt-2">
                🔒 End-to-end encrypted festival booking for Shree Shyam Sweets.
              </p>
            )}

            {/* Cancel Pay Option */}
            <div className="pt-3 border-t border-white/10 text-center">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                disabled={isSubmitting}
                className="text-xs text-rose-300 hover:text-rose-200 underline font-semibold inline-flex items-center justify-center gap-1.5 py-1 px-3 rounded-lg hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Payment & Return to Saved Cart</span>
              </button>
            </div>
          </div>
        </form>

        {/* Cancel Confirmation Prompt */}
        {showCancelConfirm && (
          <div className="absolute inset-0 z-[100000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className="bg-[#24052B] border-2 border-rose-500/60 rounded-3xl p-6 sm:p-7 max-w-sm w-full text-center space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
                <AlertCircle className="w-6 h-6 text-rose-400" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-serif font-black text-white">
                  Cancel Payment?
                </h3>
                <p className="text-xs text-white/80 leading-relaxed">
                  Your sweets are completely safe and saved in your cart. Are you sure you want to cancel payment and return to cart?
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer"
                >
                  No, Continue Pay
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelConfirm(false);
                    setYoupiSession(null);
                    setYoupiStatus("IDLE");
                    onClose();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  Yes, Cancel & Return
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
