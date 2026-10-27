"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Order, OrderStatus, PaymentStatus } from "@/types";
import {
  Search,
  CheckCircle2,
  Clock,
  Truck,
  Eye,
  RefreshCw,
  Phone,
  MapPin,
  X,
  AlertCircle,
  Camera,
  Package,
  Bike,
  Sparkles,
  Banknote,
  Smartphone,
  ArrowRight,
  Lock,
  Check,
  ChefHat,
  Box,
  Layers,
  PhoneCall,
  PackagePlus,
  Boxes,
  Ban,
  RotateCcw,
  UploadCloud,
  Zap,
} from "lucide-react";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { LiveCameraCapture } from "@/components/camera/LiveCameraCapture";

// Strict Forward-Only Workflow Definition
interface WorkflowStep {
  key: OrderStatus;
  label: string;
  shortLabel: string;
  nextActionLabel: string;
  icon: any;
  desc: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    key: "pending_confirmation",
    label: "Order Placed",
    shortLabel: "Placed",
    nextActionLabel: "Confirm Order (Auto-Mark Paid if UPI)",
    icon: Clock,
    desc: "Customer placed booking online",
  },
  {
    key: "confirmed",
    label: "Confirmed",
    shortLabel: "Confirmed",
    nextActionLabel: "Mark Prepared in Kitchen",
    icon: CheckCircle2,
    desc: "Order confirmed & verified",
  },
  {
    key: "preparing",
    label: "Prepared",
    shortLabel: "Prepared",
    nextActionLabel: "Mark Sweets Packed",
    icon: ChefHat,
    desc: "Fresh sweets prepared in pure desi ghee",
  },
  {
    key: "ready_for_dispatch",
    label: "Packed",
    shortLabel: "Packed",
    nextActionLabel: "Dispatch: Out for Delivery",
    icon: Box,
    desc: "Boxed, tagged, and ready for dispatch",
  },
  {
    key: "out_for_delivery",
    label: "Out for Delivery",
    shortLabel: "Out for Del",
    nextActionLabel: "Mark Delivered (With Doorstep Proof)",
    icon: Bike,
    desc: "With delivery rider on way to customer",
  },
  {
    key: "delivered",
    label: "Delivered",
    shortLabel: "Delivered",
    nextActionLabel: "Order Delivered",
    icon: Check,
    desc: "Delivered at customer doorstep with proof",
  },
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("current");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [packedItemsMap, setPackedItemsMap] = useState<Record<string, boolean>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Grouped Delivery Queue state
  const [dispatchChoiceOrder, setDispatchChoiceOrder] = useState<Order | null>(null);
  const [isDispatchingGroup, setIsDispatchingGroup] = useState(false);

  // Filter queued orders
  const [queuedOrders, setQueuedOrders] = useState<Order[]>([]);

  // Direct Delivery / Shop Counter Pickup state (no rider needed or early pickup)
  const [directDeliveryOrder, setDirectDeliveryOrder] = useState<Order | null>(null);
  const [deliveryProofImage, setDeliveryProofImage] = useState<string | null>(null);
  const [directDeliveryType, setDirectDeliveryType] = useState<"counter_pickup" | "direct_store_delivery">("counter_pickup");
  const [directDeliveryNote, setDirectDeliveryNote] = useState("");
  const [directDeliveryMarkPaid, setDirectDeliveryMarkPaid] = useState(true);
  const [isSubmittingDirectDelivery, setIsSubmittingDirectDelivery] = useState(false);

  // Cancel Order Modal State
  const [cancelTargetOrder, setCancelTargetOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);

  // Process Refund Modal State
  const [refundTargetOrder, setRefundTargetOrder] = useState<Order | null>(null);
  const [refundTxnId, setRefundTxnId] = useState("");
  const [refundScreenshot, setRefundScreenshot] = useState<string | null>(null);
  const [refundNote, setRefundNote] = useState("");
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  // Handle Order Cancellation by Admin
  const handleCancelOrderSubmit = async () => {
    if (!cancelTargetOrder) return;
    setIsCancellingOrder(true);
    setActionSuccess("");
    setActionError("");

    try {
      const res = await fetch(`/api/orders/${cancelTargetOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_status: "cancelled",
          note: cancelReason.trim() || "Order cancelled by store administrator",
          changed_by: "Admin",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel order.");
      }

      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      if (selectedOrder?.id === updated.id) setSelectedOrder(updated);

      if (updated.payment_method === "upi" || updated.payment_status === "paid") {
        setActionSuccess(
          `Order #${updated.order_number} cancelled. UPI refund of ₹${updated.total_amount} initiated! You can now click "Process Refund" to upload proof.`
        );
      } else {
        setActionSuccess(`Order #${updated.order_number} cancelled successfully.`);
      }

      setCancelTargetOrder(null);
      setCancelReason("");
    } catch (err: any) {
      setActionError(err.message || "Failed to cancel order.");
    } finally {
      setIsCancellingOrder(false);
    }
  };

  // Handle Refund Proof Submission
  const handleRefundSubmit = async () => {
    if (!refundTargetOrder) return;
    if (!refundTxnId.trim()) {
      setActionError("Please enter the refund transaction reference / UTR number.");
      return;
    }
    if (!refundScreenshot) {
      setActionError("Please upload the screenshot proof of the refund transfer.");
      return;
    }

    setIsSubmittingRefund(true);
    setActionSuccess("");
    setActionError("");

    try {
      const res = await fetch(`/api/orders/${refundTargetOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refund",
          refund_txn_id: refundTxnId.trim(),
          refund_screenshot: refundScreenshot,
          refund_note: refundNote.trim(),
          changed_by: "Admin",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to process refund.");
      }

      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      if (selectedOrder?.id === updated.id) setSelectedOrder(updated);

      setActionSuccess(
        `Refund for Order #${updated.order_number} completed and proof recorded! Customer can now view it live.`
      );
      setRefundTargetOrder(null);
      setRefundTxnId("");
      setRefundScreenshot(null);
      setRefundNote("");
    } catch (err: any) {
      setActionError(err.message || "Failed to process refund.");
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  // Direct Delivery confirmation
  const handleConfirmDirectDelivery = async () => {
    if (!directDeliveryOrder) return;
    if (!deliveryProofImage) {
      setActionError("Please capture or upload a delivery proof photo before marking delivered.");
      return;
    }

    setIsSubmittingDirectDelivery(true);
    setActionSuccess("");
    setActionError("");

    try {
      const nowIso = new Date().toISOString();
      const locationName =
        directDeliveryType === "counter_pickup"
          ? "Shree Shyam Sweets Shop Counter (Customer Pickup in Kothal Kalan)"
          : "Delivered Directly by Store Staff (Doorstep Delivery)";

      const body: any = {
        order_status: "delivered",
        delivery_proof_photo: deliveryProofImage,
        note:
          directDeliveryNote.trim() ||
          (directDeliveryType === "counter_pickup"
            ? "Customer picked up order directly at shop counter"
            : "Order delivered directly by store staff"),
        changed_by: "Admin (Direct Delivery / Shop Pickup)",
        delivered_at: nowIso,
        delivered_location_name: locationName,
      };

      if (directDeliveryOrder.payment_method === "cod" && directDeliveryMarkPaid) {
        body.payment_status = "paid";
      }

      const res = await fetch(`/api/orders/${directDeliveryOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark order as delivered.");

      setSelectedOrder(data);
      setDirectDeliveryOrder(null);
      setDeliveryProofImage(null);
      setActionSuccess(
        `🎉 Order #${directDeliveryOrder.order_number} marked as DELIVERED with proof photo!`
      );
      fetchOrders(true);
    } catch (err: any) {
      setActionError(err.message || "Failed to mark direct delivery.");
    } finally {
      setIsSubmittingDirectDelivery(false);
    }
  };

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const url = new URL("/api/orders", window.location.origin);
      if (statusFilter !== "all") {
        url.searchParams.set("status", statusFilter);
      }
      if (search) url.searchParams.set("search", search);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }

      // Always fetch queued orders to keep queue count & batch banner synced
      const queueRes = await fetch("/api/orders?status=queued");
      if (queueRes.ok) {
        const qData = await queueRes.json();
        setQueuedOrders(qData);
      }
    } catch {
      // ignore
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Hook into live realtime SSE events for orders
  const { isConnected } = useRealtime({
    events: ["order_created", "order_status_updated", "group_delivery_dispatched"],
    enablePollingFallback: true,
    pollingIntervalMs: 5000,
    onEvent: (payload) => {
      fetchOrders(true);
      if (payload.type === "order_created") {
        setActionSuccess(
          `🔔 Live Event: New Order placed by ${payload.data?.customer_name || "Customer"} (₹${payload.data?.total_amount || ""})!`
        );
      } else if (payload.type === "order_status_updated") {
        if (selectedOrder && selectedOrder.id === payload.data?.id) {
          setSelectedOrder((prev) =>
            prev
              ? ({
                  ...prev,
                  ...payload.data,
                } as Order)
              : null
          );
        }
      } else if (payload.type === "group_delivery_dispatched") {
        setActionSuccess(`🛵 Group Dispatch: ${payload.data?.count || 1} deliveries sent to rider fleet!`);
      }
    },
  });

  // Handle Choice: Call Delivery Agent Now vs Add to Queue
  const handleSelectDispatchMode = async (order: Order, mode: "call_rider" | "add_queue") => {
    setIsUpdating(true);
    setActionSuccess("");
    setActionError("");
    try {
      if (mode === "call_rider") {
        const res = await fetch(`/api/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_status: "ready_for_dispatch",
            delivery_queued: false,
            note: "Packed and immediately dispatched to delivery fleet",
            changed_by: "Admin",
          }),
        });
        if (!res.ok) throw new Error("Failed to dispatch order to rider fleet.");
        const updated = await res.json();
        if (selectedOrder?.id === order.id) setSelectedOrder(updated);
        setDispatchChoiceOrder(null);
        setActionSuccess(`🛵 Delivery Agent called for Order #${order.order_number}! Rider notified.`);
        fetchOrders(true);
      } else {
        const res = await fetch(`/api/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_status: "ready_for_dispatch",
            delivery_queued: true,
            note: "Packed and added to grouped delivery queue",
            changed_by: "Admin",
          }),
        });
        if (!res.ok) throw new Error("Failed to add order to delivery queue.");
        const updated = await res.json();
        if (selectedOrder?.id === order.id) setSelectedOrder(updated);
        setDispatchChoiceOrder(null);
        setActionSuccess(
          `📦 Order #${order.order_number} added to Grouped Delivery Queue! You can group more deliveries before calling rider.`
        );
        fetchOrders(true);
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to update dispatch mode.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Dispatch entire group of queued deliveries
  const handleDispatchGroup = async (orderIds: string[]) => {
    if (orderIds.length === 0) return;
    setIsDispatchingGroup(true);
    setActionSuccess("");
    setActionError("");
    try {
      const res = await fetch("/api/orders/group-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds, changed_by: "Admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch grouped orders.");
      setActionSuccess(`🛵 Delivery Agent summoned for ${orderIds.length} grouped orders! Batch dispatched to rider fleet.`);
      fetchOrders(true);
    } catch (err: any) {
      setActionError(err.message || "Error dispatching group.");
    } finally {
      setIsDispatchingGroup(false);
    }
  };

  // Remove single order from queue
  const handleRemoveFromQueue = async (orderId: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_queued: false }),
      });
      if (res.ok) {
        setActionSuccess("Order removed from delivery queue.");
        fetchOrders(true);
      }
    } catch {
      // ignore
    } finally {
      setIsUpdating(false);
    }
  };

  // Strict Next Step Progression Handler
  const handleAdvanceWorkflow = async (targetStatus: OrderStatus) => {
    if (!selectedOrder) return;

    // When advancing to Packed (ready_for_dispatch) or dispatching a packed order:
    if (targetStatus === "ready_for_dispatch" || (selectedOrder.order_status === "ready_for_dispatch" && !selectedOrder.delivery_queued)) {
      setDispatchChoiceOrder(selectedOrder);
      return;
    }
    setIsUpdating(true);
    setActionSuccess("");
    setActionError("");

    try {
      const body: any = {
        order_status: targetStatus,
        note: statusNote || `Status advanced to ${targetStatus.replace(/_/g, " ")}`,
        changed_by: "Admin",
      };

      // If confirming and payment was UPI, ensure marked paid
      if (targetStatus === "confirmed" && selectedOrder.payment_method === "upi") {
        body.payment_status = "paid";
      }

      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to advance order status");
      }

      setSelectedOrder(data);
      setStatusNote("");
      setActionSuccess(`Order #${selectedOrder.order_number} advanced to ${targetStatus.replace(/_/g, " ").toUpperCase()}!`);
      fetchOrders(true);
    } catch (err: any) {
      setActionError(err.message || "Failed to update order");
    } finally {
      setIsUpdating(false);
    }
  };

  // Mark COD Paid Handler
  const handleMarkCodPaid = async () => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_status: "paid",
          note: "COD Cash collected verified by Admin",
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedOrder(updated);
        setActionSuccess(`Order #${selectedOrder.order_number} marked as PAID in full!`);
        fetchOrders(true);
      }
    } catch {
      // ignore
    } finally {
      setIsUpdating(false);
    }
  };

  // Mark Manual UPI Paid Handler
  const handleMarkUpiPaid = async () => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_status: "paid",
          note: "Manual UPI Payment Verified & Confirmed by Admin",
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedOrder(updated);
        setActionSuccess(`Order #${selectedOrder.order_number} UPI payment verified & marked as PAID!`);
        fetchOrders(true);
      }
    } catch {
      // ignore
    } finally {
      setIsUpdating(false);
    }
  };

  // Update Booking Status Handler (Approve Request or Reapprove/Confirm Order)
  const handleUpdateBooking = async (
    targetBookingStatus: "approved_for_payment" | "confirmed",
    note?: string
  ) => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    setActionSuccess("");
    setActionError("");

    try {
      const body: any = {
        booking_status: targetBookingStatus,
        note: note || (targetBookingStatus === "approved_for_payment"
          ? "Approved after-hours booking request and unlocked payment options"
          : "Reapproved order after payment selection"),
      };

      if (targetBookingStatus === "confirmed") {
        body.order_status = "confirmed";
      }

      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update booking status");
      }

      setSelectedOrder(data);
      setActionSuccess(
        targetBookingStatus === "approved_for_payment"
          ? `Booking #${selectedOrder.order_number} approved! Customer can now select payment on tracking page.`
          : `Order #${selectedOrder.order_number} reapproved & officially confirmed!`
      );
      fetchOrders(true);
    } catch (err: any) {
      setActionError(err.message || "Failed to update booking");
    } finally {
      setIsUpdating(false);
    }
  };

  // Status Color Styling Helper
  const getStatusBadgeStyle = (status: OrderStatus) => {
    switch (status) {
      case "pending_confirmation":
        return "bg-amber-950/80 text-amber-300 border-amber-500/40";
      case "confirmed":
        return "bg-sky-950/80 text-sky-300 border-sky-500/40";
      case "preparing":
        return "bg-purple-950/80 text-purple-300 border-purple-500/40";
      case "ready_for_dispatch":
        return "bg-orange-950/80 text-orange-300 border-orange-500/40";
      case "out_for_delivery":
        return "bg-indigo-950/80 text-indigo-300 border-indigo-500/40";
      case "delivered":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-500/40";
      case "cancelled":
        return "bg-red-950/80 text-red-300 border-red-500/40";
      default:
        return "bg-white/10 text-white/70 border-white/20";
    }
  };

  // Current order workflow index
  const currentStepIndex = selectedOrder
    ? WORKFLOW_STEPS.findIndex((s) => s.key === selectedOrder.order_status)
    : -1;
  const nextStep =
    currentStepIndex >= 0 && currentStepIndex < WORKFLOW_STEPS.length - 1
      ? WORKFLOW_STEPS[currentStepIndex + 1]
      : null;

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6 w-full min-w-0 max-w-full">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-[#FFF8EE]">
              Orders <span className="gold-gradient-text">Management</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#D3BEB0] mt-1">
              Tap any order card to open details and advance the irreversible preparation and delivery workflow.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/70">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
              <span>{isConnected ? "Live Sync Active" : "Connecting..."}</span>
            </div>

            <button
              onClick={() => fetchOrders()}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#D4AF37] border border-[#D4AF37]/30 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Action Notice */}
        {actionSuccess && !selectedOrder && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/90 to-[#23042B] border border-emerald-400 text-emerald-200 text-xs flex items-center justify-between gap-2 shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{actionSuccess}</span>
            </div>
            <button
              onClick={() => setActionSuccess("")}
              className="text-white/60 hover:text-white text-xs px-2 py-0.5 rounded bg-black/30"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative w-full md:flex-1">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order ID, customer name, phone, or locality..."
              className="w-full bg-[#1C0324] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/30 outline-none"
            />
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
            {[
              { id: "current", label: "⚡ Current Orders" },
              { id: "queued", label: `📦 Queued (${queuedOrders.length})` },
              { id: "all", label: "All Orders" },
              { id: "pending_confirmation", label: "1. Placed" },
              { id: "confirmed", label: "2. Confirmed" },
              { id: "preparing", label: "3. Prepared" },
              { id: "ready_for_dispatch", label: "4. Packed" },
              { id: "out_for_delivery", label: "5. Out for Delivery" },
              { id: "delivered", label: "6. Delivered" },
              { id: "cancelled", label: "7. Cancelled & Refunds" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                  statusFilter === f.id
                    ? "bg-[#D4AF37] text-[#16031E] border-[#F5D061] font-bold shadow"
                    : "bg-[#1C0324] text-[#D3BEB0] border-white/10 hover:border-white/20"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ============================================================== */}
        {/* GROUPED DELIVERIES BATCH QUEUE PANEL                          */}
        {/* ============================================================== */}
        {queuedOrders.length > 0 && (
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#2B0E1E] via-[#210526] to-[#16031E] border-2 border-[#D4AF37] shadow-[0_8px_30px_rgba(212,175,55,0.25)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-center shrink-0">
                  <Boxes className="w-6 h-6 text-[#F5D061]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-serif font-black text-[#FFF8EE]">
                      Grouped Deliveries Queue
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37] text-[#16031E] font-black text-xs">
                      {queuedOrders.length} {queuedOrders.length === 1 ? "Order" : "Orders"}
                    </span>
                  </div>
                  <p className="text-xs text-[#D3BEB0] mt-0.5">
                    Orders grouped for batch dispatch. Delivery riders have not been alerted yet. Click below when ready to call rider for all of them together.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isDispatchingGroup}
                onClick={() => handleDispatchGroup(queuedOrders.map((o) => o.id))}
                className="gold-gradient-btn py-3 px-5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                <PhoneCall className={`w-4 h-4 ${isDispatchingGroup ? "animate-spin" : ""}`} />
                <span>
                  {isDispatchingGroup
                    ? "Summoning Rider Fleet..."
                    : `Call Delivery Agent for Group (${queuedOrders.length} Orders)`}
                </span>
              </button>
            </div>

            {/* List of queued orders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              {queuedOrders.map((qo) => (
                <div
                  key={qo.id}
                  className="p-3 rounded-xl bg-black/40 border border-[#D4AF37]/40 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#F5D061]">{qo.order_number}</span>
                      <span className="text-white font-medium truncate">{qo.customer_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/60 text-[11px] mt-0.5">
                      <MapPin className="w-3 h-3 text-[#D4AF37] shrink-0" />
                      <span className="truncate">{qo.locality || qo.delivery_address}</span>
                      <span className="text-white/40">•</span>
                      <span className="text-[#F5D061] font-mono font-semibold">₹{qo.total_amount}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSelectDispatchMode(qo, "call_rider")}
                      title="Dispatch solo to rider now"
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <Bike className="w-3 h-3" />
                      <span>Solo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromQueue(qo.id)}
                      title="Remove from queue"
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-red-300 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* COMPACT TAP-FRIENDLY ORDER CARDS GRID                           */}
        {/* ============================================================== */}
        {isLoading && orders.length === 0 ? (
          <div className="p-16 text-center text-white/60 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-[#D4AF37]" />
            <span>Loading orders...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 rounded-3xl bg-[#1C0324] border border-white/10 text-center text-white/60 space-y-3">
            <Package className="w-12 h-12 text-white/30 mx-auto" />
            <h3 className="text-base font-serif font-bold text-white">No Orders Found</h3>
            <p className="text-xs text-white/50">
              There are no orders matching your current search or status filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((o) => {
              const itemsCount = o.items.reduce((s, i) => s + i.quantity, 0);
              const isCodUnpaid = o.payment_method === "cod" && o.payment_status !== "paid";
              const isUpi = o.payment_method === "upi";

              return (
                <div
                  key={o.id}
                  onClick={() => {
                    setSelectedOrder(o);
                    setActionError("");
                    setActionSuccess("");
                    fetch(`/api/orders/${o.id}`)
                      .then((res) => (res.ok ? res.json() : null))
                      .then((fresh) => {
                        if (fresh && fresh.id === o.id) {
                          setSelectedOrder(fresh);
                        }
                      })
                      .catch(() => {});
                  }}
                  className={`group p-4 rounded-2xl bg-[#1C0324] hover:bg-[#280532] border-2 ${
                    o.delivery_queued
                      ? "border-amber-400/90 shadow-[0_0_15px_rgba(245,208,97,0.2)]"
                      : "border-[#D4AF37]/30 hover:border-[#F5D061]"
                  } shadow-md hover:shadow-[0_6px_25px_rgba(212,175,55,0.3)] cursor-pointer transition-all flex flex-col justify-between gap-3 relative active:scale-[0.98]`}
                >
                  {/* Row 1: Order Number, UPI Pill & Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-mono font-black text-sm text-[#F5D061] group-hover:underline">
                        {o.order_number}
                      </span>
                      {o.upi_screenshot && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/40 text-[9px] font-bold shrink-0">
                          📸 UPI Proof
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {o.booking_status === "requested" && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/50 text-[10px] font-bold shrink-0 flex items-center gap-1 animate-pulse">
                          <Clock className="w-3 h-3 text-purple-300" />
                          <span>🌙 Req</span>
                        </span>
                      )}
                      {o.booking_status === "approved_for_payment" && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 text-[10px] font-bold shrink-0">
                          💳 Pay Unlocked
                        </span>
                      )}
                      {o.booking_status === "payment_selected" && (
                        <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/50 text-[10px] font-bold shrink-0 animate-pulse">
                          ⏳ Reapproval Req
                        </span>
                      )}
                      {o.delivery_queued && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-[#F5D061] border border-amber-500/50 text-[10px] font-bold shrink-0 flex items-center gap-1">
                          <Boxes className="w-3 h-3 text-[#F5D061]" />
                          <span>Queued</span>
                        </span>
                      )}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize border shrink-0 ${getStatusBadgeStyle(
                          o.order_status
                        )}`}
                      >
                        {o.booking_status === "requested"
                          ? "Booking Req"
                          : o.order_status === "ready_for_dispatch"
                          ? "Packed"
                          : o.order_status === "pending_confirmation"
                          ? "Order Placed"
                          : o.order_status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Location */}
                  <div className="flex items-start gap-1.5 text-xs text-white/80">
                    <MapPin className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                    <span className="truncate font-medium text-white/90" title={`${o.delivery_address}, ${o.locality}`}>
                      {o.locality || o.delivery_address || "Kothal Kalan"}
                    </span>
                  </div>

                  {/* Row 2.5: Payment Method Badge (Auto UPI vs Manual UPI vs COD) */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {o.payment_method === "cod" ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                        <span>💵 COD</span>
                        <span className={`text-[9px] font-normal ${o.payment_status === "paid" ? "text-emerald-400 font-bold" : "text-amber-200"}`}>
                          ({o.payment_status === "paid" ? "Paid ✓" : `Collect ₹${o.total_amount}`})
                        </span>
                      </span>
                    ) : o.upi_reference?.toLowerCase().startsWith("youpi:") ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-emerald-400" />
                        <span>Auto-Confirmed UPI</span>
                        <span className="text-[9px] text-emerald-400 font-semibold">✓</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                        <Smartphone className="w-3 h-3 text-purple-400" />
                        <span>Manual UPI</span>
                        <span className={`text-[9px] ${o.payment_status === "paid" ? "text-emerald-400 font-bold" : "text-amber-300 font-bold"}`}>
                          ({o.payment_status === "paid" ? "Verified ✓" : "Verify UTR"})
                        </span>
                      </span>
                    )}

                    {o.coupon_code && (
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-semibold bg-white/5 text-[#F5D061] border border-white/10">
                        🏷️ {o.coupon_code}
                      </span>
                    )}
                  </div>

                  {/* Row 3: Amount & View Details Trigger */}
                  <div className="pt-2.5 border-t border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-white/40 block leading-none">Amount</span>
                      <span className="font-serif font-black text-base text-[#F5D061]">
                        ₹{o.total_amount}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#D4AF37] font-semibold flex items-center gap-1 group-hover:text-white transition-colors">
                      <span>View Info</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ============================================================== */}
        {/* DETAILED ORDER MODAL WITH STRICT IRREVERSIBLE WORKFLOW STEPPER */}
        {/* ============================================================== */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#1C0324] border-2 border-[#D4AF37] p-4 sm:p-7 shadow-2xl space-y-5 sm:space-y-6 my-auto animate-in fade-in zoom-in-95">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">
                      Order Details & Workflow
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeStyle(
                        selectedOrder.order_status
                      )}`}
                    >
                      {selectedOrder.order_status.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-2xl font-serif font-black text-[#F5D061] mt-0.5">
                    {selectedOrder.order_number}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setSelectedOrder(null);
                    setActionSuccess("");
                    setActionError("");
                  }}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 shadow">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {actionError && (
                <div className="p-3.5 rounded-2xl bg-rose-950/90 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2 shadow">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* ============================================================== */}
              {/* PAYMENT CLASSIFICATION & VERIFICATION BANNER                   */}
              {/* Shows: Auto-Confirmed UPI vs Manual UPI vs Cash on Delivery    */}
              {/* ============================================================== */}
              {selectedOrder.payment_method === "cod" ? (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/80 via-[#261505] to-amber-950/80 border-2 border-amber-500/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                        <Banknote className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                            💵 Cash on Delivery (COD)
                          </span>
                        </div>
                        <span className="text-[11px] text-amber-200/80 block">
                          Payment to be collected in cash from customer upon sweet delivery
                        </span>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                        selectedOrder.payment_status === "paid"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                      }`}
                    >
                      {selectedOrder.payment_status === "paid" ? "✓ Cash Collected & Paid" : `Collect ₹${selectedOrder.total_amount} Cash`}
                    </span>
                  </div>

                  {selectedOrder.payment_status !== "paid" && selectedOrder.order_status !== "cancelled" && (
                    <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-amber-100/90 font-mono">
                        Cash amount to collect: <strong>₹{selectedOrder.total_amount}</strong>
                      </span>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={handleMarkCodPaid}
                        className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#16031E] font-bold text-xs flex items-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#16031E]" />
                        <span>Mark Cash Collected</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : selectedOrder.upi_reference?.toLowerCase().startsWith("youpi:") ? (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-[#052615] to-emerald-950/80 border-2 border-emerald-500/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                            ⚡ Auto-Confirmed UPI (Instant Gateway)
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Verified Automatically ✓
                          </span>
                        </div>
                        <span className="text-[11px] text-emerald-200/80 block">
                          Payment verified and confirmed in real-time via YouPI Gateway
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-emerald-300/60 block uppercase font-mono">Amount Paid</span>
                      <span className="font-serif font-black text-emerald-300 text-sm">₹{selectedOrder.total_amount}</span>
                    </div>
                  </div>
                  <div className="bg-black/40 p-2.5 rounded-xl border border-emerald-500/20 flex items-center justify-between text-xs font-mono">
                    <span className="text-emerald-200/70 text-[11px]">Gateway Reference / ID:</span>
                    <span className="text-white font-bold text-[11px]">{selectedOrder.upi_reference}</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/80 via-[#1C0526] to-purple-950/80 border-2 border-purple-500/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shrink-0">
                        <Smartphone className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-purple-300">
                            📱 Manual UPI Payment (Customer Transfer)
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                              selectedOrder.payment_status === "paid"
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                            }`}
                          >
                            {selectedOrder.payment_status === "paid" ? "✓ Verified by Admin" : "⚠️ Needs Admin Verification"}
                          </span>
                        </div>
                        <span className="text-[11px] text-purple-200/70 block">
                          Customer sent UPI directly to shop VPA and entered UTR / screenshot proof
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-purple-300/60 block uppercase font-mono">Total Order</span>
                      <span className="font-serif font-black text-[#F5D061] text-sm">₹{selectedOrder.total_amount}</span>
                    </div>
                  </div>

                  <div className="bg-black/40 p-2.5 rounded-xl border border-purple-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="font-mono text-[11px]">
                      <span className="text-white/60">Customer UTR / Ref: </span>
                      <strong className="text-white font-bold">{selectedOrder.upi_reference || "No UTR provided"}</strong>
                    </div>
                    {selectedOrder.upi_screenshot && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            url: selectedOrder.upi_screenshot!,
                            title: `Manual UPI Proof - Order #${selectedOrder.order_number}`,
                          })
                        }
                        className="text-[11px] text-[#F5D061] underline font-bold hover:text-white cursor-pointer"
                      >
                        View Proof Screenshot ↗
                      </button>
                    )}
                  </div>

                  {selectedOrder.payment_status !== "paid" && selectedOrder.order_status !== "cancelled" && (
                    <div className="pt-1 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={handleMarkUpiPaid}
                        className="py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        <span>Verify & Mark UPI Paid</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================== */}
              {/* STRICT FORWARD-ONLY WORKFLOW STEPPER (NON-REVERSIBLE)          */}
              {/* ============================================================== */}
              <div className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-[#D4AF37]/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#F5D061]" />
                    <span>Preparation & Delivery Workflow (Irreversible)</span>
                  </span>
                  <span className="text-[10px] text-white/50 font-mono">
                    Step {Math.max(1, currentStepIndex + 1)} of 6
                  </span>
                </div>

                {/* Stepper Nodes */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5 sm:gap-2 pt-1">
                  {WORKFLOW_STEPS.map((step, idx) => {
                    const isCompleted = currentStepIndex > idx;
                    const isCurrent = currentStepIndex === idx;
                    const Icon = step.icon;

                    return (
                      <div
                        key={step.key}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          isCurrent
                            ? "bg-[#D4AF37]/20 border-[#D4AF37] text-white shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                            : isCompleted
                            ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                            : "bg-white/[0.02] border-white/5 opacity-40 text-white/50"
                        }`}
                      >
                        <div
                          className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center text-[10px] font-black mb-1 ${
                            isCurrent
                              ? "bg-[#D4AF37] text-[#16031E] animate-pulse"
                              : isCompleted
                              ? "bg-emerald-500 text-white"
                              : "bg-white/10 text-white/50"
                          }`}
                        >
                          {isCompleted ? "✓" : idx + 1}
                        </div>
                        <span className="text-[11px] font-bold block truncate">
                          {step.shortLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Primary Forward Action Button & Packing Checklist */}
                <div className="pt-2 space-y-3">
                  {/* Packing Checklist: Admin must check every single item to pack */}
                  {nextStep?.key === "ready_for_dispatch" && (
                    <div className="p-4 rounded-2xl bg-[#280532] border-2 border-amber-500/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Box className="w-4 h-4 text-[#F5D061]" />
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            Packing Verification Checklist ({selectedOrder.items.filter((it) => !!packedItemsMap[it.id]).length}/{selectedOrder.items.length} Packed)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const map: Record<string, boolean> = {};
                            selectedOrder.items.forEach((it) => {
                              map[it.id] = true;
                            });
                            setPackedItemsMap(map);
                          }}
                          className="text-[11px] text-[#F5D061] hover:underline font-bold"
                        >
                          Check All as Packed ✓
                        </button>
                      </div>

                      <p className="text-[11px] text-white/70">
                        To set this order to <strong className="text-amber-300">Packed</strong>, inspect each sweet box in the kitchen and tick them off below:
                      </p>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {selectedOrder.items.map((it) => {
                          const isChecked = !!packedItemsMap[it.id];
                          return (
                            <label
                              key={it.id}
                              className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                isChecked
                                ? "bg-emerald-950/40 border-emerald-500/60 text-emerald-200"
                                : "bg-white/5 border-white/10 text-white/80 hover:border-white/30"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() =>
                                    setPackedItemsMap((prev) => ({
                                      ...prev,
                                      [it.id]: !prev[it.id],
                                    }))
                                  }
                                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400"
                                />
                                <div>
                                  <span className="font-bold block">{it.product_name_snapshot}</span>
                                  <span className="text-[11px] text-[#F5D061]">{it.variant_name_snapshot}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-bold block text-white">Qty: {it.quantity}</span>
                                <span
                                  className={`text-[10px] font-bold ${
                                    isChecked ? "text-emerald-400" : "text-amber-400"
                                  }`}
                                >
                                  {isChecked ? "Packed ✓" : "Needs Packing ⚠️"}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      {selectedOrder.items.filter((it) => !!packedItemsMap[it.id]).length < selectedOrder.items.length && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                          <span>
                            Please mark all {selectedOrder.items.length} sweets items as packed before advancing order to Packed.
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dispatch Controls for Packed Order */}
                  {selectedOrder.order_status === "ready_for_dispatch" ? (
                    selectedOrder.delivery_queued ? (
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/70 to-[#2A0D30] border-2 border-amber-500/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[#F5D061] font-bold text-xs uppercase tracking-wider">
                            <Boxes className="w-4 h-4 text-[#F5D061]" />
                            <span>📦 In Grouped Delivery Queue</span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-[#F5D061] text-[10px] font-bold border border-amber-500/40">
                            Waiting for Group Dispatch
                          </span>
                        </div>
                        <p className="text-xs text-amber-200/90 leading-relaxed">
                          This order is packed and waiting in the batch queue. Delivery riders have not been notified yet.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleSelectDispatchMode(selectedOrder, "call_rider")}
                            className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>Call Delivery Agent Now (Solo)</span>
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleRemoveFromQueue(selectedOrder.id)}
                            className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold active:scale-95 transition-all"
                          >
                            Remove from Queue
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-[#280532] border-2 border-[#D4AF37]/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                            <Package className="w-4 h-4 text-[#F5D061]" />
                            <span>📦 Sweets Packed & Ready for Dispatch</span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                            Packed
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleSelectDispatchMode(selectedOrder, "call_rider")}
                            className="py-3 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>1. Call Delivery Agent (Alert Rider)</span>
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleSelectDispatchMode(selectedOrder, "add_queue")}
                            className="py-3 px-3.5 rounded-xl bg-purple-950 hover:bg-purple-900 border border-[#D4AF37]/50 text-[#F5D061] font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
                          >
                            <Boxes className="w-3.5 h-3.5" />
                            <span>2. Add to Queue (Group Deliveries)</span>
                          </button>
                        </div>
                      </div>
                    )
                  ) : selectedOrder.booking_status === "requested" ? (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/90 via-[#280532] to-purple-950/90 border-2 border-[#D4AF37] space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                          <Clock className="w-4 h-4 text-[#F5D061]" />
                          <span>🌙 After-Hours Booking Request</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#F5D061] text-[10px] font-bold border border-[#D4AF37]/40">
                          Review Required
                        </span>
                      </div>
                      <p className="text-xs text-white/80 leading-relaxed">
                        Customer submitted this booking while the shop was closed (no upfront payment was collected). Approve this request to unlock payment options (UPI / COD) for the customer.
                      </p>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleUpdateBooking("approved_for_payment")}
                        className="w-full py-3.5 px-4 rounded-xl gold-gradient-btn font-bold text-xs flex items-center justify-center gap-2 shadow cursor-pointer text-[#16031E]"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#16031E]" />
                        <span>Approve Request & Unlock Payment Options</span>
                      </button>
                    </div>
                  ) : selectedOrder.booking_status === "approved_for_payment" ? (
                    <div className="p-4 rounded-2xl bg-[#280532] border border-emerald-400/50 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Booking Request Approved — Awaiting Customer Payment Selection</span>
                      </div>
                      <p className="text-xs text-white/70 leading-relaxed">
                        Customer has been notified on their live tracking page to select UPI or COD. Once selected, you can reapprove and confirm the order.
                      </p>
                    </div>
                  ) : selectedOrder.booking_status === "payment_selected" ? (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/90 via-[#1C082B] to-sky-950/90 border-2 border-sky-400 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                          <CheckCircle2 className="w-4 h-4 text-sky-400" />
                          <span>💳 Payment Selected by Customer</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-sky-400/20 text-sky-300 text-[10px] font-bold border border-sky-400/40">
                          Final Reapproval Required
                        </span>
                      </div>
                      <p className="text-xs text-white/80 leading-relaxed">
                        Customer selected <strong>{selectedOrder.payment_method.toUpperCase()}</strong>.
                        {selectedOrder.payment_method === "upi" && selectedOrder.upi_reference ? ` Ref: ${selectedOrder.upi_reference}.` : ""}
                        Click below to reapprove and officially confirm this order into preparation!
                      </p>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleUpdateBooking("confirmed")}
                        className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Reapprove & Confirm Order (Place Order)</span>
                      </button>
                    </div>
                  ) : nextStep ? (
                    <button
                      type="button"
                      disabled={
                        isUpdating ||
                        (nextStep.key === "ready_for_dispatch" &&
                          selectedOrder.items.filter((it) => !!packedItemsMap[it.id]).length < selectedOrder.items.length)
                      }
                      onClick={() => handleAdvanceWorkflow(nextStep.key)}
                      className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all ${
                        nextStep.key === "ready_for_dispatch" &&
                        selectedOrder.items.filter((it) => !!packedItemsMap[it.id]).length < selectedOrder.items.length
                          ? "bg-white/10 text-white/40 cursor-not-allowed border border-white/10"
                          : "gold-gradient-btn"
                      }`}
                    >
                      {isUpdating ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-[#16031E]" />
                          <span>Advancing Workflow...</span>
                        </>
                      ) : nextStep.key === "ready_for_dispatch" &&
                        selectedOrder.items.filter((it) => !!packedItemsMap[it.id]).length < selectedOrder.items.length ? (
                        <>
                          <Box className="w-4 h-4 text-white/40" />
                          <span>
                            Check All {selectedOrder.items.length} Items to Pack ({selectedOrder.items.filter((it) => !!packedItemsMap[it.id]).length}/{selectedOrder.items.length} Checked)
                          </span>
                        </>
                      ) : (
                        <>
                          <span>Advance to Next Step: {nextStep.nextActionLabel}</span>
                          <ArrowRight className="w-4 h-4 text-[#16031E]" />
                        </>
                      )}
                    </button>
                  ) : selectedOrder.order_status === "delivered" ? (
                    /* Final Check: COD Payment verification if unpaid */
                    selectedOrder.payment_method === "cod" && selectedOrder.payment_status !== "paid" ? (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={handleMarkCodPaid}
                        className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95"
                      >
                        <Banknote className="w-4 h-4" />
                        <span>Final Step: Mark Cash Paid (Collect ₹{selectedOrder.total_amount} COD)</span>
                      </button>
                    ) : (
                      <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>✓ Workflow Complete: Order Fully Delivered & Paid in Full</span>
                      </div>
                    )
                  ) : null}

                  {/* Direct Delivery / Shop Counter Pickup Option */}
                  {/* Direct Delivery / Shop Counter Pickup Option */}
                  {selectedOrder.order_status !== "delivered" && selectedOrder.order_status !== "cancelled" && (
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDirectDeliveryOrder(selectedOrder);
                          setDeliveryProofImage(null);
                          setDirectDeliveryType("counter_pickup");
                          setDirectDeliveryNote("Customer picked up order directly at shop counter");
                          setDirectDeliveryMarkPaid(selectedOrder.payment_method === "cod" && selectedOrder.payment_status !== "paid");
                        }}
                        className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-emerald-950/80 via-[#23052D] to-emerald-950/80 hover:from-emerald-900/90 hover:to-emerald-900/90 text-emerald-300 hover:text-emerald-200 border border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-2 shadow transition-all active:scale-95 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-emerald-400" />
                        <span>Direct Delivery / Shop Counter Pickup (With Live Photo)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCancelTargetOrder(selectedOrder);
                          setCancelReason("");
                        }}
                        className="w-full py-2 px-3.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-red-200 border border-red-500/40 text-xs font-bold flex items-center justify-center gap-2 shadow transition-all active:scale-95 cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5 text-red-400" />
                        <span>Cancel Order</span>
                      </button>
                    </div>
                  )}

                  {/* Cancelled Order & Refund Management Display */}
                  {selectedOrder.order_status === "cancelled" && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/80 via-[#25072F] to-red-950/80 border-2 border-red-500/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-300 font-bold text-xs uppercase tracking-wider">
                          <Ban className="w-4 h-4 text-red-400" />
                          <span>Order Cancelled</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-200 text-[10px] font-bold border border-red-500/40">
                          Cancelled
                        </span>
                      </div>

                      {selectedOrder.cancellation_reason && (
                        <div className="text-xs text-red-200/90 leading-relaxed bg-black/40 p-2.5 rounded-xl border border-white/5">
                          <span className="text-white/50 block text-[10px] uppercase font-bold mb-0.5">Cancellation Reason:</span>
                          <span>{selectedOrder.cancellation_reason}</span>
                        </div>
                      )}

                      {/* Refund Workflow for UPI / Paid Orders */}
                      {(selectedOrder.payment_method === "upi" || selectedOrder.payment_status === "paid" || selectedOrder.payment_status === "refunded") && (
                        <div className="pt-2 border-t border-white/10 space-y-2.5">
                          {selectedOrder.refund_status === "refunded" || selectedOrder.payment_status === "refunded" ? (
                            <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/50 space-y-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                  <span>Refund Completed: ₹{selectedOrder.refund_amount || selectedOrder.total_amount}</span>
                                </span>
                                {selectedOrder.refund_screenshot && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewImage({
                                        url: selectedOrder.refund_screenshot!,
                                        title: `Refund Proof #${selectedOrder.order_number}`,
                                      })
                                    }
                                    className="text-[11px] text-[#F5D061] underline hover:text-white font-bold"
                                  >
                                    View Proof Screenshot ↗
                                  </button>
                                )}
                              </div>
                              <div className="text-[11px] text-emerald-200/90 font-mono">
                                <span>UTR / Txn ID: </span>
                                <strong className="text-white">{selectedOrder.refund_txn_id}</strong>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-500/60 space-y-2 text-xs">
                              <div className="flex items-center justify-between text-amber-300 font-bold">
                                <span className="flex items-center gap-1.5">
                                  <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                                  <span>UPI Refund Required: ₹{selectedOrder.total_amount}</span>
                                </span>
                                <span className="text-[10px] bg-amber-900/80 text-amber-200 px-2 py-0.5 rounded border border-amber-500/40">
                                  Action Required
                                </span>
                              </div>
                              <p className="text-[11px] text-amber-100/80">
                                This order was paid via UPI. Please transfer funds back to customer and upload the screenshot proof with the transaction reference.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setRefundTargetOrder(selectedOrder);
                                  setRefundTxnId("");
                                  setRefundScreenshot(null);
                                  setRefundNote("");
                                }}
                                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Process Refund & Upload Proof</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-[10px] text-white/40 text-center mt-1.5 font-mono">
                    Workflow progresses forward only (Order Placed → Confirmed → Prepared → Packed → Out for Del → Delivered).
                  </p>
                </div>
              </div>

              {/* Customer & Address Details */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-white/50 block font-semibold mb-0.5">Recipient Details</span>
                  <span className="text-white font-bold text-sm block">{selectedOrder.customer_name}</span>
                  <div className="flex items-center gap-1.5 text-[#F5D061] mt-1 font-mono">
                    <Phone className="w-3 h-3" />
                    <span>+91 {selectedOrder.customer_phone}</span>
                  </div>
                  {selectedOrder.customer_email && (
                    <span className="text-white/60 text-[11px] block mt-0.5 font-mono">
                      {selectedOrder.customer_email}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-white/50 block font-semibold mb-0.5">Delivery Address & Pin</span>
                  <span className="text-white block font-medium">{selectedOrder.delivery_address}</span>
                  <span className="text-white/80 block mt-0.5">Locality: {selectedOrder.locality}</span>
                  {selectedOrder.landmark && (
                    <span className="text-[#F5D061] text-[11px] block mt-0.5">
                      Landmark: {selectedOrder.landmark}
                    </span>
                  )}
                  {selectedOrder.map_url && (
                    <a
                      href={selectedOrder.map_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#F5D061] underline mt-1 inline-flex items-center gap-1"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>View in Google Maps ↗</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Items Breakdown */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-2">
                  Purchased Sweets Breakdown ({selectedOrder.items.length})
                </h4>
                <div className="divide-y divide-white/5 rounded-2xl bg-white/5 border border-white/10 p-3 text-xs">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="py-2.5 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.product_name_snapshot}
                            className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0"
                          />
                        )}
                        <div>
                          <span className="font-semibold text-white block text-sm">
                            {item.product_name_snapshot}
                          </span>
                          <span className="text-[#D3BEB0] text-[11px]">
                            {item.variant_name_snapshot} × {item.quantity} (@ ₹{item.unit_price})
                          </span>
                        </div>
                      </div>
                      <span className="font-serif font-bold text-[#F5D061] text-sm">
                        ₹{item.line_total}
                      </span>
                    </div>
                  ))}

                  <div className="pt-3 space-y-1.5 border-t border-white/10 text-xs">
                    <div className="flex justify-between text-white/70">
                      <span>Subtotal</span>
                      <span className="text-white font-mono">₹{selectedOrder.subtotal}</span>
                    </div>
                    <div className="flex justify-between text-white/70">
                      <span>Delivery Fee</span>
                      <span className="text-[#F5D061] font-mono">
                        {Number(selectedOrder.delivery_charge) === 0 ? (
                          <span className="text-emerald-400 font-bold">
                            FREE {selectedOrder.coupon_code ? `(${selectedOrder.coupon_code})` : ""}
                          </span>
                        ) : (
                          `₹${selectedOrder.delivery_charge}`
                        )}
                      </span>
                    </div>
                    {/* Prominent Coupon & Savings Box */}
                    {(Number(selectedOrder.discount_amount) > 0 || selectedOrder.coupon_code || Number(selectedOrder.delivery_charge) === 0) && (
                      <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 space-y-1 my-1">
                        <div className="flex items-center justify-between text-emerald-300 font-bold text-xs">
                          <span className="flex items-center gap-1.5">
                            <span>🏷️ Coupon Applied:</span>
                            <span className="font-mono text-[#F5D061] uppercase bg-black/40 px-2 py-0.5 rounded border border-[#D4AF37]/40">
                              {selectedOrder.coupon_code || "DISCOUNT"}
                            </span>
                          </span>
                          {Number(selectedOrder.discount_amount) > 0 && (
                            <span className="font-mono text-emerald-400 font-black">
                              -₹{Number(selectedOrder.discount_amount)} OFF
                            </span>
                          )}
                        </div>
                        {Number(selectedOrder.delivery_charge) === 0 && (
                          <div className="text-[11px] text-emerald-300/80 flex justify-between font-semibold">
                            <span>Free Delivery Waived:</span>
                            <span className="font-bold text-emerald-300">Saved ₹21</span>
                          </div>
                        )}
                        {Number(selectedOrder.discount_amount) > 0 && (
                          <div className="text-[10px] text-emerald-300/70 pt-0.5 border-t border-emerald-500/20">
                            Total Customer Savings: ₹{Number(selectedOrder.discount_amount) + (Number(selectedOrder.delivery_charge) === 0 ? 21 : 0)}!
                          </div>
                        )}
                      </div>
                    )}
                    <div className="pt-2 border-t border-white/10 flex justify-between font-bold text-white text-base">
                      <span>Total Amount</span>
                      <span className="text-[#F5D061] font-serif text-lg">
                        ₹{selectedOrder.total_amount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ============================================================== */}
              {/* REAL-TIME PHOTO PROOFS: DOORSTEP DELIVERED + DISPATCH + UPI    */}
              {/* ============================================================== */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/70">
                  Attached Photo Proofs & Real-Time Delivery Details
                </h4>

                {/* Real-time Delivery Completion Info (Time, Date, Real-time GPS Location) */}
                {(selectedOrder.order_status === "delivered" || selectedOrder.delivered_at) && (
                  <div className="p-3.5 rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/50 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>📍 Verified Delivery Completion Details</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                        Delivered
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-black/40 p-3 rounded-xl border border-emerald-500/20">
                      <div>
                        <span className="text-white/50 block text-[10px] uppercase font-bold">Date & Time of Delivery</span>
                        <span className="text-[#F5D061] font-mono font-bold text-sm block mt-0.5">
                          {new Date(selectedOrder.delivered_at || selectedOrder.updated_at).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>

                      <div>
                        <span className="text-white/50 block text-[10px] uppercase font-bold">Rider Real-Time Location</span>
                        <span className="text-white font-medium block mt-0.5">
                          {selectedOrder.delivered_location_name || selectedOrder.locality}
                        </span>
                        {selectedOrder.delivered_lat && selectedOrder.delivered_lng && (
                          <span className="text-emerald-400 font-mono text-[11px] block mt-0.5">
                            GPS: {selectedOrder.delivered_lat.toFixed(5)}° N, {selectedOrder.delivered_lng.toFixed(5)}° E
                          </span>
                        )}
                        {(selectedOrder.delivered_map_url || (selectedOrder.delivered_lat && selectedOrder.delivered_lng)) && (
                          <a
                            href={
                              selectedOrder.delivered_map_url ||
                              `https://www.google.com/maps?q=${selectedOrder.delivered_lat},${selectedOrder.delivered_lng}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-[#F5D061] underline mt-1 inline-flex items-center gap-1 hover:text-white"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>View Delivery GPS on Google Maps ↗</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. Rider Doorstep Delivered Photo (Required on Delivery) */}
                  {selectedOrder.delivery_proof_photo ? (
                    <div className="p-3.5 rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/50 space-y-2">
                      <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>📸 Doorstep Delivery Photo</span>
                      </div>
                      <div
                        onClick={() =>
                          setPreviewImage({
                            url: selectedOrder.delivery_proof_photo!,
                            title: `Doorstep Delivery Proof Snapshot (Order #${selectedOrder.order_number})`,
                          })
                        }
                        className="relative group cursor-pointer overflow-hidden rounded-xl border border-emerald-400/50 bg-black flex items-center justify-center h-44"
                      >
                        <img
                          src={selectedOrder.delivery_proof_photo}
                          alt="Rider Doorstep Proof"
                          className="max-h-44 w-auto object-contain group-hover:scale-105 transition-transform"
                        />
                        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded font-mono">
                          Click to Enlarge ↗
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-200/80 leading-tight">
                        Captured by rider at doorstep in real-time upon handing over sweets.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1 text-center flex flex-col items-center justify-center h-32">
                      <Camera className="w-6 h-6 text-white/30" />
                      <span className="text-xs font-semibold text-white/60">
                        Doorstep Delivery Photo
                      </span>
                      <span className="text-[10px] text-white/40">
                        Rider will capture real-time photo upon delivery
                      </span>
                    </div>
                  )}

                  {/* 2. Rider Dispatch / Pickup Photo (Required to Start Delivery) */}
                  {selectedOrder.pickup_photo ? (
                    <div className="p-3.5 rounded-2xl bg-indigo-950/40 border-2 border-indigo-500/50 space-y-2">
                      <div className="flex items-center gap-1.5 text-indigo-300 font-bold text-xs uppercase tracking-wider">
                        <Bike className="w-4 h-4 text-indigo-400" />
                        <span>🛵 Pickup / Dispatch Photo</span>
                      </div>
                      <div
                        onClick={() =>
                          setPreviewImage({
                            url: selectedOrder.pickup_photo!,
                            title: `Dispatch / Pickup Photo Snapshot (Order #${selectedOrder.order_number})`,
                          })
                        }
                        className="relative group cursor-pointer overflow-hidden rounded-xl border border-indigo-400/50 bg-black flex items-center justify-center h-44"
                      >
                        <img
                          src={selectedOrder.pickup_photo}
                          alt="Rider Pickup Proof"
                          className="max-h-44 w-auto object-contain group-hover:scale-105 transition-transform"
                        />
                        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded font-mono">
                          Click to Enlarge ↗
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-200/80 leading-tight">
                        Captured by rider when picking up sweets for delivery.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1 text-center flex flex-col items-center justify-center h-32">
                      <Bike className="w-6 h-6 text-white/30" />
                      <span className="text-xs font-semibold text-white/60">
                        Dispatch / Pickup Photo
                      </span>
                      <span className="text-[10px] text-white/40">
                        Rider captures photo when loading sweets onto bike
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. Customer UPI / Payment Transaction Details */}
                {selectedOrder.payment_method === "cod" ? (
                  <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                        <Banknote className="w-4 h-4 text-amber-400" />
                        <span>Cash on Delivery (COD) Payment Record</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${selectedOrder.payment_status === "paid" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-amber-500/20 text-amber-300 border border-amber-500/40"}`}>
                        {selectedOrder.payment_status === "paid" ? "Paid in Cash ✓" : "Collect Cash on Delivery"}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-200/80">
                      Rider collects ₹{selectedOrder.total_amount} in cash upon physical delivery of sweets.
                    </p>
                  </div>
                ) : selectedOrder.upi_reference?.toLowerCase().startsWith("youpi:") ? (
                  <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
                        <Zap className="w-4 h-4 text-emerald-400" />
                        <span>Auto-Confirmed UPI Gateway Record</span>
                      </div>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold border border-emerald-500/40">
                        Instant Verified ✓
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-200/90 font-mono bg-black/40 p-2 rounded-lg border border-emerald-500/20">
                      <span>Gateway Ref: </span>
                      <strong className="text-white">{selectedOrder.upi_reference}</strong>
                    </div>
                    <p className="text-[11px] text-emerald-200/70">
                      Payment was validated via YouPI webhook intent callback.
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/40 space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-purple-300 font-bold text-xs">
                        <Smartphone className="w-4 h-4 text-purple-400" />
                        <span>Manual UPI Payment Proof & Verification</span>
                      </div>
                      {selectedOrder.upi_reference && (
                        <span className="text-[11px] font-mono text-[#F5D061]">
                          UTR: {selectedOrder.upi_reference}
                        </span>
                      )}
                    </div>

                    {selectedOrder.upi_screenshot ? (
                      <div
                        onClick={() =>
                          setPreviewImage({
                            url: selectedOrder.upi_screenshot!,
                            title: `Customer UPI Payment Proof - Ref: ${selectedOrder.upi_reference || "Verified"}`,
                          })
                        }
                        className="relative group cursor-pointer overflow-hidden rounded-xl border border-purple-500/40 bg-black flex items-center justify-center max-h-48"
                      >
                        <img
                          src={selectedOrder.upi_screenshot}
                          alt="Customer UPI Proof"
                          className="max-h-48 object-contain group-hover:scale-105 transition-transform"
                        />
                        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded font-mono">
                          Click to Enlarge ↗
                        </span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-white/50">
                        Customer submitted manual UTR without uploading a screenshot.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Global Image Lightbox Modal for Enlarge View */}
        {previewImage && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
            <div className="relative max-w-2xl w-full bg-[#1C0324] border-2 border-[#D4AF37] rounded-3xl p-5 shadow-2xl space-y-4 my-auto">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h4 className="text-white font-bold text-sm truncate">{previewImage.title}</h4>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative max-h-[70vh] overflow-auto rounded-xl border border-white/20 bg-black flex items-center justify-center p-1">
                <img
                  src={previewImage.url}
                  alt="Enlarged photo proof"
                  className="max-h-[70vh] max-w-full object-contain rounded-lg"
                />
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="py-2 px-5 rounded-xl gold-gradient-btn text-xs font-bold"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* DISPATCH CHOICE MODAL: CALL RIDER NOW vs ADD TO QUEUE         */}
        {/* ============================================================== */}
        {dispatchChoiceOrder && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
            <div className="relative max-w-lg w-full bg-[#1C0324] border-2 border-[#D4AF37] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 my-auto animate-in zoom-in-95">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-center text-[#F5D061] shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-black text-white">
                      Dispatch Mode for #{dispatchChoiceOrder.order_number}
                    </h3>
                    <p className="text-xs text-[#D3BEB0]">
                      {dispatchChoiceOrder.customer_name} • {dispatchChoiceOrder.locality} • ₹{dispatchChoiceOrder.total_amount}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDispatchChoiceOrder(null)}
                  className="p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-white/80">
                Order sweets are packed! How would you like to dispatch this delivery?
              </p>

              {/* Two Choices */}
              <div className="grid grid-cols-1 gap-3.5">
                {/* Choice 1: Call Delivery Agent Now (Keep current) */}
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleSelectDispatchMode(dispatchChoiceOrder, "call_rider")}
                  className="group text-left p-4 rounded-2xl bg-gradient-to-r from-emerald-950/70 to-[#220B2E] hover:from-emerald-900/90 hover:to-[#2e0f3e] border-2 border-emerald-500/50 hover:border-emerald-400 shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <PhoneCall className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">
                          1. Call Delivery Agent Now
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          Immediate Solo
                        </span>
                      </div>
                      <p className="text-xs text-white/70 leading-relaxed">
                        Keeps existing instant dispatch. Sounds 3-second loud beep and immediately alerts available delivery riders for instant pickup.
                      </p>
                    </div>
                  </div>
                </button>

                {/* Choice 2: Add to Queue (Group Multiple Deliveries) */}
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleSelectDispatchMode(dispatchChoiceOrder, "add_queue")}
                  className="group text-left p-4 rounded-2xl bg-gradient-to-r from-purple-950/70 to-[#2A0835] hover:from-purple-900/90 hover:to-[#380b47] border-2 border-[#D4AF37]/50 hover:border-[#F5D061] shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-center shrink-0 mt-0.5">
                      <Boxes className="w-5 h-5 text-[#F5D061] group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white group-hover:text-[#F5D061] transition-colors">
                          2. Add to Delivery Queue
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#F5D061] text-[10px] font-bold border border-[#D4AF37]/40">
                          Batch Grouping
                        </span>
                      </div>
                      <p className="text-xs text-white/70 leading-relaxed">
                        Puts order into the delivery queue without alerting riders yet. Group multiple orders first, then batch summon rider for all of them together!
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setDispatchChoiceOrder(null)}
                  className="text-xs text-white/50 hover:text-white transition-colors"
                >
                  Cancel / Decide Later
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Direct Delivery / Shop Counter Pickup Modal */}
        {directDeliveryOrder && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
          >
            <div className="w-full max-w-lg rounded-3xl bg-[#1C0324] border-2 border-emerald-500/60 p-5 sm:p-7 shadow-2xl space-y-4 my-auto relative text-white">
              <button
                type="button"
                onClick={() => {
                  setDirectDeliveryOrder(null);
                  setDeliveryProofImage(null);
                }}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400 shrink-0">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-serif font-black text-white">
                    Mark Order Delivered Directly
                  </h3>
                  <p className="text-xs text-[#D3BEB0] mt-0.5">
                    For shop counter pickup or direct store delivery without riders
                  </p>
                </div>
              </div>

              {/* Order summary banner */}
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono font-bold text-[#F5D061] text-sm block">
                    #{directDeliveryOrder.order_number}
                  </span>
                  <span className="text-white/80">{directDeliveryOrder.customer_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-serif font-bold text-[#F5D061] block">
                    ₹{directDeliveryOrder.total_amount}
                  </span>
                  <span className="text-[10px] text-white/50 uppercase font-semibold">
                    {directDeliveryOrder.payment_method.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Delivery Type Option */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-white/70 uppercase tracking-wider block">
                  Delivery Mode / Reason:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDirectDeliveryType("counter_pickup");
                      setDirectDeliveryNote("Customer picked up order directly at shop counter");
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                      directDeliveryType === "counter_pickup"
                        ? "bg-emerald-950/80 border-emerald-400 text-emerald-200"
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    <span className="block font-bold">🏪 Shop Counter Pickup</span>
                    <span className="text-[10px] block opacity-75">Customer arrived at shop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirectDeliveryType("direct_store_delivery");
                      setDirectDeliveryNote("Delivered directly by store manager / staff");
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                      directDeliveryType === "direct_store_delivery"
                        ? "bg-emerald-950/80 border-emerald-400 text-emerald-200"
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    <span className="block font-bold">🚚 Store Staff Delivery</span>
                    <span className="text-[10px] block opacity-75">Delivered without fleet rider</span>
                  </button>
                </div>
              </div>

              {/* Delivery Proof Photo Input (Live Camera Only - No Gallery Allowed) */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-white/70 uppercase tracking-wider flex items-center justify-between">
                  <span>Capture Live Delivery Photo Proof *</span>
                  {deliveryProofImage && (
                    <span className="text-emerald-400 text-[10px] font-bold">✓ Live Photo Attached</span>
                  )}
                </label>

                {deliveryProofImage ? (
                  <div className="p-3.5 rounded-2xl bg-black/60 border-2 border-emerald-500/60 flex items-center justify-between gap-3 shadow-lg">
                    <img
                      src={deliveryProofImage}
                      alt="Delivery Proof Snapshot"
                      className="w-24 h-24 rounded-xl object-cover border border-emerald-400 shadow-md shrink-0"
                    />
                    <div className="flex-1 text-xs">
                      <span className="text-emerald-300 font-bold block flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Live Delivery Photo Verified</span>
                      </span>
                      <span className="text-[11px] text-white/60 block mt-1">
                        Watermarked with live timestamp & saved on customer tax receipt.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeliveryProofImage(null)}
                      className="px-3 py-1.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs font-bold hover:bg-red-900/80 transition-colors shrink-0"
                    >
                      Retake
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-black/40 border border-[#D4AF37]/30 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-amber-300 px-1">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Camera className="w-3.5 h-3.5 text-[#F5D061]" />
                        <span>Live Camera Sensor Only</span>
                      </span>
                      <span className="text-[10px] text-white/50">Device gallery uploads prohibited</span>
                    </div>
                    <LiveCameraCapture
                      onPhotoCaptured={(dataUrl) => setDeliveryProofImage(dataUrl)}
                      label="Admin Delivery Camera"
                      overlayText="Handover Proof"
                      watermarkLabel="MITHAASE ADMIN DELIVERY PROOF"
                    />
                  </div>
                )}
              </div>

              {/* If COD and not paid, option to mark cash collected */}
              {directDeliveryOrder.payment_method === "cod" && directDeliveryOrder.payment_status !== "paid" && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center gap-2.5 text-xs text-amber-200">
                  <input
                    type="checkbox"
                    id="mark-paid-checkbox"
                    checked={directDeliveryMarkPaid}
                    onChange={(e) => setDirectDeliveryMarkPaid(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-black/60 border-white/20 cursor-pointer"
                  />
                  <label htmlFor="mark-paid-checkbox" className="cursor-pointer font-medium">
                    Collect Cash of <strong className="text-[#F5D061]">₹{directDeliveryOrder.total_amount}</strong> at counter & mark as <strong className="text-emerald-300">PAID</strong>
                  </label>
                </div>
              )}

              {/* Note */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-white/60 block">
                  Delivery / Pickup Note (Optional):
                </label>
                <input
                  type="text"
                  value={directDeliveryNote}
                  onChange={(e) => setDirectDeliveryNote(e.target.value)}
                  placeholder="e.g. Handed over at shop counter in Kothal Kalan"
                  className="w-full bg-[#110118] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={!deliveryProofImage || isSubmittingDirectDelivery}
                  onClick={handleConfirmDirectDelivery}
                  className="flex-1 py-3 px-4 rounded-full bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmittingDirectDelivery ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Delivery Proof...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Delivered (With Photo)</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDirectDeliveryOrder(null);
                    setDeliveryProofImage(null);
                  }}
                  className="py-3 px-4 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* CANCEL ORDER MODAL                                             */}
        {/* ============================================================== */}
        {cancelTargetOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-md rounded-3xl bg-[#1C0324] border-2 border-red-500/70 p-5 sm:p-6 shadow-2xl space-y-4 my-auto animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-red-400 font-bold">
                  <Ban className="w-5 h-5" />
                  <h3 className="text-base sm:text-lg font-serif font-black text-white">
                    Cancel Order #{cancelTargetOrder.order_number}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCancelTargetOrder(null)}
                  className="p-1 rounded-full text-white/50 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Warning if order was already paid via UPI */}
              {(cancelTargetOrder.payment_method === "upi" || cancelTargetOrder.payment_status === "paid") && (
                <div className="p-3.5 rounded-2xl bg-amber-950/70 border border-amber-500/60 text-amber-200 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>UPI Refund Process Will Start</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Customer paid <strong>₹{cancelTargetOrder.total_amount}</strong> online via UPI. Cancelling will immediately initiate a refund process that will be shown to the customer. You will then need to process the transfer and upload the screenshot proof with the transaction reference.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-white/80 mb-1.5">
                  Cancellation Reason (Shown to customer on tracking & receipts):
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Sweet box out of stock, customer requested cancellation, or delivery address not serviceable."
                  className="w-full bg-[#110118] border border-white/20 focus:border-red-400 rounded-xl p-3 text-xs text-white outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isCancellingOrder}
                  onClick={() => setCancelTargetOrder(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  disabled={isCancellingOrder}
                  onClick={handleCancelOrderSubmit}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  {isCancellingOrder ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Cancelling...</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5" />
                      <span>Confirm & Cancel Order</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PROCESS REFUND MODAL                                           */}
        {/* ============================================================== */}
        {refundTargetOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
            <div className="w-full max-w-lg rounded-3xl bg-[#1C0324] border-2 border-emerald-500/70 p-5 sm:p-6 shadow-2xl space-y-4 my-auto animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <RotateCcw className="w-5 h-5" />
                  <h3 className="text-base sm:text-lg font-serif font-black text-white">Process Customer UPI Refund</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRefundTargetOrder(null)}
                  className="p-1 rounded-full text-white/50 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Order Info & Refund Amount */}
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-white/50 block font-medium">Order Number</span>
                  <span className="font-mono font-bold text-[#F5D061] text-sm">{refundTargetOrder.order_number}</span>
                </div>
                <div>
                  <span className="text-white/50 block font-medium">Customer Name</span>
                  <span className="font-bold text-white text-sm">{refundTargetOrder.customer_name}</span>
                </div>
                <div>
                  <span className="text-white/50 block font-medium">Customer Mobile</span>
                  <span className="font-mono text-white/90">+91 {refundTargetOrder.customer_phone}</span>
                </div>
                <div>
                  <span className="text-white/50 block font-medium">Refund Amount</span>
                  <span className="font-mono font-black text-emerald-400 text-base">₹{refundTargetOrder.total_amount}</span>
                </div>
                {refundTargetOrder.upi_reference && (
                  <div className="col-span-2 pt-1 border-t border-white/10">
                    <span className="text-white/50 block font-medium">Original Payment UPI Reference:</span>
                    <span className="font-mono font-bold text-purple-300 text-xs">{refundTargetOrder.upi_reference}</span>
                  </div>
                )}
              </div>

              {/* Refund Transaction Number / UTR */}
              <div>
                <label className="block text-xs font-bold text-white/80 mb-1">
                  Refund UPI Transaction ID / UTR Number *
                </label>
                <input
                  type="text"
                  required
                  value={refundTxnId}
                  onChange={(e) => setRefundTxnId(e.target.value)}
                  placeholder="e.g. 429184920192 or Bank UTR Ref"
                  className="w-full bg-[#110118] border border-white/20 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono font-bold outline-none"
                />
              </div>

              {/* Screenshot Proof of Refund */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-white/80">
                  Upload Screenshot Proof of Refund Transfer *
                </label>
                {refundScreenshot ? (
                  <div className="p-3 rounded-2xl bg-black/60 border border-emerald-500/60 flex items-center justify-between gap-3">
                    <img
                      src={refundScreenshot}
                      alt="Refund Screenshot"
                      className="w-20 h-20 rounded-xl object-cover border border-emerald-400 shadow shrink-0"
                    />
                    <div className="flex-1 text-xs">
                      <span className="text-emerald-300 font-bold block flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Refund Screenshot Attached</span>
                      </span>
                      <span className="text-[11px] text-white/60 block mt-0.5">
                        Will be shown directly to customer on their live tracking & receipt.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRefundScreenshot(null)}
                      className="px-3 py-1.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs font-bold hover:bg-red-900/80 shrink-0"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/40 border-2 border-dashed border-[#D4AF37]/40 hover:border-emerald-400 cursor-pointer transition-colors text-center space-y-1.5">
                    <UploadCloud className="w-8 h-8 text-[#F5D061]" />
                    <span className="text-xs text-white font-bold">Select Refund Screenshot (PhonePe / GPay / Paytm / Bank)</span>
                    <span className="text-[10px] text-white/50">PNG, JPG, or WEBP receipt proof</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const res = event.target?.result as string;
                          if (res) setRefundScreenshot(res);
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Refund Note */}
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1">
                  Optional Note for Customer
                </label>
                <input
                  type="text"
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  placeholder="e.g. Refund of ₹... transferred back to your UPI account"
                  className="w-full bg-[#110118] border border-white/15 focus:border-emerald-400 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSubmittingRefund}
                  onClick={() => setRefundTargetOrder(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingRefund || !refundTxnId.trim() || !refundScreenshot}
                  onClick={handleRefundSubmit}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg active:scale-95 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmittingRefund ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording Refund Proof...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Complete Refund & Upload Proof</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
