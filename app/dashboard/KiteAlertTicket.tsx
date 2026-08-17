"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import type { LiveHolding } from "../live-types";
import { inr } from "./utils";
import { useKiteInstrumentLookup } from "./useKiteInstrumentLookup";
import { useActiveBroker } from "../integrations/broker/use-active";

export type AlertDirection = "above" | "below";
export type AlertExchange = "NSE" | "BSE";

export type KiteAlertSelection = {
  holding?: LiveHolding;
} | null;

function directionLabel(direction: AlertDirection) {
  switch (direction) {
    case "above":
      return "ABOVE";
    case "below":
      return "BELOW";
    default: {
      const _exhaustive: never = direction;
      return _exhaustive;
    }
  }
}

export function KiteAlertTicket({
  selection,
  holdings,
  onClose,
  onSubmitted,
}: {
  selection: KiteAlertSelection;
  holdings: LiveHolding[];
  onClose: () => void;
  onSubmitted: () => Promise<void>;
}) {
  const [symbol, setSymbol] = useState(selection?.holding?.symbol ?? "");
  const [exchange, setExchange] = useState<AlertExchange>("NSE");
  const [direction, setDirection] = useState<AlertDirection>("above");
  const [triggerPrice, setTriggerPrice] = useState(selection?.holding ? selection.holding.price.toFixed(2) : "");
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const normalizedSymbol = symbol.trim().toUpperCase();
  const matchedHolding = holdings.find((holding) => holding.symbol.toUpperCase() === normalizedSymbol);
  const lookup = useKiteInstrumentLookup(normalizedSymbol, exchange);
  const broker = useActiveBroker();
  const trigger = Number(triggerPrice);
  const triggerText = trigger > 0 ? String(trigger) : "";
  const expected = useMemo(
    () => (normalizedSymbol && triggerText ? `ALERT ${directionLabel(direction)} ${normalizedSymbol} ${triggerText}` : ""),
    [direction, normalizedSymbol, triggerText],
  );
  const ready = Boolean(
    selection
    && reviewed
    && confirmation.trim().toUpperCase() === expected
    && /^[A-Z0-9&.\- ]{1,48}$/.test(normalizedSymbol)
    && trigger > 0
    && lookup.exact !== null,
  );

  if (!selection) return null;

  function applyHolding(nextSymbol: string) {
    const upper = nextSymbol.trim().toUpperCase();
    setSymbol(upper);
    setConfirmation("");
    const holding = holdings.find((item) => item.symbol.toUpperCase() === upper);
    if (!holding) return;
    setTriggerPrice(holding.price.toFixed(2));
  }

  async function submitAlert() {
    if (!ready || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      if (!broker.alertPath) throw new Error(broker.notes || "This broker cannot create live alerts.");
      const response = await fetch(broker.alertPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: normalizedSymbol,
          exchange,
          direction,
          triggerPrice: trigger,
          note: note.trim() || undefined,
          confirmation,
        }),
      });
      const payload = await response.json() as {
        status?: string;
        message?: string;
        result?: { uuid?: string; kite_response?: { uuid?: string } } | string;
      };
      if (!response.ok) throw new Error(payload.message || `Kite alert returned ${response.status}`);
      const nested = payload.result && typeof payload.result === "object" ? payload.result : null;
      const uuid = nested?.uuid || nested?.kite_response?.uuid || "";
      setResult({
        tone: "success",
        text: uuid
          ? `${payload.message || "Alert submitted to Kite."} · id ${uuid}`
          : (payload.message || "Alert submitted to Kite."),
      });
      await onSubmitted();
    } catch (error) {
      setResult({ tone: "error", text: error instanceof Error ? error.message : "Kite rejected the alert." });
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="kite-order-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
    <section className="kite-order-ticket alert" role="dialog" aria-modal="true" aria-labelledby="kite-alert-title">
      <header>
        <div>
          <span>Create price alert · {exchange} · simple LTP</span>
          <h3 id="kite-alert-title">{normalizedSymbol || "New alert"}</h3>
          <p>{matchedHolding ? `${matchedHolding.name} · last ${inr.format(matchedHolding.price)}` : lookup.exact ? `${lookup.exact.name}${lookup.publicPrice ? ` · public delayed ${inr.format(lookup.publicPrice)}` : ""}` : "Search the Kite cash-equity catalogue. Notifications fire in Kite when LTP crosses the trigger."}</p>
        </div>
        <button type="button" onClick={onClose} disabled={submitting} aria-label="Close alert ticket"><X size={18}/></button>
      </header>
      <div className="kite-order-warning">
        <AlertTriangle size={18}/>
        <span>
          <b>This can create a real Kite price alert.</b>
          {" "}Review symbol, exchange, direction, and trigger before confirming. Alerts notify only — they do not place orders.
        </span>
      </div>
      <div className="kite-order-fields">
        <label>Symbol
          <input list="kite-alert-instruments" value={symbol} onChange={(event) => applyHolding(event.target.value)} placeholder="e.g. NTPC" autoComplete="off" spellCheck={false}/>
          <datalist id="kite-alert-instruments">{lookup.instruments.map((instrument) => <option key={instrument.id} value={instrument.symbol}>{instrument.name}</option>)}</datalist>
          <small className={`kite-instrument-status ${lookup.status}`}>{lookup.status === "checking" ? "Checking Kite catalogue…" : lookup.exact ? `Verified ${lookup.exact.exchange}:${lookup.exact.symbol}` : normalizedSymbol && lookup.status === "invalid" ? "Not an active cash-market symbol" : "NSE/BSE cash equities"}</small>
        </label>
        <label>Exchange
          <select value={exchange} onChange={(event) => { setExchange(event.target.value as AlertExchange); setConfirmation(""); }}>
            <option value="NSE">NSE</option>
            <option value="BSE">BSE</option>
          </select>
        </label>
        <label>Direction
          <select value={direction} onChange={(event) => { setDirection(event.target.value as AlertDirection); setConfirmation(""); }}>
            <option value="above">Above (≥ trigger)</option>
            <option value="below">Below (≤ trigger)</option>
          </select>
        </label>
        <label>Trigger price<input type="number" min="0.05" step="0.05" value={triggerPrice} onChange={(event) => { setTriggerPrice(event.target.value); setConfirmation(""); }} placeholder={matchedHolding?.price.toFixed(2)}/></label>
        <label className="kite-alert-note">Note (optional)<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Shown as the Kite alert name" maxLength={80} autoComplete="off"/></label>
      </div>
      <div className="kite-order-summary">
        <span>Condition</span>
        <b>LTP {direction === "above" ? "≥" : "≤"} {trigger > 0 ? inr.format(trigger) : "—"}</b>
        <small>Simple Kite Connect alert via create_alert. Does not place or modify orders.</small>
      </div>
      <label className="kite-order-review"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)}/><span>I reviewed this exact price alert and want Kite to create it.</span></label>
      <label className="kite-order-confirm">Type <b>{expected || "ALERT DIRECTION SYMBOL PRICE"}</b> to enable submission<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false}/></label>
      {result && <div className={`kite-order-result ${result.tone}`}>{result.tone === "success" && <CheckCircle2 size={17}/>}<span>{result.text}</span></div>}
      <footer>
        <button type="button" className="secondary" onClick={onClose} disabled={submitting}>Cancel</button>
        <button type="button" className="alert" onClick={() => void submitAlert()} disabled={!ready || submitting}>{submitting ? "Submitting…" : "Create price alert"}</button>
      </footer>
    </section>
  </div>;
}
