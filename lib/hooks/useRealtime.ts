"use client";

import { useEffect, useState, useRef } from "react";
import { RealtimeEventType, RealtimeEventPayload } from "@/lib/events/broadcast";

interface RealtimeListener {
  id: string;
  events?: RealtimeEventType[];
  callback: (payload: RealtimeEventPayload) => void;
  onConnectionChange?: (connected: boolean) => void;
}

// Global Client-Side SSE Singleton Manager
class RealtimeClientManager {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, RealtimeListener> = new Map();
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private closeGraceTimer: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.disconnectImmediately());
      window.addEventListener("pagehide", () => this.disconnectImmediately());
    }
  }

  public subscribe(listener: RealtimeListener): () => void {
    if (this.closeGraceTimer) {
      clearTimeout(this.closeGraceTimer);
      this.closeGraceTimer = null;
    }

    this.listeners.set(listener.id, listener);
    listener.onConnectionChange?.(this.isConnected);

    if (!this.eventSource && typeof window !== "undefined") {
      this.connect();
    }

    return () => {
      this.listeners.delete(listener.id);
      if (this.listeners.size === 0) {
        // Close after 2.5s grace period if no other component needs it
        this.closeGraceTimer = setTimeout(() => {
          if (this.listeners.size === 0) {
            this.disconnectImmediately();
          }
        }, 2500);
      }
    };
  }

  private connect() {
    if (typeof window === "undefined" || this.eventSource) return;

    try {
      this.eventSource = new EventSource("/api/events");

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.notifyConnectionState(true);
      };

      const eventTypes: RealtimeEventType[] = [
        "order_created",
        "order_status_updated",
        "inventory_updated",
        "settings_updated",
        "offline_sale_created",
        "expense_created",
      ];

      eventTypes.forEach((type) => {
        this.eventSource?.addEventListener(type, (e: MessageEvent) => {
          try {
            const payload = JSON.parse(e.data) as RealtimeEventPayload;
            this.dispatchPayload(payload);
          } catch (err) {
            // Ignore parse errors
          }
        });
      });

      this.eventSource.onmessage = (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data) as RealtimeEventPayload;
          if (payload && payload.type) {
            this.dispatchPayload(payload);
          }
        } catch {
          // Heartbeat ping
        }
      };

      this.eventSource.onerror = () => {
        this.isConnected = false;
        this.notifyConnectionState(false);
        this.disconnectImmediately();

        // Only attempt reconnect if there are still active listeners
        if (this.listeners.size > 0 && !this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.listeners.size > 0) {
              this.connect();
            }
          }, 4000);
        }
      };
    } catch {
      this.isConnected = false;
      this.notifyConnectionState(false);
    }
  }

  private dispatchPayload(payload: RealtimeEventPayload) {
    this.listeners.forEach((listener) => {
      if (!listener.events || listener.events.includes(payload.type)) {
        try {
          listener.callback(payload);
        } catch (err) {
          console.error("Error in realtime listener callback:", err);
        }
      }
    });
  }

  private notifyConnectionState(state: boolean) {
    this.listeners.forEach((listener) => {
      listener.onConnectionChange?.(state);
    });
  }

  public disconnectImmediately() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {
        // Ignore
      }
      this.eventSource = null;
    }
    this.isConnected = false;
  }
}

// Global client singleton
const clientManager = new RealtimeClientManager();

interface UseRealtimeOptions {
  events?: RealtimeEventType[];
  onEvent?: (payload: RealtimeEventPayload) => void;
  enablePollingFallback?: boolean;
  pollingIntervalMs?: number;
}

export function useRealtime({
  events,
  onEvent,
  enablePollingFallback = false,
  pollingIntervalMs = 8000,
}: UseRealtimeOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEventPayload | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const eventsKey = events ? events.slice().sort().join(",") : "all";

  useEffect(() => {
    const id = `listener_${Math.random().toString(36).substring(2, 9)}`;

    const unsubscribe = clientManager.subscribe({
      id,
      events,
      callback: (payload) => {
        setLastEvent(payload);
        if (onEventRef.current) {
          onEventRef.current(payload);
        }
      },
      onConnectionChange: (connected) => {
        setIsConnected(connected);
      },
    });

    let fallbackTimer: NodeJS.Timeout | null = null;
    if (enablePollingFallback) {
      fallbackTimer = setInterval(() => {
        if (onEventRef.current) {
          onEventRef.current({
            type: "order_status_updated",
            data: { isFallbackTick: true },
            timestamp: new Date().toISOString(),
          });
        }
      }, pollingIntervalMs);
    }

    return () => {
      unsubscribe();
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
  }, [eventsKey, enablePollingFallback, pollingIntervalMs]);

  return { isConnected, lastEvent };
}
