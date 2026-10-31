"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Product, ProductVariant } from "@/types";
import { useCart } from "@/lib/context/cart-context";
import { ShoppingBag, Check, Plus, Minus, AlertCircle, Sparkles } from "lucide-react";
import { ProductDemandModal } from "@/components/products/ProductDemandModal";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem, items } = useCart();
  const [isDemandModalOpen, setIsDemandModalOpen] = useState(false);
  const activeVariants = product.variants.filter((v) => v.is_active);
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
  const [addedAnimation, setAddedAnimation] = useState<boolean>(false);

  const selectedVariant: ProductVariant | undefined =
    activeVariants.find((v) => v.id === selectedVariantId) || default1kg;

  // Real-time cart reflection for this product & selected variant
  const inCartItemForVariant = items.find(
    (it) => it.productId === product.id && it.variantId === selectedVariant?.id
  );
  const inCartQty = inCartItemForVariant?.quantity || 0;
  const availableStock = selectedVariant ? Math.max(0, selectedVariant.stock_quantity) : 0;
  const remainingStock = Math.max(0, availableStock - inCartQty);

  const totalInCartForProduct = items
    .filter((it) => it.productId === product.id)
    .reduce((sum, it) => sum + it.quantity, 0);

  const isOutOfStock = availableStock <= 0;
  const isMaxInCart = availableStock > 0 && inCartQty >= availableStock;
  const isLowStock =
    availableStock > 0 &&
    selectedVariant &&
    availableStock <= selectedVariant.low_stock_threshold;

  // Auto-clamp quantity selector when remaining stock changes
  React.useEffect(() => {
    if (remainingStock <= 0) {
      setQuantity(1);
    } else if (quantity > remainingStock) {
      setQuantity(remainingStock);
    }
  }, [remainingStock, quantity]);

  const handleAddToCart = () => {
    if (!selectedVariant || isOutOfStock || isMaxInCart || remainingStock <= 0) return;

    const qtyToAdd = Math.min(quantity, remainingStock);
    if (qtyToAdd <= 0) return;

    const res = addItem(
      {
        productId: product.id,
        variantId: selectedVariant.id,
        productName: product.name,
        variantName: selectedVariant.variant_name,
        unit: selectedVariant.unit,
        price: selectedVariant.price,
        imageUrl: product.image_url,
        maxStock: availableStock,
      },
      qtyToAdd
    );

    if (res.success) {
      setAddedAnimation(true);
      setTimeout(() => setAddedAnimation(false), 1400);
    }
  };

  return (
    <div className="group relative flex flex-col rounded-2xl bg-gradient-to-b from-[#24062E] to-[#1C0526] border border-[#D4AF37]/25 hover:border-[#D4AF37]/60 shadow-[0_8px_25px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_35px_rgba(212,175,55,0.2)] transition-all duration-300 overflow-hidden">
      {/* Product Image Container */}
      <Link href={`/product/${product.slug}`} className="relative w-full aspect-[4/3] overflow-hidden block bg-[#16031E]">
        <Image
          src={product.image_url}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1C0526] via-transparent to-transparent opacity-80" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {product.badge && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#881337]/90 border border-[#F5D061]/50 text-[#F5D061] text-[10px] font-bold tracking-wider uppercase backdrop-blur-sm shadow-md">
              <Sparkles className="w-3 h-3" />
              <span>{product.badge}</span>
            </span>
          )}
          {product.is_seasonal_special && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-600/90 text-white text-[10px] font-semibold backdrop-blur-sm shadow-sm">
              Diwali Day Special
            </span>
          )}
        </div>

        {/* Stock Status Badge */}
        <div className="absolute top-3 right-3 z-10">
          {isOutOfStock ? (
            <span className="px-2 py-0.5 rounded-md bg-red-950/90 border border-red-500/50 text-red-300 text-[10px] font-bold uppercase backdrop-blur-sm">
              Sold Out
            </span>
          ) : isLowStock ? (
            <span className="px-2 py-0.5 rounded-md bg-amber-950/90 border border-amber-500/50 text-amber-300 text-[10px] font-bold uppercase backdrop-blur-sm flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              <span>Only {selectedVariant?.stock_quantity} left</span>
            </span>
          ) : null}
        </div>

        {/* Live In-Cart Overlay Pill */}
        {totalInCartForProduct > 0 && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10">
            <div className="py-1 px-2.5 rounded-xl bg-[#16031E]/90 border border-[#D4AF37] backdrop-blur-md flex items-center justify-between text-[11px] shadow-lg">
              <span className="text-[#F5D061] font-bold flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-[#F5D061]" />
                <span>In Cart:</span>
              </span>
              <span className="font-bold text-white bg-[#580E1E] px-2 py-0.5 rounded-md font-mono text-[10px] border border-[#D4AF37]/40">
                {inCartItemForVariant
                  ? `${inCartItemForVariant.quantity} (${selectedVariant?.variant_name})`
                  : `${totalInCartForProduct} total`}
              </span>
            </div>
          </div>
        )}
      </Link>

      {/* Content Area */}
      <div className="p-5 flex flex-col flex-1">
        {/* Category tag & Name */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#D4AF37]">
            {product.category_name || "Mithai"}
          </span>
        </div>

        <Link href={`/product/${product.slug}`} className="hover:text-[#F5D061] transition-colors">
          <h3 className="text-lg font-serif font-bold text-[#FFF8EE] line-clamp-1 mb-1.5">
            {product.name}
          </h3>
        </Link>

        <p className="text-xs text-[#D3BEB0] line-clamp-2 leading-relaxed mb-4 flex-1">
          {product.description}
        </p>

        {/* Portion / Variant Selector */}
        {activeVariants.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-white/50 block">
                Select Portion / Weight
              </label>
              {inCartItemForVariant && inCartItemForVariant.quantity > 0 && (
                <span className="text-[10px] text-emerald-400 font-semibold font-mono">
                  ✓ {inCartItemForVariant.quantity} already in cart
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeVariants.map((v) => {
                const inCartQty = items.find(
                  (it) => it.productId === product.id && it.variantId === v.id
                )?.quantity;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setSelectedVariantId(v.id);
                      setQuantity(1);
                    }}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all flex items-center gap-1.5 ${
                      selectedVariantId === v.id
                        ? "bg-[#D4AF37] text-[#16031E] border-[#F5D061] font-bold shadow-[0_2px_10px_rgba(212,175,55,0.4)]"
                        : "bg-white/5 text-[#D3BEB0] border-white/10 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <span>{v.variant_name}</span>
                    {inCartQty && inCartQty > 0 ? (
                      <span className="px-1.5 py-0.2 rounded-full bg-[#E65100] text-white text-[9px] font-black border border-white/20">
                        {inCartQty}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Price & Quantity & Add to Cart Controls */}
        <div className="pt-3 border-t border-white/10 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 mt-auto">
          {/* Price */}
          <div className="flex flex-col">
            <span className="text-[10px] text-white/50 uppercase">Price</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold font-serif text-[#F5D061]">
                ₹{selectedVariant ? selectedVariant.price : "—"}
              </span>
              <span className="text-[11px] text-[#D3BEB0]">
                / {selectedVariant ? selectedVariant.variant_name : ""}
              </span>
            </div>
          </div>

          {/* Add to Cart Actions */}
          <div className="flex items-center gap-2">
            {!isOutOfStock && (
              <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || isMaxInCart}
                  className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-white/10 transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-xs font-bold text-white">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((q) => Math.min(remainingStock > 0 ? remainingStock : 1, q + 1))
                  }
                  disabled={quantity >= remainingStock || isMaxInCart}
                  className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-white/10 transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}

            {isOutOfStock ? (
              <button
                type="button"
                onClick={() => setIsDemandModalOpen(true)}
                className="h-9 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold transition-all bg-amber-500/20 text-[#F5D061] border border-amber-500/40 hover:bg-amber-500/30 cursor-pointer shadow-md"
                title="Special Halwai Batch Request (10+ kg goal)"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#F5D061]" />
                <span>Request Batch</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isMaxInCart}
                className={`h-9 px-3.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                  isMaxInCart
                    ? "bg-white/10 text-white/40 cursor-not-allowed border border-white/5"
                    : addedAnimation
                    ? "bg-emerald-600 text-white border border-emerald-400"
                    : "gold-gradient-btn"
                }`}
                title={
                  isMaxInCart
                    ? `Maximum available stock (${availableStock}) already in cart`
                    : "Add to cart"
                }
              >
                {addedAnimation ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Added!</span>
                  </>
                ) : isMaxInCart ? (
                  <span>Max in Cart</span>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <ProductDemandModal
        product={product}
        isOpen={isDemandModalOpen}
        onClose={() => setIsDemandModalOpen(false)}
      />
    </div>
  );
}
