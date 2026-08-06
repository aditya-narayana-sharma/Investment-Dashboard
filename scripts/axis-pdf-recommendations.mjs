/** Load Axis PDF-archive recommendations and merge with mail-window calls. */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { recommendationRiskScores, recommendationSymbol, scopeThesisToCompany } from "./axis-recommendations.mjs";

const DEFAULT_SNAPSHOT = fileURLToPath(new URL("../artifacts/private/axis-pdf-recommendations.json", import.meta.url));

const recommendationColors = ["#4c8fff", "#42c878", "#b38cff", "#ff7f6e", "#21b5c5", "#e3b844", "#f08bd3", "#79a7ff"];

function recommendationBucket(item) {
  const call = String(item.call ?? "").toUpperCase();
  const horizon = String(item.horizon ?? "").toLowerCase();
  if (item.bucket === "technical" || call.includes("TECHNICAL") || horizon.includes("technical")) return "technical";
  if (item.bucket === "trading" || call.includes("TRADING") || horizon.includes("punch")) return "trading";
  return "fundamental";
}

function dedupeKey(item) {
  return `${item.symbol}|${recommendationBucket(item)}`;
}

function richness(item, origin) {
  const dateNum = item.dateKey ? Number(String(item.dateKey).replaceAll("-", "")) : 0;
  return (item.cmp ? 4 : 0) + (item.target ? 4 : 0) + (origin === "pdf" ? 1 : 0) + dateNum / 1e8;
}

function toMailRecommendation(row, index = 0) {
  const call = String(row.call ?? "BUY").toUpperCase();
  const name = row.name ?? row.symbol;
  const symbol = row.symbol ?? recommendationSymbol(name);
  const target = row.target == null ? null : Number(row.target);
  const cmp = row.cmp == null ? null : Number(row.cmp);
  const thesis = row.thesis || scopeThesisToCompany(`${name}: ${call}`, name, { call, target });
  return {
    symbol,
    name,
    call,
    target: Number.isFinite(target) && target > 0 ? target : null,
    cmp: Number.isFinite(cmp) && cmp > 0 ? cmp : null,
    upside: "—",
    horizon: row.horizon || "Axis PDF report",
    source: row.source || "Axis PDF",
    date: row.date || "Axis PDF",
    thesis,
    color: recommendationColors[index % recommendationColors.length],
    scores: row.scores ?? recommendationRiskScores(symbol, `${thesis} ${call}`),
    evidenceFile: row.sourceFile ?? row.evidenceFile ?? null,
    dateKey: row.dateKey ?? null,
    bucket: recommendationBucket({ ...row, call }),
  };
}

export function loadAxisPdfRecommendationSnapshot(path = process.env.AXIS_PDF_RECOMMENDATIONS_PATH ?? DEFAULT_SNAPSHOT) {
  if (!existsSync(path)) {
    return {
      asOf: null,
      archivePath: null,
      filesAttempted: 0,
      filesScanned: 0,
      validPdfs: 0,
      pagesRead: 0,
      invalidFiles: [],
      recommendations: [],
      counts: { total: 0, fundamental: 0, technical: 0, trading: 0, withCmpAndTarget: 0, missingProgressInputs: 0 },
      missing: true,
      path,
    };
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const rows = raw.recommendations ?? [];
  const recommendations = rows.map((row, index) => toMailRecommendation(row, index));
  return {
    ...raw,
    recommendations,
    missing: false,
    path,
  };
}

/**
 * PDF archive is primary for Axis Recommended Stocks; mail fills gaps / same-day updates.
 * Dedupes by symbol + Fundamental/Technical/Trading bucket (richer + newer wins).
 */
export function mergeAxisRecommendations({ pdfRecommendations = [], mailRecommendations = [], limit = 200 } = {}) {
  const merged = new Map();

  const consider = (item, origin) => {
    if (!item?.symbol || !item?.call) return;
    if (/hit stop loss|book profits|call closure|closed the call|target achieved/i.test(`${item.thesis ?? ""} ${item.horizon ?? ""} ${item.source ?? ""}`)) {
      return;
    }
    const next = {
      ...item,
      origin,
      evidenceFile: item.evidenceFile ?? null,
      dateKey: item.dateKey ?? null,
      bucket: recommendationBucket(item),
    };
    const key = dedupeKey(next);
    const prev = merged.get(key);
    if (!prev || richness(next, origin) >= richness(prev, prev.origin)) {
      merged.set(key, next);
    }
  };

  for (const item of pdfRecommendations) consider(item, "pdf");
  for (const item of mailRecommendations) consider(item, "mail");

  return [...merged.values()]
    .sort((left, right) => String(right.dateKey ?? "").localeCompare(String(left.dateKey ?? "")) || left.symbol.localeCompare(right.symbol))
    .slice(0, limit)
    .map((item, index) => ({
      ...item,
      color: recommendationColors[index % recommendationColors.length],
    }));
}

export function axisPdfAuditFromSnapshot(snapshot) {
  return {
    filesAttempted: snapshot.filesAttempted ?? 0,
    validPdfs: snapshot.validPdfs ?? 0,
    pagesRead: snapshot.pagesRead ?? 0,
    duplicateGroups: 0,
    invalidFiles: snapshot.invalidFiles ?? [],
    recommendations: snapshot.counts?.total ?? snapshot.recommendations?.length ?? 0,
    withCmpAndTarget: snapshot.counts?.withCmpAndTarget ?? null,
    missingProgressInputs: snapshot.counts?.missingProgressInputs ?? null,
    asOf: snapshot.asOf ?? null,
  };
}
