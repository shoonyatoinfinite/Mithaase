import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const envVars = Object.fromEntries(
  envFile
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      const k = l.slice(0, idx).trim();
      let v = l.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return [k, v];
    })
);

const dbUrl = envVars.DATABASE_URL_UNPOOLED || envVars.DATABASE_URL;
const sql = neon(dbUrl);

async function main() {
  console.log("Setting up Neon Postgres schema...");
  
  // Create tables using standard Postgres
  await sql.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL UNIQUE,
      slug VARCHAR(120) NOT NULL UNIQUE,
      description TEXT,
      display_order INT DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✓ categories table ready");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      slug VARCHAR(220) NOT NULL UNIQUE,
      description TEXT NOT NULL,
      category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      image_url TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      is_featured BOOLEAN DEFAULT FALSE,
      badge VARCHAR(60),
      is_seasonal_special BOOLEAN DEFAULT FALSE,
      special_start_date TIMESTAMPTZ,
      special_end_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✓ products table ready");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS product_variants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      variant_name VARCHAR(100) NOT NULL,
      unit VARCHAR(50) NOT NULL,
      price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
      stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      reserved_quantity INT NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
      low_stock_threshold INT NOT NULL DEFAULT 5,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (product_id, variant_name)
    );
  `);
  console.log("✓ product_variants table ready");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS store_settings (
      id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      store_name VARCHAR(150) NOT NULL DEFAULT 'Shree Shyam Sweets',
      brand_tagline VARCHAR(255) NOT NULL DEFAULT 'Festive Diwali Sweets & Delicacies',
      store_status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (store_status IN ('open', 'paused', 'closed')),
      accepts_orders BOOLEAN NOT NULL DEFAULT TRUE,
      default_delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 21.00,
      minimum_order_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
      same_day_delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      operating_hours VARCHAR(100) DEFAULT '8:00 AM - 10:00 PM',
      cutoff_time VARCHAR(20) DEFAULT '20:00',
      service_areas JSONB DEFAULT '["Main Market", "Shyam Nagar", "Ram Mandir Ward", "Station Road", "Civil Lines", "Green Park"]'::jsonb,
      business_phone VARCHAR(20) DEFAULT '+91 9876543210',
      whatsapp_number VARCHAR(20) DEFAULT '+91 9876543210',
      shop_address TEXT DEFAULT 'Main Bazar, Shree Shyam Chowk, Opposite Ram Mandir',
      announcement_message TEXT DEFAULT 'Celebrate Diwali with Shree Shyam Sweets — Fresh Handcrafted Festive Mithai!',
      closure_message TEXT DEFAULT 'Store is temporarily closed for Diwali preparations. We will reopen shortly!',
      upi_id VARCHAR(100) DEFAULT 'shreeshyam@upi',
      upi_payee_name VARCHAR(150) DEFAULT 'Shree Shyam Sweets',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✓ store_settings table ready");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(100) PRIMARY KEY,
      order_number VARCHAR(50) NOT NULL UNIQUE,
      customer_name VARCHAR(150) NOT NULL,
      customer_email VARCHAR(255),
      customer_phone VARCHAR(20) NOT NULL,
      delivery_address TEXT NOT NULL,
      locality VARCHAR(120) NOT NULL,
      landmark VARCHAR(150),
      delivery_instructions TEXT,
      subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
      discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
      delivery_charge NUMERIC(10, 2) NOT NULL DEFAULT 21.00 CHECK (delivery_charge >= 0),
      total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
      coupon_code VARCHAR(50),
      payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cod', 'upi')),
      payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
      order_status VARCHAR(30) NOT NULL DEFAULT 'pending_confirmation' CHECK (order_status IN ('pending_confirmation', 'confirmed', 'preparing', 'ready_for_dispatch', 'out_for_delivery', 'delivered', 'cancelled')),
      upi_reference VARCHAR(100),
      upi_screenshot TEXT,
      delivery_proof_photo TEXT,
      pickup_photo TEXT,
      latitude NUMERIC(10, 6),
      longitude NUMERIC(10, 6),
      map_url TEXT,
      source VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (source IN ('online', 'manual')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await sql.query(`
    ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS delivery_queued BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS delivery_group_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS delivered_lat NUMERIC(10, 6),
      ADD COLUMN IF NOT EXISTS delivered_lng NUMERIC(10, 6),
      ADD COLUMN IF NOT EXISTS delivered_location_name VARCHAR(150),
      ADD COLUMN IF NOT EXISTS delivered_map_url TEXT,
      ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
      ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10, 2),
      ADD COLUMN IF NOT EXISTS refund_txn_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS refund_screenshot TEXT,
      ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS booking_status TEXT DEFAULT 'standard';
  `);
  console.log("✓ orders table ready");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id VARCHAR(100) PRIMARY KEY,
      order_id VARCHAR(100) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id UUID REFERENCES products(id) ON DELETE SET NULL,
      variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
      product_name_snapshot VARCHAR(200) NOT NULL,
      variant_name_snapshot VARCHAR(100) NOT NULL,
      quantity INT NOT NULL CHECK (quantity > 0),
      unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
      line_total NUMERIC(10, 2) NOT NULL CHECK (line_total >= 0),
      image_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✓ order_items table ready");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS order_status_history (
      id VARCHAR(100) PRIMARY KEY,
      order_id VARCHAR(100) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      previous_status VARCHAR(30) NOT NULL,
      new_status VARCHAR(30) NOT NULL,
      changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✓ order_status_history table ready");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS offline_sales (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sale_number VARCHAR(50) NOT NULL UNIQUE,
      subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
      discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
      total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
      payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'upi')),
      customer_name VARCHAR(150),
      customer_phone VARCHAR(20),
      created_by VARCHAR(100) DEFAULT 'admin',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✓ offline_sales table ready");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      product_name VARCHAR(200) NOT NULL,
      variant_name VARCHAR(100) NOT NULL,
      movement_type VARCHAR(30) NOT NULL,
      quantity_change INT NOT NULL,
      stock_after INT NOT NULL,
      reason TEXT NOT NULL,
      related_order_id VARCHAR(100) REFERENCES orders(id) ON DELETE SET NULL,
      related_sale_id UUID REFERENCES offline_sales(id) ON DELETE SET NULL,
      created_by VARCHAR(100) DEFAULT 'system',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✓ inventory_movements table ready");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(200) NOT NULL,
      category VARCHAR(100) NOT NULL,
      amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
      payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'upi')),
      expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
      description TEXT,
      receipt_url TEXT,
      created_by VARCHAR(100) DEFAULT 'admin',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✓ expenses table ready");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS coupons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(50) NOT NULL UNIQUE,
      description TEXT,
      discount_type VARCHAR(30) NOT NULL CHECK (discount_type IN ('flat_amount', 'percentage', 'free_delivery')),
      discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
      min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
      max_discount_amount NUMERIC(10, 2),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✓ coupons table ready");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS customer_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(20) NOT NULL,
      password TEXT,
      pin VARCHAR(20),
      name VARCHAR(150) NOT NULL,
      delivery_address TEXT NOT NULL,
      locality VARCHAR(120) NOT NULL,
      landmark VARCHAR(150),
      delivery_instructions TEXT,
      latitude NUMERIC(10, 6),
      longitude NUMERIC(10, 6),
      map_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await sql.query(`
    ALTER TABLE customer_accounts
      ADD COLUMN IF NOT EXISTS password TEXT;
  `);
  console.log("✓ customer_accounts table ready");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mime_type VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
      file_name VARCHAR(255),
      size_bytes INT NOT NULL DEFAULT 0,
      data_base64 TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await sql.query(`
    CREATE INDEX IF NOT EXISTS idx_media_assets_created ON media_assets(created_at DESC);
  `);
  console.log("✓ media_assets table ready (Neon Object Storage)");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS riders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(150) NOT NULL,
      phone VARCHAR(20) NOT NULL UNIQUE,
      email VARCHAR(255),
      pin VARCHAR(20) NOT NULL,
      vehicle_type VARCHAR(50) DEFAULT 'Motorbike',
      vehicle_number VARCHAR(50) DEFAULT '',
      assigned_area VARCHAR(150) DEFAULT 'Kothal Kalan / Mahendragarh',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await sql.query(`CREATE INDEX IF NOT EXISTS idx_riders_phone ON riders(phone);`);
  await sql.query(`CREATE INDEX IF NOT EXISTS idx_riders_is_active ON riders(is_active);`);
  console.log("✓ riders table ready");

  // Insert default settings
  await sql.query(`
    INSERT INTO store_settings (id, default_delivery_fee)
    VALUES (1, 21.00)
    ON CONFLICT (id) DO NOTHING;
  `);

  const tables = await sql.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log("\nTables verified in Neon Postgres:", tables.map((t) => t.table_name));
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
