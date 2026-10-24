import { neon } from "@neondatabase/serverless";

let cachedSql: any = null;

export function getDatabaseClient() {
  if (cachedSql) return cachedSql;
  const url = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || "";
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
