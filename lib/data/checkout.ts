/**
 * Authoritative Server-Side Checkout & Order Creation Engine
 * Fully executed against Neon PostgreSQL inside an ACID transaction.
 * Zero reliance on client-sent prices, totals, or in-memory stores.
 */

import crypto from "crypto";
import { sql, withTransaction } from "@/lib/neon/db";
import { parseItemWeightInKg } from "@/lib/utils/weight";
import { persistMediaAsset, getOrderById, validateAndCalculateCoupon } from "@/lib/data/store";
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
  isBookingRequest?: boolean;
  customerPhone?: string;
  customerName?: string;
}

export interface CreateOrderResult {
  success: boolean;
  order?: Order;
  error?: string;
  code?: number;
  storeClosed?: boolean;
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
  const isStoreClosed = !settings.accepts_orders || settings.store_status !== "open";
  if (isStoreClosed && !params.isBookingRequest) {
    return {
      success: false,
      error: settings.closure_message || "Store is currently closed for instant orders. Please submit an After-Hours Booking Request instead.",
      code: 403,
      storeClosed: true,
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

  const rawPhone = params.customerPhone || customer.phone || "";
  const cleanPhone = rawPhone.replace(/[^0-9]/g, "").slice(-10);
  if (!cleanPhone || cleanPhone.length < 10) {
    return {
      success: false,
      error: "A valid 10-digit mobile number is required to place your order.",
      code: 400,
    };
  }

  const finalPhone = cleanPhone;
  const nowVerifiedAt = customer.phone_verified_at || new Date().toISOString();

  // If customer provided updated delivery address at checkout, update their profile
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

  // Update address and phone on customer profile
  await sql.query(
    `UPDATE customer_accounts SET
       phone = COALESCE(phone, $1),
       phone_verified_at = COALESCE(phone_verified_at, $2::timestamptz),
       delivery_address = $3,
       locality = $4,
       landmark = $5,
       delivery_instructions = $6,
       latitude = $7,
       longitude = $8,
       map_url = $9,
       updated_at = NOW()
     WHERE id = $10;`,
    [finalPhone, nowVerifiedAt, finalAddress, finalLocality, finalLandmark || null, finalInstructions || null, finalLat, finalLng, finalMapUrl, customer.id]
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

    // 1. Authoritative calculation via store engine
    try {
      const couponResult = await validateAndCalculateCoupon(
        cleanCoupon,
        subtotal,
        deliveryFee,
        customer.email,
        finalPhone
      );

      if (couponResult.valid) {
        discountAmount = couponResult.discountAmount;
        deliveryFee = couponResult.finalDeliveryCharge;
      }
    } catch {
      // Fallback to direct query below
    }

    // 2. Direct Neon SQL query fallback
    if (discountAmount === 0 && deliveryFee > 0) {
      const couponRows = await sql.query(
        `SELECT code, discount_type, discount_value, min_order_amount, max_discount_amount, free_delivery, is_active 
         FROM coupons 
         WHERE UPPER(code) = $1 AND is_active = true LIMIT 1;`,
        [cleanCoupon]
      );

      if (couponRows && couponRows.length > 0) {
        const cp = couponRows[0];
        const minAmt = Number(cp.min_order_amount) || 0;
        if (subtotal >= minAmt) {
          const isFreeDel = Boolean(
            cp.free_delivery || cp.discount_type === "free_delivery" || cp.code === "FREEDEL"
          );
          if (isFreeDel) {
            deliveryFee = 0;
          }

          if (cp.discount_type === "percentage" && Number(cp.discount_value) > 0) {
            const rawDiscount = (subtotal * Number(cp.discount_value)) / 100;
            const roundedDiscount = Number(rawDiscount.toFixed(2));
            discountAmount = cp.max_discount_amount
              ? Math.min(Number(cp.max_discount_amount), roundedDiscount)
              : roundedDiscount;
          } else if (cp.discount_type === "flat_amount" && Number(cp.discount_value) > 0) {
            discountAmount = Math.min(subtotal, Number(cp.discount_value));
          }
        }
      }
    }
  }

  const totalAmount = Number(Math.max(0, subtotal - discountAmount + deliveryFee).toFixed(2));

  // 6. UPI Reference Validation (anti-replay check)
  // Strictly only validate or assign cleanUtr if paymentMethod is 'upi' and NOT a booking request
  let cleanUtr: string | null = null;
  if (!params.isBookingRequest && params.paymentMethod === "upi") {
    if (!params.upiReference || !params.upiReference.trim()) {
      return {
        success: false,
        error: "Please enter your UPI Reference / UTR Number from your payment app.",
        code: 400,
      };
    }
    const rawRef = params.upiReference.trim();
    if (rawRef.toUpperCase().startsWith("YOUPI:")) {
      cleanUtr = rawRef.toUpperCase();
    } else {
      // Strip any whitespace, hyphens, colons, or "UTR:" prefix
      const sanitized = rawRef.replace(/^UTR[:\s-]*/i, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (sanitized.length < 6 || sanitized.length > 30) {
        return {
          success: false,
          error: "Please enter a valid 12-digit UPI Transaction / UTR number from your payment app.",
          code: 400,
        };
      }
      cleanUtr = sanitized;
    }
  }

  // Persist screenshot to media_assets ONLY if paymentMethod is upi and NOT a booking request
  const screenshotUrl =
    !params.isBookingRequest && params.paymentMethod === "upi" && params.upiScreenshot
      ? await persistMediaAsset(params.upiScreenshot, "upi_payment.jpg")
      : null;

  // 7. Execute in ONE ACID Transaction via Neon Pool / WebSocket Driver
  const orderId = crypto.randomUUID();
  const year = new Date().getFullYear();
  const orderNumber = `SSS-${year}-${Date.now().toString().slice(-4)}`;

  const finalPaymentMethod: PaymentMethod = params.isBookingRequest ? "cod" : params.paymentMethod;
  const initialBookingStatus = params.isBookingRequest ? "requested" : "standard";

  // Payment Status: NEVER mark 'paid' automatically from client request!
  const initialPaymentStatus: PaymentStatus =
    params.isBookingRequest
      ? "unpaid"
      : finalPaymentMethod === "upi"
        ? "pending_verification"
        : "unpaid";
  const initialOrderStatus: OrderStatus = "pending_confirmation";

  try {
    const createdOrder = await withTransaction(async (client) => {
      // A. Conditionally deduct stock atomically
      const inventoryLogs: Array<{
        variantId: string;
        productName: string;
        variantName: string;
        quantity: number;
        stockAfter: number;
      }> = [];

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
        inventoryLogs.push({
          variantId: line.variantId,
          productName: line.productName,
          variantName: line.variantName,
          quantity: line.quantity,
          stockAfter: newStock,
        });
      }

      // B. Insert into orders table
      await client.query(
        `INSERT INTO orders (
           id, order_number, customer_name, customer_email, customer_phone,
           delivery_address, locality, landmark, delivery_instructions,
           subtotal, discount_amount, delivery_charge, total_amount, coupon_code,
           payment_method, payment_status, order_status, upi_reference, upi_screenshot,
           latitude, longitude, map_url, source, idempotency_key, booking_status, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW(), NOW()
         );`,
        [
          orderId,
          orderNumber,
          customer.name || params.customerName || "Customer",
          customer.email,
          finalPhone,
          finalAddress,
          finalLocality,
          finalLandmark || null,
          finalInstructions || null,
          subtotal,
          discountAmount,
          deliveryFee,
          totalAmount,
          params.couponCode ? params.couponCode.toUpperCase().trim() : null,
          finalPaymentMethod,
          initialPaymentStatus,
          initialOrderStatus,
          cleanUtr,
          screenshotUrl,
          finalLat,
          finalLng,
          finalMapUrl,
          "online",
          params.idempotencyKey || null,
          initialBookingStatus,
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

      // D. Record inventory movement ledger inside transaction (orders row now exists)
      for (const log of inventoryLogs) {
        await client.query(
          `INSERT INTO inventory_movements (
             variant_id, product_name, variant_name, movement_type, 
             quantity_change, stock_after, reason, related_order_id, created_by
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
          [
            log.variantId,
            log.productName,
            log.variantName,
            "order_reservation",
            -log.quantity,
            log.stockAfter,
            params.isBookingRequest
              ? `After-hours booking request ${orderNumber} reserved`
              : `Online order ${orderNumber} reserved`,
            orderId,
            "System",
          ]
        );
      }

      // E. Insert initial order_status_history
      const initialHistoryNote = params.isBookingRequest
        ? "🌙 After-hours booking request received. Awaiting Store Manager review to approve and unlock payment options."
        : params.paymentMethod === "upi"
          ? "Order submitted with UPI reference — awaiting verification"
          : "Order submitted with Cash on Delivery";

      await client.query(
        `INSERT INTO order_status_history (id, order_id, previous_status, new_status, changed_by, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW());`,
        [
          crypto.randomUUID(),
          orderId,
          "pending_confirmation",
          "pending_confirmation",
          "Customer",
          initialHistoryNote,
        ]
      );

      return {
        id: orderId,
        order_number: orderNumber,
        customer_name: customer.name || params.customerName || "Customer",
        customer_email: customer.email,
        customer_phone: finalPhone,
        delivery_address: finalAddress,
        locality: finalLocality,
        landmark: finalLandmark,
        delivery_instructions: finalInstructions,
        latitude: finalLat,
        longitude: finalLng,
        map_url: finalMapUrl,
        subtotal,
        discount_amount: discountAmount,
        delivery_charge: deliveryFee,
        total_amount: totalAmount,
        coupon_code: params.couponCode,
        payment_method: finalPaymentMethod,
        payment_status: initialPaymentStatus,
        order_status: initialOrderStatus,
        booking_status: initialBookingStatus,
        upi_reference: cleanUtr || undefined,
        upi_screenshot: screenshotUrl || undefined,
        items: verifiedLines.map((vl) => ({
          id: `item-${vl.variantId}`,
          order_id: orderId,
          product_id: vl.productId,
          variant_id: vl.variantId,
          product_name_snapshot: vl.productName,
          variant_name_snapshot: vl.variantName,
          quantity: vl.quantity,
          unit_price: vl.unitPrice,
          line_total: vl.lineTotal,
          image_url: vl.imageUrl,
          productName: vl.productName,
          variantName: vl.variantName,
          imageUrl: vl.imageUrl,
        })) as any,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    // 8. After commit: Bump database catalog_version and clear cached product queries
    await sql.query(
      `UPDATE store_settings SET catalog_version = COALESCE(catalog_version, 1) + 1, updated_at = NOW() WHERE id = 1;`
    ).catch(() => { });

    serverCache.invalidateTag("products");
    serverCache.invalidateTag("orders");

    // Fetch authoritative order with all db relations filled
    const fullOrder = (await getOrderById(orderId)) || (createdOrder as any);

    broadcastRealtimeEvent("order_created", fullOrder);

    return {
      success: true,
      order: fullOrder as any,
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
