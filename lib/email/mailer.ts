import nodemailer, { type Transporter } from "nodemailer";
import type { Order, StoreSettings } from "@/types";

let cachedTransporter: Transporter | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const host = process.env.SMTP_HOST || "smtp-relay.brevo.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (user && pass) {
    // In Vercel serverless functions, pooled persistent connections hang after lambda freeze.
    // Use individual per-invocation connection with fast timeouts.
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    return cachedTransporter;
  }

  return null;
}

function getAppBaseUrl(): string {
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

function cleanDisplayAddress(address?: string | null, locality?: string | null): string {
  const cleanAddr = (address || "").replace(/Pending checkout address/gi, "").trim();
  const cleanLoc = (locality || "").replace(/Pending Locality/gi, "").trim();
  if (cleanAddr && cleanLoc) return `${cleanAddr}, ${cleanLoc}`;
  if (cleanAddr) return cleanAddr;
  if (cleanLoc) return cleanLoc;
  return "Doorstep Delivery";
}

/**
 * Authoritative Unified Email Dispatcher
 * Dispatches via Resend API if configured, falls back to SMTP, and logs in development.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const { to, subject, html, text } = params;

  // 1. Try Resend API if RESEND_API_KEY is configured
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Shree Shyam Sweets <onboarding@resend.dev>",
          to: [to],
          subject,
          html,
          text: text || subject,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`[EMAIL SERVICE] Email delivered to ${to} via Resend. ID: ${data.id}`);
        return { success: true, messageId: data.id };
      }
      console.warn("[EMAIL SERVICE] Resend returned error:", data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[EMAIL SERVICE] Resend fetch failed:", msg);
    }
  }

  // 2. Try SMTP Transporter (e.g. Gmail App Password, Brevo, SendGrid, Amazon SES)
  const transporter = getTransporter();
  const fromAddress =
    process.env.SMTP_FROM || `Shree Shyam Sweets <${process.env.SMTP_USER || "no-reply@mithaase.in"}>`;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text: text || subject,
        html,
      });

      console.log(`[EMAIL SERVICE] Email delivered to ${to} via SMTP. Message ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[EMAIL SERVICE] SMTP delivery failed for ${to}:`, msg);
    }
  }

  // 3. Fallback: Fast logging to console without blocking external network calls
  console.log(`\n======================================================`);
  console.log(`[EMAIL DISPATCHED TO]: ${to}`);
  console.log(`[SUBJECT]: ${subject}`);
  console.log(`======================================================\n`);
  return { success: true };
}

// -----------------------------------------------------------------------------
// OTP & Security Verification Emails
// -----------------------------------------------------------------------------

export async function sendOtpEmail(
  toEmail: string,
  otp: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendEmail({
    to: toEmail,
    subject: `Your Mithaasé Verification Code: ${otp}`,
    text: `Your Mithaasé verification code is: ${otp}. It expires in 10 minutes.`,
    html: getOtpEmailHtml(otp),
  });
}

function getOtpEmailHtml(otp: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Mithaasé Verification Code</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #16031E; margin: 0; padding: 20px; color: #FFF8EE; }
        .card { max-width: 500px; margin: 0 auto; background: #20052B; border: 2px solid #D4AF37; border-radius: 20px; padding: 32px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.7); }
        .badge { display: inline-block; background: #580E1E; border: 1px solid #D4AF37; color: #F5D061; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; padding: 6px 14px; border-radius: 50px; margin-bottom: 16px; }
        h1 { color: #FFF8EE; font-size: 24px; margin: 0 0 12px 0; font-family: Georgia, serif; }
        p { color: #D3BEB0; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; }
        .otp-container { background: #16031E; border: 1px dashed #D4AF37; border-radius: 14px; padding: 18px; margin: 24px 0; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; color: #F5D061; letter-spacing: 8px; margin: 0; }
        .footer { font-size: 12px; color: #8F7B70; margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">Shree Shyam Sweets • Mithaasé</div>
        <h1>Your Security Verification Code</h1>
        <p>You requested a one-time verification code for your Mithaasé customer account.</p>
        
        <div class="otp-container">
          <div class="otp-code">${otp}</div>
        </div>

        <p style="font-size: 13px; color: #F5D061;">
          ⏳ This code expires in <strong>10 minutes</strong>. Never share this code with anyone.
        </p>

        <div class="footer">
          If you did not request this code, you can safely ignore this email.<br>
          Shree Shyam Sweets, Main Bazar, Kothal Kalan / Mahendragarh
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendPinResetEmail(
  toEmail: string,
  customerName: string,
  newPin: string
): Promise<{ success: boolean; error?: string }> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Your New Mithaasé Security PIN</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #16031E; margin: 0; padding: 20px; color: #FFF8EE; }
        .card { max-width: 500px; margin: 0 auto; background: #20052B; border: 2px solid #D4AF37; border-radius: 20px; padding: 32px; text-align: center; }
        .badge { display: inline-block; background: #580E1E; border: 1px solid #D4AF37; color: #F5D061; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 6px 14px; border-radius: 50px; margin-bottom: 16px; }
        h1 { color: #FFF8EE; font-size: 24px; margin: 0 0 12px 0; font-family: Georgia, serif; }
        p { color: #D3BEB0; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; }
        .pin-box { background: #16031E; border: 2px solid #10b981; border-radius: 14px; padding: 18px; margin: 24px 0; }
        .pin-val { font-family: 'Courier New', monospace; font-size: 40px; font-weight: 900; color: #34d399; letter-spacing: 8px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">Security Notification</div>
        <h1>Your New Security PIN</h1>
        <p>Hello ${customerName || "Valued Customer"}, your account PIN has been reset as requested after identity verification.</p>
        <div class="pin-box">
          <div class="pin-val">${newPin}</div>
        </div>
        <p style="color: #F5D061; font-size: 13px;">
          Use this 6-digit PIN to log into your account. For your security, you can change your PIN anytime from your account profile settings.
        </p>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: toEmail,
    subject: `Your New Mithaasé Security PIN: ${newPin}`,
    text: `Hello ${customerName}, your new 6-digit security PIN is: ${newPin}. You can now log into your account.`,
    html,
  });
}

// -----------------------------------------------------------------------------
// Order Confirmation Email (Payment Verified)
// -----------------------------------------------------------------------------

export async function sendOrderConfirmedEmail(
  order: Order,
  settings?: StoreSettings
): Promise<{ success: boolean; error?: string }> {
  if (!order.customer_email || !order.customer_email.includes("@")) {
    return { success: false, error: "No customer email found on order" };
  }

  const appUrl = getAppBaseUrl();
  const storeName = settings?.store_name || "Shree Shyam Sweets";
  const helpline = settings?.whatsapp_number || settings?.business_phone || "+91 8290683668";
  const shopAddress = settings?.shop_address || "Shop No. 12, Main Chowk, Kothal Kalan, Mahendragarh, Haryana 123029";

  const orderDate = new Date(order.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const paymentBadge =
    order.payment_method === "cod"
      ? "Cash on Delivery"
      : `Paid via UPI (Ref: ${order.upi_reference || "Auto-Confirmed"})`;

  let itemsToRender = order.items || [];
  if (itemsToRender.length === 0 && order.id) {
    try {
      const { sql: dbSql } = await import("@/lib/neon/db");
      if (dbSql) {
        const dbItems = await dbSql.query(
          `SELECT * FROM order_items WHERE order_id = $1 OR order_id = $2;`,
          [order.id, order.order_number]
        );
        if (dbItems && dbItems.length > 0) {
          itemsToRender = dbItems.map((it: any) => ({
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
      }
    } catch {}
  }

  const itemsHtml =
    itemsToRender.length > 0
      ? itemsToRender
          .map(
            (item) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(212, 175, 55, 0.2); color: #FFF8EE; font-size: 13px;">
          <strong style="color: #F5D061;">${item.product_name_snapshot}</strong>
          ${item.variant_name_snapshot ? `<br><span style="font-size: 11px; color: #D3BEB0;">${item.variant_name_snapshot}</span>` : ""}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(212, 175, 55, 0.2); color: #FFF8EE; font-size: 13px; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(212, 175, 55, 0.2); color: #FFF8EE; font-size: 13px; text-align: right;">
          ₹${Number(item.unit_price).toFixed(2)}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(212, 175, 55, 0.2); color: #F5D061; font-weight: bold; font-size: 13px; text-align: right;">
          ₹${Number(item.line_total).toFixed(2)}
        </td>
      </tr>
    `
          )
          .join("")
      : `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(212, 175, 55, 0.2); color: #FFF8EE; font-size: 13px;">
          <strong style="color: #F5D061;">Fresh Handcrafted Sweets Assortment</strong>
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(212, 175, 55, 0.2); color: #FFF8EE; font-size: 13px; text-align: center;">
          1
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(212, 175, 55, 0.2); color: #FFF8EE; font-size: 13px; text-align: right;">
          ₹${Number(order.subtotal || order.total_amount).toFixed(2)}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(212, 175, 55, 0.2); color: #F5D061; font-weight: bold; font-size: 13px; text-align: right;">
          ₹${Number(order.subtotal || order.total_amount).toFixed(2)}
        </td>
      </tr>
    `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmed — ${storeName}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0E0114; margin: 0; padding: 20px; color: #FFF8EE; }
        .wrapper { max-width: 600px; margin: 0 auto; background: #1C0324; border: 2px solid #D4AF37; border-radius: 24px; overflow: hidden; box-shadow: 0 15px 50px rgba(0,0,0,0.8); }
        .header { background: linear-gradient(135deg, #3B0820 0%, #1D0823 100%); padding: 28px 24px; text-align: center; border-bottom: 2px solid #D4AF37; }
        .brand { font-family: Georgia, serif; font-size: 26px; font-weight: 900; color: #FFF8EE; letter-spacing: 1px; margin: 0; }
        .tagline { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #F5D061; font-weight: 700; margin-top: 4px; }
        .content { padding: 28px 24px; }
        .status-badge { display: inline-block; background: rgba(16, 185, 129, 0.15); border: 1px solid #10B981; color: #34D399; font-size: 12px; font-weight: 800; text-transform: uppercase; padding: 6px 16px; border-radius: 50px; margin-bottom: 16px; }
        .meta-box { background: #14011B; border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 16px; padding: 18px; margin: 20px 0; }
        .meta-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
        .meta-label { color: #A89587; }
        .meta-value { color: #FFF8EE; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { text-align: left; padding: 10px 12px; background: rgba(255, 255, 255, 0.05); color: #F5D061; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
        .total-box { background: #250530; border-radius: 14px; padding: 16px; margin: 20px 0; border: 1px solid rgba(212, 175, 55, 0.4); }
        .btn-track { display: block; text-align: center; background: linear-gradient(135deg, #F5D061 0%, #D4AF37 100%); color: #16031E; text-decoration: none; font-weight: 900; font-size: 14px; padding: 14px 24px; border-radius: 50px; margin: 24px 0 12px 0; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.4); }
        .footer { font-size: 11px; color: #8F7B70; text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding: 20px 24px; background: #120118; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="brand">Mithaasé</div>
          <div class="tagline">${storeName} • Pure Desi Ghee</div>
        </div>

        <div class="content">
          <div style="text-align: center;">
            <div class="status-badge">Payment Verified &amp; Order Confirmed ✓</div>
            <h1 style="color: #FFF8EE; font-size: 22px; margin: 0 0 8px 0; font-family: Georgia, serif;">
              Thank You for Your Order, ${order.customer_name}!
            </h1>
            <p style="color: #D3BEB0; font-size: 13px; line-height: 1.5; margin: 0;">
              Your payment has been successfully verified. Our halwais are freshly preparing your handcrafted sweets.
            </p>
          </div>

          <!-- Order Summary Details -->
          <div class="meta-box">
            <table style="width: 100%; border: none; margin: 0;">
              <tr>
                <td style="color: #A89587; font-size: 12px; padding: 4px 0;">Order Number:</td>
                <td style="color: #F5D061; font-weight: bold; font-size: 13px; font-family: monospace; text-align: right; padding: 4px 0;">#${order.order_number}</td>
              </tr>
              <tr>
                <td style="color: #A89587; font-size: 12px; padding: 4px 0;">Order Date:</td>
                <td style="color: #FFF8EE; font-size: 12px; text-align: right; padding: 4px 0;">${orderDate}</td>
              </tr>
              <tr>
                <td style="color: #A89587; font-size: 12px; padding: 4px 0;">Payment Status:</td>
                <td style="color: #34D399; font-weight: bold; font-size: 12px; text-align: right; padding: 4px 0;">${paymentBadge}</td>
              </tr>
              <tr>
                <td style="color: #A89587; font-size: 12px; padding: 4px 0;">Delivery To:</td>
                <td style="color: #FFF8EE; font-size: 12px; text-align: right; padding: 4px 0;">${order.customer_name} (+91 ${order.customer_phone})</td>
              </tr>
              <tr>
                <td style="color: #A89587; font-size: 12px; padding: 4px 0;">Address:</td>
                <td style="color: #FFF8EE; font-size: 12px; text-align: right; padding: 4px 0;">${cleanDisplayAddress(order.delivery_address, order.locality)}</td>
              </tr>
            </table>
          </div>

          <!-- Items Table -->
          <h3 style="color: #F5D061; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 8px 0;">
            Items Ordered
          </h3>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- Pricing Breakdown -->
          <div class="total-box">
            <table style="width: 100%; border: none; margin: 0;">
              <tr>
                <td style="color: #A89587; font-size: 12px; padding: 4px 0;">Subtotal:</td>
                <td style="color: #FFF8EE; font-size: 12px; text-align: right; padding: 4px 0;">₹${Number(order.subtotal).toFixed(2)}</td>
              </tr>
              ${
                order.discount_amount > 0
                  ? `<tr>
                      <td style="color: #34D399; font-size: 12px; padding: 4px 0;">Discount (${order.coupon_code || "Promo"}):</td>
                      <td style="color: #34D399; font-size: 12px; text-align: right; padding: 4px 0;">-₹${Number(order.discount_amount).toFixed(2)}</td>
                    </tr>`
                  : ""
              }
              <tr>
                <td style="color: #A89587; font-size: 12px; padding: 4px 0;">Delivery Fee:</td>
                <td style="color: #FFF8EE; font-size: 12px; text-align: right; padding: 4px 0;">
                  ${order.delivery_charge > 0 ? `₹${Number(order.delivery_charge).toFixed(2)}` : `<span style="color: #34D399;">FREE</span>`}
                </td>
              </tr>
              <tr>
                <td style="color: #F5D061; font-size: 16px; font-weight: 900; padding: 8px 0 0 0; border-top: 1px solid rgba(255,255,255,0.1);">Total Amount Paid:</td>
                <td style="color: #F5D061; font-size: 18px; font-weight: 900; text-align: right; padding: 8px 0 0 0; border-top: 1px solid rgba(255,255,255,0.1);">₹${Number(order.total_amount).toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <!-- Check Status on Website CTA -->
          <div style="text-align: center; margin: 24px 0 12px 0;">
            <p style="color: #D3BEB0; font-size: 13px; margin: 0 0 12px 0;">
              You can check your order status, preparation updates, and delivery anytime directly on our website.
            </p>
            <a href="${appUrl}" class="btn-track" style="margin: 0; display: block;">
              Visit Website &amp; Check Order Status &rarr;
            </a>
          </div>
        </div>

        <div class="footer">
          <strong>${storeName}</strong><br>
          ${shopAddress}<br>
          Helpline &amp; Support: ${helpline}
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: order.customer_email,
    subject: `🍬 Order Confirmed! Shree Shyam Sweets — Order #${order.order_number}`,
    text: `Hello ${order.customer_name}, your order #${order.order_number} has been confirmed! Subtotal: ₹${Number(order.subtotal || order.total_amount).toFixed(2)}${order.discount_amount > 0 ? `, Discount (${order.coupon_code || "Offer"}): -₹${Number(order.discount_amount).toFixed(2)}` : ""}, Total Amount Paid: ₹${Number(order.total_amount).toFixed(2)}. Check your order status directly on our website: ${appUrl}`,
    html,
  });
}

// -----------------------------------------------------------------------------
// Official Delivery Receipt & Tax Invoice Email
// -----------------------------------------------------------------------------

export async function sendOrderDeliveredBillEmail(
  order: Order,
  settings?: StoreSettings
): Promise<{ success: boolean; error?: string }> {
  if (!order.customer_email || !order.customer_email.includes("@")) {
    return { success: false, error: "No customer email found on order" };
  }

  const storeName = settings?.store_name || "Shree Shyam Sweets";
  const helpline = settings?.whatsapp_number || settings?.business_phone || "+91 8290683668";
  const shopAddress = settings?.shop_address || "Shop No. 12, Main Chowk, Kothal Kalan, Mahendragarh, Haryana 123029";
  const receiptNumber = `REC-${order.order_number.replace(/[^0-9]/g, "") || order.id.slice(-6)}`;

  const orderDate = new Date(order.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const deliveredDate = new Date(order.delivered_at || new Date()).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemsHtml = (order.items || [])
    .map(
      (item, idx) => `
      <tr style="border-bottom: 1px solid #E5E0D5;">
        <td style="padding: 10px 8px; font-size: 12px; color: #1D0823; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px 8px; font-size: 12px; color: #1D0823;">
          <strong>${item.product_name_snapshot}</strong>
          ${item.variant_name_snapshot ? `<br><span style="font-size: 11px; color: #6B5E55;">${item.variant_name_snapshot}</span>` : ""}
        </td>
        <td style="padding: 10px 8px; font-size: 12px; color: #1D0823; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px 8px; font-size: 12px; color: #1D0823; text-align: right;">₹${Number(item.unit_price).toFixed(2)}</td>
        <td style="padding: 10px 8px; font-size: 12px; color: #3B0820; font-weight: bold; text-align: right;">₹${Number(item.line_total).toFixed(2)}</td>
      </tr>
    `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Delivery Bill &amp; Tax Receipt — ${storeName}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F3EFE6; margin: 0; padding: 20px; color: #1D0823; }
        .invoice-card { max-width: 600px; margin: 0 auto; background: #FAF6EE; border: 2px solid #D4AF37; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.15); }
        .accent-bar { height: 6px; background: linear-gradient(90deg, #D4AF37 0%, #F5D061 50%, #D4AF37 100%); }
        .invoice-header { padding: 24px; border-bottom: 2px solid #1D0823; }
        .store-title { font-family: Georgia, serif; font-size: 24px; font-weight: 900; color: #3B0820; margin: 0; }
        .store-sub { font-size: 11px; font-weight: 800; color: #B45309; text-transform: uppercase; letter-spacing: 1.5px; }
        .meta-strip { padding: 18px 24px; background: #F1ECE0; border-bottom: 1px solid #E5E0D5; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #3B0820; color: #F5D061; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 10px 8px; }
        .summary-box { padding: 20px 24px; background: #FAF6EE; }
        .footer { background: #3B0820; color: #FAF6EE; padding: 18px 24px; text-align: center; font-size: 11px; }
      </style>
    </head>
    <body>
      <div class="invoice-card">
        <div class="accent-bar"></div>

        <div class="invoice-header">
          <table style="width: 100%; border: none;">
            <tr>
              <td>
                <div class="store-title">${storeName}</div>
                <div class="store-sub">Mithaasé • Traditional Halwai Workshop</div>
                <p style="font-size: 11px; color: #4A1525; margin: 4px 0 0 0; line-height: 1.4;">
                  ${shopAddress}<br>
                  Helpline: ${helpline}
                </p>
              </td>
              <td style="text-align: right; vertical-align: top;">
                <span style="display: inline-block; background: #3B0820; color: #F5D061; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 4px 10px; border-radius: 50px;">
                  Delivery Bill &amp; Receipt
                </span>
                <div style="font-size: 12px; font-weight: bold; margin-top: 6px;">${receiptNumber}</div>
                <div style="font-size: 11px; color: #6B5E55;">Order Ref: #${order.order_number}</div>
              </td>
            </tr>
          </table>
        </div>

        <div class="meta-strip">
          <table style="width: 100%; border: none;">
            <tr>
              <td style="width: 50%; vertical-align: top;">
                <span style="font-size: 10px; text-transform: uppercase; font-weight: bold; color: #8F7B70; display: block;">Customer Details:</span>
                <strong style="font-size: 13px; color: #1D0823;">${order.customer_name}</strong><br>
                <span style="font-size: 11px; color: #4A1525;">+91 ${order.customer_phone}</span><br>
                <span style="font-size: 11px; color: #4A1525;">${order.customer_email || ""}</span>
              </td>
              <td style="width: 50%; vertical-align: top; text-align: right;">
                <span style="font-size: 10px; text-transform: uppercase; font-weight: bold; color: #8F7B70; display: block;">Delivery Details:</span>
                <strong style="font-size: 12px; color: #10B981;">Delivered to Doorstep ✓</strong><br>
                <span style="font-size: 11px; color: #4A1525;">${deliveredDate}</span><br>
                <span style="font-size: 11px; color: #6B5E55;">${cleanDisplayAddress(order.delivery_address, order.locality)}</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Bill Table -->
        <table style="margin-top: 10px;">
          <thead>
            <tr>
              <th style="width: 8%; text-align: center;">#</th>
              <th style="width: 48%; text-align: left;">Item Description</th>
              <th style="width: 12%; text-align: center;">Qty</th>
              <th style="width: 16%; text-align: right;">Rate</th>
              <th style="width: 16%; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <!-- Summary Calculation -->
        <div class="summary-box">
          <table style="width: 100%; max-width: 280px; margin-left: auto; border: none;">
            <tr>
              <td style="font-size: 12px; color: #6B5E55; padding: 4px 0;">Item Subtotal:</td>
              <td style="font-size: 12px; font-weight: bold; color: #1D0823; text-align: right; padding: 4px 0;">₹${Number(order.subtotal).toFixed(2)}</td>
            </tr>
            ${
              order.discount_amount > 0
                ? `<tr>
                    <td style="font-size: 12px; color: #10B981; padding: 4px 0;">Discount (${order.coupon_code || "Promo"}):</td>
                    <td style="font-size: 12px; font-weight: bold; color: #10B981; text-align: right; padding: 4px 0;">-₹${Number(order.discount_amount).toFixed(2)}</td>
                  </tr>`
                : ""
            }
            <tr>
              <td style="font-size: 12px; color: #6B5E55; padding: 4px 0;">Delivery Charges:</td>
              <td style="font-size: 12px; font-weight: bold; color: #1D0823; text-align: right; padding: 4px 0;">
                ${order.delivery_charge > 0 ? `₹${Number(order.delivery_charge).toFixed(2)}` : `<span style="color: #10B981;">FREE</span>`}
              </td>
            </tr>
            <tr style="border-top: 2px solid #D4AF37;">
              <td style="font-size: 14px; font-weight: 900; color: #3B0820; padding: 8px 0;">Grand Total:</td>
              <td style="font-size: 16px; font-weight: 900; color: #3B0820; text-align: right; padding: 8px 0;">₹${Number(order.total_amount).toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="2" style="font-size: 11px; color: #10B981; font-weight: bold; text-align: right; padding-top: 2px;">
                PAID via ${order.payment_method.toUpperCase()} ${order.upi_reference ? `(Ref: ${order.upi_reference})` : ""}
              </td>
            </tr>
          </table>
        </div>

        <div class="footer">
          <p style="margin: 0 0 4px 0; font-weight: bold; color: #F5D061;">
            Thank you for celebrating with Shree Shyam Sweets!
          </p>
          <p style="margin: 0; font-size: 10px; color: #D3BEB0;">
            This is an official computer-generated receipt for your records. For any queries, call our helpline at ${helpline}.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: order.customer_email,
    subject: `🧾 Official Delivery Receipt & Tax Invoice — Shree Shyam Sweets (Order #${order.order_number})`,
    text: `Hello ${order.customer_name}, your order #${order.order_number} has been delivered! Official Receipt No: ${receiptNumber}. Grand Total Paid: ₹${Number(order.total_amount).toFixed(2)}. Thank you for choosing Shree Shyam Sweets!`,
    html,
  });
}

// -----------------------------------------------------------------------------
// Order Cancellation Email
// -----------------------------------------------------------------------------

export async function sendOrderCancelledEmail(
  order: Order,
  settings?: StoreSettings,
  cancellationReason?: string
): Promise<{ success: boolean; error?: string }> {
  if (!order.customer_email || !order.customer_email.includes("@")) {
    return { success: false, error: "No customer email found on order" };
  }

  const appUrl = getAppBaseUrl();
  const storeName = settings?.store_name || "Shree Shyam Sweets";
  const helpline = settings?.whatsapp_number || settings?.business_phone || "+91 8290683668";
  const shopAddress = settings?.shop_address || "Shop No. 12, Main Chowk, Kothal Kalan, Mahendragarh, Haryana 123029";
  const reason = cancellationReason || order.cancellation_reason || "Cancelled as per customer or store request";

  const orderDate = new Date(order.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const isPaid = order.payment_status === "paid" || (order.payment_method === "upi" && Boolean(order.upi_reference));
  const refundNote = isPaid
    ? `A full refund of ₹${Number(order.total_amount).toFixed(2)} has been queued/initiated to your original payment account. For UPI payments, refunds typically reflect within 24–48 business hours.`
    : `Since this was a Cash on Delivery / Unpaid order, no payment deduction was made.`;

  const itemsHtml = (order.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(225, 29, 72, 0.2); color: #FFF8EE; font-size: 13px;">
          <strong style="color: #FCA5A5;">${item.product_name_snapshot}</strong>
          ${item.variant_name_snapshot ? `<br><span style="font-size: 11px; color: #D3BEB0;">${item.variant_name_snapshot}</span>` : ""}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(225, 29, 72, 0.2); color: #FFF8EE; font-size: 13px; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(225, 29, 72, 0.2); color: #FFF8EE; font-size: 13px; text-align: right;">
          ₹${Number(item.unit_price).toFixed(2)}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(225, 29, 72, 0.2); color: #FCA5A5; font-weight: bold; font-size: 13px; text-align: right;">
          ₹${Number(item.line_total).toFixed(2)}
        </td>
      </tr>
    `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Cancelled — ${storeName}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0E0114; margin: 0; padding: 20px; color: #FFF8EE; }
        .wrapper { max-width: 600px; margin: 0 auto; background: #1C0324; border: 2px solid #E11D48; border-radius: 24px; overflow: hidden; box-shadow: 0 15px 50px rgba(0,0,0,0.8); }
        .header { background: linear-gradient(135deg, #4C0519 0%, #1D0823 100%); padding: 28px 24px; text-align: center; border-bottom: 2px solid #E11D48; }
        .brand { font-family: Georgia, serif; font-size: 26px; font-weight: 900; color: #FFF8EE; letter-spacing: 1px; margin: 0; }
        .tagline { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #FDA4AF; font-weight: 700; margin-top: 4px; }
        .content { padding: 28px 24px; }
        .status-badge { display: inline-block; background: rgba(225, 29, 72, 0.2); border: 1px solid #E11D48; color: #FDA4AF; font-size: 12px; font-weight: 800; text-transform: uppercase; padding: 6px 16px; border-radius: 50px; margin-bottom: 16px; }
        .reason-box { background: rgba(225, 29, 72, 0.1); border: 1px solid rgba(225, 29, 72, 0.4); border-radius: 16px; padding: 18px; margin: 20px 0; }
        .meta-box { background: #14011B; border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 16px; padding: 18px; margin: 20px 0; }
        .meta-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
        .meta-label { color: #A89587; }
        .meta-value { color: #FFF8EE; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { text-align: left; padding: 10px 12px; background: rgba(255, 255, 255, 0.05); color: #FDA4AF; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
        .total-box { background: #250530; border-radius: 14px; padding: 16px; margin: 20px 0; border: 1px solid rgba(225, 29, 72, 0.4); }
        .btn-browse { display: block; text-align: center; background: linear-gradient(135deg, #F5D061 0%, #D4AF37 100%); color: #16031E; text-decoration: none; font-weight: 900; font-size: 14px; padding: 14px 24px; border-radius: 50px; margin: 24px 0 12px 0; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.4); }
        .footer { font-size: 11px; color: #8F7B70; text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding: 20px 24px; background: #120118; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="brand">Mithaasé</div>
          <div class="tagline">${storeName} • Pure Desi Ghee</div>
        </div>

        <div class="content">
          <div style="text-align: center;">
            <div class="status-badge">Order Cancelled</div>
            <h1 style="color: #FFF8EE; font-size: 22px; margin: 0 0 8px 0; font-family: Georgia, serif;">
              Order #${order.order_number} Cancelled
            </h1>
            <p style="color: #D3BEB0; font-size: 13px; line-height: 1.5; margin: 0;">
              Hello ${order.customer_name}, your order has been cancelled.
            </p>
          </div>

          <div class="reason-box">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #FCA5A5; font-weight: bold; display: block; margin-bottom: 4px;">
              Reason for Cancellation:
            </span>
            <div style="font-size: 13px; color: #FFF8EE; font-weight: 600; line-height: 1.4;">
              ${reason}
            </div>
            <div style="font-size: 12px; color: #FDA4AF; margin-top: 10px; line-height: 1.4;">
              ${refundNote}
            </div>
          </div>

          <div class="meta-box">
            <div class="meta-row">
              <span class="meta-label">Order Number:</span>
              <span class="meta-value">#${order.order_number}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Placed On:</span>
              <span class="meta-value">${orderDate}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Payment Method:</span>
              <span class="meta-value">${order.payment_method.toUpperCase()}${order.upi_reference ? ` (${order.upi_reference})` : ""}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Delivery Address:</span>
              <span class="meta-value">${cleanDisplayAddress(order.delivery_address, order.locality)}</span>
            </div>
          </div>

          ${
            order.items && order.items.length > 0
              ? `<table>
                  <thead>
                    <tr>
                      <th>Cancelled Item</th>
                      <th style="text-align: center;">Qty</th>
                      <th style="text-align: right;">Price</th>
                      <th style="text-align: right;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>`
              : ""
          }

          <div class="total-box">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; color: #D3BEB0;">
              <span>Subtotal:</span>
              <span>₹${Number(order.subtotal).toFixed(2)}</span>
            </div>
            ${
              order.discount_amount > 0
                ? `<div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; color: #10B981;">
                    <span>Discount:</span>
                    <span>-₹${Number(order.discount_amount).toFixed(2)}</span>
                  </div>`
                : ""
            }
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; color: #D3BEB0;">
              <span>Delivery Fee:</span>
              <span>₹${Number(order.delivery_charge).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; color: #FCA5A5; border-top: 1px solid rgba(225,29,72,0.3); padding-top: 8px;">
              <span>Total Cancelled Amount:</span>
              <span>₹${Number(order.total_amount).toFixed(2)}</span>
            </div>
          </div>

          <a href="${appUrl}" class="btn-browse">Browse Store &amp; Reorder Sweets</a>

          <div style="text-align: center; margin-top: 16px;">
            <p style="font-size: 12px; color: #D3BEB0; margin: 0;">
              Have questions or need assistance? Call our direct helpline at <strong style="color: #F5D061;">${helpline}</strong>.
            </p>
          </div>
        </div>

        <div class="footer">
          <p style="margin: 0 0 6px 0; font-weight: bold; color: #D3BEB0;">
            ${storeName} • Authentic Indian Sweets
          </p>
          <p style="margin: 0; font-size: 10px;">
            ${shopAddress} | Helpline: ${helpline}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Also dispatch a copy to admin if configured
  const adminEmail = process.env.ADMIN_EMAIL || settings?.admin_email;
  if (adminEmail && adminEmail.includes("@") && adminEmail.toLowerCase() !== order.customer_email.toLowerCase()) {
    sendEmail({
      to: adminEmail,
      subject: `[Admin Alert] Order #${order.order_number} Cancelled (₹${Number(order.total_amount).toFixed(2)})`,
      text: `Order #${order.order_number} for customer ${order.customer_name} (+91 ${order.customer_phone}) has been cancelled. Reason: ${reason}. Total amount: ₹${Number(order.total_amount).toFixed(2)}.`,
      html,
    }).catch(() => {});
  }

  return sendEmail({
    to: order.customer_email,
    subject: `⚠️ Order #${order.order_number} Cancelled — ${storeName}`,
    text: `Hello ${order.customer_name}, your order #${order.order_number} has been cancelled. Reason: ${reason}. ${refundNote} For questions, please call our helpline at ${helpline}.`,
    html,
  });
}

