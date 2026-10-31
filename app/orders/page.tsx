"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CustomerAuthPortal } from "@/components/auth/CustomerAuthPortal";
import { Order, StoreSettings } from "@/types";
import { useUserAuth } from "@/lib/context/user-auth-context";
import { useStoreSettings } from "@/lib/context/store-context";
import { Navbar } from "@/components/storefront/Navbar";
import { Footer } from "@/components/storefront/Footer";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { OrderReceipt } from "@/components/orders/OrderReceipt";
import { CancelOrderModal } from "@/components/orders/CancelOrderModal";
import {
  Receipt,
  Package,
  Clock,
  CheckCircle2,
  Bike,
  AlertCircle,
  Search,
  ArrowRight,
  ShoppingBag,
  ExternalLink,
  RefreshCw,
  X,
  FileText,
  Lock,
  Printer,
} from "lucide-react";

export default function CustomerOrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated, isHydrated } = useUserAuth();
  const { settings } = useStoreSettings();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);
  const [selectedCancelOrder, setSelectedCancelOrder] = useState<Order | null>(null);

  // Fetch orders matching authenticated customer email
  const fetchCustomerOrders = useCallback(async () => {
    if (!user?.email) {
      setOrders([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/orders?email=${encodeURIComponent(user.email)}&t=${Date.now()}`, {
        headers: {
          "x-customer-auth-email": user.email,
        },
      });
      if (res.ok) {
        const data: Order[] = await res.json();
        setOrders(data);
      } else {
        setOrders([]);
      }
    } catch {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      setOrders([]);
      setSelectedReceiptOrder(null);
      setIsLoading(false);
      router.replace("/#shop");
    } else if (isAuthenticated && user?.email) {
      fetchCustomerOrders();
    }
  }, [isAuthenticated, isHydrated, user, fetchCustomerOrders, router]);

  // Real-time synchronization for customer orders
  useRealtime({
    events: ["order_created", "order_status_updated"],
    enablePollingFallback: true,
    pollingIntervalMs: 3000,
    onEvent: () => {
      if (isAuthenticated && user?.email) {
        fetchCustomerOrders();
      }
    },
  });


  const filteredOrders = orders.filter((o) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      o.order_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.items.some((it) => it.product_name_snapshot.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#16031E] text-[#FFF8EE] overflow-x-hidden max-w-full w-full print:bg-transparent print:text-black">
      <div className="print:hidden">
        <Navbar />
      </div>

      <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full print:p-0 print:m-0 print:max-w-full">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 print:hidden">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#3B0E4D] border border-[#D4AF37]/40 text-[#F5D061] text-xs font-semibold tracking-wider uppercase mb-3 shadow-md">
            <Receipt className="w-3.5 h-3.5 text-[#F5D061]" />
            <span>Customer Portal</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-black text-[#FFF8EE]">
            My Orders & <span className="gold-gradient-text">Official Receipts</span>
          </h1>

          <p className="text-xs sm:text-sm text-[#D3BEB0] mt-2 max-w-md mx-auto">
            View your festival sweets booking timeline, live rider dispatch status, and download tax receipts.
          </p>
        </div>

        {/* SECURITY ENFORCEMENT: Customer Login Required */}
        {!isAuthenticated ? (
          <div className="mb-10 max-w-lg mx-auto print:hidden">
            <CustomerAuthPortal
              mode="embedded"
              title="Orders Portal"
              subtitle="Sign in to view your festival sweets bookings, live rider dispatch status, and official tax receipts."
              onSuccess={() => {
                router.push("/#shop");
                router.refresh();
              }}
            />
          </div>
        ) : null}

        {/* Modal Pop-up for Full Official Receipt - Strictly authenticated only */}
        {isAuthenticated && selectedReceiptOrder && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-modal-title"
            className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-md p-2 sm:p-4 md:p-6 animate-fadeIn print:static print:p-0 print:m-0 print:bg-transparent print:overflow-visible"
          >
            <div className="min-h-full flex items-start justify-center py-4 sm:py-8 print:p-0 print:m-0 print:min-h-0 print:block">
              <div className="relative w-full max-w-3xl bg-[#FAF6EE] text-[#1D0823] rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] border-2 sm:border-4 border-[#D4AF37] overflow-hidden my-auto print:border-none print:shadow-none print:m-0 print:p-0 print:max-w-none print:overflow-visible">
                {/* Modal Top Control Bar (Sticky & Print-hidden) */}
                <div className="sticky top-0 z-30 bg-[#24062E] text-white px-4 py-3 sm:px-6 flex items-center justify-between border-b-2 border-[#D4AF37]/50 shadow-md print:hidden">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#580E1E] border border-[#D4AF37] flex items-center justify-center text-[#F5D061] shrink-0 shadow-sm">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 id="receipt-modal-title" className="font-serif font-bold text-sm sm:text-base text-white">
                        Official Order Receipt
                      </h3>
                      <span className="text-[11px] text-[#F5D061] font-mono">
                        #{selectedReceiptOrder.order_number}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-[#F5D061] hover:text-white text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                      title="Print Official Tax Receipt"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Print / Save PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedReceiptOrder(null)}
                      className="py-1.5 px-3 rounded-xl bg-[#580E1E] hover:bg-[#721427] text-white text-xs font-bold flex items-center gap-1 border border-[#D4AF37]/40 shadow-sm active:scale-95 transition-all cursor-pointer"
                      aria-label="Close receipt"
                    >
                      <X className="w-4 h-4" />
                      <span>Close</span>
                    </button>
                  </div>
                </div>

                <div className="p-2 sm:p-5 md:p-6 print:p-0 print:m-0">
                  <OrderReceipt order={selectedReceiptOrder} settings={settings} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Orders Listing (Only when authenticated) */}
        {isAuthenticated && (
          <div className="print:hidden">
            {isLoading ? (
              <div className="py-16 text-center">
                <RefreshCw className="w-8 h-8 text-[#D4AF37] animate-spin mx-auto mb-3" />
                <p className="text-xs text-[#D3BEB0]">Loading your festival orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
            <div className="p-8 sm:p-12 rounded-3xl bg-[#20052B] border border-white/10 text-center max-w-lg mx-auto space-y-4">
              <ShoppingBag className="w-12 h-12 text-white/30 mx-auto" />
              <h3 className="text-lg font-serif font-bold text-white">No Orders Found</h3>
              <p className="text-xs text-[#D3BEB0] leading-relaxed">
                You haven&apos;t placed any Diwali sweets orders yet with this account.
              </p>
              <Link
                href="/#shop"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full gold-gradient-btn text-xs font-bold shadow-lg"
              >
                <span>Browse Diwali Sweets Shop</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-[#D3BEB0] px-2">
                <span>Showing {filteredOrders.length} {filteredOrders.length === 1 ? "Order" : "Orders"}</span>
                <span className="font-semibold text-emerald-400">Real-time status synced</span>
              </div>

            <div className="space-y-4">
              {filteredOrders.map((ord) => {
                const isDelivered = ord.order_status === "delivered";
                const isPaid = ord.payment_status === "paid";

                return (
                  <div
                    key={ord.id}
                    className="p-5 sm:p-6 rounded-3xl bg-[#20052B] border border-[#D4AF37]/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all hover:border-[#D4AF37]"
                  >
                    {/* Left: Order Info & Items */}
                    <div className="space-y-2.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-[#F5D061]">
                          {ord.order_number}
                        </span>
                        <span className="text-[11px] text-white/40">•</span>
                        <span className="text-[11px] text-white/60">
                          {new Date(ord.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                            isDelivered
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                              : ord.order_status === "out_for_delivery"
                              ? "bg-blue-950 text-blue-300 border border-blue-500/40 animate-pulse"
                              : "bg-amber-950 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          {ord.order_status.replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* Purchased Items List Preview */}
                      <div className="text-xs text-white/90 space-y-1">
                        {ord.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-1.5 text-xs text-[#D3BEB0]">
                            <span className="text-white font-medium">• {item.product_name_snapshot}</span>
                            <span className="text-[#F5D061] text-[11px]">
                              ({item.variant_name_snapshot}) × {item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="text-[11px] text-white/50 pt-1">
                        <span>Delivered to: </span>
                        <strong className="text-white">{ord.customer_name}</strong> •{" "}
                        <span>{ord.locality}</span>
                      </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-white/10 shrink-0">
                      <div className="text-left md:text-right">
                        <span className="text-[10px] text-white/50 block uppercase font-semibold">
                          Total Amount
                        </span>
                        <span className="text-xl font-serif font-black text-[#F5D061]">
                          ₹{ord.total_amount}
                        </span>
                        {(Number(ord.discount_amount) > 0 || ord.coupon_code || Number(ord.delivery_charge) === 0) && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 font-bold bg-emerald-950/70 border border-emerald-500/40 px-2 py-0.5 rounded-md mt-0.5">
                            <span>🏷️ {ord.coupon_code || "OFFER"}:</span>
                            <span className="text-emerald-400">
                              {Number(ord.discount_amount) > 0
                                ? `Saved ₹${Number(ord.discount_amount)}`
                                : "Free Delivery"}
                            </span>
                          </span>
                        )}
                        <span
                          className={`block text-[10px] font-bold ${
                            ord.payment_method === "upi"
                              ? "text-purple-300"
                              : isPaid
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }`}
                        >
                          {ord.payment_method === "upi" ? (
                            <>
                              <span>⚡ UPI Paid Online</span>
                              {ord.upi_reference && (
                                <span className="font-mono text-[9px] text-[#F5D061] block">
                                  Ref: {ord.upi_reference}
                                </span>
                              )}
                            </>
                          ) : isPaid ? (
                            "✅ Paid in Cash"
                          ) : (
                            "💰 Cash on Delivery (COD)"
                          )}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* If Delivered & Paid -> Show View Receipt Button */}
                        {isDelivered && isPaid && (
                          <button
                            type="button"
                            onClick={() => setSelectedReceiptOrder(ord)}
                            className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View Receipt 🧾</span>
                          </button>
                        )}

                        {/* Cancel Button (Available before out_for_delivery) */}
                        {!isDelivered && ord.order_status !== "out_for_delivery" && ord.order_status !== "cancelled" && (
                          <button
                            type="button"
                            onClick={() => setSelectedCancelOrder(ord)}
                            className="py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold text-xs border border-rose-500/30 transition-all cursor-pointer"
                          >
                            <span>Cancel</span>
                          </button>
                        )}

                        {/* Track Live button */}
                        <Link
                          href={`/track/${ord.id}`}
                          className="py-2 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#F5D061] hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all"
                        >
                          <span>Track Live ⚡</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}
        </div>
      )}

      {/* Order Cancellation Modal */}
      {selectedCancelOrder && (
        <CancelOrderModal
          order={selectedCancelOrder}
          isOpen={Boolean(selectedCancelOrder)}
          onClose={() => setSelectedCancelOrder(null)}
          onCancelled={() => {
            fetchCustomerOrders();
          }}
          adminPhone={settings.whatsapp_number || settings.business_phone}
        />
      )}
      </main>

      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
}
