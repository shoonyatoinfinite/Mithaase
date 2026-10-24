import type { Metadata, Viewport } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/context/cart-context";
import { StoreSettingsProvider } from "@/lib/context/store-context";
import { UserAuthProvider } from "@/lib/context/user-auth-context";
import { CustomerAuthModal } from "@/components/storefront/CustomerAuthModal";
import { PwaRegister } from "@/components/pwa/PwaRegister";

const playfair = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#3B0820",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://mithaase.in"),
  title: "Mithaasé by Shree Shyam Sweets | Authentic Diwali Sweets & Delicacies",
  description: "Celebrate Diwali with authentic festive sweets, fresh Barfi, Gulab Jamun, Kalakand, Rasgulla, and Diwali specials from Shree Shyam Sweets. Fast local delivery with flat ₹21 fee.",
  keywords: ["Diwali sweets", "Shree Shyam Sweets", "Mithaasé", "Kaju Katli", "Gulab Jamun", "Kalakand", "Rasgulla", "Diwali Mithai Delivery", "Local Sweets Delivery"],
  openGraph: {
    title: "Mithaasé | Shree Shyam Sweets - Royal Diwali Mithai",
    description: "Celebrate the Festival of Lights with pure desi ghee mithai, handcrafted gift boxes, and fast local delivery.",
    url: "https://mithaase.in",
    siteName: "Mithaasé by Shree Shyam Sweets",
    images: [
      {
        url: "/images/hero_diwali_sweets.jpg",
        width: 1200,
        height: 630,
        alt: "Shree Shyam Sweets Royal Diwali Mithai Thali",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mithaasé",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${plusJakarta.variable} overflow-x-hidden max-w-full w-full`}>
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen bg-[#16031E] text-[#FFF8EE] antialiased flex flex-col selection:bg-[#D4AF37] selection:text-[#16031E] overflow-x-hidden max-w-full w-full">
        <UserAuthProvider>
          <StoreSettingsProvider>
            <CartProvider>
              {children}
              <CustomerAuthModal />
              <PwaRegister />
            </CartProvider>
          </StoreSettingsProvider>
        </UserAuthProvider>
      </body>
    </html>
  );
}
