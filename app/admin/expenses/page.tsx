"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Expense } from "@/types";
import {
  Receipt,
  Plus,
  RefreshCw,
  CheckCircle2,
  Banknote,
  Smartphone,
  PieChart,
} from "lucide-react";

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Raw materials");
  const [amount, setAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi">("cash");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  const categories = [
    "Raw materials",
    "Purchased sweets",
    "Packaging",
    "Transportation",
    "Delivery",
    "Electricity",
    "Labour",
    "Miscellaneous",
  ];

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/expenses");
      if (res.ok) {
        setExpenses(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;

    setIsSubmitting(true);
    setFeedback("");

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          amount: Number(amount),
          payment_method: paymentMethod,
          expense_date: expenseDate,
          description,
          created_by: "Admin",
        }),
      });

      if (res.ok) {
        setFeedback("Expense recorded successfully!");
        setTitle("");
        setAmount("");
        setDescription("");
        fetchExpenses();
      }
    } catch {
      setFeedback("Failed to record expense.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Category Breakdown
  const categoryTotals = expenses.reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-[#FFF8EE]">
              Operational <span className="gold-gradient-text">Expenses</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#D3BEB0] mt-1">
              Log milk, mawa, silver foil, packaging boxes, gas, and labour outlays for net profit calculation.
            </p>
          </div>

          <button
            onClick={() => fetchExpenses()}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#D4AF37] border border-[#D4AF37]/30 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {feedback && (
          <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Overview & Log Form Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Log New Expense Form */}
          <div className="lg:col-span-7 p-6 rounded-3xl bg-[#1C0324] border border-[#D4AF37]/25 shadow-xl space-y-6">
            <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#F5D061]" />
              <span>Log Business Outlay</span>
            </h2>

            <form onSubmit={handleAddExpense} className="space-y-4 text-xs">
              <div>
                <label className="block text-white/70 font-semibold mb-1">Expense Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 50kg Pure Desi Cow Mawa Batch"
                  className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-white text-sm outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 font-semibold mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-white outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-white/70 font-semibold mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    placeholder="e.g. 4500"
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-white font-bold text-sm outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 font-semibold mb-1">Payment Method</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("cash")}
                      className={`flex-1 py-2 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                        paymentMethod === "cash"
                          ? "bg-emerald-950 text-emerald-300 border-emerald-400"
                          : "bg-[#16031E] text-white/60 border-white/10"
                      }`}
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Cash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("upi")}
                      className={`flex-1 py-2 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                        paymentMethod === "upi"
                          ? "bg-purple-950 text-purple-300 border-purple-400"
                          : "bg-[#16031E] text-white/60 border-white/10"
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>UPI</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-white/70 font-semibold mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/70 font-semibold mb-1">Description / Vendor Note</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Paid to dairy vendor at morning delivery"
                  className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2 text-white outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-full gold-gradient-btn font-bold text-sm shadow-lg active:scale-95 transition-all"
              >
                {isSubmitting ? "Recording..." : "Record Business Expense"}
              </button>
            </form>
          </div>

          {/* Right Column: Category Breakdown */}
          <div className="lg:col-span-5 p-6 rounded-3xl bg-[#1C0324] border border-[#D4AF37]/25 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h2 className="text-lg font-serif font-bold text-[#FFF8EE] flex items-center gap-2">
                <PieChart className="w-5 h-5 text-[#F5D061]" />
                <span>Expense Breakdown</span>
              </h2>
              <span className="text-xl font-serif font-black text-[#F5D061]">
                ₹{totalExpenseAmount}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              {Object.entries(categoryTotals).map(([cat, total]) => {
                const pct = totalExpenseAmount > 0 ? Math.round((total / totalExpenseAmount) * 100) : 0;
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-white/80">
                      <span className="font-semibold">{cat}</span>
                      <span>₹{total} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#D4AF37] to-[#E65100]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Expenses List Table */}
        <div className="p-6 rounded-3xl bg-[#1C0324] border border-[#D4AF37]/25 shadow-xl">
          <h2 className="text-lg font-serif font-bold text-white mb-4">
            Expense Records
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/50 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Expense Title</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Payment</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-white/5">
                    <td className="py-2.5 px-3 text-white/60">{e.expense_date}</td>
                    <td className="py-2.5 px-3 font-semibold text-white">{e.title}</td>
                    <td className="py-2.5 px-3 text-[#D4AF37]">{e.category}</td>
                    <td className="py-2.5 px-3 uppercase text-white/70">{e.payment_method}</td>
                    <td className="py-2.5 px-3 font-serif font-bold text-white">
                      ₹{e.amount}
                    </td>
                    <td className="py-2.5 px-3 text-white/60 max-w-xs truncate">
                      {e.description || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
