-- ==============================================================================
-- SHREE SHYAM SWEETS (MITHAASÉ) - POSTGRESQL SCHEMA FOR SUPABASE
-- Production-ready schema with referential integrity, indexes, and RLS
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 3. PRODUCT VARIANTS TABLE
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_name VARCHAR(100) NOT NULL, -- e.g. '250g', '500g', '1kg'
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

-- 4. STORE SETTINGS TABLE (Single row configuration)
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

-- 5. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) NOT NULL UNIQUE,
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  delivery_address TEXT NOT NULL,
  locality VARCHAR(120) NOT NULL,
  landmark VARCHAR(150),
  delivery_instructions TEXT,
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  delivery_charge NUMERIC(10, 2) NOT NULL DEFAULT 21.00 CHECK (delivery_charge >= 0),
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cod', 'upi')),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  order_status VARCHAR(30) NOT NULL DEFAULT 'pending_confirmation' CHECK (order_status IN ('pending_confirmation', 'confirmed', 'preparing', 'ready_for_dispatch', 'out_for_delivery', 'delivered', 'cancelled')),
  upi_reference VARCHAR(100),
  source VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (source IN ('online', 'manual')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ORDER ITEMS TABLE (Immutable historical snapshot)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
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

-- 7. ORDER STATUS HISTORY TABLE
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_status VARCHAR(30) NOT NULL,
  new_status VARCHAR(30) NOT NULL,
  changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. OFFLINE SALES (Counter Transactions)
CREATE TABLE IF NOT EXISTS offline_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 9. OFFLINE SALE ITEMS
CREATE TABLE IF NOT EXISTS offline_sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offline_sale_id UUID NOT NULL REFERENCES offline_sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name_snapshot VARCHAR(200) NOT NULL,
  variant_name_snapshot VARCHAR(100) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(10, 2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. INVENTORY MOVEMENTS TABLE
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  product_name VARCHAR(200) NOT NULL,
  variant_name VARCHAR(100) NOT NULL,
  movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('addition', 'reduction', 'correction', 'wastage', 'order_reservation', 'order_cancellation', 'sale')),
  quantity_change INT NOT NULL,
  stock_after INT NOT NULL,
  reason TEXT NOT NULL,
  related_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  related_sale_id UUID REFERENCES offline_sales(id) ON DELETE SET NULL,
  created_by VARCHAR(100) DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 12. PAYMENTS AUDIT TABLE
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL DEFAULT 'upi_direct',
  provider_payment_id VARCHAR(100),
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(30) NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_variant ON inventory_movements(variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_offline_sales_created ON offline_sales(created_at DESC);

-- INSERT INITIAL STORE SETTINGS ROW
INSERT INTO store_settings (id, default_delivery_fee)
VALUES (1, 21.00)
ON CONFLICT (id) DO NOTHING;
