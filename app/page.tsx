import { AnnouncementBar } from "@/components/storefront/AnnouncementBar";
import { Navbar } from "@/components/storefront/Navbar";
import { Hero } from "@/components/storefront/Hero";
import { TrustBar } from "@/components/storefront/TrustBar";
import { CategoryGrid } from "@/components/storefront/CategoryGrid";
import { DiwaliSpecials } from "@/components/storefront/DiwaliSpecials";
import { SweetOrbit } from "@/components/animations/SweetOrbit";
import { DeliveryInfoSection } from "@/components/storefront/DeliveryInfoSection";
import { AboutSection } from "@/components/storefront/AboutSection";
import { FAQSection } from "@/components/storefront/FAQSection";
import { Footer } from "@/components/storefront/Footer";
import { MoneyRain } from "@/components/animations/MoneyRain";
import { getCategories, getProducts, getStoreSettings } from "@/lib/data/store";
import { StoreShutoffNotice } from "@/components/storefront/StoreShutoffNotice";


export default async function HomePage() {
  const [categories, products, settings] = await Promise.all([
    getCategories(),
    getProducts(),
    getStoreSettings(),
  ]);

  const isShutoff = Boolean(settings.store_shutoff || settings.store_status === "shutoff");

  return (
    <main className="min-h-screen flex flex-col bg-[#16031E] selection:bg-[#D4AF37] selection:text-[#16031E] overflow-x-hidden w-full max-w-full pt-16 sm:pt-20">
      {/* 1. Signature Money-Rain Opening Celebration (Session-tracked, skippable) */}
      {!isShutoff && <MoneyRain />}

      {/* 2. Navigation Header (Fixed at top with always visible Cart button & Announcement) */}
      <Navbar />

      {/* 3. If Store is Shut Off, display the prominent Store Shutoff Notice and direct options */}
      {isShutoff ? (
        <>
          <StoreShutoffNotice settings={settings} />
          {/* About & Trust info */}
          <AboutSection />
          <FAQSection />
          <Footer />
        </>
      ) : (
        <>
          {/* 4. Immersive Animated Hero */}
          <Hero />

          {/* 5. Trust & Operational Bar */}
          <TrustBar />

          {/* 6. Diwali Specials Showcase (Hampers & Paneer Sabji) */}
          <DiwaliSpecials products={products} />

          {/* 7. Full Product Catalogue with Category Filters */}
          <CategoryGrid categories={categories} products={products} />

          {/* 8. Signature Circular Sweet-Orbit Feature */}
          <div id="sweet-orbit">
            <SweetOrbit />
          </div>

          {/* 9. Local Delivery Information (Flat ₹21 Fee & Localities) */}
          <DeliveryInfoSection />

          {/* 10. About the Shop Heritage */}
          <AboutSection />

          {/* 11. FAQ Accordion */}
          <FAQSection />

          {/* 12. Complete Footer */}
          <Footer />
        </>
      )}
    </main>
  );
}
