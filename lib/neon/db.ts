import { neon, Pool, PoolClient } from "@neondatabase/serverless";

let cachedSql: any = null;
let cachedPool: Pool | null = null;

function resolveDatabaseUrl(): string {
  let url = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || "";
  if (!url && typeof window === "undefined") {
    try {
      const nodeRequire = eval("require");
      const fs = nodeRequire("fs");
      const path = nodeRequire("path");
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
  return url;
}

export function getDatabaseClient() {
  if (cachedSql) return cachedSql;
  const url = resolveDatabaseUrl();
  if (!url) return null;
  cachedSql = neon(url);
  return cachedSql;
}

export function getDatabasePool(): Pool | null {
  if (cachedPool) return cachedPool;
  const url = resolveDatabaseUrl();
  if (!url) return null;
  cachedPool = new Pool({ connectionString: url });
  return cachedPool;
}

/**
 * Executes operations inside an ACID transaction with automatic BEGIN, COMMIT, and ROLLBACK.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getDatabasePool();
  if (!pool) throw new Error("Neon Database is not configured");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
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
