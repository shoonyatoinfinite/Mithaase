-- Migration: Optional SMS Phone Verification on customer_accounts
-- Description: Adds phone_verified boolean, replaces full unique index with partial unique index,
-- updates phone check constraint to +91XXXXXXXXXX format, and creates phone_otps table.

-- 1. Ensure phone_verified_at and phone_verified exist
ALTER TABLE customer_accounts 
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

ALTER TABLE customer_accounts 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false;

-- 2. Drop old phone check constraint if it strictly required 10 digits without +91
ALTER TABLE customer_accounts 
DROP CONSTRAINT IF EXISTS chk_customer_accounts_phone_format;

-- 3. Normalise existing phone numbers in customer_accounts to +91XXXXXXXXXX
UPDATE customer_accounts 
SET phone = '+91' || RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10)
WHERE phone IS NOT NULL 
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 10
  AND phone NOT LIKE '+91%';

-- 4. Add updated check constraint enforcing +91XXXXXXXXXX format
ALTER TABLE customer_accounts 
ADD CONSTRAINT chk_customer_accounts_phone_format 
CHECK ((phone)::text ~ '^\+91[6-9][0-9]{9}$');

-- 5. Drop full unique phone constraint / index and create partial unique index
ALTER TABLE customer_accounts 
DROP CONSTRAINT IF EXISTS uq_customer_accounts_phone;

DROP INDEX IF EXISTS uq_customer_accounts_phone;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_accounts_phone_verified 
ON customer_accounts (phone) 
WHERE phone_verified = true;

-- 6. Create phone_otps table with ip column for database-backed rate limiting
CREATE TABLE IF NOT EXISTS phone_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  otp_hash TEXT NOT NULL,
  ip VARCHAR(45) NOT NULL DEFAULT 'unknown',
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_otps_user_phone ON phone_otps (user_id, phone);
CREATE INDEX IF NOT EXISTS idx_phone_otps_expires ON phone_otps (expires_at);
CREATE INDEX IF NOT EXISTS idx_phone_otps_ip ON phone_otps (ip, created_at);
