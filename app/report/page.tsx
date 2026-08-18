"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CheckCircle2, Download, ExternalLink, LogIn, RefreshCw } from "lucide-react";
import Link from "next/link";
import { analystCalls, earningsCalendar, podcastNotes, scenarios, sources } from "../portfolio-data";
import type { ContentDigestSnapshot } from "../content-types";
import type { DashboardRefreshResult } from "../dashboard-types";
import type { AllocationSlice, KiteSnapshot, LiveHolding } from "../live-types";
import { dedupeAxisCallsBySymbol } from "../axis-holding-trading-calls";
import { axisImpliedUpsidePct, completeAxisPicks } from "../axis-pick-metrics";
import { sortDonutHoldings } from "../portfolio-donut";
import { sectorCompanies } from "../sector-company-data";
import { sectors } from "../sector-data";
import { alignSectorImpactRows, macroDials, squeezeWidths, type ImpactSignal } from "../sector-analytics-data";
import { LicenseGate } from "../dashboard/LicenseGate";
import { tierAllows } from "../license";
import { useLicenseSnapshot } from "../license-snapshot";
import styles from "./report.module.css";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const outlookDetails: Record<string, { support: string; breakRisk: string; response: string; insulation: string }> = {
  ICICIBANK: { support: "Liability franchise, loan growth and robust asset quality.", breakRisk: "Oil-led inflation, bond yields, NIM pressure and FII selling.", response: "Retain as core; add only after diversification improves.", insulation: "Large, liquid franchise and strong balance sheet" },
  ETERNAL: { support: "Quick-commerce scaling and possible MSCI full-weight restoration.", breakRisk: "High-duration valuation, competition, logistics and discretionary-demand risk.", response: "Hold; cap additions while concentration remains elevated.", insulation: "Platform growth and potential index inflows" },
  BHARTIARTL: { support: "Tariff/ARPU cycle, recurring revenue and capex moderation.", breakRisk: "FII de-risking, capex or competitive intensity.", response: "Portfolio stabiliser; accumulate only on broad corrections.", insulation: "Recurring telecom revenue and pricing power" },
  AETHER: { support: "Exclusive manufacturing, R&D and new capacity.", breakRisk: "Feedstock, freight, working capital and heavy capex.", response: "Keep small; require margin and cash-flow confirmation.", insulation: "Specialty mix and export offset, if margins hold" },
  ADANIGREEN: { support: "Renewable capacity expansion and contracted power sales.", breakRisk: "Leverage, refinancing cost, execution and valuation sensitivity.", response: "Hold; monitor debt and commissioned capacity before adding.", insulation: "No direct crude input linkage in renewable generation" },
  JSWENERGY: { support: "Renewable/storage pipeline and contracted capacity.", breakRisk: "Leverage, interest cost and project execution.", response: "Keep small until capacity and debt trajectory are clearer.", insulation: "Domestic power demand and contracted assets" },
};

function PageHeader({ section, page, asOf }: { section: string; page: number; asOf: string }) {
  return <><header className={styles.pageHeader}><div><b>INVESTMENT BRIEF</b><span>{section}</span></div><div><b>{asOf}</b><span>Fresh live-session Kite snapshot</span></div></header><div className={styles.pageNum}>{page}</div></>;
}

function Callout({ tone="blue", title, children }: { tone?: string; title: string; children: React.ReactNode }) {
  return <div className={`${styles.callout} ${styles[tone]}`}><b>{title}</b><p>{children}</p></div>;
}

function Risk({ value }: { value: string }) {
  const tone=value.toLowerCase().includes("high")?"red":value.toLowerCase().includes("low")?"green":"amber";
  return <span className={`${styles.pill} ${styles[tone]}`}>{value}</span>;
}

const signalMark: Record<ImpactSignal, { mark: string; label: string; tone: string }> = {
  tailwind: { mark: "▲", label: "Tailwind", tone: "pos" },
  headwind: { mark: "▼", label: "Headwind", tone: "neg" },
  "two-way": { mark: "●", label: "Two-way", tone: "warn" },
  na: { mark: "–", label: "Not material", tone: "muted" },
};

type PrintableSlice = { name: string; weight: number; color: string };

function chunkItems<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const chunks: T[][] = [];
  for (let offset = 0; offset < items.length; offset += size) chunks.push(items.slice(offset, offset + size));
  return chunks;
}

