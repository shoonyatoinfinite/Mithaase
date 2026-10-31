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
  console.log("Applying Migration 0003_order_cancel_otps.sql...");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS order_cancel_otps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id VARCHAR(100) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      used BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✓ Table order_cancel_otps verified/created");

  await sql.query(`
    CREATE INDEX IF NOT EXISTS idx_order_cancel_otps_order ON order_cancel_otps (order_id, phone);
  `);
  await sql.query(`
    CREATE INDEX IF NOT EXISTS idx_order_cancel_otps_expires ON order_cancel_otps (expires_at);
  `);
  console.log("✓ Migration 0003 completed successfully!");
}

run().catch((err) => {
  console.error("Migration 0003 failed:", err);
  process.exit(1);
});

