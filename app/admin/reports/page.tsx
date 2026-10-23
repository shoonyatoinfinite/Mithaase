"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  IndianRupee,
  ShoppingBag,
  Banknote,
  Smartphone,
  RefreshCw,
} from "lucide-react";

export default function AdminReportsPage() {
  const [range, setRange] = useState("all");
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      ["Total Completed Orders", data.ordersCount],
      ["Total Counter Transactions", data.offlineSalesCount],
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

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-[#FFF8EE]">
              Sales, Expenses & <span className="gold-gradient-text">Profit Reports</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#D3BEB0] mt-1">
              Consolidated business performance across online storefront and shop-counter sales.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={!data}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4 text-[#F5D061]" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => fetchReports()}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#D4AF37] border border-white/10"
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
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
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
            {/* Top Revenue Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-[#1C0324] border border-[#D4AF37]/35 shadow-lg">
                <span className="text-[11px] uppercase font-bold text-white/60 block mb-1">
                  Gross Sales (Combined)
                </span>
                <span className="text-3xl font-serif font-black text-[#F5D061]">
                  ₹{data.grossRevenue}
                </span>
                <span className="text-[11px] text-white/50 block mt-1">
                  Online: ₹{data.onlineTotal} | Counter: ₹{data.offlineTotal}
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-[#1C0324] border border-white/10 shadow-lg">
                <span className="text-[11px] uppercase font-bold text-white/60 block mb-1">
                  Delivery Fees Collected
                </span>
                <span className="text-3xl font-serif font-black text-white">
                  ₹{data.onlineDeliveryFee}
                </span>
                <span className="text-[11px] text-white/50 block mt-1">
                  Flat ₹21 per online order
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-[#1C0324] border border-white/10 shadow-lg">
                <span className="text-[11px] uppercase font-bold text-white/60 block mb-1">
                  Recorded Expenses
                </span>
                <span className="text-3xl font-serif font-black text-rose-300">
                  ₹{data.totalExpenses}
                </span>
                <span className="text-[11px] text-white/50 block mt-1">
                  Raw materials, packaging, labour
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-[#1C0324] border border-emerald-500/40 shadow-lg">
                <span className="text-[11px] uppercase font-bold text-emerald-400 block mb-1">
                  Estimated Profit *
                </span>
                <span className="text-3xl font-serif font-black text-emerald-300">
                  ₹{data.estimatedProfit}
                </span>
                <span className="text-[10px] text-emerald-400/80 block mt-1 italic">
                  *Gross sales minus recorded expenses
                </span>
              </div>
            </div>

            {/* Payment Method Split & Channel Split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Channel Split */}
              <div className="p-6 rounded-3xl bg-[#1C0324] border border-white/10 shadow-xl space-y-4">
                <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#F5D061]" />
                  <span>Online vs. Offline Channel Split</span>
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex justify-between text-white/80 mb-1">
                      <span>Online Storefront Delivery</span>
                      <span className="font-bold">
                        ₹{data.onlineTotal} ({data.ordersCount} orders)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-[#D4AF37]"
                        style={{
                          width: `${
                            data.grossRevenue > 0
                              ? (data.onlineTotal / data.grossRevenue) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-white/80 mb-1">
                      <span>Walk-in Counter Transactions</span>
                      <span className="font-bold">
                        ₹{data.offlineTotal} ({data.offlineSalesCount} sales)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{
                          width: `${
                            data.grossRevenue > 0
                              ? (data.offlineTotal / data.grossRevenue) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Methods Split */}
              <div className="p-6 rounded-3xl bg-[#1C0324] border border-white/10 shadow-xl space-y-4">
                <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-[#F5D061]" />
                  <span>Cash vs. UPI Collections</span>
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2 text-emerald-400 mb-1">
                      <Banknote className="w-4 h-4" />
                      <span className="font-bold">Cash</span>
                    </div>
                    <span className="text-2xl font-serif font-black text-white block">
                      ₹{data.paymentMethods.cash}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2 text-purple-400 mb-1">
                      <Smartphone className="w-4 h-4" />
                      <span className="font-bold">UPI</span>
                    </div>
                    <span className="text-2xl font-serif font-black text-white block">
                      ₹{data.paymentMethods.upi}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bestselling Sweets Table */}
            <div className="p-6 rounded-3xl bg-[#1C0324] border border-[#D4AF37]/25 shadow-xl">
              <h3 className="text-base font-serif font-bold text-white mb-4">
                Bestselling Sweets by Revenue & Units
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Sweet Name</th>
                      <th className="py-2.5 px-3">Units Sold</th>
                      <th className="py-2.5 px-3">Total Revenue</th>
                      <th className="py-2.5 px-3">Share of Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.topProducts.map((p: any) => {
                      const share =
                        data.grossRevenue > 0
                          ? Math.round((p.revenue / data.grossRevenue) * 100)
                          : 0;
                      return (
                        <tr key={p.name} className="hover:bg-white/5">
                          <td className="py-2.5 px-3 font-semibold text-white">
                            {p.name}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-white">
                            {p.units}
                          </td>
                          <td className="py-2.5 px-3 font-serif font-bold text-[#F5D061]">
                            ₹{p.revenue}
                          </td>
                          <td className="py-2.5 px-3 text-white/70">{share}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
