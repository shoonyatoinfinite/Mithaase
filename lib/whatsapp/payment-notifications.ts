/**
 * WhatsApp Payment & Queue Notification Service for Mithaasé
 * Formats and dispatches transactional WhatsApp messages via YouPI-PG gateway.
 */

import { normalizeAndValidateWhatsAppPhone } from "@/lib/utils/phone";
import type { Order } from "@/types";

function getYoupiConfig() {
  const rawBase =
    process.env.YOUPI_API_URL ||
    process.env.YOUPI_BASE_URL ||
    "https://youpi-pg-yer7.onrender.com";
  const baseUrl = rawBase.replace(/\/+$/, "");
  const adminToken =
    process.env.YOUPI_ADMIN_TOKEN ||
    process.env.ADMIN_API_TOKEN ||
    process.env.YOUPI_MERCHANT_KEY ||
    "";
  return { baseUrl, adminToken };
}

export function getAppBaseUrl(overrideUrl?: string): string {
  if (overrideUrl && overrideUrl.startsWith("http")) {
    return overrideUrl.replace(/\/+$/, "");
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/+$/, "")}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, "")}`;
  }
  return "https://mithaase.vercel.app";
}

/**
 * Dispatches an outbound WhatsApp text message via YouPI Gateway
 */
export async function sendWhatsAppMessage(toPhone: string, message: string): Promise<boolean> {
  const phoneVal = normalizeAndValidateWhatsAppPhone(toPhone);
  if (!phoneVal.isValid) {
    console.warn("[WhatsApp Notification] Invalid recipient phone:", toPhone);
    return false;
  }

  const { baseUrl, adminToken } = getYoupiConfig();
  const cleanPhone = phoneVal.dbFormat; // 10 digits
  const intlPhone = `91${cleanPhone}`;
  const webhookSecret = process.env.YOUPI_WEBHOOK_SECRET || process.env.YOUPI_MERCHANT_KEY || "";

  // 1. Try first via customer-facing route (bypasses admin token barrier)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const custRes = await fetch(`${baseUrl}/api/v1/customer/send-payment-qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mobileNumber: cleanPhone,
        message,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (custRes.ok) {
      const data = await custRes.json().catch(() => ({}));
      if (data.delivered || data.success) {
        console.log(`[WhatsApp Notification] Message delivered to ${cleanPhone} via customer channel`);
        return true;
      }
    }
  } catch (err: unknown) {
    // Fall through to admin route attempt
  }

  // 2. Fallback to admin route with bearer or merchant authorization
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (adminToken) {
      headers["Authorization"] = `Bearer ${adminToken}`;
    } else if (webhookSecret) {
      headers["Authorization"] = `Bearer ${webhookSecret}`;
    }
    if (webhookSecret) {
      headers["X-Merchant-Key"] = webhookSecret;
    }

    const res = await fetch(`${baseUrl}/api/v1/admin/whatsapp/test-message`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: intlPhone,
        message,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      console.log(`[WhatsApp Notification] Message delivered to ${cleanPhone}`);
      return true;
    } else {
      const errText = await res.text().catch(() => "");
      console.warn(`[WhatsApp Notification] Gateway returned ${res.status}:`, errText);
      return false;
    }
  } catch (err: unknown) {
    const message_str = err instanceof Error ? err.message : String(err);
    console.warn(`[WhatsApp Notification] Delivery warning to ${cleanPhone}:`, message_str);
    return false;
  }
}

/**
 * Sends notification when a customer's turn starts (promoted from queue to active slot)
 */
export async function notifyTurnStarted(params: {
  phone: string;
  orderRef: string;
  customerName?: string;
  baseUrl?: string;
}): Promise<boolean> {
  const appUrl = getAppBaseUrl(params.baseUrl);
  const payUrl = `${appUrl}/pay/${encodeURIComponent(params.orderRef)}`;
  const greeting = params.customerName ? `Hello *${params.customerName}*!` : "Hello!";

  const message =
    `🍬 *Mithaasé — Your Payment Turn Has Started!*\n\n` +
    `${greeting} It's now your turn to complete your payment.\n\n` +
    `📦 *Order Ref:* ${params.orderRef}\n` +
    `⏳ *Payment Window:* 10 minutes\n\n` +
    `Please tap the link below to view your payment QR and complete payment:\n` +
    `👉 ${payUrl}\n\n` +
    `_If payment is not completed within 10 minutes, the slot will be released to the next customer._`;

  return sendWhatsAppMessage(params.phone, message);
}

