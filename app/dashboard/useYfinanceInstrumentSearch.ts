"use client";

import { useEffect, useState } from "react";
import type { InstrumentQuoteKpis } from "../strategy/yfinance-tickers";

export type YfinanceInstrumentOption = InstrumentQuoteKpis & {
  symbol: string;
  tradingsymbol: string;
  yahooTicker: string;
  name: string;
  source: "yfinance";
};

type SearchState = {
  query: string;
  instruments: YfinanceInstrumentOption[];
  status: "idle" | "checking" | "ok" | "unavailable";
  message: string;
};

const EMPTY: SearchState = { query: "", instruments: [], status: "idle", message: "" };

function useYfinanceFetch(url: string | null, key: string) {
  const [result, setResult] = useState<SearchState>(EMPTY);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setResult({ query: key, instruments: [], status: "checking", message: "" });
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        const payload = await response.json() as {
          status?: string;
          message?: string;
          instruments?: YfinanceInstrumentOption[];
        };
        const instruments = payload.instruments ?? [];
        const unavailable = payload.status === "unavailable" || !response.ok;
        setResult({
          query: key,
          instruments,
          status: unavailable ? "unavailable" : "ok",
          message: payload.message ?? (unavailable ? "Unavailable" : ""),
        });
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setResult({ query: key, instruments: [], status: "unavailable", message: "Unavailable" });
        }
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, url]);

  const usable = result.query === key;
  return {
    instruments: usable ? result.instruments : [],
    status: !key ? "idle" as const : usable ? result.status : "checking" as const,
    message: usable ? result.message : "",
  };
}

export function useYfinanceInstrumentSearch(query: string, enabled = true) {
  const normalized = query.trim();
  const allowed = enabled && normalized.length > 0 && normalized.length <= 80;
  return useYfinanceFetch(
    allowed ? `/api/quotes/yfinance/search?query=${encodeURIComponent(normalized)}` : null,
    allowed ? normalized.toUpperCase() : "",
  );
}

export function useYfinanceQuoteKpis(symbol: string, enabled = true) {
  const normalized = symbol.trim().toUpperCase();
  const allowed = enabled && Boolean(normalized) && /^[A-Z0-9&.\- ]{1,48}$/.test(normalized);
  const result = useYfinanceFetch(
    allowed ? `/api/quotes/yfinance/search?symbols=${encodeURIComponent(normalized)}` : null,
    allowed ? `SYM:${normalized}` : "",
  );
  return {
    instrument: result.instruments.find((item) => item.symbol === normalized) ?? null,
    status: result.status,
    message: result.message,
  };
}
