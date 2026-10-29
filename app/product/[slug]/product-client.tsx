"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Product, ProductVariant } from "@/types";
import { useCart } from "@/lib/context/cart-context";
import { useStoreSettings } from "@/lib/context/store-context";
import { StoreClosedModal } from "@/components/storefront/StoreClosedModal";
import { ShoppingBag, Check, Plus, Minus, Sparkles, AlertCircle, ArrowRight } from "lucide-react";
import { useRealtime } from "@/lib/hooks/useRealtime";

export function ProductDetailClient({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem, items } = useCart();
  const { settings, isStoreClosed } = useStoreSettings();
  const [isStoreClosedModalOpen, setIsStoreClosedModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product>(product);

  useEffect(() => {
    setCurrentProduct(product);
  }, [product]);

  // Listen for real-time price & product updates
  useRealtime({
    events: ["product_updated"],
    enablePollingFallback: true,
    pollingIntervalMs: 4000,
    onEvent: async (payload) => {
      if (payload.data?.isFallbackTick) {
        try {
          const res = await fetch(`/api/products/${currentProduct.id}?t=${Date.now()}`);
          if (res.ok) {
            const fresh = await res.json();
            if (fresh && fresh.id) setCurrentProduct(fresh);
          }
        } catch {
          // ignore
        }
        return;
      }
      if (payload.type === "product_updated" && payload.data && payload.data.id === currentProduct.id) {
        setCurrentProduct(payload.data as Product);
      }
    },
  });

  const activeVariants = currentProduct.variants.filter((v) => v.is_active);
  // Default to 1kg variant if available, otherwise fallback to first variant
  const default1kg =
    activeVariants.find(
      (v) =>
        v.variant_name.toLowerCase().includes("1 kg") ||
        v.variant_name.toLowerCase().includes("1kg")
    ) || activeVariants[0];

  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    default1kg?.id || ""
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [added, setAdded] = useState<boolean>(false);

  const selectedVariant: ProductVariant | undefined =
    activeVariants.find((v) => v.id === selectedVariantId) || default1kg;

  // Real-time cart reflection for this product
  const inCartItemForVariant = items.find(
    (it) => it.productId === currentProduct.id && it.variantId === selectedVariant?.id
  );
  const inCartQty = inCartItemForVariant?.quantity || 0;
  const availableStock = selectedVariant ? Math.max(0, selectedVariant.stock_quantity) : 0;
  const remainingStock = Math.max(0, availableStock - inCartQty);

  const totalInCartForProduct = items
    .filter((it) => it.productId === currentProduct.id)
    .reduce((sum, it) => sum + it.quantity, 0);

  const isOutOfStock = availableStock <= 0;
  const isMaxInCart = availableStock > 0 && inCartQty >= availableStock;
  const isLowStock =
    availableStock > 0 &&
    selectedVariant &&
    availableStock <= selectedVariant.low_stock_threshold;

  useEffect(() => {
    if (remainingStock <= 0) {
      setQuantity(1);
    } else if (quantity > remainingStock) {
      setQuantity(remainingStock);
    }
  }, [remainingStock, quantity]);

  const handleAddToCart = () => {
    if (!selectedVariant || isOutOfStock || isMaxInCart) return;
    const qtyToAdd = Math.min(quantity, remainingStock > 0 ? remainingStock : 1);
    addItem(
      {
        productId: currentProduct.id,
        variantId: selectedVariant.id,
        productName: currentProduct.name,
        variantName: selectedVariant.variant_name,
        unit: selectedVariant.unit,
        price: selectedVariant.price,
        imageUrl: currentProduct.image_url,
        maxStock: availableStock,
      },
      qtyToAdd
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleBuyNow = () => {
    if (isStoreClosed) {
      setIsStoreClosedModalOpen(true);
      return;
    }
    handleAddToCart();
    router.push("/checkout");
  };

  return (
    <div className="flex flex-col">
      {/* Category & Badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
          {currentProduct.category_name || "Mithai"}
        </span>
        {currentProduct.badge && (
          <span className="px-2.5 py-0.5 rounded-full bg-[#881337] text-[#F5D061] text-[10px] font-bold uppercase tracking-wider">
            {currentProduct.badge}
          </span>
        )}
      </div>

      <h1 className="text-3xl sm:text-5xl font-serif font-black text-[#FFF8EE] mb-4">
        {currentProduct.name}
      </h1>

      <p className="text-sm sm:text-base text-[#D3BEB0] leading-relaxed mb-6">
        {currentProduct.description}
      </p>

      {/* Variant Selector */}
      {activeVariants.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#D3BEB0] block">
              Choose Package Size / Portion:
            </label>
            {inCartItemForVariant && (
              <span className="text-xs text-emerald-400 font-semibold font-mono">
                ✓ {inCartItemForVariant.quantity} already in cart
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {activeVariants.map((v) => {
              const isSelected = selectedVariantId === v.id;
              const inCartQtyForV = items.find(
                (it) => it.productId === currentProduct.id && it.variantId === v.id
              )?.quantity;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setSelectedVariantId(v.id);
                    setQuantity(1);
                  }}
                  className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all flex items-center gap-2 ${
                    isSelected
                      ? "bg-[#D4AF37] text-[#16031E] border-[#F5D061] shadow-[0_4px_16px_rgba(212,175,55,0.4)]"
                      : "bg-[#25072F] text-[#FFF8EE] border-white/10 hover:border-white/20"
                  }`}
                >
                  <span>{v.variant_name}</span>
                  <span className="opacity-80 text-xs">₹{v.price}</span>
                  {inCartQtyForV && inCartQtyForV > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#E65100] text-white text-[10px] font-black border border-white/20">
                      {inCartQtyForV} in cart
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* In-Cart Status Banner if items already in cart */}
      {inCartItemForVariant && (
        <div className="mb-6 p-3 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-300">
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <span>
              You already have <strong className="text-white">{inCartItemForVariant.quantity} × {selectedVariant?.variant_name}</strong> in your cart.
            </span>
          </div>
          <span className="text-[11px] text-[#F5D061] font-semibold">
            Adding +{quantity} more
          </span>
        </div>
      )}

      {/* Price & Stock Display */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-6 flex items-center justify-between">
        <div>
          <span className="text-[11px] text-white/50 uppercase font-semibold block">Total Price</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-black text-[#F5D061]">
              ₹{selectedVariant ? selectedVariant.price * quantity : 0}
            </span>
            {quantity > 1 && (
              <span className="text-xs text-white/60">
                (₹{selectedVariant?.price} × {quantity})
              </span>
            )}
          </div>
        </div>

        <div>
          {isOutOfStock ? (
            <span className="px-3 py-1 rounded-full bg-red-950 border border-red-500/50 text-red-300 text-xs font-bold uppercase">
              Out of Stock
            </span>
          ) : isLowStock ? (
            <span className="px-3 py-1 rounded-full bg-amber-950 border border-amber-500/50 text-amber-300 text-xs font-bold uppercase flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Only {selectedVariant?.stock_quantity} Left</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-300 text-xs font-bold uppercase">
              In Stock & Ready
            </span>
          )}
        </div>
      </div>

      {/* Quantity & CTA Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
        {!isOutOfStock && (
          <div className="flex items-center bg-[#25072F] border border-white/15 rounded-full p-1 w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1 || isMaxInCart}
              className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-full hover:bg-white/10 transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-10 text-center text-sm font-bold text-white">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() =>
                setQuantity((q) => Math.min(remainingStock > 0 ? remainingStock : 1, q + 1))
              }
              disabled={quantity >= remainingStock || isMaxInCart}
              className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-full hover:bg-white/10 transition-colors"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isOutOfStock || isMaxInCart}
          className={`flex-1 w-full py-4 px-6 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xl ${
            isOutOfStock || isMaxInCart
              ? "bg-white/10 text-white/40 cursor-not-allowed border border-white/5"
              : added
              ? "bg-emerald-600 text-white border border-emerald-400"
              : "gold-gradient-btn"
          }`}
        >
          {added ? (
            <>
              <Check className="w-4 h-4" />
              <span>Added to Cart!</span>
            </>
          ) : isOutOfStock ? (
            <span>Currently Unavailable</span>
          ) : isMaxInCart ? (
            <span>Max in Cart ({availableStock} units)</span>
          ) : (
            <>
              <ShoppingBag className="w-4 h-4" />
              <span>Add to Cart</span>
            </>
          )}
        </button>

        {!isOutOfStock && (
          <button
            type="button"
            onClick={handleBuyNow}
            className="w-full sm:w-auto py-4 px-6 rounded-full bg-[#580E1E] hover:bg-[#721427] text-white border border-[#D4AF37]/50 font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <span>Buy Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Store Closed Modal */}
      <StoreClosedModal
        isOpen={isStoreClosedModalOpen}
        onClose={() => setIsStoreClosedModalOpen(false)}
        settings={settings}
      />
    </div>
  );
}
