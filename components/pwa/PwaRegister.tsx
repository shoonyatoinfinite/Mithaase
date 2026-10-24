"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .catch((err) => {
            console.warn("PWA Service Worker registration skipped:", err);
          });
      });
    }
  }, []);

  return null;
}
