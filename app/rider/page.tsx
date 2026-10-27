"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Order, OrderStatus } from "@/types";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { Diya } from "@/components/animations/Diya";
import {
  Bike,
  MapPin,
  Phone,
  Navigation,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  ShoppingBag,
  Layers,
  Banknote,
  Package,
  AlertCircle,
  Sparkles,
  Check,
  LogOut,
  KeyRound,
  User,
  Camera,
  Upload,
  X,
  Lock,
  Zap,
  Smartphone,
} from "lucide-react";
import { OrderAlertCard } from "@/components/notifications/OrderAlertCard";
import { playBeepNotification } from "@/lib/utils/audio";
import { LiveCameraCapture } from "@/components/camera/LiveCameraCapture";
import { RoleProfileModal } from "@/components/profile/RoleProfileModal";

export default function RiderDashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"current" | "out" | "delivered" | "all">("current");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [packedAlertOrder, setPackedAlertOrder] = useState<Order | null>(null);

  // Delivery photo proof modal state
  const [deliveryModalOrder, setDeliveryModalOrder] = useState<Order | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [codCashCollected, setCodCashCollected] = useState(false);
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);

  // Real-time GPS location state for delivery completion
  const [deliveryGps, setDeliveryGps] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    timestamp: string;
  } | null>(null);
  const [isAcquiringGps, setIsAcquiringGps] = useState(false);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);

  // Pickup photo to start delivery modal state
  const [pickupModalOrder, setPickupModalOrder] = useState<Order | null>(null);
  const [capturedPickupPhoto, setCapturedPickupPhoto] = useState<string | null>(null);
  const [isSubmittingPickup, setIsSubmittingPickup] = useState(false);

  // Rider Sign-in & Profile state
  const [riderName, setRiderName] = useState("");
  const [riderPin, setRiderPin] = useState("");
  const [riderId, setRiderId] = useState("");
  const [isRiderLoggedIn, setIsRiderLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("mithaase_rider_auth");
      const name = sessionStorage.getItem("mithaase_rider_name");
      const id = sessionStorage.getItem("mithaase_rider_id");
      if (auth === "true" && name) {
        setRiderName(name);
        if (id) setRiderId(id);
        setIsRiderLoggedIn(true);
      }
    }
  }, []);

  const handleRiderLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = riderName.trim();
    if (!cleanId) {
      setLoginError("Please enter your 10-digit mobile number or name");
      return;
    }
    if (/^\d+$/.test(cleanId) && cleanId.length !== 10) {
      setLoginError("Rider mobile number must be exactly 10 digits");
      return;
    }

    const cleanPin = riderPin.replace(/\D/g, "");
    if (cleanPin.length !== 6) {
      setLoginError("Rider security PIN must be exactly 6 digits");
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");

    try {
      const res = await fetch("/api/rider/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: cleanId,
          pin: cleanPin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      const rider = data.rider;
      setRiderId(rider.id);
      setRiderName(rider.name);
      setIsRiderLoggedIn(true);

      if (typeof window !== "undefined") {
        sessionStorage.setItem("mithaase_rider_auth", "true");
        sessionStorage.setItem("mithaase_rider_id", rider.id);
        sessionStorage.setItem("mithaase_rider_name", rider.name);
        if (rider.phone) sessionStorage.setItem("mithaase_rider_phone", rider.phone);
        if (rider.email) sessionStorage.setItem("mithaase_rider_email", rider.email);
        document.cookie = "mithaase_rider_session=true; path=/; max-age=86400; SameSite=Lax";
      }
      router.refresh();
    } catch (err: any) {
      setLoginError(err.message || "Invalid Rider Credentials or PIN");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRiderLogout = () => {
    setIsRiderLoggedIn(false);
    setRiderId("");
    sessionStorage.removeItem("mithaase_rider_auth");
    sessionStorage.removeItem("mithaase_rider_id");
    sessionStorage.removeItem("mithaase_rider_name");
    sessionStorage.removeItem("mithaase_rider_phone");
    sessionStorage.removeItem("mithaase_rider_email");
    if (typeof document !== "undefined") {
      document.cookie = "mithaase_rider_session=; path=/; max-age=0; SameSite=Lax";
    }
    router.push("/rider");
    router.refresh();
  };

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch(`/api/orders?role=rider&t=${Date.now()}`, {
        headers: { "x-role": "rider" },
      });
      if (res.ok) {
        const data: Order[] = await res.json();
        setOrders(data);
      }
    } catch {
      // ignore
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Real-time synchronization: Rider ONLY listens for status updates and group dispatches
  const { isConnected } = useRealtime({
    events: ["order_status_updated", "group_delivery_dispatched"],
    enablePollingFallback: true,
    pollingIntervalMs: 5000,
    onEvent: (payload) => {
      // Silently refresh orders in background
      fetchOrders(true);

      // Rider receives audible beep and popup card ONLY when admin explicitly marked PACKED and dispatched (not queued)
      if (
        payload.type === "order_status_updated" &&
        payload.data?.order_status === "ready_for_dispatch" &&
        !payload.data?.delivery_queued
      ) {
        playBeepNotification(3);
        setPackedAlertOrder(payload.data as Order);
        setActionNotice(`🛵 Order ${payload.data?.order_number || ""} is PACKED & called for delivery!`);
      } else if (payload.type === "group_delivery_dispatched") {
        playBeepNotification(3);
        const count = payload.data?.count || 1;
        const localities = (payload.data?.localities || []).join(", ");
        setActionNotice(
          `🛵 Group Dispatch Alert: ${count} Orders packed & ready for pickup together${
            localities ? ` (${localities})` : ""
          }!`
        );
        if (payload.data?.orders && payload.data.orders.length > 0) {
          setPackedAlertOrder(payload.data.orders[0]);
        }
      }
    },
  });

  // Acquire real-time GPS coordinates for delivery completion
  const acquireGps = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      setIsAcquiringGps(true);
      setGpsErrorMsg(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDeliveryGps({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            timestamp: new Date().toISOString(),
          });
          setIsAcquiringGps(false);
        },
        (err) => {
          console.warn("GPS acquire error:", err);
          setGpsErrorMsg("Could not lock GPS. Please ensure device location is on.");
          setIsAcquiringGps(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setGpsErrorMsg("Geolocation is not supported on this browser.");
    }
  }, []);

  // When delivery modal opens, automatically acquire real-time GPS
  useEffect(() => {
    if (deliveryModalOrder) {
      acquireGps();
    } else {
      setDeliveryGps(null);
      setGpsErrorMsg(null);
    }
  }, [deliveryModalOrder, acquireGps]);

  // Filter orders according to active tab
  // STRICT RULE: Rider must ONLY ever see and handle orders that:
  // 1. Have been set to PACKED by admin AND dispatched/called (ready_for_dispatch and NOT delivery_queued)
  // 2. OR are OUT FOR DELIVERY
  // 3. OR are DELIVERED (view history with masked privacy)
  // Pending confirmation, confirmed, preparing, or queued orders are NEVER visible or deliverable to rider.
  const filteredOrders = orders.filter((o) => {
    if (o.order_status === "cancelled") return false;

    const isDispatched = o.order_status === "ready_for_dispatch" && !o.delivery_queued;
    const isOut = o.order_status === "out_for_delivery";
    const isDelivered = o.order_status === "delivered";

    if (activeTab === "current") {
      // Active delivery tasks for the rider: Orders ready for pickup / dispatched or out for delivery
      return isDispatched || isOut;
    }
    if (activeTab === "out") {
      return isOut;
    }
    if (activeTab === "delivered") {
      return isDelivered;
    }
    // "all" tab: strictly only orders that have been dispatched to riders
    return isDispatched || isOut || isDelivered;
  });

  // Toggle selection for multi-order batch delivery
  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Start Batch Delivery for all selected orders
  const handleStartBatchDelivery = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsBatchUpdating(true);

    try {
      await Promise.all(
        selectedOrderIds.map((id) =>
          fetch(`/api/orders/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_status: "out_for_delivery",
              note: `Out for batch delivery with rider ${riderName || "Team"}`,
              changed_by: riderName || "Rider",
            }),
          })
        )
      );

      setActionNotice(`🚀 ${selectedOrderIds.length} orders marked OUT FOR DELIVERY in batch!`);
      setSelectedOrderIds([]);
      setActiveTab("out");
      fetchOrders(true);
    } catch {
      setActionNotice("Failed to update some orders in batch.");
    } finally {
      setIsBatchUpdating(false);
    }
  };

  // Single order status update (e.g. Delivered or Out for Delivery)
  const handleUpdateOrderStatus = async (
    order: Order,
    newStatus: OrderStatus,
    markPaidIfCod = false,
    deliveryProofPhoto?: string,
    pickupPhoto?: string,
    deliveryDetails?: {
      delivered_at?: string;
      delivered_lat?: number;
      delivered_lng?: number;
      delivered_location_name?: string;
      delivered_map_url?: string;
    }
  ) => {
    try {
      const body: any = {
        order_status: newStatus,
        note: `Order ${newStatus.replace(/_/g, " ")} by rider ${riderName || ""}`,
        changed_by: riderName || "Rider",
      };

      if (deliveryProofPhoto) {
        body.delivery_proof_photo = deliveryProofPhoto;
      }
      if (pickupPhoto) {
        body.pickup_photo = pickupPhoto;
      }
      if (deliveryDetails) {
        if (deliveryDetails.delivered_at) body.delivered_at = deliveryDetails.delivered_at;
        if (deliveryDetails.delivered_lat !== undefined) body.delivered_lat = deliveryDetails.delivered_lat;
        if (deliveryDetails.delivered_lng !== undefined) body.delivered_lng = deliveryDetails.delivered_lng;
        if (deliveryDetails.delivered_location_name) body.delivered_location_name = deliveryDetails.delivered_location_name;
        if (deliveryDetails.delivered_map_url) body.delivered_map_url = deliveryDetails.delivered_map_url;
      }

      if (markPaidIfCod && order.payment_method === "cod") {
        body.payment_status = "paid";
      }

      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setActionNotice(`Order ${order.order_number} marked as ${newStatus.replace(/_/g, " ").toUpperCase()}!`);
        fetchOrders(true);
      }
    } catch {
      // ignore
    }
  };

  // Confirm start delivery with pickup photo
  const handleConfirmStartDeliveryWithPhoto = async () => {
    if (!pickupModalOrder || !capturedPickupPhoto) return;
    setIsSubmittingPickup(true);
    try {
      await handleUpdateOrderStatus(
        pickupModalOrder,
        "out_for_delivery",
        false,
        undefined,
        capturedPickupPhoto
      );
      setPickupModalOrder(null);
      setCapturedPickupPhoto(null);
      setActiveTab("out");
    } finally {
      setIsSubmittingPickup(false);
    }
  };
  const handleConfirmDeliveryWithPhoto = async () => {
    if (!deliveryModalOrder || !capturedPhoto) return;
    setIsSubmittingDelivery(true);
    try {
      const nowIso = new Date().toISOString();
      const lat = deliveryGps?.lat ?? deliveryModalOrder.latitude ?? 28.1907;
      const lng = deliveryGps?.lng ?? deliveryModalOrder.longitude ?? 76.1624;
      const locName = `${deliveryModalOrder.locality} (${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E)`;
      const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;

      await handleUpdateOrderStatus(
        deliveryModalOrder,
        "delivered",
        codCashCollected || deliveryModalOrder.payment_method !== "cod",
        capturedPhoto,
        undefined,
        {
          delivered_at: nowIso,
          delivered_lat: lat,
          delivered_lng: lng,
          delivered_location_name: locName,
          delivered_map_url: mapUrl,
        }
      );
      setDeliveryModalOrder(null);
      setCapturedPhoto(null);
      setCodCashCollected(false);
      setDeliveryGps(null);
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  // Handler when rider clicks Deliver on alert popup -> prompt for pickup photo!
  const handleRiderDeliver = (order: Order) => {
    setPackedAlertOrder(null);
    setPickupModalOrder(order);
    setCapturedPickupPhoto(null);
  };

  // Handler when rider clicks Queue on alert popup
  const handleRiderQueue = (order: Order) => {
    setActionNotice(`Order ${order.order_number} kept in dispatch queue.`);
    setPackedAlertOrder(null);
  };

  // Generate direct Google Maps navigation URL
  const getGoogleMapsNavUrl = (order: Order) => {
    if (order.latitude && order.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`;
    }
    const fullQuery = `${order.delivery_address}, ${order.locality}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullQuery)}`;
  };

  // Selected orders metrics
  const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));
  const selectedCashToCollect = selectedOrders
    .filter((o) => o.payment_method === "cod" && o.payment_status !== "paid")
    .reduce((sum, o) => sum + o.total_amount, 0);

  if (!isRiderLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-[#180320] via-[#100117] to-black">
        <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#1C0324] border-2 border-[#D4AF37]/40 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#400B16] border-2 border-[#D4AF37] flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(212,175,55,0.4)]">
            <Bike className="w-8 h-8 text-[#F5D061]" />
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#F5D061] block mb-1">
              Shree Shyam Sweets
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-white">
              Diwali <span className="gold-gradient-text">Rider Delivery App</span>
            </h1>
            <p className="text-xs text-[#D3BEB0] mt-1.5">
              Access your doorstep delivery routes, customer Google Maps pins, and batch delivery tools.
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/40 text-red-300 text-xs text-left">
              {loginError}
            </div>
          )}

          <form onSubmit={handleRiderLogin} className="space-y-4 text-xs text-left">
            <div>
              <label className="block text-white/80 font-bold mb-1.5">
                Rider 10-Digit Mobile / Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={riderName}
                  onChange={(e) => setRiderName(e.target.value)}
                  placeholder="Enter 10-digit mobile or name"
                  className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-10 pr-4 py-3 text-white text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-white/80 font-bold mb-1.5">
                Rider Security PIN (6 Digits) *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={riderPin}
                  onChange={(e) => setRiderPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter 6-digit PIN"
                  className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-10 pr-4 py-3 text-white text-sm font-mono tracking-widest outline-none"
                />
              </div>
              <span className="text-[10px] text-white/40 block mt-1">
                Must be exactly 6 digits
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 rounded-full gold-gradient-btn font-bold text-sm shadow-xl active:scale-95 flex items-center justify-center gap-2"
            >
              <Bike className="w-4 h-4" />
              <span>{isLoggingIn ? "Authenticating Fleet..." : "Start Delivery Shift"}</span>
            </button>
          </form>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-[#D3BEB0]">
            <Link href="/" className="hover:text-white">
              ← Customer Storefront
            </Link>
            <span className="text-white/40 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Registered Riders Only</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#110115] text-[#FFF8EE] flex flex-col pb-24 overflow-x-hidden max-w-full w-full">
      {/* 10-Second Packed Order Alert Card */}
      {packedAlertOrder && (
        <OrderAlertCard
          order={packedAlertOrder}
          title="Order Packed & Ready for Delivery"
          badgeType="packed_ready"
          mode="rider"
          onDismiss={() => setPackedAlertOrder(null)}
          onDeliver={handleRiderDeliver}
          onQueue={handleRiderQueue}
          actionLabel="View in Dispatch Queue"
        />
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#1A0324]/95 backdrop-blur-md border-b border-[#D4AF37]/30 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#400B16] border border-[#D4AF37] flex items-center justify-center text-[#F5D061]">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-serif font-black text-sm sm:text-base text-white">
                  Rider: {riderName}
                </h1>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <span className="text-[10px] text-[#D4AF37] block font-mono">
                {isConnected ? "Live GPS & Dispatch Feed Active" : "Connecting..."}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProfileModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#F5D061] border border-[#D4AF37]/40 flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
              title="View & Edit Rider Profile"
            >
              <div className="relative">
                <User className="w-3.5 h-3.5" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 border border-[#16031E] ring-1 ring-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse" />
              </div>
              <span className="hidden sm:inline">My Profile</span>
            </button>

            <button
              onClick={() => fetchOrders()}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={handleRiderLogout}
              className="p-2 rounded-xl bg-white/5 hover:bg-rose-950/40 text-rose-300"
              title="End Shift"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto w-full p-4 space-y-4 flex-1">
        {/* Real-time Alert Toast */}
        {actionNotice && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/90 to-[#23042B] border border-emerald-400 text-emerald-200 text-xs flex items-center justify-between gap-2 shadow-lg animate-pulse">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{actionNotice}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="text-white/60 hover:text-white text-xs px-2 py-0.5 rounded bg-black/30"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab Filters */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-[#1A0324] border border-white/10 text-[11px] sm:text-xs font-semibold">
          <button
            onClick={() => setActiveTab("current")}
            className={`py-2 px-1 rounded-xl transition-all truncate text-center ${
              activeTab === "current"
                ? "bg-[#D4AF37] text-[#16031E] font-bold shadow-md"
                : "text-white/60 hover:text-white"
            }`}
          >
            ⚡ Ready ({orders.filter((o) => (o.order_status === "ready_for_dispatch" && !o.delivery_queued) || o.order_status === "out_for_delivery").length})
          </button>
          <button
            onClick={() => setActiveTab("out")}
            className={`py-2 px-1 rounded-xl transition-all truncate text-center ${
              activeTab === "out"
                ? "bg-blue-600 text-white font-bold shadow-md"
                : "text-white/60 hover:text-white"
            }`}
          >
            On Road ({orders.filter((o) => o.order_status === "out_for_delivery").length})
          </button>
          <button
            onClick={() => setActiveTab("delivered")}
            className={`py-2 px-1 rounded-xl transition-all truncate text-center ${
              activeTab === "delivered"
                ? "bg-emerald-600 text-white font-bold shadow-md"
                : "text-white/60 hover:text-white"
            }`}
          >
            Delivered ({orders.filter((o) => o.order_status === "delivered").length})
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`py-2 px-1 rounded-xl transition-all truncate text-center ${
              activeTab === "all"
                ? "bg-white/20 text-white font-bold"
                : "text-white/60 hover:text-white"
            }`}
          >
            All ({orders.filter((o) => (o.order_status === "ready_for_dispatch" && !o.delivery_queued) || o.order_status === "out_for_delivery" || o.order_status === "delivered").length})
          </button>
        </div>

        {/* Order Cards List */}
        {filteredOrders.length === 0 ? (
          <div className="p-10 rounded-3xl bg-[#1A0324] border border-white/10 text-center space-y-2">
            <Package className="w-8 h-8 text-white/30 mx-auto" />
            <p className="text-sm font-semibold text-white/70">No orders in this view.</p>
            <p className="text-xs text-white/40">
              New deliveries assigned to you will automatically pop up in real-time.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const isSelected = selectedOrderIds.includes(order.id);
              const navUrl = getGoogleMapsNavUrl(order);
              const isOut = order.order_status === "out_for_delivery";
              const isDelivered = order.order_status === "delivered";

              return (
                <div
                  key={order.id}
                  className={`p-4 sm:p-5 rounded-3xl border transition-all duration-300 ${
                    isSelected
                      ? "bg-[#280532] border-[#F5D061] shadow-[0_0_20px_rgba(212,175,55,0.3)] ring-1 ring-[#F5D061]"
                      : isOut
                      ? "bg-[#160B24] border-blue-500/40"
                      : isDelivered
                      ? "bg-white/[0.02] border-white/10 opacity-70"
                      : "bg-[#1A0324] border-[#D4AF37]/25 hover:border-[#D4AF37]/50"
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      {/* Batch Checkbox (only for ready / un-delivered orders) */}
                      {!isDelivered && (
                        <button
                          type="button"
                          onClick={() => toggleSelectOrder(order.id)}
                          className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                            isSelected
                              ? "bg-[#D4AF37] border-[#F5D061] text-[#16031E]"
                              : "border-white/20 bg-white/5 hover:border-white/40"
                          }`}
                          title="Select for batch run"
                        >
                          {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                        </button>
                      )}

                      <div>
                        <span className="font-mono text-xs font-bold text-[#F5D061]">
                          {order.order_number}
                        </span>
                        <span className="text-[10px] text-white/40 block">
                          {new Date(order.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <span
                      className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                        isDelivered
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                          : isOut
                          ? "bg-blue-950 text-blue-300 border border-blue-500/40 animate-pulse"
                          : "bg-amber-950 text-amber-300 border border-amber-500/40"
                      }`}
                    >
                      {order.order_status.replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* When delivery is completed: Lock down all customer details, location, phone, amount, bill, items, and photos */}
                  {isDelivered ? (
                    <div className="p-4 rounded-2xl bg-[#14061E]/90 border border-emerald-500/30 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Delivery Completed & Handed Over</span>
                        </span>
                        <span className="text-[10px] font-mono text-white/50">
                          {order.delivered_at
                            ? new Date(order.delivered_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : new Date(order.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[11px] text-white/70 leading-relaxed flex items-start gap-2.5">
                        <Lock className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-white block mb-0.5">Customer Privacy Protected</strong>
                          <span>
                            Delivery completed. Customer phone number, address, sweets list, bill amount, and photos are locked and archived for customer data privacy.
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Recipient Details & 1-Tap Dial */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 text-xs">
                        <div>
                          <span className="text-white/50 text-[10px] block uppercase font-semibold">
                            Customer & Phone
                          </span>
                          <span className="text-white font-bold text-sm block">
                            {order.customer_name}
                          </span>
                          <a
                            href={`tel:${order.customer_phone}`}
                            className="inline-flex items-center gap-1.5 text-emerald-400 font-mono font-semibold text-xs mt-1 hover:underline bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30"
                          >
                            <Phone className="w-3 h-3" />
                            <span>+91 {order.customer_phone} (Call)</span>
                          </a>
                        </div>

                        <div>
                          <span className="text-white/50 text-[10px] block uppercase font-semibold">
                            Delivery Address
                          </span>
                          <p className="text-white font-medium leading-snug">
                            {order.delivery_address}
                          </p>
                          <span className="text-[#F5D061] text-[11px] font-semibold block mt-0.5">
                            Locality: {order.locality}
                            {order.landmark ? ` • Landmark: ${order.landmark}` : ""}
                          </span>
                        </div>
                      </div>

                      {/* Payment Alert Box */}
                      <div
                        className={`p-3 rounded-2xl border mb-3 flex items-center justify-between text-xs ${
                          order.payment_method === "cod" && order.payment_status !== "paid"
                            ? "bg-amber-950/50 border-amber-500/40 text-amber-200"
                            : "bg-emerald-950/40 border-emerald-500/30 text-emerald-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {order.payment_method === "cod" ? (
                            <Banknote className="w-4 h-4 shrink-0 text-amber-400" />
                          ) : order.upi_reference?.toLowerCase().startsWith("youpi:") ? (
                            <Zap className="w-4 h-4 shrink-0 text-emerald-400" />
                          ) : (
                            <Smartphone className="w-4 h-4 shrink-0 text-purple-400" />
                          )}
                          <div>
                            {order.payment_method === "cod" && order.payment_status !== "paid" ? (
                              <span className="font-bold block text-sm text-[#F5D061]">
                                💰 CASH TO COLLECT: ₹{order.total_amount}
                              </span>
                            ) : order.upi_reference?.toLowerCase().startsWith("youpi:") ? (
                              <span className="font-bold block text-sm text-emerald-300">
                                ⚡ AUTO-CONFIRMED UPI (₹{order.total_amount}) — No Cash to Collect
                              </span>
                            ) : (
                              <span className="font-bold block text-sm text-emerald-300">
                                ✅ PAID ONLINE UPI (₹{order.total_amount}) — No Cash to Collect
                              </span>
                            )}
                            <span className="text-[10px] opacity-75">
                              Payment: {order.payment_method === "cod" ? "Cash on Delivery" : order.upi_reference?.toLowerCase().startsWith("youpi:") ? "Auto Gateway UPI" : "Manual UPI"}
                            </span>
                          </div>
                        </div>

                        <span className="font-mono text-base font-black">₹{order.total_amount}</span>
                      </div>

                      {/* Purchased Sweets Summary */}
                      <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 mb-3 text-[11px] text-[#D3BEB0]">
                        <span className="text-white/50 block text-[10px] font-semibold mb-1">
                          Sweets in Box ({order.items?.length || 0}):
                        </span>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {(order.items || []).map((it: any, idx: number) => {
                            const itemName = it.product_name_snapshot || it.productName || it.name || "Sweet Box";
                            const itemVariant = it.variant_name_snapshot || it.variantName || it.unit || "";
                            return (
                              <span key={it.id || idx} className="text-white font-medium">
                                • {itemName} {itemVariant ? `(${itemVariant})` : ""} × {it.quantity || 1}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Action Buttons: Google Maps Nav & Delivery Controls */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                        {/* PRIMARY FEATURE: GO TO LOCATION (Opens user-provided pin in Google Maps) */}
                        <a
                          href={navUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full sm:w-auto sm:flex-1 py-2.5 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all text-center"
                        >
                          <Navigation className="w-4 h-4 shrink-0" />
                          <span>Go to Location (Google Maps)</span>
                          <ExternalLink className="w-3 h-3 opacity-70 shrink-0" />
                        </a>

                        {/* Delivery Status Triggers */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
                          {!isOut && (
                            <button
                              type="button"
                              onClick={() => {
                                setPickupModalOrder(order);
                                setCapturedPickupPhoto(null);
                              }}
                              className="flex-1 sm:flex-initial py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#16031E] font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all whitespace-nowrap"
                            >
                              <Camera className="w-3.5 h-3.5 shrink-0" />
                              <span>Start Delivery 🛵</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setDeliveryModalOrder(order);
                              setCapturedPhoto(null);
                              setCodCashCollected(order.payment_method !== "cod" || order.payment_status === "paid");
                            }}
                            className="flex-1 sm:flex-initial py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all whitespace-nowrap"
                          >
                            <Camera className="w-3.5 h-3.5 shrink-0" />
                            <span>Delivered (Photo) ✓</span>
                          </button>
                        </div>

                        {/* Pickup Photo when Out for Delivery */}
                        {order.pickup_photo && (
                          <div className="w-full mt-2 p-2 bg-indigo-950/40 border border-indigo-500/30 rounded-xl flex items-center gap-2.5">
                            <a href={order.pickup_photo} target="_blank" rel="noopener noreferrer" className="relative group shrink-0">
                              <img
                                src={order.pickup_photo}
                                alt="Pickup Dispatch Photo"
                                className="w-10 h-10 rounded-lg object-cover border border-indigo-400 group-hover:scale-105 transition-all"
                              />
                            </a>
                            <div className="flex-1 min-w-0 text-left">
                              <span className="text-[11px] font-bold text-indigo-300 block">
                                🛵 Pickup / Dispatch Photo Attached
                              </span>
                              <span className="text-[10px] text-white/50 block">
                                Captured before starting delivery run
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Multi-Order Batch Delivery Dock */}
      {selectedOrderIds.length > 0 && (
        <aside aria-label="Batch delivery actions" className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-[#1A0324]/95 border-t-2 border-[#D4AF37] backdrop-blur-md shadow-[0_-10px_35px_rgba(0,0,0,0.8)]">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#D4AF37] text-[#16031E] flex items-center justify-center font-black text-sm">
                {selectedOrderIds.length}
              </div>
              <div>
                <span className="font-bold text-white text-sm block">
                  {selectedOrderIds.length} Orders Selected for Batch Delivery Run
                </span>
                <span className="text-[11px] text-[#F5D061]">
                  Total Cash to Collect: <strong>₹{selectedCashToCollect}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSelectedOrderIds([])}
                className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-xs font-semibold"
              >
                Clear
              </button>

              <button
                type="button"
                disabled={isBatchUpdating}
                onClick={handleStartBatchDelivery}
                className="flex-1 sm:flex-initial py-3 px-6 rounded-xl gold-gradient-btn font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95"
              >
                <Bike className="w-4 h-4" />
                <span>
                  {isBatchUpdating
                    ? "Dispatching Batch..."
                    : `Start Batch Run (${selectedOrderIds.length} Orders)`}
                </span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Real-time Doorstep Delivery Photo Capture Modal */}
      {deliveryModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-[#1F0728] border-2 border-[#D4AF37] rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 my-auto">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-white">
                    Doorstep Delivery Proof
                  </h3>
                  <p className="text-xs text-[#F5D061]">
                    Order #{deliveryModalOrder.order_number}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeliveryModalOrder(null);
                  setCapturedPhoto(null);
                }}
                className="text-white/60 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Info */}
            <div className="p-3 bg-white/5 rounded-xl text-xs space-y-1">
              <div className="font-semibold text-white">
                {deliveryModalOrder.customer_name} • {deliveryModalOrder.customer_phone}
              </div>
              <div className="text-white/70">
                📍 {deliveryModalOrder.delivery_address}, {deliveryModalOrder.locality}
              </div>
            </div>

            {/* COD Payment Collection Check */}
            {deliveryModalOrder.payment_method === "cod" && deliveryModalOrder.payment_status !== "paid" && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">
                    💵 Cash on Delivery to Collect:
                  </span>
                  <span className="text-sm font-black text-[#D4AF37]">
                    ₹{deliveryModalOrder.total_amount}
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={codCashCollected}
                    onChange={(e) => setCodCashCollected(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-white font-medium">
                    I have collected ₹{deliveryModalOrder.total_amount} in cash from customer
                  </span>
                </label>
              </div>
            )}

            {/* Real-time GPS Location Status Box */}
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Real-Time Rider GPS Location <span className="text-red-400">*</span></span>
                </span>
                <button
                  type="button"
                  onClick={acquireGps}
                  className="text-[10px] text-[#F5D061] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isAcquiringGps ? "animate-spin" : ""}`} />
                  <span>Refresh GPS</span>
                </button>
              </div>

              {isAcquiringGps ? (
                <div className="flex items-center gap-2 text-[#D3BEB0] text-[11px] py-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#F5D061]" />
                  <span>Acquiring satellite GPS coordinates...</span>
                </div>
              ) : deliveryGps ? (
                <div className="space-y-0.5 text-[11px] bg-black/40 p-2 rounded-xl border border-emerald-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-mono font-bold">
                      ✓ GPS Locked: {deliveryGps.lat.toFixed(5)}° N, {deliveryGps.lng.toFixed(5)}° E
                    </span>
                    <span className="text-emerald-300 text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950">
                      ±{deliveryGps.accuracy}m
                    </span>
                  </div>
                  <span className="text-white/60 text-[10px] block font-mono">
                    Time: {new Date(deliveryGps.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} • Date: {new Date(deliveryGps.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
                  <span>⚠️ {gpsErrorMsg || "Attempting to locate rider device..."}</span>
                </div>
              )}
            </div>

            {/* Real-time Camera Click Section (Live Viewfinder Only - No File Selection) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-white/90">
                📸 Take Real-Time Photo of Sweets at Doorstep <span className="text-red-400">*</span>
              </label>

              {capturedPhoto ? (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-lg max-h-60 bg-black flex items-center justify-center">
                    <img
                      src={capturedPhoto}
                      alt="Captured delivery proof"
                      className="w-full h-auto max-h-60 object-contain"
                    />
                    <div className="absolute top-2 right-2 px-2.5 py-1 bg-emerald-600/90 text-white text-[11px] font-bold rounded-full flex items-center gap-1 shadow">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Real-Time Photo Captured
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCapturedPhoto(null)}
                    className="w-full py-2.5 px-4 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-95"
                  >
                    <Camera className="w-4 h-4 text-[#F5D061]" />
                    <span>Retake Real-Time Photo</span>
                  </button>
                </div>
              ) : (
                <LiveCameraCapture
                  onPhotoCaptured={(dataUrl) => setCapturedPhoto(dataUrl)}
                  label="Doorstep Delivery Proof"
                  overlayText="Doorstep Sweets Handover"
                />
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={
                  !capturedPhoto ||
                  (deliveryModalOrder.payment_method === "cod" &&
                    deliveryModalOrder.payment_status !== "paid" &&
                    !codCashCollected) ||
                  isSubmittingDelivery
                }
                onClick={handleConfirmDeliveryWithPhoto}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {isSubmittingDelivery ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Completing Delivery...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Deliver Order (with Proof)</span>
                  </>
                )}
              </button>
              {!capturedPhoto && (
                <p className="text-[11px] text-amber-300 text-center mt-2">
                  ⚠️ Photo proof is required to confirm successful delivery.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Real-time Dispatch / Pickup Photo Capture Modal (To Start Delivery) */}
      {pickupModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-[#1F0728] border-2 border-amber-500 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 my-auto">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-white">
                    Start Delivery Photo
                  </h3>
                  <p className="text-xs text-[#F5D061]">
                    Order #{pickupModalOrder.order_number}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPickupModalOrder(null);
                  setCapturedPickupPhoto(null);
                }}
                className="text-white/60 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer & Destination Summary */}
            <div className="p-3 bg-white/5 rounded-xl text-xs space-y-1">
              <div className="font-semibold text-white">
                Destination: {pickupModalOrder.customer_name} • {pickupModalOrder.customer_phone}
              </div>
              <div className="text-white/70">
                📍 {pickupModalOrder.delivery_address}, {pickupModalOrder.locality}
              </div>
            </div>

            {/* Camera Capture Section */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-white/90">
                📸 Click Photo of Packed Sweets on Bike / Pickup Counter <span className="text-amber-400">*</span>
              </label>

              {capturedPickupPhoto ? (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-amber-500 shadow-lg max-h-60 bg-black flex items-center justify-center">
                    <img
                      src={capturedPickupPhoto}
                      alt="Captured pickup proof"
                      className="w-full h-auto max-h-60 object-contain"
                    />
                    <div className="absolute top-2 right-2 px-2.5 py-1 bg-amber-500 text-[#16031E] text-[11px] font-black rounded-full flex items-center gap-1 shadow">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Dispatch
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCapturedPickupPhoto(null)}
                    className="w-full py-2.5 px-4 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-95"
                  >
                    <Camera className="w-4 h-4 text-[#F5D061]" />
                    <span>Retake Real-Time Photo</span>
                  </button>
                </div>
              ) : (
                <LiveCameraCapture
                  onPhotoCaptured={(dataUrl) => setCapturedPickupPhoto(dataUrl)}
                  label="Pickup Sweets"
                  overlayText="Loading Sweets on Bike"
                />
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={!capturedPickupPhoto || isSubmittingPickup}
                onClick={handleConfirmStartDeliveryWithPhoto}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-[#D4AF37] hover:from-amber-400 hover:to-[#F5D061] disabled:opacity-40 disabled:cursor-not-allowed text-[#16031E] font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {isSubmittingPickup ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#16031E]" />
                    <span>Starting Delivery...</span>
                  </>
                ) : (
                  <>
                    <Bike className="w-4 h-4 text-[#16031E]" />
                    <span>Confirm & Start Delivery 🚀</span>
                  </>
                )}
              </button>
              {!capturedPickupPhoto && (
                <p className="text-[11px] text-amber-300 text-center mt-2">
                  ⚠️ Dispatch photo is required to start the delivery run.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rider Profile Section Modal */}
      <RoleProfileModal
        role="rider"
        initialRiderId={riderId}
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </div>
  );
}
