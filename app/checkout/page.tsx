"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/context/cart-context";
import { useStoreSettings } from "@/lib/context/store-context";
import { useUserAuth } from "@/lib/context/user-auth-context";
import { AnnouncementBar } from "@/components/storefront/AnnouncementBar";
import { Navbar } from "@/components/storefront/Navbar";
import { Footer } from "@/components/storefront/Footer";
import { PaymentSelectionModal } from "@/components/checkout/PaymentSelectionModal";
import { MapLocationPicker } from "@/components/maps/MapLocationPicker";
import { CustomerAuthPortal } from "@/components/auth/CustomerAuthPortal";
import { StoreClosedModal } from "@/components/storefront/StoreClosedModal";
import {
  ShieldCheck,
  Truck,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  KeyRound,
  UserCheck,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  MapPin,
  Phone,
  User,
  Gift,
  Check,
  LogOut,
  Edit3,
  Tag,
  Ticket,
  Clock,
  X,
  ShieldAlert,
  Receipt,
} from "lucide-react";

// Default coordinates: Kothal Kalan, Mahendragarh, Haryana
const KOTHAL_KALAN_LAT = 28.1907;
const KOTHAL_KALAN_LNG = 76.1624;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clearCart, isHydrated: cartHydrated } = useCart();
  const { settings } = useStoreSettings();
  const {
    user,
    isAuthenticated,
    isHydrated: authHydrated,
    sendOtp,
    verifyOtp,
    loginWithPin,
    signupWithPin,
    loginWithGoogle,
    saveProfile,
    logout,
  } = useUserAuth();

  // Tab State when NOT authenticated: "login" or "signup"
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");

  // Login Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Signup Multi-Step State
  // 1 = Email, Phone, Create PIN; 2 = Email OTP; 3 = Address & Map Pin
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPin, setSignupPin] = useState("");
  const [signupOtp, setSignupOtp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSuccessMsg, setSignupSuccessMsg] = useState("");

  // Delivery Profile State (used during Signup Step 3 & Checkout Delivery)
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [locality, setLocality] = useState(
    settings.service_areas[0] || "Kothal Kalan (Village & Main Chowk)"
  );
  const [landmark, setLandmark] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [latitude, setLatitude] = useState<number>(KOTHAL_KALAN_LAT);
  const [longitude, setLongitude] = useState<number>(KOTHAL_KALAN_LNG);
  const [mapUrl, setMapUrl] = useState<string>(
    `https://www.google.com/maps?q=${KOTHAL_KALAN_LAT},${KOTHAL_KALAN_LNG}`
  );

  // Address edit mode when authenticated
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  // Order Placement & Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isStoreClosedModalOpen, setIsStoreClosedModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");

  // Coupon Code State
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount_type: "flat_amount" | "percentage" | "free_delivery";
    discount_amount: number;
    free_delivery?: boolean;
    description?: string;
  } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);

  // Fetch active festive coupons from server
  useEffect(() => {
    fetch("/api/coupons")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAvailableCoupons(data);
      })
      .catch(() => {});
  }, []);

  const [hasPastOrders, setHasPastOrders] = useState<boolean>(false);

  // Check past orders to verify if returning customer
  useEffect(() => {
    const activeEmail = user?.email || loginEmail;
    if (!activeEmail) {
      setHasPastOrders(false);
      return;
    }
    fetch(`/api/orders?email=${encodeURIComponent(activeEmail)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          const isReturning = data.length > 0;
          setHasPastOrders(isReturning);
          // ONLY FREEDEL is restricted to new customers on their 1st order!
          if (isReturning && appliedCoupon?.code?.toUpperCase() === "FREEDEL") {
            setAppliedCoupon(null);
            setCouponError(
              "Free delivery coupon (FREEDEL) is valid only for new customers on their 1st order. Standard delivery fee applies."
            );
          }
        }
      })
      .catch(() => {});
  }, [user?.email, loginEmail, appliedCoupon?.code]);

  const isReturningUser = hasPastOrders;
  const isFirstOrder = !hasPastOrders;
  const standardDeliveryFee = Math.round(Number(settings.default_delivery_fee) || 21);
  const initialDeliveryFee = items.length === 0 ? 0 : isFirstOrder ? 0 : standardDeliveryFee;
  const isFreeDeliveryCoupon = Boolean(
    appliedCoupon?.free_delivery || appliedCoupon?.discount_type === "free_delivery"
  );
  const deliveryFee = isFreeDeliveryCoupon ? 0 : initialDeliveryFee;
  const couponDiscountAmount = appliedCoupon ? Math.round(Number(appliedCoupon.discount_amount) || 0) : 0;
  const rawTotal = subtotal + deliveryFee - couponDiscountAmount;
  const finalTotal =
    items.length === 0
      ? 0
      : Math.max(1, Math.round(rawTotal));

  // Handler to apply or validate coupon
  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply || couponInput).trim().toUpperCase();
    if (!code) {
      setCouponError("Please enter a coupon code");
      return;
    }
    setIsValidatingCoupon(true);
    setCouponError("");

    try {
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          subtotal,
          deliveryFee: standardDeliveryFee,
          customerEmail: user?.email || loginEmail || signupEmail,
          customerPhone: customerPhone || signupPhone || user?.savedProfile?.customer_phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponError(data.error || data.message || "Invalid coupon code");
        setAppliedCoupon(null);
      } else {
        const isFreeDel = Boolean(
          data.coupon?.free_delivery ||
          data.coupon?.discount_type === "free_delivery" ||
          data.finalDeliveryCharge === 0 ||
          data.final_delivery_charge === 0
        );
        setAppliedCoupon({
          code: data.coupon.code,
          discount_type: data.coupon.discount_type,
          discount_amount: data.discount_amount || 0,
          free_delivery: isFreeDel,
          description: data.coupon.description,
        });
        setCouponInput(data.coupon.code);
        setCouponError("");
      }
    } catch {
      setCouponError("Failed to validate coupon");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  const isStoreShutoff = Boolean(settings.store_shutoff || settings.store_status === "shutoff");
  const isStoreClosed = isStoreShutoff || settings.store_status !== "open" || !settings.accepts_orders;

  // Auto-populate delivery profile when user logs in or is retrieved from session
  useEffect(() => {
    if (user?.email) {
      setLoginEmail(user.email);
    }
    if (user?.savedProfile) {
      if (user.savedProfile.customer_name) setCustomerName(user.savedProfile.customer_name);
      if (user.savedProfile.customer_phone) setCustomerPhone(user.savedProfile.customer_phone);
      if (user.savedProfile.delivery_address) setDeliveryAddress(user.savedProfile.delivery_address);
      if (user.savedProfile.locality) setLocality(user.savedProfile.locality);
      if (user.savedProfile.landmark) setLandmark(user.savedProfile.landmark);
      if (user.savedProfile.delivery_instructions)
        setDeliveryInstructions(user.savedProfile.delivery_instructions);
      if (typeof user.savedProfile.latitude === "number") setLatitude(user.savedProfile.latitude);
      if (typeof user.savedProfile.longitude === "number") setLongitude(user.savedProfile.longitude);
      if (user.savedProfile.map_url) setMapUrl(user.savedProfile.map_url);
    }
  }, [user]);

  // ==========================================
  // HANDLERS FOR LOGIN WITH EMAIL & PIN
  // ==========================================
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!loginEmail.trim()) {
      setLoginError("Please enter your registered email address or 10-digit mobile number.");
      return;
    }

    if (!loginPin || loginPin.trim().length < 4) {
      setLoginError("Please enter your password or 6-digit PIN.");
      return;
    }

    setIsLoggingIn(true);
    const result = await loginWithPin(loginEmail.trim(), loginPin.trim());
    setIsLoggingIn(false);

    if (!result.success) {
      setLoginError(result.error || "Login failed. Please check your credentials.");
    } else {
      router.refresh();
    }
  };

  // ==========================================
  // HANDLERS FOR SIGNUP
  // ==========================================
  // Step 1 -> Send OTP to verify Email
  const handleSignupStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    setSignupSuccessMsg("");

    if (!signupEmail || !signupEmail.includes("@")) {
      setSignupError("Please enter a valid email address.");
      return;
    }

    const clean = signupPhone.replace(/[^0-9]/g, "");
    if (clean.length < 10) {
      setSignupError("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (!signupPassword || signupPassword.trim().length < 6) {
      setSignupError("Please enter an account password with at least 6 characters.");
      return;
    }

    if (!signupPin || !/^\d{6}$/.test(signupPin.trim())) {
      setSignupError("Please set a 6-digit numeric security PIN.");
      return;
    }

    setIsSendingOtp(true);
    const res = await sendOtp(signupEmail.trim());
    setIsSendingOtp(false);

    if (res.success) {
      setSignupSuccessMsg(`Verification code sent to ${signupEmail.trim()}`);
      setSignupStep(2);
    } else {
      setSignupError(res.error || "Failed to send verification code.");
    }
  };

  // Step 2 -> Verify Email OTP
  const handleSignupStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    setSignupSuccessMsg("");

    if (!signupOtp || signupOtp.trim().length < 4) {
      setSignupError("Please enter the 6-digit OTP code sent to your email.");
      return;
    }

    setIsVerifyingOtp(true);
    const res = await verifyOtp(signupEmail.trim(), signupOtp.trim());
    setIsVerifyingOtp(false);

    if (res.success) {
      // Autofill step 3 customer phone from step 1
      setCustomerPhone(signupPhone.replace(/[^0-9]/g, ""));
      setSignupSuccessMsg("Email verified! Now complete your full address & map doorstep pin.");
      setSignupStep(3);
    } else {
      setSignupError(res.error || "Incorrect OTP code. Please try again.");
    }
  };

  // Step 3 -> Save Full Profile & Kothal Kalan Map Pin
  const handleSignupStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");

    if (!customerName.trim() || customerName.trim().length < 2) {
      setSignupError("Please enter your recipient full name.");
      return;
    }

    if (!deliveryAddress.trim() || deliveryAddress.trim().length < 4) {
      setSignupError("Please enter your house number, street, or gali.");
      return;
    }

    if (!locality.trim()) {
      setSignupError("Please select or enter your village/locality.");
      return;
    }

    setIsSigningUp(true);
    const cleanPhone = customerPhone.replace(/[^0-9]/g, "");
    const finalMapUrl =
      mapUrl || `https://www.google.com/maps?q=${latitude},${longitude}`;

    const res = await signupWithPin({
      email: signupEmail.trim(),
      phone: cleanPhone,
      password: signupPassword.trim(),
      pin: signupPin.trim(),
      name: customerName.trim(),
      delivery_address: deliveryAddress.trim(),
      locality: locality.trim(),
      landmark: landmark.trim() || undefined,
      delivery_instructions: deliveryInstructions.trim() || undefined,
      latitude,
      longitude,
      map_url: finalMapUrl,
    });
    setIsSigningUp(false);

    if (!res.success) {
      setSignupError(res.error || "Failed to create account.");
    } else {
      router.refresh();
    }
  };

  // ==========================================
  // HANDLERS FOR ORDER PLACEMENT
  // ==========================================
  const handleOpenPaymentModal = (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError("");

    if (!isAuthenticated || !user?.email) {
      setOrderError("Please login or sign up first before placing your order.");
      return;
    }

    if (items.length === 0) {
      setOrderError("Your cart is empty. Please add sweets before placing an order.");
      return;
    }

    if (!customerName.trim() || customerName.trim().length < 2) {
      setOrderError("Please enter recipient name.");
      return;
    }

    const cleanPhone = customerPhone.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 10) {
      setOrderError("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (!deliveryAddress.trim() || deliveryAddress.trim().length < 4) {
      setOrderError("Please provide your delivery address.");
      return;
    }

    // After hours: Directly submit booking request without payment modal or upfront payment
    if (isStoreClosed) {
      handleConfirmOrder({ paymentMethod: "cod", isBookingRequest: true });
      return;
    }

    setIsPaymentModalOpen(true);
  };

  const handleConfirmOrder = async (paymentData: {
    paymentMethod: "cod" | "upi";
    upiReference?: string;
    upiScreenshot?: string;
    isBookingRequest?: boolean;
    orderNumber?: string;
    orderRef?: string;
  }) => {
    setIsSubmitting(true);
    setOrderError("");

    try {
      const cleanPhone = customerPhone.replace(/[^0-9]/g, "");
      const finalMapUrl =
        mapUrl || `https://www.google.com/maps?q=${latitude},${longitude}`;

      const idempotencyKey =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const payload = {
        customer_name: customerName.trim(),
        customer_email: user?.email || signupEmail.trim(),
        customer_phone: cleanPhone,
        delivery_address: deliveryAddress.trim(),
        locality: locality.trim(),
        landmark: landmark.trim() || undefined,
        delivery_instructions: deliveryInstructions.trim() || undefined,
        latitude,
        longitude,
        map_url: finalMapUrl,
        order_number: paymentData.orderNumber || undefined,
        order_ref: paymentData.orderRef || undefined,
        payment_method: paymentData.paymentMethod,
        upi_reference: paymentData.paymentMethod === "upi" ? paymentData.upiReference : undefined,
        upi_screenshot: paymentData.paymentMethod === "upi" ? paymentData.upiScreenshot : undefined,
        is_booking_request: paymentData.isBookingRequest,
        coupon_code: appliedCoupon ? appliedCoupon.code : undefined,
        idempotency_key: idempotencyKey,
        discount_amount:
          appliedCoupon && appliedCoupon.discount_type === "free_delivery"
            ? 0
            : couponDiscountAmount > 0
            ? couponDiscountAmount
            : undefined,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        if (res.status === 413 || responseText.includes("Request Entity Too Large")) {
          throw new Error("Screenshot or order payload is too large. Image was compressed, please retry placing order.");
        }
        throw new Error(responseText || `Server responded with status ${res.status}`);
      }

      if (!res.ok) {
        if (data.storeClosed) {
          setIsPaymentModalOpen(false);
          setIsStoreClosedModalOpen(true);
        }
        throw new Error(data.error || "Failed to place order.");
      }

      // Update saved profile
      saveProfile({
        customer_name: customerName.trim(),
        customer_phone: cleanPhone,
        delivery_address: deliveryAddress.trim(),
        locality: locality.trim(),
        landmark: landmark.trim() || undefined,
        delivery_instructions: deliveryInstructions.trim() || undefined,
        latitude,
        longitude,
        map_url: finalMapUrl,
        savedAt: new Date().toISOString(),
      });

      setIsPaymentModalOpen(false);
      clearCart();
      router.push(`/order-confirmation/${data.id}`);
    } catch (err: any) {
      setOrderError(err.message || "An unexpected error occurred while placing your order.");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#16031E] text-[#FFF8EE] overflow-x-hidden max-w-full w-full">
      <Navbar />

      <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {isStoreShutoff ? (
          <div className="py-8 max-w-3xl mx-auto space-y-8">
            <div className="p-8 rounded-3xl bg-gradient-to-b from-[#2B0515] via-[#1F0426] to-[#12021A] border-2 border-red-500/60 shadow-2xl text-center space-y-5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-500/20 text-red-300 text-xs font-bold uppercase tracking-wider border border-red-500/40">
                <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
                <span>Store Permanently Shut Off</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-serif font-black text-white">
                Online Shopping <span className="gold-gradient-text">Disabled</span>
              </h1>
              <p className="text-sm text-white/80 max-w-lg mx-auto leading-relaxed">
                {settings.shutoff_message ||
                  "Our online shopping portal is currently permanently shut off. All product listings and new order bookings are disabled. Customers can log in to view past orders and official receipts."}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                <Link
                  href="/orders"
                  className="w-full sm:w-auto py-3.5 px-6 rounded-full gold-gradient-btn font-bold text-xs flex items-center justify-center gap-2 shadow-xl active:scale-95 text-[#16031E]"
                >
                  <Receipt className="w-4 h-4 text-[#16031E]" />
                  <span>View Past Orders & Receipts</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/"
                  className="w-full sm:w-auto py-3.5 px-6 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/20 transition-all active:scale-95"
                >
                  <span>Return to Home</span>
                </Link>
              </div>
            </div>

            {/* If Customer is Authenticated, show their details card */}
            {isAuthenticated ? (
              <div className="p-6 rounded-2xl bg-[#20052B] border border-[#D4AF37]/30 text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#F5D061]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Signed in as {user?.email}</span>
                </div>
                <p className="text-xs text-white/70">
                  You are logged in. Tap below to access all your past receipts, print GST invoices, and track orders.
                </p>
                <Link
                  href="/orders"
                  className="inline-flex items-center gap-2 gold-gradient-btn px-6 py-2.5 rounded-full text-xs font-bold text-[#16031E] shadow-lg"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Go to My Orders & Receipts</span>
                </Link>
              </div>
            ) : (
              /* If Not Authenticated, allow customer to log in to view orders/receipts */
              <div className="rounded-3xl bg-[#20052B] border border-[#D4AF37]/25 p-6 sm:p-8 shadow-xl space-y-4">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-serif font-bold text-white">
                    Sign In to View Past Orders & Receipts
                  </h2>
                  <p className="text-xs text-[#D3BEB0]">
                    Log in with your email & PIN or Google to track deliveries and download official tax receipts.
                  </p>
                </div>
                <CustomerAuthPortal
                  mode="embedded"
                  initialTab="login"
                  onSuccess={() => {
                    router.push("/#shop");
                    router.refresh();
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Breadcrumb / Status Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#3B0E4D] border border-[#D4AF37]/40 text-[#F5D061] text-xs font-semibold tracking-wider uppercase mb-3 shadow-md">
            <Sparkles className="w-3.5 h-3.5 text-[#F5D061]" />
            <span>Shree Shyam Sweets • Diwali Delivery Portal</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-black text-[#FFF8EE]">
            {isAuthenticated ? (
              <>
                Doorstep Mithai <span className="gold-gradient-text">Checkout</span>
              </>
            ) : (
              <>
                Customer <span className="gold-gradient-text">Sign In & Registration</span>
              </>
            )}
          </h1>

          <p className="text-xs sm:text-sm text-[#D3BEB0] mt-2 max-w-lg mx-auto">
            {isAuthenticated
              ? "Confirm your delivery doorstep map pin and sweets booking."
              : "Sign up once with your email, mobile & map pin — next time order directly with 1-click!"}
          </p>
        </div>

        {/* Store Closed Banner Alert */}
        {isStoreClosed && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsStoreClosedModalOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setIsStoreClosedModalOpen(true);
            }}
            className="mb-8 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/90 via-rose-950/90 to-amber-950/90 border-2 border-amber-500/60 shadow-2xl cursor-pointer hover:border-amber-400 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-[#F5D061] shrink-0 shadow-lg">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-serif font-bold text-base text-white">
                    Store Currently Closed for Online Orders
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40 px-2 py-0.5 rounded-full">
                    Closed
                  </span>
                </div>
                <p className="text-xs text-amber-200/90 mt-1">
                  Opening timings: <strong className="text-white">{settings.operating_hours || "8:00 AM - 10:00 PM"}</strong>. Kindly visit our shop directly in Kothal Kalan!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsStoreClosedModalOpen(true);
              }}
              className="py-2 px-4 rounded-xl gold-gradient-btn text-xs font-bold shrink-0 shadow-md active:scale-95 transition-transform"
            >
              View Shop Address & Timings →
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 1: WHEN NOT LOGGED IN — SHOW DEDICATED SIGNUP & LOGIN     */}
        {/* (No 0 order value or place order button!)                      */}
        {/* ============================================================== */}
        {!isAuthenticated && (
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Left: Unified Customer Auth Portal */}
            <div className="md:col-span-7">
              <CustomerAuthPortal mode="embedded" />
            </div>

            {/* Right: Festive Privileges & Re-ordering Assurance Banner */}
            <div className="md:col-span-5 space-y-4">
              <div className="p-6 rounded-3xl bg-[#1C0526] border-2 border-[#D4AF37]/30 shadow-xl space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#580E1E] border border-[#D4AF37] flex items-center justify-center text-[#F5D061] shadow-[0_0_20px_rgba(212,175,55,0.4)]">
                  <Gift className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="text-lg font-serif font-bold text-white">
                    Festive Customer Privileges
                  </h3>
                  <p className="text-xs text-[#D3BEB0] mt-1 leading-relaxed">
                    By signing up once, Shree Shyam Sweets remembers your doorstep pin for fast, stress-free Diwali orders.
                  </p>
                </div>

                <div className="space-y-3 pt-2 text-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                      ✓
                    </div>
                    <div>
                      <strong className="text-white block">FREE Delivery on 1st Order</strong>
                      <span className="text-[#D3BEB0] text-[11px]">
                        Save ₹21 flat delivery fee on your welcome celebration booking.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                      ✓
                    </div>
                    <div>
                      <strong className="text-white block">Doorstep Google Maps Navigation</strong>
                      <span className="text-[#D3BEB0] text-[11px]">
                        Our riders open your exact GPS pin location directly in Google Maps.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                      ✓
                    </div>
                    <div>
                      <strong className="text-white block">Next Time Direct Re-ordering</strong>
                      <span className="text-[#D3BEB0] text-[11px]">
                        Just enter Email + PIN to order instantly without re-entering addresses.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sweets Waiting in Cart Chip */}
                {items.length > 0 && (
                  <div className="mt-4 p-3 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-[#F5D061] shrink-0" />
                    <span>
                      <strong>{items.length} Sweets</strong> waiting in your cart! Log in or sign up to complete your booking.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 2: WHEN AUTHENTICATED — SHOW CHECKOUT OR WELCOME READY    */}
        {/* ============================================================== */}
        {isAuthenticated && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Logged-in Customer Profile & Delivery Details */}
            <div className="lg:col-span-7 space-y-6">
              {/* Account Status Card */}
              <div className="p-5 rounded-3xl bg-[#20052B] border border-[#D4AF37]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-950 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-white/50 block text-[10px] uppercase font-semibold">
                      Logged In Customer
                    </span>
                    <span className="text-white font-bold text-sm block">
                      {customerName || user?.name || user?.email}
                    </span>
                    <span className="text-[#D3BEB0] text-[11px] font-mono">{user?.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setIsEditingAddress(!isEditingAddress)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#F5D061] border border-[#D4AF37]/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditingAddress ? "Lock Address" : "Adjust Pin"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => logout("/checkout")}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>

              {/* Delivery Address & Map Doorstep Card */}
              <form id="checkout-form" onSubmit={handleOpenPaymentModal} className="space-y-6">
                <div className="p-6 sm:p-8 rounded-3xl bg-[#20052B] border border-[#D4AF37]/30 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <h2 className="text-lg sm:text-xl font-serif font-bold text-white flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-[#F5D061]" />
                      <span>Delivery Address & Doorstep Map Pin</span>
                    </h2>

                    <span className="text-[10px] uppercase font-bold text-emerald-300 px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-500/40">
                      ✓ Profile Loaded
                    </span>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="block font-semibold text-[#D3BEB0] mb-1.5">
                        Recipient Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Ramesh Sharma"
                        className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-[#D3BEB0] mb-1.5">
                          Mobile Number *
                        </label>
                        <div className="flex">
                          <span className="inline-flex items-center px-3.5 rounded-l-xl border border-r-0 border-white/15 bg-white/5 text-white/70 font-mono text-sm">
                            +91
                          </span>
                          <input
                            type="tel"
                            required
                            maxLength={10}
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-r-xl px-4 py-3 text-sm text-white font-mono outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-[#D3BEB0] mb-1.5">
                          Village / Locality *
                        </label>
                        <select
                          value={locality}
                          onChange={(e) => setLocality(e.target.value)}
                          className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
                        >
                          {settings.service_areas.map((area) => (
                            <option key={area} value={area} className="bg-[#16031E] text-white">
                              {area}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#D3BEB0] mb-1.5">
                        Full Delivery Address *
                      </label>
                      <input
                        type="text"
                        required
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="House / Gali / Street"
                        className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-[#D3BEB0] mb-1.5">
                          Landmark (Optional)
                        </label>
                        <input
                          type="text"
                          value={landmark}
                          onChange={(e) => setLandmark(e.target.value)}
                          placeholder="e.g. Near Shiv Mandir"
                          className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-[#D3BEB0] mb-1.5">
                          Delivery Note (Optional)
                        </label>
                        <input
                          type="text"
                          value={deliveryInstructions}
                          onChange={(e) => setDeliveryInstructions(e.target.value)}
                          placeholder="Ring bell / Call on arrival"
                          className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-white outline-none"
                        />
                      </div>
                    </div>

                    {/* Interactive Draggable Doorstep Map Pin Picker (Kothal Kalan default) */}
                    <div className="pt-2">
                      <MapLocationPicker
                        latitude={latitude}
                        longitude={longitude}
                        locality={locality}
                        address={deliveryAddress}
                        onChange={(coords) => {
                          setLatitude(coords.latitude);
                          setLongitude(coords.longitude);
                          setMapUrl(coords.map_url);
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Coupon Code Section Before Payments */}
                {items.length > 0 && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#2D0936] to-[#1D0424] border border-[#D4AF37]/40 shadow-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-[#F5D061]" />
                        <span className="font-serif font-bold text-sm text-white">
                          Apply Coupon Code Before Payment
                        </span>
                      </div>
                      {appliedCoupon && (
                        <span className="text-[10px] uppercase font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          ✓ Applied
                        </span>
                      )}
                    </div>

                    {appliedCoupon ? (
                      <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="text-xs">
                            <span className="font-bold text-emerald-300 font-mono tracking-wider">
                              {appliedCoupon.code}
                            </span>
                            <span className="text-emerald-200 block text-[11px]">
                              {appliedCoupon.free_delivery && appliedCoupon.discount_amount > 0
                                ? `🎉 Saved ₹${appliedCoupon.discount_amount} + FREE Delivery!`
                                : appliedCoupon.free_delivery || appliedCoupon.discount_type === "free_delivery"
                                ? "🎉 Free Delivery Applied!"
                                : `🎉 Saved ₹${appliedCoupon.discount_amount} on this order!`}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveCoupon}
                          className="text-xs text-rose-300 hover:text-rose-200 hover:underline px-2.5 py-1 rounded bg-rose-950/40 border border-rose-500/30"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={couponInput}
                            onChange={(e) => {
                              setCouponInput(e.target.value.toUpperCase());
                              if (couponError) setCouponError("");
                            }}
                            placeholder="Enter coupon (e.g. SHUBHDIWALI)"
                            className="flex-1 min-w-0 bg-[#16031E] border border-white/20 focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-xs text-white uppercase placeholder:normal-case placeholder:text-white/30 outline-none font-mono"
                          />
                          <button
                            type="button"
                            disabled={!couponInput.trim() || isValidatingCoupon}
                            onClick={() => handleApplyCoupon()}
                            className="py-2.5 px-4 rounded-xl gold-gradient-btn text-xs font-bold shadow-md disabled:opacity-50 active:scale-95 transition-all flex items-center gap-1.5"
                          >
                            {isValidatingCoupon ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <span>Apply</span>
                            )}
                          </button>
                        </div>

                        {couponError && (
                          <p className="text-[11px] text-rose-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>{couponError}</span>
                          </p>
                        )}

                        {/* Quick Tap Available Coupons */}
                        {availableCoupons.length > 0 && (
                          <div className="pt-1.5 space-y-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-white/50 block font-semibold">
                              Available Diwali Offers:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {availableCoupons.map((c) => (
                                <button
                                  key={c.id || c.code}
                                  type="button"
                                  onClick={() => handleApplyCoupon(c.code)}
                                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-[#D4AF37]/30 text-[11px] text-[#F5D061] font-mono flex items-center gap-1 transition-colors"
                                >
                                  <Tag className="w-3 h-3 text-[#D4AF37]" />
                                  <span className="font-bold">{c.code}</span>
                                  <span className="text-white/60 text-[10px]">
                                    ({c.discount_type === "percentage"
                                      ? `${c.discount_value}% OFF`
                                      : c.discount_type === "free_delivery"
                                      ? "FREE DEL"
                                      : `₹${c.discount_value} OFF`})
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {orderError && (
                  <div className="p-3.5 rounded-2xl bg-red-950/90 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{orderError}</span>
                  </div>
                )}

                {/* After-Hours Booking Notice */}
                {isStoreClosed && items.length > 0 && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/90 via-[#23042A] to-purple-950/90 border border-[#D4AF37]/50 text-xs text-[#EAD8C7] space-y-2">
                    <div className="flex items-center gap-2 text-white font-bold">
                      <Clock className="w-4 h-4 text-[#F5D061]" />
                      <span>Shop Closed for Instant Orders (Hours: {settings.operating_hours || "8:00 AM - 10:00 PM"})</span>
                    </div>
                    <p className="text-white/80 leading-relaxed text-[11px]">
                      Our halwai workshop is currently closed for live dispatch. You can still submit an <strong>After-Hours Booking Request</strong>.
                      <strong> No upfront payment is required</strong>! Your request will be sent to the store manager. Once approved, you will be notified on the tracking page to choose your payment method (UPI / COD).
                    </p>
                  </div>
                )}

                {/* Mobile summary strip */}
                <div className="lg:hidden p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                  <span className="text-[#D3BEB0]">Total with Delivery & Discount:</span>
                  <span className="font-serif font-black text-[#F5D061] text-lg">₹{finalTotal}</span>
                </div>
              </form>
            </div>

            {/* Right Column: Order Review OR Welcome Card */}
            <div className="lg:col-span-5">
              {items.length > 0 ? (
                <div className="p-6 sm:p-8 rounded-3xl bg-[#24062E] border-2 border-[#D4AF37]/40 shadow-2xl sticky top-28 space-y-4">
                  <h3 className="text-lg sm:text-xl font-serif font-bold text-[#FFF8EE] pb-3 border-b border-white/10 flex items-center justify-between">
                    <span>Order Review ({items.length} {items.length === 1 ? "Sweet" : "Sweets"})</span>
                    <span className="text-xs font-mono text-[#F5D061]">Diwali Fresh</span>
                  </h3>

                  <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                    {items.map((item) => (
                      <div key={item.variantId} className="flex justify-between items-center text-xs">
                        <div>
                          <span className="font-semibold text-white block truncate max-w-[200px]">
                            {item.productName}
                          </span>
                          <span className="text-[#F5D061]">
                            {item.variantName} (Qty: {item.quantity})
                          </span>
                        </div>
                        <span className="font-bold font-serif text-white">
                          ₹{item.price * item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 pt-4 border-t border-white/10 text-xs sm:text-sm text-[#D3BEB0]">
                    <div className="flex justify-between">
                      <span>Sweets Subtotal</span>
                      <span className="font-semibold text-white">₹{subtotal}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-[#F5D061]" />
                        <span>Doorstep Delivery</span>
                      </span>
                      {isFreeDeliveryCoupon || isFirstOrder ? (
                        <div className="text-right">
                          <span className="font-bold text-emerald-400">FREE</span>
                          <span className="text-[10px] text-white/40 line-through ml-1.5">
                            ₹{standardDeliveryFee}
                          </span>
                          <span className="block text-[9px] text-emerald-300 font-semibold">
                            {isFreeDeliveryCoupon ? "Coupon Free Delivery" : "Welcome Gift (1st Order)"}
                          </span>
                        </div>
                      ) : (
                        <span className="font-semibold text-[#F5D061]">₹{deliveryFee}</span>
                      )}
                    </div>

                    {/* Coupon Discount Row if subtotal is discounted */}
                    {appliedCoupon && couponDiscountAmount > 0 && (
                      <div className="flex justify-between text-emerald-400 font-bold text-xs sm:text-sm">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Coupon Discount ({appliedCoupon.code})</span>
                        </span>
                        <span>-₹{couponDiscountAmount}</span>
                      </div>
                    )}

                    <div className="pt-3 border-t border-white/10 flex justify-between items-baseline text-sm sm:text-base font-bold text-[#FFF8EE]">
                      <span>Total Payable</span>
                      <span className="text-2xl font-serif text-[#F5D061]">₹{finalTotal}</span>
                    </div>
                  </div>

                  {/* Primary Place Order / Booking Request Button RIGHT BELOW FULL PAY DETAILS */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      form="checkout-form"
                      id="place-order-submit-btn"
                      disabled={isSubmitting}
                      className="w-full py-4 rounded-full font-black text-sm flex items-center justify-center gap-2 shadow-2xl transition-all active:scale-95 gold-gradient-btn cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-[#16031E]" />
                          <span>Submitting Request...</span>
                        </>
                      ) : isStoreClosed ? (
                        <>
                          <Clock className="w-4 h-4 text-[#16031E]" />
                          <span>Submit After-Hours Booking Request (No Upfront Payment)</span>
                          <ArrowRight className="w-4 h-4 text-[#16031E]" />
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 text-[#16031E]" />
                          <span>Proceed to Payment / Place Order (₹{finalTotal})</span>
                          <ArrowRight className="w-4 h-4 text-[#16031E]" />
                        </>
                      )}
                    </button>
                  </div>

                  <div className="pt-2 text-center">
                    <p className="text-[11px] text-[#D3BEB0]/70 flex items-center justify-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Prepared Fresh in Pure Desi Ghee</span>
                    </p>
                  </div>
                </div>
              ) : (
                /* When Cart has 0 items and user is logged in */
                <div className="p-6 sm:p-8 rounded-3xl bg-[#24062E] border-2 border-[#D4AF37]/30 shadow-2xl text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-950 border border-emerald-400/40 flex items-center justify-center text-emerald-400 mx-auto shadow-lg">
                    <Check className="w-7 h-7" />
                  </div>

                  <div>
                    <h3 className="text-xl font-serif font-bold text-white">
                      Profile Saved & Ready!
                    </h3>
                    <p className="text-xs text-[#D3BEB0] mt-1.5 leading-relaxed">
                      Your doorstep delivery location in <strong className="text-white">{locality}</strong> is pinned. Add sweets from the shop to place your order!
                    </p>
                  </div>

                  <Link
                    href="/#shop"
                    className="inline-flex items-center gap-2 py-3 px-6 rounded-full gold-gradient-btn font-bold text-xs shadow-lg active:scale-95 transition-all"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Browse Festive Sweets Menu</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* Payment Selection Modal */}
      <PaymentSelectionModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        amount={finalTotal}
        customerName={customerName}
        customerPhone={customerPhone}
        locality={locality}
        settings={settings}
        isSubmitting={isSubmitting}
        onConfirmOrder={handleConfirmOrder}
      />

      {/* Store Closed Modal */}
      <StoreClosedModal
        isOpen={isStoreClosedModalOpen}
        onClose={() => setIsStoreClosedModalOpen(false)}
        settings={settings}
      />

      {/* Sticky Mobile/Tablet Save Bar for Step 3 */}
      {!isAuthenticated && authTab === "signup" && signupStep === 3 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#16031E]/95 backdrop-blur-md border-t-2 border-[#D4AF37] p-3 sm:hidden flex items-center justify-between gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
          <div className="text-[11px] text-white/90">
            <span className="font-bold text-[#F5D061] block text-xs">Step 3 of 3</span>
            <span className="text-[10px] text-white/70">Pin your house on map</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const btn = document.getElementById("complete-signup-btn");
              if (btn) btn.click();
            }}
            disabled={isSigningUp}
            className="px-5 py-2.5 rounded-full gold-gradient-btn font-black text-xs flex items-center gap-1.5 shadow-xl active:scale-95 transition-all"
          >
            {isSigningUp ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save & Complete</span>
              </>
            )}
          </button>
        </div>
      )}

      <Footer />
    </div>
  );
}
