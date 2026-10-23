"use client";

import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Rider } from "@/types";
import {
  Bike,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  KeyRound,
  Shield,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Edit2,
  X,
  Sparkles,
} from "lucide-react";

export default function AdminRidersPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRider, setEditingRider] = useState<Rider | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    pin: "",
    vehicle_type: "Motorcycle",
    vehicle_number: "",
    assigned_area: "Khatushyamji & Ringas",
    is_active: true,
  });

  const loadRiders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/riders");
      if (res.ok) {
        const data = await res.json();
        setRiders(data);
      }
    } catch (err) {
      console.error("Failed to load riders:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRiders();
  }, []);

  const handleOpenAdd = () => {
    setEditingRider(null);
    setFormData({
      name: "",
      phone: "",
      email: "",
      pin: "",
      vehicle_type: "Motorcycle",
      vehicle_number: "",
      assigned_area: "Khatushyamji & Ringas",
      is_active: true,
    });
    setFeedback(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (rider: Rider) => {
    setEditingRider(rider);
    setFormData({
      name: rider.name,
      phone: rider.phone,
      email: rider.email || "",
      pin: rider.pin,
      vehicle_type: rider.vehicle_type || "Motorcycle",
      vehicle_number: rider.vehicle_number || "",
      assigned_area: rider.assigned_area || "",
      is_active: rider.is_active,
    });
    setFeedback(null);
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const cleanPhone = formData.phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setFeedback({ type: "error", message: "Rider mobile number must be exactly 10 digits." });
      return;
    }

    const cleanPin = formData.pin.replace(/\D/g, "");
    if (cleanPin.length !== 6) {
      setFeedback({ type: "error", message: "Rider security PIN must be exactly 6 digits." });
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingRider) {
        // Edit existing rider
        const res = await fetch(`/api/admin/riders/${editingRider.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update rider");
        setFeedback({ type: "success", message: "Rider updated successfully!" });
      } else {
        // Create new rider
        const res = await fetch("/api/admin/riders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to register rider");
        setFeedback({ type: "success", message: "New rider registered to fleet!" });
      }

      await loadRiders();
      setTimeout(() => {
        setShowAddModal(false);
        setFeedback(null);
      }, 1000);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "An error occurred" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (rider: Rider) => {
    try {
      const res = await fetch(`/api/admin/riders/${rider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !rider.is_active }),
      });
      if (res.ok) {
        loadRiders();
      }
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  const handleDeleteRider = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove rider "${name}" from the fleet?`)) return;

    try {
      const res = await fetch(`/api/admin/riders/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadRiders();
      }
    } catch (err) {
      console.error("Failed to delete rider:", err);
    }
  };

  const filteredRiders = riders.filter((r) => {
    const q = searchTerm.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.phone.toLowerCase().includes(q) ||
      (r.email && r.email.toLowerCase().includes(q)) ||
      (r.assigned_area && r.assigned_area.toLowerCase().includes(q))
    );
  });

  const activeCount = riders.filter((r) => r.is_active).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#F5D061]">
                Fleet Logistics
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
              <span className="text-[11px] text-white/50">Doorstep Delivery</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-white mt-1">
              Delivery Fleet <span className="gold-gradient-text">& Riders</span>
            </h1>
            <p className="text-xs text-[#D3BEB0] mt-1">
              Create, manage, and assign secret delivery PINs to your official delivery personnel.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadRiders}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 transition-colors"
              title="Refresh Rider List"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#F5D061]" : ""}`} />
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-4 py-2.5 rounded-xl gold-gradient-btn font-bold text-xs shadow-lg active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Rider</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-2xl bg-[#1C0324] border border-[#D4AF37]/25 shadow-md">
            <div className="flex items-center justify-between text-xs text-white/60 mb-1">
              <span>Total Fleet Riders</span>
              <Bike className="w-4 h-4 text-[#F5D061]" />
            </div>
            <div className="text-2xl font-serif font-black text-white">{riders.length}</div>
            <span className="text-[10px] text-white/40">Registered delivery staff</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#1C0324] border border-emerald-500/25 shadow-md">
            <div className="flex items-center justify-between text-xs text-emerald-400 mb-1">
              <span>Active on Duty</span>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-serif font-black text-emerald-300">{activeCount}</div>
            <span className="text-[10px] text-emerald-400/60">Can log in and deliver orders</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#1C0324] border border-white/10 shadow-md">
            <div className="flex items-center justify-between text-xs text-white/60 mb-1">
              <span>Inactive / Offline</span>
              <XCircle className="w-4 h-4 text-white/40" />
            </div>
            <div className="text-2xl font-serif font-black text-white/70">
              {riders.length - activeCount}
            </div>
            <span className="text-[10px] text-white/40">Access temporarily paused</span>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search riders by name, phone, email or locality area..."
            className="w-full bg-[#1C0324] border border-white/10 focus:border-[#D4AF37] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/40 outline-none transition-colors"
          />
        </div>

        {/* Riders Fleet List */}
        <div className="rounded-2xl bg-[#1C0324] border border-[#D4AF37]/30 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Bike className="w-4 h-4 text-[#F5D061]" />
              <span>Fleet Roster ({filteredRiders.length})</span>
            </h2>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-white/50 text-xs">
              <RefreshCw className="w-6 h-6 text-[#F5D061] animate-spin mx-auto mb-2" />
              Loading rider fleet from database...
            </div>
          ) : filteredRiders.length === 0 ? (
            <div className="p-12 text-center text-white/60 text-xs space-y-3">
              <Bike className="w-10 h-10 text-white/20 mx-auto" />
              <p className="font-semibold text-white">No riders registered yet.</p>
              <p className="text-white/40 max-w-sm mx-auto text-[11px]">
                Add your delivery riders here. They will use their phone number and secret PIN to log in to the Rider Portal.
              </p>
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 rounded-xl gold-gradient-btn text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register First Rider</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredRiders.map((rider) => (
                <div
                  key={rider.id}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Rider Info */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#580E1E] to-[#2B0938] border border-[#D4AF37]/40 flex items-center justify-center text-[#F5D061] font-serif font-black text-sm shrink-0">
                      {rider.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">{rider.name}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                            rider.is_active
                              ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30"
                              : "bg-red-950/80 text-red-300 border border-red-500/30"
                          }`}
                        >
                          {rider.is_active ? "Active on Duty" : "Inactive / Paused"}
                        </span>
                        <span className="text-[10px] text-[#D4AF37] px-2 py-0.5 rounded-full bg-[#D4AF37]/10 font-mono">
                          PIN: {rider.pin}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-white/60 flex-wrap pt-0.5">
                        <span className="flex items-center gap-1 text-white/80">
                          <Phone className="w-3.5 h-3.5 text-[#F5D061]" />
                          <span>{rider.phone}</span>
                        </span>

                        {rider.email && (
                          <span className="flex items-center gap-1 text-white/80">
                            <Mail className="w-3.5 h-3.5 text-white/40" />
                            <span>{rider.email}</span>
                          </span>
                        )}

                        <span className="flex items-center gap-1 text-white/70">
                          <Bike className="w-3.5 h-3.5 text-white/40" />
                          <span>
                            {rider.vehicle_type} {rider.vehicle_number ? `(${rider.vehicle_number})` : ""}
                          </span>
                        </span>

                        {rider.assigned_area && (
                          <span className="flex items-center gap-1 text-white/70">
                            <MapPin className="w-3.5 h-3.5 text-white/40" />
                            <span>{rider.assigned_area}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                    <button
                      onClick={() => handleToggleActive(rider)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        rider.is_active
                          ? "bg-amber-950/40 text-amber-300 border-amber-500/30 hover:bg-amber-950/70"
                          : "bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-950/70"
                      }`}
                      title={rider.is_active ? "Mark Inactive / Off Duty" : "Activate Rider"}
                    >
                      {rider.is_active ? "Set Inactive" : "Set Active"}
                    </button>

                    <button
                      onClick={() => handleOpenEdit(rider)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[#F5D061] border border-white/10 transition-colors"
                      title="Edit Rider Details or PIN"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteRider(rider.id, rider.name)}
                      className="p-2 rounded-lg bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 border border-rose-500/20 transition-colors"
                      title="Remove Rider from Fleet"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal: Register / Edit Rider */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg rounded-3xl bg-[#1C0324] border-2 border-[#D4AF37]/50 p-6 sm:p-7 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setShowAddModal(false)}
                className="absolute top-5 right-5 p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#400B16] border border-[#D4AF37] flex items-center justify-center text-[#F5D061]">
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-black text-white">
                    {editingRider ? "Edit Delivery Rider" : "Register New Delivery Rider"}
                  </h3>
                  <p className="text-xs text-white/60">
                    {editingRider
                      ? "Update vehicle, locality, or change the secret login PIN."
                      : "Create a rider account for your delivery shift personnel."}
                  </p>
                </div>
              </div>

              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    feedback.type === "success"
                      ? "bg-emerald-950/80 border border-emerald-500/40 text-emerald-200"
                      : "bg-red-950/80 border border-red-500/40 text-red-200"
                  }`}
                >
                  {feedback.type === "success" ? (
                    <CheckCircle className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                {/* Rider Name */}
                <div>
                  <label className="block text-white/80 font-bold mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-white outline-none"
                  />
                </div>

                {/* Phone & Secret PIN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-white/80 font-bold mb-1">
                      Mobile Number (10 Digits) *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                        })
                      }
                      placeholder="e.g. 9876543210"
                      className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-white font-mono outline-none"
                    />
                    <span className="text-[10px] text-white/40 block mt-0.5">
                      Must be exactly 10 digits
                    </span>
                  </div>

                  <div>
                    <label className="block text-white/80 font-bold mb-1">
                      Rider Security PIN (6 Digits) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={formData.pin}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pin: e.target.value.replace(/\D/g, "").slice(0, 6),
                        })
                      }
                      placeholder="e.g. 123456"
                      className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-white font-mono tracking-widest outline-none"
                    />
                    <span className="text-[10px] text-white/40 block mt-0.5">
                      Must be exactly 6 digits
                    </span>
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-white/80 font-bold mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. rahul.rider@gmail.com"
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-white outline-none"
                  />
                </div>

                {/* Vehicle Type & Plate Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-white/80 font-bold mb-1">
                      Vehicle Type
                    </label>
                    <select
                      value={formData.vehicle_type}
                      onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                      className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3 py-2.5 text-white outline-none"
                    >
                      <option value="Motorcycle">Motorcycle</option>
                      <option value="Scooter">Scooter / Activa</option>
                      <option value="Electric Bike">Electric Bike (EV)</option>
                      <option value="Bicycle">Bicycle</option>
                      <option value="Van">Delivery Van</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-white/80 font-bold mb-1">
                      Vehicle Plate Number
                    </label>
                    <input
                      type="text"
                      value={formData.vehicle_number}
                      onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                      placeholder="e.g. RJ 14 AB 1234"
                      className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-white outline-none"
                    />
                  </div>
                </div>

                {/* Assigned Area */}
                <div>
                  <label className="block text-white/80 font-bold mb-1">
                    Assigned Locality / Area
                  </label>
                  <input
                    type="text"
                    value={formData.assigned_area}
                    onChange={(e) => setFormData({ ...formData, assigned_area: e.target.value })}
                    placeholder="e.g. Ringas & Khatushyamji Temple Sector"
                    className="w-full bg-[#16031E] border border-white/15 focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-white outline-none"
                  />
                </div>

                {/* Active Switch */}
                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="checkbox"
                    id="rider_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 accent-[#D4AF37] rounded"
                  />
                  <label htmlFor="rider_active" className="text-white text-xs font-semibold cursor-pointer">
                    Rider is active and eligible to accept deliveries
                  </label>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-xs transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl gold-gradient-btn font-bold text-xs shadow-lg active:scale-95 flex items-center gap-1.5"
                  >
                    <span>
                      {isSubmitting
                        ? "Saving..."
                        : editingRider
                        ? "Update Rider"
                        : "Register Rider"}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
