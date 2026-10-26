-- Migration 005: Drop NOT NULL constraint on legacy pin and password columns in customer_accounts
-- Modern auth relies on bcrypt pin_hash and never stores plaintext credentials.

ALTER TABLE customer_accounts ALTER COLUMN pin DROP NOT NULL;
ALTER TABLE customer_accounts ALTER COLUMN password DROP NOT NULL;
