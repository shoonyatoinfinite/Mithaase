import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const match = envFile.match(/(?:DATABASE_URL|DATABASE_URL_UNPOOLED)\s*=\s*["']?([^"'\r\n]+)["']?/);
const sql = neon(match[1]);

async function cleanup() {
  await sql.query(`DELETE FROM customer_accounts WHERE email LIKE 'testuser_%';`);
  console.log("✓ Cleaned up test customers");
}

cleanup().catch(console.error);
