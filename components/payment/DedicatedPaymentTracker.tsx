"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  QrCode,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ExternalLink,
  Download,
  Users,
  ShieldCheck,
  RotateCcw,
  MessageSquare,
  Loader2,
  Lock,
  Check,
} from "lucide-react";
import QRCode from "qrcode";

interface DedicatedPaymentTrackerProps {
  orderRef: string;
}

export function DedicatedPaymentTracker({ orderRef }: DedicatedPaymentTrackerProps) {
  const router = useRouter();

  const [queueStatus, setQueueStatus] = useState<"queued" | "active" | "paid" | "expired" | "cancelled" | "none">("active");
  const [queuePosition, setQueuePosition] = useState<number>(0);
  const [estimatedWaitSeconds, setEstimatedWaitSeconds] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(600);
  const [suggestCod, setSuggestCod] = useState<boolean>(false);
  const [amount, setAmount] = useState<number>(0);
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [copiedAmount, setCopiedAmount] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [payeeVpa, setPayeeVpa] = useState<string>(process.env.NEXT_PUBLIC_STORE_UPI_ID || "shreeshyam@upi");
  const [payeeName] = useState<string>(process.env.NEXT_PUBLIC_STORE_UPI_NAME || "Shree Shyam Sweets");

  // WhatsApp OTP Verification Gate States
  const [isWhatsappVerified, setIsWhatsappVerified] = useState<boolean>(false);
  const [whatsappOtpInput, setWhatsappOtpInput] = useState<string>("");
  const [isSendingWaOtp, setIsSendingWaOtp] = useState<boolean>(false);
  const [isVerifyingWaOtp, setIsVerifyingWaOtp] = useState<boolean>(false);
  const [waOtpSent, setWaOtpSent] = useState<boolean>(false);
  const [waOtpError, setWaOtpError] = useState<string>("");

  // 1. Initial & Recurring Queue Status Poller (every 3 seconds)
  useEffect(() => {
    let isMounted = true;

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/payment/queue/status?orderId=${encodeURIComponent(orderRef)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        if (data.queueStatus) {
          setQueueStatus(data.queueStatus);
        }
        if (typeof data.queuePosition === "number") {
          setQueuePosition(data.queuePosition);
        }
        if (typeof data.estimatedWaitSeconds === "number") {
          setEstimatedWaitSeconds(data.estimatedWaitSeconds);
        }
        if (typeof data.remainingSeconds === "number") {
          setRemainingSeconds(data.remainingSeconds);
        }
        if (typeof data.suggestCod === "boolean") {
          setSuggestCod(data.suggestCod);
        }
        if (typeof data.amount === "number") {
          setAmount(data.amount);
        }
        if (data.customerPhone) {
          setCustomerPhone(data.customerPhone);
        }
        if (data.customerName) {
          setCustomerName(data.customerName);
        }

        // If paid, redirect immediately
        if (data.queueStatus === "paid" || data.paymentStatus === "paid") {
          router.push(`/track/${encodeURIComponent(orderRef)}`);
        }
      } catch {
        // Transient network error
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [orderRef, router]);

  // 2. Heartbeat Pinger (every 15s while active)
  useEffect(() => {
    if (queueStatus !== "active") return;

    const sendHeartbeat = () => {
      fetch("/api/payment/queue/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderRef }),
      }).catch(() => {});
    };

    sendHeartbeat();
    const hbInterval = setInterval(sendHeartbeat, 15000);
    return () => clearInterval(hbInterval);
  }, [queueStatus, orderRef]);

  // 3. Countdown timer tick (1 second tick on active slot)
  useEffect(() => {
    if (queueStatus !== "active") return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setQueueStatus("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [queueStatus]);

  // 4. Generate dynamic QR Code Data URL
  const upiIntentUri = useMemo(() => {
    const formattedAmount = Number(amount || 0).toFixed(2);
    const cleanVpa = (payeeVpa || "").trim();
    const cleanRef = (orderRef || "").trim();

    return `upi://pay?pa=${cleanVpa}&pn=${encodeURIComponent(payeeName)}&cu=INR&tr=${encodeURIComponent(cleanRef)}&tn=${encodeURIComponent(`Order ${cleanRef}`)}&am=${formattedAmount}`;
  }, [payeeVpa, payeeName, orderRef, amount]);

  useEffect(() => {
    if (amount <= 0 || !upiIntentUri) return;
    QRCode.toDataURL(upiIntentUri, {
      width: 340,
      margin: 2,
      color: { dark: "#16031E", light: "#FFFFFF" },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => {});
  }, [upiIntentUri, amount]);

  // Format countdown mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleCopyUpi = () => {
    navigator.clipboard?.writeText(payeeVpa).catch(() => {});
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleCopyAmount = () => {
    navigator.clipboard?.writeText(Number(amount).toFixed(2)).catch(() => {});
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `Mithaase-QR-${orderRef}.png`;
    a.click();
  };

  const handleCancel = async () => {
    try {
      await fetch("/api/payment/queue/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderRef }),
      });
      setQueueStatus("cancelled");
      router.push("/cart?cancelled=1");
    } catch {
      router.push("/cart");
    }
  };

  const handleUniversalPayClick = () => {
    window.location.href = upiIntentUri;
  };

  // WhatsApp OTP Verification Actions
  const handleSendWhatsappOtp = async () => {
    const clean = (customerPhone || "").replace(/[^0-9]/g, "").slice(-10);
    if (!clean) {
      setWaOtpError("Customer phone number not available.");
      return;
    }
    setIsSendingWaOtp(true);
    setWaOtpError("");
    try {
      const res = await fetch("/api/payment/youpi/whatsapp-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobileNumber: clean,
          customerName: customerName || "Customer",
          purpose: "checkout",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send WhatsApp code.");
      }
      setWaOtpSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send WhatsApp OTP.";
      setWaOtpError(msg);
    } finally {
      setIsSendingWaOtp(false);
    }
  };

  const handleVerifyWhatsappOtp = async () => {
    const clean = (customerPhone || "").replace(/[^0-9]/g, "").slice(-10);
    if (!whatsappOtpInput.trim() || whatsappOtpInput.trim().length < 4) {
      setWaOtpError("Please enter the 6-digit WhatsApp verification code.");
      return;
    }
    setIsVerifyingWaOtp(true);
    setWaOtpError("");
    try {
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

      // Start YouPI tracking and dispatch payment instructions message
      const initRes = await fetch("/api/payment/youpi/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderRef,
          amount: amount,
          customerPhone: clean,
          customerName: customerName || "Customer",
        }),
      });
      if (initRes.ok) {
        const initData = await initRes.json();
        if (initData.payeeVpa) {
          setPayeeVpa(initData.payeeVpa);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid verification code.";
      setWaOtpError(msg);
    } finally {
      setIsVerifyingWaOtp(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0114] text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#16031E] border border-[#D4AF37]/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Header Ribbon */}
        <div className="text-center mb-5">
          <span className="text-[10px] tracking-widest uppercase font-bold text-[#F5D061] block mb-1">
            SHREE SHYAM SWEETS
          </span>
          <h1 className="text-2xl font-black text-white">Instant UPI Checkout</h1>
          <p className="text-xs text-white/60 font-mono mt-0.5">Order Ref: {orderRef}</p>
        </div>

        {/* 1. STATE: QUEUED */}
        {queueStatus === "queued" && (
          <div className="space-y-5 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <Users className="w-8 h-8 animate-pulse" />
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs uppercase tracking-wider mb-2">
                You are in line
              </span>
              <h2 className="text-3xl font-black text-white">Position #{queuePosition}</h2>
              <p className="text-xs text-white/60 mt-1">
                Estimated wait: ~{Math.ceil(estimatedWaitSeconds / 60)} minutes
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-left text-xs text-white/80 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#F5D061] shrink-0 mt-0.5" />
                <span>
                  To prevent bank payment conflicts, only one customer can verify their payment at a time.
                </span>
              </div>
              <div className="flex items-start gap-2 text-white/60 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-white/40 shrink-0 mt-0.5" />
                <span>We will send an instant WhatsApp notification the second your turn starts!</span>
              </div>
            </div>

            {suggestCod && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs text-left">
                <p className="font-bold mb-1">High queue demand right now!</p>
                <p className="text-[11px] text-white/70">
                  You have been waiting for over 25 minutes. You may cancel and choose Cash on Delivery (COD) for instant order placement.
                </p>
              </div>
            )}

            <button
              onClick={handleCancel}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 text-xs font-bold transition-all"
            >
              Cancel Payment &amp; Release Slot
            </button>
          </div>
        )}

        {/* 2. STATE: ACTIVE */}
        {queueStatus === "active" && (
          <div className="space-y-4">
            {/* Countdown Strip */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#F5D061] animate-spin" />
                <span className="text-xs font-bold text-[#F5D061]">Payment Window</span>
              </div>
              <div className="text-base font-black font-mono text-white">
                {formatTime(remainingSeconds)}
              </div>
            </div>

            {/* Live Payment Tracking Badge */}
            <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Automated Bank Tracking Active</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded">
                Live Session ✓
              </span>
            </div>

            {/* QR Code Container */}
            <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center shadow-lg">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="UPI QR Code"
                  className="w-56 h-56 object-contain rounded-lg"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-black/50 text-xs">
                  Generating secure QR...
                </div>
              )}

              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleDownloadQr}
                  className="px-3 py-1.5 rounded-lg bg-[#16031E] text-[#F5D061] text-xs font-bold flex items-center gap-1.5 hover:bg-black transition-all shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download QR</span>
                </button>
                <span className="text-[10px] text-black/60 font-medium">Use &ldquo;Scan from gallery&rdquo;</span>
              </div>
            </div>

                {/* Amount & UPI Details Strip */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] text-white/50 font-bold uppercase">Exact Amount</span>
                      <span className="block text-sm font-black text-[#F5D061]">₹{Number(amount).toFixed(2)}</span>
                    </div>
                    <button
                      onClick={handleCopyAmount}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                      title="Copy Amount"
                    >
                      {copiedAmount ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div className="overflow-hidden">
                      <span className="block text-[10px] text-white/50 font-bold uppercase">Payee UPI ID</span>
                      <span className="block text-xs font-bold truncate text-white">{payeeVpa}</span>
                    </div>
                    <button
                      onClick={handleCopyUpi}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all shrink-0 ml-1"
                      title="Copy UPI ID"
                    >
                      {copiedUpi ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Strict Exact Amount Notice */}
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 text-center font-medium leading-tight">
                  ⚠️ Please transfer exactly <strong>₹{Number(amount).toFixed(2)}</strong>. Automated verification requires an exact match.
                </div>

                {/* Universal 1-Tap UPI Button */}
                <button
                  onClick={handleUniversalPayClick}
                  className="w-full py-3.5 px-4 rounded-2xl gold-gradient-btn text-[#16031E] font-black text-sm flex items-center justify-between shadow-xl active:scale-95 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#16031E]" />
                    <span>Pay with any UPI app (₹{Number(amount).toFixed(2)})</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#16031E]" />
                </button>

            {/* Cancel Slot Button */}
            <div className="pt-2 text-center">
              <button
                onClick={handleCancel}
                className="text-xs text-white/50 hover:text-white transition-colors"
              >
                Cancel payment &amp; release slot
              </button>
            </div>
          </div>
        )}

        {/* 3. STATE: EXPIRED */}
        {queueStatus === "expired" && (
          <div className="space-y-4 text-center py-6">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white">Payment Session Expired</h2>
            <p className="text-xs text-white/60">
              The 10-minute window has expired and your slot was released to the next customer in line.
            </p>
            <button
              onClick={() => router.push("/checkout")}
              className="w-full py-3 rounded-xl gold-gradient-btn text-[#16031E] font-bold text-xs flex items-center justify-center gap-2 shadow"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry Payment in Checkout</span>
            </button>
          </div>
        )}

        {/* 4. STATE: CANCELLED */}
        {queueStatus === "cancelled" && (
          <div className="space-y-4 text-center py-6">
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mx-auto text-white/60">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white">Payment Cancelled</h2>
            <p className="text-xs text-white/60">Your slot was released. No money was charged.</p>
            <button
              onClick={() => router.push("/cart")}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
            >
              Return to Cart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
