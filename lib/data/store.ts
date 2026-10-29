import {
  Category,
  Product,
  ProductVariant,
  StoreSettings,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  Expense,
  OfflineSale,
  InventoryMovement,
  OrderStatusHistory,
  CustomerAccount,
  Coupon,
  Rider,
  AdminProfile,
} from "@/types";
import {
  initialCategories,
  initialProducts,
  initialSettings,
  initialOrders,
  initialExpenses,
  initialOfflineSales,
  initialInventoryMovements,
  initialCustomers,
  initialCoupons,
} from "./initial-data";
import { sql } from "@/lib/neon/db";
import { serverCache } from "@/lib/cache/server-cache";
import { generateOrderRef } from "@/lib/utils/order-ref";
import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Offloads Base64 data URLs to Neon media_assets table (Object Storage)
 * and returns the permanent CDN-cached media link `/api/media/[id]`.
 * Prevents heavy Base64 strings from bloating orders and products tables.
 */
export async function persistMediaAsset(
  dataUriOrBase64?: string | null,
  fileName = "upload.jpg"
): Promise<string | undefined> {
  if (!dataUriOrBase64) return undefined;
  if (!dataUriOrBase64.startsWith("data:image/")) {
    return dataUriOrBase64;
  }

  try {
    const mimeMatch = dataUriOrBase64.match(/^data:([^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const cleanBase64 = dataUriOrBase64.replace(/^data:[^;]+;base64,/, "");
    const sizeBytes = Math.floor((cleanBase64.length * 3) / 4);
    const mediaId = crypto.randomUUID();

    if (sql) {
      await sql.query(`
        INSERT INTO media_assets (id, mime_type, file_name, size_bytes, data_base64)
        VALUES ($1, $2, $3, $4, $5);
      `, [mediaId, mimeType, fileName, sizeBytes, cleanBase64]).catch((err: any) => {
        console.warn("[MEDIA] Background save warning:", err);
      });
    }

    const buffer = Buffer.from(cleanBase64, "base64");
    serverCache.set(`media_${mediaId}`, { mimeType, buffer }, 3600, ["media"]);

    return `/api/media/${mediaId}`;
  } catch (err) {
    console.warn("[MEDIA] persistMediaAsset error:", err);
    return dataUriOrBase64;
  }
}

const PRODUCTS_OVERRIDE_PATH = path.join(process.cwd(), "lib", "data", "products-override.json");

function loadOverriddenProducts(): Product[] | null {
  try {
    if (fs.existsSync(PRODUCTS_OVERRIDE_PATH)) {
      const data = fs.readFileSync(PRODUCTS_OVERRIDE_PATH, "utf8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("[STORE] Error loading products override from disk:", err);
  }
  return null;
}

function persistProductsToDisk(products: Product[]) {
  try {
    fs.writeFileSync(PRODUCTS_OVERRIDE_PATH, JSON.stringify(products, null, 2), "utf8");
  } catch (err) {
    console.error("[STORE] Error persisting products override to disk:", err);
  }
}

const ORDERS_OVERRIDE_PATH = path.join(process.cwd(), "lib", "data", "orders-override.json");

function loadOverriddenOrders(): Order[] | null {
  try {
    if (fs.existsSync(ORDERS_OVERRIDE_PATH)) {
      const data = fs.readFileSync(ORDERS_OVERRIDE_PATH, "utf8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("[STORE] Error loading orders override from disk:", err);
  }
  return null;
}

function persistOrdersToDisk(orders: Order[]) {
  try {
    fs.writeFileSync(ORDERS_OVERRIDE_PATH, JSON.stringify(orders, null, 2), "utf8");
  } catch (err) {
    console.error("[STORE] Error persisting orders override to disk:", err);
  }
}

// In-memory persistent state (shared in Node runtime / development server)
// Also syncs seamlessly when Supabase client is configured
declare global {
  // eslint-disable-next-line no-var
  var __mithaase_store: {
    categories: Category[];
    products: Product[];
    settings: StoreSettings;
    orders: Order[];
    expenses: Expense[];
    offlineSales: OfflineSale[];
    inventoryMovements: InventoryMovement[];
    customers: CustomerAccount[];
    coupons: Coupon[];
    riders: Rider[];
  } | undefined;
}

if (!global.__mithaase_store) {
  const initialLoadedProducts = loadOverriddenProducts() || JSON.parse(JSON.stringify(initialProducts));
  const initialLoadedOrders = loadOverriddenOrders() || JSON.parse(JSON.stringify(initialOrders));
  global.__mithaase_store = {
    categories: [...initialCategories],
    products: initialLoadedProducts,
    settings: { ...initialSettings },
    orders: initialLoadedOrders,
    expenses: JSON.parse(JSON.stringify(initialExpenses)),
    offlineSales: JSON.parse(JSON.stringify(initialOfflineSales)),
    inventoryMovements: JSON.parse(JSON.stringify(initialInventoryMovements)),
    customers: JSON.parse(JSON.stringify(initialCustomers)),
    coupons: JSON.parse(JSON.stringify(initialCoupons)),
    riders: [],
  };
}

if (!global.__mithaase_store.customers) {
  global.__mithaase_store.customers = JSON.parse(JSON.stringify(initialCustomers));
}

if (!global.__mithaase_store.riders) {
  global.__mithaase_store.riders = [];
}

if (!global.__mithaase_store.coupons) {
  global.__mithaase_store.coupons = JSON.parse(JSON.stringify(initialCoupons));
}

// Self-heal any orders where free delivery coupon (₹21) improperly subtracted from sweets subtotal
if (global.__mithaase_store.orders) {
  global.__mithaase_store.orders.forEach((o) => {
    if (
      (o.coupon_code?.toUpperCase() === "FREEDEL" || o.delivery_charge === 0) &&
      o.subtotal > 0 &&
      (o.total_amount === 0 || o.discount_amount === 21)
    ) {
      o.discount_amount = 0;
      o.delivery_charge = 0;
      o.total_amount = o.subtotal;
    }
  });
}

// Ensure Diwali Special Paneer Sabji 1L variant has active stock
if (global.__mithaase_store.products) {
  const paneer = global.__mithaase_store.products.find((p) => p.id === "prod-8");
  if (paneer) {
    const v1L = paneer.variants.find((v) => v.id === "var-8b");
    if (v1L) {
      v1L.variant_name = "Family Handi (1L / 1000ml)";
      if (v1L.stock_quantity <= 0) v1L.stock_quantity = 50;
      v1L.is_active = true;
    }
    const v500 = paneer.variants.find((v) => v.id === "var-8a");
    if (v500) {
      if (v500.stock_quantity <= 0) v500.stock_quantity = 50;
      v500.is_active = true;
    }
  }
}

const db = global.__mithaase_store;

// 1. SETTINGS
export async function getStoreSettings(): Promise<StoreSettings> {
  const cached = serverCache.get<StoreSettings>("store_settings");
  if (cached) {
    return { ...cached };
  }

  if (sql) {
    try {
      const rows = await sql.query(`SELECT * FROM store_settings WHERE id = 1 LIMIT 1;`);
      if (rows && rows.length > 0) {
        const s = rows[0];
        const loaded: StoreSettings = {
          store_name: s.store_name || db.settings.store_name,
          brand_tagline: s.brand_tagline || db.settings.brand_tagline,
          store_status: s.store_status || db.settings.store_status,
          accepts_orders: s.accepts_orders !== undefined ? Boolean(s.accepts_orders) : db.settings.accepts_orders,
          default_delivery_fee: s.default_delivery_fee !== undefined ? Number(s.default_delivery_fee) : db.settings.default_delivery_fee,
          minimum_order_value: s.minimum_order_value !== undefined ? Number(s.minimum_order_value) : db.settings.minimum_order_value,
          same_day_delivery_enabled: s.same_day_delivery_enabled !== undefined ? Boolean(s.same_day_delivery_enabled) : db.settings.same_day_delivery_enabled,
          operating_hours: s.operating_hours || db.settings.operating_hours,
          cutoff_time: s.cutoff_time || db.settings.cutoff_time,
          service_areas: Array.isArray(s.service_areas)
            ? s.service_areas
            : typeof s.service_areas === "string"
            ? JSON.parse(s.service_areas)
            : db.settings.service_areas,
          business_phone: s.business_phone || db.settings.business_phone,
          whatsapp_number: s.whatsapp_number || db.settings.whatsapp_number,
          shop_address: s.shop_address || db.settings.shop_address,
          announcement_message: s.announcement_message || db.settings.announcement_message,
          closure_message: s.closure_message || db.settings.closure_message,
          store_shutoff: s.store_shutoff !== undefined ? Boolean(s.store_shutoff) : db.settings.store_shutoff,
          shutoff_message: s.shutoff_message || db.settings.shutoff_message,
          upi_id: s.upi_id || db.settings.upi_id,
          upi_payee_name: s.upi_payee_name || db.settings.upi_payee_name,
          admin_name: s.admin_name || db.settings.admin_name,
          admin_email: s.admin_email || db.settings.admin_email,
          admin_phone: s.admin_phone || db.settings.admin_phone,
          admin_pin: s.admin_pin || db.settings.admin_pin,
        };
        db.settings = { ...db.settings, ...loaded };
      }
    } catch (err) {
      console.error("[STORE] getStoreSettings error:", err);
    }
  }
  const result = { ...db.settings };
  serverCache.set("store_settings", result, 60, ["settings"]);
  return result;
}

export async function updateStoreSettings(updates: Partial<StoreSettings>): Promise<StoreSettings> {
  db.settings = { ...db.settings, ...updates };
  serverCache.invalidateTag("settings");

  if (sql) {
    try {
      const serviceAreasJson = updates.service_areas ? JSON.stringify(updates.service_areas) : null;

      await sql.query(
        `UPDATE store_settings SET
          store_name = COALESCE($1, store_name),
          brand_tagline = COALESCE($2, brand_tagline),
          store_status = COALESCE($3, store_status),
          accepts_orders = COALESCE($4, accepts_orders),
          default_delivery_fee = COALESCE($5, default_delivery_fee),
          minimum_order_value = COALESCE($6, minimum_order_value),
          same_day_delivery_enabled = COALESCE($7, same_day_delivery_enabled),
          operating_hours = COALESCE($8, operating_hours),
          cutoff_time = COALESCE($9, cutoff_time),
          business_phone = COALESCE($10, business_phone),
          whatsapp_number = COALESCE($11, whatsapp_number),
          shop_address = COALESCE($12, shop_address),
          announcement_message = COALESCE($13, announcement_message),
          closure_message = COALESCE($14, closure_message),
          store_shutoff = COALESCE($15, store_shutoff),
          shutoff_message = COALESCE($16, shutoff_message),
          upi_id = COALESCE($17, upi_id),
          upi_payee_name = COALESCE($18, upi_payee_name),
          service_areas = COALESCE($19::jsonb, service_areas),
          updated_at = NOW()
        WHERE id = 1;`,
        [
          updates.store_name !== undefined ? updates.store_name : null,
          updates.brand_tagline !== undefined ? updates.brand_tagline : null,
          updates.store_status !== undefined ? updates.store_status : null,
          updates.accepts_orders !== undefined ? updates.accepts_orders : null,
          updates.default_delivery_fee !== undefined ? updates.default_delivery_fee : null,
          updates.minimum_order_value !== undefined ? updates.minimum_order_value : null,
          updates.same_day_delivery_enabled !== undefined ? updates.same_day_delivery_enabled : null,
          updates.operating_hours !== undefined ? updates.operating_hours : null,
          updates.cutoff_time !== undefined ? updates.cutoff_time : null,
          updates.business_phone !== undefined ? updates.business_phone : null,
          updates.whatsapp_number !== undefined ? updates.whatsapp_number : null,
          updates.shop_address !== undefined ? updates.shop_address : null,
          updates.announcement_message !== undefined ? updates.announcement_message : null,
          updates.closure_message !== undefined ? updates.closure_message : null,
          updates.store_shutoff !== undefined ? updates.store_shutoff : null,
          updates.shutoff_message !== undefined ? updates.shutoff_message : null,
          updates.upi_id !== undefined ? updates.upi_id : null,
          updates.upi_payee_name !== undefined ? updates.upi_payee_name : null,
          serviceAreasJson,
        ]
      );
    } catch (err) {
      console.error("[STORE] updateStoreSettings sql error:", err);
    }
  }

  return { ...db.settings };
}

// 2. CATEGORIES
export async function getCategories(): Promise<Category[]> {
  const cached = serverCache.get<Category[]>("categories");
  if (cached) {
    return [...cached];
  }

  const settings = await getStoreSettings();
  if (settings.store_shutoff || settings.store_status === "shutoff") {
    return [];
  }
  if (sql) {
    try {
      const rows = await sql.query(`
        SELECT id, name, slug, description, display_order, is_active 
        FROM categories 
        WHERE is_active = true 
        ORDER BY display_order ASC;
      `);
      if (rows && rows.length > 0) {
        const mapped = rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          description: r.description || "",
          display_order: Number(r.display_order) || 0,
          is_active: Boolean(r.is_active),
        }));
        serverCache.set("categories", mapped, 60, ["categories"]);
        return mapped;
      }
    } catch (err) {
      console.error("[STORE] getCategories db error:", err);
    }
  }
  const result = [...db.categories].sort((a, b) => a.display_order - b.display_order);
  serverCache.set("categories", result, 60, ["categories"]);
  return result;
}

// 3. PRODUCTS
export async function getProducts(categoryId?: string): Promise<Product[]> {
  const cacheKey = `products_${categoryId || "all"}`;
  const cached = serverCache.get<Product[]>(cacheKey);
  if (cached) {
    return [...cached];
  }

  const settings = await getStoreSettings();
  if (settings.store_shutoff || settings.store_status === "shutoff") {
    return [];
  }
  if (sql) {
    try {
      const prods = await sql.query(`
        SELECT 
          p.id, p.name, p.slug, p.description, p.category_id,
          c.name as category_name,
          p.image_url, p.is_active, p.is_featured, p.badge,
          p.is_seasonal_special, p.special_start_date, p.special_end_date,
          p.created_at, p.updated_at
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = true
        ORDER BY p.created_at ASC;
      `);
      const variants = await sql.query(`
        SELECT 
          id, product_id, variant_name, unit, price,
          stock_quantity, reserved_quantity, low_stock_threshold, is_active
        FROM product_variants
        WHERE is_active = true
        ORDER BY price ASC;
      `);

      if (prods && prods.length > 0) {
        const mapped: Product[] = prods.map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description || "",
          category_id: p.category_id,
          category_name: p.category_name || "Mithai",
          image_url: p.image_url,
          is_active: Boolean(p.is_active),
          is_featured: Boolean(p.is_featured),
          badge: p.badge || undefined,
          is_seasonal_special: Boolean(p.is_seasonal_special),
          special_start_date: p.special_start_date ? new Date(p.special_start_date).toISOString() : undefined,
          special_end_date: p.special_end_date ? new Date(p.special_end_date).toISOString() : undefined,
          variants: variants
            .filter((v: any) => v.product_id === p.id)
            .map((v: any) => ({
              id: v.id,
              product_id: p.id,
              variant_name: v.variant_name,
              unit: v.unit,
              price: Number(v.price),
              stock_quantity: Number(v.stock_quantity),
              low_stock_threshold: Number(v.low_stock_threshold),
              is_active: Boolean(v.is_active),
            })),
          created_at: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
          updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : new Date().toISOString(),
        }));

        db.products = mapped;
        const res = categoryId ? mapped.filter((p) => p.category_id === categoryId) : mapped;
        serverCache.set(cacheKey, res, 60, ["products"]);
        return res;
      }
    } catch (err) {
      console.error("[STORE] getProducts db error:", err);
    }
  }

  let list = db.products.filter((p) => p.is_active);
  if (categoryId) {
    list = list.filter((p) => p.category_id === categoryId);
  }
  serverCache.set(cacheKey, list, 60, ["products"]);
  return list;
}

export async function getAllProductsAdmin(): Promise<Product[]> {
  if (sql) {
    try {
      const prods = await sql.query(`
        SELECT 
          p.id, p.name, p.slug, p.description, p.category_id,
          c.name as category_name,
          p.image_url, p.is_active, p.is_featured, p.badge,
          p.is_seasonal_special, p.special_start_date, p.special_end_date,
          p.created_at, p.updated_at
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.created_at ASC;
      `);
      const variants = await sql.query(`
        SELECT 
          id, product_id, variant_name, unit, price,
          stock_quantity, reserved_quantity, low_stock_threshold, is_active
        FROM product_variants
        ORDER BY price ASC;
      `);

      if (prods && prods.length > 0) {
        const mapped: Product[] = prods.map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description || "",
          category_id: p.category_id,
          category_name: p.category_name || "Mithai",
          image_url: p.image_url,
          is_active: Boolean(p.is_active),
          is_featured: Boolean(p.is_featured),
          badge: p.badge || undefined,
          is_seasonal_special: Boolean(p.is_seasonal_special),
          special_start_date: p.special_start_date ? new Date(p.special_start_date).toISOString() : undefined,
          special_end_date: p.special_end_date ? new Date(p.special_end_date).toISOString() : undefined,
          variants: variants
            .filter((v: any) => v.product_id === p.id)
            .map((v: any) => ({
              id: v.id,
              product_id: p.id,
              variant_name: v.variant_name,
              unit: v.unit,
              price: Number(v.price),
              stock_quantity: Number(v.stock_quantity),
              low_stock_threshold: Number(v.low_stock_threshold),
              is_active: Boolean(v.is_active),
            })),
          created_at: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
          updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : new Date().toISOString(),
        }));

        db.products = mapped;
        return mapped;
      }
    } catch (err) {
      console.error("[STORE] getAllProductsAdmin db error:", err);
    }
  }
  return [...db.products];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (sql) {
    try {
      const prods = await sql.query(`
        SELECT 
          p.id, p.name, p.slug, p.description, p.category_id,
          c.name as category_name,
          p.image_url, p.is_active, p.is_featured, p.badge,
          p.is_seasonal_special, p.special_start_date, p.special_end_date,
          p.created_at, p.updated_at
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.slug = $1
        LIMIT 1;
      `, [slug]);

      if (prods && prods.length > 0) {
        const p = prods[0];
        const variants = await sql.query(`
          SELECT id, product_id, variant_name, unit, price, stock_quantity, low_stock_threshold, is_active
          FROM product_variants
          WHERE product_id = $1
          ORDER BY price ASC;
        `, [p.id]);

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description || "",
          category_id: p.category_id,
          category_name: p.category_name || "Mithai",
          image_url: p.image_url,
          is_active: Boolean(p.is_active),
          is_featured: Boolean(p.is_featured),
          badge: p.badge || undefined,
          is_seasonal_special: Boolean(p.is_seasonal_special),
          special_start_date: p.special_start_date ? new Date(p.special_start_date).toISOString() : undefined,
          special_end_date: p.special_end_date ? new Date(p.special_end_date).toISOString() : undefined,
          variants: variants.map((v: any) => ({
            id: v.id,
            product_id: p.id,
            variant_name: v.variant_name,
            unit: v.unit,
            price: Number(v.price),
            stock_quantity: Number(v.stock_quantity),
            low_stock_threshold: Number(v.low_stock_threshold),
            is_active: Boolean(v.is_active),
          })),
          created_at: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
          updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : new Date().toISOString(),
        };
      }
    } catch (err) {
      console.error("[STORE] getProductBySlug db error:", err);
    }
  }
  const prod = db.products.find((p) => p.slug === slug);
  return prod ? { ...prod } : null;
}

