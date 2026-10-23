"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { Order } from "@/types";
import { useStoreSettings } from "@/lib/context/store-context";
import {
  ShoppingBag,
  IndianRupee,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  TrendingUp,
  ArrowRight,
  PlusCircle,
  Banknote,
  Settings,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";

interface DashboardMetricsData {
  todayOrdersCount: number;
  todaySalesAmount: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  lowStockCount: number;
  todayExpenses: number;
  estimatedProfit: number;
}

interface AdminDashboardClientProps {
  initialMetrics: DashboardMetricsData;
  initialOrders: Order[];
}

export function AdminDashboardClient({
  initialMetrics,
  initialOrders,
}: AdminDashboardClientProps) {
  const { settings, refreshSettings } = useStoreSettings();
  const [metrics, setMetrics] = useState<DashboardMetricsData>(initialMetrics);
  const [recentOrders, setRecentOrders] = useState<Order[]>(initialOrders);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [recentEventAlert, setRecentEventAlert] = useState<string | null>(null);

  // Shop Timing Quick State
  const [isTimingModalOpen, setIsTimingModalOpen] = useState(false);
  const [quickTiming, setQuickTiming] = useState(settings.operating_hours || "8:00 AM - 10:00 PM");
  const [quickCutoff, setQuickCutoff] = useState(settings.cutoff_time || "20:00 (8:00 PM)");
  const [isSavingTiming, setIsSavingTiming] = useState(false);

  React.useEffect(() => {
    if (settings.operating_hours) setQuickTiming(settings.operating_hours);
    if (settings.cutoff_time) setQuickCutoff(settings.cutoff_time);
  }, [settings.operating_hours, settings.cutoff_time]);

  const handleSaveTiming = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTiming(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operating_hours: quickTiming,
          cutoff_time: quickCutoff,
        }),
      });
      if (res.ok) {
        await refreshSettings();
        setIsTimingModalOpen(false);
        setRecentEventAlert(`Shop timing set to "${quickTiming}" & broadcasted live!`);
      }
    } catch {
      // error
    } finally {
      setIsSavingTiming(false);
    }
  };

  const fetchLiveMetrics = useCallback(async (silent = true) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/metrics?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.metrics) setMetrics(data.metrics);
        if (data.recentOrders) setRecentOrders(data.recentOrders);
      }
    } catch {
      // ignore
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, []);

  const { isConnected } = useRealtime({
    events: [
      "order_created",
      "order_status_updated",
      "offline_sale_created",
      "expense_created",
      "inventory_updated",
    ],
    enablePollingFallback: true,
    pollingIntervalMs: 6000,
    onEvent: (payload) => {
      fetchLiveMetrics(true);
      if (payload.type === "order_created") {
        setRecentEventAlert(
          `🔔 New Order Received: ${payload.data?.order_number || "Order"} by ${payload.data?.customer_name || "Customer"} (₹${payload.data?.total_amount || ""})`
        );
        setTimeout(() => setRecentEventAlert(null), 6000);
      } else if (payload.type === "order_status_updated") {
        setRecentEventAlert(
          `⚡ Order ${payload.data?.order_number || ""} status changed to ${payload.data?.order_status?.replace(/_/g, " ").toUpperCase()}`
        );
        setTimeout(() => setRecentEventAlert(null), 5000);
      }
    },
  });

  const cards = [
    {
      title: "Today's Orders",
      value: metrics.todayOrdersCount,
      sub: "Online bookings today",
      icon: ShoppingBag,
      color: "from-blue-600/20 to-blue-900/20 text-blue-400 border-blue-500/30",
    },
    {
      title: "Today's Total Sales",
      value: `₹${metrics.todaySalesAmount}`,
      sub: "Online + Counter combined",
      icon: IndianRupee,
      color: "from-amber-600/20 to-amber-900/20 text-[#F5D061] border-amber-500/30",
    },
    {
      title: "Pending Orders",
      value: metrics.pendingOrders,
      sub: "Needs packing / dispatch",
      icon: Clock,
      color: "from-purple-600/20 to-purple-900/20 text-purple-400 border-purple-500/30",
    },
    {
      title: "Delivered Orders",
      value: metrics.completedOrders,
      sub: "Completed deliveries",
      icon: CheckCircle2,
      color: "from-emerald-600/20 to-emerald-900/20 text-emerald-400 border-emerald-500/30",
    },
    {
      title: "Low Stock Items",
      value: metrics.lowStockCount,
      sub: "At or below threshold",
      icon: AlertTriangle,
      color: "from-rose-600/20 to-rose-900/20 text-rose-400 border-rose-500/30",
    },
    {
      title: "Today's Expenses",
      value: `₹${metrics.todayExpenses}`,
      sub: "Recorded raw materials/labour",
      icon: Receipt,
      color: "from-orange-600/20 to-orange-900/20 text-orange-400 border-orange-500/30",
    },
    {
      title: "Estimated Profit",
      value: `₹${metrics.estimatedProfit}`,
      sub: "Gross sales minus recorded expenses",
      icon: TrendingUp,
      color: "from-emerald-700/20 to-emerald-950/30 text-emerald-300 border-emerald-500/40",
    },
    {
      title: "Cancelled Orders",
      value: metrics.cancelledOrders,
      sub: "Stock restored safely",
      icon: AlertTriangle,
      color: "from-gray-700/20 to-gray-900/20 text-gray-400 border-gray-600/30",
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 max-w-full">
      {/* Header with live sync indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-[#FFF8EE]">
              Shree Shyam Sweets <span className="gold-gradient-text">Operations</span>
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/70">
              <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <span>{isConnected ? "Realtime Live" : "Connecting..."}</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#D3BEB0]">
            Live operational metrics for Diwali festival trading. Automatically updates on every new order or event.
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fetchLiveMetrics(false)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#D4AF37] border border-white/10 transition-colors"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>

          <Link
            href="/admin/offline-sales"
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-[#16031E] text-xs font-bold flex items-center gap-1.5 shadow-md hover:brightness-110 transition-all"
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>Counter Sale</span>
          </Link>

          <Link
            href="/admin/expenses"
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 flex items-center gap-1.5 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5 text-[#F5D061]" />
            <span>Log Expense</span>
          </Link>

          {/* Quick Shop Timing Button */}
          <button
            type="button"
            onClick={() => {
              setQuickTiming(settings.operating_hours || "8:00 AM - 10:00 PM");
              setQuickCutoff(settings.cutoff_time || "20:00 (8:00 PM)");
              setIsTimingModalOpen(true);
            }}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-[#D4AF37]/30 hover:border-[#D4AF37] flex items-center gap-1.5 transition-colors shadow-sm"
            title="Adjust Today's Shop Timing"
          >
            <Clock className="w-3.5 h-3.5 text-[#F5D061]" />
            <span className="hidden sm:inline text-white/70">Timing:</span>
            <span className="text-[#F5D061] font-bold">{settings.operating_hours}</span>
          </button>

          <Link
            href="/admin/settings"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
            title="Store Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Live Event Toast Banner */}
      {recentEventAlert && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-[#23042B] to-[#1C0324] border-2 border-emerald-400/80 text-emerald-200 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-[0_4px_25px_rgba(16,185,129,0.3)] animate-pulse">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{recentEventAlert}</span>
          </div>
          <button
            onClick={() => setRecentEventAlert(null)}
            className="text-white/60 hover:text-white text-xs px-2 py-0.5 rounded bg-black/40"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 8 Metric Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={i}
              className={`p-5 rounded-2xl bg-gradient-to-br bg-[#1E0427] border shadow-lg transition-all duration-300 hover:scale-[1.01] ${c.color}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                  {c.title}
                </span>
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-serif font-black text-white mb-1">
                {c.value}
              </div>
              <span className="text-[11px] text-white/50 block">{c.sub}</span>
            </div>
          );
        })}
      </div>

      {/* Recent Orders Overview */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#1B0323] border border-[#D4AF37]/25 shadow-xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-serif font-bold text-[#FFF8EE]">
              Recent Customer Orders
            </h2>
            <p className="text-xs text-[#D3BEB0] mt-0.5">
              Latest online festival orders received (live synced)
            </p>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs text-[#F5D061] hover:underline flex items-center gap-1 font-semibold"
          >
            <span>View All Orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/50 font-semibold uppercase text-[10px]">
                <th className="pb-3">Order ID</th>
                <th className="pb-3">Customer</th>
                <th className="pb-3">Locality</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Payment</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-white/50">
                    No orders received yet.
                  </td>
                </tr>
              ) : (
                recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 font-mono font-bold text-[#F5D061]">
                      {o.order_number}
                    </td>
                    <td className="py-3">
                      <span className="font-semibold text-white block">{o.customer_name}</span>
                      <span className="text-white/50 text-[10px]">{o.customer_phone}</span>
                    </td>
                    <td className="py-3 text-white/80">{o.locality}</td>
                    <td className="py-3 font-serif font-bold text-white text-sm">
                      ₹{o.total_amount}
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          o.payment_status === "paid"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                            : "bg-amber-950 text-amber-300 border border-amber-500/40"
                        }`}
                      >
                        {o.payment_method.toUpperCase()} ({o.payment_status})
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-white font-medium capitalize text-[10px]">
                        {o.order_status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/admin/orders`}
                        className="text-xs text-[#D4AF37] hover:underline font-semibold"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Shop Timing Modal */}
      {isTimingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#1C0324] border border-[#D4AF37]/40 shadow-2xl overflow-hidden p-6 text-white space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#F5D061]" />
                <h3 className="text-base font-serif font-bold text-white">Adjust Shop Timing</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTimingModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/10 text-white/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#D3BEB0] leading-relaxed">
              Shop timings can vary depending on festival rush or morning/evening sweet batches. Setting timings here updates the customer storefront, FAQs, delivery info, and header in real time.
            </p>

            <form onSubmit={handleSaveTiming} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">
                  Active Shop Timing (Counter Hours)
                </label>
                <input
                  type="text"
                  value={quickTiming}
                  onChange={(e) => setQuickTiming(e.target.value)}
                  placeholder="e.g. 8:00 AM - 10:00 PM"
                  className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-xs font-bold text-white outline-none"
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    "8:00 AM - 10:00 PM",
                    "7:00 AM - 11:00 PM",
                    "6:00 AM - Midnight",
                    "9:00 AM - 9:00 PM",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setQuickTiming(preset)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                        quickTiming === preset
                          ? "bg-[#D4AF37] text-[#16031E] font-bold border-[#D4AF37]"
                          : "bg-white/5 border-white/10 text-white/70 hover:text-white"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">
                  Daily Order Cutoff Time
                </label>
                <input
                  type="text"
                  value={quickCutoff}
                  onChange={(e) => setQuickCutoff(e.target.value)}
                  placeholder="e.g. 20:00 (8:00 PM)"
                  className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-xs font-bold text-white outline-none"
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["20:00 (8:00 PM)", "21:30 (9:30 PM)", "22:00 (10:00 PM)", "23:00 (11:00 PM)"].map(
                    (preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setQuickCutoff(preset)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                          quickCutoff === preset
                            ? "bg-[#D4AF37] text-[#16031E] font-bold border-[#D4AF37]"
                            : "bg-white/5 border-white/10 text-white/70 hover:text-white"
                        }`}
                      >
                        {preset}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsTimingModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/70 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTiming}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-[#16031E] text-xs font-bold shadow-md hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {isSavingTiming ? "Saving..." : "Save & Broadcast Timing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
