"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Diya } from "@/components/animations/Diya";
import { Lock, ArrowRight, ShieldCheck, User, KeyRound, AlertCircle, Eye, EyeOff, Sparkles } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [adminId, setAdminId] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = adminId.trim();
    if (!cleanId) {
      setError("Please enter your Admin ID, Email, or 10-digit mobile number");
      return;
    }
    if (/^\d+$/.test(cleanId) && cleanId.length !== 10) {
      setError("Admin mobile number must be exactly 10 digits");
      return;
    }

    const cleanPin = pin.replace(/\D/g, "");
    if (cleanPin.length !== 6) {
      setError("Admin Security PIN must be exactly 6 digits");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: cleanId, pin: cleanPin }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem("mithaase_admin_auth", "true");
        sessionStorage.setItem("mithaase_admin_id", cleanId);
        if (data.admin?.name) {
          sessionStorage.setItem("mithaase_admin_name", data.admin.name);
        }
        if (data.admin?.email) {
          sessionStorage.setItem("mithaase_admin_email", data.admin.email);
        }
      }

      router.push("/admin");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Invalid Admin ID or Security PIN.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-radial-gradient from-[#2B0836] via-[#1A0324] to-[#100117]">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#1C0324] border-2 border-[#D4AF37]/40 shadow-[0_10px_50px_rgba(0,0,0,0.8)] space-y-6 text-center">
        {/* Logo */}
        <div className="w-16 h-16 rounded-full bg-[#400B16] border-2 border-[#D4AF37] flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(212,175,55,0.4)]">
          <Diya size="sm" className="scale-90" />
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#F5D061] block mb-1">
            Shree Shyam Sweets
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif font-black text-white">
            Staff & <span className="gold-gradient-text">Admin Login</span>
          </h1>
          <p className="text-xs text-[#D3BEB0] mt-1.5 leading-relaxed">
            Enter your Admin ID/Email and Security PIN to access operations, live orders, rider management, and POS.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-red-950/90 border border-red-500/50 text-red-200 text-xs text-left flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs text-left">
          {/* Field 1: Admin ID / 10-Digit Mobile */}
          <div>
            <label className="block text-white/80 font-bold mb-1.5">
              Admin ID / 10-Digit Mobile / Email *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                autoFocus
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                placeholder="Enter Admin ID, 10-digit mobile, or email"
                className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-10 pr-4 py-3 text-white text-sm outline-none transition-colors"
              />
            </div>
          </div>

          {/* Field 2: Security PIN */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-white/80 font-bold">
                Security PIN (6 Digits) *
              </label>
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="text-[11px] text-[#F5D061] hover:text-white flex items-center gap-1 cursor-pointer"
              >
                {showPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showPin ? "Hide" : "Show"}</span>
              </button>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
              <input
                type={showPin ? "text" : "password"}
                required
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit security PIN"
                className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-10 pr-10 py-3 text-white font-mono text-sm tracking-widest outline-none transition-colors"
              />
            </div>
            <span className="text-[10px] text-white/40 block mt-1">
              Must be exactly 6 digits
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-full gold-gradient-btn font-bold text-sm shadow-xl active:scale-95 flex items-center justify-center gap-2 transition-all mt-2"
          >
            <span>{isLoading ? "Verifying Credentials..." : "Unlock Admin Dashboard"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Footer info without demo credentials */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-[#D3BEB0]">
            <Link href="/" className="hover:text-white transition-colors">
              ← Return to Storefront
            </Link>
            <span className="text-white/40 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Authorized Staff Only</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
