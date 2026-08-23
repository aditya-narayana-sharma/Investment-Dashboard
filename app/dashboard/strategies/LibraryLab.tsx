"use client";

import { useMemo, useState } from "react";
import { EquityCurve } from "../builder/EquityCurve";
import {
  runLibraryCampaignOnServer,
  runStrategyBookOnServer,
  type BookRunResponse,
  type CampaignRowResponse,
} from "../../strategy/persist";

export type LibraryLabPick = { id: string; name: string };

type LabMode = "compare" | "book" | "campaign";

function labTitle(mode: LabMode): string {
  switch (mode) {
    case "compare":
      return "Compare two algorithms";
    case "book":
      return "Strategy book";
    case "campaign":
      return "Campaign / walk-forward";
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}

function formatPct(value: number | null | undefined, ran: boolean): string {
  if (!ran || value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatNum(value: number | null | undefined, ran: boolean): string {
  if (!ran || value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

function KpiColumn({
  title,
  row,
}: {
  title: string;
  row: CampaignRowResponse | undefined;
}) {
  const ran = row?.ran === true;
  return (
    <article className="strategy-lab-pane" data-testid="strategy-compare-pane">
      <h4>{title}</h4>
      <dl className="strategy-kpi-grid" aria-label={`${title} KPIs`}>
        <div><small>Annualized</small><b>{formatPct(row?.annualizedReturnPct, ran)}</b></div>
        <div><small>Cumulative</small><b>{formatPct(row?.totalReturnPct, ran)}</b></div>
        <div><small>Sharpe</small><b>{formatNum(row?.sharpe, ran)}</b></div>
        <div><small>Max DD</small><b>{formatPct(row?.maxDrawdownPct, ran)}</b></div>
      </dl>
      {ran && row?.curve && row.curve.length > 1 ? (
        <EquityCurve curve={row.curve} className="symphony-curve strategy-lab-curve" label={`${title} equity curve`} />
      ) : (
        <p className="strategy-engine-note">{row?.message ?? "Not run yet — KPIs stay —."}</p>
      )}
    </article>
  );
}

function PickSelect({
  id,
  label,
  value,
  catalog,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  catalog: readonly LibraryLabPick[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="strategy-lab-field">
      {label}
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select a tree</option>
        {catalog.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
    </label>
  );
}

export function LibraryLab({ catalog }: { catalog: readonly LibraryLabPick[] }) {
  const [mode, setMode] = useState<LabMode | null>(null);
  const [leftId, setLeftId] = useState(catalog[0]?.id ?? "");
  const [rightId, setRightId] = useState(catalog[1]?.id ?? catalog[0]?.id ?? "");
  const [bookLegs, setBookLegs] = useState([
    { id: catalog[0]?.id ?? "", weight: 60 },
    { id: catalog[1]?.id ?? catalog[0]?.id ?? "", weight: 40 },
  ]);
  const [campaignIds, setCampaignIds] = useState<string[]>(catalog.slice(0, 3).map((item) => item.id));
  const [walkForward, setWalkForward] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [compareRows, setCompareRows] = useState<CampaignRowResponse[] | null>(null);
  const [book, setBook] = useState<BookRunResponse | null>(null);
  const [campaignRows, setCampaignRows] = useState<CampaignRowResponse[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const names = useMemo(() => new Map(catalog.map((item) => [item.id, item.name])), [catalog]);

  const close = () => {
    setMode(null);
    setNote(null);
  };

  const runCompare = async () => {
    if (!leftId || !rightId || leftId === rightId) {
      setNote("Pick two different library ids.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const payload = await runLibraryCampaignOnServer({ ids: [leftId, rightId] });
      setCompareRows(payload.rows);
      if (payload.status !== "ok") setNote(payload.message ?? "Compare did not run.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Compare failed.");
    } finally {
      setBusy(false);
    }
  };

  const runBook = async () => {
    const legs = bookLegs.filter((leg) => leg.id && leg.weight > 0);
    if (legs.length < 2) {
      setNote("A book needs at least two weighted trees.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const payload = await runStrategyBookOnServer(legs);
      setBook(payload);
      if (!payload.ran) setNote(payload.message ?? "Book did not run.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Book failed.");
    } finally {
      setBusy(false);
    }
  };

  const runCampaign = async () => {
    if (!campaignIds.length) {
      setNote("Select at least one library tree.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const payload = await runLibraryCampaignOnServer({
        ids: campaignIds,
        from: from || undefined,
        to: to || undefined,
        walkForward,
      });
      setCampaignRows(payload.rows);
      if (payload.status !== "ok") setNote(payload.message ?? "Campaign did not run.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Campaign failed.");
    } finally {
      setBusy(false);
    }
  };

  const title = mode ? labTitle(mode) : "";

  return (
    <>
      <div className="strategy-lab-toolbar" role="group" aria-label="Library lab">
        <button type="button" className="vo-pop" data-testid="strategy-compare-open" onClick={() => setMode("compare")}>Compare</button>
        <button type="button" className="vo-pop" data-testid="strategy-book-open" onClick={() => setMode("book")}>Book</button>
        <button type="button" className="vo-pop" data-testid="strategy-campaign-open" onClick={() => setMode("campaign")}>Campaign</button>
      </div>
      {mode ? (
        <div
          className="strategy-dialog-backdrop"
          role="presentation"
          data-testid={`strategy-${mode}-backdrop`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            className="strategy-dialog strategy-lab-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="strategy-lab-title"
            data-testid={`strategy-${mode}-dialog`}
          >
            <header className="strategy-dialog-head">
              <div>
                <h3 id="strategy-lab-title">{title}</h3>
                <p>
                  {mode === "compare"
                    ? "Two honest equity curves. KPIs stay — unless that tree ran."
                    : mode === "book"
                      ? "Weighted book of saved/Composer trees. Combined equity only after every leg ran. placesOrders is always false."
                      : "Batch backtest on a shared window. Blank — if a tree did not run. No fabricated ranks."}
                </p>
              </div>
              <button type="button" className="vo-pop" onClick={close}>Close</button>
            </header>

            {mode === "compare" ? (
              <>
                <div className="strategy-lab-picks">
                  <PickSelect id="strategy-compare-left" label="First tree" value={leftId} catalog={catalog} onChange={setLeftId} />
                  <PickSelect id="strategy-compare-right" label="Second tree" value={rightId} catalog={catalog} onChange={setRightId} />
                </div>
                <button type="button" className="vo-pop" disabled={busy} onClick={() => { void runCompare(); }}>
                  {busy ? "Running…" : "Run compare"}
                </button>
                <div className="strategy-lab-compare" data-testid="strategy-compare-columns">
                  <KpiColumn title={(names.get(leftId) ?? leftId) || "First"} row={compareRows?.find((row) => row.id === leftId)} />
                  <KpiColumn title={(names.get(rightId) ?? rightId) || "Second"} row={compareRows?.find((row) => row.id === rightId)} />
                </div>
              </>
            ) : null}

            {mode === "book" ? (
              <>
                <div className="strategy-lab-book-legs" data-testid="strategy-book-legs">
                  {bookLegs.map((leg, index) => (
                    <div key={`book-leg-${index}`} className="strategy-lab-picks">
                      <PickSelect
                        id={`strategy-book-id-${index}`}
                        label={`Tree ${index + 1}`}
                        value={leg.id}
                        catalog={catalog}
                        onChange={(id) => setBookLegs((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, id } : row))}
                      />
                      <label className="strategy-lab-field">
                        Weight %
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={leg.weight}
                          onChange={(event) => {
                            const weight = Number(event.target.value);
                            setBookLegs((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, weight } : row));
                          }}
                        />
                      </label>
                    </div>
                  ))}
                </div>
                <div className="strategy-card-actions">
                  <button
                    type="button"
                    className="vo-pop"
                    onClick={() => setBookLegs((current) => [...current, { id: catalog[0]?.id ?? "", weight: 0 }])}
                  >
                    Add tree
                  </button>
                  <button type="button" className="vo-pop" disabled={busy} onClick={() => { void runBook(); }}>
                    {busy ? "Running…" : "Run 60/40 book"}
                  </button>
                </div>
                {book ? (
                  <article className="strategy-lab-pane" data-testid="strategy-book-result">
                    <h4>Combined book</h4>
                    <dl className="strategy-kpi-grid" aria-label="Book KPIs">
                      <div><small>Annualized</small><b>{formatPct(book.annualizedReturnPct, book.ran)}</b></div>
                      <div><small>Cumulative</small><b>{formatPct(book.totalReturnPct, book.ran)}</b></div>
                      <div><small>Sharpe</small><b>{formatNum(book.sharpe, book.ran)}</b></div>
                      <div><small>Max DD</small><b>{formatPct(book.maxDrawdownPct, book.ran)}</b></div>
                    </dl>
                    {book.ran && book.curve && book.curve.length > 1 ? (
                      <EquityCurve curve={book.curve} className="symphony-curve strategy-lab-curve" label="Combined book equity" />
                    ) : (
                      <p className="strategy-engine-note">{book.message ?? "Not run yet — KPIs stay —."}</p>
                    )}
                    <p className="strategy-engine-note">placesOrders is false. Stratji does not place unattended orders.</p>
                  </article>
                ) : null}
              </>
            ) : null}

            {mode === "campaign" ? (
              <>
                <fieldset className="strategy-lab-campaign-ids" data-testid="strategy-campaign-ids">
                  <legend>Library trees</legend>
                  {catalog.map((item) => {
                    const checked = campaignIds.includes(item.id);
                    return (
                      <label key={item.id}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setCampaignIds((current) => (
                              checked ? current.filter((id) => id !== item.id) : [...current, item.id]
                            ));
                          }}
                        />
                        {item.name}
                      </label>
                    );
                  })}
                </fieldset>
                <div className="strategy-lab-picks">
                  <label className="strategy-lab-field">
                    Window start
                    <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
                  </label>
                  <label className="strategy-lab-field">
                    Window end
                    <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
                  </label>
                  <label className="strategy-lab-field strategy-lab-check">
                    <input type="checkbox" checked={walkForward} onChange={(event) => setWalkForward(event.target.checked)} />
                    Walk-forward OOS half
                  </label>
                </div>
                <button type="button" className="vo-pop" disabled={busy} onClick={() => { void runCampaign(); }}>
                  {busy ? "Running…" : "Run campaign"}
                </button>
                {campaignRows ? (
                  <table className="strategy-campaign-table" data-testid="strategy-campaign-table">
                    <thead>
                      <tr>
                        <th>Tree</th>
                        <th>Ann.</th>
                        <th>Cum.</th>
                        <th>Sharpe</th>
                        <th>Max DD</th>
                        <th>OOS Ann.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignRows.map((row) => (
                        <tr key={row.id} data-ran={row.ran ? "true" : "false"}>
                          <td>{row.name}</td>
                          <td>{formatPct(row.annualizedReturnPct, row.ran)}</td>
                          <td>{formatPct(row.totalReturnPct, row.ran)}</td>
                          <td>{formatNum(row.sharpe, row.ran)}</td>
                          <td>{formatPct(row.maxDrawdownPct, row.ran)}</td>
                          <td>{formatPct(row.oosAnnualizedReturnPct, row.ran)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </>
            ) : null}

            {note ? <p className="strategy-engine-note" role="status">{note}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
