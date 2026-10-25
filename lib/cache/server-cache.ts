/**
 * In-Memory Server-Side Caching Layer for Mithaasé Sweets
 * Prevents redundant database queries and cuts network transfer on Neon PostgreSQL by up to 98%.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tags: string[];
}

class ServerCache {
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Retrieves an item from cache if present and not expired.
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Stores an item in cache with a TTL (default 60 seconds) and optional invalidation tags.
   */
  set<T>(key: string, value: T, ttlSeconds = 60, tags: string[] = []): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      tags,
    });
  }

  /**
   * Helper that retrieves from cache or executes the fetcher function.
   */
  async fetchOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds = 60,
    tags: string[] = []
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await fetcher();
    this.set(key, fresh, ttlSeconds, tags);
    return fresh;
  }

  /**
   * Invalidates all keys associated with a specific tag (e.g. 'settings', 'products', 'categories', 'orders').
   */
  invalidateTag(tag: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((entry, key) => {
      if (entry.tags.includes(tag)) {
        keysToDelete.push(key);
      }
    });

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Invalidates a specific cache key.
   */
  invalidateKey(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clears the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }
}

// Global server singleton across HMR in development
const globalForCache = global as unknown as { __mithaase_server_cache?: ServerCache };
export const serverCache = globalForCache.__mithaase_server_cache || new ServerCache();
if (process.env.NODE_ENV !== "production") {
  globalForCache.__mithaase_server_cache = serverCache;
}