export async function getProductById(id: string): Promise<Product | null> {
  if (sql) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const prods = isUuid
        ? await sql.query(`
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = $1 LIMIT 1;
          `, [id])
        : await sql.query(`
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.slug = $1 LIMIT 1;
          `, [id]);

      if (prods && prods.length > 0) {
        const p = prods[0];
        const variants = await sql.query(`
          SELECT id, product_id, variant_name, unit, price, stock_quantity, low_stock_threshold, is_active
          FROM product_variants
          WHERE product_id = $1
          ORDER BY price ASC;
        `, [p.id]);

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description || "",
          category_id: p.category_id,
          category_name: p.category_name || "Mithai",
          image_url: p.image_url,
          is_active: Boolean(p.is_active),
          is_featured: Boolean(p.is_featured),
          badge: p.badge || undefined,
          is_seasonal_special: Boolean(p.is_seasonal_special),
          special_start_date: p.special_start_date ? new Date(p.special_start_date).toISOString() : undefined,
          special_end_date: p.special_end_date ? new Date(p.special_end_date).toISOString() : undefined,
          variants: variants.map((v: any) => ({
            id: v.id,
            product_id: p.id,
            variant_name: v.variant_name,
            unit: v.unit,
            price: Number(v.price),
            stock_quantity: Number(v.stock_quantity),
            low_stock_threshold: Number(v.low_stock_threshold),
            is_active: Boolean(v.is_active),
          })),
          created_at: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
          updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : new Date().toISOString(),
        };
      }
    } catch (err) {
      console.error("[STORE] getProductById db error:", err);
    }
  }
  const prod = db.products.find((p) => p.id === id || p.slug === id);
  return prod ? { ...prod } : null;
}

