"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Order } from "@/types";
import { useCart } from "@/lib/context/cart-context";
import { useStoreSettings } from "@/lib/context/store-context";
import { useUserAuth } from "@/lib/context/user-auth-context";
import { useRealtime } from "@/lib/hooks/useRealtime";
import {
  ShoppingBag,
  Menu,
  X,
  Sparkles,
  User,
  LogOut,
  CheckCircle2,
  Receipt,
  ArrowRight,
  Bike,
  Box,
  Clock,
} from "lucide-react";
import { Diya } from "@/components/animations/Diya";
import { AnnouncementBar } from "./AnnouncementBar";
import { RoleProfileModal } from "@/components/profile/RoleProfileModal";

interface NavbarProps {
  hideAnnouncement?: boolean;
}

export function Navbar({ hideAnnouncement = false }: NavbarProps) {
  const { itemCount, subtotal } = useCart();
  const { settings, isStoreShutoff } = useStoreSettings();
  const { user, isAuthenticated, logout, openAuthModal, refreshUser } = useUserAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [showCustomerProfileModal, setShowCustomerProfileModal] = useState(false);
  const [activeCustomerOrder, setActiveCustomerOrder] = useState<Order | null>(null);

  // Fetch active order for logged-in user (placed but not yet delivered)
  const fetchActiveCustomerOrder = useCallback(async () => {
    if (!isAuthenticated || !user?.email) {
      setActiveCustomerOrder(null);
      return;
    }
    try {
      const res = await fetch(`/api/orders?email=${encodeURIComponent(user.email)}`, {
        headers: { "x-customer-auth-email": user.email },
      });
      if (res.ok) {
        const orders: Order[] = await res.json();
        const active = orders.find(
          (o) => o.order_status !== "delivered" && o.order_status !== "cancelled"
        );
        setActiveCustomerOrder(active || null);
      }
    } catch {
      // ignore
    }
  }, [isAuthenticated, user?.email]);

  useEffect(() => {
    fetchActiveCustomerOrder();
  }, [fetchActiveCustomerOrder]);

  // Real-time synchronization of customer active order
  useRealtime({
    events: ["order_created", "order_status_updated"],
    enablePollingFallback: false,
    onEvent: (payload) => {
      if (payload.data && user?.email) {
        const targetEmail = (payload.data.customer_email || "").toLowerCase().trim();
        const myEmail = user.email.toLowerCase().trim();
        if (targetEmail === myEmail) {
          fetchActiveCustomerOrder();
        }
      }
    },
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = isStoreShutoff
    ? [
        { name: "Home", href: "/" },
        { name: "My Receipts & Orders", href: "/orders" },
        { name: "About Shop", href: "/#about" },
        { name: "FAQ", href: "/#faq" },
      ]
    : [
        { name: "Home", href: "/" },
        { name: "Shop", href: "/#shop" },
        { name: "Diwali Specials", href: "/#diwali-specials" },
        { name: "Sweet Orbit", href: "/#sweet-orbit" },
        { name: "Delivery Info", href: "/#delivery-info" },
        { name: "About", href: "/#about" },
        { name: "FAQ", href: "/#faq" },
      ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ${
          isScrolled
            ? "bg-[#16031E]/95 backdrop-blur-md shadow-[0_4px_25px_rgba(0,0,0,0.85)] border-b border-[#D4AF37]/35"
            : "bg-[#16031E]/95 backdrop-blur-md border-b border-[#D4AF37]/20 shadow-md"
        }`}
      >
        {/* Optional Collapsible Festive Announcement Strip */}
        {!hideAnnouncement && (
          <div
            className={`transition-all duration-300 overflow-hidden ${
              isScrolled ? "max-h-0 opacity-0" : "max-h-20 opacity-100"
            }`}
          >
            <AnnouncementBar />
          </div>
        )}

        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Brand Logo & Wordmark */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
            <div className="relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[#580E1E] to-[#2B0938] border border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.3)] group-hover:scale-105 transition-transform">
              <Diya size="sm" className="scale-75 -mt-0.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg sm:text-2xl font-serif font-black tracking-wider text-[#FFF8EE] group-hover:text-[#F5D061] transition-colors leading-none">
                Mithaasé
              </span>
              <span className="text-[9px] sm:text-[11px] uppercase tracking-widest text-[#D4AF37] font-semibold mt-0.5 truncate max-w-[100px] xs:max-w-[130px] sm:max-w-none">
                {settings.store_name}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-5 xl:gap-6 text-xs xl:text-sm font-medium text-[#D3BEB0]">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="hover:text-[#F5D061] transition-colors relative py-1 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#D4AF37] hover:after:w-full after:transition-all"
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Right Actions: User Account, Admin Link & Cart Button */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Live Order Status Icon (Visible only after customer login when an active order is placed but not yet delivered) */}
            {isAuthenticated && activeCustomerOrder && (
              <Link
                href={`/track/${activeCustomerOrder.id}`}
                id="header-live-order-tracker"
                title={`Track Live Order #${activeCustomerOrder.order_number}: ${activeCustomerOrder.order_status.replace(/_/g, " ")}`}
                className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-amber-950/90 via-[#3B0E4D] to-amber-950/90 border border-[#D4AF37] text-white text-xs font-bold shadow-[0_0_15px_rgba(212,175,55,0.4)] hover:shadow-[0_0_25px_rgba(212,175,55,0.7)] hover:border-[#F5D061] transition-all active:scale-95 group shrink-0"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>

                {activeCustomerOrder.order_status === "out_for_delivery" ? (
                  <Bike className="w-3.5 h-3.5 text-[#F5D061] animate-bounce shrink-0" />
                ) : activeCustomerOrder.order_status === "ready_for_dispatch" ? (
                  <Box className="w-3.5 h-3.5 text-[#F5D061] shrink-0" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-[#F5D061] shrink-0" />
                )}

                <div className="flex items-center gap-1">
                  <span className="hidden md:inline text-[9px] uppercase tracking-wider text-[#F5D061] font-bold">
                    Order:
                  </span>
                  <span className="text-[11px] font-black capitalize text-white truncate max-w-[70px] sm:max-w-[110px]">
                    {activeCustomerOrder.order_status === "ready_for_dispatch"
                      ? "Packed"
                      : activeCustomerOrder.order_status === "pending_confirmation"
                      ? "Placed"
                      : activeCustomerOrder.order_status.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            )}

            {/* Customer User Auth: Single Merged Profile Icon with Green Logged-In Indicator inside at top */}
            {isAuthenticated && user?.email ? (
              <div className="relative">
                {/* Backdrop to close dropdown when clicking outside */}
                {userDropdownOpen && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserDropdownOpen(false)}
                  />
                )}

                <button
                  type="button"
                  id="customer-profile-menu-btn"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="relative p-2 rounded-full bg-white/5 hover:bg-white/10 text-[#F5D061] border border-[#D4AF37]/40 hover:border-[#D4AF37] transition-all shadow-[0_2px_12px_rgba(212,175,55,0.2)] active:scale-95 cursor-pointer flex items-center justify-center group"
                  title={`Account Menu: ${user.email}`}
                  aria-label="User Account and Profile"
                >
                  <div className="relative flex items-center justify-center">
                    <User className="w-4 h-4 text-[#F5D061] group-hover:scale-110 transition-transform" />
                    {/* Green Logged In Icon Shifted Inside at Top of Profile Icon */}
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#16031E] ring-1 ring-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.95)] animate-pulse" />
                  </div>
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 p-2 rounded-2xl bg-[#1D0427] border border-[#D4AF37]/35 shadow-[0_15px_40px_rgba(0,0,0,0.85)] z-50 text-xs">
                    {/* User Info Header */}
                    <div className="p-2.5 border-b border-white/10 mb-1 flex items-center justify-between bg-white/5 rounded-xl">
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] text-white/50 block font-medium">Logged In As</span>
                        <span className="text-white font-bold truncate block text-xs">{user.email}</span>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-500/50 shrink-0" />
                    </div>

                    {/* Feature 1: View & Edit Profile / Saved Delivery Address */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomerProfileModal(true);
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 text-[#F5D061] flex items-center gap-2.5 font-semibold transition-colors"
                    >
                      <User className="w-4 h-4 text-[#F5D061] shrink-0" />
                      <span>My Profile & Address</span>
                    </button>

                    {/* Feature 2: My Orders & Receipts */}
                    <Link
                      href="/orders"
                      onClick={() => setUserDropdownOpen(false)}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 text-white/95 flex items-center gap-2.5 font-semibold transition-colors"
                    >
                      <Receipt className="w-4 h-4 text-[#F5D061] shrink-0" />
                      <span>My Orders & Receipts</span>
                    </Link>

                    {/* Feature 3: Quick Checkout */}
                    <Link
                      href="/checkout"
                      onClick={() => setUserDropdownOpen(false)}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 text-white/80 flex items-center gap-2.5 font-semibold transition-colors"
                    >
                      <ShoppingBag className="w-4 h-4 text-[#D4AF37] shrink-0" />
                      <span>Go to Checkout</span>
                    </Link>

                    <div className="my-1 border-t border-white/10" />

                    {/* Feature 4: Sign Out */}
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-rose-950/40 text-rose-300 hover:text-rose-200 flex items-center gap-2.5 transition-colors"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[#F5D061] hover:text-white px-3 py-1.5 rounded-full bg-white/5 border border-[#D4AF37]/30 hover:border-[#D4AF37] transition-all font-semibold active:scale-95 cursor-pointer shadow-sm"
              >
                <User className="w-3.5 h-3.5" />
                <span>Login</span>
              </button>
            )}

            {/* Cart Button - Always prominently visible on top */}
            <Link
              href="/cart"
              id="header-cart-btn"
              className={`relative inline-flex items-center gap-2 bg-gradient-to-r from-[#580E1E] to-[#3B0820] hover:from-[#721427] hover:to-[#580E1E] text-[#FFF8EE] px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-[#D4AF37]/50 shadow-[0_4px_16px_rgba(212,175,55,0.25)] hover:border-[#F5D061] transition-all active:scale-95 group shrink-0 ${
                itemCount > 0
                  ? "ring-2 ring-[#D4AF37] ring-offset-2 ring-offset-[#16031E] shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                  : ""
              }`}
            >
              <div className="relative">
                <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F5D061] group-hover:scale-110 transition-transform" />
                {itemCount > 0 && (
                  <span className="absolute -top-2.5 -right-2.5 min-w-5 h-5 px-1 rounded-full bg-gradient-to-r from-[#E65100] to-[#FF6F00] text-white text-[10px] font-black flex items-center justify-center shadow-lg border border-white/20 animate-bounce">
                    {itemCount}
                  </span>
                )}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] sm:text-[10px] text-[#F5D061] font-bold leading-none">
                  {itemCount > 0 ? `${itemCount} Sweets` : "Cart"}
                </span>
                <span className="text-[11px] sm:text-xs font-black leading-tight font-mono text-white">
                  ₹{subtotal}
                </span>
              </div>
            </Link>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-lg text-[#FFF8EE] hover:text-[#F5D061] hover:bg-[#2B0938] transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#1D0427] border-b border-[#D4AF37]/30 px-5 py-5 shadow-2xl transition-all">
          <nav className="flex flex-col gap-3 text-sm font-medium text-[#FFF8EE]">
            {isAuthenticated && user?.email && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white">{user.email}</span>
                </div>
                <button onClick={() => logout()} className="text-rose-300 font-semibold text-[11px]">
                  Logout
                </button>
              </div>
            )}

            <Link
              href="/orders"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2.5 px-3 rounded-xl bg-white/5 text-[#F5D061] text-xs font-bold flex items-center justify-between border border-[#D4AF37]/30"
            >
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                <span>My Orders & Receipts</span>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            </Link>

            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuthModal();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#580E1E] to-[#3B0E4D] border border-[#D4AF37]/40 text-white text-xs font-bold flex items-center justify-between cursor-pointer"
              >
                <span>Login / Register (Google or PIN)</span>
                <User className="w-4 h-4 text-[#F5D061]" />
              </button>
            )}

            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 border-b border-white/5 hover:text-[#F5D061] flex items-center justify-between"
              >
                <span>{link.name}</span>
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]/50" />
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>

    {/* Floating Mobile Cart Bar - Always visible on mobile whenever customer has sweets in cart */}
    {itemCount > 0 && (
      <aside
        aria-label="Floating Mobile Cart"
        className="fixed bottom-4 left-3 right-3 sm:hidden z-40 bg-gradient-to-r from-[#580E1E] via-[#3B0820] to-[#580E1E] border-2 border-[#D4AF37] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.85)] p-3 text-white backdrop-blur-md animate-fadeIn"
      >
        <Link
          href="/cart"
          id="mobile-floating-cart-btn"
          className="flex items-center justify-between gap-3 font-bold text-xs"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D4AF37] text-[#16031E] flex items-center justify-center font-black text-xs shadow">
              {itemCount}
            </div>
            <div>
              <span className="block text-[#F5D061] text-[10px] uppercase tracking-wider font-extrabold leading-none">
                Cart Active
              </span>
              <span className="text-sm font-black font-mono leading-tight">₹{subtotal}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F5D061] text-[#16031E] font-black shadow active:scale-95 transition-transform">
            <span>View Cart</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </aside>
    )}

    {/* Customer Profile Section Modal */}
    <RoleProfileModal
      role="customer"
      initialData={{
        email: user?.email,
        name: user?.name,
        phone: user?.phone,
        phone_verified: user?.phone_verified,
      }}
      isOpen={showCustomerProfileModal}
      onClose={() => setShowCustomerProfileModal(false)}
      onProfileUpdated={() => {
        refreshUser?.();
      }}
    />
  </>
  );
}
