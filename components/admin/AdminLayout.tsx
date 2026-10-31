"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStoreSettings } from "@/lib/context/store-context";
import { Diya } from "@/components/animations/Diya";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Layers,
  Banknote,
  Receipt,
  BarChart3,
  Settings,
  ExternalLink,
  Menu,
  X,
  Shield,
  Sparkles,
  LogOut,
  Ticket,
  Clock,
  Bike,
  User,
} from "lucide-react";

import { AdminQuickOrderTracker } from "./AdminQuickOrderTracker";
import { AdminRiderStatusTracker } from "./AdminRiderStatusTracker";
import { OrderAlertCard } from "@/components/notifications/OrderAlertCard";
import { playBeepNotification } from "@/lib/utils/audio";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { Order } from "@/types";
import { RoleProfileModal } from "@/components/profile/RoleProfileModal";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { settings } = useStoreSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [incomingOrderAlert, setIncomingOrderAlert] = useState<Order | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const lastAlertedOrderIdRef = React.useRef<string | null>(null);
  const isInitialLoadRef = React.useRef(true);

  // Helper to trigger incoming order alert
  const triggerOrderAlert = React.useCallback((order: Order) => {
    if (!order || !order.id) return;
    if (lastAlertedOrderIdRef.current === order.id) return;
    lastAlertedOrderIdRef.current = order.id;

    // 1. Play continuous chime
    playBeepNotification(3);
    // 2. Display alert card
    setIncomingOrderAlert(order);
  }, []);

  // Real-time listener for incoming orders
  const { isConnected } = useRealtime({
    events: ["order_created"],
    enablePollingFallback: true,
    pollingIntervalMs: 3500,
    onEvent: async (payload) => {
      if (payload.type === "order_created" && payload.data) {
        const orderData = payload.data as Order;
        const orderId = orderData.id || (orderData as any).orderId;

        // If payload already has full fields, show immediately
        if (orderData.items && orderData.customer_name) {
          triggerOrderAlert(orderData);
        }

        // Fetch authoritative fresh order from database to ensure complete relations
        if (orderId) {
          try {
            const res = await fetch(`/api/orders/${orderId}?t=${Date.now()}`);
            if (res.ok) {
              const fullOrder = await res.json();
              triggerOrderAlert(fullOrder);
            }
          } catch { }
        }
      }
    },
  });

  // Active polling fallback: ensures admin receives alert cards even in serverless process decoupling
  React.useEffect(() => {
    let isCancelled = false;

    const checkLatestOrders = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch(`/api/orders?limit=1&t=${Date.now()}`);
        if (!res.ok) return;
        const orders = await res.json();
        if (!Array.isArray(orders) || orders.length === 0) return;

        const latest = orders[0] as Order;

        // On first mount, record the latest order so we don't alert old past orders
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
          lastAlertedOrderIdRef.current = latest.id;
          return;
        }

        // Subsequent polls: if a new order arrives within the last 90 seconds
        if (latest.id && latest.id !== lastAlertedOrderIdRef.current) {
          const orderAgeMs = Date.now() - new Date(latest.created_at).getTime();
          if (orderAgeMs < 120000 && !isCancelled) {
            triggerOrderAlert(latest);
          } else {
            lastAlertedOrderIdRef.current = latest.id;
          }
        }
      } catch { }
    };

    const interval = setInterval(checkLatestOrders, 4000);
    // Run initial fetch to prime lastAlertedOrderIdRef
    checkLatestOrders();

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [triggerOrderAlert]);

  const handleAdminAccept = async (order: Order) => {
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_status: "confirmed",
          note: "Order accepted by Admin via alert card",
          changed_by: "Admin",
        }),
      });
      setIncomingOrderAlert(null);
    } catch (err) {
      console.error("Error accepting order in admin:", err);
      setIncomingOrderAlert(null);
    }
  };

  const handleAdminQueue = () => {
    // Keep in queue, dismiss the temporary alert card
    setIncomingOrderAlert(null);
  };

  const navItems = [
    { name: "Overview", href: "/admin", icon: LayoutDashboard },
    { name: "Orders", href: "/admin/orders", icon: ShoppingBag },
    { name: "Delivery Fleet (Riders)", href: "/admin/riders", icon: Bike },
    { name: "Products & Prices", href: "/admin/products", icon: Package },
    { name: "Coupons & Offers", href: "/admin/coupons", icon: Ticket },
    { name: "Inventory", href: "/admin/inventory", icon: Layers },
    { name: "Counter Sales", href: "/admin/offline-sales", icon: Banknote },
    { name: "Expenses", href: "/admin/expenses", icon: Receipt },
    { name: "Reports & Profit", href: "/admin/reports", icon: BarChart3 },
    { name: "Store Controls", href: "/admin/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#110115] text-[#FFF8EE] flex flex-col md:flex-row overflow-x-hidden max-w-full w-full">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#1C0324] border-b border-[#D4AF37]/30 sticky top-0 z-30">
        <Link href="/admin" className="flex items-center gap-2">
          <Diya size="sm" className="scale-75" />
          <span className="font-serif font-bold text-lg text-[#F5D061]">Mithaasé Admin</span>
        </Link>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg bg-white/5 text-white"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-[#180320] border-r border-[#D4AF37]/25 flex flex-col justify-between p-4 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
      >
        <div>
          {/* Logo & Store Info */}
          <div className="pb-6 mb-4 border-b border-white/10">
            <Link href="/admin" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-full bg-[#400B16] border border-[#D4AF37] flex items-center justify-center">
                <Diya size="sm" className="scale-75" />
              </div>
              <div className="flex flex-col">
                <span className="font-serif font-black text-lg text-white group-hover:text-[#F5D061] transition-colors leading-none">
                  Mithaasé
                </span>
                <span className="text-[10px] text-[#D4AF37] uppercase tracking-wider font-semibold mt-0.5">
                  Admin Panel
                </span>
              </div>
            </Link>

            {/* Store Status Pill & Timing */}
            <div className="mt-4 p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-2 h-2 rounded-full ${settings.store_status === "open" ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                      }`}
                  />
                  <span className="capitalize font-semibold text-white">
                    {settings.store_status}
                  </span>
                </div>
                <span className="text-[10px] text-[#F5D061] font-medium">
                  Fee: ₹{settings.default_delivery_fee}
                </span>
              </div>
              <Link
                href="/admin/settings"
                className="flex items-center justify-between text-[10px] text-white/60 hover:text-[#F5D061] transition-colors pt-1.5 border-t border-white/5"
                title="Click to adjust shop timing in store controls"
              >
                <span className="flex items-center gap-1 text-[#D4AF37]">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>Timing:</span>
                </span>
                <span className="font-semibold text-white/90 truncate max-w-[120px]">
                  {settings.operating_hours}
                </span>
              </Link>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${isActive
                      ? "bg-[#D4AF37] text-[#16031E] shadow-md font-bold"
                      : "text-[#D3BEB0] hover:text-white hover:bg-white/5"
                    }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions: Link to Storefront & Logout */}
        <div className="pt-4 border-t border-white/10 space-y-2">
          <Link
            href="/"
            target="_blank"
            className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold text-[#D3BEB0] hover:text-[#F5D061] hover:bg-white/5 transition-all"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Customer Storefront</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-bold">Live</span>
          </Link>

          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                sessionStorage.removeItem("mithaase_admin_auth");
                sessionStorage.removeItem("mithaase_admin_id");
                sessionStorage.removeItem("mithaase_admin_name");
                sessionStorage.removeItem("mithaase_admin_email");
                document.cookie = "mithaase_admin_session=; path=/; max-age=0";
                router.push("/admin/login");
                router.refresh();
              }
            }}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-100 hover:bg-rose-950/40 transition-all text-left"
          >
            <span className="flex items-center gap-2">
              <LogOut className="w-3.5 h-3.5" />
              <span>Staff Sign Out</span>
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 p-3.5 sm:p-6 lg:p-8 overflow-y-auto overflow-x-hidden max-w-full w-full">
        {/* Top Control Bar with 4-Digit Quick Order Tracker */}
        <div className="mb-6 p-3 sm:p-4 rounded-2xl bg-[#1C0324] border border-[#D4AF37]/30 shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 max-w-full">
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-xs font-semibold text-white/90">
              Shree Shyam Sweets Admin Console
            </span>
            <span className="text-[10px] text-[#D4AF37] px-2 py-0.5 rounded-full bg-[#D4AF37]/10 font-mono hidden md:inline-block">
              {isConnected ? "Real-time Live Sync" : "Syncing..."}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* Quick 4-Digit Order Tracker Box */}
            <AdminQuickOrderTracker />

            {/* Quick Live Rider Status Tracker Modal */}
            <AdminRiderStatusTracker />

            {/* Admin Profile Section Button with Green Logged-In Indicator inside at top */}
            <button
              onClick={() => setIsProfileOpen(true)}
              className="px-3 py-2 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#F5D061] text-xs font-bold border border-[#D4AF37]/40 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-sm active:scale-95"
              title="View and Edit Admin Profile"
            >
              <div className="relative">
                <User className="w-3.5 h-3.5" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 border border-[#16031E] ring-1 ring-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse" />
              </div>
              <span className="hidden sm:inline">My Profile</span>
            </button>
          </div>
        </div>

        {/* 10-Second Incoming Order Alert Card */}
        {incomingOrderAlert && (
          <OrderAlertCard
            order={incomingOrderAlert}
            title="New Online Order"
            badgeType="new_order"
            mode="admin"
            onDismiss={() => setIncomingOrderAlert(null)}
            onAccept={handleAdminAccept}
            onQueue={handleAdminQueue}
            actionHref={`/admin/orders?selected=${incomingOrderAlert.id}`}
            actionLabel="View in Orders"
          />
        )}

        {children}

        {/* Admin Profile Modal */}
        <RoleProfileModal
          role="admin"
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
        />
      </main>
    </div>
  );
}
