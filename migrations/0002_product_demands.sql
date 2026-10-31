-- Migration: 0002_product_demands.sql
-- Description: Creates table to track customer special batch demands for out-of-stock sweets.
-- Enables community batch thresholds (e.g. 10+ kg) and automated WhatsApp alerts to Admin & Customers.

CREATE TABLE IF NOT EXISTS product_demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  variant_name VARCHAR(100),
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_email VARCHAR(255),
  quantity_kg NUMERIC(6, 2) NOT NULL DEFAULT 1.0,
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'batch_scheduled', 'fulfilled_notified', 'cancelled'
  admin_alert_sent BOOLEAN NOT NULL DEFAULT false,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_demands_prod_status ON product_demands (product_id, status);
CREATE INDEX IF NOT EXISTS idx_product_demands_phone ON product_demands (customer_phone);
CREATE INDEX IF NOT EXISTS idx_product_demands_created_at ON product_demands (created_at DESC);