export async function createProduct(input: Partial<Product>): Promise<Product> {
  const slug = (input.name || "sweet")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (sql) {
    try {
      const res = await sql.query(`
        INSERT INTO products (name, slug, description, category_id, image_url, is_active, is_featured, badge)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id;
      `, [
        input.name || "Special Sweets",
        slug,
        input.description || "",
        input.category_id,
        input.image_url || "/images/hero_diwali_sweets.jpg",
        input.is_active ?? true,
        input.is_featured ?? false,
        input.badge || null,
      ]);

      const prodId = res[0].id;

      if (input.variants && input.variants.length > 0) {
        for (const v of input.variants) {
          await sql.query(`
            INSERT INTO product_variants (product_id, variant_name, unit, price, stock_quantity, low_stock_threshold, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7);
          `, [
            prodId,
            v.variant_name || "500g",
            v.unit || "Box",
            Number(v.price) || 0,
            Number(v.stock_quantity) || 0,
            Number(v.low_stock_threshold) || 5,
            v.is_active ?? true,
          ]);
        }
      }

      const created = await getProductById(prodId);
      if (created) {
        db.products.unshift(created);
        persistProductsToDisk(db.products);
        serverCache.invalidateTag("products");
        serverCache.set("catalog_version", Date.now().toString());
        return created;
      }
    } catch (err) {
      console.error("[STORE] createProduct db error:", err);
    }
  }

  const id = `prod-${Date.now()}`;
  const newProd: Product = {
    id,
    name: input.name || "Special Sweets",
    slug,
    description: input.description || "",
    category_id: input.category_id || db.categories[0].id,
    category_name: db.categories.find((c) => c.id === input.category_id)?.name || "Barfi",
    image_url: input.image_url || "/images/hero_diwali_sweets.jpg",
    is_active: input.is_active ?? true,
    is_featured: input.is_featured ?? false,
    badge: input.badge,
    variants: (input.variants || []).map((v, i) => ({
      id: `var-${id}-${i + 1}`,
      product_id: id,
      variant_name: v.variant_name || "500g",
      unit: v.unit || "Box",
      price: Number(v.price) || 0,
      stock_quantity: Number(v.stock_quantity) || 0,
      low_stock_threshold: Number(v.low_stock_threshold) || 5,
      is_active: v.is_active ?? true,
    })),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.products.unshift(newProd);
  persistProductsToDisk(db.products);
  serverCache.invalidateTag("products");
  serverCache.set("catalog_version", Date.now().toString());
  return newProd;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
  if (sql) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      let prodId = id;

      if (isUuid) {
        await sql.query(`
          UPDATE products SET
            name = COALESCE($2, name),
            description = COALESCE($3, description),
            image_url = COALESCE($4, image_url),
            badge = COALESCE($5, badge),
            updated_at = NOW()
          WHERE id = $1;
        `, [
          id,
          updates.name || null,
          updates.description || null,
          updates.image_url || null,
          updates.badge !== undefined ? updates.badge : null,
        ]);
      } else {
        const check = await sql.query(`SELECT id FROM products WHERE slug = $1 OR name = $1 LIMIT 1;`, [id]);
        if (check && check.length > 0) {
          prodId = check[0].id;
          await sql.query(`
            UPDATE products SET
              name = COALESCE($2, name),
              description = COALESCE($3, description),
              image_url = COALESCE($4, image_url),
              badge = COALESCE($5, badge),
              updated_at = NOW()
            WHERE id = $1;
          `, [
            prodId,
            updates.name || null,
            updates.description || null,
            updates.image_url || null,
            updates.badge !== undefined ? updates.badge : null,
          ]);
        }
      }

      // Update variant prices and quantities directly in the database table!
      if (updates.variants && Array.isArray(updates.variants)) {
        for (const v of updates.variants) {
          const isVarUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.id);
          if (isVarUuid) {
            await sql.query(`
              UPDATE product_variants SET
                price = $1,
                stock_quantity = $2,
                low_stock_threshold = $3,
                updated_at = NOW()
              WHERE id = $4;
            `, [
              Number(v.price),
              Number(v.stock_quantity),
              Number(v.low_stock_threshold) || 5,
              v.id,
            ]);
          } else {
            await sql.query(`
              UPDATE product_variants SET
                price = $1,
                stock_quantity = $2,
                low_stock_threshold = $3,
                updated_at = NOW()
              WHERE product_id = $4 AND variant_name = $5;
            `, [
              Number(v.price),
              Number(v.stock_quantity),
              Number(v.low_stock_threshold) || 5,
              prodId,
              v.variant_name,
            ]);
          }
        }
      }

      const fresh = await getProductById(prodId);
      if (fresh) {
        const idx = db.products.findIndex((p) => p.id === prodId || p.slug === fresh.slug || p.id === id);
        if (idx !== -1) {
          db.products[idx] = fresh;
        } else {
          db.products.unshift(fresh);
        }
        persistProductsToDisk(db.products);
        serverCache.invalidateTag("products");
        serverCache.set("catalog_version", Date.now().toString());
        return fresh;
      }
    } catch (err) {
      console.error("[STORE] updateProduct db error:", err);
    }
  }

  const index = db.products.findIndex((p) => p.id === id || p.slug === id);
  if (index === -1) return null;

  db.products[index] = {
    ...db.products[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  persistProductsToDisk(db.products);
  serverCache.invalidateTag("products");
  serverCache.set("catalog_version", Date.now().toString());
  return db.products[index];
}

export async function adjustVariantStock(
  variantId: string,
  quantityChange: number,
  movementType: 'addition' | 'reduction' | 'correction' | 'wastage' | 'sale' | 'order_reservation' | 'order_cancellation',
  reason: string,
  createdBy = "Admin"
): Promise<{ success: boolean; newStock: number; error?: string }> {
  for (const product of db.products) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) {
      const nextStock = variant.stock_quantity + quantityChange;
      if (nextStock < 0) {
        return { success: false, newStock: variant.stock_quantity, error: "Stock cannot become negative" };
      }
      variant.stock_quantity = nextStock;

      if (sql) {
        try {
          const isVarUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(variantId);
          if (isVarUuid) {
            await sql.query(`
              UPDATE product_variants 
              SET stock_quantity = $1, updated_at = NOW() 
              WHERE id = $2;
            `, [nextStock, variantId]);
          }

          await sql.query(`
            INSERT INTO inventory_movements (id, variant_id, product_name, variant_name, movement_type, quantity_change, stock_after, reason, created_by, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW());
          `, [
            crypto.randomUUID(),
            isVarUuid ? variantId : null,
            product.name,
            variant.variant_name,
            movementType,
            quantityChange,
            nextStock,
            reason,
            createdBy,
          ]).catch(() => {});
        } catch (err) {
          console.error("[STORE] adjustVariantStock db error:", err);
        }
      }
      
      const movement: InventoryMovement = {
        id: `im-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        variant_id: variantId,
        product_name: product.name,
        variant_name: variant.variant_name,
        movement_type: movementType,
        quantity_change: quantityChange,
        stock_after: nextStock,
        reason,
        created_by: createdBy,
        created_at: new Date().toISOString(),
      };
      db.inventoryMovements.unshift(movement);
      persistProductsToDisk(db.products);
      return { success: true, newStock: nextStock };
    }
  }
  return { success: false, newStock: 0, error: "Variant not found" };
}

// 4. ORDERS
export interface CreateOrderParams {
  customer_name: string;
  customer_email?: string;
  customer_phone: string;
  delivery_address: string;
  locality: string;
  landmark?: string;
  delivery_instructions?: string;
  payment_method: 'cod' | 'upi';
  upi_reference?: string;
  upi_screenshot?: string;
  coupon_code?: string;
  discount_amount?: number;
  latitude?: number;
  longitude?: number;
  map_url?: string;
  items: Array<{
    productId: string;
    variantId: string;
    quantity: number;
  }>;
}

function parseItemWeightInKg(variantName: string): number {
  if (!variantName) return 1;
  const str = variantName.toLowerCase();
  const kgMatch = str.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (kgMatch) return parseFloat(kgMatch[1]);
  const gmMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:g|gm|gram)/);
  if (gmMatch) return parseFloat(gmMatch[1]) / 1000;
  return 1;
}

export async function createOrder(params: CreateOrderParams): Promise<{ success: boolean; order?: Order; error?: string }> {
  // 1. Verify store status
  const settings = await getStoreSettings();
  if (settings.store_shutoff || settings.store_status === "shutoff") {
    return {
      success: false,
      error: settings.shutoff_message || "The store is permanently shut off. Shopping has been disabled.",
    };
  }
  if (!settings.accepts_orders || settings.store_status !== "open") {
    return {
      success: false,
      error: settings.closure_message || "We are currently not accepting orders. Please try again later.",
    };
  }

  const allProducts = await getAllProductsAdmin();

  // 2. Validate maximum total order weight (Max 20 kg standard limit)
  let totalOrderWeightKg = 0;
  for (const item of params.items) {
    const prod = allProducts.find((p) => p.id === item.productId || p.slug === item.productId);
    const vr = prod?.variants.find((v) => v.id === item.variantId || v.variant_name === item.variantId);
    if (vr) {
      totalOrderWeightKg += parseItemWeightInKg(vr.variant_name) * item.quantity;
    }
  }

  if (totalOrderWeightKg > 20) {
    return {
      success: false,
      error: `Order weight (${totalOrderWeightKg.toFixed(1)} kg) exceeds the 20 kg online limit. For bulk orders, please contact Shree Shyam Sweets directly.`,
    };
  }

  // 3. Validate items, recalculate prices server-side, check inventory
  let subtotal = 0;
  const verifiedItems: OrderItem[] = [];
  const stockDeductions: Array<{ variant: ProductVariant; product: Product; qty: number }> = [];

  for (const item of params.items) {
    const product = allProducts.find((p) => (p.id === item.productId || p.slug === item.productId) && p.is_active);
    if (!product) {
      return { success: false, error: `Product not found or unavailable.` };
    }

    // Check seasonal special availability (e.g. Paneer Sabji)
    if (product.is_seasonal_special) {
      const now = new Date();
      if (product.special_start_date && now < new Date(product.special_start_date)) {
        return { success: false, error: `${product.name} is not available yet.` };
      }
      if (product.special_end_date && now > new Date(product.special_end_date)) {
        return { success: false, error: `${product.name} is no longer available.` };
      }
    }

    const variant = product.variants.find((v) => (v.id === item.variantId || v.variant_name === item.variantId) && v.is_active);
    if (!variant) {
      return { success: false, error: `Selected portion/variant for ${product.name} is unavailable.` };
    }

    if (variant.stock_quantity < item.quantity) {
      return {
        success: false,
        error: `Only ${variant.stock_quantity} in stock for ${product.name} (${variant.variant_name}). Please reduce quantity.`,
      };
    }

    const lineTotal = variant.price * item.quantity;
    subtotal += lineTotal;

    verifiedItems.push({
      id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order_id: "", // filled below
      product_id: product.id,
      variant_id: variant.id,
      product_name_snapshot: product.name,
      variant_name_snapshot: variant.variant_name,
      quantity: item.quantity,
      unit_price: variant.price,
      line_total: lineTotal,
      image_url: product.image_url,
    });

    stockDeductions.push({ variant, product, qty: item.quantity });
  }

  if (settings.minimum_order_value > 0 && subtotal < settings.minimum_order_value) {
    return {
      success: false,
      error: `Minimum order amount is ₹${settings.minimum_order_value}. Your subtotal is ₹${subtotal}.`,
    };
  }

  // Deduct inventory transactional
  for (const item of stockDeductions) {
    item.variant.stock_quantity -= item.qty;
    db.inventoryMovements.unshift({
      id: `im-${Date.now()}-${Math.random()}`,
      variant_id: item.variant.id,
      product_name: item.product.name,
      variant_name: item.variant.variant_name,
      movement_type: "order_reservation",
      quantity_change: -item.qty,
      stock_after: item.variant.stock_quantity,
      reason: `Online order placement`,
      created_by: "System",
      created_at: new Date().toISOString(),
    });
  }

  const phoneToMatch = (params.customer_phone || "").replace(/[^0-9]/g, "");
  const emailToMatch = (params.customer_email || "").trim().toLowerCase();

  let isFirstTimeCustomer = true;
  if (sql) {
    try {
      const pastOrders = await sql.query(
        `SELECT count(*)::int as count FROM orders 
         WHERE (customer_email IS NOT NULL AND LOWER(customer_email) = $1)
            OR (customer_phone IS NOT NULL AND customer_phone = $2);`,
        [emailToMatch || "none@empty", phoneToMatch || "none"]
      );
      if (pastOrders && pastOrders[0] && pastOrders[0].count > 0) {
        isFirstTimeCustomer = false;
      }
    } catch {
      isFirstTimeCustomer = !db.orders.some(
        (o) =>
          (emailToMatch && o.customer_email?.toLowerCase() === emailToMatch) ||
          (phoneToMatch && (o.customer_phone || "").replace(/[^0-9]/g, "") === phoneToMatch)
      );
    }
  } else {
    isFirstTimeCustomer = !db.orders.some(
      (o) =>
        (emailToMatch && o.customer_email?.toLowerCase() === emailToMatch) ||
        (phoneToMatch && (o.customer_phone || "").replace(/[^0-9]/g, "") === phoneToMatch)
    );
  }

  // First-time customers get FREE delivery (₹0) on their first order!
  const standardDeliveryFee = Number(settings.default_delivery_fee) || 21;
  let deliveryCharge = isFirstTimeCustomer ? 0 : standardDeliveryFee;
  let discountAmount = 0;

  if (params.coupon_code) {
    const cp = await getCouponByCode(params.coupon_code);
    if (cp && cp.is_active) {
      const isFreeDelivery = Boolean(
        cp.free_delivery || cp.discount_type === "free_delivery" || cp.code.toUpperCase() === "FREEDEL"
      );

      // ONLY FREEDEL is restricted to new customers on their 1st order!
      if (cp.code.toUpperCase() === "FREEDEL" && !isFirstTimeCustomer) {
        return {
          success: false,
          error: "Free delivery coupon (FREEDEL) is valid only for new customers on their 1st order. Standard flat delivery fee applies.",
        };
      }

      if (isFreeDelivery) {
        deliveryCharge = 0;
      }

      if (cp.discount_type === "percentage" && cp.discount_value > 0) {
        const pct = Math.round((subtotal * cp.discount_value) / 100);
        discountAmount = cp.max_discount_amount ? Math.min(cp.max_discount_amount, pct) : pct;
      } else if (cp.discount_type === "flat_amount" && cp.discount_value > 0) {
        discountAmount = Math.min(subtotal, cp.discount_value);
      }
    }
  } else if (typeof params.discount_amount === "number" && params.discount_amount > 0) {
    discountAmount = Math.min(subtotal, params.discount_amount);
  }

  const totalAmount = Math.max(0, subtotal - discountAmount + deliveryCharge);
  const orderId = crypto.randomUUID();
  const orderNumber = `SSS-${new Date().getFullYear()}-${1000 + db.orders.length + 1}`;

  verifiedItems.forEach((it) => (it.order_id = orderId));

  const isAutoConfirmedUpi =
    params.payment_method === "upi" && Boolean(params.upi_reference?.toLowerCase().startsWith("youpi:"));

  const initialPaymentStatus: PaymentStatus = isAutoConfirmedUpi
    ? "paid"
    : params.payment_method === "upi"
    ? "pending_verification"
    : "unpaid";

  const initialOrderStatus: OrderStatus = isAutoConfirmedUpi
    ? "confirmed"
    : "pending_confirmation";

  const initialStatusHistory: OrderStatusHistory = {
    id: `hist-${Date.now()}`,
    order_id: orderId,
    previous_status: initialOrderStatus,
    new_status: initialOrderStatus,
    changed_by: isAutoConfirmedUpi ? "YouPI Auto-Gateway" : "Customer",
    note: isAutoConfirmedUpi
      ? "⚡ Instant UPI Payment Auto-Verified by YouPI Gateway. Order auto-confirmed."
      : params.payment_method === "upi"
      ? "Order submitted with manual UPI reference — Awaiting admin verification before order confirmation"
      : "Order placed online with Cash on Delivery",
    created_at: new Date().toISOString(),
  };

  const persistedScreenshot = params.upi_screenshot
    ? await persistMediaAsset(params.upi_screenshot, "upi_payment.jpg")
    : undefined;

  const orderRef = generateOrderRef();

  const newOrder: Order = {
    id: orderId,
    order_number: orderNumber,
    order_ref: orderRef,
    customer_name: params.customer_name.trim(),
    customer_email: params.customer_email?.trim(),
    customer_phone: params.customer_phone.trim(),
    delivery_address: params.delivery_address.trim(),
    locality: params.locality.trim(),
    landmark: params.landmark?.trim(),
    delivery_instructions: params.delivery_instructions?.trim(),
    subtotal,
    discount_amount: discountAmount,
    delivery_charge: deliveryCharge,
    total_amount: totalAmount,
    coupon_code: params.coupon_code ? params.coupon_code.toUpperCase().trim() : undefined,
    payment_method: params.payment_method,
    payment_status: initialPaymentStatus,
    order_status: initialOrderStatus,
    upi_reference: params.upi_reference,
    upi_screenshot: persistedScreenshot,
    latitude: params.latitude,
    longitude: params.longitude,
    map_url: params.map_url,
    source: "online",
    items: verifiedItems,
    status_history: [initialStatusHistory],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (sql) {
    try {
      await sql.query(`
        INSERT INTO orders (
          id, order_number, order_ref, customer_name, customer_email, customer_phone,
          delivery_address, locality, landmark, delivery_instructions,
          subtotal, discount_amount, delivery_charge, total_amount,
          coupon_code, payment_method, payment_status, order_status,
          upi_reference, upi_screenshot, latitude, longitude, map_url, source
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
        );
      `, [
        orderId,
        orderNumber,
        orderRef,
        params.customer_name.trim(),
        params.customer_email?.trim() || null,
        params.customer_phone.trim(),
        params.delivery_address.trim(),
        params.locality.trim(),
        params.landmark?.trim() || null,
        params.delivery_instructions?.trim() || null,
        subtotal,
        discountAmount,
        deliveryCharge,
        totalAmount,
        params.coupon_code ? params.coupon_code.toUpperCase().trim() : null,
        params.payment_method,
        initialPaymentStatus,
        initialOrderStatus,
        params.upi_reference || null,
        params.upi_screenshot || null,
        params.latitude || null,
        params.longitude || null,
        params.map_url || null,
        "online",
      ]);

      for (const it of verifiedItems) {
        const isProdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(it.product_id || "");
        await sql.query(`
          INSERT INTO order_items (
            id, order_id, product_id, product_name_snapshot,
            variant_name_snapshot, quantity, unit_price, line_total, image_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
        `, [
          crypto.randomUUID(),
          orderId,
          isProdUuid ? it.product_id : null,
          it.product_name_snapshot,
          it.variant_name_snapshot,
          it.quantity,
          it.unit_price,
          it.line_total,
          it.image_url || null,
        ]);
      }

      // 1. Insert initial order status history into Postgres
      await sql.query(`
        INSERT INTO order_status_history (id, order_id, previous_status, new_status, changed_by, note, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW());
      `, [crypto.randomUUID(), orderId, "pending_confirmation", "pending_confirmation", "Customer", "Order placed online"]);

      // 2. Auto-save customer profile into customer_accounts table
      if (params.customer_phone || params.customer_email) {
        const custEmail = (params.customer_email || `cust_${params.customer_phone.replace(/[^0-9]/g, "")}@mithaase.in`).toLowerCase().trim();
        const cleanPhone = params.customer_phone.replace(/[^0-9]/g, "");
        await sql.query(`
          INSERT INTO customer_accounts (email, phone, name, delivery_address, locality, landmark, delivery_instructions, latitude, longitude, map_url, pin, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          ON CONFLICT (email) DO UPDATE SET
            phone = EXCLUDED.phone,
            name = EXCLUDED.name,
            delivery_address = EXCLUDED.delivery_address,
            locality = EXCLUDED.locality,
            landmark = COALESCE(EXCLUDED.landmark, customer_accounts.landmark),
            delivery_instructions = COALESCE(EXCLUDED.delivery_instructions, customer_accounts.delivery_instructions),
            latitude = COALESCE(EXCLUDED.latitude, customer_accounts.latitude),
            longitude = COALESCE(EXCLUDED.longitude, customer_accounts.longitude),
            map_url = COALESCE(EXCLUDED.map_url, customer_accounts.map_url),
            updated_at = NOW();
        `, [
          custEmail,
          cleanPhone,
          params.customer_name.trim(),
          params.delivery_address.trim(),
          params.locality.trim(),
          params.landmark?.trim() || null,
          params.delivery_instructions?.trim() || null,
          params.latitude || 28.1907,
          params.longitude || 76.1624,
          params.map_url || null,
          "123456",
        ]).catch((e: any) => console.warn("[STORE] customer_accounts upsert warning:", e));
      }
    } catch (err) {
      console.error("[STORE] createOrder db error:", err);
    }
  }

  db.orders.unshift(newOrder);
  persistOrdersToDisk(db.orders);
  serverCache.invalidateTag("orders");
  return { success: true, order: newOrder };
}

export async function getOrders(
  statusFilter?: string,
  searchQuery?: string,
  emailFilter?: string
): Promise<Order[]> {
  let list: Order[] = [];
  if (sql) {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (emailFilter) {
        const norm = emailFilter.toLowerCase().trim();
        const cleanPhone = norm.replace(/[^0-9]/g, "");
        if (cleanPhone.length >= 10) {
          params.push(norm, `%${cleanPhone}%`);
          conditions.push(`(LOWER(customer_email) = $1 OR customer_phone LIKE $2 OR LOWER(order_number) = $1 OR id = $1)`);
        } else {
          params.push(norm);
          conditions.push(`(LOWER(customer_email) = $1 OR LOWER(order_number) = $1 OR id = $1)`);
        }
      }

      if (statusFilter && statusFilter !== "all") {
        if (statusFilter === "current" || statusFilter === "active") {
          conditions.push(`order_status NOT IN ('delivered', 'cancelled')`);
        } else if (statusFilter === "queued") {
          conditions.push(`delivery_queued = true AND order_status NOT IN ('delivered', 'cancelled')`);
        } else {
          params.push(statusFilter);
          conditions.push(`order_status = $${params.length}`);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const rows = await sql.query(`
        SELECT 
          id, order_number, order_ref, customer_name, customer_email, customer_phone,
          delivery_address, locality, landmark, delivery_instructions,
          subtotal, discount_amount, delivery_charge, total_amount, coupon_code,
          payment_method, payment_status, order_status, upi_reference,
          upi_screenshot, delivery_proof_photo, pickup_photo, refund_screenshot,
          delivery_queued, delivery_group_id, delivered_at, delivered_lat, delivered_lng,
          delivered_location_name, delivered_map_url, latitude, longitude, map_url,
          source, cancellation_reason, cancelled_at, refund_status, refund_amount, refund_txn_id,
          refunded_at, booking_status, created_at, updated_at
        FROM orders 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT 60;
      `, params);

      if (rows && rows.length > 0) {
        const orderIds = rows.map((r: any) => r.id);
        const itemRows = await sql.query(`
          SELECT * FROM order_items WHERE order_id = ANY($1);
        `, [orderIds]).catch(() => []);

        const itemsByOrderId: Record<string, OrderItem[]> = {};
        for (const it of itemRows || []) {
          if (!itemsByOrderId[it.order_id]) itemsByOrderId[it.order_id] = [];
          itemsByOrderId[it.order_id].push({
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
          });
        }

        const historyRows = await sql.query(`
          SELECT * FROM order_status_history WHERE order_id = ANY($1) ORDER BY created_at ASC;
        `, [orderIds]).catch(() => []);

        const historyByOrderId: Record<string, OrderStatusHistory[]> = {};
        for (const h of historyRows || []) {
          if (!historyByOrderId[h.order_id]) historyByOrderId[h.order_id] = [];
          historyByOrderId[h.order_id].push({
            id: String(h.id),
            order_id: h.order_id,
            previous_status: h.previous_status,
            new_status: h.new_status,
            changed_by: h.changed_by || "System",
            note: h.note || "",
            created_at: new Date(h.created_at).toISOString(),
          });
        }

        const dbMapped: Order[] = rows.map((o: any) => ({
          id: o.id,
          order_number: o.order_number,
          order_ref: o.order_ref || undefined,
          customer_name: o.customer_name,
          customer_email: o.customer_email || undefined,
          customer_phone: o.customer_phone,
          delivery_address: o.delivery_address,
          locality: o.locality,
          landmark: o.landmark || undefined,
          delivery_instructions: o.delivery_instructions || undefined,
          subtotal: Number(o.subtotal),
          discount_amount: Number(o.discount_amount),
          delivery_charge: Number(o.delivery_charge),
          total_amount: Number(o.total_amount),
          coupon_code: o.coupon_code || undefined,
          payment_method: o.payment_method,
          payment_status: o.payment_status,
          order_status: o.order_status,
          booking_status: o.booking_status || "standard",
          upi_reference: o.upi_reference || undefined,
          upi_screenshot: o.upi_screenshot || undefined,
          delivery_proof_photo: o.delivery_proof_photo || undefined,
          pickup_photo: o.pickup_photo || undefined,
          delivery_queued: Boolean(o.delivery_queued),
          delivery_group_id: o.delivery_group_id || undefined,
          delivered_at: o.delivered_at ? new Date(o.delivered_at).toISOString() : undefined,
          delivered_lat: o.delivered_lat ? Number(o.delivered_lat) : undefined,
          delivered_lng: o.delivered_lng ? Number(o.delivered_lng) : undefined,
          delivered_location_name: o.delivered_location_name || undefined,
          delivered_map_url: o.delivered_map_url || undefined,
          latitude: o.latitude ? Number(o.latitude) : undefined,
          longitude: o.longitude ? Number(o.longitude) : undefined,
          map_url: o.map_url || undefined,
          source: o.source || "online",
          items: itemsByOrderId[o.id] || [],
          status_history: historyByOrderId[o.id] || [],
          created_at: o.created_at ? new Date(o.created_at).toISOString() : new Date().toISOString(),
          updated_at: o.updated_at ? new Date(o.updated_at).toISOString() : new Date().toISOString(),
          cancellation_reason: o.cancellation_reason || undefined,
          cancelled_at: o.cancelled_at ? new Date(o.cancelled_at).toISOString() : undefined,
          refund_status: o.refund_status || undefined,
          refund_amount: o.refund_amount ? Number(o.refund_amount) : undefined,
          refund_txn_id: o.refund_txn_id || undefined,
          refund_screenshot: o.refund_screenshot || undefined,
          refunded_at: o.refunded_at ? new Date(o.refunded_at).toISOString() : undefined,
        }));

        list = dbMapped;
      }
    } catch (err) {
      console.error("[STORE] getOrders db error:", err);
    }
  }

  if (emailFilter) {
    const norm = emailFilter.toLowerCase().trim();
    const cleanPhone = norm.replace(/[^0-9]/g, "");
    list = list.filter(
      (o) =>
        (o.customer_email || "").toLowerCase() === norm ||
        (cleanPhone.length >= 10 && (o.customer_phone || "").replace(/[^0-9]/g, "").includes(cleanPhone)) ||
        o.order_number.toLowerCase() === norm ||
        o.id === norm
    );
  }
  if (statusFilter && statusFilter !== "all") {
    if (statusFilter === "current" || statusFilter === "active") {
      list = list.filter((o) => o.order_status !== "delivered" && o.order_status !== "cancelled");
    } else if (statusFilter === "queued") {
      list = list.filter((o) => o.delivery_queued && o.order_status !== "delivered" && o.order_status !== "cancelled");
    } else {
      list = list.filter((o) => o.order_status === statusFilter);
    }
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.includes(q) ||
        o.locality.toLowerCase().includes(q)
    );
  }

  const normalized = list.map(normalizeOrder);
  return normalized;
}

function normalizeOrder(order: Order): Order {
  if (
    (order.coupon_code?.toUpperCase() === "FREEDEL" || order.delivery_charge === 0) &&
    order.subtotal > 0 &&
    (order.total_amount === 0 || order.discount_amount === 21)
  ) {
    order.discount_amount = 0;
    order.delivery_charge = 0;
    order.total_amount = order.subtotal;
  }
  return order;
}

export async function getOrderById(id: string): Promise<Order | null> {
  if (!id) return null;
  const cleanId = String(id).trim();
  const lower = cleanId.toLowerCase();

  // 1. Authoritative check in Neon PostgreSQL
  if (sql) {
    try {
      const rows = await sql.query(
        `SELECT * FROM orders WHERE LOWER(id) = $1 OR LOWER(order_number) = $1 OR LOWER(order_ref) = $1 OR id = $2 OR order_number = $2 OR order_ref = $2 LIMIT 1;`,
        [lower, cleanId]
      );

      if (rows && rows.length > 0) {
        const o = rows[0];
        const itemRows = await sql.query(
          `SELECT * FROM order_items WHERE order_id = $1;`,
          [o.id]
        );
        const historyRows = await sql.query(
          `SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC;`,
          [o.id]
        ).catch(() => []);
        const mappedOrder: Order = {
          id: o.id,
          order_number: o.order_number,
          order_ref: o.order_ref || undefined,
          customer_name: o.customer_name,
          customer_email: o.customer_email || undefined,
          customer_phone: o.customer_phone,
          delivery_address: o.delivery_address,
          locality: o.locality,
          landmark: o.landmark || undefined,
          delivery_instructions: o.delivery_instructions || undefined,
          subtotal: Number(o.subtotal),
          discount_amount: Number(o.discount_amount),
          delivery_charge: Number(o.delivery_charge),
          total_amount: Number(o.total_amount),
          coupon_code: o.coupon_code || undefined,
          payment_method: o.payment_method,
          payment_status: o.payment_status,
          order_status: o.order_status,
          booking_status: o.booking_status || "standard",
          upi_reference: o.upi_reference || undefined,
          upi_screenshot: o.upi_screenshot || undefined,
          delivery_proof_photo: o.delivery_proof_photo || undefined,
          pickup_photo: o.pickup_photo || undefined,
          delivery_queued: Boolean(o.delivery_queued),
          delivery_group_id: o.delivery_group_id || undefined,
          delivered_at: o.delivered_at ? new Date(o.delivered_at).toISOString() : undefined,
          delivered_lat: o.delivered_lat ? Number(o.delivered_lat) : undefined,
          delivered_lng: o.delivered_lng ? Number(o.delivered_lng) : undefined,
          delivered_location_name: o.delivered_location_name || undefined,
          delivered_map_url: o.delivered_map_url || undefined,
          latitude: o.latitude ? Number(o.latitude) : undefined,
          longitude: o.longitude ? Number(o.longitude) : undefined,
          map_url: o.map_url || undefined,
          source: o.source || "online",
          items: (itemRows || []).map((it: any) => ({
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
          })),
          status_history: (historyRows || []).map((h: any) => ({
            id: String(h.id),
            order_id: h.order_id,
            previous_status: h.previous_status,
            new_status: h.new_status,
            changed_by: h.changed_by || "System",
            note: h.note || "",
            created_at: new Date(h.created_at).toISOString(),
          })),
          created_at: o.created_at ? new Date(o.created_at).toISOString() : new Date().toISOString(),
          updated_at: o.updated_at ? new Date(o.updated_at).toISOString() : new Date().toISOString(),
          cancellation_reason: o.cancellation_reason || undefined,
          refund_status: o.refund_status || undefined,
          refund_amount: o.refund_amount ? Number(o.refund_amount) : undefined,
          refund_txn_id: o.refund_txn_id || undefined,
          refund_screenshot: o.refund_screenshot || undefined,
        };

        db.orders.unshift(mappedOrder);
        return normalizeOrder(mappedOrder);
      }
    } catch (err) {
      console.error("[STORE] getOrderById db error:", err);
    }
  }

  // 3. Fallback: check disk storage
  const diskOrders = loadOverriddenOrders();
  if (diskOrders) {
    const diskMatch = diskOrders.find(
      (o) =>
        o.id.toLowerCase() === lower ||
        o.order_number.toLowerCase() === lower ||
        cleanId === o.id ||
        cleanId === o.order_number
    );
    if (diskMatch) return { ...normalizeOrder(diskMatch) };
  }

  return null;
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  note?: string,
  changedBy = "Admin",
  deliveryProofPhoto?: string,
  pickupPhoto?: string,
  deliveryDetails?: {
    delivered_at?: string;
    delivered_lat?: number;
    delivered_lng?: number;
    delivered_location_name?: string;
    delivered_map_url?: string;
  }
): Promise<{ success: boolean; order?: Order; error?: string }> {
  const order = db.orders.find((o) => o.id === orderId || o.order_number === orderId) || (await getOrderById(orderId));
  if (!order) return { success: false, error: "Order not found" };

  if (deliveryProofPhoto) {
    deliveryProofPhoto = await persistMediaAsset(deliveryProofPhoto, "delivery_proof.jpg");
    order.delivery_proof_photo = deliveryProofPhoto;
  }
  if (pickupPhoto) {
    pickupPhoto = await persistMediaAsset(pickupPhoto, "pickup_photo.jpg");
    order.pickup_photo = pickupPhoto;
  }
  if (deliveryDetails) {
    if (deliveryDetails.delivered_at) order.delivered_at = deliveryDetails.delivered_at;
    if (deliveryDetails.delivered_lat !== undefined) order.delivered_lat = deliveryDetails.delivered_lat;
    if (deliveryDetails.delivered_lng !== undefined) order.delivered_lng = deliveryDetails.delivered_lng;
    if (deliveryDetails.delivered_location_name) order.delivered_location_name = deliveryDetails.delivered_location_name;
    if (deliveryDetails.delivered_map_url) order.delivered_map_url = deliveryDetails.delivered_map_url;
  }

  const prevStatus = order.order_status;
  if (prevStatus === newStatus) return { success: true, order };

  // Strict non-reversible workflow progression check
  const workflowOrder: OrderStatus[] = [
    "pending_confirmation",
    "confirmed",
    "preparing",
    "ready_for_dispatch",
    "out_for_delivery",
    "delivered",
  ];

  const prevIdx = workflowOrder.indexOf(prevStatus);
  const newIdx = workflowOrder.indexOf(newStatus);

  // If moving backwards in the workflow, reject
  if (prevIdx !== -1 && newIdx !== -1 && newIdx < prevIdx && newStatus !== "cancelled") {
    return {
      success: false,
      error: `Workflow is irreversible: Cannot change status backwards from ${prevStatus.replace(/_/g, " ")} to ${newStatus.replace(/_/g, " ")}.`,
    };
  }

  // When confirming order: If UPI, auto-mark payment as paid
  if (newStatus === "confirmed" && order.payment_method === "upi") {
    order.payment_status = "paid";
  }

  // If cancelling an order, restore inventory and initiate refund if paid via UPI
  if (newStatus === "cancelled" && prevStatus !== "cancelled") {
    order.cancelled_at = new Date().toISOString();
    order.cancellation_reason = note || "Cancelled by store administrator";

    for (const item of order.items) {
      await adjustVariantStock(
        item.variant_id,
        item.quantity,
        "order_cancellation",
        `Order ${order.order_number} cancelled`,
        changedBy
      );
    }

    // If order was paid via UPI or payment status is paid, trigger refund process
    if (order.payment_method === "upi" || order.payment_status === "paid") {
      order.refund_status = "pending";
      order.refund_amount = order.total_amount;
    }
  }

  order.order_status = newStatus;
  order.updated_at = new Date().toISOString();

  if (!order.status_history) order.status_history = [];
  order.status_history.push({
    id: `hist-${Date.now()}`,
    order_id: order.id,
    previous_status: prevStatus,
    new_status: newStatus,
    changed_by: changedBy,
    note: note || `Status changed to ${newStatus}`,
    created_at: new Date().toISOString(),
  });

  if (sql) {
    try {
      await sql.query(
        `UPDATE orders SET
          order_status = $1,
          cancellation_reason = $2,
          cancelled_at = $3,
          refund_status = $4,
          refund_amount = $5,
          delivery_proof_photo = COALESCE($6, delivery_proof_photo),
          delivered_at = COALESCE($7, delivered_at),
          delivered_lat = COALESCE($8, delivered_lat),
          delivered_lng = COALESCE($9, delivered_lng),
          delivered_location_name = COALESCE($10, delivered_location_name),
          delivered_map_url = COALESCE($11, delivered_map_url),
          payment_status = $12,
          pickup_photo = COALESCE($14, pickup_photo),
          updated_at = NOW()
        WHERE LOWER(id) = LOWER($13) OR LOWER(order_number) = LOWER($13) OR id = $13 OR order_number = $13;`,
        [
          order.order_status,
          order.cancellation_reason || null,
          order.cancelled_at || null,
          order.refund_status || null,
          order.refund_amount || null,
          order.delivery_proof_photo || null,
          order.delivered_at || null,
          order.delivered_lat || null,
          order.delivered_lng || null,
          order.delivered_location_name || null,
          order.delivered_map_url || null,
          order.payment_status,
          orderId,
          order.pickup_photo || null,
        ]
      );

      // Record status transition in order_status_history
      await sql.query(`
        INSERT INTO order_status_history (id, order_id, previous_status, new_status, changed_by, note, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW());
      `, [crypto.randomUUID(), order.id, prevStatus, newStatus, changedBy, note || `Status changed to ${newStatus}`]).catch(() => {});
    } catch (err) {
      console.error("[STORE] updateOrderStatus sql error:", err);
    }
  }

  // Update in-memory orders array
  const memIdx = db.orders.findIndex((o) => o.id === order.id || o.order_number === order.order_number);
  if (memIdx !== -1) {
    db.orders[memIdx] = { ...order };
  } else {
    db.orders.unshift({ ...order });
  }

  serverCache.invalidateTag("orders");

  // Automated Customer Notifications: Email (Receipt / Confirmation / Cancellation) & WhatsApp
  try {
    if (newStatus === "confirmed" && prevStatus !== "confirmed") {
      const { sendOrderConfirmedNotification } = await import("@/lib/notifications/order-notifications");
      sendOrderConfirmedNotification(order.id).catch(() => {});
    } else if (newStatus === "delivered" && prevStatus !== "delivered") {
      const { sendOrderDeliveredNotification } = await import("@/lib/notifications/order-notifications");
      sendOrderDeliveredNotification(order.id).catch(() => {});
    } else if (newStatus === "cancelled" && prevStatus !== "cancelled") {
      const { sendOrderCancelledNotification } = await import("@/lib/notifications/order-notifications");
      sendOrderCancelledNotification(order.id, note || order.cancellation_reason).catch(() => {});
    }
  } catch (notifErr) {
    console.warn("[STORE] Notification dispatch warning:", notifErr);
  }

  return { success: true, order };
}

export async function processOrderRefund(
  orderId: string,
  refundTxnId: string,
  refundScreenshot: string,
  refundNote?: string,
  processedBy = "Admin"
): Promise<{ success: boolean; order?: Order; error?: string }> {
  const order = db.orders.find((o) => o.id === orderId || o.order_number === orderId) || (await getOrderById(orderId));
  if (!order) return { success: false, error: "Order not found." };

  if (order.order_status !== "cancelled") {
    return { success: false, error: "Only cancelled orders can have refunds processed." };
  }
  if (!refundTxnId.trim()) {
    return { success: false, error: "Refund transaction number (UTR / Ref ID) is required." };
  }
  if (!refundScreenshot) {
    return { success: false, error: "Screenshot proof of refund is required." };
  }

  const nowIso = new Date().toISOString();
  order.refund_status = "refunded";
  order.payment_status = "refunded";
  order.refund_txn_id = refundTxnId.trim();
  order.refund_screenshot = refundScreenshot;
  order.refunded_at = nowIso;
  order.refund_amount = order.total_amount;
  order.updated_at = nowIso;

  if (!order.status_history) order.status_history = [];
  order.status_history.push({
    id: `hist-${Date.now()}`,
    order_id: order.id,
    previous_status: "cancelled",
    new_status: "cancelled",
    changed_by: processedBy,
    note: refundNote?.trim()
      ? `Refund of ₹${order.total_amount} completed (Txn #${refundTxnId.trim()}): ${refundNote.trim()}`
      : `Refund of ₹${order.total_amount} completed. UPI Transaction #${refundTxnId.trim()}`,
    created_at: nowIso,
  });

  if (sql) {
    try {
      await sql.query(
        `UPDATE orders SET
          refund_status = $1,
          payment_status = $2,
          refund_txn_id = $3,
          refund_screenshot = $4,
          refunded_at = $5,
          refund_amount = $6,
          updated_at = NOW()
        WHERE id = $7 OR order_number = $7;`,
        [
          order.refund_status,
          order.payment_status,
          order.refund_txn_id,
          order.refund_screenshot,
          order.refunded_at,
          order.refund_amount,
          orderId,
        ]
      );
    } catch (err) {
      console.error("[STORE] processOrderRefund sql error:", err);
    }
  }

  serverCache.invalidateTag("orders");
  return { success: true, order };
}

export async function updatePaymentStatus(
  orderId: string,
  newStatus: PaymentStatus,
  upiRef?: string
): Promise<{ success: boolean; order?: Order }> {
  const order = db.orders.find((o) => o.id === orderId || o.order_number === orderId) || (await getOrderById(orderId));
  if (!order) return { success: false };

  order.payment_status = newStatus;
  if (upiRef) order.upi_reference = upiRef;
  order.updated_at = new Date().toISOString();

  if (sql) {
    try {
      await sql.query(
        `UPDATE orders SET payment_status = $1, upi_reference = COALESCE($2, upi_reference), updated_at = NOW() WHERE id = $3 OR order_number = $3;`,
        [newStatus, upiRef || null, orderId]
      );
    } catch (err) {
      console.error("[STORE] updatePaymentStatus sql error:", err);
    }
  }
  serverCache.invalidateTag("orders");

  if (newStatus === "paid") {
    import("@/lib/notifications/order-notifications")
      .then(({ sendOrderConfirmedNotification }) => {
        sendOrderConfirmedNotification(order.id).catch(() => {});
      })
      .catch(() => {});
  }

  return { success: true, order };
}

export async function updateBookingStatus(
  orderId: string,
  newBookingStatus: "standard" | "requested" | "approved_for_payment" | "payment_selected" | "confirmed",
  changedBy: string = "Admin",
  note?: string,
  paymentData?: {
    payment_method: "cod" | "upi";
    upi_reference?: string;
    upi_screenshot?: string;
  }
): Promise<{ success: boolean; order?: Order; error?: string }> {
  const order = db.orders.find((o) => o.id === orderId || o.order_number === orderId) || (await getOrderById(orderId));
  if (!order) return { success: false, error: "Order not found" };

  order.booking_status = newBookingStatus;
  order.updated_at = new Date().toISOString();

  let historyNote = note || `Booking status updated to ${newBookingStatus}`;

  if (newBookingStatus === "approved_for_payment") {
    historyNote = note || "🌙 After-hours booking request approved by Store Manager. Payment options unlocked for customer.";
  } else if (newBookingStatus === "payment_selected" && paymentData) {
    order.payment_method = paymentData.payment_method;
    if (paymentData.payment_method === "upi") {
      order.upi_reference = paymentData.upi_reference;
      order.upi_screenshot = paymentData.upi_screenshot;
      order.payment_status = "pending_verification";
      historyNote = note || `Customer selected UPI Payment (Ref: ${paymentData.upi_reference || "Proof Attached"}). Awaiting Store Manager final reapproval.`;
    } else {
      order.upi_reference = undefined;
      order.upi_screenshot = undefined;
      order.payment_status = "unpaid";
      historyNote = note || "Customer selected Cash on Delivery (COD). Awaiting Store Manager final reapproval.";
    }
  } else if (newBookingStatus === "confirmed") {
    order.order_status = "confirmed";
    if (order.payment_method === "upi") {
      order.payment_status = "paid";
    }
    historyNote = note || "Order officially confirmed by Store Manager after payment review.";
  }

  if (!order.status_history) order.status_history = [];
  order.status_history.push({
    id: `hist-${Date.now()}`,
    order_id: order.id,
    previous_status: order.order_status,
    new_status: order.order_status,
    changed_by: changedBy,
    note: historyNote,
    created_at: new Date().toISOString(),
  });

  if (sql) {
    try {
      let screenshotUrl = order.upi_screenshot;
      if (paymentData?.upi_screenshot && paymentData.upi_screenshot.startsWith("data:")) {
        screenshotUrl = await persistMediaAsset(paymentData.upi_screenshot, "upi_payment.jpg");
        order.upi_screenshot = screenshotUrl || undefined;
      }

      await sql.query(
        `UPDATE orders SET
          booking_status = $1,
          order_status = $2,
          payment_status = $3,
          payment_method = $4,
          upi_reference = $5,
          upi_screenshot = $6,
          updated_at = NOW()
        WHERE id = $7 OR order_number = $7;`,
        [
          newBookingStatus,
          order.order_status,
          order.payment_status,
          order.payment_method,
          order.upi_reference || null,
          screenshotUrl || null,
          order.id,
        ]
      );

      await sql.query(
        `INSERT INTO order_status_history (id, order_id, previous_status, new_status, changed_by, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW());`,
        [crypto.randomUUID(), order.id, order.order_status, order.order_status, changedBy, historyNote]
      ).catch(() => {});
    } catch (err) {
      console.error("[STORE] updateBookingStatus sql error:", err);
    }
  }

  const memIdx = db.orders.findIndex((o) => o.id === order.id || o.order_number === order.order_number);
  if (memIdx !== -1) {
    db.orders[memIdx] = { ...order };
  }

  serverCache.invalidateTag("orders");

  if (newBookingStatus === "confirmed") {
    try {
      const { sendOrderConfirmedNotification } = await import("@/lib/notifications/order-notifications");
      sendOrderConfirmedNotification(order.id).catch(() => {});
    } catch {}
  }

  return { success: true, order };
}

export async function setOrderDeliveryQueue(
  orderId: string,
  queued: boolean,
  groupId?: string
): Promise<{ success: boolean; order?: Order }> {
  if (sql) {
    try {
      const gId = queued ? (groupId || null) : null;
      await sql.query(
        `UPDATE orders 
         SET delivery_queued = $1, delivery_group_id = $2, updated_at = NOW() 
         WHERE id = $3 OR order_number = $3;`,
        [queued, gId, orderId]
      );
    } catch (err) {
      console.error("[STORE] setOrderDeliveryQueue database query error:", err);
    }
  }

  const order = db.orders.find((o) => o.id === orderId || o.order_number === orderId);
  if (order) {
    order.delivery_queued = queued;
    if (groupId !== undefined) order.delivery_group_id = groupId;
    if (!queued) order.delivery_group_id = undefined;
    order.updated_at = new Date().toISOString();
  }

  serverCache.invalidateTag("orders");
  const fullOrder = await getOrderById(orderId);
  return { success: true, order: fullOrder || order };
}

export async function batchDispatchOrders(
  orderIds: string[],
  changedBy = "Admin"
): Promise<{ success: boolean; orders: Order[] }> {
  const dispatchedOrders: Order[] = [];
  const batchGroupId = `batch-${Date.now()}`;

  if (sql && orderIds.length > 0) {
    try {
      await sql.query(
        `UPDATE orders 
         SET delivery_queued = FALSE, delivery_group_id = $1, order_status = 'ready_for_dispatch', updated_at = NOW() 
         WHERE id = ANY($2::text[]) OR order_number = ANY($2::text[]);`,
        [batchGroupId, orderIds]
      );
    } catch (err) {
      console.error("[STORE] batchDispatchOrders database error:", err);
    }
  }

  for (const id of orderIds) {
    const fullOrder = await getOrderById(id);
    if (fullOrder) {
      dispatchedOrders.push(fullOrder);
    } else {
      const memOrder = db.orders.find((o) => o.id === id || o.order_number === id);
      if (memOrder) {
        memOrder.delivery_queued = false;
        memOrder.delivery_group_id = batchGroupId;
        dispatchedOrders.push(memOrder);
      }
    }
  }

  serverCache.invalidateTag("orders");
  return { success: true, orders: dispatchedOrders };
}

// 5. OFFLINE SALES (Counter Transactions)
export interface CreateOfflineSaleParams {
  payment_method: 'cash' | 'upi';
  discount_amount?: number;
  customer_name?: string;
  customer_phone?: string;
  items: Array<{
    productId: string;
    variantId: string;
    quantity: number;
    unit_price: number;
  }>;
}

export async function createOfflineSale(params: CreateOfflineSaleParams): Promise<{ success: boolean; sale?: OfflineSale; error?: string }> {
  let subtotal = 0;
  const saleItems: any[] = [];
  const allProducts = await getAllProductsAdmin();

  for (const item of params.items) {
    const product = allProducts.find((p) => p.id === item.productId || p.slug === item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId || v.variant_name === item.variantId);
    if (!product || !variant) {
      return { success: false, error: "Invalid product item" };
    }

    if (variant.stock_quantity < item.quantity) {
      return {
        success: false,
        error: `Insufficient stock for ${product.name} (${variant.variant_name}). Only ${variant.stock_quantity} available.`,
      };
    }

    const lineTotal = item.unit_price * item.quantity;
    subtotal += lineTotal;

    saleItems.push({
      id: `oi-${Date.now()}-${Math.random()}`,
      offline_sale_id: "",
      product_id: product.id,
      variant_id: variant.id,
      product_name_snapshot: product.name,
      variant_name_snapshot: variant.variant_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: lineTotal,
    });
  }

  const discount = Number(params.discount_amount) || 0;
  const totalAmount = Math.max(0, subtotal - discount);
  const saleId = `sale-${Date.now()}`;
  const saleNumber = `OFF-${new Date().getFullYear()}-${100 + db.offlineSales.length + 1}`;

  saleItems.forEach((si) => (si.offline_sale_id = saleId));

  // Deduct stock safely
  for (const item of params.items) {
    await adjustVariantStock(
      item.variantId,
      -item.quantity,
      "sale",
      `Counter sale ${saleNumber}`,
      "Counter Staff"
    );
  }

  const saleUuid = crypto.randomUUID();
  const newSale: OfflineSale = {
    id: saleUuid,
    sale_number: saleNumber,
    subtotal,
    discount_amount: discount,
    total_amount: totalAmount,
    payment_method: params.payment_method,
    customer_name: params.customer_name,
    customer_phone: params.customer_phone,
    items: saleItems,
    created_by: "Counter Staff",
    created_at: new Date().toISOString(),
  };

  if (sql) {
    try {
      await sql.query(`
        INSERT INTO offline_sales (id, sale_number, customer_name, customer_phone, subtotal, discount_amount, total_amount, payment_method, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW());
      `, [
        saleUuid,
        newSale.sale_number,
        newSale.customer_name || null,
        newSale.customer_phone || null,
        newSale.subtotal,
        newSale.discount_amount,
        newSale.total_amount,
        newSale.payment_method,
        newSale.created_by,
      ]);
    } catch (err) {
      console.error("[STORE] createOfflineSale db error:", err);
    }
  }

  db.offlineSales.unshift(newSale);
  return { success: true, sale: newSale };
}

export async function getOfflineSales(): Promise<OfflineSale[]> {
  if (sql) {
    try {
      const rows = await sql.query(`SELECT * FROM offline_sales ORDER BY created_at DESC;`);
      if (rows && rows.length > 0) {
        return rows.map((s: any) => ({
          id: String(s.id),
          sale_number: s.sale_number,
          subtotal: Number(s.subtotal),
          discount_amount: Number(s.discount_amount),
          total_amount: Number(s.total_amount),
          payment_method: s.payment_method,
          customer_name: s.customer_name || undefined,
          customer_phone: s.customer_phone || undefined,
          items: [],
          created_by: s.created_by || "Counter Staff",
          created_at: new Date(s.created_at).toISOString(),
        }));
      }
    } catch (err) {
      console.error("[STORE] getOfflineSales db error:", err);
    }
  }
  return [...db.offlineSales];
}

// 6. EXPENSES
export async function getExpenses(): Promise<Expense[]> {
  if (sql) {
    try {
      const rows = await sql.query(`SELECT * FROM expenses ORDER BY expense_date DESC, created_at DESC;`);
      if (rows && rows.length > 0) {
        return rows.map((e: any) => ({
          id: String(e.id),
          title: e.title,
          category: e.category,
          amount: Number(e.amount),
          payment_method: e.payment_method,
          expense_date: e.expense_date ? new Date(e.expense_date).toISOString().split("T")[0] : "",
          description: e.description || "",
          receipt_url: e.receipt_url || undefined,
          created_by: e.created_by,
          created_at: new Date(e.created_at).toISOString(),
        }));
      }
    } catch (err) {
      console.error("[STORE] getExpenses db error:", err);
    }
  }
  return [...db.expenses];
}

export async function createExpense(input: Partial<Expense>): Promise<Expense> {
  const expenseId = crypto.randomUUID();
  const expense: Expense = {
    id: expenseId,
    title: input.title || "Expense",
    category: input.category || "Raw materials",
    amount: Number(input.amount) || 0,
    payment_method: input.payment_method || "cash",
    expense_date: input.expense_date || new Date().toISOString().split("T")[0],
    description: input.description || "",
    receipt_url: input.receipt_url,
    created_by: input.created_by || "Admin",
    created_at: new Date().toISOString(),
  };

  if (sql) {
    try {
      await sql.query(`
        INSERT INTO expenses (id, title, category, amount, payment_method, expense_date, description, receipt_url, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW());
      `, [
        expenseId,
        expense.title,
        expense.category,
        expense.amount,
        expense.payment_method,
        expense.expense_date,
        expense.description,
        expense.receipt_url || null,
        expense.created_by,
      ]);
    } catch (err) {
      console.error("[STORE] createExpense db error:", err);
    }
  }

  db.expenses.unshift(expense);
  return expense;
}

// 7. INVENTORY MOVEMENTS
export async function getInventoryMovements(): Promise<InventoryMovement[]> {
  if (sql) {
    try {
      const rows = await sql.query(`
        SELECT id, variant_id, product_name, variant_name, movement_type, quantity_change, stock_after, reason, created_by, created_at
        FROM inventory_movements
        ORDER BY created_at DESC;
      `);
      if (rows && rows.length > 0) {
        return rows.map((r: any) => ({
          id: String(r.id),
          variant_id: r.variant_id || "",
          product_name: r.product_name,
          variant_name: r.variant_name,
          movement_type: r.movement_type,
          quantity_change: Number(r.quantity_change),
          stock_after: Number(r.stock_after),
          reason: r.reason,
          created_by: r.created_by,
          created_at: new Date(r.created_at).toISOString(),
        }));
      }
    } catch (err) {
      console.error("[STORE] getInventoryMovements db error:", err);
    }
  }
  return [...db.inventoryMovements];
}

// 8. DASHBOARD METRICS & REPORTS
export async function getDashboardMetrics() {
  const todayStr = new Date().toISOString().split("T")[0];

  const todayOrders = db.orders.filter((o) => o.created_at.startsWith(todayStr));
  const todaySalesAmount =
    todayOrders.filter((o) => o.order_status !== "cancelled").reduce((sum, o) => sum + o.total_amount, 0) +
    db.offlineSales.filter((s) => s.created_at.startsWith(todayStr)).reduce((sum, s) => sum + s.total_amount, 0);

  const completedOrders = db.orders.filter((o) => o.order_status === "delivered").length;
  const pendingOrders = db.orders.filter((o) => o.order_status === "pending_confirmation" || o.order_status === "confirmed" || o.order_status === "preparing").length;
  const cancelledOrders = db.orders.filter((o) => o.order_status === "cancelled").length;

  // Low stock products count
  let lowStockCount = 0;
  for (const p of db.products) {
    for (const v of p.variants) {
      if (v.stock_quantity <= v.low_stock_threshold) {
        lowStockCount++;
      }
    }
  }

  const todayExpenses = db.expenses
    .filter((e) => e.expense_date === todayStr)
    .reduce((sum, e) => sum + e.amount, 0);

  const estimatedProfit = todaySalesAmount - todayExpenses;

  return {
    todayOrdersCount: todayOrders.length,
    todaySalesAmount,
    completedOrders,
    pendingOrders,
    cancelledOrders,
    lowStockCount,
    todayExpenses,
    estimatedProfit,
  };
}

// 8. CUSTOMER AUTH & PROFILES
export async function findCustomerByIdentifier(identifier: string): Promise<CustomerAccount | null> {
  const norm = identifier.trim().toLowerCase();
  const cleanPhone = norm.replace(/[^0-9]/g, "");

  if (sql) {
    try {
      const rows = await sql.query(
        `SELECT * FROM customer_accounts 
         WHERE LOWER(email) = $1 
            OR ($2 != '' AND REPLACE(phone, ' ', '') LIKE '%' || $2 || '%')
         LIMIT 1;`,
        [norm, cleanPhone.length >= 10 ? cleanPhone : ""]
      );
      if (rows && rows.length > 0) {
        const r = rows[0] as any;
        return {
          id: String(r.id),
          email: String(r.email),
          phone: String(r.phone),
          password: r.password ? String(r.password) : undefined,
          pin: String(r.pin),
          name: String(r.name),
          delivery_address: String(r.delivery_address),
          locality: String(r.locality),
          landmark: r.landmark ? String(r.landmark) : undefined,
          delivery_instructions: r.delivery_instructions ? String(r.delivery_instructions) : undefined,
          latitude: r.latitude ? Number(r.latitude) : 28.1907,
          longitude: r.longitude ? Number(r.longitude) : 76.1624,
          map_url: r.map_url ? String(r.map_url) : "https://www.google.com/maps?q=28.1907,76.1624",
          created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
        };
      }
    } catch (e) {
      console.warn("Neon DB customer lookup error, falling back to memory:", e);
    }
  }

  const customer = db.customers.find(
    (c) =>
      c.email.toLowerCase() === norm ||
      (cleanPhone.length >= 10 && c.phone.replace(/[^0-9]/g, "") === cleanPhone)
  );
  return customer ? { ...customer } : null;
}

export async function findCustomerByEmail(email: string): Promise<CustomerAccount | null> {
  return findCustomerByIdentifier(email);
}

export async function verifyCustomerLogin(
  identifier: string,
  secret: string // Can be Password OR 6-Digit PIN
): Promise<{ success: boolean; customer?: CustomerAccount; error?: string }> {
  const customer = await findCustomerByIdentifier(identifier);

  if (!customer) {
    return {
      success: false,
      error: "No account found with this email or phone number. Please click Sign Up to create your account.",
    };
  }

  const cleanSecret = secret.trim();
  const pinMatches = Boolean(customer.pin && customer.pin.trim() === cleanSecret);
  const passwordMatches = Boolean(customer.password && customer.password.trim() === cleanSecret);

  if (!pinMatches && !passwordMatches) {
    return {
      success: false,
      error: "Incorrect Password or 6-Digit PIN. Please re-check and try again.",
    };
  }

  return { success: true, customer: { ...customer } };
}

export async function registerCustomer(
  data: Omit<CustomerAccount, "id" | "created_at" | "updated_at">
): Promise<{ success: boolean; customer?: CustomerAccount; error?: string }> {
  const normEmail = data.email.trim().toLowerCase();
  const cleanPhone = data.phone.trim().replace(/[^0-9]/g, "");

  if (sql) {
    try {
      const rows = await sql.query(
        `INSERT INTO customer_accounts (email, phone, password, pin, name, delivery_address, locality, landmark, delivery_instructions, latitude, longitude, map_url, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
         ON CONFLICT (email) DO UPDATE SET 
           phone = EXCLUDED.phone,
           password = COALESCE(EXCLUDED.password, customer_accounts.password),
           pin = EXCLUDED.pin,
           name = EXCLUDED.name,
           delivery_address = EXCLUDED.delivery_address,
           locality = EXCLUDED.locality,
           landmark = EXCLUDED.landmark,
           delivery_instructions = EXCLUDED.delivery_instructions,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           map_url = EXCLUDED.map_url,
           updated_at = NOW()
         RETURNING *;`,
        [
          normEmail,
          cleanPhone,
          data.password ? data.password.trim() : null,
          data.pin.trim(),
          data.name.trim(),
          data.delivery_address.trim(),
          data.locality.trim(),
          data.landmark?.trim() || null,
          data.delivery_instructions?.trim() || null,
          data.latitude || 28.1907,
          data.longitude || 76.1624,
          data.map_url || null,
        ]
      );
      if (rows && rows.length > 0) {
        const r = rows[0] as any;
        const savedCustomer: CustomerAccount = {
          id: String(r.id),
          email: String(r.email),
          phone: String(r.phone),
          password: r.password ? String(r.password) : undefined,
          pin: String(r.pin),
          name: String(r.name),
          delivery_address: String(r.delivery_address),
          locality: String(r.locality),
          landmark: r.landmark ? String(r.landmark) : undefined,
          delivery_instructions: r.delivery_instructions ? String(r.delivery_instructions) : undefined,
          latitude: r.latitude ? Number(r.latitude) : (data.latitude || 28.1907),
          longitude: r.longitude ? Number(r.longitude) : (data.longitude || 76.1624),
          map_url: r.map_url ? String(r.map_url) : (data.map_url || "https://www.google.com/maps?q=28.1907,76.1624"),
          created_at: new Date(r.created_at).toISOString(),
          updated_at: new Date(r.updated_at).toISOString(),
        };
        const idx = db.customers.findIndex((c) => c.email.toLowerCase() === normEmail);
        if (idx >= 0) db.customers[idx] = savedCustomer;
        else db.customers.push(savedCustomer);
        return { success: true, customer: savedCustomer };
      }
    } catch (e) {
      console.warn("Neon DB customer save error, falling back to memory:", e);
    }
  }

  const existing = db.customers.find((c) => c.email.toLowerCase() === normEmail);
  if (existing) {
    if (data.password) existing.password = data.password.trim();
    existing.pin = data.pin.trim();
    existing.name = data.name.trim();
    existing.phone = cleanPhone;
    existing.delivery_address = data.delivery_address.trim();
    existing.locality = data.locality.trim();
    existing.landmark = data.landmark?.trim();
    existing.delivery_instructions = data.delivery_instructions?.trim();
    existing.latitude = data.latitude;
    existing.longitude = data.longitude;
    existing.map_url = data.map_url;
    existing.updated_at = new Date().toISOString();
    return { success: true, customer: { ...existing } };
  }

  const newCustomer: CustomerAccount = {
    id: `cust-${Date.now()}`,
    email: normEmail,
    phone: cleanPhone,
    password: data.password ? data.password.trim() : undefined,
    pin: data.pin.trim(),
    name: data.name.trim(),
    delivery_address: data.delivery_address.trim(),
    locality: data.locality.trim(),
    landmark: data.landmark?.trim(),
    delivery_instructions: data.delivery_instructions?.trim(),
    latitude: data.latitude,
    longitude: data.longitude,
    map_url: data.map_url,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.customers.push(newCustomer);
  return { success: true, customer: { ...newCustomer } };
}

// 9. COUPONS & DISCOUNTS
export async function getCoupons(onlyActive = false): Promise<Coupon[]> {
  if (sql) {
    try {
      const query = onlyActive
        ? `SELECT * FROM coupons WHERE is_active = true ORDER BY created_at DESC;`
        : `SELECT * FROM coupons ORDER BY created_at DESC;`;
      const rows = await sql.query(query);
      if (Array.isArray(rows)) {
        return rows.map((c: any) => ({
          id: String(c.id),
          code: c.code,
          description: c.description || "",
          discount_type: c.discount_type,
          discount_value: Number(c.discount_value),
          min_order_amount: Number(c.min_order_amount || 0),
          max_discount_amount: c.max_discount_amount ? Number(c.max_discount_amount) : undefined,
          free_delivery: Boolean(c.free_delivery || c.discount_type === "free_delivery" || c.code === "FREEDEL"),
          is_active: Boolean(c.is_active),
          created_at: new Date(c.created_at).toISOString(),
        }));
      }
    } catch (err) {
      console.error("[STORE] getCoupons db error:", err);
    }
  }
  if (onlyActive) {
    return db.coupons.filter((c) => c.is_active);
  }
  return [...db.coupons];
}

export async function getCouponByCode(code: string): Promise<Coupon | null> {
  if (!code || typeof code !== "string") return null;
  const norm = code.trim().toUpperCase();
  if (sql) {
    try {
      const rows = await sql.query(`SELECT * FROM coupons WHERE UPPER(code) = $1 LIMIT 1;`, [norm]);
      if (rows && rows.length > 0) {
        const c = rows[0];
        return {
          id: String(c.id),
          code: c.code,
          description: c.description || "",
          discount_type: c.discount_type,
          discount_value: Number(c.discount_value),
          min_order_amount: Number(c.min_order_amount || 0),
          max_discount_amount: c.max_discount_amount ? Number(c.max_discount_amount) : undefined,
          free_delivery: Boolean(c.free_delivery || c.discount_type === "free_delivery" || c.code === "FREEDEL"),
          is_active: Boolean(c.is_active),
          created_at: new Date(c.created_at).toISOString(),
        };
      }
    } catch (err) {
      console.error("[STORE] getCouponByCode db error:", err);
    }
  }
  const c = db.coupons.find((x) => x.code.toUpperCase() === norm);
  return c ? { ...c } : null;
}

export async function createCoupon(data: {
  code: string;
  description: string;
  discount_type: "flat_amount" | "percentage" | "free_delivery";
  discount_value: number;
  min_order_amount: number;
  max_discount_amount?: number;
  free_delivery?: boolean;
  is_active?: boolean;
}): Promise<{ success: boolean; coupon?: Coupon; error?: string }> {
  const normalized = data.code.trim().toUpperCase();
  const existing = await getCouponByCode(normalized);
  if (existing) {
    return { success: false, error: "Coupon code already exists." };
  }

  const id = crypto.randomUUID();
  const isFreeDel = Boolean(data.free_delivery || data.discount_type === "free_delivery" || normalized === "FREEDEL");
  const newCoupon: Coupon = {
    id,
    code: normalized,
    description: data.description.trim(),
    discount_type: data.discount_type,
    discount_value: Number(data.discount_value) || 0,
    min_order_amount: Number(data.min_order_amount) || 0,
    max_discount_amount: data.max_discount_amount ? Number(data.max_discount_amount) : undefined,
    free_delivery: isFreeDel,
    is_active: data.is_active ?? true,
    created_at: new Date().toISOString(),
  };

  if (sql) {
    try {
      await sql.query(`
        INSERT INTO coupons (id, code, description, discount_type, discount_value, min_order_amount, max_discount_amount, free_delivery, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW());
      `, [
        id,
        newCoupon.code,
        newCoupon.description,
        newCoupon.discount_type,
        newCoupon.discount_value,
        newCoupon.min_order_amount,
        newCoupon.max_discount_amount || null,
        newCoupon.free_delivery,
        newCoupon.is_active,
      ]);
    } catch (err: any) {
      console.error("[STORE] createCoupon db error:", err);
      return { success: false, error: err?.message || "Failed to create coupon in database" };
    }
  }

  db.coupons.unshift(newCoupon);
  return { success: true, coupon: newCoupon };
}

export async function updateCoupon(
  id: string,
  updates: Partial<Coupon>
): Promise<{ success: boolean; coupon?: Coupon; error?: string }> {
  if (sql) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUuid) {
        if (updates.code) {
          const norm = updates.code.trim().toUpperCase();
          const dup = await sql.query(`SELECT id FROM coupons WHERE UPPER(code) = $1 AND id <> $2 LIMIT 1;`, [norm, id]);
          if (dup && dup.length > 0) {
            return { success: false, error: "Another coupon with this code already exists." };
          }
        }
        await sql.query(`
          UPDATE coupons SET
            code = COALESCE($1, code),
            description = COALESCE($2, description),
            discount_type = COALESCE($3, discount_type),
            discount_value = COALESCE($4, discount_value),
            min_order_amount = COALESCE($5, min_order_amount),
            max_discount_amount = $6,
            free_delivery = COALESCE($7, free_delivery),
            is_active = COALESCE($8, is_active)
          WHERE id = $9;
        `, [
          updates.code ? updates.code.trim().toUpperCase() : null,
          updates.description !== undefined ? updates.description.trim() : null,
          updates.discount_type || null,
          updates.discount_value !== undefined ? Number(updates.discount_value) : null,
          updates.min_order_amount !== undefined ? Number(updates.min_order_amount) : null,
          updates.max_discount_amount !== undefined ? Number(updates.max_discount_amount) : null,
          updates.free_delivery !== undefined ? updates.free_delivery : null,
          updates.is_active !== undefined ? updates.is_active : null,
          id,
        ]);

        const updated = await sql.query(`SELECT * FROM coupons WHERE id = $1 LIMIT 1;`, [id]);
        if (updated && updated.length > 0) {
          const c = updated[0];
          const mapped: Coupon = {
            id: String(c.id),
            code: c.code,
            description: c.description,
            discount_type: c.discount_type,
            discount_value: Number(c.discount_value),
            min_order_amount: Number(c.min_order_amount),
            max_discount_amount: c.max_discount_amount ? Number(c.max_discount_amount) : undefined,
            free_delivery: Boolean(c.free_delivery || c.discount_type === "free_delivery" || c.code === "FREEDEL"),
            is_active: Boolean(c.is_active),
            created_at: new Date(c.created_at).toISOString(),
          };
          const memIdx = db.coupons.findIndex((cp) => cp.id === id);
          if (memIdx !== -1) db.coupons[memIdx] = mapped;
          return { success: true, coupon: mapped };
        }
      }
    } catch (err: any) {
      console.error("[STORE] updateCoupon db error:", err);
      return { success: false, error: err?.message || "Failed to update coupon in database" };
    }
  }

  const coupon = db.coupons.find((c) => c.id === id);
  if (!coupon) return { success: false, error: "Coupon not found" };

  if (updates.code) {
    const normalized = updates.code.trim().toUpperCase();
    if (db.coupons.some((c) => c.id !== id && c.code.toUpperCase() === normalized)) {
      return { success: false, error: "Another coupon with this code already exists." };
    }
    coupon.code = normalized;
  }
  if (updates.description !== undefined) coupon.description = updates.description.trim();
  if (updates.discount_type !== undefined) coupon.discount_type = updates.discount_type;
  if (updates.discount_value !== undefined) coupon.discount_value = Number(updates.discount_value);
  if (updates.min_order_amount !== undefined) coupon.min_order_amount = Number(updates.min_order_amount);
  if (updates.max_discount_amount !== undefined) coupon.max_discount_amount = Number(updates.max_discount_amount);
  if (updates.free_delivery !== undefined) coupon.free_delivery = updates.free_delivery;
  if (updates.is_active !== undefined) coupon.is_active = updates.is_active;

  return { success: true, coupon: { ...coupon } };
}

export async function deleteCoupon(id: string): Promise<boolean> {
  if (sql) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUuid) {
        await sql.query(`DELETE FROM coupons WHERE id = $1;`, [id]);
      }
    } catch (err) {
      console.error("[STORE] deleteCoupon db error:", err);
    }
  }
  const idx = db.coupons.findIndex((c) => c.id === id);
  if (idx !== -1) {
    db.coupons.splice(idx, 1);
    return true;
  }
  return true;
}

