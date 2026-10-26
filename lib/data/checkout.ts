/**
 * Authoritative Server-Side Checkout & Order Creation Engine
 * Fully executed against Neon PostgreSQL inside an ACID transaction.
 * Zero reliance on client-sent prices, totals, or in-memory stores.
 */

import crypto from "crypto";
import { sql, withTransaction } from "@/lib/neon/db";
import { parseItemWeightInKg } from "@/lib/utils/weight";
import { persistMediaAsset } from "@/lib/data/store";
import { broadcastRealtimeEvent } from "@/lib/events/broadcast";
import { serverCache } from "@/lib/cache/server-cache";
import { Order, PaymentMethod, PaymentStatus, OrderStatus } from "@/types";

export interface CheckoutItemInput {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface CreateOrderParams {
  userId: string;
  items: CheckoutItemInput[];
  deliveryAddress?: string;
  locality?: string;
  landmark?: string;
  deliveryInstructions?: string;
  latitude?: number;
  longitude?: number;
  mapUrl?: string;
  couponCode?: string;
  paymentMethod: PaymentMethod;
  upiReference?: string;
  upiScreenshot?: string;
  idempotencyKey?: string;
}

export interface CreateOrderResult {
  success: boolean;
  order?: Order;
  error?: string;
  code?: number;
}

export async function processAuthoritativeCheckout(params: CreateOrderParams): Promise<CreateOrderResult> {
  if (!sql) {
    return { success: false, error: "Database unavailable", code: 503 };
  }

  // 1. Idempotency Check: Prevent duplicate charge/order on double-clicks or retries
  if (params.idempotencyKey) {
    const existing = await sql.query(
      `SELECT id, order_number, total_amount, order_status, payment_status, created_at 
       FROM orders 
       WHERE idempotency_key = $1 LIMIT 1;`,
      [params.idempotencyKey]
    );
    if (existing && existing.length > 0) {
      const ord = existing[0];
      return {
        success: true,
        order: ord as any,
      };
    }
  }

  // 2. Read live store settings from Neon DB
  const settingsRows = await sql.query(
    `SELECT store_status, accepts_orders, minimum_order_value, default_delivery_fee, store_shutoff, shutoff_message, closure_message 
     FROM store_settings 
     WHERE id = 1 LIMIT 1;`
  );

  if (!settingsRows || settingsRows.length === 0) {
    return { success: false, error: "Store configuration not found", code: 500 };
  }

  const settings = settingsRows[0];
  if (settings.store_shutoff || settings.store_status === "shutoff") {
    return {
      success: false,
      error: settings.shutoff_message || "The store is temporarily shut off.",
      code: 403,
    };
  }
  if (!settings.accepts_orders || settings.store_status !== "open") {
    return {
      success: false,
      error: settings.closure_message || "Store is currently closed for online orders.",
      code: 403,
    };
  }

  // 3. Load customer profile from customer_accounts table in Neon DB
  const customerRows = await sql.query(
    `SELECT id, email, phone, name, delivery_address, locality, landmark, delivery_instructions, latitude, longitude, map_url, phone_verified_at 
     FROM customer_accounts 
     WHERE id = $1 LIMIT 1;`,
    [params.userId]
  );

  if (!customerRows || customerRows.length === 0) {
    return { success: false, error: "Customer account not found", code: 404 };
  }

  const customer = customerRows[0];

  // Require WhatsApp verified phone number (honest reachability requirement)
  if (!customer.phone_verified_at && process.env.NODE_ENV === "production") {
    return {
      success: false,
      error: "Please verify your mobile number on WhatsApp before placing an order.",
      code: 403,
    };
  }

  // If customer provided updated delivery address at checkout, update their profile (CANNOT change phone)
  const finalAddress = (params.deliveryAddress || customer.delivery_address || "").trim();
  const finalLocality = (params.locality || customer.locality || "").trim();
  const finalLandmark = (params.landmark || customer.landmark || "").trim();
  const finalInstructions = (params.deliveryInstructions || customer.delivery_instructions || "").trim();
  const finalLat = typeof params.latitude === "number" ? params.latitude : (customer.latitude ? Number(customer.latitude) : 28.1907);
  const finalLng = typeof params.longitude === "number" ? params.longitude : (customer.longitude ? Number(customer.longitude) : 76.1624);
  const finalMapUrl = params.mapUrl || customer.map_url || `https://www.google.com/maps?q=${finalLat},${finalLng}`;

  if (!finalAddress || finalAddress.length < 4) {
    return { success: false, error: "Complete delivery address is required.", code: 400 };
  }
  if (!finalLocality) {
    return { success: false, error: "Locality/Village is required.", code: 400 };
  }

  // Update address on customer profile
  await sql.query(
    `UPDATE customer_accounts SET
       delivery_address = $1,
       locality = $2,
       landmark = $3,
       delivery_instructions = $4,
       latitude = $5,
       longitude = $6,
       map_url = $7,
       updated_at = NOW()
     WHERE id = $8;`,
    [finalAddress, finalLocality, finalLandmark || null, finalInstructions || null, finalLat, finalLng, finalMapUrl, customer.id]
  );

  // 4. Fetch live products and variants from Neon DB (IGNORE client-sent prices/totals completely)
  const variantIds = params.items.map((i) => i.variantId);
  const dbVariants = await sql.query(
    `SELECT 
       pv.id as variant_id, pv.variant_name, pv.price, pv.stock_quantity, pv.is_active as var_active,
       p.id as product_id, p.name as product_name, p.image_url, p.is_active as prod_active,
       p.is_seasonal_special, p.special_start_date, p.special_end_date
     FROM product_variants pv
     JOIN products p ON pv.product_id = p.id
     WHERE pv.id = ANY($1);`,
    [variantIds]
  );

  let subtotal = 0;
  let totalWeightKg = 0;
  const verifiedLines: Array<{
    variantId: string;
    productId: string;
    productName: string;
    variantName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    imageUrl: string;
  }> = [];

  for (const item of params.items) {
    if (!item.quantity || item.quantity <= 0) {
      return { success: false, error: "Invalid item quantity.", code: 400 };
    }

    const row = dbVariants.find((v: any) => v.variant_id === item.variantId);
    if (!row || !row.prod_active || !row.var_active) {
      return {
        success: false,
        error: `One or more selected items are no longer available in the catalogue.`,
        code: 400,
      };
    }

    // Check seasonal special availability
    if (row.is_seasonal_special) {
      const now = new Date();
      if (row.special_start_date && now < new Date(row.special_start_date)) {
        return { success: false, error: `${row.product_name} is not available yet.`, code: 400 };
      }
      if (row.special_end_date && now > new Date(row.special_end_date)) {
        return { success: false, error: `${row.product_name} is no longer available.`, code: 400 };
      }
    }

    if (row.stock_quantity < item.quantity) {
      return {
        success: false,
        error: `Insufficient stock for ${row.product_name} (${row.variant_name}). Only ${row.stock_quantity} available.`,
        code: 400,
      };
    }

    const unitPrice = Number(row.price);
    const lineTotal = unitPrice * item.quantity;
    subtotal += lineTotal;
    totalWeightKg += parseItemWeightInKg(row.variant_name) * item.quantity;

    verifiedLines.push({
      variantId: row.variant_id,
      productId: row.product_id,
      productName: row.product_name,
      variantName: row.variant_name,
      quantity: item.quantity,
      unitPrice,
      lineTotal,
      imageUrl: row.image_url,
    });
  }

  // Enforce 20 kg online weight limit
  if (totalWeightKg > 20) {
    return {
      success: false,
      error: `Order weight (${totalWeightKg.toFixed(1)} kg) exceeds the 20 kg online limit. For bulk orders, please contact shop directly.`,
      code: 400,
    };
  }

  // Enforce minimum order value
  const minOrderVal = Number(settings.minimum_order_value) || 0;
  if (minOrderVal > 0 && subtotal < minOrderVal) {
    return {
      success: false,
      error: `Minimum order amount is ₹${minOrderVal}. Current subtotal is ₹${subtotal}.`,
      code: 400,
    };
  }

  // 5. Coupon validation directly against Neon DB
  let discountAmount = 0;
  let deliveryFee = Number(settings.default_delivery_fee) || 21;

  if (params.couponCode) {
    const cleanCoupon = params.couponCode.trim().toUpperCase();
    const couponRows = await sql.query(
      `SELECT code, discount_type, discount_value, min_order_amount, max_discount_amount, is_active 
       FROM coupons 
       WHERE UPPER(code) = $1 AND is_active = true LIMIT 1;`,
      [cleanCoupon]
    );

    if (couponRows && couponRows.length > 0) {
      const cp = couponRows[0];
      const minAmt = Number(cp.min_order_amount) || 0;
      if (subtotal >= minAmt) {
        if (cp.discount_type === "free_delivery" || cp.code === "FREEDEL") {
          deliveryFee = 0;
        } else if (cp.discount_type === "percentage") {
          const rawDiscount = Math.round((subtotal * Number(cp.discount_value)) / 100);
          discountAmount = cp.max_discount_amount ? Math.min(Number(cp.max_discount_amount), rawDiscount) : rawDiscount;
        } else if (cp.discount_type === "flat_amount") {
          discountAmount = Math.min(subtotal, Number(cp.discount_value));
        }
      }
    }
  }

  const totalAmount = Math.max(0, subtotal - discountAmount + deliveryFee);

  // 6. UPI Reference Validation (anti-replay check)
  let cleanUtr: string | null = null;
  if (params.upiReference) {
    cleanUtr = params.upiReference.trim().toUpperCase();
    // Validate format (12 alphanumeric characters or youpi:... session)
    if (!/^[A-Z0-9]{12}$/.test(cleanUtr) && !cleanUtr.startsWith("YOUPI:")) {
      return {
        success: false,
        error: "Please enter a valid 12-digit UPI Transaction / UTR number.",
        code: 400,
      };
    }
  }

  // Persist screenshot to media_assets if uploaded
  const screenshotUrl = params.upiScreenshot
    ? await persistMediaAsset(params.upiScreenshot, "upi_payment.jpg")
    : null;

  // 7. Execute in ONE ACID Transaction via Neon Pool / WebSocket Driver
  const orderId = crypto.randomUUID();
  const year = new Date().getFullYear();
  const orderNumber = `SSS-${year}-${Date.now().toString().slice(-4)}`;

  // Payment Status: NEVER mark 'paid' automatically from client request!
  const initialPaymentStatus: PaymentStatus =
    params.paymentMethod === "upi" ? "pending_verification" : "unpaid";
  const initialOrderStatus: OrderStatus = "pending_confirmation";

  try {
    const createdOrder = await withTransaction(async (client) => {
      // A. Conditionally deduct stock atomically
      for (const line of verifiedLines) {
        const updateRes = await client.query(
          `UPDATE product_variants 
           SET stock_quantity = stock_quantity - $1, updated_at = NOW() 
           WHERE id = $2 AND stock_quantity >= $1 
           RETURNING stock_quantity;`,
          [line.quantity, line.variantId]
        );

        if (updateRes.rowCount === 0) {
          throw new Error(`Insufficient stock for ${line.productName} (${line.variantName}).`);
        }

        const newStock = updateRes.rows[0].stock_quantity;

        // Record inventory movement ledger inside transaction
        await client.query(
          `INSERT INTO inventory_movements (
             variant_id, product_name, variant_name, movement_type, 
             quantity_change, stock_after, reason, related_order_id, created_by
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
          [
            line.variantId,
            line.productName,
            line.variantName,
            "order_reservation",
            -line.quantity,
            newStock,
            `Online order ${orderNumber} reserved`,
            orderId,
            "System",
          ]
        );
      }

      // B. Insert into orders table
      await client.query(
        `INSERT INTO orders (
           id, order_number, customer_name, customer_email, customer_phone,
           delivery_address, locality, landmark, delivery_instructions,
           subtotal, discount_amount, delivery_charge, total_amount, coupon_code,
           payment_method, payment_status, order_status, upi_reference, upi_screenshot,
           latitude, longitude, map_url, source, idempotency_key, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, NOW(), NOW()
         );`,
        [
          orderId,
          orderNumber,
          customer.name,
          customer.email,
          customer.phone,
          finalAddress,
          finalLocality,
          finalLandmark || null,
          finalInstructions || null,
          subtotal,
          discountAmount,
          deliveryFee,
          totalAmount,
          params.couponCode ? params.couponCode.toUpperCase().trim() : null,
          params.paymentMethod,
          initialPaymentStatus,
          initialOrderStatus,
          cleanUtr,
          screenshotUrl,
          finalLat,
          finalLng,
          finalMapUrl,
          "online",
          params.idempotencyKey || null,
        ]
      );

      // C. Insert order_items (price snapshots)
      for (const line of verifiedLines) {
        await client.query(
          `INSERT INTO order_items (
             id, order_id, product_id, variant_id, product_name_snapshot,
             variant_name_snapshot, quantity, unit_price, line_total, image_url
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
          [
            crypto.randomUUID(),
            orderId,
            line.productId,
            line.variantId,
            line.productName,
            line.variantName,
            line.quantity,
            line.unitPrice,
            line.lineTotal,
            line.imageUrl || null,
          ]
        );
      }

      // D. Insert initial order_status_history
      await client.query(
        `INSERT INTO order_status_history (id, order_id, previous_status, new_status, changed_by, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW());`,
        [
          crypto.randomUUID(),
          orderId,
          "pending_confirmation",
          "pending_confirmation",
          "Customer",
          params.paymentMethod === "upi"
            ? "Order submitted with UPI reference — awaiting verification"
            : "Order submitted with Cash on Delivery",
        ]
      );

      return {
        id: orderId,
        order_number: orderNumber,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        delivery_address: finalAddress,
        locality: finalLocality,
        landmark: finalLandmark,
        delivery_instructions: finalInstructions,
        subtotal,
        discount_amount: discountAmount,
        delivery_charge: deliveryFee,
        total_amount: totalAmount,
        coupon_code: params.couponCode,
        payment_method: params.paymentMethod,
        payment_status: initialPaymentStatus,
        order_status: initialOrderStatus,
        upi_reference: cleanUtr || undefined,
        upi_screenshot: screenshotUrl || undefined,
        items: verifiedLines as any,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    // 8. After commit: Bump database catalog_version and clear cached product queries
    await sql.query(
      `UPDATE store_settings SET catalog_version = COALESCE(catalog_version, 1) + 1, updated_at = NOW() WHERE id = 1;`
    ).catch(() => {});

    serverCache.invalidateTag("products");
    serverCache.invalidateTag("orders");

    broadcastRealtimeEvent("order_created", createdOrder);

    return {
      success: true,
      order: createdOrder as any,
    };
  } catch (txErr: any) {
    if (txErr.code === "23505" && txErr.message?.includes("idx_orders_unique_upi_ref")) {
      return {
        success: false,
        error: "This UPI reference (UTR) has already been used on another order. Please check your transaction receipt.",
        code: 409,
      };
    }
    console.error("[CHECKOUT] Transaction aborted:", txErr);
    return {
      success: false,
      error: txErr.message || "Failed to place order due to inventory or database error.",
      code: 400,
    };
  }
}
