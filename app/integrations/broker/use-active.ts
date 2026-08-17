"use client";

import { useEffect, useState } from "react";
import { kiteBrokerAdapter } from "./kite";
import { resolveBrokerAdapter, type BrokerAdapter } from "./index";

export function useActiveBroker(): BrokerAdapter {
  const [adapter, setAdapter] = useState<BrokerAdapter>(kiteBrokerAdapter);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/integrations", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ config?: { broker?: { id?: string } } }>)
      .then((body) => {
        if (cancelled) return;
        const id = body.config?.broker?.id;
        if (typeof id === "string" && id.trim()) setAdapter(resolveBrokerAdapter(id));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  return adapter;
}