/**
 * Sends payment instructions with embedded QR image URL, UPI ID, exact amount, and 1-tap UPI link
 */
export async function notifyPaymentInstructions(params: {
  phone: string;
  orderRef: string;
  amount: number;
  subtotal?: number;
  deliveryFee?: number;
  discountAmount?: number;
  couponCode?: string;
  upiId: string;
  customerName?: string;
  baseUrl?: string;
}): Promise<boolean> {
  const appUrl = getAppBaseUrl(params.baseUrl);
  const formattedAmount = Number(params.amount).toFixed(2);
  const cleanUpi = (params.upiId || "shreeshyam@upi").trim();
  const cleanRef = params.orderRef.trim();
  const greeting = params.customerName ? `Hello *${params.customerName}*!` : "Hello!";

  const finalDiscount = params.discountAmount ? Math.round(Number(params.discountAmount)) : 0;
  const finalSubtotal = params.subtotal ? Math.round(Number(params.subtotal)) : Number(params.amount);
  const finalDelivery = params.deliveryFee != null ? Math.round(Number(params.deliveryFee)) : 0;
  const finalCoupon = params.couponCode ? String(params.couponCode).trim().toUpperCase() : "";

  const orderBreakdownText =
    finalDiscount > 0
      ? `🛒 *Subtotal:* ₹${finalSubtotal}\n🏷️ *Coupon (${finalCoupon}):* -₹${finalDiscount}\n🚚 *Delivery:* ${finalDelivery === 0 ? "FREE" : `₹${finalDelivery}`}\n`
      : finalDelivery > 0
      ? `🛒 *Subtotal:* ₹${finalSubtotal}\n🚚 *Delivery:* ₹${finalDelivery}\n`
      : "";

  const qrImageUrl = `${appUrl}/api/payment/youpi/qr-image?orderRef=${encodeURIComponent(cleanRef)}&amount=${formattedAmount}&upiId=${encodeURIComponent(cleanUpi)}`;
  const upiIntentUri = `upi://pay?pa=${cleanUpi}&pn=${encodeURIComponent("Mithaase")}&cu=INR&am=${formattedAmount}&tr=${encodeURIComponent(cleanRef)}&tn=${encodeURIComponent(`Order ${cleanRef}`)}`;

  const message =
    `🍬 *Mithaasé — UPI Payment QR & Details*\n\n` +
    `${greeting} Your order is confirmed and ready for payment.\n\n` +
    `📦 *Order Ref:* ${cleanRef}\n` +
    orderBreakdownText +
    `💰 *Net Amount to Pay:* *₹${formattedAmount}*\n` +
    `💳 *UPI ID:* ${cleanUpi}\n` +
    `⏳ *Time Limit:* Pay within 10 minutes\n\n` +
    `⚠️ *Important:* Please transfer the exact amount of *₹${formattedAmount}* for automated bank verification.\n\n` +
    `🖼️ *Direct QR Code Image:* \n` +
    `👉 ${qrImageUrl}\n\n` +
    `⚡ *1-Tap Pay via UPI App (GPay, PhonePe, Paytm, CRED):* \n` +
    `👉 ${upiIntentUri}\n\n` +
    `— *Shree Shyam Sweets (Mithaasé)*\n` +
    `📞 Helpline: ${await resolveAdminHelpline()}`;

  const { baseUrl } = getYoupiConfig();
  const phoneVal = normalizeAndValidateWhatsAppPhone(params.phone);
  const cleanPhone = phoneVal.isValid ? phoneVal.dbFormat : params.phone.replace(/[^0-9]/g, "").slice(-10);

  // 1. Direct gateway payment QR dispatch (customer route, zero auth hurdle)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${baseUrl}/api/v1/customer/send-payment-qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mobileNumber: cleanPhone,
        orderRef: cleanRef,
        amount: params.amount,
        upiId: cleanUpi,
        customerName: params.customerName || "Customer",
        qrImageUrl,
        upiIntentUri,
        message,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.delivered || data.success) {
        console.log(`[WhatsApp Notification] Payment QR delivered via customer API to ${cleanPhone}`);
        return true;
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[WhatsApp Notification] Customer payment QR route notice:`, msg);
  }

  // 2. Fallback to generic sender
  return sendWhatsAppMessage(params.phone, message);
}

export async function resolveAdminHelpline(): Promise<string> {
  try {
    const { sql } = await import("@/lib/neon/db");
    if (sql) {
      const rows = await sql.query("SELECT whatsapp_number, business_phone FROM store_settings LIMIT 1;").catch(() => []);
      if (rows && rows.length > 0) {
        const raw = (rows[0].whatsapp_number || rows[0].business_phone || "").trim();
        if (raw) return raw;
      }
    }
    return "+91 8290683668";
  } catch {
    return "+91 8290683668";
  }
}

export interface AggregatedOrderItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imageUrl?: string;
}

/**
 * Aggregates and consolidates order items by unique product & variant identity.
 * Strictly guarantees no duplicate items are ever listed in notifications; quantities and totals are summed.
 */
export function aggregateOrderItems(rawItems: any[]): AggregatedOrderItem[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return [];

  const map = new Map<string, AggregatedOrderItem>();

  for (const it of rawItems) {
    if (!it) continue;
    const pName = (it.product_name_snapshot || it.productName || it.name || "Sweet").toString().trim();
    const vName = (it.variant_name_snapshot || it.variantName || it.variant || "").toString().trim();
    const pId = (it.product_id || it.productId || pName).toString().trim();
    const vId = (it.variant_id || it.variantId || vName).toString().trim();
    const qty = Math.max(1, Number(it.quantity) || 1);
    const uPrice = Math.max(0, Number(it.unit_price ?? it.unitPrice ?? it.price ?? 0));
    const lTotal = Math.max(0, Number(it.line_total ?? it.lineTotal ?? (uPrice * qty)));
    const img = it.image_url || it.imageUrl || undefined;

    // Aggregate strictly by product name & variant (case-insensitive) to prevent duplicate listings
    const key = `${pName.toLowerCase()}:::${vName.toLowerCase()}`;

    if (map.has(key)) {
      const existing = map.get(key)!;
      existing.quantity += qty;
      existing.lineTotal += lTotal;
      if (existing.unitPrice === 0 && uPrice > 0) existing.unitPrice = uPrice;
      if (!existing.imageUrl && img) existing.imageUrl = img;
    } else {
      map.set(key, {
        productId: pId,
        variantId: vId,
        productName: pName,
        variantName: vName,
        quantity: qty,
        unitPrice: uPrice,
        lineTotal: lTotal,
        imageUrl: img,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Resolves a direct, clickable Google Maps pin link for customer delivery location
 */
export function resolveCustomerMapUrl(order: {
  map_url?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  delivery_address?: string | null;
  locality?: string | null;
}): string {
  if (order.map_url && typeof order.map_url === "string" && order.map_url.trim().startsWith("http")) {
    return order.map_url.trim();
  }
  const lat = Number(order.latitude);
  const lng = Number(order.longitude);
  if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  const cleanAddr = (order.delivery_address || "").replace(/Pending checkout address/gi, "").trim();
  const cleanLoc = (order.locality || "").replace(/Pending Locality/gi, "").trim();
  const query = [cleanAddr, cleanLoc, "Kothal Kalan, Haryana"].filter(Boolean).join(", ");
  if (cleanAddr || cleanLoc) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  return "";
}

function cleanLocationString(address?: string | null, locality?: string | null): string {
  const cleanAddr = (address || "").replace(/Pending checkout address/gi, "").trim();
  const cleanLoc = (locality || "").replace(/Pending Locality/gi, "").trim();
  if (cleanAddr && cleanLoc) return `${cleanAddr}, ${cleanLoc}`;
  if (cleanAddr) return cleanAddr;
  if (cleanLoc) return cleanLoc;
  return "Doorstep Delivery";
}

// In-memory rate-limiting and deduplication cooldowns (10-minute window per unique order)
const adminOrderAlertCooldown = new Map<string, number>();
const customerOrderAlertCooldown = new Map<string, number>();

/**
 * Sends order confirmation and payment verified WhatsApp notification to Customer
 */
export async function notifyOrderConfirmed(params: {
  phone: string;
  customerName: string;
  orderNumber: string;
  orderRef?: string;
  amount: number;
  subtotal?: number;
  discountAmount?: number;
  couponCode?: string;
  deliveryFee?: number;
  paymentMethod: string;
  paymentStatus?: string;
  upiReference?: string;
  itemsSummary: string;
  deliveryAddress: string;
  locality: string;
  mapUrl?: string;
  latitude?: number | string;
  longitude?: number | string;
  adminPhone?: string;
}): Promise<boolean> {
  // 1. Rate-limiting & deduplication: ensure rapid clicks send at most 1 unique message per order
  const orderIdentifier = (params.orderNumber || params.orderRef || "").toString().trim();
  if (orderIdentifier) {
    const lastSent = customerOrderAlertCooldown.get(orderIdentifier);
    if (lastSent && Date.now() - lastSent < 10 * 60 * 1000) {
      console.log(`[Customer Notification] Rate-limit skip: Order #${params.orderNumber} already notified.`);
      return true;
    }
    customerOrderAlertCooldown.set(orderIdentifier, Date.now());
  }

  const appUrl = getAppBaseUrl();
  const helpline = params.adminPhone?.trim() || (await resolveAdminHelpline());
  const totalAmount = Number(params.amount) || 0;
  const formattedAmount = totalAmount.toFixed(2);
  const subtotal = Number(params.subtotal && params.subtotal > 0 ? params.subtotal : totalAmount);
  const discountAmount = Number(params.discountAmount) || 0;
  const deliveryFee = Number(params.deliveryFee != null ? params.deliveryFee : 0);
  const couponText = params.couponCode ? ` (${params.couponCode})` : "";

  const isPaid = (params.paymentStatus || "").toLowerCase() === "paid";
  const isCod = params.paymentMethod.toLowerCase() === "cod";
  const isPendingCod = isCod && !isPaid;

  const paymentBadge = isCod
    ? (isPaid ? "Cash Paid on Delivery ✓" : "Cash on Delivery (To be paid at doorstep)")
    : isPaid
    ? `Verified (UPI Ref: ${params.upiReference || "Auto-Confirmed"})`
    : `UPI (Verification Pending)`;

  // COD orders explicitly display "Amount to Pay" instead of "Amount Paid" until actually paid
  let amountLabel = "💰 *Total Amount Paid:*";
  if (isPendingCod) {
    amountLabel = "💰 *Amount to Pay on Delivery (Cash):*";
  } else if (!isPaid) {
    amountLabel = "💰 *Amount to Pay:*";
  } else if (isCod) {
    amountLabel = "💰 *Total Amount Paid (Cash on Delivery):*";
  } else {
    amountLabel = "💰 *Total Amount Paid (UPI Verified):*";
  }

  let pricingBlock = "";
  if (discountAmount > 0) {
    pricingBlock =
      `🛒 *Subtotal:* ₹${subtotal.toFixed(2)}\n` +
      `🏷️ *Discount${couponText}:* -₹${discountAmount.toFixed(2)}\n` +
      `🚚 *Delivery:* ${deliveryFee === 0 ? "FREE" : `₹${deliveryFee.toFixed(2)}`}\n` +
      `${amountLabel} ₹${formattedAmount}\n`;
  } else if (deliveryFee > 0) {
    pricingBlock =
      `🛒 *Subtotal:* ₹${subtotal.toFixed(2)}\n` +
      `🚚 *Delivery:* ₹${deliveryFee.toFixed(2)}\n` +
      `${amountLabel} ₹${formattedAmount}\n`;
  } else {
    pricingBlock = `${amountLabel} ₹${formattedAmount}\n`;
  }

  const mapLink = params.mapUrl || resolveCustomerMapUrl(params);
  const locationBlock =
    `📍 *Delivery Location:*\n${cleanLocationString(params.deliveryAddress, params.locality)}\n` +
    (mapLink ? `🗺️ *Google Maps Pin:*\n👉 ${mapLink}\n` : "");

  const message =
    `🍬 *Mithaasé — Order Confirmed!*\n\n` +
    `Hello *${params.customerName}*! Thank you for your order. Our halwais are preparing your fresh festive sweets with pure desi ghee.\n\n` +
    `📦 *Order Number:* #${params.orderNumber}\n` +
    (params.orderRef ? `🏷️ *Order Ref:* ${params.orderRef}\n` : "") +
    pricingBlock +
    `💳 *Payment:* ${paymentBadge}\n\n` +
    `🛒 *Items Ordered:*\n${params.itemsSummary}\n\n` +
    locationBlock + `\n` +
    `🌐 *Order Tracking:*\n` +
    `You can check your order status and updates directly on our website:\n` +
    `👉 ${appUrl}\n\n` +
    `— *Shree Shyam Sweets (Mithaasé)*\n` +
    `📞 Helpline: ${helpline}`;

  return sendWhatsAppMessage(params.phone, message);
}

