"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";

interface Note {
  id: number;
  x: number; // percentage across screen
  delay: number;
  duration: number;
  rotateStart: number;
  rotateEnd: number;
  scale: number;
  opacity: number;
  noteValue: string;
}

export function MoneyRain() {
  const [isVisible, setIsVisible] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    // Check session storage
    if (typeof window === "undefined") return;

    // Respect reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const hasSeen = sessionStorage.getItem("mithaase_seen_opening");
    if (!hasSeen) {
      sessionStorage.setItem("mithaase_seen_opening", "true");

      // Generate 24 decorative notes with diverse trajectories
      const values = ["₹500", "₹200", "₹100", "₹50", "₹2000"];
      const generated: Note[] = Array.from({ length: 22 }, (_, i) => ({
        id: i,
        x: Math.random() * 92 + 4,
        delay: Math.random() * 0.8,
        duration: 2.4 + Math.random() * 1.2,
        rotateStart: (Math.random() - 0.5) * 60,
        rotateEnd: (Math.random() - 0.5) * 280,
        scale: 0.75 + Math.random() * 0.45,
        opacity: 0.85 + Math.random() * 0.15,
        noteValue: values[i % values.length],
      }));

      setNotes(generated);
      setIsVisible(true);

      // Auto fade-out after ~3.5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 3600);

      return () => clearTimeout(timer);
    }
  }, []);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {/* Skip Button (clickable) */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute top-6 right-6 pointer-events-auto z-50"
        >
          <button
            onClick={() => setIsVisible(false)}
            className="flex items-center gap-2 bg-[#2B0938]/90 hover:bg-[#400B16] text-[#F5D061] text-xs font-semibold py-2 px-4 rounded-full border border-[#D4AF37]/40 shadow-lg backdrop-blur-md transition-all active:scale-95"
            aria-label="Skip celebration animation"
          >
            <span>Skip Opening</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>

        {/* Decorative Falling Currency Notes */}
        {notes.map((note) => (
          <motion.div
            key={note.id}
            initial={{
              y: "-15vh",
              x: `${note.x}vw`,
              rotate: note.rotateStart,
              scale: note.scale,
              opacity: 0,
            }}
            animate={{
              y: "110vh",
              x: `${note.x + (Math.sin(note.id) * 6)}vw`,
              rotate: note.rotateEnd,
              opacity: [0, note.opacity, note.opacity, 0],
            }}
            transition={{
              duration: note.duration,
              delay: note.delay,
              ease: "easeInOut",
            }}
            className="absolute top-0 will-change-transform select-none"
            style={{ width: "90px", height: "48px" }}
          >
            {/* Illustrated Decorative Note (Stylized Festive Gift Voucher / Currency) */}
            <div className="w-full h-full rounded bg-gradient-to-r from-[#881337] via-[#9F1239] to-[#D97706] p-1 shadow-xl border border-[#F5D061]/60 flex flex-col justify-between text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-300/20 via-transparent to-black/30 pointer-events-none" />
              <div className="flex justify-between items-center text-[9px] font-bold text-[#F5D061] tracking-wider">
                <span>SHREE SHYAM</span>
                <span>{note.noteValue}</span>
              </div>
              <div className="flex items-center justify-center gap-1 my-auto">
                <Sparkles className="w-3.5 h-3.5 text-[#F5D061] animate-spin" style={{ animationDuration: "3s" }} />
                <span className="text-[10px] font-serif font-black tracking-widest text-[#FFF8EE]">MITHAASÉ</span>
              </div>
              <div className="flex justify-between items-center text-[7px] text-[#FDE68A]/80 font-mono">
                <span>DIWALI 2026</span>
                <span>SHUBH LAXMI</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </AnimatePresence>
  );
}
