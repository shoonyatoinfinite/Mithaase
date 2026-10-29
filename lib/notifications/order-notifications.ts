/**
 * Order Notifications Orchestrator for Mithaasé (Shree Shyam Sweets)
 * Coordinates automated Email (Confirmation & Delivery Bill/Invoice)
 * and WhatsApp notifications across order lifecycles.
 */

import { getOrderById, getStoreSettings } from "@/lib/data/store";
import { sendOrderConfirmedEmail, sendOrderDeliveredBillEmail } from "@/lib/email/mailer";
import { notifyOrderConfirmed, notifyOrderDelivered } from "@/lib/whatsapp/payment-notifications";
import { sql } from "@/lib/neon/db";
import type { Order } from "@/types";

// In-memory set to prevent duplicate notification bursts during the same server lifetime
const sentConfirmationOrders = new Set<string>();
const sentDeliveredOrders = new Set<string>();

/**
 * Resolves a valid email for the customer, checking the order first, then fallback to database profile.
 */
async function resolveOrderEmail(order: Order): Promise<string | null> {
  if (order.customer_email && order.customer_email.includes("@")) {
    return order.customer_email.trim();
  }

  if (sql && order.customer_phone) {
    try {
      const cleanPhone = order.customer_phone.replace(/[^0-9]/g, "").slice(-10);
      const rows = await sql.query(
        `SELECT email FROM customer_accounts WHERE phone = $1 AND email IS NOT NULL AND email != '' LIMIT 1;`,
        [cleanPhone]
      );
      if (rows && rows.length > 0 && rows[0]?.email?.includes("@")) {
        const foundEmail = rows[0].email.trim();
        order.customer_email = foundEmail;
        await sql.query(`UPDATE orders SET customer_email = $1 WHERE id = $2;`, [foundEmail, order.id]).catch(() => {});
        return foundEmail;
      }
    } catch {}
  }

  return null;
}

/**
 * Sends order confirmation & payment verification notifications via Email and WhatsApp
 */
export async function sendOrderConfirmedNotification(
  orderOrId: string | Order
): Promise<void> {
  try {
    const order = typeof orderOrId === "string" ? await getOrderById(orderOrId) : orderOrId;
    if (!order) {
      console.warn("[OrderNotification] Order not found for confirmation notification:", orderOrId);
      return;
    }

    const orderKey = `${order.id}-${order.order_number}`;
    if (sentConfirmationOrders.has(orderKey)) {
      console.log(`[OrderNotification] Confirmation already dispatched for #${order.order_number}`);
      return;
    }
    sentConfirmationOrders.add(orderKey);

    const settings = await getStoreSettings();

    // 1. Resolve and Send Order Confirmation Email
    const targetEmail = await resolveOrderEmail(order);
    if (targetEmail) {
      order.customer_email = targetEmail;
      sendOrderConfirmedEmail(order, settings).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[OrderNotification] Email confirmation failed for #${order.order_number}:`, msg);
      });
    } else {
      console.warn(`[OrderNotification] No valid email address found for order #${order.order_number} to send confirmation.`);
    }

    // 2. Send Order Confirmation & Payment Details via WhatsApp (if customer phone is available)
    if (order.customer_phone) {
      const itemsSummary = (order.items || [])
        .map(
          (it) =>
            `• ${it.quantity}x ${it.product_name_snapshot}${it.variant_name_snapshot ? ` (${it.variant_name_snapshot})` : ""} — ₹${Number(it.line_total).toFixed(2)}`
        )
        .join("\n") || "• Fresh Festive Sweets Assortment";

      notifyOrderConfirmed({
        phone: order.customer_phone,
        customerName: order.customer_name || "Valued Customer",
        orderNumber: order.order_number,
        orderRef: order.order_ref,
        amount: Number(order.total_amount) || 0,
        paymentMethod: order.payment_method || "UPI",
        upiReference: order.upi_reference,
        itemsSummary,
        deliveryAddress: order.delivery_address || "",
        locality: order.locality || "",
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[OrderNotification] WhatsApp confirmation failed for #${order.order_number}:`, msg);
      });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[OrderNotification] sendOrderConfirmedNotification error:", msg);
  }
}

/**
 * Sends order delivery completion notification and Official Tax/Delivery Bill via Email and WhatsApp
 */
export async function sendOrderDeliveredNotification(
  orderOrId: string | Order
): Promise<void> {
  try {
    const order = typeof orderOrId === "string" ? await getOrderById(orderOrId) : orderOrId;
    if (!order) {
      console.warn("[OrderNotification] Order not found for delivery notification:", orderOrId);
      return;
    }

    const orderKey = `${order.id}-${order.order_number}`;
    if (sentDeliveredOrders.has(orderKey)) {
      console.log(`[OrderNotification] Delivery bill already dispatched for #${order.order_number}`);
      return;
    }
    sentDeliveredOrders.add(orderKey);

    const settings = await getStoreSettings();

    // 1. Resolve and Send Official Delivery Bill & Tax Invoice Email
    const targetEmail = await resolveOrderEmail(order);
    if (targetEmail) {
      order.customer_email = targetEmail;
      sendOrderDeliveredBillEmail(order, settings).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[OrderNotification] Delivery bill email failed for #${order.order_number}:`, msg);
      });
    }

    // 2. Send Delivery Completion WhatsApp Message
    if (order.customer_phone) {
      notifyOrderDelivered({
        phone: order.customer_phone,
        customerName: order.customer_name || "Valued Customer",
        orderNumber: order.order_number,
        orderRef: order.order_ref,
        amount: Number(order.total_amount) || 0,
        deliveryAddress: order.delivery_address || "",
        locality: order.locality || "",
        customerEmail: order.customer_email,
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[OrderNotification] WhatsApp delivery notification failed for #${order.order_number}:`, msg);
      });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[OrderNotification] sendOrderDeliveredNotification error:", msg);
  }
}

