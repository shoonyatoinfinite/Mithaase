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
  email: string;
  name?: string;
  phone?: string;
  image?: string;
  verifiedAt?: string;
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
  sendOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
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

  // Hydrate local session and sync fresh profile from PostgreSQL
  useEffect(() => {
    async function initAuth() {
      try {
        let activeEmail: string | null = null;
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setUser(parsed);
          if (parsed.email) activeEmail = parsed.email;
        }

        // Check customer session cookie if localStorage is empty (e.g. after browser reopen or update)
        if (!activeEmail && typeof document !== "undefined") {
          const cookieMatch = document.cookie.match(/mithaase_customer_session=([^;]+)/);
          if (cookieMatch && cookieMatch[1]) {
            activeEmail = decodeURIComponent(cookieMatch[1]);
          }
        }

        // Check if there is an active session from Neon Auth / Google
        try {
          const session = await authClient.getSession();
          if (session?.data?.user?.email) {
            activeEmail = session.data.user.email;
          }
        } catch {
          // Neon Auth session check silent fallback
        }

        // Always sync the latest customer delivery profile from the database so it NEVER resets
        if (activeEmail) {
          try {
            const res = await fetch(`/api/auth/customer/profile?email=${encodeURIComponent(activeEmail)}`);
            if (res.ok) {
              const data = await res.json();
              if (data.success && data.user) {
                const refreshedUser: CustomerUser = {
                  email: data.user.email,
                  name: data.user.name,
                  phone: data.user.phone,
                  savedProfile: data.user.savedProfile,
                };
                setUser(refreshedUser);
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(refreshedUser));
              }
            }
          } catch (e) {
            console.warn("Could not sync customer profile from DB:", e);
          }
        }
      } catch {
        // ignore
      } finally {
        setIsHydrated(true);
      }
    }

    initAuth();
  }, []);

  const sendOtp = useCallback(async (email: string) => {
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Failed to send code." };
      }
      return { success: true };
    } catch {
      return { success: false, error: "Network error sending verification code." };
    }
  }, []);

  const verifyOtp = useCallback(async (email: string, otp: string) => {
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Incorrect verification code." };
      }

      let existingProfile: SavedDeliveryProfile | undefined;
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.email === email) {
            existingProfile = parsed.savedProfile;
          }
        }
      } catch {
        // ignore
      }

      const verifiedUser: CustomerUser = {
        ...data.user,
        savedProfile: data.user?.savedProfile || existingProfile,
      };

      setUser(verifiedUser);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(verifiedUser));
      } catch {
        // ignore
      }
      return { success: true };
    } catch {
      return { success: false, error: "Network error verifying code." };
    }
  }, []);

  const loginWithPin = useCallback(async (identifier: string, pin: string) => {
    try {
      const res = await fetch("/api/auth/customer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Login failed." };
      }
      const loggedInUser: CustomerUser = {
        ...data.user,
        authProvider: "pin",
      };
      setUser(loggedInUser);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(loggedInUser));
        sessionStorage.setItem("mithaase_user_email", loggedInUser.email);
      } catch {
        // ignore
      }
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
          sessionStorage.setItem("mithaase_user_email", newUser.email);
        } catch {
          // ignore
        }
        return { success: true };
      } catch {
        return { success: false, error: "Network error during registration." };
      }
    },
    []
  );

  const loginWithGoogle = useCallback(async () => {
    try {
      const callbackURL = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "/auth/callback";
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });

      if (result?.error) {
        return { success: false, error: result.error.message || "Failed to initiate Google sign-in." };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Google sign-in is currently unavailable." };
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
        const json = await res.json();
        if (!res.ok || !json.success) {
          return { success: false, error: json.error || "Failed to save delivery profile." };
        }

        const updatedUser: CustomerUser = {
          ...json.user,
          authProvider: "google",
        };
        setUser(updatedUser);
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
        } catch {
          // ignore
        }
        return { success: true };
      } catch {
        return { success: false, error: "Network error saving Google customer profile." };
      }
    },
    []
  );

  const saveProfile = useCallback((profile: SavedDeliveryProfile) => {
    setUser((prev) => {
      const activeEmail = prev?.email || (typeof window !== "undefined" ? sessionStorage.getItem("mithaase_user_email") || "" : "");
      const updated: CustomerUser = {
        ...(prev || { email: activeEmail }),
        savedProfile: profile,
      };
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }

      // Persist directly to PostgreSQL database
      if (activeEmail || profile.customer_phone) {
        fetch("/api/auth/customer/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: activeEmail,
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
      }

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

      // If user is actively on checkout page, keep them on checkout to allow seamless order completion
      if (pathname === "/checkout") {
        router.refresh();
        return;
      }

      // Always redirect user to the shop section as requested
      router.push("/#shop");
      router.refresh();
    },
    [router, pathname]
  );

  const logout = useCallback(
    async (redirectTo?: string) => {
      try {
        await authClient.signOut();
      } catch {
        // ignore
      }
      setUser(null);
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        sessionStorage.removeItem("mithaase_user_email");
        document.cookie = "mithaase_customer_session=; path=/; max-age=0; SameSite=Lax";
      } catch {
        // ignore
      }

      // Determine clean redirection destination upon logout
      const isPrivateCustomerPage =
        pathname === "/checkout" ||
        pathname === "/orders" ||
        pathname === "/receipts" ||
        pathname.startsWith("/order-confirmation");

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
        isAuthenticated: Boolean(user?.email),
        isHydrated,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
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
