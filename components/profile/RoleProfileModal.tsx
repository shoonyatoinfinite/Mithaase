"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Mail,
  Phone,
  Lock,
  MapPin,
  Bike,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  KeyRound,
  Navigation,
  ExternalLink,
} from "lucide-react";

export interface RoleProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: "customer" | "admin" | "rider";
  initialRiderId?: string;
  initialData?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    phone_verified?: boolean;
    delivery_address?: string;
    locality?: string;
    landmark?: string;
    delivery_instructions?: string;
    latitude?: number;
    longitude?: number;
    map_url?: string;
    vehicle_number?: string;
    vehicle_type?: string;
  };
  onProfileUpdated?: (updatedData: any) => void;
}

export function RoleProfileModal({
  isOpen,
  onClose,
  role,
  initialRiderId,
  initialData,
  onProfileUpdated,
}: RoleProfileModalProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [phoneVerified, setPhoneVerified] = useState(Boolean(initialData?.phone_verified));
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");

  // SMS Verification state (Optional for customer profile)
  const [isSendingPhoneOtp, setIsSendingPhoneOtp] = useState(false);
  const [isVerifyingPhoneOtp, setIsVerifyingPhoneOtp] = useState(false);
  const [showPhoneOtpBox, setShowPhoneOtpBox] = useState(false);
  const [phoneOtpInput, setPhoneOtpInput] = useState("");
  const [phoneOtpTimer, setPhoneOtpTimer] = useState(0);
  const [phoneOtpError, setPhoneOtpError] = useState("");
  const [phoneOtpSuccess, setPhoneOtpSuccess] = useState("");

  // Customer specific
  const [deliveryAddress, setDeliveryAddress] = useState(initialData?.delivery_address || "");
  const [locality, setLocality] = useState(initialData?.locality || "Kothal Kalan (Village & Main Chowk)");
  const [landmark, setLandmark] = useState(initialData?.landmark || "");
  const [deliveryInstructions, setDeliveryInstructions] = useState(initialData?.delivery_instructions || "");
  const [latitude, setLatitude] = useState<number | null>(initialData?.latitude || null);
  const [longitude, setLongitude] = useState<number | null>(initialData?.longitude || null);
  const [mapUrl, setMapUrl] = useState(initialData?.map_url || "");
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [gpsNotice, setGpsNotice] = useState("");

  // 30-Second Countdown timer for SMS OTP
  useEffect(() => {
    if (phoneOtpTimer <= 0) return;
    const interval = setInterval(() => {
      setPhoneOtpTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [phoneOtpTimer]);

  // Rider specific
  const [vehicleNumber, setVehicleNumber] = useState(initialData?.vehicle_number || "");
  const [vehicleType, setVehicleType] = useState(initialData?.vehicle_type || "Motorbike");

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleDetectCustomerGps = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsNotice("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocatingGps(true);
    setGpsNotice("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingGps(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setLatitude(lat);
        setLongitude(lng);
        setMapUrl(`https://www.google.com/maps?q=${lat},${lng}`);
        setGpsNotice(`📍 Exact GPS coordinates pinned! (${lat}, ${lng}) - Click Save to persist.`);
      },
      () => {
        setIsLocatingGps(false);
        setGpsNotice("Unable to detect GPS position. Please check your browser location permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Populate from initialData or fetch if missing
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      if (initialData.name) setName(initialData.name);
      if (initialData.email) setEmail(initialData.email);
      if (initialData.phone) setPhone(initialData.phone);
      if (initialData.phone_verified !== undefined) setPhoneVerified(Boolean(initialData.phone_verified));
      if (initialData.delivery_address) setDeliveryAddress(initialData.delivery_address);
      if (initialData.locality) setLocality(initialData.locality);
      if (initialData.landmark) setLandmark(initialData.landmark);
      if (initialData.delivery_instructions) setDeliveryInstructions(initialData.delivery_instructions);
      if (initialData.latitude) setLatitude(Number(initialData.latitude));
      if (initialData.longitude) setLongitude(Number(initialData.longitude));
      if (initialData.map_url) setMapUrl(initialData.map_url);
      if (initialData.vehicle_number) setVehicleNumber(initialData.vehicle_number);
      if (initialData.vehicle_type) setVehicleType(initialData.vehicle_type);
    }

    // Fetch fresh data based on role
    async function loadFresh() {
      setIsLoading(true);
      setError("");
      try {
        if (role === "admin") {
          const res = await fetch("/api/admin/profile");
          if (res.ok) {
            const data = await res.json();
            setName(data.name || "Store Manager");
            setEmail(data.email || "admin@mithaase.in");
            setPhone(data.phone || "+91 9876543210");
          }
        } else if (role === "customer") {
          const customerEmail =
            initialData?.email ||
            (typeof window !== "undefined"
              ? sessionStorage.getItem("mithaase_user_email") ||
                JSON.parse(localStorage.getItem("mithaase_user") || "{}").email
              : "");
          if (customerEmail) {
            const res = await fetch(`/api/customer/profile?email=${encodeURIComponent(customerEmail)}`);
            if (res.ok) {
              const data = await res.json();
              setName(data.name || "");
              setEmail(data.email || customerEmail);
              setPhone(data.phone || "");
              if (data.phone_verified !== undefined) {
                setPhoneVerified(Boolean(data.phone_verified));
              }
              setDeliveryAddress(data.delivery_address || "");
              setLocality(data.locality || "Kothal Kalan (Village & Main Chowk)");
              setLandmark(data.landmark || "");
              if (data.delivery_instructions) setDeliveryInstructions(data.delivery_instructions);
              if (data.latitude) setLatitude(Number(data.latitude));
              if (data.longitude) setLongitude(Number(data.longitude));
              if (data.map_url) setMapUrl(data.map_url);
            }
          }
        } else if (role === "rider") {
          const targetRiderId =
            initialRiderId ||
            initialData?.id ||
            (typeof window !== "undefined" ? sessionStorage.getItem("mithaase_rider_id") : "");
          if (targetRiderId) {
            const res = await fetch(`/api/rider/profile?id=${encodeURIComponent(targetRiderId)}`);
            if (res.ok) {
              const data = await res.json();
              setName(data.name || "");
              setEmail(data.email || "rider@mithaase.in");
              setPhone(data.phone || "");
              if (data.phone_verified !== undefined) {
                setPhoneVerified(Boolean(data.phone_verified));
              }
              setVehicleNumber(data.vehicle_number || "");
              setVehicleType(data.vehicle_type || "Motorbike");
            }
          }
        }
      } catch {
        // keep initialData
      } finally {
        setIsLoading(false);
      }
    }

    loadFresh();
  }, [isOpen, role, initialRiderId, initialData]);

  if (!isOpen) return null;

  const handleSendPhoneOtp = async () => {
    setPhoneOtpError("");
    setPhoneOtpSuccess("");
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      setPhoneOtpError("Please enter a valid 10-digit Indian mobile number (starts with 6-9).");
      return;
    }

    setIsSendingPhoneOtp(true);
    try {
      const res = await fetch("/api/phone/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send verification code via SMS.");
      }
      setShowPhoneOtpBox(true);
      setPhoneOtpTimer(30);
      setPhoneOtpSuccess(data.message || "6-digit OTP sent to your phone via SMS!");
    } catch (err: any) {
      setPhoneOtpError(err.message || "Failed to send SMS OTP.");
    } finally {
      setIsSendingPhoneOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    setPhoneOtpError("");
    setPhoneOtpSuccess("");
    const cleanOtp = phoneOtpInput.replace(/\D/g, "").slice(0, 6);
    if (cleanOtp.length !== 6) {
      setPhoneOtpError("Please enter the complete 6-digit OTP received via SMS.");
      return;
    }

    setIsVerifyingPhoneOtp(true);
    try {
      const res = await fetch("/api/phone/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: cleanOtp }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify phone OTP.");
      }
      setPhoneVerified(true);
      setShowPhoneOtpBox(false);
      setPhoneOtpInput("");
      setPhoneOtpSuccess("🎉 Mobile number verified successfully!");
      if (data.customer) {
        onProfileUpdated?.(data.customer);
      }
    } catch (err: any) {
      setPhoneOtpError(err.message || "Incorrect OTP. Please try again.");
    } finally {
      setIsVerifyingPhoneOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError("");
    setSuccessMsg("");

    try {
      if (role === "admin") {
        const cleanPhone = phone.replace(/\D/g, "");
        if (cleanPhone.length !== 10) {
          setError("Admin mobile number must be exactly 10 digits.");
          setIsSaving(false);
          return;
        }
        const cleanPin = pin.trim() ? pin.replace(/\D/g, "") : "";
        if (!cleanPin || cleanPin.length !== 6) {
          setError("Admin Security PIN must be exactly 6 digits.");
          setIsSaving(false);
          return;
        }

        const res = await fetch("/api/admin/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phone: cleanPhone, pin: cleanPin }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update admin profile.");
        setSuccessMsg("Admin profile updated successfully!");
        onProfileUpdated?.(data.profile);
      } else if (role === "customer") {
        const res = await fetch("/api/customer/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email, // Email sent for identification, cannot be modified
            name,
            phone,
            password: password.trim() ? password.trim() : undefined,
            pin: pin.trim() ? pin.trim() : undefined,
            delivery_address: deliveryAddress,
            locality,
            landmark,
            delivery_instructions: deliveryInstructions,
            latitude: latitude || undefined,
            longitude: longitude || undefined,
            map_url: mapUrl || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update customer profile.");
        setSuccessMsg("Profile & Delivery Address updated successfully!");
        onProfileUpdated?.(data.customer);
      } else if (role === "rider") {
        const cleanPhone = phone.replace(/\D/g, "");
        if (cleanPhone.length !== 10) {
          setError("Rider mobile number must be exactly 10 digits.");
          setIsSaving(false);
          return;
        }
        const cleanPin = pin.trim() ? pin.replace(/\D/g, "") : "";
        if (pin.trim() && cleanPin.length !== 6) {
          setError("Rider security PIN must be exactly 6 digits.");
          setIsSaving(false);
          return;
        }

        const targetRiderId =
          initialRiderId ||
          initialData?.id ||
          (typeof window !== "undefined" ? sessionStorage.getItem("mithaase_rider_id") : "");
        const res = await fetch("/api/rider/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: targetRiderId,
            name,
            phone: cleanPhone,
            vehicle_number: vehicleNumber,
            vehicle_type: vehicleType,
            pin: cleanPin || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update rider profile.");
        setSuccessMsg("Rider profile & fleet vehicle updated successfully!");
        onProfileUpdated?.(data.rider);
      }

      setTimeout(() => {
        setSuccessMsg("");
      }, 3500);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const roleLabel =
    role === "admin" ? "Store Administrator" : role === "rider" ? "Delivery Rider" : "Valued Customer";

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg my-auto rounded-3xl bg-[#1C0324] border-2 border-[#D4AF37]/50 shadow-[0_10px_50px_rgba(0,0,0,0.85)] p-6 sm:p-8 space-y-5 text-left animate-in fade-in zoom-in-95 duration-200">
        {/* Top Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-white/10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#580E1E] to-[#2B0938] border border-[#D4AF37] flex items-center justify-center text-[#F5D061] shadow-[0_0_20px_rgba(212,175,55,0.3)] shrink-0">
            {role === "rider" ? <Bike className="w-6 h-6" /> : <User className="w-6 h-6" />}
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#3B0E4D] border border-[#D4AF37]/40 text-[#F5D061] text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-[#F5D061]" />
              <span>{roleLabel} Profile</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-black text-white mt-1">
              Account <span className="gold-gradient-text">Settings & Details</span>
            </h2>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-950/90 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-8 text-center text-xs text-white/50 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#F5D061]" />
            <span>Loading profile details...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* STRICT EMAIL FIELD: Read-Only / Non-Modifiable */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-white/70">
                  Registered Email Address (Permanent ID)
                </label>
                <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Cannot be changed</span>
                </span>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-white/30 absolute left-3.5 top-3" />
                <input
                  type="email"
                  disabled
                  value={email}
                  readOnly
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white/50 cursor-not-allowed select-none"
                />
              </div>
            </div>

            {/* Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-white/80 mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-white/40 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-9 pr-3 py-2.5 text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block font-semibold text-white/80">
                    Mobile Number *
                  </label>
                  {role === "customer" && (
                    phoneVerified ? (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Verified</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendPhoneOtp}
                        disabled={isSendingPhoneOtp || phoneOtpTimer > 0 || phone.replace(/\D/g, "").length !== 10}
                        className="text-[10px] text-[#F5D061] hover:text-white bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 border border-[#D4AF37]/40 px-2.5 py-0.5 rounded-full transition-all cursor-pointer font-bold disabled:opacity-50"
                      >
                        {isSendingPhoneOtp
                          ? "Sending..."
                          : phoneOtpTimer > 0
                          ? `Resend in ${phoneOtpTimer}s`
                          : "Verify via SMS"}
                      </button>
                    )
                  )}
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 text-white/40 absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phone}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setPhone(clean);
                      setPhoneVerified(false);
                      setShowPhoneOtpBox(false);
                      setPhoneOtpError("");
                    }}
                    placeholder="10-digit mobile"
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-9 pr-3 py-2.5 text-white font-mono outline-none"
                  />
                </div>
                {(role === "rider" || role === "admin") && (
                  <span className="text-[10px] text-white/40 block mt-1">
                    Must be exactly 10 digits
                  </span>
                )}
                {role === "customer" && phoneOtpError && !showPhoneOtpBox && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1.5 bg-rose-950/50 p-2 rounded-lg border border-rose-500/30">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                    <span>{phoneOtpError}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Optional Customer Phone Verification Box */}
            {role === "customer" && showPhoneOtpBox && !phoneVerified && (
              <div className="p-3.5 rounded-2xl bg-[#280838] border border-[#D4AF37]/50 space-y-2.5 animate-fadeIn shadow-lg">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white font-bold flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#F5D061]" />
                    <span>Enter 6-Digit SMS Code</span>
                  </span>
                  <span className="text-[#F5D061] font-mono text-[11px]">
                    Sent to +91 {phone.replace(/\D/g, "").slice(-10)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={phoneOtpInput}
                    onChange={(e) => {
                      setPhoneOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setPhoneOtpError("");
                    }}
                    placeholder="• • • • • •"
                    className="flex-1 bg-[#16031E] border border-white/20 focus:border-[#D4AF37] rounded-xl px-3 py-2 text-center text-sm font-mono tracking-widest text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyPhoneOtp}
                    disabled={isVerifyingPhoneOtp || phoneOtpInput.replace(/\D/g, "").length !== 6}
                    className="px-4 py-2 rounded-xl gold-gradient-btn text-xs font-bold shrink-0 disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    {isVerifyingPhoneOtp ? "Verifying..." : "Confirm OTP"}
                  </button>
                </div>

                {phoneOtpError && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 bg-rose-950/50 p-2 rounded-lg border border-rose-500/30">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{phoneOtpError}</span>
                  </p>
                )}

                {phoneOtpSuccess && (
                  <p className="text-[11px] text-emerald-300 flex items-center gap-1 bg-emerald-950/50 p-2 rounded-lg border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span>{phoneOtpSuccess}</span>
                  </p>
                )}

                <div className="flex justify-between items-center text-[10px] text-white/60 pt-1 border-t border-white/10">
                  <span>Didn&apos;t get SMS code?</span>
                  <button
                    type="button"
                    disabled={phoneOtpTimer > 0 || isSendingPhoneOtp}
                    onClick={handleSendPhoneOtp}
                    className="text-[#F5D061] hover:underline font-bold disabled:opacity-50 disabled:no-underline cursor-pointer"
                  >
                    {phoneOtpTimer > 0 ? `Resend SMS in ${phoneOtpTimer}s` : "Resend OTP SMS"}
                  </button>
                </div>
              </div>
            )}

            {/* CUSTOMER ONLY: Delivery Address & Locality */}
            {role === "customer" && (
              <div className="space-y-3 pt-1 border-t border-white/10">
                <span className="text-[11px] font-bold text-[#F5D061] uppercase tracking-wider block">
                  Delivery Destination
                </span>

                <div>
                  <label className="block font-semibold text-white/80 mb-1">
                    Doorstep Address *
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-white/40 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="House / Street address"
                      className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-9 pr-3 py-2.5 text-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-white/80 mb-1">
                      Locality / Village *
                    </label>
                    <input
                      type="text"
                      required
                      value={locality}
                      onChange={(e) => setLocality(e.target.value)}
                      className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3 py-2.5 text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-white/80 mb-1">
                      Landmark (Optional)
                    </label>
                    <input
                      type="text"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="e.g. Near Shiv Mandir"
                      className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3 py-2.5 text-white outline-none"
                    />
                  </div>
                </div>

                {/* Delivery Instructions */}
                <div>
                  <label className="block font-semibold text-white/80 mb-1">
                    Special Delivery Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    value={deliveryInstructions}
                    onChange={(e) => setDeliveryInstructions(e.target.value)}
                    placeholder="e.g. Leave with security / Ring bell twice / Near corner shop"
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-white outline-none placeholder-white/30"
                  />
                </div>

                {/* Map & GPS Pin Section */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/40 to-[#180320] border border-[#D4AF37]/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-[#F5D061] font-bold">
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Doorstep Map Location &amp; GPS Pin</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleDetectCustomerGps}
                      disabled={isLocatingGps}
                      className="px-2.5 py-1 rounded-lg bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#F5D061] text-[11px] font-bold border border-[#D4AF37]/40 flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                    >
                      {isLocatingGps ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin text-[#F5D061]" />
                          <span>Detecting GPS...</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="w-3 h-3 text-[#F5D061]" />
                          <span>📍 Detect My Live GPS</span>
                        </>
                      )}
                    </button>
                  </div>

                  {latitude && longitude ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10 text-[11px]">
                      <span className="font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                        Lat: {latitude}, Lng: {longitude}
                      </span>

                      <a
                        href={mapUrl || `https://www.google.com/maps?q=${latitude},${longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#F5D061] hover:text-white flex items-center gap-1 font-semibold underline"
                      >
                        <span>Open on Google Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-[11px] text-white/50">
                      No exact GPS pin attached yet. Click &ldquo;Detect My Live GPS&rdquo; to help our delivery rider navigate directly to your doorstep.
                    </p>
                  )}

                  {gpsNotice && (
                    <div className="text-[11px] text-amber-300 font-medium">
                      {gpsNotice}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* RIDER ONLY: Vehicle Info */}
            {role === "rider" && (
              <div className="space-y-3 pt-1 border-t border-white/10">
                <span className="text-[11px] font-bold text-[#F5D061] uppercase tracking-wider block">
                  Fleet Vehicle Details
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-white/80 mb-1">
                      Vehicle Type
                    </label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3 py-2 text-white outline-none"
                    >
                      <option value="Motorbike">Motorbike</option>
                      <option value="Scooter">Scooter</option>
                      <option value="E-Bike">Electric Bike</option>
                      <option value="Other">Other Vehicle</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-white/80 mb-1">
                      Registration Plate Number
                    </label>
                    <input
                      type="text"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      placeholder="e.g. HR-19-AB-1234"
                      className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3 py-2.5 text-white font-mono uppercase outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Security PIN / Password Update */}
            <div className="pt-2 border-t border-white/10 space-y-3">
              <span className="text-[11px] font-bold text-[#F5D061] uppercase tracking-wider block">
                Security Credentials Update (Leave empty to keep current)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {role === "customer" && (
                  <div>
                    <label className="block font-semibold text-white/80 mb-1">
                      New Password (Min 6 chars)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-white/40 absolute left-3 top-3" />
                      <input
                        type="password"
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-9 pr-3 py-2 text-white outline-none"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-white/80 mb-1">
                    {role === "admin"
                      ? "New Admin Security PIN (6 Digits) *"
                      : role === "rider"
                      ? "New Rider Security PIN (6 Digits)"
                      : "New Quick PIN (6 Digits)"}
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-white/40 absolute left-3 top-3" />
                    <input
                      type="password"
                      maxLength={6}
                      value={pin}
                      onChange={(e) =>
                        setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder={
                        role === "admin"
                          ? "Enter 6-digit PIN"
                          : role === "rider"
                          ? "Enter 6-digit PIN"
                          : "Enter 6-digit PIN"
                      }
                      className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-9 pr-3 py-2 text-white font-mono outline-none"
                    />
                  </div>
                  {(role === "admin" || role === "rider") && (
                    <span className="text-[10px] text-white/40 block mt-1">
                      Must be exactly 6 digits
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 flex gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl gold-gradient-btn font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#16031E]" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#16031E]" />
                    <span>Save &amp; Update Profile</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
