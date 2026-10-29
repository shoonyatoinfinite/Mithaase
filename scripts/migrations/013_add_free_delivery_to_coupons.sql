-- Migration 013: Add free_delivery column to coupons table
ALTER TABLE coupons 
  ADD COLUMN IF NOT EXISTS free_delivery BOOLEAN DEFAULT FALSE;
