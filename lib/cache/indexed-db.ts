/**
 * Client-Side IndexedDB Storage Layer for Mithaasé Sweets
 * Persists products, prices, categories, and settings locally in the customer's browser.
 * Enables instant 0ms loads, offline resilience, and cuts server/database requests to zero.
 */

import { Product, Category, StoreSettings } from "@/types";

const DB_NAME = "mithaase_local_store_v1";
const DB_VERSION = 1;
const STORE_NAME = "catalog_cache";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not supported in this environment"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedCatalog(): Promise<{
  products: Product[];
  categories: Category[];
  version: string;
  cachedAt: number;
} | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get("catalog");

      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn("[IndexedDB] Read warning:", err);
    return null;
  }
}

export async function saveCatalogToCache(
  products: Product[],
  categories: Category[],
  version: string
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const data = {
        products,
        categories,
        version,
        cachedAt: Date.now(),
      };
      const req = store.put(data, "catalog");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[IndexedDB] Save warning:", err);
  }
}

export async function getCachedSettings(): Promise<StoreSettings | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get("settings");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveSettingsToCache(settings: StoreSettings): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(settings, "settings");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

export async function clearIndexedDbCache(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
  } catch {}
}