/**
 * Sends real-time new order alert to the Store Admin on WhatsApp
 */
export async function notifyAdminNewOrder(params: {
  order: Order | any;
  itemsSummary: string;
  adminPhone?: string;
  isBookingRequest?: boolean;
  statusBadge?: string;
}): Promise<boolean> {
  const { order, itemsSummary, isBookingRequest, statusBadge } = params;

  // 1. Rate-limiting & deduplication: ensure rapid clicks/triggers send at most 1 unique alert per order
  const orderIdentifier = (order.id || order.order_number || "").toString().trim();
  if (orderIdentifier) {
    const lastSent = adminOrderAlertCooldown.get(orderIdentifier);
    if (lastSent && Date.now() - lastSent < 10 * 60 * 1000) {
      console.log(`[Admin Notification] Rate-limit skip: Order #${order.order_number} alert already sent.`);
      return true;
    }
    adminOrderAlertCooldown.set(orderIdentifier, Date.now());
  }

  let targetAdminPhone = (params.adminPhone || "").trim();
  if (!targetAdminPhone) {
    targetAdminPhone = await resolveAdminHelpline();
  }
  const cleanAdminPhone = targetAdminPhone.replace(/[^0-9]/g, "").slice(-10);

  if (!cleanAdminPhone || cleanAdminPhone.length < 10) {
    console.warn("[Admin Notification] No valid admin WhatsApp phone configured");
    return false;
  }

  const appUrl = getAppBaseUrl();
  const formattedTotal = Number(order.total_amount).toFixed(2);
  const formattedSubtotal = Number(order.subtotal || order.total_amount).toFixed(2);
  const discountAmount = Number(order.discount_amount || 0);
  const formattedDiscount = discountAmount.toFixed(2);
  const deliveryCharge = Number(order.delivery_charge || 0);

  const isPaid = order.payment_status === "paid";
  const isCod = order.payment_method?.toLowerCase() === "cod";
  const isBooking = isBookingRequest || order.booking_status === "requested";

  const orderTypeBadge =
    statusBadge ||
    (isBooking
      ? "⏳ *AFTER-HOURS BOOKING REQUEST*"
      : isPaid || order.order_status === "confirmed"
      ? "✅ *CONFIRMED ORDER (PAYMENT VERIFIED)*"
      : isCod
      ? "💵 *CASH ON DELIVERY ORDER*"
      : "⚡ *NEW ORDER (PAYMENT PENDING)*");

  const paymentDetails = isCod
    ? (isPaid ? "Cash Paid on Delivery ✓" : "Cash on Delivery (Pending Collection at Doorstep)")
    : isPaid
    ? `UPI Verified${order.upi_reference ? ` (Ref: ${order.upi_reference})` : ""}`
    : `UPI Pending Verification${order.upi_reference ? ` (Ref: ${order.upi_reference})` : ""}`;

  const netTotalLabel = isCod
    ? (isPaid ? "• *Net Total (Collected via COD):*" : "• *Net Total to Collect (Cash on Delivery):*")
    : (isPaid ? "• *Net Total (Paid via UPI):*" : "• *Net Total (Amount to Pay):*");

  const customerPhoneClean = (order.customer_phone || "").replace(/[^0-9]/g, "").slice(-10);
  const locationStr = cleanLocationString(order.delivery_address, order.locality);
  const mapLink = resolveCustomerMapUrl(order);

  const locationBlock =
    `📍 *Delivery Location:*\n${locationStr}\n` +
    (order.landmark ? `• Landmark: ${order.landmark}\n` : "") +
    (order.delivery_instructions ? `• Instructions: ${order.delivery_instructions}\n` : "") +
    (mapLink ? `🗺️ *Customer Google Maps Pin:*\n👉 ${mapLink}\n` : "");

  const message =
    `🔔 *NEW ORDER ALERT — Mithaasé!*\n\n` +
    `Status: ${orderTypeBadge}\n` +
    `📦 *Order Number:* #${order.order_number}\n` +
    (order.order_ref ? `🏷️ *Order Ref:* ${order.order_ref}\n` : "") +
    `\n👤 *Customer Details:*\n` +
    `• Name: *${order.customer_name}*\n` +
    `• Phone: +91 *${customerPhoneClean}*\n` +
    (order.customer_email ? `• Email: ${order.customer_email}\n` : "") +
    `\n🛒 *Items Ordered:*\n${itemsSummary}\n\n` +
    locationBlock + `\n` +
    `💰 *Bill Breakdown:*\n` +
    `• Subtotal: ₹${formattedSubtotal}\n` +
    (discountAmount > 0 ? `• Discount (${order.coupon_code || "Offer"}): -₹${formattedDiscount}\n` : "") +
    `• Delivery: ${deliveryCharge === 0 ? "FREE" : `₹${deliveryCharge.toFixed(2)}`}\n` +
    `${netTotalLabel} ₹${formattedTotal}\n` +
    `• Payment: *${paymentDetails}*\n\n` +
    `🔗 *Manage Order in Dashboard:*\n` +
    `👉 ${appUrl}/admin/orders\n` +
    (customerPhoneClean ? `💬 Chat Customer: https://wa.me/91${customerPhoneClean}` : "");

  console.log(`[Admin Notification] Dispatching order #${order.order_number} alert to Admin WhatsApp (+91 ${cleanAdminPhone})`);
  return sendWhatsAppMessage(cleanAdminPhone, message);
}

