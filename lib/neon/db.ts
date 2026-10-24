import { neon } from "@neondatabase/serverless";

let cachedSql: any = null;

export function getDatabaseClient() {
  if (cachedSql) return cachedSql;
  let url = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || "";
  if (!url) {
    try {
      const fs = require("fs");
      const path = require("path");
      const envPath = path.join(process.cwd(), ".env.local");
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf8");
        const match = envContent.match(/(?:DATABASE_URL|DATABASE_URL_UNPOOLED)\s*=\s*["']?([^"'\r\n]+)["']?/);
        if (match && match[1]) {
          url = match[1].trim();
        }
      }
    } catch {}
  }
  if (!url) return null;
  cachedSql = neon(url);
  return cachedSql;
}

// Proxied sql instance that lazily initializes using process.env.DATABASE_URL
export const sql: any = new Proxy(
  function (...args: any[]) {
    const client = getDatabaseClient();
    if (!client) throw new Error("Neon Database is not configured");
    return (client as any)(...args);
  },
  {
    get(_target, prop) {
      const client = getDatabaseClient();
      if (!client) return undefined;
      if (prop === "query" && typeof (client as any).query === "function") {
        return (client as any).query.bind(client);
      }
      const value = (client as any)[prop];
      if (typeof value === "function") {
        return value.bind(client);
      }
      return value;
    },
  }
);

export const isNeonDbConfigured = Boolean(
  process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED
);
