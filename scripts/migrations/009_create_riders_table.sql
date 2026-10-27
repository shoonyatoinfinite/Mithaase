-- Migration 009: Create riders table for delivery fleet management
CREATE TABLE IF NOT EXISTS riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255),
  pin VARCHAR(20) NOT NULL,
  vehicle_type VARCHAR(50) DEFAULT 'Motorbike',
  vehicle_number VARCHAR(50) DEFAULT '',
  assigned_area VARCHAR(150) DEFAULT 'Kothal Kalan / Mahendragarh',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_riders_phone ON riders(phone);
CREATE INDEX IF NOT EXISTS idx_riders_is_active ON riders(is_active);
