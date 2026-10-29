/**
 * Order Notifications Orchestrator for Mithaasé (Shree Shyam Sweets)
 * Coordinates automated Email (Confirmation & Delivery Bill/Invoice)
 * and WhatsApp notifications across order lifecycles.
 */

import { getOrderById, getStoreSettings } from "@/lib/data/store";
import { sendOrderConfirmedEmail, sendOrderDeliveredBillEmail, sendOrderCancelledEmail } from "@/lib/email/mailer";
import {
  notifyOrderConfirmed,
  notifyOrderDelivered,
  notifyOrderCancelled,
  notifyAdminNewOrder,
  aggregateOrderItems,
  resolveCustomerMapUrl,
} from "@/lib/whatsapp/payment-notifications";
import { sql } from "@/lib/neon/db";
import type { Order } from "@/types";

// In-memory set to prevent duplicate notification bursts during the same server lifetime
const sentConfirmationOrders = new Set<string>();
const sentDeliveredOrders = new Set<string>();
const sentCancellationOrders = new Set<string>();

/**
 * Atomic deduplication lock spanning serverless lambdas.
 * Uses PostgreSQL primary key constraint on notification_dispatches table.
 * If another lambda is already dispatching or has dispatched this notification, returns false.
 */
async function claimNotificationLock(
  orderId: string,
  notificationType: "confirmed" | "delivered" | "cancelled"
): Promise<boolean> {
  const memKey = `${orderId}:${notificationType}`;
  if (notificationType === "confirmed" && sentConfirmationOrders.has(memKey)) return false;
  if (notificationType === "delivered" && sentDeliveredOrders.has(memKey)) return false;
  if (notificationType === "cancelled" && sentCancellationOrders.has(memKey)) return false;

  // Mark in-memory set immediately
  if (notificationType === "confirmed") sentConfirmationOrders.add(memKey);
  if (notificationType === "delivered") sentDeliveredOrders.add(memKey);
  if (notificationType === "cancelled") sentCancellationOrders.add(memKey);

  if (sql) {
    try {
      // Lazy table creation (safe, runs once)
      await sql.query(`
        CREATE TABLE IF NOT EXISTS notification_dispatches (
          lock_key TEXT PRIMARY KEY,
          dispatched_at TIMESTAMPTZ DEFAULT NOW()
        );
      `).catch(() => {});

      const lockKey = `${orderId}:${notificationType}`;
      const res = await sql.query(
        `INSERT INTO notification_dispatches (lock_key) VALUES ($1) ON CONFLICT (lock_key) DO NOTHING RETURNING lock_key;`,
        [lockKey]
      ).catch(() => null);

      if (res && Array.isArray(res) && res.length === 0) {
        console.log(`[OrderNotification] Deduplication: ${notificationType} already dispatched for order ${orderId} by another instance.`);
        return false;
      }
    } catch (err) {
      console.warn("[OrderNotification] Lock check warning, falling back to memory:", err);
    }
  }

  return true;
}

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
 * Resolves a real delivery address and locality for the customer, checking the order first, then fallback to database customer_accounts.
 */
async function resolveOrderAddress(order: Order): Promise<{ address: string; locality: string }> {
  let addr = (order.delivery_address || "").replace(/Pending checkout address/gi, "").trim();
  let loc = (order.locality || "").replace(/Pending Locality/gi, "").trim();

  if ((!addr || !loc) && sql && order.customer_phone) {
    try {
      const cleanPhone = order.customer_phone.replace(/[^0-9]/g, "").slice(-10);
      const rows = await sql.query(
        `SELECT delivery_address, locality FROM customer_accounts WHERE (phone = $1 OR phone = $2) AND delivery_address IS NOT NULL AND delivery_address != '' LIMIT 1;`,
        [cleanPhone, `+91${cleanPhone}`]
      );
      if (rows && rows.length > 0) {
        if (!addr && rows[0].delivery_address) {
          addr = rows[0].delivery_address.replace(/Pending checkout address/gi, "").trim();
        }
        if (!loc && rows[0].locality) {
          loc = rows[0].locality.replace(/Pending Locality/gi, "").trim();
        }
        if (addr || loc) {
          order.delivery_address = addr || "Doorstep Delivery";
          order.locality = loc || "Local Area";
          await sql.query(
            `UPDATE orders SET delivery_address = $1, locality = $2 WHERE id = $3;`,
            [order.delivery_address, order.locality, order.id]
          ).catch(() => {});
        }
      }
    } catch {}
  }

  const finalAddr = addr || "Doorstep Delivery";
  const finalLoc = loc || "Local Area";
  order.delivery_address = finalAddr;
  order.locality = finalLoc;
  return { address: finalAddr, locality: finalLoc };
}

