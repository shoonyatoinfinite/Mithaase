import React from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { getDashboardMetrics, getOrders } from "@/lib/data/store";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";

export default async function AdminDashboardPage() {
  const metrics = await getDashboardMetrics();
  const recentOrders = (await getOrders()).slice(0, 5);

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <AdminDashboardClient
          initialMetrics={metrics}
          initialOrders={recentOrders}
        />
      </div>
    </AdminLayout>
  );
}
