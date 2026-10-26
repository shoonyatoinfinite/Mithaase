-- Migration 007: Widen phone and purpose columns on phone_verifications to support Email OTP & WhatsApp OTP
ALTER TABLE phone_verifications 
  ALTER COLUMN phone TYPE VARCHAR(255),
  ALTER COLUMN purpose TYPE VARCHAR(50);
