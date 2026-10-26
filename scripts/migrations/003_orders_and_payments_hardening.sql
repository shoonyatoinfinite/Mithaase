-- Migration 003: Orders and Payments Hardening
-- Purpose: Add partial unique UPI index, idempotency keys, gateway IDs, and status check constraints.

-- 1. Add idempotency and gateway transaction tracking columns
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100) UNIQUE,
  ADD COLUMN IF NOT EXISTS gateway_transaction_id VARCHAR(100) UNIQUE;

-- 2. Partial unique index on non-empty normalized UPI reference (anti-replay attack)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_unique_upi_ref 
  ON orders (TRIM(UPPER(upi_reference))) 
  WHERE upi_reference IS NOT NULL AND TRIM(upi_reference) <> '';

-- 3. Enforce valid payment_status constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_payment_status_valid'
  ) THEN
    ALTER TABLE orders 
      ADD CONSTRAINT chk_orders_payment_status_valid 
      CHECK (payment_status IN ('unpaid', 'pending_verification', 'paid', 'failed', 'refunded'));
  END IF;
END $$;

-- 4. Enforce valid order_status constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_order_status_valid'
  ) THEN
    ALTER TABLE orders 
      ADD CONSTRAINT chk_orders_order_status_valid 
      CHECK (order_status IN (
        'pending_confirmation',
        'confirmed',
        'preparing',
        'ready_for_dispatch',
        'out_for_delivery',
        'delivered',
        'cancelled'
      ));
  END IF;
END $$;