/**
 * Sends order confirmation & payment verification notifications via Email and WhatsApp
 */
export async function sendOrderConfirmedNotification(
  orderOrId: string | Order
): Promise<void> {
  try {
    const orderIdentifier =
      typeof orderOrId === "string"
        ? orderOrId
        : (orderOrId.id || orderOrId.order_number || orderOrId.order_ref);

    let order: Order | null = null;

    // 1. Authoritative Backend Match: Fetch fresh, genuine order row directly from database
    if (sql && orderIdentifier) {
      try {
        const rows = await sql.query(
          `SELECT * FROM orders 
           WHERE id = $1 OR order_number = $1 OR order_ref = $1 
           LIMIT 1;`,
          [orderIdentifier]
        );
        if (rows && rows.length > 0) {
          order = rows[0] as Order;
        }
      } catch (dbErr) {
        console.warn("[OrderNotification] DB order lookup notice:", dbErr);
      }
    }

    if (!order) {
      order = typeof orderOrId === "object" ? orderOrId : await getOrderById(orderOrId);
    }

    if (!order) {
      console.warn("[OrderNotification] Order not found for confirmation notification:", orderOrId);
      return;
    }

    // 2. Atomic Deduplication Lock: Guarantee only 1 unique message is dispatched per genuine order
    const acquired = await claimNotificationLock(order.id, "confirmed");
    if (!acquired) {
      return;
    }

    const settings = await getStoreSettings();

    // 3. Load authoritative items directly from database table
    if (sql) {
      try {
        const itemRows = await sql.query(
          `SELECT * FROM order_items WHERE order_id = $1 OR order_id = $2;`,
          [order.id, order.order_number]
        );
        if (itemRows && itemRows.length > 0) {
          order.items = itemRows.map((it: any) => ({
            id: it.id,
            order_id: it.order_id,
            product_id: it.product_id,
            variant_id: it.variant_id,
            product_name_snapshot: it.product_name_snapshot,
            variant_name_snapshot: it.variant_name_snapshot,
            quantity: Number(it.quantity),
            unit_price: Number(it.unit_price),
            line_total: Number(it.line_total),
            image_url: it.image_url,
          }));
        }
      } catch (itemsErr) {
        console.warn("[OrderNotification] order_items fetch notice:", itemsErr);
      }
    }

    // 4. Resolve real address and email for accurate notifications
    await resolveOrderAddress(order);
    const targetEmail = await resolveOrderEmail(order);

    // 5. Aggregate order items: strictly ensure no item is repeated; combine quantities & totals
    const aggregatedItems = aggregateOrderItems(order.items || []);
    const itemsSummary =
      aggregatedItems.length > 0
        ? aggregatedItems
            .map((it) => {
              const variant = it.variantName ? ` (${it.variantName})` : "";
              return `• ${it.quantity}x ${it.productName}${variant} — ₹${it.lineTotal.toFixed(2)}`;
            })
            .join("\n")
        : `• 1x Fresh Festive Sweets Assortment — ₹${Number(order.total_amount).toFixed(2)}`;

    // Pass aggregated items to email to guarantee no duplicate rows in the email invoice table
    if (aggregatedItems.length > 0) {
      order.items = aggregatedItems.map((ai) => ({
        id: `agg-${ai.productId}-${ai.variantId}`,
        order_id: order!.id,
        product_id: ai.productId,
        variant_id: ai.variantId,
        product_name_snapshot: ai.productName,
        variant_name_snapshot: ai.variantName,
        quantity: ai.quantity,
        unit_price: ai.unitPrice,
        line_total: ai.lineTotal,
        image_url: ai.imageUrl,
      }));
    }

    if (targetEmail) {
      order.customer_email = targetEmail;
      sendOrderConfirmedEmail(order, settings).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[OrderNotification] Email confirmation failed for #${order!.order_number}:`, msg);
      });
    }

    const adminHelpline = (settings?.whatsapp_number || settings?.business_phone || "").trim();

    // 6. Send Order Confirmation via WhatsApp to Customer (with Google Maps pin & COD amounts formatted properly)
    if (order.customer_phone) {
      notifyOrderConfirmed({
        phone: order.customer_phone,
        customerName: order.customer_name || "Valued Customer",
        orderNumber: order.order_number,
        orderRef: order.order_ref,
        amount: Number(order.total_amount) || 0,
        subtotal: Number(order.subtotal) || Number(order.total_amount) || 0,
        discountAmount: Number(order.discount_amount) || 0,
        couponCode: order.coupon_code || undefined,
        deliveryFee: Number(order.delivery_charge) || 0,
        paymentMethod: order.payment_method || "UPI",
        paymentStatus: order.payment_status,
        upiReference: order.upi_reference,
        itemsSummary,
        deliveryAddress: order.delivery_address || "",
        locality: order.locality || "",
        mapUrl: order.map_url,
        latitude: order.latitude,
        longitude: order.longitude,
        adminPhone: adminHelpline,
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[OrderNotification] WhatsApp confirmation failed for #${order!.order_number}:`, msg);
      });
    }

    // 7. Send Real-Time Order Details to Admin's WhatsApp (both confirmed and requested orders)
    notifyAdminNewOrder({
      order,
      itemsSummary,
      adminPhone: adminHelpline,
      isBookingRequest: order.booking_status === "requested",
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[OrderNotification] Admin WhatsApp alert failed for #${order!.order_number}:`, msg);
    });
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

    const acquired = await claimNotificationLock(order.id, "delivered");
    if (!acquired) {
      return;
    }

    const settings = await getStoreSettings();

    // 1. Resolve real address and email for accurate delivery bill
    await resolveOrderAddress(order);
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

