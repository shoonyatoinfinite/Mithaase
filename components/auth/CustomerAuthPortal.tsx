"use client";

import React, { useState } from "react";
import { useUserAuth } from "@/lib/context/user-auth-context";
import { useStoreSettings } from "@/lib/context/store-context";
import {
  Lock,
  Mail,
  Phone,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  ShieldCheck,
  MapPin,
  RefreshCw,
  X,
  Navigation,
  ExternalLink,
} from "lucide-react";

interface CustomerAuthPortalProps {
  mode?: "modal" | "embedded";
  initialTab?: "login" | "signup";
  onSuccess?: () => void;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
}

export function CustomerAuthPortal({
  mode = "embedded",
  initialTab = "login",
  onSuccess,
  onClose,
  title,
  subtitle,
}: CustomerAuthPortalProps) {
  const {
    loginWithPin,
    signupWithPin,
    loginWithGoogle,
    sendOtp,
    verifyOtp,
    syncGoogleCustomer,
    handlePostLoginRedirect,
  } = useUserAuth();

  const { settings } = useStoreSettings();
  const isStoreShutoff = Boolean(settings.store_shutoff || settings.store_status === "shutoff");

  const [activeTab, setActiveTab] = useState<"login" | "signup" | "google_complete" | "forgot_pin">(
    initialTab === "signup" && isStoreShutoff ? "login" : initialTab
  );
  const [showSecret, setShowSecret] = useState(false);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginSecret, setLoginSecret] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Forgot PIN state
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3 | 4>(1);
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotEmailOtp, setForgotEmailOtp] = useState("");
  const [forgotWhatsappOtp, setForgotWhatsappOtp] = useState("");
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState("");
  const [forgotMaskedEmail, setForgotMaskedEmail] = useState("");
  const [forgotMaskedPhone, setForgotMaskedPhone] = useState("");
  const [forgotNewPin, setForgotNewPin] = useState("");

  // Signup form state (4-Step Progressive Flow: 1=Info, 2=Email OTP, 3=WhatsApp OTP, 4=PIN & Address)
  const [signupStep, setSignupStep] = useState<1 | 2 | 3 | 4>(1);
  const [signupName, setSignupName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPin, setSignupPin] = useState("");
  const [signupAddress, setSignupAddress] = useState("");
  const [signupLocality, setSignupLocality] = useState(
    settings.service_areas?.[0] || "Kothal Kalan (Village & Main Chowk)"
  );
  const [signupLandmark, setSignupLandmark] = useState("");
  const [signupInstructions, setSignupInstructions] = useState("");
  const [signupLat, setSignupLat] = useState<number>(28.1907);
  const [signupLng, setSignupLng] = useState<number>(76.1624);
  const [signupMapUrl, setSignupMapUrl] = useState<string>("https://www.google.com/maps?q=28.1907,76.1624");
  const [isLocatingSignupGps, setIsLocatingSignupGps] = useState(false);
  const [signupGpsNotice, setSignupGpsNotice] = useState("");
  const [signupEmailOtp, setSignupEmailOtp] = useState("");
  const [signupWhatsappOtp, setSignupWhatsappOtp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isCompletingSignup, setIsCompletingSignup] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSuccessMsg, setSignupSuccessMsg] = useState("");

  const handleDetectSignupGps = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setSignupGpsNotice("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocatingSignupGps(true);
    setSignupGpsNotice("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingSignupGps(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setSignupLat(lat);
        setSignupLng(lng);
        setSignupMapUrl(`https://www.google.com/maps?q=${lat},${lng}`);
        setSignupGpsNotice(`📍 Exact GPS location pinned! (Lat: ${lat}, Lng: ${lng})`);
      },
      () => {
        setIsLocatingSignupGps(false);
        setSignupGpsNotice("Unable to detect GPS position. Please check browser location permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Google Profile Completion state (for new Google signups missing delivery details)
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleName, setGoogleName] = useState("");
  const [googlePhone, setGooglePhone] = useState("");
  const [googleAddress, setGoogleAddress] = useState("");
  const [googleLocality, setGoogleLocality] = useState(
    settings.service_areas?.[0] || "Kothal Kalan (Village & Main Chowk)"
  );
  const [googleLandmark, setGoogleLandmark] = useState("");
  const [isSavingGoogleProfile, setIsSavingGoogleProfile] = useState(false);
  const [googleError, setGoogleError] = useState("");

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleClick = async () => {
    setIsGoogleLoading(true);
    setLoginError("");
    const res = await loginWithGoogle();
    setIsGoogleLoading(false);
    if (!res.success) {
      setLoginError(res.error || "Google sign-in could not be opened.");
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginSecret.trim()) {
      setLoginError("Please enter your registered Email/Phone and Password or 6-digit PIN.");
      return;
    }
    setIsLoggingIn(true);
    setLoginError("");
    const res = await loginWithPin(loginIdentifier.trim(), loginSecret.trim());
    setIsLoggingIn(false);
    if (res.success) {
      if (onSuccess) {
        onSuccess();
      } else {
        handlePostLoginRedirect();
      }
    } else {
      setLoginError(res.error || "Invalid credentials. Please check your Password or PIN.");
    }
  };

  // ==========================================
  // SIGNUP STEP 1: VALIDATE NAME/PHONE/EMAIL, SEND EMAIL OTP
  // ==========================================
  const handleSignupStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    setSignupSuccessMsg("");

    if (!signupName.trim() || signupName.trim().length < 2) {
      setSignupError("Please enter your recipient full name.");
      return;
    }

    const cleanPhone = signupPhone.replace(/[^0-9]/g, "").slice(-10);
    if (cleanPhone.length < 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      setSignupError("Please enter a valid 10-digit Indian WhatsApp mobile number (starting with 6-9).");
      return;
    }

    if (!signupEmail || !signupEmail.includes("@") || !signupEmail.includes(".")) {
      setSignupError("Please enter a valid email address.");
      return;
    }

    setIsSendingOtp(true);
    const res = await sendOtp(signupEmail.trim().toLowerCase(), signupName.trim());
    setIsSendingOtp(false);

    if (res.success) {
      setSignupSuccessMsg(`A 6-digit email verification code has been dispatched to ${signupEmail.trim()}`);
      setSignupStep(2);
    } else {
      setSignupError(res.error || "Failed to deliver email verification code. Please try again.");
    }
  };

  // ==========================================
  // SIGNUP STEP 2: VERIFY EMAIL OTP, THEN SEND WHATSAPP OTP
  // ==========================================
  const handleSignupStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    setSignupSuccessMsg("");

    const cleanOtp = signupEmailOtp.replace(/[^0-9]/g, "");
    if (cleanOtp.length !== 6) {
      setSignupError("Please enter the 6-digit code received on your Email.");
      return;
    }

    setIsVerifyingOtp(true);
    const verifyRes = await verifyOtp(signupEmail.trim().toLowerCase(), cleanOtp);
    setIsVerifyingOtp(false);

    if (!verifyRes.success) {
      setSignupError(verifyRes.error || "Incorrect email verification code. Please try again.");
      return;
    }

    // Email is verified! Now dispatch WhatsApp OTP to phone
    const cleanPhone = signupPhone.replace(/[^0-9]/g, "").slice(-10);
    setIsSendingOtp(true);
    const waRes = await sendOtp(cleanPhone, signupName.trim());
    setIsSendingOtp(false);

    if (waRes.success) {
      setSignupStep(3);
      setSignupSuccessMsg(`✓ Email verified! A 6-digit WhatsApp code has been dispatched to +91 ${cleanPhone}`);
    } else {
      setSignupError(waRes.error || "Failed to dispatch WhatsApp verification code. Please verify your number.");
    }
  };

  // ==========================================
  // SIGNUP STEP 3: VERIFY WHATSAPP OTP
  // ==========================================
  const handleSignupStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    setSignupSuccessMsg("");

    const cleanOtp = signupWhatsappOtp.replace(/[^0-9]/g, "");
    if (cleanOtp.length !== 6) {
      setSignupError("Please enter the 6-digit code received on WhatsApp.");
      return;
    }

    const cleanPhone = signupPhone.replace(/[^0-9]/g, "").slice(-10);
    setIsVerifyingOtp(true);
    const verifyRes = await verifyOtp(cleanPhone, cleanOtp);
    setIsVerifyingOtp(false);

    if (!verifyRes.success) {
      setSignupError(verifyRes.error || "Incorrect WhatsApp verification code. Please try again.");
      return;
    }

    // Both Email & WhatsApp are verified! Proceed to Step 4
    setSignupStep(4);
    setSignupSuccessMsg("✓ WhatsApp & Email verified! Please set your 6-digit PIN and delivery address.");
  };

  // ==========================================
  // SIGNUP STEP 4: SET PIN, ADDRESS WITH MAP, AND COMPLETE REGISTRATION
  // ==========================================
  const handleSignupStep4 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    setSignupSuccessMsg("");

    const cleanPhone = signupPhone.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 10) {
      setSignupError("Please enter a valid 10-digit mobile number for order delivery updates.");
      return;
    }

    const cleanPin = signupPin.replace(/[^0-9]/g, "");
    if (cleanPin.length !== 6) {
      setSignupError("Security PIN must be exactly 6 digits (e.g. 523499).");
      return;
    }

    if (!signupAddress.trim() || signupAddress.trim().length < 4) {
      setSignupError("Please enter your doorstep delivery address (house/street).");
      return;
    }

    setIsCompletingSignup(true);

    const regRes = await signupWithPin({
      name: signupName.trim(),
      email: signupEmail.trim().toLowerCase(),
      phone: cleanPhone,
      password: signupPassword.trim() || undefined,
      pin: cleanPin,
      delivery_address: signupAddress.trim(),
      locality: signupLocality.trim(),
      landmark: signupLandmark.trim() || undefined,
      delivery_instructions: signupInstructions.trim() || undefined,
      latitude: signupLat,
      longitude: signupLng,
      map_url: signupMapUrl,
    });

    setIsCompletingSignup(false);

    if (regRes.success) {
      if (onSuccess) {
        onSuccess();
      } else {
        handlePostLoginRedirect();
      }
    } else {
      setSignupError(regRes.error || "Failed to create account. Please try again.");
    }
  };

  // ==========================================
  // FORGOT PIN HANDLERS (EMAIL OTP -> WHATSAPP OTP -> RANDOM 6-DIGIT PIN DISPATCH)
  // ==========================================
  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccessMsg("");

    if (!forgotIdentifier.trim()) {
      setForgotError("Please enter your registered email or 10-digit mobile number.");
      return;
    }

    setIsForgotLoading(true);
    try {
      const res = await fetch("/api/auth/customer/forgot-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", identifier: forgotIdentifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setForgotError(data.error || "Failed to find account or dispatch verification code.");
        return;
      }
      setForgotMaskedEmail(data.maskedEmail || "");
      setForgotMaskedPhone(data.maskedPhone || "");
      setForgotSuccessMsg(data.message || `Verification code sent to ${data.maskedEmail}`);
      setForgotStep(2);
    } catch {
      setForgotError("Network error. Please try again.");
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleForgotVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccessMsg("");

    const cleanOtp = forgotEmailOtp.replace(/[^0-9]/g, "");
    if (cleanOtp.length !== 6) {
      setForgotError("Please enter the 6-digit email verification code.");
      return;
    }

    setIsForgotLoading(true);
    try {
      const res = await fetch("/api/auth/customer/forgot-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_email",
          identifier: forgotIdentifier.trim(),
          otp: cleanOtp,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setForgotError(data.error || "Incorrect email verification code.");
        return;
      }
      setForgotSuccessMsg(data.message || "Email verified! A WhatsApp code has been sent.");
      setForgotStep(3);
    } catch {
      setForgotError("Network error. Please try again.");
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleForgotVerifyWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccessMsg("");

    const cleanOtp = forgotWhatsappOtp.replace(/[^0-9]/g, "");
    if (cleanOtp.length !== 6) {
      setForgotError("Please enter the 6-digit WhatsApp verification code.");
      return;
    }

    setIsForgotLoading(true);
    try {
      const res = await fetch("/api/auth/customer/forgot-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_whatsapp_and_reset",
          identifier: forgotIdentifier.trim(),
          otp: cleanOtp,
          newPin: forgotNewPin.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setForgotError(data.error || "Incorrect WhatsApp verification code.");
        return;
      }
      setForgotSuccessMsg(
        data.message || "Your new 6-digit PIN has been set and sent to your registered Email!"
      );
      setForgotStep(4);
    } catch {
      setForgotError("Network error. Please try again.");
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleSaveGoogleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = googlePhone.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 10) {
      setGoogleError("Please enter a valid 10-digit mobile number for order delivery.");
      return;
    }

    if (!googleAddress.trim() || googleAddress.trim().length < 4) {
      setGoogleError("Please enter your doorstep delivery address.");
      return;
    }

    setIsSavingGoogleProfile(true);
    setGoogleError("");

    const res = await syncGoogleCustomer({
      email: googleEmail.trim(),
      name: googleName.trim(),
      phone: cleanPhone,
      delivery_address: googleAddress.trim(),
      locality: googleLocality.trim(),
      landmark: googleLandmark.trim() || undefined,
      latitude: 28.1907,
      longitude: 76.1624,
      map_url: "https://www.google.com/maps?q=28.1907,76.1624",
    });

    setIsSavingGoogleProfile(false);

    if (res.success) {
      if (onSuccess) {
        onSuccess();
      } else {
        handlePostLoginRedirect();
      }
    } else {
      setGoogleError(res.error || "Failed to save delivery profile.");
    }
  };

  return (
    <div
      className={`w-full ${
        mode === "modal"
          ? "bg-[#20052B] border-2 border-[#D4AF37]/50 rounded-3xl p-6 sm:p-8 shadow-[0_10px_50px_rgba(0,0,0,0.85)] max-w-md mx-auto"
          : "bg-[#20052B] border-2 border-[#D4AF37]/40 rounded-3xl p-6 sm:p-8 shadow-2xl max-w-xl mx-auto"
      } relative text-left`}
    >
      {/* Optional Close Button in modal mode */}
      {mode === "modal" && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3B0E4D] border border-[#D4AF37]/40 text-[#F5D061] text-[11px] font-bold tracking-wider uppercase mb-2 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-[#F5D061]" />
          <span>Shree Shyam Sweets • Customer Portal</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-serif font-black text-[#FFF8EE]">
          {activeTab === "google_complete" ? (
            <>
              Complete Your <span className="gold-gradient-text">Delivery Address</span>
            </>
          ) : activeTab === "forgot_pin" ? (
            <>
              Reset Security <span className="gold-gradient-text">PIN</span>
            </>
          ) : activeTab === "login" ? (
            <>
              {title || "Welcome Back"} <span className="gold-gradient-text">Sign In</span>
            </>
          ) : (
            <>
              Customer <span className="gold-gradient-text">Registration</span>
            </>
          )}
        </h2>
        <p className="text-xs text-[#D3BEB0] mt-1.5 max-w-sm mx-auto">
          {subtitle ||
            (activeTab === "google_complete"
              ? "Add your mobile and village doorstep pin once for fast 1-click mithai delivery."
              : activeTab === "forgot_pin"
              ? "Verify your account to receive your new 6-digit security PIN on your registered email."
              : activeTab === "login"
              ? "Access your saved addresses, festival bookings, and order receipts."
              : "Sign up with verified email & WhatsApp OTP — next time order with 1-click!")}
        </p>
      </div>

      {/* TAB SELECTOR (when not in Google completion or Forgot PIN mode) */}
      {activeTab !== "google_complete" && activeTab !== "forgot_pin" && (
        <>
          {/* ============================================================== */}
          {/* ROYAL GOOGLE SIGN-IN BUTTON (MATCHING WEBSITE PALETTE)          */}
          {/* ============================================================== */}
          <div className="mb-6">
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={isGoogleLoading}
              className="w-full relative group overflow-hidden py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#2B0B3A] via-[#380E4C] to-[#2B0B3A] border-2 border-[#D4AF37]/50 hover:border-[#F5D061] text-[#FFF8EE] font-bold text-sm flex items-center justify-center gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_15px_rgba(212,175,55,0.15)] hover:shadow-[0_4px_25px_rgba(0,0,0,0.6),0_0_25px_rgba(212,175,55,0.3)] active:scale-[0.99] transition-all duration-300 cursor-pointer"
            >
              {/* Golden Shimmer on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#D4AF37]/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />

              {/* Clean circular emblem for Google Logo */}
              <div className="w-7 h-7 rounded-full bg-white/95 p-1 flex items-center justify-center shadow-md shrink-0 border border-white/20">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>

              <span className="tracking-wide text-sm font-semibold text-[#FFF8EE]">
                {isGoogleLoading ? "Connecting to Google..." : "Continue with Google"}
              </span>

              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[#F5D061] bg-[#16031E]/80 px-2.5 py-1 rounded-full border border-[#D4AF37]/40 shadow-inner">
                Fast 1-Click
              </span>
            </button>

            {/* FESTIVE ROYAL DIVIDER WITH SPARKLING ACCENT */}
            <div className="relative flex items-center justify-center my-6">
              <div className="border-t border-[#D4AF37]/25 w-full" />
              <div className="bg-[#1C0426] px-4 py-1.5 rounded-full border border-[#D4AF37]/35 flex items-center gap-2 shrink-0 shadow-lg">
                <Sparkles className="w-3 h-3 text-[#F5D061]" />
                <span className="text-[11px] font-bold text-[#F5D061] uppercase tracking-wider">
                  Or with Email / Mobile &amp; Password
                </span>
                <Sparkles className="w-3 h-3 text-[#F5D061]" />
              </div>
              <div className="border-t border-[#D4AF37]/25 w-full" />
            </div>
          </div>

          {/* Unified Tab Pill Selector */}
          <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-[#16031E] border border-white/10 mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab("login");
                setLoginError("");
              }}
              className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "login"
                  ? "gold-gradient-btn shadow-md"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Login to Account</span>
            </button>

            {!isStoreShutoff && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("signup");
                  setSignupError("");
                }}
                className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === "signup"
                    ? "gold-gradient-btn shadow-md"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create Account</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* ============================================================== */}
      {/* VIEW A: LOGIN FORM                                             */}
      {/* ============================================================== */}
      {activeTab === "login" && (
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          {loginError && (
            <div className="p-3.5 rounded-xl bg-red-950/90 border border-red-500/50 text-red-200 text-xs flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1.5">
              Registered Email or 10-Digit Mobile *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="e.g. rahul@gmail.com or 9876543210"
                className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-white/80">
                Password or 6-Digit PIN *
              </label>
              <span className="text-[10px] text-[#F5D061]/80">Use either one</span>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
              <input
                type={showSecret ? "text" : "password"}
                required
                value={loginSecret}
                onChange={(e) => setLoginSecret(e.target.value)}
                placeholder="Enter your account password or 6-digit PIN"
                className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3.5 top-3 text-white/40 hover:text-white/80"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex justify-end pt-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("forgot_pin");
                  setForgotStep(1);
                  setForgotError("");
                  setForgotSuccessMsg("");
                  if (loginIdentifier) setForgotIdentifier(loginIdentifier);
                }}
                className="text-xs text-[#F5D061] hover:underline font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#F5D061]" />
                <span>Forgot PIN / Password?</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-3.5 rounded-xl gold-gradient-btn font-bold text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all cursor-pointer"
          >
            {isLoggingIn ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#16031E]" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-[#16031E]" />
                <span>Sign In to My Account</span>
                <ArrowRight className="w-4 h-4 text-[#16031E]" />
              </>
            )}
          </button>

          <div className="pt-2 text-center text-xs text-[#D3BEB0]">
            {isStoreShutoff ? (
              <span className="text-amber-300/80 text-[11px] block">
                🔒 The store is permanently shut off. New customer signups are disabled.
              </span>
            ) : (
              <>
                <span>New customer? </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("signup")}
                  className="text-[#F5D061] hover:underline font-bold"
                >
                  Register once with WhatsApp OTP →
                </button>
              </>
            )}
          </div>
        </form>
      )}

      {activeTab === "signup" && isStoreShutoff && (
        <div className="p-6 rounded-2xl bg-gradient-to-b from-red-950/40 via-[#1C0324] to-[#12021A] border border-red-500/40 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <h4 className="font-serif font-bold text-white text-base">New Signups Disabled</h4>
          <p className="text-xs text-white/70 max-w-sm mx-auto leading-relaxed">
            {settings.shutoff_message || "The store is permanently shut off by administration. New customer registrations are temporarily disabled."}
          </p>
          <button
            type="button"
            onClick={() => setActiveTab("login")}
            className="gold-gradient-btn px-5 py-2.5 rounded-xl text-xs font-bold text-[#16031E] shadow-md"
          >
            Sign In to Existing Account →
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW B: SIGNUP WITH PROGRESSIVE DUAL (EMAIL -> WHATSAPP) OTP   */}
      {/* ============================================================== */}
      {activeTab === "signup" && !isStoreShutoff && (
        <div className="space-y-4">
          {/* Step Indicator */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#16031E] border border-[#D4AF37]/30 text-xs">
            <span className="font-semibold text-white/80">
              {signupStep === 1
                ? "Step 1: Contact Details & Email Verification"
                : signupStep === 2
                ? "Step 2: Enter Email Verification Code"
                : signupStep === 3
                ? "Step 3: Enter WhatsApp Verification Code"
                : "Step 4: Set PIN, Delivery Address & Map"}
            </span>
            <span className="font-mono text-[#F5D061] font-bold px-2 py-0.5 rounded-full bg-[#20052B] border border-[#D4AF37]/40 text-[10px]">
              Step {signupStep} of 4
            </span>
          </div>

          {signupSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{signupSuccessMsg}</span>
            </div>
          )}

          {signupError && (
            <div className="p-3.5 rounded-xl bg-red-950/90 border border-red-500/50 text-red-200 text-xs flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{signupError}</span>
            </div>
          )}

          {/* SIGNUP STEP 1: NAME, EMAIL & WHATSAPP PHONE */}
          {signupStep === 1 && (
            <form onSubmit={handleSignupStep1} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">
                  Full Recipient Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="e.g. Ramesh Yadav"
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-white/30 outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">
                  Email Address * (Verified First via OTP)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="e.g. ramesh@gmail.com"
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-white/30 outline-none transition-colors"
                  />
                </div>
                <span className="text-[11px] text-[#F5D061]/80 mt-1 block">
                  A 6-digit email verification code will be sent to this email first.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">
                  WhatsApp Mobile Number * (10 Digits - Verified in Next Step)
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-white/15 bg-white/5 text-white/70 font-mono text-xs">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="9876543210"
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-r-xl px-3 py-2.5 text-xs sm:text-sm text-white font-mono placeholder-white/30 outline-none"
                  />
                </div>
                <span className="text-[11px] text-white/40 mt-1 block">
                  After verifying email, a 6-digit WhatsApp OTP will be dispatched to this number.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSendingOtp}
                className="w-full py-3.5 rounded-xl gold-gradient-btn font-bold text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all cursor-pointer mt-2"
              >
                {isSendingOtp ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#16031E]" />
                    <span>Sending Email Verification Code...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 text-[#16031E]" />
                    <span>Continue &amp; Verify Email</span>
                    <ArrowRight className="w-4 h-4 text-[#16031E]" />
                  </>
                )}
              </button>

              <div className="text-center pt-2 text-xs text-[#D3BEB0]">
                <span>Already have an account? </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("login")}
                  className="text-[#F5D061] hover:underline font-bold"
                >
                  Sign In instead
                </button>
              </div>
            </form>
          )}

          {/* SIGNUP STEP 2: VERIFY EMAIL OTP */}
          {signupStep === 2 && (
            <form onSubmit={handleSignupStep2} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed">
                A 6-digit email verification code was dispatched to <strong>{signupEmail}</strong>. Please check your inbox or spam folder.
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-white/80">
                    Enter 6-Digit Email Code *
                  </label>
                  <button
                    type="button"
                    onClick={() => setSignupStep(1)}
                    className="text-[11px] text-[#F5D061] hover:underline font-bold"
                  >
                    ← Edit Details
                  </button>
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={signupEmailOtp}
                  onChange={(e) => setSignupEmailOtp(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 123456"
                  className="w-full bg-[#16031E] border-2 border-[#D4AF37]/50 focus:border-[#F5D061] rounded-xl px-4 py-3.5 text-center text-2xl font-mono tracking-widest text-[#FFF8EE] outline-none shadow-inner"
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  type="submit"
                  disabled={isVerifyingOtp}
                  className="flex-1 py-3.5 rounded-xl gold-gradient-btn font-bold text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all cursor-pointer"
                >
                  {isVerifyingOtp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#16031E]" />
                      <span>Verifying Email...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#16031E]" />
                      <span>Verify Email &amp; Proceed to WhatsApp</span>
                      <ArrowRight className="w-4 h-4 text-[#16031E]" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSignupStep1}
                  disabled={isSendingOtp}
                  className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold border border-white/10 transition-colors"
                >
                  Resend
                </button>
              </div>
            </form>
          )}

          {/* SIGNUP STEP 3: VERIFY WHATSAPP OTP */}
          {signupStep === 3 && (
            <form onSubmit={handleSignupStep3} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed">
                Email verified ✓! A 6-digit WhatsApp verification code has been dispatched to <strong>+91 {signupPhone.slice(-10)}</strong>. Please check your WhatsApp messages.
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-white/80">
                    Enter 6-Digit WhatsApp Code *
                  </label>
                  <button
                    type="button"
                    onClick={() => setSignupStep(2)}
                    className="text-[11px] text-[#F5D061] hover:underline font-bold"
                  >
                    ← Back
                  </button>
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={signupWhatsappOtp}
                  onChange={(e) => setSignupWhatsappOtp(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 523499"
                  className="w-full bg-[#16031E] border-2 border-[#D4AF37]/50 focus:border-[#F5D061] rounded-xl px-4 py-3.5 text-center text-2xl font-mono tracking-widest text-[#FFF8EE] outline-none shadow-inner"
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  type="submit"
                  disabled={isVerifyingOtp}
                  className="flex-1 py-3.5 rounded-xl gold-gradient-btn font-bold text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all cursor-pointer"
                >
                  {isVerifyingOtp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#16031E]" />
                      <span>Verifying WhatsApp...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#16031E]" />
                      <span>Verify WhatsApp &amp; Proceed</span>
                      <ArrowRight className="w-4 h-4 text-[#16031E]" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const clean = signupPhone.replace(/[^0-9]/g, "").slice(-10);
                    setIsSendingOtp(true);
                    await sendOtp(clean, signupName.trim());
                    setIsSendingOtp(false);
                    setSignupSuccessMsg("A new WhatsApp verification code has been resent.");
                  }}
                  disabled={isSendingOtp}
                  className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold border border-white/10 transition-colors"
                >
                  Resend
                </button>
              </div>
            </form>
          )}

          {/* SIGNUP STEP 4: SET PIN, DELIVERY ADDRESS WITH MAP */}
          {signupStep === 4 && (
            <form onSubmit={handleSignupStep4} className="space-y-4">
              {/* Dual Verified Badges */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[11px] flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Email Verified ✓</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[11px] flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">WhatsApp Verified ✓</span>
                </div>
              </div>

              {/* Set 6-Digit PIN */}
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">
                  Create 6-Digit Security PIN * (For 1-Click Login)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-white/40 absolute left-3 top-3" />
                  <input
                    type="password"
                    inputMode="numeric"
                    required
                    maxLength={6}
                    value={signupPin}
                    onChange={(e) => setSignupPin(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="Enter 6-digit numeric PIN"
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-9 pr-4 py-2.5 text-xs sm:text-sm text-white font-mono placeholder-white/30 outline-none"
                  />
                </div>
                <span className="text-[10px] text-[#F5D061] mt-1 block">Your 6-digit PIN allows instant 1-click login and re-orders.</span>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">
                  Set Password (Optional, Min 6 chars)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-white/40 absolute left-3 top-3" />
                  <input
                    type="password"
                    minLength={6}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Create account password"
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder-white/30 outline-none"
                  />
                </div>
              </div>

              {/* Delivery Address Details */}
              <div className="space-y-3 pt-1 border-t border-white/10">
                <span className="text-[11px] font-bold text-[#F5D061] uppercase tracking-wider block">
                  Delivery Destination
                </span>

                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1">
                    Doorstep Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={signupAddress}
                    onChange={(e) => setSignupAddress(e.target.value)}
                    placeholder="House / Flat #, Street, Colony"
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-white/30 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1">
                      Locality / Village *
                    </label>
                    <select
                      value={signupLocality}
                      onChange={(e) => setSignupLocality(e.target.value)}
                      className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                    >
                      {(settings.service_areas || ["Kothal Kalan (Village & Main Chowk)"]).map((area) => (
                        <option key={area} value={area} className="bg-[#16031E]">
                          {area}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1">
                      Landmark (Optional)
                    </label>
                    <input
                      type="text"
                      value={signupLandmark}
                      onChange={(e) => setSignupLandmark(e.target.value)}
                      placeholder="e.g. Near Shiv Mandir"
                      className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/30 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1">
                    Special Delivery Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    value={signupInstructions}
                    onChange={(e) => setSignupInstructions(e.target.value)}
                    placeholder="e.g. Leave with guard / Ring bell twice / Second floor"
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 outline-none"
                  />
                </div>

                {/* Map Location & GPS Section */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/40 to-[#180320] border border-[#D4AF37]/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-[#F5D061] font-bold">
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Doorstep Map Location &amp; GPS Pin</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleDetectSignupGps}
                      disabled={isLocatingSignupGps}
                      className="px-2.5 py-1 rounded-lg bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#F5D061] text-[11px] font-bold border border-[#D4AF37]/40 flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                    >
                      {isLocatingSignupGps ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin text-[#F5D061]" />
                          <span>Detecting GPS...</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="w-3 h-3 text-[#F5D061]" />
                          <span>📍 Use Live GPS Location</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10 text-[11px]">
                    <span className="font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                      GPS: {signupLat}, {signupLng}
                    </span>

                    <a
                      href={signupMapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#F5D061] hover:text-white flex items-center gap-1 font-semibold underline"
                    >
                      <span>Preview Pin on Google Maps</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {signupGpsNotice && (
                    <div className="text-[11px] text-amber-300 font-medium">
                      {signupGpsNotice}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isCompletingSignup}
                className="w-full py-3.5 rounded-xl gold-gradient-btn font-bold text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all mt-2 cursor-pointer"
              >
                {isCompletingSignup ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#16031E]" />
                    <span>Creating Your Account...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#16031E]" />
                    <span>Complete Registration &amp; Start Shopping 🎉</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW D: FORGOT PIN / PASSWORD DUAL (EMAIL -> WA) RESET FLOW    */}
      {/* ============================================================== */}
      {activeTab === "forgot_pin" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#16031E] border border-[#D4AF37]/30 text-xs">
            <span className="font-semibold text-white/80">
              {forgotStep === 1
                ? "Step 1: Enter Account Mobile or Email"
                : forgotStep === 2
                ? "Step 2: Verify Email Code"
                : forgotStep === 3
                ? "Step 3: Verify WhatsApp Code"
                : "Step 4: PIN Reset Completed"}
            </span>
            <span className="font-mono text-[#F5D061] font-bold px-2 py-0.5 rounded-full bg-[#20052B] border border-[#D4AF37]/40 text-[10px]">
              Step {forgotStep} of 3
            </span>
          </div>

          {forgotSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{forgotSuccessMsg}</span>
            </div>
          )}

          {forgotError && (
            <div className="p-3.5 rounded-xl bg-red-950/90 border border-red-500/50 text-red-200 text-xs flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{forgotError}</span>
            </div>
          )}

          {/* FORGOT STEP 1: ENTER REGISTERED EMAIL OR PHONE */}
          {forgotStep === 1 && (
            <form onSubmit={handleForgotRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1.5">
                  Registered Email or 10-Digit Mobile Number *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="e.g. rahul@gmail.com or 9876543210"
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors"
                  />
                </div>
                <span className="text-[11px] text-white/50 mt-1.5 block leading-relaxed">
                  To reset your PIN, we will first send an OTP to your registered email, followed by a WhatsApp OTP.
                </span>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("login")}
                  className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold border border-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isForgotLoading}
                  className="flex-1 py-3.5 rounded-xl gold-gradient-btn font-bold text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all cursor-pointer"
                >
                  {isForgotLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#16031E]" />
                      <span>Checking Account...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 text-[#16031E]" />
                      <span>Send Email Verification Code</span>
                      <ArrowRight className="w-4 h-4 text-[#16031E]" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* FORGOT STEP 2: VERIFY EMAIL OTP */}
          {forgotStep === 2 && (
            <form onSubmit={handleForgotVerifyEmail} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed">
                Verification code dispatched to <strong>{forgotMaskedEmail || "your email"}</strong>. Please enter the 6-digit code below.
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-white/80">
                    Enter 6-Digit Email Code *
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="text-[11px] text-[#F5D061] hover:underline font-bold"
                  >
                    ← Change Account
                  </button>
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={forgotEmailOtp}
                  onChange={(e) => setForgotEmailOtp(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 123456"
                  className="w-full bg-[#16031E] border-2 border-[#D4AF37]/50 focus:border-[#F5D061] rounded-xl px-4 py-3.5 text-center text-2xl font-mono tracking-widest text-[#FFF8EE] outline-none shadow-inner"
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  type="submit"
                  disabled={isForgotLoading}
                  className="flex-1 py-3.5 rounded-xl gold-gradient-btn font-bold text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all cursor-pointer"
                >
                  {isForgotLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#16031E]" />
                      <span>Verifying Email...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#16031E]" />
                      <span>Verify Email &amp; Send WhatsApp Code</span>
                      <ArrowRight className="w-4 h-4 text-[#16031E]" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleForgotRequest}
                  disabled={isForgotLoading}
                  className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold border border-white/10 transition-colors"
                >
                  Resend
                </button>
              </div>
            </form>
          )}

          {/* FORGOT STEP 3: VERIFY WHATSAPP OTP */}
          {forgotStep === 3 && (
            <form onSubmit={handleForgotVerifyWhatsapp} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed">
                Email verified ✓! A 6-digit WhatsApp verification code was dispatched to <strong>{forgotMaskedPhone || "your WhatsApp"}</strong>. Enter it to reset your PIN.
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1.5">
                  Enter 6-Digit WhatsApp Code *
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={forgotWhatsappOtp}
                  onChange={(e) => setForgotWhatsappOtp(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 523499"
                  className="w-full bg-[#16031E] border-2 border-[#D4AF37]/50 focus:border-[#F5D061] rounded-xl px-4 py-3.5 text-center text-2xl font-mono tracking-widest text-[#FFF8EE] outline-none shadow-inner"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1.5">
                  Set New 6-Digit PIN (Optional)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={forgotNewPin}
                  onChange={(e) => setForgotNewPin(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 123456 (Leave blank to auto-generate)"
                  className="w-full bg-[#16031E] border border-white/20 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-center text-lg font-mono tracking-widest text-[#FFF8EE] outline-none transition-colors"
                />
                <span className="text-[11px] text-white/50 mt-1 block">
                  Leave blank if you prefer an auto-generated random PIN sent to your registered email.
                </span>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="submit"
                  disabled={isForgotLoading}
                  className="flex-1 py-3.5 rounded-xl gold-gradient-btn font-bold text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all cursor-pointer"
                >
                  {isForgotLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#16031E]" />
                      <span>Resetting PIN...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4 text-[#16031E]" />
                      <span>Verify WhatsApp &amp; Reset PIN</span>
                      <ArrowRight className="w-4 h-4 text-[#16031E]" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* FORGOT STEP 4: SUCCESS CONFIRMATION */}
          {forgotStep === 4 && (
            <div className="p-6 rounded-2xl bg-gradient-to-b from-emerald-950/60 via-[#1C0324] to-[#12021A] border-2 border-emerald-500/50 text-center space-y-4 animate-fadeIn">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="font-serif font-black text-white text-xl">New PIN Dispatched!</h3>
              <p className="text-xs text-white/80 max-w-sm mx-auto leading-relaxed">
                Your 6-digit security PIN has been set and dispatched to your registered <strong>Email ({forgotMaskedEmail})</strong>. Please check your inbox or spam folder.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("login");
                    if (forgotIdentifier) setLoginIdentifier(forgotIdentifier);
                  }}
                  className="w-full py-3.5 rounded-xl gold-gradient-btn font-bold text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 cursor-pointer"
                >
                  <Lock className="w-4 h-4 text-[#16031E]" />
                  <span>Return to Sign In</span>
                  <ArrowRight className="w-4 h-4 text-[#16031E]" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW C: GOOGLE ACCOUNT ONBOARDING (IF PROFILE INCOMPLETE)      */}
      {/* ============================================================== */}
      {activeTab === "google_complete" && (
        <form onSubmit={handleSaveGoogleProfile} className="space-y-4">
          {googleError && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{googleError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1">
              Google Account Email
            </label>
            <input
              type="email"
              disabled
              value={googleEmail}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white/50 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1">
              Recipient Full Name *
            </label>
            <input
              type="text"
              required
              value={googleName}
              onChange={(e) => setGoogleName(e.target.value)}
              placeholder="e.g. Ramesh Yadav"
              className="w-full bg-[#16031E] border border-white/20 focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1">
              Mobile Number * (For Delivery Rider Calls)
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-white/20 bg-white/5 text-white/70 font-mono text-xs">
                +91
              </span>
              <input
                type="tel"
                required
                maxLength={10}
                value={googlePhone}
                onChange={(e) => setGooglePhone(e.target.value)}
                placeholder="9876543210"
                className="w-full bg-[#16031E] border border-white/20 focus:border-[#D4AF37] rounded-r-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1">
              Doorstep Delivery Address *
            </label>
            <input
              type="text"
              required
              value={googleAddress}
              onChange={(e) => setGoogleAddress(e.target.value)}
              placeholder="House #, Street, Near Temple..."
              className="w-full bg-[#16031E] border border-white/20 focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1">
                Locality / Village *
              </label>
              <select
                value={googleLocality}
                onChange={(e) => setGoogleLocality(e.target.value)}
                className="w-full bg-[#16031E] border border-white/20 focus:border-[#D4AF37] rounded-xl px-3 py-2 text-xs text-white outline-none"
              >
                {(settings.service_areas || ["Kothal Kalan (Village & Main Chowk)"]).map((area) => (
                  <option key={area} value={area} className="bg-[#16031E]">
                    {area}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1">
                Landmark (Optional)
              </label>
              <input
                type="text"
                value={googleLandmark}
                onChange={(e) => setGoogleLandmark(e.target.value)}
                placeholder="Near Water Tank"
                className="w-full bg-[#16031E] border border-white/20 focus:border-[#D4AF37] rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSavingGoogleProfile}
            className="w-full py-3.5 rounded-xl gold-gradient-btn font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95"
          >
            {isSavingGoogleProfile ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#16031E]" />
                <span>Saving Profile...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#16031E]" />
                <span>Save Address &amp; Proceed</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* Security Footer Notice */}
      <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-[11px] text-[#D3BEB0]">
        <ShieldCheck className="w-3.5 h-3.5 text-[#F5D061]" />
        <span>256-bit encrypted • Powered by Neon Postgres &amp; Auth</span>
      </div>
    </div>
  );
}
