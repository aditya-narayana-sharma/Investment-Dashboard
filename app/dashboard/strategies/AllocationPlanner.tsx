"use client";

import { useMemo, useState } from "react";
import { planAllocation, orderTicketPrefills, type AllocationMode } from "../../strategy/allocation-planner";
import type { StrategySignal } from "../../strategy/builtin-signals";

/**
 * Y-3 allocation planner.
 *
 * Sizes signalled symbols into whole-share quantities and hands them to the
 * existing reviewed order ticket. It never submits: `onStage` opens the ticket
 * pre-filled, and the ticket's typed-confirmation gate is the only path to a
 * broker. A plan with any blocking error cannot be staged at all.
 */
export function AllocationPlanner({
  candidates,
  priceBySymbol,
  equityMargin,
  marginsKnown,
  onStage,
}: {
  candidates: readonly StrategySignal[];
  priceBySymbol: ReadonlyMap<string, number>;
  equityMargin: number;
  marginsKnown: boolean;
  onStage?: (prefills: Array<{ symbol: string; quantity: number; price: number }>) => void;
}) {
  const [mode, setMode] = useState<AllocationMode>("percent");
  const [capital, setCapital] = useState("100000");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  const symbols = useMemo(
    () => [...new Set(candidates.map((signal) => signal.symbol))],
    [candidates],
  );
  const chosen = symbols.filter((symbol) => selected[symbol]);

  const plan = useMemo(() => planAllocation(
    chosen.map((symbol) => ({
      symbol,
      price: priceBySymbol.get(symbol) ?? null,
      allocation: Number(allocations[symbol] ?? ""),
    })),
    {
      mode,
      deployableCapital: Number(capital) || 0,
      equityMargin,
      marginsKnown,
    },
  ), [chosen, allocations, mode, capital, equityMargin, marginsKnown, priceBySymbol]);

  const prefills = orderTicketPrefills(plan);
  const canStage = prefills.length > 0 && plan.errors.length === 0;

  if (!symbols.length) {
    return (
      <div className="strategy-signals-empty">
        <b>No BUY candidates right now</b>
        <p>
          Bollinger Band Expansion raises a candidate on an upside breakout out of a squeeze;
          Mean Comparison raises one while SMA 20 sits above SMA 220. Symbols without enough
          history stay unavailable rather than being estimated.
        </p>
      </div>
    );
  }

  return (
    <section className="allocation-planner" aria-label="Allocation planner">
      <header className="allocation-planner-head">
        <div className="allocation-mode" role="radiogroup" aria-label="Allocation mode">
          <button type="button" role="radio" aria-checked={mode === "percent"} className={mode === "percent" ? "active" : ""} onClick={() => setMode("percent")}>
            % of capital
          </button>
          <button type="button" role="radio" aria-checked={mode === "amount"} className={mode === "amount" ? "active" : ""} onClick={() => setMode("amount")}>
            Absolute
          </button>
        </div>
        <label className="allocation-capital">
          Deployable capital
          <input
            inputMode="decimal"
            value={capital}
            onChange={(event) => setCapital(event.target.value.replace(/[^\d.]/g, ""))}
            aria-label="Deployable capital in rupees"
          />
        </label>
      </header>

      <table className="allocation-table">
        <thead>
          <tr>
            <th scope="col">Include</th>
            <th scope="col">Symbol</th>
            <th scope="col">Price</th>
            <th scope="col">{mode === "percent" ? "Allocation %" : "Amount"}</th>
            <th scope="col">Qty</th>
            <th scope="col">Value</th>
            <th scope="col">Note</th>
          </tr>
        </thead>
        <tbody>
          {symbols.map((symbol) => {
            const price = priceBySymbol.get(symbol) ?? null;
            const line = plan.lines.find((row) => row.symbol === symbol);
            return (
              <tr key={symbol} data-blocked={line?.reason ? "true" : "false"}>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(selected[symbol])}
                    onChange={(event) => setSelected((current) => ({ ...current, [symbol]: event.target.checked }))}
                    aria-label={`Include ${symbol} in the plan`}
                  />
                </td>
                <th scope="row">{symbol}</th>
                {/* A missing price renders blank, never a placeholder number. */}
                <td>{price === null ? "—" : price.toFixed(2)}</td>
                <td>
                  <input
                    inputMode="decimal"
                    value={allocations[symbol] ?? ""}
                    onChange={(event) => setAllocations((current) => ({ ...current, [symbol]: event.target.value.replace(/[^\d.]/g, "") }))}
                    aria-label={`${symbol} allocation`}
                    disabled={!selected[symbol]}
                  />
                </td>
                <td>{line ? line.quantity || "—" : "—"}</td>
                <td>{line && line.notional > 0 ? line.notional.toFixed(2) : "—"}</td>
                <td className="allocation-note">
                  {line?.reason ?? line?.funds.message ?? ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <footer className="allocation-planner-foot">
        <div className="allocation-totals">
          <span>Total <b>{plan.totalNotional.toFixed(2)}</b></span>
          <span data-negative={plan.residual < 0 ? "true" : "false"}>
            Residual <b>{plan.residual.toFixed(2)}</b>
          </span>
        </div>
        {plan.errors.length > 0 && (
          <ul className="allocation-errors" role="alert">
            {plan.errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        )}
        <button
          type="button"
          className="allocation-stage"
          disabled={!canStage}
          onClick={() => onStage?.(prefills)}
          title="Opens the reviewed Kite order ticket pre-filled. Placing an order still requires typed confirmation."
        >
          Review {prefills.length || ""} order{prefills.length === 1 ? "" : "s"} in the Kite ticket
        </button>
        <p className="allocation-disclaimer">
          Machine-computed sizing from the selected strategy signals. This stages a review only —
          every order still requires the Kite ticket&apos;s typed confirmation. Not investment advice.
        </p>
      </footer>
    </section>
  );
}

/** Y-3 signals table. Blank, never inferred, when a symbol lacks history. */
export function StrategySignalsTable({ signals }: { signals: readonly StrategySignal[] }) {
  if (!signals.length) {
    return <p className="strategy-signals-empty">No symbols loaded yet.</p>;
  }
  return (
    <table className="strategy-signals-table">
      <thead>
        <tr>
          <th scope="col">Symbol</th>
          <th scope="col">Strategy</th>
          <th scope="col">State</th>
          <th scope="col">Metrics</th>
          <th scope="col">As of</th>
          <th scope="col">Source</th>
        </tr>
      </thead>
      <tbody>
        {signals.map((signal) => (
          <tr key={`${signal.symbol}-${signal.strategy}`} data-action={signal.action} data-eligible={signal.eligible ? "true" : "false"}>
            <th scope="row">{signal.symbol}</th>
            <td>{signal.strategy === "bollinger_expansion" ? "Bollinger Expansion" : "Mean Comparison"}</td>
            <td>{signal.state}</td>
            <td className="strategy-signal-metrics">
              {signal.eligible
                ? signal.metrics.map((metric) => (
                    <span key={metric.label}>
                      {metric.label} <b>{metric.value === null ? "—" : `${metric.value}${metric.unit ?? ""}`}</b>
                    </span>
                  ))
                : <em>{signal.reason}</em>}
            </td>
            <td>{signal.asOf ?? "—"}</td>
            <td>{signal.source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
