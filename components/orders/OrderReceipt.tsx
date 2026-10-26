"use client";

import React, { useRef } from "react";
import { Order, StoreSettings } from "@/types";
import { Diya } from "@/components/animations/Diya";
import {
  ShieldCheck,
  Calendar,
  RotateCcw,
  AlertCircle,
} from "lucide-react";

interface OrderReceiptProps {
  order: Order;
  settings: StoreSettings;
}

export function OrderReceipt({ order, settings }: OrderReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const receiptNumber = `REC-${order.order_number.replace(/[^0-9]/g, "") || order.id.slice(-6)}`;
  const orderDate = new Date(order.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-4 print:p-0 print:m-0 print:w-full">
      {/* Official Tax & Delivery Receipt Invoice Card */}
      <div
        ref={receiptRef}
        id="official-order-receipt"
        className="p-3 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl bg-[#FAF6EE] text-[#1D0823] border border-[#D4AF37]/50 sm:border-2 sm:border-[#D4AF37] shadow-xl relative overflow-hidden max-w-full print:border-none print:shadow-none print:p-2"
      >
        {/* Festive Golden Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 sm:h-2 bg-gradient-to-r from-[#D4AF37] via-[#F5D061] to-[#D4AF37]" />

        {/* Receipt Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-[#1D0823]/15 pt-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#3B0820] border-2 border-[#D4AF37] flex items-center justify-center shrink-0 shadow-md">
              <Diya size="sm" />
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-serif font-black tracking-wider text-[#3B0820] block leading-none">
                Mithaasé
              </span>
              <span className="text-[11px] sm:text-xs uppercase tracking-widest text-[#B45309] font-black">
                {settings.store_name}
              </span>
              <p className="text-[10px] sm:text-[11px] text-[#4A1525] mt-1 max-w-xs leading-tight">
                Shop No. 12, Main Chowk, Kothal Kalan, Mahendragarh, Haryana 123029
              </p>
              <p className="text-[10px] text-[#78350F] font-mono mt-0.5">
                Helpline: {settings.business_phone}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right space-y-1 bg-black/5 sm:bg-transparent p-2.5 sm:p-0 rounded-xl">
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mb-0.5 ${
              order.order_status === "cancelled"
                ? "bg-rose-950 text-rose-200 border border-rose-500/40"
                : "bg-[#1D0823] text-[#F5D061]"
            }`}>
              {order.order_status === "cancelled" ? "Cancelled Order Bill / Refund Memo" : "Delivery Receipt / Bill"}
            </span>
            <div className="text-xs">
              <span className="text-black/60 inline sm:block font-mono text-[11px] mr-1">Receipt No: </span>
              <strong className="text-xs sm:text-sm font-mono font-black text-[#1D0823]">{receiptNumber}</strong>
            </div>
            <div className="text-[11px] text-black/70">
              <span>Order Ref: </span>
              <span className="font-mono font-bold text-[#3B0820]">{order.order_number}</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-black/70 flex items-center sm:justify-end gap-1">
              <Calendar className="w-3 h-3 text-[#B45309]" />
              <span>{orderDate}</span>
            </div>
          </div>
        </div>

        {/* Customer & Delivery Coordinates Block */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 py-4 sm:py-5 border-b border-[#1D0823]/10 text-xs">
          <div className="space-y-1 bg-black/5 sm:bg-transparent p-2.5 sm:p-0 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-black/50 block">Delivered To</span>
            <strong className="text-xs sm:text-sm text-[#1D0823] block">{order.customer_name}</strong>
            <span className="text-black/70 font-mono block">+91 {order.customer_phone}</span>
            {order.customer_email && (
              <span className="text-black/60 text-[11px] block">{order.customer_email}</span>
            )}
          </div>

          <div className="space-y-1 sm:text-right bg-black/5 sm:bg-transparent p-2.5 sm:p-0 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-black/50 block">
              Doorstep Delivery Location
            </span>
            <p className="text-[#1D0823] font-medium leading-snug">
              {order.delivery_address}
            </p>
            <span className="text-[#B45309] font-bold text-[11px] block">
              {order.locality} {order.landmark ? `• Landmark: ${order.landmark}` : ""}
            </span>
            {order.latitude && order.longitude && (
              <span className="text-[10px] text-black/60 font-mono block">
                GPS Pin: {order.latitude.toFixed(4)}° N, {order.longitude.toFixed(4)}° E (Kothal Kalan)
              </span>
            )}
          </div>
        </div>

        {/* Itemized Sweets: Mobile Card View (< sm) */}
        <div className="py-3 space-y-2 sm:hidden">
          <span className="text-[10px] uppercase font-bold text-black/50 block">
            Purchased Sweets ({order.items.length})
          </span>
          {order.items.map((item, idx) => (
            <div
              key={item.id}
              className="p-2.5 rounded-xl bg-black/5 border border-black/10 flex items-start justify-between gap-2 text-xs"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-black/40">#{idx + 1}</span>
                  <strong className="text-[#1D0823] font-bold text-xs">
                    {item.product_name_snapshot}
                  </strong>
                </div>
                <div className="text-[11px] text-black/70 pl-3">
                  <span>{item.variant_name_snapshot}</span>
                  <span className="mx-1">•</span>
                  <span className="font-mono font-bold text-[#3B0820]">Qty: {item.quantity}</span>
                </div>
                <span className="text-[10px] text-black/50 pl-3 block font-mono">
                  @ ₹{item.unit_price} / unit
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono font-black text-sm text-[#1D0823]">
                  ₹{item.line_total}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Itemized Sweets Table with Explicit Per Item Price and Quantity (sm and up) */}
        <div className="hidden sm:block py-5 overflow-x-auto max-w-full">
          <table className="w-full min-w-[500px] text-xs">
            <thead>
              <tr className="border-b-2 border-[#1D0823]/20 text-[11px] uppercase tracking-wider text-[#3B0820] font-black">
                <th className="py-2.5 text-left">#</th>
                <th className="py-2.5 text-left">Sweet Description</th>
                <th className="py-2.5 text-center">Portion / Pack</th>
                <th className="py-2.5 text-center bg-black/5 px-3">Quantity (Qty)</th>
                <th className="py-2.5 text-right px-2">Per Item Price</th>
                <th className="py-2.5 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {order.items.map((item, idx) => (
                <tr key={item.id} className="py-2.5">
                  <td className="py-2.5 text-black/50 font-mono">{idx + 1}</td>
                  <td className="py-2.5">
                    <strong className="text-[#1D0823] block text-xs sm:text-sm">
                      {item.product_name_snapshot}
                    </strong>
                    <span className="text-[10px] text-black/60">Prepared in 100% Pure Desi Ghee</span>
                  </td>
                  <td className="py-2.5 text-center text-black/70 font-medium">
                    {item.variant_name_snapshot}
                  </td>
                  <td className="py-2.5 text-center bg-black/5">
                    <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-black/10 font-mono font-black text-xs sm:text-sm text-[#1D0823]">
                      Qty: {item.quantity}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-mono px-2">
                    <strong className="text-black font-bold text-xs sm:text-sm">₹{item.unit_price}</strong>
                    <span className="text-[10px] text-black/50 block">/ unit</span>
                  </td>
                  <td className="py-2.5 text-right font-mono font-black text-xs sm:text-sm text-[#1D0823]">
                    ₹{item.line_total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Receipt Totals & Status Stamp */}
        <div className="pt-4 border-t-2 border-[#1D0823]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          {/* Official Verification Stamp */}
          {order.order_status === "cancelled" ? (
            <div className={`p-3.5 rounded-2xl border-2 max-w-sm flex items-start gap-3 ${
              order.refund_status === "refunded"
                ? "border-emerald-600/70 bg-emerald-50/80"
                : "border-rose-600/70 bg-rose-50/80"
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-md text-white ${
                order.refund_status === "refunded" ? "bg-emerald-600" : "bg-rose-600"
              }`}>
                {order.refund_status === "refunded" ? (
                  <RotateCcw className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <span className={`text-xs uppercase font-black tracking-wider block ${
                  order.refund_status === "refunded" ? "text-emerald-800" : "text-rose-800"
                }`}>
                  {order.refund_status === "refunded"
                    ? "ORDER CANCELLED & 100% REFUNDED"
                    : order.payment_method === "upi" || order.payment_status === "paid"
                    ? "CANCELLED • UPI REFUND IN PROCESS"
                    : "ORDER CANCELLED"}
                </span>
                {order.cancellation_reason && (
                  <span className="text-[11px] text-black/80 font-medium block mt-0.5">
                    Reason: {order.cancellation_reason}
                  </span>
                )}
                {order.refund_status === "refunded" && order.refund_txn_id && (
                  <span className="text-[10px] text-emerald-950 font-mono font-bold block mt-0.5">
                    Refund UTR / Txn: {order.refund_txn_id}
                  </span>
                )}
                <span className="text-[10px] text-black/50 block mt-0.5">
                  Verified by Shree Shyam Sweets Management
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl border-2 border-emerald-600/70 bg-emerald-50/80 max-w-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs uppercase font-black text-emerald-800 tracking-wider block">
                  {order.order_status === "delivered" ? "DELIVERED & PAID IN FULL" : "OFFICIAL ORDER INVOICE"}
                </span>
                <span className="text-[11px] text-emerald-900 font-medium block">
                  Payment Method: {order.payment_method.toUpperCase()}
                  {order.payment_method === "upi" && order.upi_reference ? ` • Ref: ${order.upi_reference}` : ""}
                </span>
                <span className="text-[10px] text-emerald-700 block">
                  Verified by Shree Shyam Sweets Delivery Fleet
                </span>
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="w-full sm:w-64 space-y-2 text-xs">
            <div className="flex justify-between text-black/70">
              <span>Sweets Subtotal</span>
              <span className="font-mono font-bold text-black">₹{order.subtotal}</span>
            </div>

            <div className="flex justify-between text-black/70">
              <span>Doorstep Delivery</span>
              {order.delivery_charge === 0 ? (
                <span className="font-bold text-emerald-700 font-mono">
                  FREE {order.coupon_code?.toUpperCase() === "FREEDEL" ? "(FREEDEL) " : ""}<span className="line-through text-black/40 text-[10px]">₹21</span>
                </span>
              ) : (
                <span className="font-mono font-bold text-black">₹{order.delivery_charge}</span>
              )}
            </div>

            {/* Coupon Discount if applied on sweets */}
            {order.discount_amount && order.discount_amount > 0 && order.coupon_code?.toUpperCase() !== "FREEDEL" ? (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Coupon ({order.coupon_code || "OFFER"})</span>
                <span className="font-mono font-bold">-₹{order.discount_amount}</span>
              </div>
            ) : null}

            <div className="pt-2 border-t border-black/15 flex justify-between text-base font-black text-[#3B0820]">
              <span>
                {order.order_status === "cancelled"
                  ? order.refund_status === "refunded"
                    ? "Amount 100% Refunded"
                    : "Amount (Cancelled)"
                  : order.payment_method === "cod"
                  ? order.payment_status === "paid"
                    ? "Paid (COD)"
                    : "Total Payable (COD)"
                  : "Total Paid"}
              </span>
              <span className={`font-mono text-xl ${order.order_status === "cancelled" && order.refund_status === "refunded" ? "text-emerald-700" : order.order_status === "cancelled" ? "text-rose-700" : "text-[#B45309]"}`}>
                ₹{order.total_amount > 0 ? order.total_amount : order.subtotal}
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Refund Proof Screenshot if Available */}
        {order.refund_screenshot && (
          <div className="mt-6 p-4 rounded-2xl bg-emerald-50/90 border-2 border-emerald-500/40 flex flex-col sm:flex-row items-center gap-4 shadow-sm">
            <a
              href={order.refund_screenshot}
              target="_blank"
              rel="noopener noreferrer"
              className="relative group shrink-0"
              title="Click to view full refund proof"
            >
              <img
                src={order.refund_screenshot}
                alt="Bank Refund Proof Screenshot"
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover border-2 border-emerald-500 shadow-md group-hover:scale-105 transition-transform"
              />
              <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                Full View
              </span>
            </a>
            <div className="text-left space-y-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider">
                ✓ Bank Refund Screenshot Attached
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-emerald-950">
                Official UPI / Bank Transfer Refund Confirmation
              </h4>
              <p className="text-[11px] text-emerald-800 leading-snug">
                ₹{order.refund_amount || order.total_amount} transferred back to customer UPI account.
              </p>
              {order.refund_txn_id && (
                <div className="pt-1 text-[11px] font-mono text-emerald-900 space-y-0.5 border-t border-emerald-500/20 mt-1">
                  <span className="block font-bold">UTR / Ref No: {order.refund_txn_id}</span>
                  {order.refunded_at && (
                    <span className="block text-[10px]">
                      Date: {new Date(order.refunded_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Real-time Doorstep Delivery Proof Photo */}
        {order.delivery_proof_photo && (
          <div className="mt-6 p-4 rounded-2xl bg-emerald-50/90 border-2 border-emerald-500/40 flex flex-col sm:flex-row items-center gap-4 shadow-sm">
            <a
              href={order.delivery_proof_photo}
              target="_blank"
              rel="noopener noreferrer"
              className="relative group shrink-0"
              title="Click to view full photo"
            >
              <img
                src={order.delivery_proof_photo}
                alt="Doorstep Delivery Proof Snapshot"
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover border-2 border-emerald-500 shadow-md group-hover:scale-105 transition-transform"
              />
              <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                Full View
              </span>
            </a>
            <div className="text-left space-y-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider">
                ✓ Doorstep Proof Verified
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-emerald-950">
                Real-Time Delivery Snapshot at Customer Doorstep
              </h4>
              <p className="text-[11px] text-emerald-800 leading-snug">
                Captured in real-time by the delivery partner upon handing over the order. Verifies authentic delivery of freshly packed sweets at your doorstep.
              </p>
              {(order.delivered_at || order.delivered_location_name || (order.delivered_lat && order.delivered_lng)) && (
                <div className="pt-1 text-[11px] font-mono text-emerald-900 space-y-0.5 border-t border-emerald-500/20 mt-1">
                  {order.delivered_at && (
                    <span className="block">
                      ⏰ Time: {new Date(order.delivered_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  )}
                  {order.delivered_location_name && (
                    <span className="block">📍 Location: {order.delivered_location_name}</span>
                  )}
                  {order.delivered_lat && order.delivered_lng && (
                    <span className="block text-[10px] text-emerald-700">
                      GPS: {order.delivered_lat.toFixed(5)}° N, {order.delivered_lng.toFixed(5)}° E
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Festive Footer Message */}
        <div className="mt-8 pt-4 border-t border-black/10 text-center text-[11px] text-black/60">
          <p className="font-serif font-bold text-[#3B0820]">
            🪔 Shubh Deepawali from Shree Shyam Sweets, Kothal Kalan! 🪔
          </p>
          <p className="text-[10px] text-black/50 mt-0.5">
            Crafted with traditional recipes, pure desi ghee, and festive warmth. Keep this receipt for your records.
          </p>
        </div>
      </div>
    </div>
  );
}