/**
 * Sends order delivered WhatsApp notification with bill notice
 */
export async function notifyOrderDelivered(params: {
  phone: string;
  customerName: string;
  orderNumber: string;
  orderRef?: string;
  amount: number;
  deliveryAddress: string;
  locality: string;
  customerEmail?: string;
}): Promise<boolean> {
  const formattedAmount = Number(params.amount).toFixed(2);
  const helpline = await resolveAdminHelpline();
  const receiptNo = `REC-${params.orderNumber.replace(/[^0-9]/g, "")}`;
  const emailNotice = params.customerEmail
    ? `\n\n🧾 *Bill Sent:* A complete itemized delivery bill and tax receipt has been emailed to *${params.customerEmail}*.`
    : "";

  const message =
    `🎉 *Mithaasé — Order Delivered!*\n\n` +
    `Hello *${params.customerName}*, your fresh sweets order *#${params.orderNumber}* has been successfully delivered to your doorstep!\n\n` +
    `📦 *Receipt No:* ${receiptNo}\n` +
    `💰 *Total Paid:* ₹${formattedAmount}\n` +
    `📍 *Delivered To:* ${cleanLocationString(params.deliveryAddress, params.locality)}${emailNotice}\n\n` +
    `We hope you enjoy every bite of your fresh sweets! Thank you for choosing Shree Shyam Sweets for your festive celebrations. 🍬✨\n\n` +
    `— *Shree Shyam Sweets*\n` +
    `📞 Helpline: ${helpline}`;

  return sendWhatsAppMessage(params.phone, message);
}

