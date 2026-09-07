"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import type { LiveHolding } from "../live-types";
import { inr } from "./utils";
import { useKiteInstrumentLookup } from "./useKiteInstrumentLookup";

type OrderSide = "BUY" | "SELL";
type OrderType = "MARKET" | "LIMIT" | "SL" | "SL-M";
type Product = "CNC" | "MIS" | "NRML" | "MTF";

export type KiteOrderSelection = { holding?: LiveHolding; side: OrderSide } | null;

export function KiteOrderTicket({ selection, holdings, onClose, onSubmitted }: { selection: KiteOrderSelection; holdings: LiveHolding[]; onClose: () => void; onSubmitted: () => Promise<void> }) {
  const [symbol, setSymbol] = useState(selection?.holding?.symbol ?? "");
  const [side, setSide] = useState<OrderSide>(selection?.side ?? "BUY");
  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState<Product>("CNC");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [price, setPrice] = useState("");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const normalizedSymbol = symbol.trim().toUpperCase();
  const matchedHolding = holdings.find((holding) => holding.symbol.toUpperCase() === normalizedSymbol);
  const lookup = useKiteInstrumentLookup(normalizedSymbol, "NSE");
  const referencePrice = matchedHolding?.price || lookup.publicPrice || 0;
  const expected = useMemo(() => selection && normalizedSymbol ? `${side} ${quantity} ${normalizedSymbol}` : "", [normalizedSymbol, quantity, selection, side]);
  if (!selection) return null;

  const needsPrice = orderType === "LIMIT" || orderType === "SL";
  const needsTrigger = orderType === "SL" || orderType === "SL-M";
  const ready = reviewed && confirmation.trim().toUpperCase() === expected && lookup.exact !== null && quantity >= 1 && (!needsPrice || Number(price) > 0) && (!needsTrigger || Number(triggerPrice) > 0);
  const estimatedPrice = orderType === "MARKET" || orderType === "SL-M" ? referencePrice : Number(price) || referencePrice;

  async function submitOrder() {
    if (!ready || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const response = await fetch("/api/kite/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: normalizedSymbol,
          side,
          quantity,
          product,
          orderType,
          price: needsPrice ? Number(price) : undefined,
          triggerPrice: needsTrigger ? Number(triggerPrice) : undefined,
          confirmation,
        }),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || `Kite order returned ${response.status}`);
      setResult({ tone: "success", text: payload.message || "Order submitted to Kite." });
      await onSubmitted();
    } catch (error) {
      setResult({ tone: "error", text: error instanceof Error ? error.message : "Kite rejected the order." });
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="kite-order-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
    <section className={`kite-order-ticket ${side.toLowerCase()}`} role="dialog" aria-modal="true" aria-labelledby="kite-order-title">
      <header><div><span>{side} · NSE cash equity</span><h3 id="kite-order-title">{normalizedSymbol || "New order"}</h3><p>{matchedHolding ? `${matchedHolding.name} · Kite holding last ${inr.format(matchedHolding.price)}` : lookup.exact ? `${lookup.exact.name}${lookup.publicPrice ? ` · public delayed ${inr.format(lookup.publicPrice)}` : ""}` : "Search the complete Kite NSE cash-equity catalogue."}</p></div><button type="button" onClick={onClose} disabled={submitting} aria-label="Close order ticket"><X size={18}/></button></header>
      <div className="kite-order-warning"><AlertTriangle size={18}/><span><b>This can place a real market order.</b> Review the symbol, side, quantity, product, type, and estimated value before confirming.</span></div>
      <div className="kite-order-fields">
        <label>Symbol<input list="kite-order-instruments" value={symbol} onChange={(event) => { setSymbol(event.target.value.toUpperCase()); setConfirmation(""); }} placeholder="e.g. NTPC" autoComplete="off" spellCheck={false}/><datalist id="kite-order-instruments">{lookup.instruments.map((instrument) => <option key={instrument.id} value={instrument.symbol}>{instrument.name}</option>)}</datalist><small className={`kite-instrument-status ${lookup.status}`}>{lookup.status === "checking" ? "Checking Kite catalogue…" : lookup.exact ? `Verified ${lookup.exact.exchange}:${lookup.exact.symbol}` : normalizedSymbol && lookup.status === "invalid" ? "Not an active cash-market symbol" : "NSE holdings and all other NSE cash equities"}</small></label>
        <label>Side<select value={side} onChange={(event) => { setSide(event.target.value as OrderSide); setConfirmation(""); }}><option value="BUY">BUY</option><option value="SELL">SELL</option></select></label>
        <label>Quantity<input type="number" min="1" step="1" value={quantity} onChange={(event) => { setQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1))); setConfirmation(""); }}/></label>
        <label>Product<select value={product} onChange={(event) => setProduct(event.target.value as Product)}><option value="CNC">CNC · delivery</option><option value="MIS">MIS · intraday</option><option value="MTF">MTF · funded</option><option value="NRML">NRML</option></select></label>
        <label>Order type<select value={orderType} onChange={(event) => setOrderType(event.target.value as OrderType)}><option value="MARKET">Market</option><option value="LIMIT">Limit</option><option value="SL">Stop-loss limit</option><option value="SL-M">Stop-loss market</option></select></label>
        {needsPrice && <label>Limit price<input type="number" min="0.05" step="0.05" value={price} onChange={(event) => setPrice(event.target.value)} placeholder={referencePrice ? referencePrice.toFixed(2) : undefined}/></label>}
        {needsTrigger && <label>Trigger price<input type="number" min="0.05" step="0.05" value={triggerPrice} onChange={(event) => setTriggerPrice(event.target.value)} placeholder={referencePrice ? referencePrice.toFixed(2) : undefined}/></label>}
      </div>
      <div className="kite-order-summary"><span>Estimated order value</span><b>{estimatedPrice > 0 ? inr.format(estimatedPrice * quantity) : "—"}</b><small>{matchedHolding ? "Kite holding last price." : lookup.publicPrice ? "Indicative public delayed close; Kite determines the actual fill." : "No quote entitlement is used for submission; market orders may fill at a different price."}</small></div>
      <label className="kite-order-review"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)}/><span>I reviewed this exact order and want Kite to submit it.</span></label>
      <label className="kite-order-confirm">Type <b>{expected}</b> to enable submission<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false}/></label>
      {result && <div className={`kite-order-result ${result.tone}`}>{result.tone === "success" && <CheckCircle2 size={17}/>}<span>{result.text}</span></div>}
      <footer><button type="button" className="secondary" onClick={onClose} disabled={submitting}>Cancel</button><button type="button" className={side.toLowerCase()} onClick={() => void submitOrder()} disabled={!ready || submitting}>{submitting ? "Submitting…" : `Place ${side} order`}</button></footer>
    </section>
  </div>;
}
