"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MapPin,
  Navigation,
  ExternalLink,
  Check,
  Crosshair,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Hand,
} from "lucide-react";

interface MapLocationPickerProps {
  latitude?: number;
  longitude?: number;
  locality?: string;
  address?: string;
  onChange: (data: { latitude: number; longitude: number; map_url: string }) => void;
}

// Default base coordinates: Kothal Kalan, Mahendragarh, Haryana
const DEFAULT_LAT = 28.1907;
const DEFAULT_LNG = 76.1624;

export function MapLocationPicker({
  latitude,
  longitude,
  locality,
  address,
  onChange,
}: MapLocationPickerProps) {
  const [lat, setLat] = useState<number>(latitude || DEFAULT_LAT);
  const [lng, setLng] = useState<number>(longitude || DEFAULT_LNG);
  const [isLocating, setIsLocating] = useState(false);
  const [locSuccess, setLocSuccess] = useState(false);
  const [locError, setLocError] = useState("");
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync state if external coordinates change
  useEffect(() => {
    if (latitude && longitude && (latitude !== lat || longitude !== lng)) {
      setLat(latitude);
      setLng(longitude);
      if (markerRef.current && mapRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
        mapRef.current.setView([latitude, longitude], mapRef.current.getZoom());
      }
    }
  }, [latitude, longitude]);

  // Update coordinates and notify parent
  const updatePosition = useCallback((newLat: number, newLng: number, updateMap = true) => {
    const roundedLat = Number(newLat.toFixed(6));
    const roundedLng = Number(newLng.toFixed(6));
    setLat(roundedLat);
    setLng(roundedLng);

    if (updateMap && markerRef.current) {
      markerRef.current.setLatLng([roundedLat, roundedLng]);
    }

    onChangeRef.current({
      latitude: roundedLat,
      longitude: roundedLng,
      map_url: `https://www.google.com/maps?q=${roundedLat},${roundedLng}`,
    });
  }, []);

  // Initialize interactive Leaflet map
  useEffect(() => {
    let isCancelled = false;

    async function initializeLeaflet() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      if (mapRef.current) return; // already initialized

      try {
        const L = (await import("leaflet")).default;
        if (isCancelled || !mapContainerRef.current) return;

        // Custom Diya / Golden Pin DivIcon (pure vector & CSS, zero missing asset errors)
        const customIcon = L.divIcon({
          className: "mithaase-draggable-marker",
          html: `
            <div class="pin-anchor" style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); cursor: grab; user-select: none;">
              <!-- Floating helper pill -->
              <div style="background: #1A0324; color: #F5D061; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 999px; border: 1px solid #D4AF37; box-shadow: 0 4px 12px rgba(0,0,0,0.6); white-space: nowrap; margin-bottom: 3px; display: flex; align-items: center; gap: 3px;">
                <span>👆 Drag Me</span>
              </div>

              <!-- Pin Head -->
              <div style="width: 38px; height: 38px; border-radius: 50% 50% 50% 0; background: linear-gradient(135deg, #F5D061 0%, #D4AF37 55%, #881337 100%); transform: rotate(-45deg); box-shadow: 0 4px 16px rgba(212,175,55,0.7), 0 2px 6px rgba(0,0,0,0.4); border: 2.5px solid #FFF8EE; display: flex; align-items: center; justify-content: center;">
                <div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center;">
                  <span style="font-size: 16px; line-height: 1;">📍</span>
                </div>
              </div>

              <!-- Shadow at base -->
              <div style="width: 14px; height: 5px; background: rgba(0,0,0,0.35); border-radius: 50%; margin-top: 2px;"></div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        // Instantiate Leaflet Map
        const initialLat = latitude || DEFAULT_LAT;
        const initialLng = longitude || DEFAULT_LNG;

        const map = L.map(mapContainerRef.current, {
          center: [initialLat, initialLng],
          zoom: 16,
          zoomControl: true,
          scrollWheelZoom: "center",
        });

        // OpenStreetMap Layer
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        // Draggable Marker
        const marker = L.marker([initialLat, initialLng], {
          icon: customIcon,
          draggable: true,
          autoPan: true,
          autoPanPadding: [30, 30],
        }).addTo(map);

        // Bind tooltip
        marker.bindTooltip("Drag this pin directly to your doorstep", {
          direction: "top",
          offset: [0, -45],
          className: "bg-[#16031E] text-white text-xs border border-[#D4AF37] rounded-lg",
        });

        // 1. DRAG EVENTS
        marker.on("dragstart", () => {
          marker.closeTooltip();
        });

        marker.on("drag", () => {
          const pos = marker.getLatLng();
          setLat(Number(pos.lat.toFixed(6)));
          setLng(Number(pos.lng.toFixed(6)));
        });

        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          updatePosition(pos.lat, pos.lng, false);
        });

        // 2. TAP / CLICK ANYWHERE ON MAP TO RELOCATE PIN
        map.on("click", (e: any) => {
          const clickedLat = e.latlng.lat;
          const clickedLng = e.latlng.lng;
          marker.setLatLng([clickedLat, clickedLng]);
          updatePosition(clickedLat, clickedLng, false);
        });

        mapRef.current = map;
        markerRef.current = marker;
        setIsMapLoaded(true);

        // Invalidate size once rendered
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 200);
      } catch (err) {
        console.error("Leaflet initialization error:", err);
      }
    }

    initializeLeaflet();

    return () => {
      isCancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // 1-Click GPS Location Detection
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocError("Geolocation is not supported by your device browser.");
      return;
    }

    setIsLocating(true);
    setLocError("");
    setLocSuccess(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = Number(position.coords.latitude.toFixed(6));
        const userLng = Number(position.coords.longitude.toFixed(6));

        updatePosition(userLat, userLng, true);

        if (mapRef.current) {
          mapRef.current.flyTo([userLat, userLng], 17, {
            duration: 1.2,
          });
        }

        setIsLocating(false);
        setLocSuccess(true);
        setTimeout(() => setLocSuccess(false), 3500);
      },
      (error) => {
        setIsLocating(false);
        setLocError("Unable to fetch GPS. You can drag the golden pin or click anywhere on the map.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Re-center map to the current pin
  const handleCenterOnPin = () => {
    if (mapRef.current) {
      mapRef.current.flyTo([lat, lng], 17, { duration: 0.8 });
    }
  };

  // Directional Nudge (30-meter steps)
  const handleNudge = (deltaLat: number, deltaLng: number) => {
    const newLat = lat + deltaLat;
    const newLng = lng + deltaLng;
    updatePosition(newLat, newLng, true);
    if (mapRef.current) {
      mapRef.current.panTo([newLat, newLng], { animate: true });
    }
  };

  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-[#16031E] border border-[#D4AF37]/35 shadow-xl space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <label className="text-xs sm:text-sm font-serif font-bold text-white flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#F5D061]" />
            <span>Pin Delivery Doorstep on Map</span>
          </label>
          <p className="text-[11px] text-[#D3BEB0] mt-0.5">
            <strong className="text-amber-300">Drag the golden pin</strong> or <strong className="text-amber-300">tap anywhere on the map</strong> to mark your house.
          </p>
        </div>

        {/* GPS Button */}
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={isLocating}
          className="self-start sm:self-auto px-4 py-2 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F5D061] hover:brightness-110 text-[#16031E] text-xs font-black flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
        >
          <Navigation className={`w-3.5 h-3.5 ${isLocating ? "animate-spin" : ""}`} />
          <span>{isLocating ? "Fetching GPS..." : "Auto-Detect My GPS Pin"}</span>
        </button>
      </div>

      {locSuccess && (
        <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>Exact GPS coordinates captured! Pin moved directly to your location.</span>
        </div>
      )}

      {locError && (
        <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{locError}</span>
        </div>
      )}

      {/* Interactive Drag & Drop Map Container (Isolated Stacking Context) */}
      <div className="relative isolate z-0 w-full rounded-2xl overflow-hidden border-2 border-[#D4AF37]/50 shadow-2xl bg-[#1A0324]">
        {/* Helper Instructions Pill */}
        <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-full bg-[#16031E]/90 border border-[#D4AF37]/50 text-white text-[11px] font-semibold flex items-center gap-2 shadow-lg backdrop-blur-md pointer-events-none">
          <Hand className="w-3.5 h-3.5 text-[#F5D061] animate-bounce" />
          <span>Drag the pin or tap anywhere to place</span>
        </div>

        {/* Center on Pin Floating Button */}
        <button
          type="button"
          onClick={handleCenterOnPin}
          title="Center view on pin"
          className="absolute top-3 right-3 z-10 p-2 rounded-xl bg-[#16031E]/90 border border-white/20 text-[#F5D061] hover:text-white hover:bg-[#25052F] shadow-lg backdrop-blur-md transition-all active:scale-95"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Leaflet Map Div */}
        <div
          ref={mapContainerRef}
          className="w-full h-72 sm:h-80 bg-[#1A0324] cursor-crosshair relative z-0"
          style={{ minHeight: "288px" }}
        />

        {/* Bottom Coordinates & Preview Bar */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#16031E]/95 border border-[#D4AF37]/40 backdrop-blur-md text-[11px]">
          <div className="flex items-center gap-2 text-white/90 font-mono font-bold">
            <Crosshair className="w-3.5 h-3.5 text-[#F5D061]" />
            <span>
              {lat.toFixed(5)}° N, {lng.toFixed(5)}° E
            </span>
          </div>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#F5D061] hover:text-white hover:underline flex items-center gap-1 font-bold text-xs transition-colors"
          >
            <span>Open in Google Maps</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Directional Micro-Adjusters */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-white/70">
        <span className="flex items-center gap-1.5 text-[11px]">
          <HelpCircle className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>Fine-tune doorstep position:</span>
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleNudge(0.0003, 0)}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono font-bold text-xs active:scale-95 transition-all"
            title="Nudge North"
          >
            ↑ N
          </button>
          <button
            type="button"
            onClick={() => handleNudge(-0.0003, 0)}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono font-bold text-xs active:scale-95 transition-all"
            title="Nudge South"
          >
            ↓ S
          </button>
          <button
            type="button"
            onClick={() => handleNudge(0, -0.0003)}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono font-bold text-xs active:scale-95 transition-all"
            title="Nudge West"
          >
            ← W
          </button>
          <button
            type="button"
            onClick={() => handleNudge(0, 0.0003)}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono font-bold text-xs active:scale-95 transition-all"
            title="Nudge East"
          >
            → E
          </button>
        </div>
      </div>
    </div>
  );
}