export async function validateAndCalculateCoupon(
  code: string,
  subtotal: number,
  deliveryCharge: number,
  customerEmail?: string,
  customerPhone?: string
): Promise<{
  valid: boolean;
  coupon?: Coupon;
  discountAmount: number;
  finalDeliveryCharge: number;
  message?: string;
}> {
  const coupon = await getCouponByCode(code);
  if (!coupon) {
    return { valid: false, discountAmount: 0, finalDeliveryCharge: deliveryCharge, message: "Invalid coupon code." };
  }
  if (!coupon.is_active) {
    return { valid: false, discountAmount: 0, finalDeliveryCharge: deliveryCharge, message: "This coupon is currently inactive." };
  }
  if (coupon.min_order_amount > 0 && subtotal < coupon.min_order_amount) {
    return {
      valid: false,
      discountAmount: 0,
      finalDeliveryCharge: deliveryCharge,
      message: `Minimum order value of ₹${coupon.min_order_amount} required to use coupon ${coupon.code}.`,
    };
  }

  // ONLY the specific promo code FREEDEL is strictly restricted to new users on their 1st order!
  // Any other free delivery coupon created by admin is fully valid for all customers!
  if (coupon.code.toUpperCase() === "FREEDEL") {
    let isReturning = false;
    const cleanPhone = (customerPhone || "").replace(/[^0-9]/g, "");
    const cleanEmail = (customerEmail || "").trim().toLowerCase();

    if (cleanEmail || cleanPhone) {
      if (sql) {
        try {
          const rows = await sql.query(
            `SELECT count(*)::int as count FROM orders 
             WHERE (customer_email IS NOT NULL AND LOWER(customer_email) = $1)
                OR (customer_phone IS NOT NULL AND customer_phone = $2);`,
            [cleanEmail || "none@empty", cleanPhone || "none"]
          );
          if (rows && rows[0] && rows[0].count > 0) {
            isReturning = true;
          }
        } catch {
          isReturning = db.orders.some(
            (o) =>
              (cleanEmail && o.customer_email?.toLowerCase() === cleanEmail) ||
              (cleanPhone && (o.customer_phone || "").replace(/[^0-9]/g, "") === cleanPhone)
          );
        }
      } else {
        isReturning = db.orders.some(
          (o) =>
            (cleanEmail && o.customer_email?.toLowerCase() === cleanEmail) ||
            (cleanPhone && (o.customer_phone || "").replace(/[^0-9]/g, "") === cleanPhone)
        );
      }
    }

    if (isReturning) {
      return {
        valid: false,
        discountAmount: 0,
        finalDeliveryCharge: deliveryCharge,
        message: "Free delivery coupon (FREEDEL) is valid only for new customers on their 1st order. Standard delivery fee applies for returning customers.",
      };
    }
  }

  const offersFreeDelivery = Boolean(
    coupon.free_delivery || coupon.discount_type === "free_delivery" || coupon.code.toUpperCase() === "FREEDEL"
  );
  let discount = 0;
  let newDeliveryCharge = offersFreeDelivery ? 0 : deliveryCharge;

  // Calculate discount on subtotal if coupon has discount value (nearest integer)
  if (coupon.discount_type === "percentage" && coupon.discount_value > 0) {
    const rawDiscount = (subtotal * coupon.discount_value) / 100;
    const roundedDiscount = Math.round(rawDiscount);
    if (coupon.max_discount_amount && coupon.max_discount_amount > 0) {
      discount = Math.min(Math.round(coupon.max_discount_amount), roundedDiscount);
    } else {
      discount = roundedDiscount;
    }
  } else if (coupon.discount_type === "flat_amount" && coupon.discount_value > 0) {
    discount = Math.min(subtotal, Math.round(coupon.discount_value));
  }

  let successMsg = `Coupon ${coupon.code} applied!`;
  if (offersFreeDelivery && discount > 0) {
    successMsg = `Coupon ${coupon.code} applied: ₹${discount} discount + FREE Delivery!`;
  } else if (offersFreeDelivery) {
    successMsg = `Coupon ${coupon.code} applied: FREE Delivery!`;
  } else if (discount > 0) {
    successMsg = `Coupon ${coupon.code} applied! Saved ₹${discount}.`;
  }

  return {
    valid: true,
    coupon: {
      ...coupon,
      free_delivery: offersFreeDelivery,
    },
    discountAmount: discount,
    finalDeliveryCharge: newDeliveryCharge,
    message: successMsg,
  };
}

