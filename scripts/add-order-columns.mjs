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

async function migrate() {
  console.log("Adding missing columns to orders and customer_accounts in Neon...");

  await sql.query(`
    ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
  `);
  console.log("✓ Added cancelled_at and refunded_at to orders");

  await sql.query(`
    ALTER TABLE customer_accounts
      ADD COLUMN IF NOT EXISTS password TEXT;
  `);
  console.log("✓ Verified password column in customer_accounts");

  const orderCols = await sql.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'orders'
    ORDER BY ordinal_position;
  `);
  console.log("Updated orders columns:", orderCols.map(c => c.column_name));
}

migrate().catch(console.error);