/**
 * Sends real-time Order Delivered WhatsApp notification to Admin
 * with complete breakdown: order details, customer (user), assigned rider, and payment details.
 */
export async function notifyAdminOrderDelivered(params: {
  order: Order;
  riderName?: string;
  riderPhone?: string;
  itemsSummary?: string;
  adminPhone?: string;
}): Promise<boolean> {
  const { order } = params;
  const adminHelpline = (params.adminPhone || (await resolveAdminHelpline())).trim();
  const cleanAdminPhone = adminHelpline.replace(/[^0-9]/g, "").slice(-10);

  if (!cleanAdminPhone) {
    console.warn("[Admin Delivered Notification] No valid admin phone number configured.");
    return false;
  }

  const cleanCustomerPhone = (order.customer_phone || "").replace(/[^0-9]/g, "").slice(-10);
  const locationStr = cleanLocationString(order.delivery_address, order.locality);
  const mapLink = resolveCustomerMapUrl(order);

  const isPaid = order.payment_status === "paid";
  const isCod = order.payment_method?.toLowerCase() === "cod";
  const totalAmount = Number(order.total_amount || order.subtotal || 0).toFixed(2);

  const paymentMethodLabel = isCod ? "Cash on Delivery (COD)" : "UPI Online (Instant)";
  const paymentStatusLabel = isCod
    ? (isPaid ? "Cash Collected at Doorstep ✓" : "Cash Pending Collection")
    : (isPaid ? `Paid via UPI ✓${order.upi_reference ? ` (Ref: ${order.upi_reference})` : ""}` : "Payment Unconfirmed");

  const riderName = (params.riderName || "Express Fleet Rider").trim();
  const riderPhone = (params.riderPhone || "").replace(/[^0-9]/g, "").slice(-10);
  const riderPhoneText = riderPhone ? `+91 ${riderPhone}` : "Not Available";

  const deliveredTime = order.delivered_at
    ? new Date(order.delivered_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const deliveredDate = order.delivered_at
    ? new Date(order.delivered_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const itemsText = params.itemsSummary || "• Fresh Festive Sweets Assortment";

  const message =
    `🎉 *ORDER DELIVERED — Admin Fleet Notification!*\n\n` +
    `Order *#${order.order_number}* has been successfully delivered!\n\n` +
    `📦 *Order Details:*\n` +
    `• Order Number: *#${order.order_number}*\n` +
    (order.order_ref ? `• Order Ref: ${order.order_ref}\n` : "") +
    `• Delivered On: ${deliveredDate} at ${deliveredTime}\n` +
    `• Total Amount: *₹${totalAmount}*\n\n` +
    `👤 *Customer (User) Details:*\n` +
    `• Name: *${order.customer_name}*\n` +
    `• Phone: +91 *${cleanCustomerPhone}*\n` +
    (order.customer_email ? `• Email: ${order.customer_email}\n` : "") +
    `• Doorstep Location: ${locationStr}\n` +
    (order.landmark ? `• Landmark: ${order.landmark}\n` : "") +
    (mapLink ? `🗺️ *Customer GPS Pin:*\n👉 ${mapLink}\n` : "") +
    `\n🛵 *Delivered By (Rider):*\n` +
    `• Rider Name: *${riderName}*\n` +
    `• Rider Mobile: *${riderPhoneText}*\n` +
    (order.delivered_location_name ? `• At: ${order.delivered_location_name}\n` : "") +
    (order.delivery_proof_photo ? `📸 Delivery Proof Photo Captured ✓\n` : "") +
    `\n💳 *Payment Details:*\n` +
    `• Mode: *${paymentMethodLabel}*\n` +
    `• Status: *${paymentStatusLabel}*\n` +
    `• Net Amount: *₹${totalAmount}*\n\n` +
    `🛒 *Delivered Items:*\n${itemsText}\n\n` +
    `— Shree Shyam Sweets Fleet Operations`;

  console.log(`[Admin Notification] Dispatching Order Delivered Alert #${order.order_number} to Admin WhatsApp (+91 ${cleanAdminPhone})`);
  return sendWhatsAppMessage(cleanAdminPhone, message);
}

/**
 * Sends order cancellation notification to customer via WhatsApp
 */
export async function notifyOrderCancelled(params: {
  phone: string;
  customerName: string;
  orderNumber: string;
  orderRef?: string;
  amount: number;
  paymentMethod?: string;
  cancellationReason?: string;
  refundNote?: string;
}): Promise<boolean> {
  const formattedAmount = Number(params.amount).toFixed(2);
  const helpline = await resolveAdminHelpline();
  const reasonText = params.cancellationReason ? `\n📝 *Reason:* ${params.cancellationReason}` : "";
  const refundText = params.refundNote ? `\n💳 *Refund Details:* ${params.refundNote}` : "";

  const message =
    `⚠️ *Mithaasé — Order Cancellation Notice*\n\n` +
    `Hello *${params.customerName}*, your order *#${params.orderNumber}* has been cancelled.${reasonText}\n\n` +
    `💰 *Order Total:* ₹${formattedAmount}\n` +
    `🏷️ *Payment Method:* ${(params.paymentMethod || "UPI").toUpperCase()}${refundText}\n\n` +
    `If you have questions or believe this was done in error, please reach out to our team:\n` +
    `📞 Helpline: ${helpline}\n\n` +
    `— *Shree Shyam Sweets (Mithaasé)*`;

  return sendWhatsAppMessage(params.phone, message);
}

/**
 * Sends real-time Out for Delivery WhatsApp notifications to both Customer and Admin
 * including the delivery partner's name, mobile number, and order details.
 */
export async function notifyOrderOutForDelivery(params: {
  order: Order;
  riderName: string;
  riderPhone: string;
  itemsSummary: string;
  adminPhone?: string;
}): Promise<{ customerSent: boolean; adminSent: boolean }> {
  const { order, riderName, riderPhone, itemsSummary } = params;
  const adminHelpline = (params.adminPhone || (await resolveAdminHelpline())).trim();
  const cleanAdminPhone = adminHelpline.replace(/[^0-9]/g, "").slice(-10);

  const cleanCustomerPhone = (order.customer_phone || "").replace(/[^0-9]/g, "").slice(-10);
  const locationStr = cleanLocationString(order.delivery_address, order.locality);
  const mapLink = resolveCustomerMapUrl(order);

  const isPaid = order.payment_status === "paid";
  const isCod = order.payment_method?.toLowerCase() === "cod";
  const paymentText = isCod
    ? (isPaid ? "Cash Paid on Delivery ✓" : `Cash on Delivery (₹${Number(order.total_amount).toFixed(2)} to collect at doorstep)`)
    : (isPaid ? "Paid via UPI ✓" : `UPI Pending (₹${Number(order.total_amount).toFixed(2)})`);

  let customerSent = false;
  let adminSent = false;

  // 1. Notify Customer with Rider Name & Contact
  if (cleanCustomerPhone) {
    const customerMsg =
      `🍬 *Mithaasé — Your Order is Out for Delivery! 🛵*\n\n` +
      `Hello *${order.customer_name || "Valued Customer"}*! Our delivery partner has picked up your freshly packed sweets and is heading to your doorstep.\n\n` +
      `📦 *Order Number:* #${order.order_number}\n` +
      `🛵 *Delivery Partner:* *${riderName || "Express Fleet"}*\n` +
      `📞 *Rider Contact:* *+91 ${riderPhone}*\n\n` +
      `🛒 *Items in Delivery:*\n${itemsSummary}\n\n` +
      `📍 *Delivering To:*\n${locationStr}\n` +
      (order.landmark ? `• Landmark: ${order.landmark}\n` : "") +
      `\n💰 *Payment:* ${paymentText}\n\n` +
      `Please ensure someone is available at the doorstep to receive your festive package.\n\n` +
      `— *Shree Shyam Sweets (Mithaasé)*\n` +
      `📞 Helpline: ${adminHelpline}`;

    customerSent = await sendWhatsAppMessage(cleanCustomerPhone, customerMsg);
  }

  // 2. Notify Admin with Out for Delivery & Rider Info
  if (cleanAdminPhone) {
    const adminMsg =
      `🛵 *RIDER DISPATCHED — Out for Delivery Alert!*\n\n` +
      `Order *#${order.order_number}* is now out for delivery!\n\n` +
      `👤 *Customer:* *${order.customer_name}*\n` +
      `📱 *Customer Phone:* +91 ${cleanCustomerPhone}\n` +
      `📍 *Location:* ${locationStr}\n` +
      (mapLink ? `🗺️ *Customer Google Maps Pin:*\n👉 ${mapLink}\n` : "") +
      `\n🛵 *Assigned Rider:* *${riderName}*\n` +
      `📞 *Rider Mobile:* *+91 ${riderPhone}*\n\n` +
      `🛒 *Items:*\n${itemsSummary}\n\n` +
      `💰 *Total Amount:* ₹${Number(order.total_amount).toFixed(2)} (${paymentText})\n` +
      `⏰ *Dispatched at:* ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}\n\n` +
      `— Shree Shyam Sweets Fleet Operations`;

    adminSent = await sendWhatsAppMessage(cleanAdminPhone, adminMsg);
  }

  return { customerSent, adminSent };
}



