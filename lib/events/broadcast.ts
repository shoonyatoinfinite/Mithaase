// Real-time Event Broadcaster using Node EventEmitter / Global Registry
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
  | "group_delivery_dispatched";

export interface RealtimeEventPayload {
  type: RealtimeEventType;
  data: any;
  timestamp: string;
}

export function broadcastRealtimeEvent(type: RealtimeEventType, data: any) {
  const payload: RealtimeEventPayload = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  try {
    eventEmitter.emit("realtime_event", payload);
  } catch (err) {
    console.error("Error emitting realtime event:", err);
  }
}