/**
 * Sends order cancellation notification to customer and admin via Email and WhatsApp
 */
export async function sendOrderCancelledNotification(
  orderOrId: string | Order,
  reason?: string
): Promise<void> {
  try {
    const order = typeof orderOrId === "string" ? await getOrderById(orderOrId) : orderOrId;
    if (!order) {
      console.warn("[OrderNotification] Order not found for cancellation notification:", orderOrId);
      return;
    }

    const acquired = await claimNotificationLock(order.id, "cancelled");
    if (!acquired) {
      return;
    }

    const settings = await getStoreSettings();
    const finalReason = reason || order.cancellation_reason || "Cancelled as per customer or store request";

    // 1. Resolve and Send Order Cancellation Email
    const targetEmail = await resolveOrderEmail(order);
    if (targetEmail) {
      order.customer_email = targetEmail;
      sendOrderCancelledEmail(order, settings, finalReason).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[OrderNotification] Cancellation email failed for #${order.order_number}:`, msg);
      });
    } else {
      console.warn(`[OrderNotification] No valid email address found for order #${order.order_number} to send cancellation.`);
    }

    // 2. Send Order Cancellation WhatsApp Notice (if customer phone is available)
    if (order.customer_phone) {
      const isPaid = order.payment_status === "paid" || (order.payment_method === "upi" && Boolean(order.upi_reference));
      const refundNote = isPaid
        ? `Refund of ₹${Number(order.total_amount).toFixed(2)} has been queued to your original UPI payment method.`
        : undefined;

      notifyOrderCancelled({
        phone: order.customer_phone,
        customerName: order.customer_name || "Valued Customer",
        orderNumber: order.order_number,
        orderRef: order.order_ref,
        amount: Number(order.total_amount) || 0,
        paymentMethod: order.payment_method || "UPI",
        cancellationReason: finalReason,
        refundNote,
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[OrderNotification] WhatsApp cancellation failed for #${order.order_number}:`, msg);
      });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[OrderNotification] sendOrderCancelledNotification error:", msg);
  }
}