async function choosePdfSaveHandle(filename: string) {
  const savePicker = (window as Window & {
    showSaveFilePicker?: (options: {
      suggestedName?: string;
      types?: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<FileSystemFileHandle>;
  }).showSaveFilePicker;
  if (typeof savePicker !== "function") return null;
  try {
    return await savePicker({
      suggestedName: filename,
      types: [{ description: "PDF document", accept: { "application/pdf": [".pdf"] } }],
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled" as const;
    return null;
  }
}

async function promptPdfDownload(downloadUrl: string, filename: string) {
  const chosen = await choosePdfSaveHandle(filename);
  if (chosen === "cancelled") return "cancelled" as const;

  if (chosen) {
    const response = await fetch(downloadUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not fetch the prepared PDF for download.");
    const blob = await response.blob();
    const writable = await chosen.createWritable();
    await writable.write(blob);
    await writable.close();
    return "picker" as const;
  }

  // Fallbacks force a download (not a PDF preview tab) via attachment / download attr.
  const response = await fetch(downloadUrl, { cache: "no-store" });
  if (!response.ok) {
    window.location.assign(downloadUrl);
    return "navigate" as const;
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
  return "anchor" as const;
}

async function fetchYfinanceBySymbol(symbols: string[]): Promise<Map<string, number>> {
  const next = new Map<string, number>();
  const unique = [...new Set(symbols.filter(Boolean))];
  const chunkSize = 12;
  const chunks: string[][] = [];
  for (let offset = 0; offset < unique.length; offset += chunkSize) {
    chunks.push(unique.slice(offset, offset + chunkSize));
  }
  const settled = await Promise.all(chunks.map(async (chunk) => {
    try {
      const response = await fetch(`/api/quotes/yfinance?symbols=${chunk.join(",")}`, { cache: "no-store" });
      const data = await response.json() as { quotes?: Record<string, { price?: number | null }> };
      if (!response.ok) return [] as Array<[string, number]>;
      return Object.entries(data.quotes ?? {})
        .filter((entry): entry is [string, { price: number }] => entry[1]?.price != null && entry[1].price > 0)
        .map(([symbol, quote]) => [symbol, quote.price] as [string, number]);
    } catch {
      // Leave missing symbols as —; never invent prices.
      return [] as Array<[string, number]>;
    }
  }));
  for (const entries of settled) {
    for (const [symbol, price] of entries) next.set(symbol, price);
  }
  return next;
}

function polarPoint(radius: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return { x: 180 + radius * Math.cos(radians), y: 180 + radius * Math.sin(radians) };
}

function ringPath(innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) {
  const span = Math.max(0.1, endAngle - startAngle);
  const gap = Math.min(0.8, span * 0.08);
  const start = startAngle + gap;
  const end = endAngle - gap;
  const outerStart = polarPoint(outerRadius, start);
  const outerEnd = polarPoint(outerRadius, end);
  const innerEnd = polarPoint(innerRadius, end);
  const innerStart = polarPoint(innerRadius, start);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${outerStart.x} ${outerStart.y} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`;
}

function ringSegments<T extends PrintableSlice>(items: T[]) {
  let cursor = -90;
  return items.map((item) => {
    const start = cursor;
    const end = cursor + item.weight * 3.6;
    cursor = end;
    return { ...item, start, end, middle: start + (end - start) / 2 };
  });
}

function compactLabel(value: string) {
  return value.replace("E-Commerce", "E-Commerce").replace("Telecom", "Telecom").replace("Private Sector Bank", "Private Bank").replace("Power Generation", "Power Gen").replace("Consumer internet", "Consumer").replace("Specialty chemicals", "Chemicals").replace("Financials", "Finance").replace("Large cap", "Large").replace("Mid cap", "Mid").replace("Small cap", "Small").replace("Commercial Banking", "Commercial").replace("Food Delivery & Quick Commerce", "Food + Quick").replace("Wireless & Digital Services", "Wireless").replace("Renewable Power", "Renewables").replace("Integrated Power & Storage", "Power + Storage").replace("Specialty & Fine Chemicals", "Specialty Chem.");
}

function PrintNestedDonut({ holdings, marketCap, sectors, subSectors, value, pnl, pnlPct }: { holdings: LiveHolding[]; marketCap: AllocationSlice[]; sectors: AllocationSlice[]; subSectors: AllocationSlice[]; value: number; pnl: number; pnlPct: number }) {
  const donutHoldings = sortDonutHoldings(holdings);
  const marketSegments = ringSegments(marketCap);
  const sectorSegments = ringSegments(sectors);
  const subSectorSegments = ringSegments(subSectors);
  const gainShades = ["#0f704f", "#178c61", "#23a472", "#39b785", "#63c99e", "#4db88a", "#2d9b6c"];
  const holdingSegments = ringSegments(donutHoldings.map((holding, index) => ({ ...holding, name: holding.symbol, color: holding.pnl >= 0 ? gainShades[index % gainShades.length] : "#bd3d43" })));
  const signed = (amount: number) => `${amount >= 0 ? "+" : ""}${amount.toFixed(1)}%`;

  return <div className={styles.printDonutWrap}>
    <svg className={styles.printDonut} viewBox="0 0 360 360" role="img" aria-label="Nested live portfolio allocation chart">
      {marketSegments.map((segment, index) => { const point = polarPoint(37, segment.middle); return <g key={segment.id ?? `market-${index}`}><path d={ringPath(27, 47, segment.start, segment.end)} fill={segment.color}/><text x={point.x} y={point.y} className={`${styles.svgLabel} ${styles.innerLabel}`} textAnchor="middle" dominantBaseline="central"><tspan x={point.x} dy="-.45em">{compactLabel(segment.name)}</tspan><tspan x={point.x} dy="1.1em">{segment.weight.toFixed(1)}%</tspan></text></g>; })}
      {sectorSegments.map((segment, index) => { const point = polarPoint(63, segment.middle); const compact = segment.weight < 7; return <g key={segment.id ?? `sector-${index}`}><path d={ringPath(51, 74, segment.start, segment.end)} fill={segment.color}/><text x={point.x} y={point.y} className={`${styles.svgLabel} ${styles.middleLabel}`} textAnchor="middle" dominantBaseline="central"><tspan x={point.x} dy={compact?"0":"-.45em"}>{compactLabel(segment.name)}</tspan>{!compact&&<tspan x={point.x} dy="1.1em">{segment.weight.toFixed(1)}%</tspan>}</text></g>; })}
      {subSectorSegments.map((segment, index) => { const point = polarPoint(90, segment.middle); const compact = segment.weight < 7; return <g key={segment.id ?? `subsector-${index}`}><path d={ringPath(78, 103, segment.start, segment.end)} fill={segment.color}/><text x={point.x} y={point.y} className={`${styles.svgLabel} ${styles.subsectorLabel}`} textAnchor="middle" dominantBaseline="central"><tspan x={point.x} dy={compact?"0":"-.45em"}>{compactLabel(segment.name)}</tspan>{!compact&&<tspan x={point.x} dy="1.1em">{segment.weight.toFixed(1)}%</tspan>}</text></g>; })}
      {holdingSegments.map((segment) => { const point = polarPoint(129, segment.middle); const compact = segment.weight < 7; return <g key={`holding-${segment.symbol}`}><path d={ringPath(107, 151, segment.start, segment.end)} fill={segment.color} fillOpacity={segment.dayPnl >= 0 ? 1 : .58} stroke={segment.dayPnl >= 0 ? "#ffffff" : "#9b2f36"} strokeWidth="1.4"><title>{segment.name}: {segment.weight.toFixed(1)}% portfolio, unrealised {signed(segment.pnlPct)}, day {signed(segment.dayPct)}</title></path><text x={point.x} y={point.y} className={`${styles.svgLabel} ${styles.outerLabel}`} textAnchor="middle" dominantBaseline="central"><tspan x={point.x} dy={compact?"-.25em":"-1.35em"} className={styles.symbolLabel}>{compactLabel(segment.name)}</tspan><tspan x={point.x} dy="1.05em">{segment.weight.toFixed(1)}%</tspan>{!compact&&<><tspan x={point.x} dy="1.05em">U {signed(segment.pnlPct)}</tspan><tspan x={point.x} dy="1.05em">D {signed(segment.dayPct)}</tspan></>}</text></g>; })}
      <circle cx="180" cy="180" r="23" fill="#ffffff"/>
      <text x="180" y="174" className={styles.donutCenter} textAnchor="middle"><tspan x="180">{inr.format(value)}</tspan><tspan x="180" dy="12" className={pnl>=0?styles.svgPos:styles.svgNeg}>{signed(pnlPct)}</tspan></text>
    </svg>
    <div className={styles.printRingKey}><span><i className={styles.outerRing}/>Holdings · weight + U/Day P&amp;L</span><span><i className={styles.subsectorRing}/>Sub-sector</span><span><i className={styles.middleRing}/>Industry</span><span><i className={styles.innerRing}/>AMFI market cap</span><span><i className={styles.shadedRing}/>Shaded = negative day P&amp;L</span></div>
  </div>;
}

export default function Report() {
  const { license } = useLicenseSnapshot();
  const [snapshot, setSnapshot] = useState<KiteSnapshot | null>(null);
  const [content, setContent] = useState<ContentDigestSnapshot | null>(null);
  const [yfinanceBySymbol, setYfinanceBySymbol] = useState<Map<string, number>>(new Map());
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState("");
  const [preparedDownload, setPreparedDownload] = useState<{ filename: string; url: string } | null>(null);
  const autoExported = useRef(false);

  const refreshLatest = useCallback(async (downloadAfterRefresh = false) => {
    setRefreshing(true);
    setError("");
    if (downloadAfterRefresh) setPreparedDownload(null);
    try {
      const [completeResponse, ...sectorResponses] = await Promise.all([
        fetch(`/api/dashboard/refresh?report=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(90_000) }),
        ...Object.keys(sectorCompanies).map((sectorId) => fetch(`/api/sectors/snapshot?sector=${encodeURIComponent(sectorId)}&report=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(90_000) })),
      ]);
      const complete = await completeResponse.json() as DashboardRefreshResult;
      const latest = complete.kite;
      const latestContent = complete.content;
      if (!completeResponse.ok || !latest || !latestContent) throw new Error("Complete dashboard refresh did not return the required report sources.");
      const kiteSymbols = new Set(latest.holdings.filter((holding) => holding.price > 0).map((holding) => holding.symbol));
      const axisUnique = dedupeAxisCallsBySymbol(latestContent.investment.axisRecommendations);
      const matrixSymbols = [
        ...axisUnique.map((call) => call.symbol),
        ...analystCalls.filter((call) => !axisUnique.some((axis) => axis.symbol === call.symbol)).map((call) => call.symbol),
      ];
      const missingQuotes = [...new Set(matrixSymbols)].filter((symbol) => !kiteSymbols.has(symbol));
      const yfinanceQuotes = missingQuotes.length ? await fetchYfinanceBySymbol(missingQuotes) : new Map<string, number>();
      flushSync(() => {
        setSnapshot(latest);
        setContent(latestContent);
        setYfinanceBySymbol(yfinanceQuotes);
      });
      const mailReady = latestContent.sources.axisResearch.status === "live" && latestContent.sources.newsletters.status === "live";
      if (!mailReady) throw new Error("Current Axis Research and Newsletters mail must refresh before the report can be generated.");
      const reportSources = new Map(complete.sources.map((source) => [source.source, source.state]));
      const kiteFresh = reportSources.get("Kite");
      const calendarFresh = reportSources.get("Apple Calendar");
      const earningsFresh = reportSources.get("Earnings");
      const failedFreshness = [
        kiteFresh === "live" ? null : `Kite=${kiteFresh ?? "unavailable"}`,
        calendarFresh === "live" ? null : `Calendar=${calendarFresh ?? "unavailable"}`,
        earningsFresh === "verified" ? null : `Earnings=${earningsFresh ?? "unavailable"}`,
      ].filter((item): item is string => Boolean(item));
      if (failedFreshness.length) {
        const authHint = latest.status === "auth_required" || latest.authStatus === "unauthenticated" || latest.authStatus === "expired"
          ? " Authenticate Kite, then retry."
          : latest.status === "partial"
            ? ` Kite session is active but incomplete${latest.unavailableSections?.length ? ` (${latest.unavailableSections.join(", ")} unavailable)` : ""}; a full live snapshot is required.`
            : "";
        throw new Error(`Kite, Calendar and Earnings must pass their freshness contracts before the investment PDF can be labelled latest (${failedFreshness.join(", ")}).${authHint}`);
      }
      if (downloadAfterRefresh && latest.status !== "live") throw new Error(latest.message || "A live Kite session is required before PDF export.");
      if (downloadAfterRefresh && sectorResponses.some((sectorResponse) => !sectorResponse.ok)) throw new Error("At least one sector universe failed to refresh. The PDF was not exported with mixed-freshness data.");
      if (downloadAfterRefresh) {
        await document.fonts.ready;
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

        const pages = document.querySelector<HTMLElement>("[data-pdf-pages]");
        if (!pages || pages.querySelectorAll(`.${styles.page}`).length === 0) {
          throw new Error("The report pages are unavailable for PDF generation.");
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const filename = `Portfolio_Investment_Brief_${timestamp}.pdf`;
        const reportPages = Array.from(pages.querySelectorAll<HTMLElement>(`.${styles.page}`));
        const overflowingPages = reportPages
          .map((page, index) => ({ index: index + 1, overflow: page.scrollHeight - page.clientHeight }))
          .filter((page) => page.overflow > 2);
        if (overflowingPages.length) {
          // Auto-split: temporarily allow height growth and reflow clipped content onto continuation pages.
          for (const page of reportPages) {
            if (page.scrollHeight - page.clientHeight <= 2) continue;
            const overflowPx = page.scrollHeight - page.clientHeight;
            page.style.height = "auto";
            page.style.minHeight = "297mm";
            page.style.overflow = "visible";
            page.dataset.pdfOverflow = `${overflowPx}`;
          }
          const stillOverflowing = reportPages.filter((page) => page.scrollHeight > page.clientHeight + 2 && getComputedStyle(page).overflow === "hidden");
          if (stillOverflowing.length) {
            throw new Error(`PDF layout overflow on page(s) ${overflowingPages.map((page) => page.index).join(", ")}. Reduce content density before export.`);
          }
        }
        const exportHead = document.head.cloneNode(true) as HTMLHeadElement;
        exportHead.querySelectorAll("script").forEach((script) => script.remove());
        const base = document.createElement("base");
        base.href = `${window.location.origin}/`;
        exportHead?.prepend(base);
        const printPaint = document.createElement("style");
        printPaint.textContent = `
          @page { size: A4; margin: 0; background: #fff; }
          @media print {
            html, body, .${styles.report}, .${styles.pdfPages} { background: #fff !important; }
            body::before { content: ""; position: fixed; inset: 0; z-index: -1; background: #fff; }
            .${styles.page} { box-sizing: border-box !important; background: #fff !important; break-before: page !important; break-after: page !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .${styles.page}:first-child { break-before: auto !important; }
            .${styles.page}:last-child { break-after: auto !important; }
            .${styles.cover} { background: #082a4a !important; }
          }
        `;
        exportHead?.append(printPaint);

        const pageDocuments = [`<!doctype html><html><head>${exportHead.innerHTML}</head><body><main class="${styles.report}"><div class="${styles.pdfPages}">${reportPages.map((page) => page.outerHTML).join("")}</div></main></body></html>`];

        const upload = await fetch("/api/report-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Report-Filename": filename },
          body: JSON.stringify({ pages: pageDocuments }),
        });
        const prepared = await upload.json() as { downloadUrl?: string; error?: string; filename?: string; savedToDownloads?: boolean };
        if (!upload.ok) throw new Error(prepared.error || `Could not prepare the PDF download (${upload.status}).`);
        if (!prepared.downloadUrl) throw new Error("The PDF download link was not returned.");
        const downloadName = prepared.filename || filename;
        flushSync(() => setPreparedDownload({ filename: downloadName, url: prepared.downloadUrl! }));
        const downloadResult = await promptPdfDownload(prepared.downloadUrl, downloadName);
        if (downloadResult === "cancelled") {
          // Keep the prepared download link so the user can retry the save dialog.
          return;
        }
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not refresh the latest Kite session.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const exportRequested = new URLSearchParams(window.location.search).get("export") === "1";
    if (exportRequested && !autoExported.current) {
      autoExported.current = true;
      queueMicrotask(() => void refreshLatest(true));
      return;
    }
    queueMicrotask(() => void refreshLatest());
  }, [refreshLatest]);

  const investmentMailReady = content?.sources.axisResearch.status === "live" && content?.sources.newsletters.status === "live";
  if (!tierAllows(license.tier, "pdf") && !license.author) {
    return <main className={styles.report}>
      <nav className={styles.noPrint}><Link href="/">Back to dashboard</Link><span>PDF is Pro</span></nav>
      <LicenseGate feature="pdf" license={license} title="Investment Brief PDF" />
    </main>;
  }
  if (!snapshot || snapshot.status !== "live" || !investmentMailReady) {
    const authStatus = snapshot?.authStatus;
    const needsAuth = Boolean(
      snapshot?.status === "auth_required"
      || authStatus === "unauthenticated"
      || authStatus === "expired"
      || (snapshot?.authUrl && snapshot?.status !== "partial" && snapshot?.status !== "live"),
    );
    const authUrl = needsAuth
      ? snapshot?.authUrl || "/api/kite/login?force=1&redirect=1"
      : undefined;
    const isPartialSession = snapshot?.status === "partial" || authStatus === "partial";
    const navLabel = refreshing
      ? "Latest Kite session required before PDF generation"
      : needsAuth
        ? "Kite authentication required before PDF generation"
        : isPartialSession
          ? "Complete live Kite snapshot required before PDF generation"
          : snapshot && snapshot.status === "live" && !investmentMailReady
            ? "Current Mail research required before PDF generation"
            : "Latest Kite session required before PDF generation";
    const title = refreshing
      ? "Refreshing Kite and current Mail research"
      : needsAuth
        ? authStatus === "expired"
          ? "Kite session expired — re-authenticate before generating the PDF"
          : "Authenticate Kite before generating the PDF"
        : isPartialSession
          ? "Kite is signed in, but the live snapshot is incomplete"
          : snapshot && snapshot.status === "live" && !investmentMailReady
            ? "Refresh current Mail research"
            : "Fresh live Kite data required before PDF generation";
    const detail = error
      || (needsAuth
        ? (snapshot?.message
          || "Zerodha Kite access tokens expire once per day around 06:00 IST. Complete login, return here, then press Retry.")
        : isPartialSession
          ? (snapshot?.message || `Holdings are available, but ${snapshot?.unavailableSections?.join(", ") || "secondary Kite sections"} must succeed for a full live snapshot.`)
          : snapshot?.message
            || "The printable report remains locked until fresh live holdings and the exact iCloud Axis Research and Newsletters mailboxes are refreshed.");
    const retryLabel = refreshing
      ? "Refreshing"
      : needsAuth
        ? "Retry after login"
        : isPartialSession
          ? "Retry full Kite refresh"
          : "Retry latest session";
    return <main className={styles.report}>
      <nav className={styles.noPrint}><Link href="/">Back to dashboard</Link><span>{navLabel}</span></nav>
      <section className={`${styles.page} ${styles.reportGate}`}>
        <div className={styles.gateIcon}>{refreshing ? <RefreshCw className={styles.spin} size={30}/> : needsAuth ? <LogIn size={30}/> : <RefreshCw size={30}/>}</div>
        <p className={styles.gateEyebrow}>LIVE REPORT CONTROL</p>
        <h1>{title}</h1>
        <p>{detail}</p>
        <div className={styles.gateActions}>
          {authUrl && <a href={authUrl} target="_blank" rel="noreferrer"><LogIn size={16}/> {authStatus === "expired" ? "Re-authenticate Kite" : "Authenticate Kite"} <ExternalLink size={13}/></a>}
          <button type="button" onClick={() => void refreshLatest(true)} disabled={refreshing}><RefreshCw className={refreshing ? styles.spin : ""} size={16}/>{retryLabel}</button>
        </div>
        <small>Zerodha requires a fresh Kite Connect login each trading day (~06:00 IST expiry). That is expected broker behavior, not a dashboard bug. After an explicit token-expired state: Authenticate/Re-auth → complete Zerodha login → Retry. Partial secondary-source failures should be retried or diagnosed without invalidating a valid session.</small>
      </section>
    </main>;
  }

  const { asOf, holdings, portfolio, orders, gtts } = snapshot;
  const reportDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(new Date()).toUpperCase();
  const mailDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${content.investment.analysisDate}T12:00:00+05:30`));
  const signedMoney = (value: number) => `${value >= 0 ? "+" : ""}${inr.format(value)}`;
  const currentSymbols = new Set(holdings.map((holding) => holding.symbol));
  const latestReported = earningsCalendar.filter((event) => event.reported).at(-1);
  const latestPortfolioResult = earningsCalendar.filter((event) => event.reported && currentSymbols.has(event.symbol)).at(-1);
  const kiteBySymbol = new Map(holdings.filter((holding) => holding.price > 0).map((holding) => [holding.symbol, holding.price] as const));
  const completeAxisCalls = completeAxisPicks(content.investment.axisRecommendations, kiteBySymbol, yfinanceBySymbol);
  const mailCalls = dedupeAxisCallsBySymbol(completeAxisCalls)
    .map((call) => ({ symbol: call.symbol, house: `${call.source} / iCloud Axis Research`, rating: call.call, target: call.target, cmp: call.cmp, date: call.date, thesis: call.thesis }));
  const liveAnalystCalls = [...mailCalls, ...analystCalls.filter((call) => !mailCalls.some((axis) => axis.symbol === call.symbol))].flatMap((call) => {
    const kite = kiteBySymbol.get(call.symbol);
    const yf = yfinanceBySymbol.get(call.symbol);
    const sourceCmp = "cmp" in call && typeof call.cmp === "number" ? call.cmp : null;
    const cmp = kite != null && kite > 0 ? kite : yf != null && yf > 0 ? yf : sourceCmp;
    const implied = axisImpliedUpsidePct(call.target, cmp);
    return cmp != null && implied != null ? [{ ...call, cmp, implied }] : [];
  });
  const byOil = holdings.slice().sort((left, right) => right.oil - left.oil);
  const byFlow = holdings.slice().sort((left, right) => right.flow - left.flow);
  const mostOilSensitive = byOil[0];
  const mostInsulated = byOil.at(-1);
  const mostFlowSensitive = byFlow[0];
  const weakestCall = liveAnalystCalls.slice().sort((left, right) => left.implied - right.implied)[0];
  const scoreLabel = (score: number) => score >= 5 ? "Very high" : score >= 4 ? "High" : score >= 3 ? "Medium" : "Low";
  const riskGroups = {
    lower: holdings.filter((holding) => holding.risk.toLowerCase().includes("low")).map((holding) => holding.name),
    medium: holdings.filter((holding) => holding.risk.toLowerCase().includes("medium") && !holding.risk.toLowerCase().includes("low")).map((holding) => holding.name),
    higher: holdings.filter((holding) => holding.risk.toLowerCase().includes("high")).map((holding) => holding.name),
  };
  const analystCallChunks = chunkItems(liveAnalystCalls, 12);
  const podcastEntries = content.podcasts.length
    ? content.podcasts.map((item) => [item.source, item.summary] as const)
    : podcastNotes;
  const podcastChunks = podcastEntries.length <= 4
    ? [podcastEntries]
    : [podcastEntries.slice(0, 4), ...chunkItems(podcastEntries.slice(4), 8)];
  const analystStartPage = 5;
  const earningsPage = analystStartPage + analystCallChunks.length;
  const digestStartPage = earningsPage + 1;
  const sectorPage = digestStartPage + podcastChunks.length;
  const actionPage = sectorPage + 1;

  return <main className={styles.report}>
    <nav className={styles.noPrint}><Link href="/">Back to dashboard</Link><span className={styles.liveStamp}><CheckCircle2 size={15}/> Live Kite · {asOf}</span><button type="button" onClick={() => void refreshLatest(true)} disabled={refreshing}><Download size={15}/>{refreshing ? "Generating report PDF" : "Generate Report PDF"}</button></nav>
    {error && <p className={`${styles.noPrint} ${styles.exportError}`} role="alert">{error}</p>}
    {preparedDownload && <p className={`${styles.noPrint} ${styles.downloadReady}`}><span>Report PDF ready as {preparedDownload.filename}. Choose where to save it if the download dialog is still open.</span><a href={preparedDownload.url} download={preparedDownload.filename} onClick={(event) => { event.preventDefault(); void promptPdfDownload(preparedDownload.url, preparedDownload.filename); }}><Download size={15}/> Download prepared PDF</a></p>}

    <div className={styles.pdfPages} data-pdf-pages>

    <section className={`${styles.page} ${styles.cover}`}>
      <div className={styles.coverTop}><span>PORTFOLIO RESEARCH · {reportDate}</span><b>Fresh Kite session + iCloud Axis Research and Newsletters through {mailDate}</b></div>
      <div className={styles.coverTitle}><p>INVESTMENT BRIEF</p><h1>Portfolio Analysis<br/>Quarter Outlook</h1><h2>Oil, war risk, flows, analyst calls and catalysts</h2></div>
      <div className={styles.coverMetrics}><div><span>Portfolio value</span><b>{inr.format(portfolio.value)}</b></div><div><span>Unrealised P&amp;L</span><b className={portfolio.pnl>=0?styles.pos:styles.neg}>{signedMoney(portfolio.pnl)} · {portfolio.pnlPct>=0?"+":""}{portfolio.pnlPct.toFixed(2)}%</b></div><div><span>Top-two weight</span><b className={styles.warn}>{portfolio.topTwo.toFixed(1)}%</b></div></div>
      <Callout title="Core conclusion">The latest Kite session shows {portfolio.topTwo.toFixed(1)}% in the two largest positions. {mostInsulated?.name ?? "The lowest-oil holding"} is the clearest oil-shock insulator; {mostOilSensitive?.name ?? "the highest-oil holding"} carries the highest second-order sensitivity among current positions. The quarter stance is constructive, with concentration and liquidity as the binding constraints.</Callout>
      <div className={styles.coverFooter}><span>Educational research; not personalised investment advice</span><span>Read-only report · latest Kite session</span></div>
    </section>

    <section className={styles.page}><PageHeader section="Portfolio snapshot" page={2} asOf={asOf}/>
      <h1 className={styles.title}>1. Portfolio at a glance</h1><p className={styles.deck}>{holdings.length} open equity exposures fetched from the latest Kite holdings and deduplicated CNC positions.</p>
      <div className={styles.metricRow}><div><span>Invested</span><b>{inr.format(portfolio.invested)}</b></div><div><span>Current value</span><b>{inr.format(portfolio.value)}</b></div><div><span>P&amp;L</span><b className={portfolio.pnl>=0?styles.pos:styles.neg}>{signedMoney(portfolio.pnl)}</b></div><div><span>Margin</span><b>{inr.format(portfolio.equityMargin)}</b></div></div>
      <div className={styles.twoCol}>
        <div className={`${styles.chartBox} ${styles.nestedChartBox}`}><h3>Nested live portfolio allocation</h3><PrintNestedDonut holdings={holdings} marketCap={snapshot.marketCapAllocation} sectors={snapshot.sectorAllocation} subSectors={snapshot.subSectorAllocation} value={portfolio.value} pnl={portfolio.pnl} pnlPct={portfolio.pnlPct}/><p className={styles.classificationNote}>Verified industry · sub-sector from company disclosures · {snapshot.classification.industrySource} · {snapshot.classification.marketCapSource} · as of {snapshot.classification.asOf}</p></div>
        <div className={styles.chartBox}><h3>Concentration diagnostic</h3>{holdings.map(h=><div className={styles.barRow} key={h.symbol}><span>{h.symbol}</span><div><i style={{width:`${h.weight*2.2}%`,background:h.color}}/></div><b>{h.weight.toFixed(1)}%</b></div>)}<Callout tone="amber" title="Risk flag">ICICI Bank and Eternal together represent {portfolio.topTwo.toFixed(1)}% of current value. Diversification should be achieved primarily through new capital.</Callout></div>
      </div>
      <table className={styles.compactTable}><thead><tr><th>Holding</th><th>Qty</th><th>Avg</th><th>Last</th><th>Value</th><th>P&amp;L</th><th>Weight</th><th>Risk</th></tr></thead><tbody>{holdings.map(h=><tr key={h.symbol}><td><b>{h.name}</b><small>Industry: {h.sector} · Sub-sector: {h.subSector} · AMFI: {h.marketCap}</small></td><td>{h.qty}</td><td>{inr.format(h.avg)}</td><td>{inr.format(h.price)}</td><td>{inr.format(h.value)}</td><td className={h.pnl>=0?styles.pos:styles.neg}>{h.pnl>=0?"+":""}{inr.format(h.pnl)}<small>{h.pnlPct.toFixed(2)}%</small></td><td>{h.weight.toFixed(1)}%</td><td><Risk value={h.risk}/></td></tr>)}</tbody></table>
    </section>

    <section className={styles.page}><PageHeader section="Quarter outlook" page={3} asOf={asOf}/>
      <h1 className={styles.title}>2. Position outlook for the quarter</h1><p className={styles.deck}>Research posture based on earnings durability, valuation sensitivity, macro transmission and portfolio role.</p>
      <table className={styles.roomy}><thead><tr><th>Position</th><th>Quarter view</th><th>What supports it</th><th>What can break</th><th>Framework response</th></tr></thead><tbody>
        {holdings.map((holding) => { const detail = outlookDetails[holding.symbol] ?? { support: holding.stance, breakRisk: "Company-specific execution and valuation risk.", response: "Review against portfolio role after the next result.", insulation: "Position-specific fundamentals" }; return <tr key={holding.symbol}><td><b>{holding.name}</b><small>{holding.weight.toFixed(1)}% · {holding.sector}</small></td><td className={holding.risk.toLowerCase().includes("high")?styles.warn:styles.pos}>{holding.quarter}</td><td>{detail.support}</td><td>{detail.breakRisk}</td><td>{detail.response}</td></tr>; })}
      </tbody></table>
      <div className={styles.threeCol}><Callout tone="green" title="Most insulated">{mostInsulated?.name ?? "n/a"}: lowest current qualitative oil score.</Callout><Callout tone="amber" title="Most flow-sensitive">{mostFlowSensitive?.name ?? "n/a"}: highest current institutional-flow score.</Callout><Callout tone="red" title="Most oil-sensitive">{mostOilSensitive?.name ?? "n/a"}: highest current qualitative oil score.</Callout></div>
      <h2 className={styles.subTitle}>Portfolio risk ladder</h2><div className={styles.riskLadder}><span className={styles.green}>LOWER · {riskGroups.lower.join(" / ") || "None"}</span><span className={styles.amber}>MEDIUM · {riskGroups.medium.join(" / ") || "None"}</span><span className={styles.red}>HIGHER · {riskGroups.higher.join(" / ") || "None"}</span></div>
    </section>

    <section className={styles.page}><PageHeader section="Oil, war and flows" page={4} asOf={asOf}/>
      <h1 className={styles.title}>3. Macro shock map</h1><p className={styles.deck}>The portfolio has limited direct oil revenue exposure; the main channel is India’s import bill, INR, inflation, yields and institutional risk appetite.</p>
      <Callout tone="red" title={`${mailDate} Mail evidence`}>{content.investment.macroEvidence.find((item) => item.key === "oilWar")?.count ?? 0} matching Axis/Newsletter items. Latest: {content.investment.macroEvidence.find((item) => item.key === "oilWar")?.latestTitle ?? "No matching oil/geopolitical evidence in the selected Mail date"}.</Callout>
      <div className={styles.flowChain}><span>Hormuz disruption</span><b>→</b><span>Crude / freight</span><b>→</b><span>INR / inflation</span><b>→</b><span>Yields / FII risk</span><b>→</b><span>Portfolio multiples</span></div>
      <table><thead><tr><th>Holding</th><th>US-Iran</th><th>Oil</th><th>FII/DII</th><th>Insulation</th></tr></thead><tbody>
        {holdings.map((holding) => <tr key={holding.symbol}><td>{holding.name}</td><td>{scoreLabel(Math.max(holding.oil, Math.round((holding.oil + holding.flow) / 2)))}</td><td>{scoreLabel(holding.oil)}</td><td>{scoreLabel(holding.flow)}</td><td>{outlookDetails[holding.symbol]?.insulation ?? "Position-specific fundamentals"}</td></tr>)}
      </tbody></table>
      <h2 className={styles.subTitle}>Scenario matrix</h2><div className={styles.scenarioGrid}>{Object.values(scenarios).map(s=><div className={`${styles.scenarioCard} ${styles[s.tone]}`} key={s.label}><span>{s.oil}</span><h3>{s.label}</h3><p>{s.summary}</p><dl><dt>Leaders</dt><dd>{s.leaders}</dd><dt>Laggards</dt><dd>{s.laggards}</dd><dt>Response</dt><dd>{s.action}</dd></dl></div>)}</div>
      <Callout title="FII/DII context">On 10 July, provisional flows were positive: FII +₹2,603.72 crore and DII +₹2,019.68 crore. NSE Market Pulse shows domestic mutual-fund ownership at a record 11.4%, which cushions volatility but does not eliminate oil-INR drawdown risk.</Callout>
    </section>

    {analystCallChunks.map((calls, chunkIndex) => <section className={styles.page} key={`analyst-${chunkIndex}`}><PageHeader section="Analyst positioning" page={analystStartPage + chunkIndex} asOf={asOf}/>
      <h1 className={styles.title}>{chunkIndex === 0 ? "4. Analyst recommendations" : "4. Analyst recommendations · continued"}</h1><p className={styles.deck}>Targets are expectations anchors. They are not live fair values and can change after results, macro shocks or model revisions. Showing {calls.length} of {liveAnalystCalls.length} complete CMP-and-target calls on this page.</p>
      <table className={styles.roomy}><thead><tr><th>Stock</th><th>House / source</th><th>Rating</th><th>CMP</th><th>Target</th><th>Implied</th><th>Evidence and caveat</th></tr></thead><tbody>{calls.map(a=><tr key={`${a.symbol}-${a.rating}-${a.date}`}><td><b>{a.symbol}</b></td><td>{a.house}<small>{a.date} 2026</small></td><td><span className={`${styles.pill} ${styles.blue}`}>{a.rating}</span></td><td>{a.cmp != null ? inr.format(a.cmp) : "—"}</td><td>{inr.format(a.target)}</td><td className={a.implied>=0?styles.pos:styles.neg}>{a.implied>=0?"+":""}{a.implied.toFixed(1)}%</td><td>{a.thesis}</td></tr>)}</tbody></table>
      {chunkIndex === analystCallChunks.length - 1 && <><div className={styles.twoCol}><Callout title="Price basis">CMP prefers Kite last price when the symbol is held; otherwise a yfinance delayed NSE quote. Implied upside uses that CMP. Em dash only when both quotes are unavailable.</Callout><Callout tone="amber" title="Weakest current target signal">{weakestCall ? `${weakestCall.symbol}: ${weakestCall.implied>=0?"+":""}${weakestCall.implied.toFixed(1)}% implied versus CMP.` : "No analyst target is currently mapped."} Treat targets as expectations anchors, not trade instructions.</Callout></div><Callout tone="blue" title="NSE source role">NSE is the primary source for corporate filings, board meetings, financial results and market/flow data. It does not publish buy/sell recommendations.</Callout></>}
    </section>)}

    <section className={styles.page}><PageHeader section="Catalysts and activity" page={earningsPage} asOf={asOf}/>
      <h1 className={styles.title}>5. Earnings, orders and GTTs</h1><p className={styles.deck}>Catalyst calendar from Apple Calendar; order state from authenticated Kite MCP.</p>
      <div className={styles.calendarHero}><span>{latestPortfolioResult?.day ?? latestReported?.day ?? "—"}</span><div><small>JULY · LATEST VERIFIED PORTFOLIO RESULT</small><h2>{latestPortfolioResult?.name ?? latestReported?.name ?? "No verified result"} {latestPortfolioResult?.period ?? latestReported?.period ?? ""}</h2><p>{latestPortfolioResult?.summary ?? latestReported?.summary ?? "Pending calendar rows remain blank until a verified result is published."}</p></div></div>
      <Callout tone="green" title="Latest earnings evidence">{latestReported ? `${latestReported.name} reported ${latestReported.period} on ${latestReported.date}. ${latestReported.summary ?? "The verified KPI row is included in the dashboard earnings workbench."}` : "No verified reported event is available in the current calendar snapshot."}</Callout>
      <div className={styles.twoCol}><div><h2 className={styles.subTitle}>Latest orders</h2><table><thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Type</th><th>Price</th><th>Status</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td>{o.symbol}</td><td>{o.side}</td><td>{o.qty}</td><td>{o.type}</td><td>{inr.format(o.price)}</td><td><span className={`${styles.pill} ${styles.green}`}>{o.status}</span></td></tr>)}</tbody></table></div><div><h2 className={styles.subTitle}>GTT register</h2><table><thead><tr><th>Symbol</th><th>Qty</th><th>Trigger</th><th>Limit</th><th>Status</th></tr></thead><tbody>{gtts.map(g=><tr key={g.id}><td>{g.symbol}</td><td>{g.qty}</td><td>{inr.format(g.trigger)}</td><td>{inr.format(g.limit)}</td><td><span className={`${styles.pill} ${styles[g.status.toLowerCase()==="active"?"amber":"green"]}`}>{g.status}</span></td></tr>)}</tbody></table></div></div>
      <Callout tone="amber" title="Liquidity constraint">Latest available equity margin is {inr.format(portfolio.equityMargin)}. Any action framework must respect current broker cash and avoid treating analyst upside as deployable capacity.</Callout>
    </section>

    {podcastChunks.map((entries, chunkIndex) => {
      const priorCount = podcastChunks.slice(0, chunkIndex).reduce((sum, chunk) => sum + chunk.length, 0);
      return <section className={styles.page} key={`podcasts-${chunkIndex}`}><PageHeader section="Briefings and podcasts" page={digestStartPage + chunkIndex} asOf={asOf}/>
        <h1 className={styles.title}>{chunkIndex === 0 ? "6. Local research digest" : "6. Podcast library · continued"}</h1><p className={styles.deck}>{chunkIndex === 0 ? `The exact iCloud Axis Research and Newsletters mailboxes were refreshed through ${mailDate} at ${content.asOf}.` : `${podcastEntries.length} eligible local podcast descriptions or transcripts through ${mailDate}.`}</p>
        {chunkIndex === 0 && <div className={styles.mailGrid}>{content.axisResearch.slice(0,2).map((item,index)=><Callout key={`${item.time}-${item.title}`} tone={index===0?"green":"blue"} title={item.title}>{item.summary}</Callout>)}{content.newsletters.slice(0,1).map((item)=><Callout key={`${item.time}-${item.title}`} tone="amber" title={item.title}>{item.summary}</Callout>)}</div>}
        <h2 className={styles.subTitle}>Podcast library through {mailDate}</h2><div className={styles.podcastList}>{entries.map(([name,note],entryIndex)=><div key={`${name}-${priorCount + entryIndex}`}><span>{String(priorCount + entryIndex + 1).padStart(2,"0")}</span><div><b>{name}</b><p>{note}</p></div></div>)}</div>
        {chunkIndex === podcastChunks.length - 1 && <Callout tone="blue" title="Transcript limitation">Podcast summaries use locally available episode descriptions or transcripts. Permission failures remain explicit and are never replaced with fabricated summaries.</Callout>}
      </section>;
    })}

    <section className={styles.page}><PageHeader section="Sectoral Analytics" page={sectorPage} asOf={asOf}/>
      <h1 className={styles.title}>7. Sector impact and market dials</h1><p className={styles.deck}>A compact cross-sector decision matrix. Signals are directional research lenses, not return forecasts; the dashboard contains the linked interactive views.</p>
      <div className={styles.sectorSignalKey}>{Object.values(signalMark).map((signal) => <span key={signal.label} className={styles[signal.tone]}><b>{signal.mark}</b>{signal.label}</span>)}</div>
      <table className={styles.sectorMatrix}><thead><tr><th>Sector / stance</th><th>Sub-sectors</th><th>Crude</th><th>INR</th><th>Rates</th><th>Monsoon</th><th>AI capex</th><th>Earnings</th><th>Current read</th></tr></thead><tbody>{alignSectorImpactRows(sectors).map((row) => <tr key={row.id} style={{"--row-color": row.color} as React.CSSProperties}><td><b>{row.name}</b><small>{row.stance}</small></td><td>{row.subsectors.slice(0,4).join(" · ")}</td>{([row.crude,row.inr,row.rates,row.monsoon,row.aiCapex,row.earnings] as ImpactSignal[]).map((signal,index) => <td key={`${row.id}-${index}`} className={styles[signalMark[signal].tone]} title={signalMark[signal].label}>{signalMark[signal].mark}</td>)}<td>{row.read}</td></tr>)}</tbody></table>
      <div className={styles.sectorDialGrid}>
        <div><h2 className={styles.subTitle}>Macro dials</h2>{macroDials.map((dial) => { const position = (dial.value-dial.min)/(dial.max-dial.min)*100; const trigger = (dial.trigger-dial.min)/(dial.max-dial.min)*100; return <div className={styles.reportDial} key={dial.name}><span>{dial.name}</span><div><i style={{width:`${Math.max(0,Math.min(100,position))}%`}}/><em style={{left:`${Math.max(0,Math.min(100,trigger))}%`}}/></div><b>{dial.unit}{dial.value.toLocaleString("en-IN")}</b><small>Trigger {dial.unit}{dial.trigger.toLocaleString("en-IN")}</small></div>; })}</div>
        <div><h2 className={styles.subTitle}>Squeeze width</h2>{squeezeWidths.map((item) => <div className={styles.reportSqueeze} key={item.name}><span>{item.name}</span><div><i style={{width:`${Math.min(100,item.value/5*100)}%`,background:item.color}}/></div><b>{item.value.toFixed(2)}%</b></div>)}<Callout tone="amber" title="Interpretation">Narrow bands can precede expansion; they describe current compression, not direction. Confirm price, breadth and event evidence before acting.</Callout></div>
      </div>
    </section>

    <section className={styles.page}><PageHeader section="Action framework and sources" page={actionPage} asOf={asOf}/>
      <h1 className={styles.title}>8. Portfolio action framework</h1><p className={styles.deck}>Decision triggers designed to improve concentration, oil resilience and catalyst discipline without issuing trade instructions.</p>
      <table className={styles.roomy}><thead><tr><th>Priority</th><th>Current condition</th><th>Trigger</th><th>Framework response</th></tr></thead><tbody>
        <tr><td><b>1 · Concentration</b></td><td>Top two = {portfolio.topTwo.toFixed(1)}%</td><td>Any new capital</td><td>Direct additions toward differentiated exposure before increasing the largest positions.</td></tr><tr><td><b>2 · Oil</b></td><td>Highest current sensitivity: {mostOilSensitive?.name ?? "n/a"}</td><td>&gt;$90 for two weeks</td><td>Re-underwrite the highest-oil current holding&apos;s margin and valuation assumptions.</td></tr><tr><td><b>3 · Stress</b></td><td>Hormuz unresolved</td><td>Brent &gt;$100 plus INR weakness</td><td>Prioritise liquidity and pause high-beta additions.</td></tr><tr><td><b>4 · Earnings</b></td><td>{latestPortfolioResult?.name ?? "Portfolio holdings"}</td><td>{latestPortfolioResult ? `${latestPortfolioResult.date} result` : "Next verified filing"}</td><td>Focus on reported operating KPIs, guidance and cash conversion before changing conviction.</td></tr><tr><td><b>5 · Flow</b></td><td>Latest Mail and market context</td><td>Persistent FII selling without DII absorption</td><td>Reduce confidence in valuation-driven upside scenarios.</td></tr>
      </tbody></table>
      <h2 className={styles.subTitle}>Source register</h2><div className={styles.sources}>{sources.map((s,i)=><a href={s.url} key={s.url}><span>{i+1}</span>{s.label}</a>)}</div>
      <div className={styles.limitations}><h3>Method and limitations</h3><p>Kite values are a point-in-time broker snapshot. Quote/OHLC endpoints were unavailable, so no intraday history or volatility statistic is claimed. Scenario scores are qualitative analyst judgments, not modelled return forecasts. Public targets were compared with the current Kite price but not normalised for report date or corporate actions. Apple Calendar and Podcasts are user-maintained/local surfaces and may be incomplete.</p><p>This report is educational research only. It does not account for the investor’s income, liabilities, tax profile, time horizon or full asset allocation, and it should not be treated as personalised financial advice.</p></div>
    </section>
    </div>
  </main>;
}
