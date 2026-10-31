-- Migration: 0003_order_cancel_otps.sql
-- Description: Stores WhatsApp OTPs for secure customer self-cancellation of Cash on Delivery (COD) orders.

CREATE TABLE IF NOT EXISTS order_cancel_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_cancel_otps_order ON order_cancel_otps (order_id, phone);
CREATE INDEX IF NOT EXISTS idx_order_cancel_otps_expires ON order_cancel_otps (expires_at);

