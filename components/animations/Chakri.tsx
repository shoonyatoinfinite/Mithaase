"use client";

import React from "react";

interface ChakriProps {
  size?: number;
  speed?: "fast" | "slow";
  className?: string;
}

export function Chakri({ size = 120, speed = "fast", className = "" }: ChakriProps) {
  const animClass = speed === "fast" ? "animate-chakri-fast" : "animate-chakri-slow";

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer Golden Spark Halo */}
      <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl animate-pulse" />

      {/* Rotating SVG Chakri */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${animClass} origin-center will-change-transform`}
      >
        <defs>
          <linearGradient id="chakriArm1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF2A8" />
            <stop offset="50%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <radialGradient id="chakriCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#F5D061" />
            <stop offset="70%" stopColor="#E65100" />
            <stop offset="100%" stopColor="#7F1D1D" />
          </radialGradient>
        </defs>

        {/* 6 Curved Spiral Arms */}
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <g key={deg} transform={`rotate(${deg} 80 80)`}>
            {/* Spark Trail */}
            <path
              d="M80 80 Q105 50 145 65 Q115 85 80 80 Z"
              fill="url(#chakriArm1)"
              opacity="0.85"
            />
            {/* Sparkling tip */}
            <circle cx="145" cy="65" r="4" fill="#FFF9C4" filter="drop-shadow(0 0 4px #FFA000)" />
            <circle cx="130" cy="55" r="2.5" fill="#FFD54F" />
            <circle cx="110" cy="50" r="2" fill="#FFB300" />
          </g>
        ))}

        {/* Inner concentric ring */}
        <circle cx="80" cy="80" rx="30" ry="30" stroke="#F5D061" strokeWidth="2" strokeDasharray="6 4" />

        {/* Chakri Center Hub */}
        <circle cx="80" cy="80" r="18" fill="url(#chakriCore)" filter="drop-shadow(0 0 8px #FF6F00)" />
        <circle cx="80" cy="80" r="7" fill="#FFFFFF" />
      </svg>
    </div>
  );
}
