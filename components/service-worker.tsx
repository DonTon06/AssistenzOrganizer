"use client";

import { useEffect } from "react";

/** Registers the service worker that makes the app installable and gives an offline page. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Without a service worker the app still works, just not offline.
    });
  }, []);

  return null;
}
