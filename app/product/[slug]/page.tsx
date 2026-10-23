import React from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getProducts } from "@/lib/data/store";
import { AnnouncementBar } from "@/components/storefront/AnnouncementBar";
import { Navbar } from "@/components/storefront/Navbar";
import { Footer } from "@/components/storefront/Footer";
import { ProductCard } from "@/components/products/ProductCard";
import { Diya } from "@/components/animations/Diya";
import { ProductDetailClient } from "./product-client";
import { ChevronRight, ArrowLeft, ShieldCheck, Clock, Truck } from "lucide-react";


export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const allProducts = await getProducts();
  const related = allProducts
    .filter((p) => p.id !== product.id && p.category_id === product.category_id)
    .slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col bg-[#16031E]">
      <Navbar />

      <main className="flex-1 pt-24 sm:pt-28 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#D3BEB0] mb-8">
          <Link href="/" className="hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Home</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-white/30" />
          <Link href="/#shop" className="hover:text-white transition-colors">
            {product.category_name || "Sweets"}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-white/30" />
          <span className="text-[#F5D061] font-semibold truncate max-w-[200px]">
            {product.name}
          </span>
        </nav>

        {/* Product Details Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mb-20">
          {/* Left Column: Image with Diya */}
          <div className="lg:col-span-6 relative aspect-square rounded-3xl overflow-hidden border-2 border-[#D4AF37]/45 shadow-2xl bg-[#1C0425]">
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 600px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#16031E]/60 via-transparent to-transparent pointer-events-none" />

            {/* Corner Decorative Diya */}
            <div className="absolute bottom-4 left-4 z-10">
              <Diya size="md" />
            </div>
          </div>

          {/* Right Column: Interactive Product Variant & Cart Client */}
          <div className="lg:col-span-6 flex flex-col">
            <ProductDetailClient product={product} />

            {/* Quality & Delivery Assurance Badges */}
            <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <Truck className="w-4 h-4 text-[#F5D061] mx-auto mb-1.5" />
                <span className="text-[11px] font-bold text-white block">₹21 Delivery</span>
                <span className="text-[10px] text-[#D3BEB0]">To your doorstep</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <ShieldCheck className="w-4 h-4 text-[#F5D061] mx-auto mb-1.5" />
                <span className="text-[11px] font-bold text-white block">100% Pure Ghee</span>
                <span className="text-[10px] text-[#D3BEB0]">Fresh festive batch</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <Clock className="w-4 h-4 text-[#F5D061] mx-auto mb-1.5" />
                <span className="text-[11px] font-bold text-white block">Same Day</span>
                <span className="text-[10px] text-[#D3BEB0]">Available in town</span>
              </div>
            </div>
          </div>
        </div>

        {/* Related Sweets */}
        {related.length > 0 && (
          <div className="pt-12 border-t border-white/10">
            <h3 className="text-2xl font-serif font-bold text-[#FFF8EE] mb-6">
              You May Also Like for <span className="gold-gradient-text">Diwali</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
