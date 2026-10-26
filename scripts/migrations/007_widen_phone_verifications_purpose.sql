-- Migration 007: Widen phone_verifications table columns and expand purpose check constraint
-- Supports email addresses in phone column (up to 255 chars) and forgot_pin purposes

ALTER TABLE phone_verifications ALTER COLUMN phone TYPE VARCHAR(255);
ALTER TABLE phone_verifications ALTER COLUMN purpose TYPE VARCHAR(50);

ALTER TABLE phone_verifications DROP CONSTRAINT IF EXISTS phone_verifications_purpose_check;

ALTER TABLE phone_verifications ADD CONSTRAINT phone_verifications_purpose_check 
  CHECK (purpose IN ('signup', 'change', 'checkout', 'login', 'forgot_pin_email', 'forgot_pin'));
