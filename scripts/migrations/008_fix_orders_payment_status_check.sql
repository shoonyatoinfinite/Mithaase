-- Migration: Fix orders_payment_status_check to include pending_verification
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check 
  CHECK (payment_status IN ('unpaid', 'pending', 'pending_verification', 'paid', 'failed', 'refunded'));
