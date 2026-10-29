import crypto from "crypto";

export interface ActivateSessionOptions {
  youpiBaseUrl?: string;
  paymentId: string;
  customerPhone: string;
  customerName?: string;
  customerEmail?: string;
  adminToken?: string;
  merchantKey?: string;
}

export interface ActivationResult {
  success: boolean;
  status: string;
  payeeVpa?: string;
  payeeName?: string;
  upiUri?: string;
  expiresAt?: string | null;
  timeRemainingSeconds?: number;
  error?: string;
}

/**
 * Returns a deterministic, secure customer password derived from phone + store secret.
 * Allows transparent customer authentication against YouPI without exposing credentials.
 */
function getCustomerPassword(phone: string): string {
  const secret = process.env.YOUPI_WEBHOOK_SECRET || process.env.ADMIN_SECRET_KEY || "mithaase_pg_customer_secret_2026";
  return crypto.createHmac("sha256", secret).update(phone).digest("hex").slice(0, 16) + "Aa1!";
}

/**
 * Authoritatively activates a YouPI payment session for a verified customer.
 * 
 * Works across all YouPI PG versions:
 * 1. Binds the customer to the session (/api/v1/checkout/:id/bind-customer),
 *    triggering atomic queue acquisition, status transition to ACTIVE, starting
 *    the 5-minute timer, and broadcasting SSE to the Counter/Admin dashboard.
 * 2. Attempts explicit /activate endpoint (if available in gateway build).
 * 3. Fetches live session state to return configured payeeVpa & upiUri.
 */
export async function activateYoupiSession(options: ActivateSessionOptions): Promise<ActivationResult> {
  const { paymentId, customerPhone, customerName, customerEmail, merchantKey, adminToken } = options;
  const rawBaseUrl = options.youpiBaseUrl || process.env.YOUPI_API_URL || process.env.YOUPI_BASE_URL || "https://youpi-pg-yer7.onrender.com";
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  const cleanPhone = (customerPhone || "").replace(/[^0-9]/g, "").slice(-10);

  if (!paymentId || !cleanPhone || cleanPhone.length < 10) {
    return {
      success: false,
      status: "UNKNOWN",
      error: "Missing paymentId or valid 10-digit phone number",
    };
  }

  // Skip sandbox and local fallback IDs
  if (paymentId.startsWith("yp_sbx_") || paymentId.startsWith("yp_fb_")) {
    return {
      success: true,
      status: "ACTIVE",
    };
  }

  // 1. Forward-compatible explicit activation endpoint
  try {
    const actRes = await fetch(`${baseUrl}/api/v1/payments/${paymentId}/activate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(merchantKey ? { "X-Merchant-Key": merchantKey } : {}),
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      },
      signal: AbortSignal.timeout(4000),
    });
    if (actRes.ok) {
      console.log(`[YouPI Session] Explicit /activate succeeded for ${paymentId}`);
    }
  } catch {}

  // 2. Authoritative customer-binding activation via YouPI Checkout Engine
  const pwd = getCustomerPassword(cleanPhone);
  const resolvedName = (customerName || `Customer ${cleanPhone.slice(-4)}`).trim();
  const resolvedEmail = (customerEmail || `${cleanPhone}@customer.youpi.local`).trim();

  let token: string | null = null;
  let customerId: string | null = null;

  // 2a. Attempt Customer Login
  try {
    const loginRes = await fetch(`${baseUrl}/api/v1/customer/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: cleanPhone, password: pwd }),
      signal: AbortSignal.timeout(5000),
    });
    if (loginRes.ok) {
      const lData = await loginRes.json();
      token = lData.token;
      customerId = lData.customerId || lData.customer?.id;
    }
  } catch {}

  // 2b. If not logged in, attempt Customer Registration
  if (!token) {
    try {
      const regRes = await fetch(`${baseUrl}/api/v1/customer/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: resolvedName,
          mobileNumber: cleanPhone,
          email: resolvedEmail,
          password: pwd,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (regRes.ok) {
        const rData = await regRes.json();
        token = rData.token;
        customerId = rData.customerId || rData.customer?.id;
      }
    } catch {}
  }

  // 2c. Bind Customer to Session -> Instantly activates slot, starts timer & emits SSE
  if (token && customerId) {
    try {
      const bindRes = await fetch(`${baseUrl}/api/v1/checkout/${paymentId}/bind-customer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token, customerId }),
        signal: AbortSignal.timeout(5000),
      });
      if (bindRes.ok) {
        console.log(`[YouPI Session] Customer ${cleanPhone} bound to session ${paymentId} (Status: ACTIVE)`);
      }
    } catch (bindErr) {
      console.warn("[YouPI Session] Customer bind warning:", bindErr);
    }
  }

  // 3. Confirm live session state on YouPI
  try {
    const stateRes = await fetch(`${baseUrl}/api/v1/checkout/${paymentId}/state`, {
      signal: AbortSignal.timeout(5000),
    });
    if (stateRes.ok) {
      const stateData = await stateRes.json();
      const isActive = stateData.status === "ACTIVE" || stateData.status === "QUEUED";
      return {
        success: isActive,
        status: stateData.status,
        payeeVpa: stateData.payeeVpa || stateData.vpa || "",
        payeeName: stateData.payeeName || stateData.merchantName || "",
        upiUri: stateData.upiUri || "",
        expiresAt: stateData.expiresAt || null,
        timeRemainingSeconds: stateData.timeRemainingSeconds || 0,
      };
    }
  } catch (stateErr) {
    console.warn("[YouPI Session] State fetch warning:", stateErr);
  }

  return {
    success: false,
    status: "UNKNOWN",
    error: "Could not confirm session state after activation",
  };
}
