"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { useUserAuth } from "@/lib/context/user-auth-context";
import { useStoreSettings } from "@/lib/context/store-context";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, MapPin, Phone } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { syncGoogleCustomer } = useUserAuth();
  const { settings } = useStoreSettings();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsProfile, setNeedsProfile] = useState(false);

  // Profile completion state
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleName, setGoogleName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [locality, setLocality] = useState(
    settings.service_areas?.[0] || "Kothal Kalan (Village & Main Chowk)"
  );
  const [landmark, setLandmark] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function processAuth() {
      try {
        const session = await authClient.getSession();
        if (!session?.data?.user?.email) {
          // If session not ready immediately, wait 1 second and retry once
          setTimeout(async () => {
            const retrySession = await authClient.getSession();
            if (retrySession?.data?.user?.email) {
              await checkProfile(retrySession.data.user.email, retrySession.data.user.name || "");
            } else {
              setError("Could not retrieve Google account session. Please try logging in again.");
              setLoading(false);
            }
          }, 1200);
          return;
        }

        await checkProfile(session.data.user.email, session.data.user.name || "");
      } catch (err: any) {
        setError(err?.message || "Failed to complete Google authentication.");
        setLoading(false);
      }
    }

    async function checkProfile(email: string, name: string) {
      setGoogleEmail(email);
      setGoogleName(name);

      const res = await fetch(`/api/auth/customer/google-sync?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.exists && data.hasCompleteProfile) {
          router.replace("/#shop");
          router.refresh();
          return;
        }
      }
      // Needs address/phone details
      setNeedsProfile(true);
      setLoading(false);
    }

    processAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !address.trim()) {
      setError("Please provide a valid 10-digit mobile number and delivery address.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const res = await syncGoogleCustomer({
      email: googleEmail,
      name: googleName || "Valued Customer",
      phone: phone.trim(),
      delivery_address: address.trim(),
      locality: locality.trim(),
      landmark: landmark.trim(),
      latitude: 28.1907,
      longitude: 76.1624,
      map_url: `https://www.google.com/maps?q=28.1907,76.1624`,
    });

    setIsSubmitting(false);
    if (res.success) {
      router.replace("/#shop");
      router.refresh();
    } else {
      setError(res.error || "Failed to save profile.");
    }
  };

  return (
    <div className="min-h-screen bg-[#16031E] flex items-center justify-center p-4 text-[#FFF8EE]">
      <div className="w-full max-w-md bg-[#1D0427] border border-[#D4AF37]/40 rounded-3xl p-6 sm:p-8 shadow-2xl">
        {loading ? (
          <div className="text-center py-10 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-[#F5D061] mx-auto" />
            <h2 className="text-xl font-serif font-bold text-white">Verifying Google Sign-In...</h2>
            <p className="text-xs text-[#D3BEB0]">
              Connecting your Google account with Mithaasé securely via Neon Auth.
            </p>
          </div>
        ) : error && !needsProfile ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-500/50 flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white">Authentication Notice</h2>
            <p className="text-xs text-rose-300">{error}</p>
            <button
              onClick={() => router.replace("/")}
              className="mt-4 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
            >
              Return to Storefront
            </button>
          </div>
        ) : (
          <div>
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#580E1E] border border-[#D4AF37]/40 text-[#F5D061] text-[11px] font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>One Last Step</span>
              </div>
              <h2 className="text-2xl font-serif font-black text-white">Diwali Delivery Details</h2>
              <p className="text-xs text-[#D3BEB0] mt-1">
                Welcome <span className="text-[#F5D061] font-semibold">{googleName || googleEmail}</span>! Please enter your delivery address to complete your profile.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#D4AF37] mb-1">
                  10-Digit Mobile Number (For Delivery Updates)
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white/5 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4AF37] mb-1">
                  Full Delivery Address
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="House number, Street name, Colony"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-white/5 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#D4AF37] mb-1">
                    Locality / Area
                  </label>
                  <select
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    className="w-full bg-[#240630] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    {(settings.service_areas || ["Kothal Kalan", "Mahendragarh", "Main Market"]).map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4AF37] mb-1">
                    Landmark (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Near Temple / School"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F5D061] text-[#16031E] font-bold text-sm hover:brightness-105 active:scale-[0.99] transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#16031E]" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save & Proceed to Checkout</span>
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
