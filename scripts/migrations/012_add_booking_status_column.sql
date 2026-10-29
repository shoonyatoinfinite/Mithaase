-- Migration 012: Ensure booking_status column exists on orders table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS booking_status TEXT DEFAULT 'standard';

