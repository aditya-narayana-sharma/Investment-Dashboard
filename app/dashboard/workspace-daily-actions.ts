import type { EarningsSnapshot } from "../earnings-live-types.ts";
import type { HealthLiveSnapshot } from "../health-live-types.ts";
import type { KiteSnapshot } from "../live-types.ts";
import type { SectorBenchmarkSnapshot, SectorMarketSnapshot } from "../sector-live-types.ts";
import { aggregateSectorMarketStatus, isUsableSectorMarketStatus } from "../sector-live-types.ts";
import type { StrategyTreeV1 } from "../strategy/graph-types.ts";
import { finalizeDailyActions, SMART_ACTIONS_LABEL } from "./daily-action-policy.ts";
import type { KanbanItem } from "./types.ts";

function unpublishedKpiEventCount(events: EarningsSnapshot["events"]): number {
  return events.filter((event) => event.kpis.some((kpi) => !String(kpi.value ?? "").trim())).length;
}

function kiteIsLive(snapshot: KiteSnapshot): boolean {
  switch (snapshot.status) {
    case "live":
      return true;
    case "partial":
    case "snapshot":
    case "auth_required":
    case "unavailable":
      return false;
    default: {
      const _exhaustive: never = snapshot.status;
      return _exhaustive;
    }
  }
}

function smartCard(
  item: Omit<KanbanItem, "sourceKind" | "sourceLabel" | "numericAdvantage">,
): KanbanItem {
  return {
    ...item,
    sourceKind: "smart",
    sourceLabel: SMART_ACTIONS_LABEL,
    numericAdvantage: SMART_ACTIONS_LABEL,
  };
}

export function buildInvestmentDailyActions(options: {
  snapshot: KiteSnapshot;
  earningsSnapshot: EarningsSnapshot;
}): KanbanItem[] {
  const { snapshot, earningsSnapshot } = options;
  const actions: KanbanItem[] = [];
  const live = kiteIsLive(snapshot);

  if (!live) {
    actions.push(smartCard({
      id: "inv-kite-unavailable",
      title: "Kite values unavailable",
      detail: "Authenticate Kite or Refresh all. Do not act on the last snapshot as live holdings.",
      strategicAdvantage: "Source-honest until Kite is live",
      lane: "today",
      tone: "amber",
    }));
  } else if (snapshot.portfolio.topTwo >= 45) {
    actions.push({
      id: "inv-concentration",
      title: "Review top-two concentration",
      detail: `Largest two live weights total ${snapshot.portfolio.topTwo.toFixed(0)} percent. Dilute before adding more.`,
      numericAdvantage: `${snapshot.portfolio.topTwo.toFixed(1)}% top-two`,
      strategicAdvantage: "Uses live Kite weights only",
      sourceLabel: "Kite",
      sourceKind: "source",
      lane: "today",
      tone: snapshot.portfolio.topTwo >= 65 ? "red" : "amber",
    });
  }

  const blankKpis = unpublishedKpiEventCount(earningsSnapshot.events);
  if (blankKpis > 0) {
    actions.push({
      id: "inv-earnings",
      title: "Keep unpublished KPI fields blank",
      detail: `${blankKpis} tracked events still have empty KPI fields. Fill only after official IR/NSE prints.`,
      numericAdvantage: `${blankKpis} blank KPI events`,
      strategicAdvantage: "Do not invent post-result numbers",
      sourceLabel: "Earnings",
      sourceKind: "source",
      lane: "monitor",
      tone: earningsSnapshot.status === "verified" ? "green" : "amber",
    });
  }

  return finalizeDailyActions(actions);
}

export function buildSectorDailyActions(options: {
  sectorMarket: SectorMarketSnapshot;
  sectorMarketById: Record<string, SectorMarketSnapshot>;
  benchmarks: SectorBenchmarkSnapshot;
  loading?: boolean;
}): KanbanItem[] {
  const snapshots = Object.values(options.sectorMarketById);
  const status = snapshots.length
    ? aggregateSectorMarketStatus(snapshots)
    : options.sectorMarket.status;
  const actions: KanbanItem[] = [];

  if (!options.loading && !isUsableSectorMarketStatus(status)) {
    actions.push({
      id: "sec-breadth",
      title: "Refresh sector breadth and rankings",
      detail: `Sector snapshots are ${status}. Validate prices before using rankings.`,
      numericAdvantage: `${snapshots.length || 0} sector files`,
      strategicAdvantage: "Stale breadth is not leadership",
      sourceLabel: "Sectors",
      sourceKind: "source",
      lane: "today",
      tone: "amber",
    });
  }

  if (options.benchmarks.status !== "live") {
    actions.push({
      id: "sec-kpis",
      title: "Check sector KPI freshness",
      detail: `Benchmarks are ${options.benchmarks.status}. Review each metric’s source date before using it.`,
      numericAdvantage: `${options.benchmarks.indices.length} index rows`,
      strategicAdvantage: "Makes stale evidence visible",
      sourceLabel: "Sectors",
      sourceKind: "source",
      lane: "today",
      tone: "green",
    });
  }

  actions.push({
    id: "sec-framework",
    title: "Run the selected sector through frameworks",
    detail: "Use PESTEL, Porter, life-cycle and structure together on S-3.",
    numericAdvantage: "4 independent lenses",
    strategicAdvantage: "Reduces one-factor conclusions",
    sourceLabel: "Frameworks",
    sourceKind: "source",
    lane: "monitor",
    tone: "amber",
  });

  return finalizeDailyActions(actions);
}

