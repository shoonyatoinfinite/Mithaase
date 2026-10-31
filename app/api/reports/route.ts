import { NextResponse } from "next/server";
import { getOrders, getOfflineSales, getExpenses, getAllProductsAdmin } from "@/lib/data/store";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "all"; // 'today', 'yesterday', '7days', 'all'

    const orders = await getOrders();
    const offlineSales = await getOfflineSales();
    const expenses = await getExpenses();
    const products = await getAllProductsAdmin();

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const yesterday = new Date(now.getTime() - 86400000).toISOString().split("T")[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

    const filterByDate = (dateStr: string) => {
      if (range === "today") return dateStr.startsWith(todayStr);
      if (range === "yesterday") return dateStr.startsWith(yesterday);
      if (range === "7days") return dateStr >= sevenDaysAgo;
      return true;
    };

    const filteredOrders = orders.filter((o) => filterByDate(o.created_at));
    const filteredOfflineSales = offlineSales.filter((s) => filterByDate(s.created_at));
    const filteredExpenses = expenses.filter((e) => filterByDate(e.expense_date));

    // Revenue calculations
    const validOnlineOrders = filteredOrders.filter((o) => o.order_status !== "cancelled");
    const onlineGross = validOnlineOrders.reduce((sum, o) => sum + o.subtotal, 0);
    const onlineDeliveryFee = validOnlineOrders.reduce((sum, o) => sum + o.delivery_charge, 0);
    const onlineTotal = validOnlineOrders.reduce((sum, o) => sum + o.total_amount, 0);

    const offlineTotal = filteredOfflineSales.reduce((sum, s) => sum + s.total_amount, 0);
    const grossRevenue = onlineTotal + offlineTotal;
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const estimatedProfit = grossRevenue - totalExpenses;
    const profitMargin = grossRevenue > 0 ? Math.round((estimatedProfit / grossRevenue) * 100) : 0;

    // Average Order Values
    const avgOnlineOrderValue =
      validOnlineOrders.length > 0 ? Math.round(onlineTotal / validOnlineOrders.length) : 0;
    const avgOfflineSaleValue =
      filteredOfflineSales.length > 0 ? Math.round(offlineTotal / filteredOfflineSales.length) : 0;

    // Payment methods breakdown
    const paymentMethods = {
      cash: 0,
      upi: 0,
    };
    validOnlineOrders.forEach((o) => {
      if (o.payment_method === "cod") paymentMethods.cash += o.total_amount;
      if (o.payment_method === "upi") paymentMethods.upi += o.total_amount;
    });
    filteredOfflineSales.forEach((s) => {
      if (s.payment_method === "cash") paymentMethods.cash += s.total_amount;
      if (s.payment_method === "upi") paymentMethods.upi += s.total_amount;
    });

    // Order status breakdown
    const orderStatusBreakdown: Record<string, number> = {
      delivered: 0,
      out_for_delivery: 0,
      preparing: 0,
      confirmed: 0,
      pending_confirmation: 0,
      cancelled: 0,
    };
    filteredOrders.forEach((o) => {
      const st = o.order_status || "pending_confirmation";
      orderStatusBreakdown[st] = (orderStatusBreakdown[st] || 0) + 1;
    });

    // Product units sold breakdown
    const productStats: Record<string, { name: string; units: number; revenue: number }> = {};
    validOnlineOrders.forEach((o) => {
      o.items.forEach((item) => {
        const key = item.product_name_snapshot;
        if (!productStats[key]) {
          productStats[key] = { name: key, units: 0, revenue: 0 };
        }
        productStats[key].units += item.quantity;
        productStats[key].revenue += item.line_total;
      });
    });
    filteredOfflineSales.forEach((s) => {
      s.items.forEach((item) => {
        const key = item.product_name_snapshot;
        if (!productStats[key]) {
          productStats[key] = { name: key, units: 0, revenue: 0 };
        }
        productStats[key].units += item.quantity;
        productStats[key].revenue += item.line_total;
      });
    });

    const topProducts = Object.values(productStats).sort((a, b) => b.revenue - a.revenue);

    // Expense categories breakdown
    const expenseBreakdown: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      expenseBreakdown[e.category] = (expenseBreakdown[e.category] || 0) + e.amount;
    });

    // Daily Timeline Data for Trend Graphs
    const dayMap = new Map<
      string,
      {
        date: string;
        label: string;
        onlineRevenue: number;
        offlineRevenue: number;
        totalRevenue: number;
        ordersCount: number;
        offlineCount: number;
      }
    >();

    // Helper to format date label
    const formatDayLabel = (dStr: string) => {
      const d = new Date(dStr);
      return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    };

    validOnlineOrders.forEach((o) => {
      const day = o.created_at.split("T")[0];
      if (!dayMap.has(day)) {
        dayMap.set(day, {
          date: day,
          label: formatDayLabel(day),
          onlineRevenue: 0,
          offlineRevenue: 0,
          totalRevenue: 0,
          ordersCount: 0,
          offlineCount: 0,
        });
      }
      const entry = dayMap.get(day)!;
      entry.onlineRevenue += o.total_amount;
      entry.totalRevenue += o.total_amount;
      entry.ordersCount += 1;
    });

    filteredOfflineSales.forEach((s) => {
      const day = s.created_at.split("T")[0];
      if (!dayMap.has(day)) {
        dayMap.set(day, {
          date: day,
          label: formatDayLabel(day),
          onlineRevenue: 0,
          offlineRevenue: 0,
          totalRevenue: 0,
          ordersCount: 0,
          offlineCount: 0,
        });
      }
      const entry = dayMap.get(day)!;
      entry.offlineRevenue += s.total_amount;
      entry.totalRevenue += s.total_amount;
      entry.offlineCount += 1;
    });

    // If dayMap has fewer than 2 days, ensure at least last 7 days are represented
    if (range === "7days" || range === "all") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000).toISOString().split("T")[0];
        if (!dayMap.has(d)) {
          dayMap.set(d, {
            date: d,
            label: formatDayLabel(d),
            onlineRevenue: 0,
            offlineRevenue: 0,
            totalRevenue: 0,
            ordersCount: 0,
            offlineCount: 0,
          });
        }
      }
    }

    const timeline = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      range,
      grossRevenue,
      onlineTotal,
      onlineGross,
      onlineDeliveryFee,
      offlineTotal,
      totalExpenses,
      estimatedProfit,
      profitMargin,
      avgOnlineOrderValue,
      avgOfflineSaleValue,
      ordersCount: validOnlineOrders.length,
      offlineSalesCount: filteredOfflineSales.length,
      cancelledOrdersCount: filteredOrders.filter((o) => o.order_status === "cancelled").length,
      orderStatusBreakdown,
      paymentMethods,
      topProducts,
      expenseBreakdown,
      productsCount: products.length,
      timeline,
    });
  } catch (error) {
    console.error("[API] GET /api/reports error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
