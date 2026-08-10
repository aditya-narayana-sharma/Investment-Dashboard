"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import type { LiveHolding } from "../live-types";
import { inr } from "./utils";

type GttSide = "BUY" | "SELL";
type Product = "CNC" | "MIS" | "NRML" | "MTF";
export type KiteGttKind = "gtt" | "tsl";

export type KiteGttSelection = {
  kind: KiteGttKind;
  holding?: LiveHolding;
} | null;

function kindLabel(kind: KiteGttKind) {
  switch (kind) {
    case "gtt":
      return "GTT";
    case "tsl":
      return "TSL";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function KiteGttTicket({
  selection,
  holdings,
  onClose,
  onSubmitted,
}: {
  selection: KiteGttSelection;
  holdings: LiveHolding[];
  onClose: () => void;
  onSubmitted: () => Promise<void>;
}) {
  const kind = selection?.kind ?? "gtt";
  const label = kindLabel(kind);
  const [symbol, setSymbol] = useState(selection?.holding?.symbol ?? "");
  const [side, setSide] = useState<GttSide>(kind === "tsl" ? "SELL" : "BUY");
  const [quantity, setQuantity] = useState(Math.max(1, selection?.holding?.qty ?? 1));
  const [product, setProduct] = useState<Product>("CNC");
  const [triggerPrice, setTriggerPrice] = useState(selection?.holding ? selection.holding.price.toFixed(2) : "");
  const [limitPrice, setLimitPrice] = useState(selection?.holding ? selection.holding.price.toFixed(2) : "");
  const [confirmation, setConfirmation] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const normalizedSymbol = symbol.trim().toUpperCase();
  const matchedHolding = holdings.find((holding) => holding.symbol.toUpperCase() === normalizedSymbol);
  const expected = useMemo(
    () => (normalizedSymbol ? `${label} ${side} ${quantity} ${normalizedSymbol}` : ""),
    [label, side, quantity, normalizedSymbol],
  );
  const trigger = Number(triggerPrice);
  const limit = Number(limitPrice);
  const ready = Boolean(
    selection
    && reviewed
    && confirmation.trim().toUpperCase() === expected
    && /^[A-Z0-9&.-]{1,32}$/.test(normalizedSymbol)
    && quantity >= 1
    && trigger > 0
    && limit > 0
    && (kind !== "tsl" || side === "SELL"),
  );

  if (!selection) return null;

  function applyHolding(nextSymbol: string) {
    const upper = nextSymbol.trim().toUpperCase();
    setSymbol(upper);
    setConfirmation("");
    const holding = holdings.find((item) => item.symbol.toUpperCase() === upper);
    if (!holding) return;
    setQuantity(Math.max(1, holding.qty || 1));
    setTriggerPrice(holding.price.toFixed(2));
    setLimitPrice(holding.price.toFixed(2));
  }

  async function submitGtt() {
    if (!ready || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const response = await fetch("/api/kite/gtt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          symbol: normalizedSymbol,
          side,
          quantity,
          product,
          triggerPrice: trigger,
          limitPrice: limit,
          lastPrice: matchedHolding?.price && matchedHolding.price > 0 ? matchedHolding.price : undefined,
          confirmation,
        }),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || `Kite ${label} returned ${response.status}`);
      setResult({ tone: "success", text: payload.message || `${label} submitted to Kite.` });
      await onSubmitted();
    } catch (error) {
      setResult({ tone: "error", text: error instanceof Error ? error.message : `Kite rejected the ${label}.` });
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="kite-order-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
    <section className={`kite-order-ticket ${side.toLowerCase()}`} role="dialog" aria-modal="true" aria-labelledby="kite-gtt-title">
      <header>
        <div>
          <span>Create {label} · NSE · single-leg</span>
          <h3 id="kite-gtt-title">{normalizedSymbol || `New ${label}`}</h3>
          <p>{matchedHolding ? `${matchedHolding.name} · last ${inr.format(matchedHolding.price)}` : "Enter a NSE tradingsymbol. Last price is auto-fetched by Kite when omitted."}</p>
        </div>
        <button type="button" onClick={onClose} disabled={submitting} aria-label={`Close ${label} ticket`}><X size={18}/></button>
      </header>
      <div className="kite-order-warning">
        <AlertTriangle size={18}/>
        <span>
          <b>This can create a real Kite {label}.</b>
          {" "}Review symbol, side, quantity, product, trigger, and limit before confirming.
          {kind === "tsl" ? " Protective TSLs are SELL stop GTTs and surface under the TSLs tab after refresh." : " Entry GTTs typically BUY; SELL legs classify under TSLs."}
        </span>
      </div>
      <div className="kite-order-fields">
        <label>Symbol
          <input list="kite-gtt-holdings" value={symbol} onChange={(event) => applyHolding(event.target.value)} placeholder="e.g. INFY" autoComplete="off" spellCheck={false}/>
          <datalist id="kite-gtt-holdings">{holdings.map((holding) => <option key={holding.symbol} value={holding.symbol}>{holding.name}</option>)}</datalist>
        </label>
        <label>Side
          {kind === "tsl"
            ? <input value="SELL" readOnly/>
            : <select value={side} onChange={(event) => { setSide(event.target.value as GttSide); setConfirmation(""); }}>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>}
        </label>
        <label>Quantity<input type="number" min="1" step="1" value={quantity} onChange={(event) => { setQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1))); setConfirmation(""); }}/></label>
        <label>Product<select value={product} onChange={(event) => setProduct(event.target.value as Product)}><option value="CNC">CNC · delivery</option><option value="MIS">MIS · intraday</option><option value="MTF">MTF · funded</option><option value="NRML">NRML</option></select></label>
        <label>Trigger price<input type="number" min="0.05" step="0.05" value={triggerPrice} onChange={(event) => { setTriggerPrice(event.target.value); setConfirmation(""); }} placeholder={matchedHolding?.price.toFixed(2)}/></label>
        <label>Limit price<input type="number" min="0.05" step="0.05" value={limitPrice} onChange={(event) => { setLimitPrice(event.target.value); setConfirmation(""); }} placeholder={matchedHolding?.price.toFixed(2)}/></label>
      </div>
      <div className="kite-order-summary">
        <span>Trigger → limit</span>
        <b>{trigger > 0 ? inr.format(trigger) : "—"} → {limit > 0 ? inr.format(limit) : "—"}</b>
        <small>Single-leg LIMIT GTT via Kite create_gtt. Estimated notional {limit > 0 ? inr.format(limit * quantity) : "—"}.</small>
      </div>
      <label className="kite-order-review"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)}/><span>I reviewed this exact {label} and want Kite to create it.</span></label>
      <label className="kite-order-confirm">Type <b>{expected || `${label} SIDE QTY SYMBOL`}</b> to enable submission<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false}/></label>
      {result && <div className={`kite-order-result ${result.tone}`}>{result.tone === "success" && <CheckCircle2 size={17}/>}<span>{result.text}</span></div>}
      <footer>
        <button type="button" className="secondary" onClick={onClose} disabled={submitting}>Cancel</button>
        <button type="button" className={side.toLowerCase()} onClick={() => void submitGtt()} disabled={!ready || submitting}>{submitting ? "Submitting…" : `Create ${label}`}</button>
      </footer>
    </section>
  </div>;
}