export function buildHealthDailyActions(options: {
  healthSnapshot: HealthLiveSnapshot;
  missingDates: string[];
}): KanbanItem[] {
  const { healthSnapshot, missingDates } = options;
  const actions: KanbanItem[] = [];

  switch (healthSnapshot.status) {
    case "live":
      break;
    case "partial":
    case "cached":
    case "stale":
    case "unavailable":
      actions.push({
        id: "health-sync",
        title: "Verify the operational Health target",
        detail: `Health is ${healthSnapshot.status}. After 8 PM, confirm the newest archive advances the target date.`,
        numericAdvantage: healthSnapshot.targetDate ?? "target unknown",
        strategicAdvantage: "Keeps the record auditable",
        sourceLabel: "Health",
        sourceKind: "source",
        lane: "today",
        tone: healthSnapshot.status === "unavailable" || healthSnapshot.status === "stale" ? "red" : "amber",
      });
      break;
    default: {
      const _exhaustive: never = healthSnapshot.status;
      return _exhaustive;
    }
  }

  if (missingDates.length > 0) {
    const shown = missingDates.slice(0, 3).join(", ");
    actions.push(smartCard({
      id: "health-missing-dates",
      title: "Fill missing Health dates",
      detail: `${missingDates.length} missing date${missingDates.length === 1 ? "" : "s"}: ${shown}${missingDates.length > 3 ? "…" : ""}. Run the Health Shortcut; do not infer values.`,
      strategicAdvantage: "Never invent a missing day",
      lane: "today",
      tone: "amber",
    }));
  }

  const coverage = healthSnapshot.coverage ?? {};
  const incompleteAverages = Object.values(coverage).filter((row) => !row.weekly || !row.monthly).length;
  if (incompleteAverages > 0) {
    actions.push({
      id: "health-averages",
      title: "Reconcile weekly and monthly averages",
      detail: `${incompleteAverages} coverage rows lack a complete 7-day or 30-day window.`,
      numericAdvantage: "7-day + 30-day",
      strategicAdvantage: "Avoids overreading one day",
      sourceLabel: "Health",
      sourceKind: "source",
      lane: "monitor",
      tone: "green",
    });
  }

  return finalizeDailyActions(actions);
}

export function buildBuilderDailyActions(options: { tree: StrategyTreeV1 }): KanbanItem[] {
  const actions: KanbanItem[] = [
    {
      id: "builder-validate",
      title: "Validate the strategy tree",
      detail: "Confirm Weight percents, If/Else operands and the compiled graph.",
      numericAdvantage: "0 invalid trees",
      strategicAdvantage: "Blocks broken logic leaving the canvas",
      sourceLabel: "Canvas",
      sourceKind: "source",
      lane: "today",
      tone: "blue",
    },
    {
      id: "builder-export",
      title: "Export the tree plus compiled graph",
      detail: "Save StrategyTreeV1 with compiled schemaVersion 2 before switching machines.",
      numericAdvantage: "Round-trip identical tree",
      strategicAdvantage: "Protects canvas work",
      sourceLabel: "Canvas",
      sourceKind: "source",
      lane: "monitor",
      tone: "amber",
    },
  ];
  let emptyElse = 0;
  const visit = (nodes: StrategyTreeV1["children"]) => {
    for (const node of nodes) {
      switch (node.kind) {
        case "if_else":
          if (node.else.length === 0) emptyElse += 1;
          visit(node.then);
          visit(node.else);
          break;
        case "weight":
          visit(node.children.map((child) => child.node));
          break;
        case "group":
        case "any_all":
        case "filter":
          visit(node.children);
          break;
        case "asset":
          break;
        default: {
          const _exhaustive: never = node;
          return _exhaustive;
        }
      }
    }
  };
  visit(options.tree.children);
  if (emptyElse > 0) {
    actions.push({
      id: "builder-else",
      title: "Fill or accept an empty ELSE",
      detail: `${emptyElse} If/Else block${emptyElse === 1 ? "" : "s"} have an empty ELSE. THEN can hold assets. Empty ELSE is allowed and warned.`,
      numericAdvantage: `${emptyElse} empty ELSE`,
      strategicAdvantage: "Completes the condition",
      sourceLabel: "Canvas",
      sourceKind: "source",
      lane: "monitor",
      tone: "red",
    });
  }
  return finalizeDailyActions(actions);
}

export function buildStrategiesDailyActions(options: { libraryCount: number } = { libraryCount: 9 }): KanbanItem[] {
  const libraryCount = options.libraryCount;
  return finalizeDailyActions([
    {
      id: "strat-review",
      title: "Review the NSE library trees",
      detail: `Open a card to read the vertical tree before sending it to Canvas. ${libraryCount} published reconstructions.`,
      numericAdvantage: `${libraryCount} NSE ETF trees`,
      strategicAdvantage: "Keeps research on Indian sleeves",
      sourceLabel: "Library",
      sourceKind: "source",
      lane: "today",
      tone: "blue",
    },
    {
      id: "strat-stats",
      title: "Do not treat empty OOS tiles as live alpha",
      detail: "Library KPIs stay em dash until an Indian-market engine run exists.",
      numericAdvantage: "— until ran",
      strategicAdvantage: "Prevents fabricated performance",
      sourceLabel: "Library",
      sourceKind: "source",
      lane: "today",
      tone: "green",
    },
    {
      id: "strat-open",
      title: "Open one tree in Algorithm Canvas",
      detail: "Deep-link a reconstruction into the editor. The library stays read-only.",
      numericAdvantage: "Canvas deep-link",
      strategicAdvantage: "Edits stay on the canvas",
      sourceLabel: "Library",
      sourceKind: "source",
      lane: "monitor",
      tone: "red",
    },
  ]);
}
