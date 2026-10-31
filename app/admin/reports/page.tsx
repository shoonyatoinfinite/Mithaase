"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  TrendingUp,
  Download,
  Calendar,
  IndianRupee,
  ShoppingBag,
  Banknote,
  Smartphone,
  RefreshCw,
  PieChart,
  Truck,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Package,
} from "lucide-react";

export default function AdminReportsPage() {
  const [range, setRange] = useState("all");
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/reports?range=${range}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleExportCSV = () => {
    if (!data) return;

    const rows = [
      ["Metric", "Value"],
      ["Gross Revenue", `INR ${data.grossRevenue}`],
      ["Online Orders Total", `INR ${data.onlineTotal}`],
      ["Offline Counter Total", `INR ${data.offlineTotal}`],
      ["Delivery Fees Collected", `INR ${data.onlineDeliveryFee}`],
      ["Recorded Expenses", `INR ${data.totalExpenses}`],
      ["Estimated Profit", `INR ${data.estimatedProfit}`],
      ["Profit Margin (%)", `${data.profitMargin}%`],
      ["Total Completed Orders", data.ordersCount],
      ["Total Counter Transactions", data.offlineSalesCount],
      ["Average Online Order Value", `INR ${data.avgOnlineOrderValue}`],
      ["Average Counter Sale Value", `INR ${data.avgOfflineSaleValue}`],
      [],
      ["Product Name", "Units Sold", "Revenue (INR)"],
      ...data.topProducts.map((p: any) => [p.name, p.units, p.revenue]),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows.map((e) => e.map((val: any) => `"${val}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mithaase_sales_report_${range}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const timeline = data?.timeline || [];
  const maxRevenue = Math.max(1, ...timeline.map((t: any) => t.totalRevenue || 0));
  const maxOrders = Math.max(1, ...timeline.map((t: any) => (t.ordersCount || 0) + (t.offlineCount || 0)));

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-[#FFF8EE]">
              Sales, Expenses & <span className="gold-gradient-text">Visual Analytics</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#D3BEB0] mt-1">
              Visual performance metrics, daily sales graphs, kitchen margin analysis, and customer order breakdown.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={!data}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#F5D061]" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => fetchReports()}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#D4AF37] border border-white/10 cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <Calendar className="w-4 h-4 text-[#F5D061] shrink-0 mr-1" />
          {[
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "7days", label: "Last 7 Days" },
            { id: "all", label: "All Festival Days" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRange(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                range === tab.id
                  ? "bg-[#D4AF37] text-[#16031E] border-[#F5D061] font-bold shadow-md"
                  : "bg-[#1C0324] text-[#D3BEB0] border-white/10 hover:border-white/20"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {data && (
          <>
            {/* Top KPI Cards with Visual Trend Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Gross Sales */}
              <div className="p-5 rounded-3xl bg-[#1C0324] border border-[#D4AF37]/35 shadow-xl relative overflow-hidden group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] uppercase font-bold text-white/60">
                    Gross Revenue (Combined)
                  </span>
                  <span className="p-1.5 rounded-lg bg-amber-500/20 text-[#F5D061]">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="text-3xl font-serif font-black text-[#F5D061] mb-1">
                  ₹{Number(data.grossRevenue).toLocaleString("en-IN")}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-white/50">
                  <span>Online: ₹{data.onlineTotal}</span>
                  <span>•</span>
                  <span>Counter: ₹{data.offlineTotal}</span>
                </div>
              </div>

              {/* Estimated Net Profit */}
              <div className="p-5 rounded-3xl bg-[#1C0324] border border-emerald-500/40 shadow-xl relative overflow-hidden group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] uppercase font-bold text-emerald-400">
                    Net Profit (Estimated)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] flex items-center gap-0.5">
                    <ArrowUpRight className="w-3 h-3" />
                    {data.profitMargin}% Margin
                  </span>
                </div>
                <div className="text-3xl font-serif font-black text-emerald-300 mb-1">
                  ₹{Number(data.estimatedProfit).toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] text-emerald-400/80">
                  Gross Sales minus ₹{Number(data.totalExpenses).toLocaleString("en-IN")} recorded expenses
                </div>
              </div>

              {/* Order Volume & Transactions */}
              <div className="p-5 rounded-3xl bg-[#1C0324] border border-white/10 shadow-xl">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] uppercase font-bold text-white/60">
                    Total Transactions
                  </span>
                  <span className="p-1.5 rounded-lg bg-white/10 text-white/70">
                    <ShoppingBag className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="text-3xl font-serif font-black text-white mb-1">
                  {data.ordersCount + data.offlineSalesCount}
                </div>
                <div className="text-[11px] text-white/50">
                  {data.ordersCount} Online Deliveries • {data.offlineSalesCount} Counter Sales
                </div>
              </div>

              {/* Average Order Value */}
              <div className="p-5 rounded-3xl bg-[#1C0324] border border-white/10 shadow-xl">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] uppercase font-bold text-white/60">
                    Average Order Value (AOV)
                  </span>
                  <span className="p-1.5 rounded-lg bg-white/10 text-white/70">
                    <IndianRupee className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="text-3xl font-serif font-black text-white mb-1">
                  ₹{data.avgOnlineOrderValue || 0}
                </div>
                <div className="text-[11px] text-white/50">
                  Online AOV: ₹{data.avgOnlineOrderValue} | Counter: ₹{data.avgOfflineSaleValue}
                </div>
              </div>
            </div>

            {/* Interactive Daily Sales & Orders Visual Trend Chart */}
            {timeline.length > 0 && (
              <div className="p-6 rounded-3xl bg-[#1C0324] border border-[#D4AF37]/30 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div>
                    <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#F5D061]" />
                      <span>Daily Revenue & Sales Volume Timeline</span>
                    </h3>
                    <p className="text-xs text-[#D3BEB0] mt-0.5">
                      Visual comparison between online doorstep delivery revenue and offline sweet counter sales.
                    </p>
                  </div>

                  {/* Chart Legend */}
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-md bg-[#D4AF37]" />
                      <span className="text-white/80">Online Delivery</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-md bg-emerald-500" />
                      <span className="text-white/80">Counter Sales</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 ring-2 ring-cyan-400/30" />
                      <span className="text-white/80">Orders Count</span>
                    </div>
                  </div>
                </div>

                {/* SVG Visual Graph */}
                <div className="relative pt-6 pb-2">
                  <div className="h-64 sm:h-72 w-full flex items-end gap-2 sm:gap-4 px-2">
                    {timeline.map((point: any, idx: number) => {
                      const totalDayRevenue = point.totalRevenue || 0;
                      const barHeightPercent = Math.max(4, Math.round((totalDayRevenue / maxRevenue) * 100));
                      const onlineShare = totalDayRevenue > 0 ? (point.onlineRevenue / totalDayRevenue) * 100 : 50;
                      const isHovered = hoveredPoint?.date === point.date;

                      return (
                        <div
                          key={point.date || idx}
                          onMouseEnter={() => setHoveredPoint(point)}
                          onMouseLeave={() => setHoveredPoint(null)}
                          className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                        >
                          {/* Tooltip on hover */}
                          {isHovered && (
                            <div className="absolute -top-24 z-30 p-3 rounded-xl bg-[#140219] border border-[#D4AF37]/50 shadow-2xl text-[11px] whitespace-nowrap pointer-events-none animate-fade-in">
                              <p className="font-bold text-[#F5D061]">{point.label} ({point.date})</p>
                              <p className="text-white font-mono mt-0.5">Total: ₹{point.totalRevenue}</p>
                              <p className="text-amber-300">Online: ₹{point.onlineRevenue} ({point.ordersCount} orders)</p>
                              <p className="text-emerald-300">Counter: ₹{point.offlineRevenue} ({point.offlineCount} sales)</p>
                            </div>
                          )}

                          {/* Stacked Revenue Bar */}
                          <div
                            className={`w-full max-w-[42px] rounded-t-xl overflow-hidden flex flex-col-reverse transition-all duration-300 ${
                              isHovered ? "ring-2 ring-white scale-105" : "hover:brightness-110"
                            }`}
                            style={{ height: `${barHeightPercent}%` }}
                          >
                            {/* Online Portion (Gold) */}
                            <div
                              className="w-full bg-gradient-to-t from-[#B8860B] to-[#F5D061]"
                              style={{ height: `${onlineShare}%` }}
                            />
                            {/* Offline Portion (Emerald) */}
                            <div
                              className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400"
                              style={{ height: `${100 - onlineShare}%` }}
                            />
                          </div>

                          {/* Date Label */}
                          <span className="text-[10px] sm:text-xs text-white/60 mt-2 font-medium truncate max-w-[48px] text-center">
                            {point.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Subtitle Details */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-wrap items-center justify-between text-xs text-[#D3BEB0] gap-2">
                  <span>
                    Highest Peak Revenue: <strong className="text-[#F5D061]">₹{maxRevenue}</strong>
                  </span>
                  <span>
                    Total Active Days in Range: <strong className="text-white">{timeline.length} days</strong>
                  </span>
                  <span>
                    Combined Transactions: <strong className="text-white">{data.ordersCount + data.offlineSalesCount}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Sales vs Expenses vs Net Profit Bar Comparison */}
            <div className="p-6 rounded-3xl bg-[#1C0324] border border-white/10 shadow-xl space-y-4">
              <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#F5D061]" />
                <span>Financial Health: Revenue vs. Expenses vs. Retained Profit</span>
              </h3>

              <div className="space-y-4 text-xs">
                {/* Visual Proportional Bar */}
                <div className="w-full h-5 rounded-full bg-white/10 overflow-hidden flex p-0.5 border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-l-full transition-all duration-700"
                    style={{
                      width: `${data.grossRevenue > 0 ? (Math.max(0, data.estimatedProfit) / data.grossRevenue) * 100 : 50}%`,
                    }}
                    title={`Net Profit: ₹${data.estimatedProfit} (${data.profitMargin}%)`}
                  />
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-r-full transition-all duration-700"
                    style={{
                      width: `${data.grossRevenue > 0 ? (data.totalExpenses / data.grossRevenue) * 100 : 50}%`,
                    }}
                    title={`Recorded Expenses: ₹${data.totalExpenses}`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-white/50 block uppercase">Total Inflows (Gross)</span>
                    <span className="text-lg font-serif font-bold text-white">₹{data.grossRevenue}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30">
                    <span className="text-[10px] text-rose-300 block uppercase">Outflows (Expenses)</span>
                    <span className="text-lg font-serif font-bold text-rose-400">-₹{data.totalExpenses}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                    <span className="text-[10px] text-emerald-300 block uppercase">Retained Profit ({data.profitMargin}%)</span>
                    <span className="text-lg font-serif font-bold text-emerald-400">+₹{data.estimatedProfit}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Channels & Payment Breakdown Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Channel Split (Online vs Counter) */}
              <div className="p-6 rounded-3xl bg-[#1C0324] border border-white/10 shadow-xl space-y-4">
                <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#F5D061]" />
                  <span>Channel Revenue Distribution</span>
                </h3>

                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex justify-between text-white/80 mb-1.5">
                      <span className="font-semibold flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]" />
                        Online Doorstep Delivery
                      </span>
                      <span className="font-mono font-bold text-[#F5D061]">
                        ₹{data.onlineTotal} ({data.grossRevenue > 0 ? Math.round((data.onlineTotal / data.grossRevenue) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F5D061]"
                        style={{
                          width: `${data.grossRevenue > 0 ? (data.onlineTotal / data.grossRevenue) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-white/50 block mt-1">
                      {data.ordersCount} total orders • ₹{data.onlineDeliveryFee} delivery fees collected
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-white/80 mb-1.5">
                      <span className="font-semibold flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        Walk-in Counter Transactions
                      </span>
                      <span className="font-mono font-bold text-emerald-400">
                        ₹{data.offlineTotal} ({data.grossRevenue > 0 ? Math.round((data.offlineTotal / data.grossRevenue) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                        style={{
                          width: `${data.grossRevenue > 0 ? (data.offlineTotal / data.grossRevenue) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-white/50 block mt-1">
                      {data.offlineSalesCount} counter slips recorded
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Methods Split (Cash vs UPI) */}
              <div className="p-6 rounded-3xl bg-[#1C0324] border border-white/10 shadow-xl space-y-4">
                <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-[#F5D061]" />
                  <span>Collections: UPI vs. Cash (COD & Counter)</span>
                </h3>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-purple-400">
                        <Smartphone className="w-4 h-4" />
                        <span className="font-bold">UPI Digital</span>
                      </div>
                      <span className="text-[10px] font-bold text-purple-300">
                        {data.grossRevenue > 0
                          ? Math.round((data.paymentMethods.upi / data.grossRevenue) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                    <span className="text-2xl font-serif font-black text-white block">
                      ₹{data.paymentMethods.upi}
                    </span>
                    <span className="text-[10px] text-white/50 mt-1 block">
                      Auto-verified & instant payment
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <Banknote className="w-4 h-4" />
                        <span className="font-bold">Cash Currency</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-300">
                        {data.grossRevenue > 0
                          ? Math.round((data.paymentMethods.cash / data.grossRevenue) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                    <span className="text-2xl font-serif font-black text-white block">
                      ₹{data.paymentMethods.cash}
                    </span>
                    <span className="text-[10px] text-white/50 mt-1 block">
                      Doorstep COD & counter cash
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Status Distribution Pills */}
            {data.orderStatusBreakdown && (
              <div className="p-6 rounded-3xl bg-[#1C0324] border border-white/10 shadow-xl space-y-3">
                <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Order Pipeline & Status Breakdown</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-center">
                    <span className="text-[10px] text-emerald-300 font-bold uppercase block">Delivered</span>
                    <span className="text-xl font-bold font-mono text-emerald-400">{data.orderStatusBreakdown.delivered || 0}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-center">
                    <span className="text-[10px] text-cyan-300 font-bold uppercase block">On The Way</span>
                    <span className="text-xl font-bold font-mono text-cyan-400">{data.orderStatusBreakdown.out_for_delivery || 0}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-center">
                    <span className="text-[10px] text-amber-300 font-bold uppercase block">Preparing</span>
                    <span className="text-xl font-bold font-mono text-amber-400">{data.orderStatusBreakdown.preparing || 0}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-center">
                    <span className="text-[10px] text-purple-300 font-bold uppercase block">Confirmed</span>
                    <span className="text-xl font-bold font-mono text-purple-400">{data.orderStatusBreakdown.confirmed || 0}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-yellow-950/40 border border-yellow-500/30 text-center">
                    <span className="text-[10px] text-yellow-300 font-bold uppercase block">Pending</span>
                    <span className="text-xl font-bold font-mono text-yellow-400">{data.orderStatusBreakdown.pending_confirmation || 0}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-center">
                    <span className="text-[10px] text-rose-300 font-bold uppercase block">Cancelled</span>
                    <span className="text-xl font-bold font-mono text-rose-400">{data.orderStatusBreakdown.cancelled || 0}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bestselling Sweets Table & Visual Bar Ranking */}
            <div className="p-6 rounded-3xl bg-[#1C0324] border border-[#D4AF37]/25 shadow-xl space-y-4">
              <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-[#F5D061]" />
                <span>Bestselling Sweets Visual Leaderboard</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Sweet Name</th>
                      <th className="py-2.5 px-3">Portions Sold</th>
                      <th className="py-2.5 px-3">Total Revenue</th>
                      <th className="py-2.5 px-3">Market Share Visual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.topProducts.map((p: any) => {
                      const share =
                        data.grossRevenue > 0
                          ? Math.round((p.revenue / data.grossRevenue) * 100)
                          : 0;
                      return (
                        <tr key={p.name} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-3 font-semibold text-white">
                            {p.name}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-white">
                            {p.units} units
                          </td>
                          <td className="py-3 px-3 font-serif font-bold text-[#F5D061]">
                            ₹{p.revenue}
                          </td>
                          <td className="py-3 px-3 min-w-[140px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F5D061]"
                                  style={{ width: `${Math.min(100, share * 2.5)}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-mono text-white/70 w-8 text-right">
                                {share}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expense Breakdown Categories */}
            {data.expenseBreakdown && Object.keys(data.expenseBreakdown).length > 0 && (
              <div className="p-6 rounded-3xl bg-[#1C0324] border border-white/10 shadow-xl space-y-4">
                <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-rose-400" />
                  <span>Recorded Expense Categories</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {Object.entries(data.expenseBreakdown).map(([cat, amount]: [string, any]) => {
                    const percent = data.totalExpenses > 0 ? Math.round((amount / data.totalExpenses) * 100) : 0;
                    return (
                      <div key={cat} className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                        <span className="capitalize text-white/60 font-medium block mb-1">
                          {cat.replace(/_/g, " ")}
                        </span>
                        <div className="flex justify-between items-baseline">
                          <span className="text-lg font-serif font-bold text-rose-300">₹{amount}</span>
                          <span className="text-[11px] text-white/40 font-mono">{percent}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mt-2">
                          <div className="h-full bg-rose-400" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
