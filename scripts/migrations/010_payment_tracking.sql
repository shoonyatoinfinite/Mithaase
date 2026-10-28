-- Migration 010: Payment Tracking & Audit Log
-- Purpose: Adds order_ref to orders, creates payments & payment_events tables, and backfills orders safely.

-- 1. Ensure columns exist on orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_ref text UNIQUE,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';

-- Ensure constraint allows valid statuses including pending_verification
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_payment_status_check;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_payment_status_valid'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT chk_orders_payment_status_valid;
  END IF;
  ALTER TABLE orders
    ADD CONSTRAINT chk_orders_payment_status_valid
    CHECK (payment_status IN ('unpaid', 'pending', 'pending_verification', 'paid', 'failed', 'refunded'));
END $$;

-- 2. Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          text NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  attempt_no        int  NOT NULL,
  attempt_ref       text NOT NULL UNIQUE,
  amount_expected   numeric(10,2) NOT NULL,
  amount_received   numeric(10,2),
  payee_vpa         text,
  method            text NOT NULL CHECK (method IN ('qr','intent','manual')),
  app_clicked       text,
  youpi_payment_id  text UNIQUE,
  youpi_order_ref   text,
  upi_txn_ref       text UNIQUE,
  payer_vpa_masked  text,
  status            text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','launched','pending','verified','failed','expired','mismatch')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  launched_at       timestamptz,
  verified_at       timestamptz,
  expires_at        timestamptz,
  UNIQUE (order_id, attempt_no)
);
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments(order_id);

-- 3. Create payment_events table
CREATE TABLE IF NOT EXISTS payment_events (
  id          bigserial PRIMARY KEY,
  payment_id  uuid REFERENCES payments(id),
  order_id    text REFERENCES orders(id),
  source      text NOT NULL,
  event       text NOT NULL,
  payload     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_events_order_idx ON payment_events(order_id);

-- 4. BACKFILL DATA (Safe & Re-runnable)
UPDATE orders
SET payment_status = CASE
  WHEN payment_status IN ('paid', 'pending', 'pending_verification', 'failed', 'refunded') THEN payment_status
  WHEN order_status IN ('confirmed', 'preparing', 'ready_for_dispatch', 'out_for_delivery', 'delivered') AND (payment_method = 'upi' AND upi_reference IS NOT NULL) THEN 'paid'
  ELSE 'unpaid'
END
WHERE payment_status IS NULL;

UPDATE orders
SET order_ref = 'MTH-' || to_char(created_at, 'YYYYMMDD') || '-' || upper(substr(md5(id::text || COALESCE(order_number, '')), 1, 6))
WHERE order_ref IS NULL;

