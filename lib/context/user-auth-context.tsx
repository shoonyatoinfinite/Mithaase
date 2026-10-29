"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export interface SavedDeliveryProfile {
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  locality: string;
  landmark?: string;
  delivery_instructions?: string;
  latitude?: number;
  longitude?: number;
  map_url?: string;
  savedAt: string;
}

export interface CustomerUser {
  id?: string;
  email: string;
  name?: string;
  phone?: string;
  image?: string;
  phone_verified_at?: string | null;
  authProvider?: "pin" | "google";
  savedProfile?: SavedDeliveryProfile;
}

interface UserAuthContextType {
  user: CustomerUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  refreshUser: () => Promise<CustomerUser | null>;
  sendOtp: (identifier: string, customerName?: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (identifier: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPin: (identifier: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  signupWithPin: (data: {
    email: string;
    phone: string;
    pin: string;
    password?: string;
    name: string;
    delivery_address: string;
    locality: string;
    landmark?: string;
    delivery_instructions?: string;
    latitude: number;
    longitude: number;
    map_url: string;
  }) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  syncGoogleCustomer: (data: {
    email: string;
    name?: string;
    phone: string;
    delivery_address: string;
    locality: string;
    landmark?: string;
    delivery_instructions?: string;
    latitude?: number;
    longitude?: number;
    map_url?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  saveProfile: (profile: SavedDeliveryProfile) => void;
  logout: (redirectTo?: string) => Promise<void>;
  handlePostLoginRedirect: (targetUrl?: string) => void;
}

const UserAuthContext = createContext<UserAuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "mithaase_customer_auth_v1";

export function UserAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  /**
   * Authoritative Live Profile Sync from Neon Database
   */
  const refreshUser = useCallback(async (): Promise<CustomerUser | null> => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          const liveUser: CustomerUser = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            phone: data.user.phone,
            phone_verified_at: data.user.phone_verified_at,
            savedProfile: data.user.savedProfile,
          };
          setUser(liveUser);
          try {
            // Keep safe user profile locally for display only (NO credentials)
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(liveUser));
          } catch { }
          return liveUser;
        }
      }
      // If unauthorized, clear state
      setUser(null);
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch { }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Hydrate on mount: prioritize live database session over any local cache
  useEffect(() => {
    async function initAuth() {
      try {
        // Fast optimistic visual display while verifying with server
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          try {
            setUser(JSON.parse(stored));
          } catch { }
        }

        // Authoritative verification with Neon DB
        await refreshUser();
      } finally {
        setIsHydrated(true);
      }
    }

    initAuth();
  }, [refreshUser]);

