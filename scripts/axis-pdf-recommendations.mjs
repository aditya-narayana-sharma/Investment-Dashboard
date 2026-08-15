/** Load Axis PDF-archive recommendations and merge with mail-window calls. */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { companySymbols, recommendationRiskScores, recommendationSymbol, scopeThesisToCompany } from "./axis-recommendations.mjs";

const DEFAULT_SNAPSHOT = fileURLToPath(new URL("../artifacts/private/axis-pdf-recommendations.json", import.meta.url));

const recommendationColors = ["#4c8fff", "#42c878", "#b38cff", "#ff7f6e", "#21b5c5", "#e3b844", "#f08bd3", "#79a7ff"];

function recommendationBucket(item) {
  if (item.bucket === "technical" || item.bucket === "trading" || item.bucket === "fundamental") {
    return item.bucket;
  }
  const call = String(item.call ?? "").toUpperCase();
  const horizon = String(item.horizon ?? "").toLowerCase();
  if (call.includes("TECHNICAL") || horizon.includes("technical")) return "technical";
  if (call.includes("TRADING") || horizon.includes("punch")) return "trading";
  return "fundamental";
}

function dedupeKey(item) {
  return `${item.symbol}|${recommendationBucket(item)}`;
}

function dateRank(item) {
  if (!item.dateKey) return 0;
  return Number(String(item.dateKey).replaceAll("-", "")) || 0;
}

function richness(item, origin) {
  return (item.cmp ? 4 : 0) + (item.target ? 4 : 0) + (origin === "pdf" ? 1 : 0) + dateRank(item) / 1e8;
}

function bucketPriority(bucket) {
  switch (bucket) {
    case "trading":
      return 3;
    case "technical":
      return 2;
    case "fundamental":
      return 1;
    default:
      return 0;
  }
}

function normalizeCallFamily(call) {
  const upper = String(call ?? "").toUpperCase();
  if (upper.includes("TECHNICAL")) return "technical";
  if (upper.includes("TRADING")) return "trading";
  return "plain";
}

function preferCall(next, prev) {
  const nextBucket = recommendationBucket(next);
  const prevBucket = recommendationBucket(prev);
  if (bucketPriority(nextBucket) !== bucketPriority(prevBucket)) {
    return bucketPriority(nextBucket) > bucketPriority(prevBucket);
  }
  const nextDate = dateRank(next);
  const prevDate = dateRank(prev);
  if (nextDate !== prevDate) return nextDate > prevDate;
  return richness(next, next.origin) >= richness(prev, prev.origin);
}

function logicalCallKey(item) {
  const call = String(item.call ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  const target = item.target == null ? "" : String(item.target);
  const published = item.dateKey ?? item.date ?? "";
  return `${item.symbol}|${call}|${target}|${published}|${recommendationBucket(item)}`;
}

function nearDuplicateKey(item) {
  const target = item.target == null ? "" : String(item.target);
  const published = item.dateKey ?? item.date ?? "";
  return `${item.symbol}|${target}|${published}`;
}

/**
 * Exact key: symbol + call + target + published date (+ bucket).
 * Near-dup: BUY vs TRADING BUY with same symbol/target/date → keep trading.
 */
export function collapseNearDuplicateAxisCalls(recommendations = []) {
  const exact = new Map();
  for (const item of recommendations) {
    if (!item?.symbol || !item?.call) continue;
    const next = { ...item, bucket: recommendationBucket(item) };
    const key = logicalCallKey(next);
    const prev = exact.get(key);
    if (!prev || preferCall(next, prev)) exact.set(key, next);
  }

  const near = new Map();
  for (const item of exact.values()) {
    const key = nearDuplicateKey(item);
    const prev = near.get(key);
    if (!prev) {
      near.set(key, item);
      continue;
    }
    const prevFamily = normalizeCallFamily(prev.call);
    const nextFamily = normalizeCallFamily(item.call);
    const buyLikePair =
      (prevFamily === "plain" && nextFamily === "trading")
      || (prevFamily === "trading" && nextFamily === "plain");
    if (buyLikePair) {
      near.set(key, nextFamily === "trading" ? item : prev);
      continue;
    }
    if (preferCall(item, prev)) near.set(key, item);
  }

  return [...near.values()].sort(
    (left, right) => String(right.dateKey ?? "").localeCompare(String(left.dateKey ?? ""))
      || left.symbol.localeCompare(right.symbol)
      || bucketPriority(recommendationBucket(right)) - bucketPriority(recommendationBucket(left)),
  );
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
      targetAchievements: [],
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
    targetAchievements: raw.targetAchievements ?? [],
    missing: false,
    path,
  };
}

export function mergeAxisTargetAchievements({ pdfAchievements = [], mailAchievements = [], limit = 200 } = {}) {
  const merged = new Map();
  for (const item of [...pdfAchievements, ...mailAchievements]) {
    if (!item?.symbol || !/target achieved|book(?:ed)? profits?|closed \+?\d/i.test(`${item.call ?? ""} ${item.thesis ?? ""} ${item.source ?? ""}`)) continue;
    const evidence = `${item.name ?? ""} ${item.thesis ?? ""}`.toLowerCase();
    const knownCompany = companySymbols.find(([name]) => evidence.includes(name.toLowerCase()));
    const canonicalName = knownCompany?.[0] ?? String(item.name ?? "").trim();
    const canonicalSymbol = knownCompany?.[1] ?? (canonicalName ? recommendationSymbol(canonicalName) : item.symbol);
    const next = {
      ...item,
      name: canonicalName,
      symbol: canonicalSymbol,
      call: "TARGET ACHIEVED",
      evidenceFile: item.evidenceFile ?? item.sourceFile ?? null,
      origin: item.origin ?? (item.evidenceFile || item.sourceFile ? "pdf" : "mail"),
    };
    const key = `${next.symbol}|${next.dateKey ?? next.date ?? ""}`;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, next);
    } else if (next.origin === "mail" && prev.origin !== "mail") {
      merged.set(key, {
        ...prev,
        ...next,
        evidenceFile: next.evidenceFile ?? prev.evidenceFile ?? null,
        origin: "mail",
      });
    }
  }
  return [...merged.values()]
    .sort((left, right) => String(right.dateKey ?? right.date ?? "").localeCompare(String(left.dateKey ?? left.date ?? "")) || left.symbol.localeCompare(right.symbol))
    .slice(0, limit);
}

/**
 * PDF archive is primary for Axis Recommended Stocks; mail fills gaps / same-day updates.
 * Dedupes by symbol + Fundamental/Technical/Trading bucket (richer + newer wins),
 * then collapses BUY vs TRADING BUY near-duplicates that share symbol/target/date.
 */
export function mergeAxisRecommendations({ pdfRecommendations = [], mailRecommendations = [], limit = 200 } = {}) {
  const merged = new Map();

  const consider = (item, origin) => {
    if (!item?.symbol || !item?.call) return;
    // A recommendation without an explicit positive Axis target is research
    // context, not a displayable Axis pick.
    if (!(Number(item.target) > 0)) return;
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
    if (!prev || preferCall(next, prev)) {
      merged.set(key, next);
    }
  };

  for (const item of pdfRecommendations) consider(item, "pdf");
  for (const item of mailRecommendations) consider(item, "mail");

  return collapseNearDuplicateAxisCalls([...merged.values()])
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