// ==========================================
// RIDER FLEET MANAGEMENT (Neon Postgres)
// ==========================================
export async function getRiders(): Promise<Rider[]> {
  if (sql) {
    try {
      const rows = await sql.query(`
        SELECT id, name, phone, email, pin, vehicle_type, vehicle_number, assigned_area, is_active, 
               created_at, updated_at
        FROM riders
        ORDER BY created_at DESC;
      `);
      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email || undefined,
        pin: r.pin,
        vehicle_type: r.vehicle_type || "Motorbike",
        vehicle_number: r.vehicle_number || "",
        assigned_area: r.assigned_area || "",
        is_active: Boolean(r.is_active),
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
    } catch (err) {
      console.error("[STORE] getRiders database query error:", err);
    }
  }
  return [...db.riders];
}

export async function getRiderById(id: string): Promise<Rider | null> {
  if (sql) {
    try {
      const rows = await sql.query(`SELECT * FROM riders WHERE id = $1 LIMIT 1;`, [id]);
      if (rows && rows.length > 0) {
        const r = rows[0];
        return {
          id: r.id,
          name: r.name,
          phone: r.phone,
          email: r.email || undefined,
          pin: r.pin,
          vehicle_type: r.vehicle_type || "Motorbike",
          vehicle_number: r.vehicle_number || "",
          assigned_area: r.assigned_area || "",
          is_active: Boolean(r.is_active),
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      }
    } catch (err) {
      console.error("[STORE] getRiderById error:", err);
    }
  }
  const found = db.riders.find((r) => r.id === id);
  return found ? { ...found } : null;
}

export async function createRider(data: {
  name: string;
  phone: string;
  email?: string;
  pin: string;
  vehicle_type?: string;
  vehicle_number?: string;
  assigned_area?: string;
}): Promise<{ success: boolean; rider?: Rider; error?: string }> {
  const cleanPhone = data.phone.trim().replace(/[^0-9]/g, "");
  const cleanPin = data.pin.trim().replace(/[^0-9]/g, "");
  const cleanEmail = data.email?.trim().toLowerCase() || null;

  if (!data.name.trim()) return { success: false, error: "Rider name is required." };
  if (cleanPhone.length !== 10) return { success: false, error: "Rider mobile number must be exactly 10 digits." };
  if (cleanPin.length !== 6) return { success: false, error: "Rider security PIN must be exactly 6 digits." };

  if (sql) {
    try {
      const rows = await sql.query(
        `INSERT INTO riders (name, phone, email, pin, vehicle_type, vehicle_number, assigned_area, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW())
         RETURNING *;`,
        [
          data.name.trim(),
          cleanPhone,
          cleanEmail,
          cleanPin,
          data.vehicle_type?.trim() || "Motorbike",
          data.vehicle_number?.trim() || "",
          data.assigned_area?.trim() || "Kothal Kalan / Mahendragarh",
        ]
      );
      if (rows && rows.length > 0) {
        const r = rows[0];
        const newRider: Rider = {
          id: r.id,
          name: r.name,
          phone: r.phone,
          email: r.email || undefined,
          pin: r.pin,
          vehicle_type: r.vehicle_type,
          vehicle_number: r.vehicle_number,
          assigned_area: r.assigned_area,
          is_active: Boolean(r.is_active),
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
        db.riders.unshift(newRider);
        return { success: true, rider: newRider };
      }
    } catch (err: any) {
      if (err.message && err.message.includes("unique")) {
        return { success: false, error: "A rider with this mobile number or email already exists." };
      }
      return { success: false, error: err.message || "Failed to create rider in database." };
    }
  }

  const memoryRider: Rider = {
    id: `rider-${Date.now()}`,
    name: data.name.trim(),
    phone: cleanPhone,
    email: cleanEmail || undefined,
    pin: cleanPin,
    vehicle_type: data.vehicle_type?.trim() || "Motorbike",
    vehicle_number: data.vehicle_number?.trim() || "",
    assigned_area: data.assigned_area?.trim() || "Kothal Kalan",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.riders.unshift(memoryRider);
  return { success: true, rider: memoryRider };
}

export async function updateRider(
  id: string,
  updates: Partial<Omit<Rider, "id" | "created_at">>
): Promise<{ success: boolean; rider?: Rider; error?: string }> {
  if (sql) {
    try {
      const existing = await getRiderById(id);
      if (!existing) return { success: false, error: "Rider not found." };

      const name = updates.name !== undefined ? updates.name.trim() : existing.name;
      const phone = updates.phone !== undefined ? updates.phone.trim().replace(/[^0-9]/g, "") : existing.phone;
      const email = updates.email !== undefined ? (updates.email.trim() ? updates.email.trim().toLowerCase() : null) : existing.email || null;
      const pin = updates.pin !== undefined ? updates.pin.trim().replace(/[^0-9]/g, "") : existing.pin;
      const vehicleType = updates.vehicle_type !== undefined ? updates.vehicle_type.trim() : existing.vehicle_type;
      const vehicleNum = updates.vehicle_number !== undefined ? updates.vehicle_number.trim() : existing.vehicle_number;
      const assignedArea = updates.assigned_area !== undefined ? updates.assigned_area.trim() : existing.assigned_area;
      const isActive = updates.is_active !== undefined ? updates.is_active : existing.is_active;

      if (updates.phone !== undefined && phone.length !== 10) {
        return { success: false, error: "Rider mobile number must be exactly 10 digits." };
      }
      if (updates.pin !== undefined && updates.pin.trim() !== "" && pin.length !== 6) {
        return { success: false, error: "Rider security PIN must be exactly 6 digits." };
      }

      const rows = await sql.query(
        `UPDATE riders 
         SET name = $1, phone = $2, email = $3, pin = $4, vehicle_type = $5, vehicle_number = $6, assigned_area = $7, is_active = $8, updated_at = NOW()
         WHERE id = $9
         RETURNING *;`,
        [name, phone, email, pin, vehicleType, vehicleNum, assignedArea, isActive, id]
      );
      if (rows && rows.length > 0) {
        const r = rows[0];
        const updated: Rider = {
          id: r.id,
          name: r.name,
          phone: r.phone,
          email: r.email || undefined,
          pin: r.pin,
          vehicle_type: r.vehicle_type,
          vehicle_number: r.vehicle_number,
          assigned_area: r.assigned_area,
          is_active: Boolean(r.is_active),
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
        const idx = db.riders.findIndex((ri) => ri.id === id);
        if (idx !== -1) db.riders[idx] = updated;
        return { success: true, rider: updated };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to update rider." };
    }
  }

  const idx = db.riders.findIndex((ri) => ri.id === id);
  if (idx !== -1) {
    db.riders[idx] = { ...db.riders[idx], ...updates, updated_at: new Date().toISOString() };
    return { success: true, rider: { ...db.riders[idx] } };
  }
  return { success: false, error: "Rider not found." };
}

export async function deleteRider(id: string): Promise<boolean> {
  if (sql) {
    try {
      await sql.query(`DELETE FROM riders WHERE id = $1;`, [id]);
    } catch (err) {
      console.error("[STORE] deleteRider error:", err);
    }
  }
  const idx = db.riders.findIndex((r) => r.id === id);
  if (idx !== -1) {
    db.riders.splice(idx, 1);
    return true;
  }
  return true;
}

export async function verifyRiderLogin(
  identifier: string,
  pin: string
): Promise<{ success: boolean; rider?: Rider; error?: string }> {
  const cleanId = identifier.trim();
  const cleanPin = pin.trim().replace(/[^0-9]/g, "");

  if (!cleanId || !cleanPin) {
    return { success: false, error: "Please enter your registered rider mobile or name and 6-digit PIN." };
  }
  if (cleanPin.length !== 6) {
    return { success: false, error: "Rider security PIN must be exactly 6 digits." };
  }

  if (sql) {
    try {
      const rows = await sql.query(
        `SELECT * FROM riders 
         WHERE (phone = $1 OR LOWER(name) = LOWER($1) OR LOWER(email) = LOWER($1))
         LIMIT 1;`,
        [cleanId]
      );
      if (rows && rows.length > 0) {
        const r = rows[0];
        if (!r.is_active) {
          return { success: false, error: "This rider account is marked inactive by Admin." };
        }
        if (r.pin && r.pin.trim() === cleanPin) {
          return {
            success: true,
            rider: {
              id: r.id,
              name: r.name,
              phone: r.phone,
              email: r.email || undefined,
              pin: r.pin,
              vehicle_type: r.vehicle_type,
              vehicle_number: r.vehicle_number,
              assigned_area: r.assigned_area,
              is_active: Boolean(r.is_active),
              created_at: r.created_at,
              updated_at: r.updated_at,
            },
          };
        } else {
          return { success: false, error: "Incorrect Rider Security PIN. Please try again." };
        }
      }
    } catch (err) {
      console.error("[STORE] verifyRiderLogin error:", err);
    }
  }

  const memoryFound = db.riders.find(
    (r) =>
      r.phone === cleanId ||
      r.name.toLowerCase() === cleanId.toLowerCase() ||
      (r.email && r.email.toLowerCase() === cleanId.toLowerCase())
  );

  if (memoryFound) {
    if (!memoryFound.is_active) {
      return { success: false, error: "Rider account is inactive." };
    }
    if (memoryFound.pin === cleanPin) {
      return { success: true, rider: { ...memoryFound } };
    }
    return { success: false, error: "Incorrect Rider Security PIN." };
  }

  return { success: false, error: "No rider found matching these credentials. Please contact your store manager." };
}

// ==========================================
// ROLE PROFILE MANAGEMENT
// ==========================================

export async function getAdminProfile(): Promise<AdminProfile> {
  const currentSettings = await getStoreSettings();
  return {
    name: currentSettings.admin_name || "Store Manager",
    email: currentSettings.admin_email || "admin@mithaase.in", // Email is constant / non-changeable
    phone: currentSettings.admin_phone || "0000000000",
    pin: currentSettings.admin_pin || "000000",
    role: "super_admin",
  };
}

export async function updateAdminProfile(data: {
  name: string;
  phone: string;
  pin: string;
}): Promise<{ success: boolean; profile?: AdminProfile; error?: string }> {
  const cleanPhone = data.phone.trim().replace(/[^0-9]/g, "");
  const cleanPin = data.pin.trim().replace(/[^0-9]/g, "");

  if (!data.name.trim()) return { success: false, error: "Admin name cannot be empty." };
  if (cleanPhone.length !== 10) return { success: false, error: "Admin mobile number must be exactly 10 digits." };
  if (cleanPin.length !== 6) return { success: false, error: "Admin Security PIN must be exactly 6 digits." };

  if (sql) {
    try {
      await sql.query(
        `UPDATE store_settings 
         SET admin_name = $1, admin_phone = $2, admin_pin = $3, updated_at = NOW()
         WHERE id = 1;`,
        [data.name.trim(), cleanPhone, cleanPin]
      );
    } catch (err: any) {
      console.error("[STORE] updateAdminProfile error:", err);
    }
  }

  db.settings.admin_name = data.name.trim();
  db.settings.admin_phone = cleanPhone;
  db.settings.admin_pin = cleanPin;

  return {
    success: true,
    profile: {
      name: db.settings.admin_name,
      email: db.settings.admin_email || "admin@mithaase.in",
      phone: db.settings.admin_phone,
      pin: db.settings.admin_pin,
      role: "super_admin",
    },
  };
}

export async function updateCustomerProfile(
  email: string,
  data: {
    name?: string;
    phone?: string;
    password?: string;
    pin?: string;
    delivery_address?: string;
    locality?: string;
    landmark?: string;
    delivery_instructions?: string;
    latitude?: number;
    longitude?: number;
    map_url?: string;
  }
): Promise<{ success: boolean; customer?: CustomerAccount; error?: string }> {
  const normEmail = email.trim().toLowerCase();
  const existing = await findCustomerByEmail(normEmail);

  if (!existing) {
    return { success: false, error: "Customer account not found." };
  }

  const name = data.name !== undefined ? data.name.trim() : existing.name;
  const phone = data.phone !== undefined ? data.phone.trim().replace(/[^0-9]/g, "") : existing.phone;
  const password = data.password !== undefined && data.password.trim() ? data.password.trim() : existing.password;
  const pin = data.pin !== undefined && data.pin.trim() ? data.pin.trim() : existing.pin;
  const delivery_address = data.delivery_address !== undefined ? data.delivery_address.trim() : existing.delivery_address;
  const locality = data.locality !== undefined ? data.locality.trim() : existing.locality;
  const landmark = data.landmark !== undefined ? data.landmark.trim() : existing.landmark;
  const delivery_instructions = data.delivery_instructions !== undefined ? data.delivery_instructions.trim() : existing.delivery_instructions;
  const latitude = data.latitude !== undefined ? Number(data.latitude) : existing.latitude;
  const longitude = data.longitude !== undefined ? Number(data.longitude) : existing.longitude;
  const map_url = data.map_url !== undefined ? data.map_url.trim() : existing.map_url;

  if (sql) {
    try {
      const rows = await sql.query(
        `UPDATE customer_accounts 
         SET name = $1, phone = $2, password = $3, pin = $4, delivery_address = $5, locality = $6, landmark = $7, delivery_instructions = $8, latitude = $9, longitude = $10, map_url = $11, updated_at = NOW()
         WHERE LOWER(email) = $12
         RETURNING *;`,
        [name, phone, password || null, pin, delivery_address, locality, landmark || null, delivery_instructions || null, latitude, longitude, map_url || null, normEmail]
      );
      if (rows && rows.length > 0) {
        const r = rows[0];
        const updatedCustomer: CustomerAccount = {
          id: r.id,
          email: r.email,
          phone: r.phone,
          password: r.password || undefined,
          pin: r.pin,
          name: r.name,
          delivery_address: r.delivery_address,
          locality: r.locality,
          landmark: r.landmark || undefined,
          delivery_instructions: r.delivery_instructions || undefined,
          latitude: Number(r.latitude) || 28.1907,
          longitude: Number(r.longitude) || 76.1624,
          map_url: r.map_url || "",
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
        const idx = db.customers.findIndex((c) => c.email.toLowerCase() === normEmail);
        if (idx !== -1) db.customers[idx] = updatedCustomer;
        return { success: true, customer: updatedCustomer };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to update profile." };
    }
  }

  const idx = db.customers.findIndex((c) => c.email.toLowerCase() === normEmail);
  if (idx !== -1) {
    db.customers[idx] = {
      ...db.customers[idx],
      name,
      phone,
      password,
      pin,
      delivery_address,
      locality,
      landmark,
      delivery_instructions,
      latitude,
      longitude,
      map_url,
      updated_at: new Date().toISOString(),
    };
    return { success: true, customer: { ...db.customers[idx] } };
  }

  return { success: false, error: "Customer not found." };
}

