-- Migration 002: Phone Verifications & Server-Side Rate Limits
-- Purpose: Persist OTP verification challenges and brute-force rate limits in Neon PostgreSQL.

-- 1. Create phone_verifications table
CREATE TABLE IF NOT EXISTS phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(10) NOT NULL,
  purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('signup', 'change', 'checkout', 'login')),
  user_id UUID REFERENCES customer_accounts(id) ON DELETE SET NULL,
  otp_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ DEFAULT NULL,
  ip VARCHAR(45) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_verif_active 
  ON phone_verifications(phone, purpose, consumed_at, expires_at);

-- 2. Create auth_rate_limits table
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(150) NOT NULL,
  action VARCHAR(50) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  attempts INT NOT NULL DEFAULT 1,
  locked_until TIMESTAMPTZ DEFAULT NULL,
  last_attempt TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_lookup 
  ON auth_rate_limits(identifier, action, ip);
