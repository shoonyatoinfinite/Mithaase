-- Migration 001: Customer Accounts Hardening
-- Purpose: Normalize phone numbers, enforce 10-digit uniqueness, unique lowercase email index, and add credential/verification fields.

-- 1. Normalize existing phones to the last 10 digits
UPDATE customer_accounts 
SET phone = RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10)
WHERE LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 10;

-- 2. Add columns if not already present
ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS auth_user_id VARCHAR(100) UNIQUE DEFAULT NULL;

-- 3. Enforce valid Indian mobile number format: 10 digits starting with 6, 7, 8, or 9
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_customer_accounts_phone_format'
  ) THEN
    ALTER TABLE customer_accounts 
      ADD CONSTRAINT chk_customer_accounts_phone_format 
      CHECK (phone ~ '^[6-9][0-9]{9}$');
  END IF;
END $$;

-- 4. Enforce unique phone constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_customer_accounts_phone'
  ) THEN
    ALTER TABLE customer_accounts 
      ADD CONSTRAINT uq_customer_accounts_phone 
      UNIQUE (phone);
  END IF;
END $$;

-- 5. Enforce unique lowercase email index
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_accounts_lower_email 
  ON customer_accounts(LOWER(email));
