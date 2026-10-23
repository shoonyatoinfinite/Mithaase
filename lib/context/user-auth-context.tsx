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

  // Hydrate local session and check Neon Auth active session
  useEffect(() => {
    async function initAuth() {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setUser(parsed);
        }

        // Check if there is an active session from Neon Auth
        try {
          const session = await authClient.getSession();
          if (session?.data?.user?.email) {
            const googleEmail = session.data.user.email;
            // Fetch saved profile from database
            const res = await fetch(`/api/auth/customer/google-sync?email=${encodeURIComponent(googleEmail)}`);
            if (res.ok) {
              const data = await res.json();
              if (data.exists && data.customer) {
                const updatedUser: CustomerUser = {
                  email: data.customer.email,
                  name: data.customer.name,
                  phone: data.customer.phone,
                  authProvider: "google",
                  savedProfile: {
                    customer_name: data.customer.name,
                    customer_phone: data.customer.phone,
                    delivery_address: data.customer.delivery_address,
                    locality: data.customer.locality,
                    landmark: data.customer.landmark,
                    delivery_instructions: data.customer.delivery_instructions,
                    latitude: data.customer.latitude,
                    longitude: data.customer.longitude,
                    map_url: data.customer.map_url,
                    savedAt: data.customer.updated_at || data.customer.created_at,
                  },
                };
                setUser(updatedUser);
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
              }
            }
          }
        } catch {
          // Neon Auth session check silent fallback
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
        savedProfile: existingProfile,
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
      if (!prev) return prev;
      const updated: CustomerUser = {
        ...prev,
        savedProfile: profile,
      };
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
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