  const sendOtp = useCallback(async (identifier: string, customerName?: string) => {
    try {
      const isEmail = identifier.includes("@");
      const cleanPhone = identifier.replace(/[^0-9]/g, "").slice(-10);
      const payload: any = isEmail
        ? { email: identifier.trim().toLowerCase(), name: customerName }
        : { mobileNumber: cleanPhone, customerName, purpose: "signup" };

      const url = isEmail ? "/api/auth/otp/send" : "/api/payment/youpi/whatsapp-otp/send";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Failed to send verification code." };
      }
      return { success: true };
    } catch {
      return { success: false, error: "Network error sending verification code." };
    }
  }, []);

  const verifyOtp = useCallback(async (identifier: string, otp: string) => {
    try {
      const isEmail = identifier.includes("@");
      const cleanPhone = identifier.replace(/[^0-9]/g, "").slice(-10);
      const payload: any = isEmail
        ? { email: identifier.trim().toLowerCase(), otp: otp.trim() }
        : { mobileNumber: cleanPhone, otp: otp.trim(), purpose: "signup" };

      const url = isEmail ? "/api/auth/otp/verify" : "/api/payment/youpi/whatsapp-otp/verify";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Incorrect verification code." };
      }

      await refreshUser();
      return { success: true };
    } catch {
      return { success: false, error: "Network error verifying code." };
    }
  }, [refreshUser]);

  const loginWithPin = useCallback(async (identifier: string, pin: string) => {
    try {
      const res = await fetch("/api/auth/customer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Invalid credentials." };
      }

      const loggedInUser: CustomerUser = {
        ...data.user,
        authProvider: "pin",
      };
      setUser(loggedInUser);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(loggedInUser));
      } catch { }

      return { success: true };
    } catch {
      return { success: false, error: "Network error during customer login." };
    }
  }, []);

  const signupWithPin = useCallback(
    async (signupData: {
      email: string;
      phone: string;
      pin: string;
      password?: string;
      name: string;
      delivery_address: string;
      locality: string;
      landmark?: string;
      delivery_instructions?: string;
      latitude: number;
      longitude: number;
      map_url: string;
    }) => {
      try {
        const res = await fetch("/api/auth/customer/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(signupData),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return { success: false, error: data.error || "Registration failed." };
        }
        const newUser: CustomerUser = {
          ...data.user,
          authProvider: "pin",
        };
        setUser(newUser);
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
        } catch { }

        return { success: true };
      } catch {
        return { success: false, error: "Network error during registration." };
      }
    },
    []
  );

  const loginWithGoogle = useCallback(async () => {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const callbackURL = `${origin}/auth/callback`;
      const result: any = await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });

      if (result?.error) {
        return { success: false, error: result.error.message || "Google sign-in error." };
      }

      if (result?.data?.url && typeof window !== "undefined") {
        window.location.href = result.data.url;
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || "Google sign-in error." };
    }
  }, []);

  const syncGoogleCustomer = useCallback(
    async (data: {
      email: string;
      name?: string;
      phone: string;
      delivery_address: string;
      locality: string;
      landmark?: string;
      delivery_instructions?: string;
      latitude?: number;
      longitude?: number;
      map_url?: string;
    }) => {
      try {
        const res = await fetch("/api/auth/customer/google-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const resData = await res.json();
        if (!res.ok || !resData.success) {
          return { success: false, error: resData.error || "Could not link account." };
        }
        const syncedUser: CustomerUser = {
          ...resData.user,
          authProvider: "google",
        };
        setUser(syncedUser);
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(syncedUser));
        } catch { }
        return { success: true };
      } catch {
        return { success: false, error: "Network error linking Google account." };
      }
    },
    []
  );

  const saveProfile = useCallback((profile: SavedDeliveryProfile) => {
    setUser((prev) => {
      const updated: CustomerUser = prev
        ? { ...prev, savedProfile: profile }
        : {
          email: "",
          name: profile.customer_name,
          phone: profile.customer_phone,
          savedProfile: profile,
        };

      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      } catch { }

      // Authoritative persist to PostgreSQL database via live PUT /api/auth/customer/profile
      fetch("/api/auth/customer/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: profile.customer_phone,
          name: profile.customer_name,
          delivery_address: profile.delivery_address,
          locality: profile.locality,
          landmark: profile.landmark,
          delivery_instructions: profile.delivery_instructions,
          latitude: profile.latitude,
          longitude: profile.longitude,
          map_url: profile.map_url,
        }),
      }).catch((err) => console.warn("Error auto-persisting profile to DB:", err));

      return updated;
    });
  }, []);

  const handlePostLoginRedirect = useCallback(
    (targetUrl?: string) => {
      if (targetUrl) {
        router.push(targetUrl);
        router.refresh();
        return;
      }

      if (pathname === "/checkout") {
        router.refresh();
        return;
      }

      router.push("/#shop");
      router.refresh();
    },
    [router, pathname]
  );

  const logout = useCallback(
    async (redirectTo?: string) => {
      try {
        await fetch("/api/auth/customer/logout", { method: "POST" });
        await authClient.signOut();
      } catch { }

      setUser(null);
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem("mithaase_user");
        sessionStorage.removeItem("mithaase_user_email");
      } catch { }

      const isPrivateCustomerPage =
        pathname === "/checkout" ||
        pathname === "/orders" ||
        pathname === "/receipts" ||
        pathname.startsWith("/order-confirmation") ||
        pathname.startsWith("/track");

      const cleanRedirect = typeof redirectTo === "string" ? redirectTo : undefined;
      const dest = cleanRedirect ?? (isPrivateCustomerPage ? "/#shop" : pathname);
      router.push(dest);
      router.refresh();
    },
    [router, pathname]
  );

  return (
    <UserAuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user?.email || user?.id),
        isHydrated,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        refreshUser,
        sendOtp,
        verifyOtp,
        loginWithPin,
        signupWithPin,
        loginWithGoogle,
        syncGoogleCustomer,
        saveProfile,
        logout,
        handlePostLoginRedirect,
      }}
    >
      {children}
    </UserAuthContext.Provider>
  );
}

export function useUserAuth() {
  const context = useContext(UserAuthContext);
  if (!context) {
    throw new Error("useUserAuth must be used within a UserAuthProvider");
  }
  return context;
}
