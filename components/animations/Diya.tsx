"use client";

import React from "react";

interface DiyaProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Diya({ size = "md", className = "" }: DiyaProps) {
  const sizeMap = {
    sm: { width: 36, height: 28 },
    md: { width: 52, height: 40 },
    lg: { width: 72, height: 56 },
    xl: { width: 100, height: 78 },
  };

  const { width, height } = sizeMap[size];

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      {/* Ambient Flame Glow */}
      <div
        className="absolute -top-3 w-8 h-8 rounded-full bg-amber-500/30 blur-md pointer-events-none animate-pulse-glow"
        style={{ width: width * 0.7, height: height * 0.7 }}
      />

      <svg
        width={width}
        height={height}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          {/* Flame Gradient */}
          <radialGradient id="flameGrad" cx="50%" cy="80%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="25%" stopColor="#FFF37A" />
            <stop offset="60%" stopColor="#FF9100" />
            <stop offset="100%" stopColor="#D50000" stopOpacity="0.8" />
          </radialGradient>

          {/* Clay Bowl Gradient */}
          <linearGradient id="clayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C85A17" />
            <stop offset="40%" stopColor="#9C3A08" />
            <stop offset="100%" stopColor="#5D1E04" />
          </linearGradient>

          {/* Golden Trim Gradient */}
          <linearGradient id="goldTrim" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D4AF37" />
            <stop offset="50%" stopColor="#FFF2A8" />
            <stop offset="100%" stopColor="#B8860B" />
          </linearGradient>
        </defs>

        {/* Flickering Flame */}
        <g className="animate-flame origin-bottom">
          <path
            d="M50 4 C44 18 36 28 36 38 C36 48 42 54 50 54 C58 54 64 48 64 38 C64 28 56 18 50 4 Z"
            fill="url(#flameGrad)"
          />
          {/* Inner bright core */}
          <path
            d="M50 16 C47 24 43 30 43 38 C43 44 46 48 50 48 C54 48 57 44 57 38 C57 30 53 24 50 16 Z"
            fill="#FFFDE7"
            opacity="0.85"
          />
        </g>

        {/* Earthen Clay Diya Base */}
        <path
          d="M10 48 Q50 78 90 48 Q82 66 50 72 Q18 66 10 48 Z"
          fill="url(#clayGrad)"
        />
        {/* Diya Rim */}
        <ellipse cx="50" cy="48" rx="40" ry="10" fill="#7A2805" />
        <ellipse cx="50" cy="47" rx="36" ry="8" fill="#501A03" />

        {/* Oil Pool with Golden Reflection */}
        <ellipse cx="50" cy="48" rx="30" ry="6" fill="#A8430B" opacity="0.8" />
        <ellipse cx="50" cy="48" rx="18" ry="4" fill="#FFA000" opacity="0.6" />

        {/* Golden Decorative Rim Border */}
        <path
          d="M12 48 Q50 62 88 48"
          stroke="url(#goldTrim)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="28" cy="54" r="2" fill="#F5D061" />
        <circle cx="50" cy="56" r="2.5" fill="#F5D061" />
        <circle cx="72" cy="54" r="2" fill="#F5D061" />
      </svg>
    </div>
  );
}
