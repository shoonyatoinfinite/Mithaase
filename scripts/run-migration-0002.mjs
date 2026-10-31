import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const match = envFile.match(/(?:DATABASE_URL|DATABASE_URL_UNPOOLED)\s*=\s*["']?([^"'\r\n]+)["']?/);
if (!match) {
  console.error("No DATABASE_URL found");
  process.exit(1);
}

const sql = neon(match[1]);

async function run() {
  console.log("Applying Migration 0002_product_demands.sql...");
  
  await sql.query(`
    CREATE TABLE IF NOT EXISTS product_demands (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id VARCHAR(100) NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      variant_name VARCHAR(100),
      customer_name VARCHAR(150) NOT NULL,
      customer_phone VARCHAR(20) NOT NULL,
      customer_email VARCHAR(255),
      quantity_kg NUMERIC(6, 2) NOT NULL DEFAULT 1.0,
      notes TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      admin_alert_sent BOOLEAN NOT NULL DEFAULT false,
      notified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✓ Table product_demands created or verified");

  await sql.query(`
    CREATE INDEX IF NOT EXISTS idx_product_demands_prod_status ON product_demands (product_id, status);
  `);
  await sql.query(`
    CREATE INDEX IF NOT EXISTS idx_product_demands_phone ON product_demands (customer_phone);
  `);
  await sql.query(`
    CREATE INDEX IF NOT EXISTS idx_product_demands_created_at ON product_demands (created_at DESC);
  `);
  console.log("✓ Indexes created successfully!");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
