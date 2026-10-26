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
  console.log("Adding password column to customer_accounts if not exists...");
  await sql.query(`
    ALTER TABLE customer_accounts 
    ADD COLUMN IF NOT EXISTS password TEXT;
  `);
  console.log("✓ Added password column to customer_accounts");

  const cols = await sql.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'customer_accounts'
    ORDER BY ordinal_position;
  `);
  console.log("Updated customer_accounts columns:", cols.map(c => c.column_name));
}

migrate().catch(console.error);
