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

    return NextResponse.json({
      range,
      grossRevenue,
      onlineTotal,
      onlineGross,
      onlineDeliveryFee,
      offlineTotal,
      totalExpenses,
      estimatedProfit,
      ordersCount: validOnlineOrders.length,
      offlineSalesCount: filteredOfflineSales.length,
      cancelledOrdersCount: filteredOrders.filter((o) => o.order_status === "cancelled").length,
      paymentMethods,
      topProducts,
      expenseBreakdown,
      productsCount: products.length,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
