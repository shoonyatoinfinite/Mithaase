-- Migration 004: Catalog Versioning & Non-Negative Stock Constraints
-- Purpose: Persist catalog_version in store_settings and enforce non-negative stock invariants.

-- 1. Store catalog_version in the database
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS catalog_version BIGINT DEFAULT 1;

-- 2. Non-negative stock constraints on product_variants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_variants_non_negative_stock'
  ) THEN
    ALTER TABLE product_variants 
      ADD CONSTRAINT chk_variants_non_negative_stock 
      CHECK (stock_quantity >= 0 AND reserved_quantity >= 0);
  END IF;
END $$;
