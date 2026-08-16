"use client";

import { useEffect, useMemo, useState } from "react";

export type KiteInstrumentOption = {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  series: string;
  tickSize: number;
  lotSize: number;
};

export function useKiteInstrumentSearch(query: string, enabled = true, exchange = "NSE") {
  const normalized = query.trim().toUpperCase();
  const [result, setResult] = useState<{
    query: string;
    instruments: KiteInstrumentOption[];
    status: "idle" | "checking" | "ok" | "unavailable";
  }>({ query: "", instruments: [], status: "idle" });

  useEffect(() => {
    if (!enabled || !normalized || !/^[A-Z0-9&.\- ]{1,48}$/.test(normalized)) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setResult({ query: normalized, instruments: [], status: "checking" });
      try {
        const response = await fetch(`/api/kite/instruments?query=${encodeURIComponent(normalized)}&exchange=${exchange}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json() as { instruments?: KiteInstrumentOption[] };
        if (!response.ok) throw new Error("catalogue unavailable");
        setResult({ query: normalized, instruments: payload.instruments ?? [], status: "ok" });
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setResult({ query: normalized, instruments: [], status: "unavailable" });
        }
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, exchange, normalized]);

  const usable = result.query === normalized;
  return {
    instruments: usable ? result.instruments : [],
    status: !normalized || !enabled ? "idle" as const : usable ? result.status : "checking" as const,
  };
}

export function useKiteInstrumentLookup(symbol: string, exchange = "NSE") {
  const normalized = symbol.trim().toUpperCase();
  const [result, setResult] = useState<{ key: string; instruments: KiteInstrumentOption[]; publicPrice: number | null; status: "checking" | "valid" | "invalid" | "unavailable" }>({ key: "", instruments: [], publicPrice: null, status: "checking" });
  const key = `${exchange}:${normalized}`;
  const usable = result.key === key;
  const instruments = useMemo(() => usable ? result.instruments : [], [result.instruments, usable]);
  const publicPrice = usable ? result.publicPrice : null;
  const status: "idle" | "checking" | "valid" | "invalid" | "unavailable" = !normalized ? "idle" : usable ? result.status : "checking";
  const exact = useMemo(() => instruments.find((item) => item.symbol === normalized && item.exchange === exchange) ?? null, [exchange, instruments, normalized]);

  useEffect(() => {
    if (!normalized || !/^[A-Z0-9&.\- ]{1,48}$/.test(normalized)) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setResult({ key, instruments: [], publicPrice: null, status: "checking" });
      try {
        const response = await fetch(`/api/kite/instruments?query=${encodeURIComponent(normalized)}&exchange=${exchange}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json() as { instruments?: KiteInstrumentOption[] };
        if (!response.ok) throw new Error("catalogue unavailable");
        const next = payload.instruments ?? [];
        const found = next.some((item) => item.symbol === normalized && item.exchange === exchange);
        let nextPublicPrice: number | null = null;
        if (found && exchange === "NSE") {
          const quoteResponse = await fetch(`/api/quotes/yfinance?symbols=${encodeURIComponent(normalized)}`, { cache: "no-store", signal: controller.signal });
          const quotePayload = await quoteResponse.json() as { quotes?: Record<string, { price?: number | null }> };
          const price = quotePayload.quotes?.[normalized]?.price;
          if (quoteResponse.ok && price && price > 0) nextPublicPrice = price;
        }
        setResult({ key, instruments: next, publicPrice: nextPublicPrice, status: found ? "valid" : "invalid" });
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setResult({ key, instruments: [], publicPrice: null, status: "unavailable" });
        }
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [exchange, key, normalized]);

  return { instruments, exact, publicPrice, status };
}
