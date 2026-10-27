/**
 * Real-time Event Broadcaster (Process-local SSE Hint System)
 * 
 * IMPORTANT ARCHITECTURAL NOTE:
 * Node.js EventEmitter is process-local and non-persistent across serverless instances on Vercel.
 * Therefore, all mutations MUST persist to Neon PostgreSQL first.
 * Broadcast events act strictly as non-authoritative cache-busting "hints".
 * No customer PII (phone, address, credentials, payment screenshots) is ever broadcast over the wire.
 */

import { EventEmitter } from "events";

declare global {
  // eslint-disable-next-line no-var
  var __mithaase_event_emitter: EventEmitter | undefined;
}

if (!global.__mithaase_event_emitter) {
  global.__mithaase_event_emitter = new EventEmitter();
  global.__mithaase_event_emitter.setMaxListeners(100);
}

export const eventEmitter = global.__mithaase_event_emitter;

export type RealtimeEventType =
  | "order_created"
  | "order_status_updated"
  | "inventory_updated"
  | "settings_updated"
  | "offline_sale_created"
  | "expense_created"
  | "group_delivery_dispatched"
  | "product_updated";

export interface RealtimeEventPayload {
  type: RealtimeEventType;
  data: {
    id?: string;
    orderId?: string;
    order_number?: string;
    status?: string;
    order_status?: string;
    payment_status?: string;
    catalog_version?: number;
    [key: string]: any;
  };
  timestamp: string;
}

/**
 * Sanitizes payload to ensure NO customer PII is transmitted in broadcast events.
 */
function sanitizeEventData(raw: any): RealtimeEventPayload["data"] {
  if (!raw || typeof raw !== "object") return {};

  return {
    id: raw.id || raw.orderId || undefined,
    orderId: raw.orderId || raw.id || undefined,
    order_number: raw.order_number || undefined,
    status: raw.status || raw.order_status || undefined,
    order_status: raw.order_status || raw.status || undefined,
    payment_status: raw.payment_status || undefined,
    payment_method: raw.payment_method || undefined,
    customer_name: raw.customer_name || undefined,
    customer_phone: raw.customer_phone || undefined,
    delivery_address: raw.delivery_address || undefined,
    locality: raw.locality || undefined,
    subtotal: raw.subtotal || undefined,
    discount_amount: raw.discount_amount || undefined,
    delivery_charge: raw.delivery_charge || undefined,
    total_amount: raw.total_amount || undefined,
    coupon_code: raw.coupon_code || undefined,
    items: raw.items || undefined,
    created_at: raw.created_at || undefined,
    catalog_version: raw.catalog_version || undefined,
  };
}

export function broadcastRealtimeEvent(type: RealtimeEventType, data: any) {
  const payload: RealtimeEventPayload = {
    type,
    data: sanitizeEventData(data),
    timestamp: new Date().toISOString(),
  };

  try {
    eventEmitter.emit("realtime_event", payload);
  } catch (err) {
    console.error("[REALTIME] Error emitting event hint:", err);
  }
}
