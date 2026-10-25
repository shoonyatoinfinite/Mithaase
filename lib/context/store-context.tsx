"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { StoreSettings } from "@/types";
import { initialSettings } from "@/lib/data/initial-data";

import { useRealtime } from "@/lib/hooks/useRealtime";

interface StoreContextType {
  settings: StoreSettings;
  isStoreClosed: boolean;
  isStoreShutoff: boolean;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);
  const [isLoading, setIsLoading] = useState(true);

  const isStoreShutoff = Boolean(settings.store_shutoff || settings.store_status === "shutoff");
  const isStoreClosed = isStoreShutoff || settings.store_status !== "open" || !settings.accepts_orders;

  const refreshSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {
      // Use fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  // Hook into live settings_updated event
  useRealtime({
    events: ["settings_updated"],
    enablePollingFallback: false,
    onEvent: (payload) => {
      if (payload.data) {
        setSettings(payload.data);
      } else {
        refreshSettings();
      }
    },
  });

  return (
    <StoreContext.Provider value={{ settings, isStoreClosed, isStoreShutoff, isLoading, refreshSettings }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStoreSettings() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStoreSettings must be used within a StoreSettingsProvider");
  }
  return context;
}
