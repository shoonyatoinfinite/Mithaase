-- Migration 011: One-Customer-at-a-Time Payment Queue & WhatsApp Tracking
-- Purpose: Adds queue states to orders table, queue indexes, and payment status widening.

-- 1. Add queue columns to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS queue_status text NOT NULL DEFAULT 'none'
    CHECK (queue_status IN ('none', 'queued', 'active', 'paid', 'expired', 'cancelled')),
  ADD COLUMN IF NOT EXISTS queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS queue_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS queue_last_heartbeat_at timestamptz;

-- 2. Performance indexes for queue operations
CREATE INDEX IF NOT EXISTS idx_orders_queue_lookup 
  ON orders (queue_status, queued_at) 
  WHERE queue_status IN ('queued', 'active');

CREATE INDEX IF NOT EXISTS idx_orders_phone_queue
  ON orders (customer_phone, queue_status)
  WHERE queue_status IN ('queued', 'active');

-- 3. Widen payments table status constraint to allow manual_review and received_expired
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_status_check'
  ) THEN
    ALTER TABLE payments DROP CONSTRAINT payments_status_check;
  END IF;
  ALTER TABLE payments
    ADD CONSTRAINT payments_status_check
    CHECK (status IN ('created','launched','pending','verified','failed','expired','mismatch','manual_review','received_expired'));
END $$;

