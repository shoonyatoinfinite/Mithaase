-- Migration 006: Add store_shutoff and shutoff_message columns to store_settings
ALTER TABLE store_settings 
  ADD COLUMN IF NOT EXISTS store_shutoff BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shutoff_message TEXT DEFAULT NULL;
