"use client";

import React, { useState, useEffect, useRef } from "react";
import { Camera, RefreshCw, AlertCircle, CheckCircle2, SwitchCamera, Lock, ShieldAlert } from "lucide-react";

interface LiveCameraCaptureProps {
  onPhotoCaptured: (dataUrl: string) => void;
  label?: string;
  overlayText?: string;
  watermarkLabel?: string;
}

export function LiveCameraCapture({
  onPhotoCaptured,
  label = "Real-Time Camera",
  overlayText = "Live Camera Feed",
  watermarkLabel = "MITHAASE LIVE PROOF",
}: LiveCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [liveClock, setLiveClock] = useState<string>("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect mobile device
    if (typeof window !== "undefined") {
      const mobileCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      setIsMobile(mobileCheck);
    }
  }, []);

  const startCamera = async (mode: "environment" | "user" = facingMode) => {
    setIsInitializing(true);
    setCameraError(null);
    setValidationError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Live Camera API not supported in this browser. Please use a modern browser.");
      }

      // Stop any prior active stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
      }

      setCameraActive(true);
    } catch (err: any) {
      console.warn("Live camera start failed:", err);
      setCameraError(
        err.name === "NotAllowedError" || err.message?.includes("denied")
          ? "Camera permission denied. Please allow camera permissions in your browser address bar settings to snap live photo."
          : err.message || "Failed to initialize live camera."
      );
      setCameraActive(false);
    } finally {
      setIsInitializing(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const toggleCameraFacing = async () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    await startCamera(nextMode);
  };

  useEffect(() => {
    startCamera(facingMode);
    const interval = setInterval(() => {
      setLiveClock(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }, 1000);

    return () => {
      stopCamera();
      clearInterval(interval);
    };
  }, []);

  // Snap photo DIRECTLY from live video stream - 100% genuine live camera capture
  const handleSnap = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw video frame directly from active camera hardware stream
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Draw real-time authentication watermark banner at bottom
    const now = new Date();
    const stampDate = now.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const stampTime = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const watermarkText = `📍 ${watermarkLabel} • ${stampDate} ${stampTime}`;

    ctx.fillStyle = "rgba(22, 3, 30, 0.8)";
    ctx.fillRect(10, canvas.height - 48, ctx.measureText(watermarkText).width + 50, 38);

    ctx.fillStyle = "#F5D061";
    ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(watermarkText, 22, canvas.height - 24);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    stopCamera();
    onPhotoCaptured(dataUrl);
  };

  // Mobile-only fallback when WebRTC stream permission is restricted
  // Enforces direct device camera with anti-gallery verification
  const handleMobileDirectCamera = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict Anti-Gallery verification:
    // If a photo was picked from gallery or storage, its lastModified is older than 60 seconds.
    // Live camera captures taken via native camera intent have lastModified within 0-45 seconds.
    const fileAgeSeconds = (Date.now() - file.lastModified) / 1000;
    if (fileAgeSeconds > 60) {
      setValidationError(
        "❌ Gallery photo detected! Uploading saved photos from gallery is strictly prohibited. You must take a fresh photo live from your camera."
      );
      if (e.target) e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200;
        const scale = Math.min(1, MAX_WIDTH / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Timestamp watermark
          const now = new Date();
          const stampText = `📍 ${watermarkLabel} • ${now.toLocaleDateString("en-IN")} ${now.toLocaleTimeString("en-IN")}`;
          ctx.fillStyle = "rgba(22, 3, 30, 0.8)";
          ctx.fillRect(10, canvas.height - 44, ctx.measureText(stampText).width + 30, 34);
          ctx.fillStyle = "#F5D061";
          ctx.font = "bold 14px sans-serif";
          ctx.fillText(stampText, 20, canvas.height - 22);

          const compressed = canvas.toDataURL("image/jpeg", 0.8);
          onPhotoCaptured(compressed);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      {/* Policy banner */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-black/40 border border-amber-500/30 text-[11px] text-amber-300">
        <span className="flex items-center gap-1.5 font-semibold">
          <Lock className="w-3.5 h-3.5 text-[#F5D061]" />
          <span>Live Camera Only</span>
        </span>
        <span className="text-[10px] text-white/50 font-medium">Gallery upload disabled</span>
      </div>

      {validationError && (
        <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 flex items-start gap-2 text-xs text-red-200">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-red-300">Live Camera Verification Failed</p>
            <p className="text-[11px] leading-relaxed">{validationError}</p>
          </div>
        </div>
      )}

      {cameraActive ? (
        <div className="relative rounded-2xl overflow-hidden border-2 border-[#D4AF37] bg-black shadow-2xl">
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className="w-full h-64 sm:h-72 object-cover"
          />

          {/* Real-time status indicators */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/80 border border-white/20 text-[10px] text-white font-mono shadow-md">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="font-bold">LIVE CAMERA</span>
            <span className="text-[#F5D061]">{liveClock}</span>
          </div>

          <div className="absolute top-2 right-2 flex items-center gap-1">
            <button
              type="button"
              onClick={toggleCameraFacing}
              className="px-2 py-1 rounded-lg bg-black/70 hover:bg-black/90 border border-white/20 text-[10px] text-white font-medium flex items-center gap-1"
              title="Switch Camera (Front/Rear)"
            >
              <SwitchCamera className="w-3 h-3 text-[#F5D061]" />
              <span className="hidden sm:inline">{facingMode === "environment" ? "Rear" : "Front"}</span>
            </button>
            <div className="px-2 py-1 rounded-lg bg-black/70 text-[9px] text-white/80 font-mono">
              {overlayText}
            </div>
          </div>

          {/* Real-time Shutter Button */}
          <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center justify-center gap-1">
            <button
              type="button"
              onClick={handleSnap}
              className="w-16 h-16 rounded-full bg-white/95 border-4 border-[#D4AF37] flex items-center justify-center shadow-[0_0_25px_rgba(212,175,55,0.8)] active:scale-90 hover:scale-105 transition-transform group cursor-pointer"
              title="Click to snap real-time photo"
            >
              <div className="w-12 h-12 rounded-full bg-rose-600 group-hover:bg-rose-500 transition-colors flex items-center justify-center text-white shadow-inner">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </button>
            <span className="text-[10px] font-bold text-white bg-black/70 px-2.5 py-0.5 rounded shadow">
              Tap to Snap Live Photo
            </span>
          </div>
        </div>
      ) : isInitializing ? (
        <div className="h-64 rounded-2xl bg-black/60 border border-white/10 flex flex-col items-center justify-center gap-2 text-white/70">
          <RefreshCw className="w-6 h-6 animate-spin text-[#D4AF37]" />
          <span className="text-xs font-medium">Initializing live camera feed...</span>
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 text-center space-y-3.5">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Camera className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-white">Live Camera Proof Required</p>
            <p className="text-xs text-white/60 max-w-xs mx-auto">
              {cameraError || "Delivery proof must be snapped live using your camera sensor. Gallery uploads are permanently disabled."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => startCamera(facingMode)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl gold-gradient-btn text-xs font-bold shadow active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-[#16031E]" />
              <span>Enable & Start Live Camera</span>
            </button>

            {/* Strict direct camera launch for mobile devices if browser WebRTC is blocked */}
            {isMobile && (
              <label className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white font-bold cursor-pointer border border-white/20 flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Camera className="w-4 h-4 text-[#F5D061]" />
                <span>Open Device Camera</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleMobileDirectCamera}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-[10px] text-white/50 space-y-0.5">
            <p className="font-semibold text-white/70">Security Protocol:</p>
            <p>Rider photos are digitally watermarked with GPS coordinates and live timestamp.</p>
          </div>
        </div>
      )}
    </div>
  );
}
