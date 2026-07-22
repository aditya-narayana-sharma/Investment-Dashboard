"use client";

import { useEffect } from "react";

export function PwaRuntime() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    let disposed = false;
    let reloading = false;
    let updateTimer = 0;
    let checkForAppUpdate: (() => void) | null = null;

    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        if (disposed) return;
        checkForAppUpdate = () => {
          if (document.visibilityState === "visible") void registration.update().catch(() => undefined);
        };
        updateTimer = window.setInterval(checkForAppUpdate, 5 * 60 * 1000);
        document.addEventListener("visibilitychange", checkForAppUpdate);
        window.addEventListener("online", checkForAppUpdate);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      window.clearInterval(updateTimer);
      if (checkForAppUpdate) {
        document.removeEventListener("visibilitychange", checkForAppUpdate);
        window.removeEventListener("online", checkForAppUpdate);
      }
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
