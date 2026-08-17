"use client";

import { useState } from "react";
import { brokerWritePath } from "../../integrations/broker/types";
import { useActiveBroker } from "../../integrations/broker/use-active";
import type { TreeAlertPreview, TreeGttPreview, TreeOrderPreview } from "../../strategy/tree-orders";

export type TreeBrokerKind = "order" | "gtt" | "alert";

export type TreeBrokerDraft =
  | { kind: "order"; preview: TreeOrderPreview }
  | { kind: "gtt"; preview: TreeGttPreview }
  | { kind: "alert"; preview: TreeAlertPreview };

function payload(draft: TreeBrokerDraft, confirmation: string): Record<string, unknown> {
  switch (draft.kind) {
    case "order":
      return {
        symbol: draft.preview.symbol,
        side: draft.preview.side,
        quantity: draft.preview.quantity,
        product: draft.preview.product,
        orderType: draft.preview.orderType,
        confirmation,
      };
    case "gtt":
      return {
        symbol: draft.preview.symbol,
        side: draft.preview.side,
        quantity: draft.preview.quantity,
        product: draft.preview.product,
        triggerPrice: draft.preview.triggerPrice,
        limitPrice: draft.preview.limitPrice,
        lastPrice: draft.preview.lastPrice,
        kind: draft.preview.kind,
        confirmation,
      };
    case "alert":
      return {
        symbol: draft.preview.symbol,
        exchange: draft.preview.exchange,
        direction: draft.preview.direction,
        triggerPrice: draft.preview.triggerPrice,
        confirmation,
      };
    default: {
      const _never: never = draft;
      return _never;
    }
  }
}

function title(draft: TreeBrokerDraft): string {
  switch (draft.kind) {
    case "order":
      return `Place Kite order · ${draft.preview.side} ${draft.preview.quantity} ${draft.preview.symbol}`;
    case "gtt":
      return `Create ${draft.preview.kind === "tsl" ? "TSL" : "GTT"} · ${draft.preview.symbol}`;
    case "alert":
      return `Create price alert · ${draft.preview.symbol}`;
    default: {
      const _never: never = draft;
      return _never;
    }
  }
}

export function TreeBrokerConfirm({
  draft,
  authUrl,
  onClose,
}: {
  draft: TreeBrokerDraft;
  authUrl?: string;
  onClose: () => void;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const broker = useActiveBroker();
  const expected = draft.preview.confirmation;
  const ready = reviewed && confirmation.trim().toUpperCase() === expected.toUpperCase();
  const path = brokerWritePath(broker, draft.kind);

  async function submit() {
    if (!ready || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      if (!path) throw new Error(broker.notes || "The active broker cannot submit live writes.");
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(draft, confirmation)),
      });
      const body = await response.json() as { message?: string; status?: string };
      if (!response.ok) throw new Error(body.message || `Kite returned ${response.status}`);
      setResult({ tone: "success", text: body.message || "Submitted to Kite." });
    } catch (error) {
      setResult({ tone: "error", text: error instanceof Error ? error.message : "Kite rejected the request." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="symphony-broker-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose();
    }}>
      <section className="symphony-broker-ticket" role="dialog" aria-modal="true" aria-labelledby="tree-broker-title">
        <header>
          <h3 id="tree-broker-title">{title(draft)}</h3>
          <button type="button" onClick={onClose} disabled={submitting}>Close</button>
        </header>
        <p className="symphony-broker-warn">This can submit a real Kite {draft.kind}. Paper/preview stays the default until you confirm.</p>
        {authUrl && (
          <p>
            <a href={authUrl} target="_blank" rel="noreferrer">Authenticate Kite</a>
            {" · "}session missing or expired.
          </p>
        )}
        <dl>
          <div><dt>Symbol</dt><dd>{draft.preview.symbol}</dd></div>
          {"side" in draft.preview && <div><dt>Side</dt><dd>{draft.preview.side}</dd></div>}
          {"quantity" in draft.preview && <div><dt>Qty</dt><dd>{draft.preview.quantity}</dd></div>}
          {"triggerPrice" in draft.preview && <div><dt>Trigger</dt><dd>{draft.preview.triggerPrice}</dd></div>}
        </dl>
        <label>
          <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
          I reviewed this exact ticket and want Kite to submit it.
        </label>
        <label>
          Type <b>{expected}</b>
          <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} />
        </label>
        {result && <p className={`symphony-broker-result ${result.tone}`}>{result.text}</p>}
        <footer>
          <button type="button" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={!ready || submitting}>
            {submitting ? "Submitting…" : draft.kind === "order" ? "Place Kite order" : draft.kind === "gtt" ? "Create GTT" : "Create alert"}
          </button>
        </footer>
      </section>
    </div>
  );
}
