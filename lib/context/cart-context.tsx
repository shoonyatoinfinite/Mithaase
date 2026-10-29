"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { CartItem, Product } from "@/types";
import { BulkOrderModal } from "@/components/cart/BulkOrderModal";
import { CartReconciliationModal } from "@/components/cart/CartReconciliationModal";
import { useUserAuth } from "@/lib/context/user-auth-context";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { getCachedCatalog, saveCatalogToCache } from "@/lib/cache/indexed-db";

export const MAX_CART_WEIGHT_KG = 20;

export function parseWeightInKg(variantName: string): number {
  if (!variantName) return 1;
  const str = variantName.toLowerCase();
  const kgMatch = str.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (kgMatch) return parseFloat(kgMatch[1]);
  const gmMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:g|gm|gram)/);
  if (gmMatch) return parseFloat(gmMatch[1]) / 1000;
  return 1;
}

interface CartContextType {
  items: CartItem[];
  addItem: (
    item: Omit<CartItem, "quantity">,
    quantity?: number
  ) => { success: boolean; isBulkRequired?: boolean; error?: string };
  removeItem: (variantId: string) => void;
  updateQuantity: (
    variantId: string,
    quantity: number
  ) => { success: boolean; isBulkRequired?: boolean; error?: string };
  clearCart: () => void;
  subtotal: number;
  itemCount: number;
  totalWeightKg: number;
  maxWeightKg: number;
  isWeightLimitReached: boolean;
  bulkModalOpen: boolean;
  setBulkModalOpen: (open: boolean) => void;
  isHydrated: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "mithaase_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useUserAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  // Cart Reconciliation State (when a user with saved items logs in)
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [savedUserItems, setSavedUserItems] = useState<CartItem[]>([]);
  const [checkedUserEmail, setCheckedUserEmail] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch {
      // Ignore storage error
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Reconcile cart item prices against latest products from IndexedDB / Server
  const syncCartPrices = useCallback(async () => {
    try {
      const reconcile = (products: Product[]) => {
        setItems((prev) => {
          let hasDiff = false;
          const updated = prev.map((item) => {
            const prod = products.find((p) => p.id === item.productId);
            const vr = prod?.variants.find((v) => v.id === item.variantId);
            if (
              prod &&
              vr &&
              (vr.price !== item.price ||
                vr.stock_quantity !== item.maxStock ||
                vr.variant_name !== item.variantName ||
                prod.name !== item.productName)
            ) {
              hasDiff = true;
              const newMaxStock = Number(vr.stock_quantity);
              return {
                ...item,
                price: Number(vr.price),
                maxStock: newMaxStock,
                quantity: Math.max(1, Math.min(newMaxStock > 0 ? newMaxStock : 1, item.quantity)),
                variantName: vr.variant_name,
                productName: prod.name,
              };
            }
            return item;
          });
          return hasDiff ? updated : prev;
        });
      };

      // 1. Instant local price reconciliation from IndexedDB (0 network, 0 database)
      const cached = await getCachedCatalog();
      if (cached && cached.products && cached.products.length > 0) {
        reconcile(cached.products);
      }

      // 2. Fetch lightweight catalog version
      const vRes = await fetch("/api/catalog/version");
      if (!vRes.ok) return;
      const { version } = await vRes.json();

      // If version matches cached data, skip downloading products entirely!
      if (cached && cached.version === version) {
        return;
      }

      // 3. Version changed or no cache: fetch fresh products and save to IndexedDB
      const res = await fetch("/api/products");
      if (!res.ok) return;
      const freshProducts: Product[] = await res.json();
      reconcile(freshProducts);
      await saveCatalogToCache(freshProducts, cached?.categories || [], version);
    } catch {
      // Ignore background sync errors
    }
  }, []);

  useEffect(() => {
    if (isHydrated) {
      syncCartPrices();
    }
  }, [isHydrated, syncCartPrices]);

  // Hook into live product_updated real-time event to update cart prices live
  useRealtime({
    events: ["product_updated"],
    enablePollingFallback: false,
    onEvent: (payload) => {
      if (payload.type === "product_updated" && payload.data) {
        const prod = payload.data as Product;
        setItems((prev) => {
          let hasDiff = false;
          const updated = prev.map((item) => {
            if (item.productId === prod.id) {
              const vr = prod.variants.find((v) => v.id === item.variantId);
              if (
                vr &&
                (vr.price !== item.price ||
                  vr.stock_quantity !== item.maxStock ||
                  vr.variant_name !== item.variantName)
              ) {
                hasDiff = true;
                const newMaxStock = Number(vr.stock_quantity);
                return {
                  ...item,
                  price: Number(vr.price),
                  maxStock: newMaxStock,
                  quantity: Math.max(1, Math.min(newMaxStock > 0 ? newMaxStock : 1, item.quantity)),
                  variantName: vr.variant_name,
                  productName: prod.name,
                };
              }
            }
            return item;
          });
          return hasDiff ? updated : prev;
        });
      }
    },
  });

  // Save to localStorage when items change
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      if (isAuthenticated && (user?.id || user?.email)) {
        const userKey = user?.id ? `mithaase_user_cart_${user.id}` : `mithaase_user_cart_${user?.email?.toLowerCase()}`;
        localStorage.setItem(userKey, JSON.stringify(items));
      }
    } catch {
      // Ignore storage error
    }
  }, [items, isHydrated, isAuthenticated, user]);

  // Account login detection for cart reconciliation
  useEffect(() => {
    if (!isHydrated) return;

    if (isAuthenticated && (user?.id || user?.email)) {
      const userIdentifier = user?.id || user?.email?.toLowerCase();
      if (userIdentifier === checkedUserEmail) return;

      setCheckedUserEmail(userIdentifier);
      const userKey = user?.id ? `mithaase_user_cart_${user.id}` : `mithaase_user_cart_${user?.email?.toLowerCase()}`;
      const legacyEmailKey = user?.email ? `mithaase_user_cart_${user.email.toLowerCase()}` : null;

      try {
        let savedJson = localStorage.getItem(userKey);
        // Fallback to legacy email key if id key is not yet set
        if (!savedJson && legacyEmailKey && legacyEmailKey !== userKey) {
          savedJson = localStorage.getItem(legacyEmailKey);
        }
        if (savedJson) {
          const parsedSaved: CartItem[] = JSON.parse(savedJson);

          // If current session has items AND account has saved items:
          if (items.length > 0 && parsedSaved.length > 0) {
            // Check if they are actually different
            const currentKeys = items.map((i) => `${i.variantId}:${i.quantity}`).sort().join(",");
            const savedKeys = parsedSaved.map((i) => `${i.variantId}:${i.quantity}`).sort().join(",");

            if (currentKeys !== savedKeys) {
              setSavedUserItems(parsedSaved);
              setReconcileModalOpen(true);
            }
          } else if (items.length === 0 && parsedSaved.length > 0) {
            // Restore saved account cart if current session was empty
            setItems(parsedSaved);
          } else if (items.length > 0 && parsedSaved.length === 0) {
            // Associate current session items to this account
            localStorage.setItem(userKey, JSON.stringify(items));
          }
        } else if (items.length > 0) {
          // First time this account has a cart, store current items
          localStorage.setItem(userKey, JSON.stringify(items));
        }
      } catch {
        // Ignore JSON error
      }
    } else if (!isAuthenticated) {
      setCheckedUserEmail(null);
    }
  }, [isAuthenticated, user, isHydrated, items, checkedUserEmail]);

  // Reconcile Handler 1: Combine / Merge both carts
  const handleMergeCarts = () => {
    setItems((prev) => {
      const mergedMap = new Map<string, CartItem>();

      // Add saved account items
      savedUserItems.forEach((it) => {
        mergedMap.set(it.variantId, { ...it });
      });

      // Merge current items
      prev.forEach((it) => {
        const existing = mergedMap.get(it.variantId);
        if (existing) {
          mergedMap.set(it.variantId, {
            ...existing,
            quantity: Math.min(existing.maxStock, existing.quantity + it.quantity),
          });
        } else {
          mergedMap.set(it.variantId, { ...it });
        }
      });

      const finalItems = Array.from(mergedMap.values());
      const userKey = user?.id ? `mithaase_user_cart_${user.id}` : (user?.email ? `mithaase_user_cart_${user.email.toLowerCase()}` : null);
      if (userKey) {
        localStorage.setItem(userKey, JSON.stringify(finalItems));
      }
      return finalItems;
    });

    setReconcileModalOpen(false);
  };

  // Reconcile Handler 2: Keep current visit items only
  const handleKeepCurrent = () => {
    const userKey = user?.id ? `mithaase_user_cart_${user.id}` : (user?.email ? `mithaase_user_cart_${user.email.toLowerCase()}` : null);
    if (userKey) {
      localStorage.setItem(userKey, JSON.stringify(items));
    }
    setReconcileModalOpen(false);
  };

  // Reconcile Handler 3: Restore previous account cart
  const handleRestorePrevious = () => {
    setItems(savedUserItems);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(savedUserItems));
    setReconcileModalOpen(false);
  };

  // Compute total cart weight in kg
  const totalWeightKg = items.reduce(
    (acc, item) => acc + parseWeightInKg(item.variantName) * item.quantity,
    0
  );

  const isWeightLimitReached = totalWeightKg >= MAX_CART_WEIGHT_KG;

  const addItem = (
    item: Omit<CartItem, "quantity">,
    quantity = 1
  ): { success: boolean; isBulkRequired?: boolean; error?: string } => {
    const itemUnitWeight = parseWeightInKg(item.variantName);
    const addedWeight = itemUnitWeight * quantity;

    // Check existing item quantity in cart
    const existing = items.find((i) => i.variantId === item.variantId);
    const currentCartWeight = totalWeightKg;
    const prospectiveWeight = currentCartWeight + addedWeight;

    if (prospectiveWeight > MAX_CART_WEIGHT_KG) {
      setBulkModalOpen(true);
      return {
        success: false,
        isBulkRequired: true,
        error: `Cart weight cannot exceed ${MAX_CART_WEIGHT_KG} kg. For bulk orders, please contact us!`,
      };
    }

    const availableStock = Math.max(0, Number(item.maxStock) || 0);
    if (availableStock <= 0) {
      return {
        success: false,
        error: `${item.productName} (${item.variantName}) is currently out of stock.`,
      };
    }

    const currentQtyInCart = existing ? existing.quantity : 0;
    if (currentQtyInCart >= availableStock) {
      return {
        success: false,
        error: `Cannot add more. You already have all ${availableStock} available units of ${item.productName} in your cart.`,
      };
    }

    const maxCanAdd = availableStock - currentQtyInCart;
    const qtyToAdd = Math.min(quantity, maxCanAdd);
    if (qtyToAdd <= 0) {
      return {
        success: false,
        error: `Cannot add more. You already have all ${availableStock} available units of ${item.productName} in your cart.`,
      };
    }

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.variantId === item.variantId);
      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = Math.min(
          availableStock,
          (updated[existingIndex].quantity || 0) + qtyToAdd
        );
        updated[existingIndex] = {
          ...updated[existingIndex],
          maxStock: availableStock,
          quantity: newQty,
        };
        return updated;
      }
      return [
        ...prev,
        {
          ...item,
          maxStock: availableStock,
          quantity: qtyToAdd,
        },
      ];
    });

    return { success: true };
  };

  const removeItem = (variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  };

  const updateQuantity = (
    variantId: string,
    quantity: number
  ): { success: boolean; isBulkRequired?: boolean; error?: string } => {
    if (quantity <= 0) {
      removeItem(variantId);
      return { success: true };
    }

    const targetItem = items.find((i) => i.variantId === variantId);
    if (!targetItem) return { success: false, error: "Item not found" };

    const hasKnownStock = typeof targetItem.maxStock === "number" && !isNaN(targetItem.maxStock);
    const availableStock = Math.max(0, Number(targetItem.maxStock) || 0);
    if (hasKnownStock && quantity > availableStock) {
      setItems((prev) =>
        prev.map((i) =>
          i.variantId === variantId
            ? { ...i, quantity: Math.max(1, availableStock) }
            : i
        )
      );
      return {
        success: false,
        error: availableStock > 0
          ? `Only ${availableStock} units available in stock for ${targetItem.productName}.`
          : `${targetItem.productName} is currently out of stock.`,
      };
    }

    const itemUnitWeight = parseWeightInKg(targetItem.variantName);
    const currentItemWeight = itemUnitWeight * targetItem.quantity;
    const newItemWeight = itemUnitWeight * quantity;
    const otherWeight = totalWeightKg - currentItemWeight;

    if (otherWeight + newItemWeight > MAX_CART_WEIGHT_KG) {
      setBulkModalOpen(true);
      return {
        success: false,
        isBulkRequired: true,
        error: `Total order weight limit is ${MAX_CART_WEIGHT_KG} kg. For bulk orders, please contact us!`,
      };
    }

    setItems((prev) =>
      prev.map((i) =>
        i.variantId === variantId
          ? { ...i, quantity: Math.min(availableStock > 0 ? availableStock : i.maxStock, quantity) }
          : i
      )
    );

    return { success: true };
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const itemCount = items.length;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        subtotal,
        itemCount,
        totalWeightKg,
        maxWeightKg: MAX_CART_WEIGHT_KG,
        isWeightLimitReached,
        bulkModalOpen,
        setBulkModalOpen,
        isHydrated,
      }}
    >
      {children}
      {/* Global Bulk Order Modal */}
      <BulkOrderModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        currentWeightKg={totalWeightKg}
      />
      {/* Cart Items Reconciliation Modal on Customer Login */}
      <CartReconciliationModal
        isOpen={reconcileModalOpen}
        currentItems={items}
        savedAccountItems={savedUserItems}
        onMerge={handleMergeCarts}
        onKeepCurrent={handleKeepCurrent}
        onRestorePrevious={handleRestorePrevious}
        onClose={() => setReconcileModalOpen(false)}
      />
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
