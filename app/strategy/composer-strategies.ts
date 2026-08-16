/**
 * Composer.trade logic adapted onto Nifty 500 equities (as-of 2026-08-16).
 * Block structure follows the public How-it-works pages; every leaf is an NSE Nifty 500 name.
 * Published US/Nasdaq OOS figures are not shown — those books are not this market.
 */
import { formatTickerName, nifty500Name } from "./builder-universe";
import type { ComparatorOp } from "./graph-types";
import type {
  AssetNode,
  FilterNode,
  GroupNode,
  IfElseNode,
  StrategyTreeV1,
  TreeNode,
  TreeOperand,
  WeightChild,
  WeightNode,
} from "./strategy-tree";

export const COMPOSER_RESEARCH_AS_OF = "2026-08-16";
export const COMPOSER_CATALOG_URL = "https://www.composer.trade/trading-strategies";

/** Official NSE Nifty 500 sleeves used in place of the old India ETF reconstruction. */
export const NSE_SLEEVE = {
  market: "RELIANCE",
  it: "TCS",
  bank: "HDFCBANK",
  defensive: "HINDUNILVR",
  metal: "HINDALCO",
  cash: "ITC",
  bond: "POWERGRID",
  pharma: "SUNPHARMA",
  junior: "BEL",
  infra: "LT",
  market2: "INFY",
} as const;

export type ComposerPublishedStats = {
  oosStart?: string;
  cumulativeReturnPct?: number;
  annualizedReturnPct?: number;
  sharpe?: number;
  maxDrawdownPct?: number;
  stdevPct?: number;
  calmar?: number;
  trailing1mPct?: number;
  trailing3mPct?: number;
  trailing1yPct?: number;
  rebalance?: "day" | "";
  source?: "yfinance";
  asOf?: string;
  unavailableReason?: string;
};

export type ComposerStrategyCard = {
  id: string;
  name: string;
  description: string;
  sourceUrl: string;
  asOf: string;
  marketNote: string;
  reconstructionNote: string;
  mappingNote: string;
  categories: string[];
  stats: ComposerPublishedStats;
  tree: StrategyTreeV1;
};

export const COMPOSER_UNRECONSTRUCTED: Array<{ name: string; sourceUrl: string; reason: string }> = [
  {
    name: "Pals Minor Spell of Summon Money",
    sourceUrl: "https://www.composer.trade/trading-strategies/pals-minor-spell-of-summon-money-gtOlKCViWEiqAFyZeB6N",
    reason: "Public page lists 58 assets and only a high-level switcher summary — no reconstructable sleeve tree.",
  },
  {
    name: "SOXX Group",
    sourceUrl: "https://www.composer.trade/trading-strategies/soxx-group-7PBSP926Mp40r6bPnP0j",
    reason: "Page names SMH as thermometer and SOXL/SOXS sleeves but does not publish drop/spike thresholds.",
  },
  {
    name: "V0.1 Minimal BB / Simple Beta Baller Signal",
    sourceUrl: "https://www.composer.trade/trading-strategies/v01-minimal-bb-simple-beta-baller-signal-v94Yev6XJISMNZPAcWFL",
    reason: "Bond-signal and beaten-down selection rules are described qualitatively only.",
  },
  {
    name: "Inside Nancy Pelosi's Chips- V3",
    sourceUrl: "https://www.composer.trade/trading-strategies/inside-nancy-pelosis-chips-v3-HgK8mCeBnH4fQFNcfZ7q",
    reason: "Listing stats only; individual page was not reconstructed into a public tree.",
  },
];

const AS_OF = COMPOSER_RESEARCH_AS_OF;
const IN_NOTE = "Nifty 500 equity sleeves only (RELIANCE, TCS, HDFCBANK, INFY, ITC, and other official NSE constituent names). No US/Nasdaq tickers. India has no 3x or inverse products — those Composer sleeves become the unlevered Indian analog or a defensive name.";
const RECON_NOTE = "Composer How-it-works logic adapted onto Nifty 500 equities. Not a live Kite portfolio, not a Composer Symphony export, and not the published US backtest.";
const RSI_MAP = "Composer pages that name a 10-day RSI are mapped to registry kpiId rsi_14 (no rsi_10 in the 128-KPI catalog). 10-day relative strength uses roc_12.";
const UNRUN_STATS: ComposerPublishedStats = {};

function requireNifty500(symbol: string): string {
  const name = nifty500Name(symbol);
  if (!name) throw new Error(`${symbol} is not in the NSE Nifty 500 constituent cache.`);
  return name;
}

function kpi(kpiId: string, symbol: string): TreeOperand {
  requireNifty500(symbol);
  return { type: "kpi", kpiId, symbol };
}

function num(value: number): TreeOperand {
  return { type: "number", value };
}

function asset(id: string, symbol: string, extra?: string): AssetNode {
  const name = requireNifty500(symbol);
  return { id, kind: "asset", label: extra ?? formatTickerName(symbol, name), params: { symbol }, children: [] };
}

function group(id: string, label: string, children: TreeNode[]): GroupNode {
  return { id, kind: "group", label, params: {}, children };
}

function weight(id: string, children: WeightChild[], label?: string): WeightNode {
  return { id, kind: "weight", label, params: { method: "specified" }, children };
}

function sleeve(percent: number, node: TreeNode): WeightChild {
  return { percent, node };
}

function ifElse(
  id: string,
  left: TreeOperand,
  op: ComparatorOp,
  right: TreeOperand,
  thenNodes: TreeNode[],
  elseNodes: TreeNode[],
  label?: string,
): IfElseNode {
  return { id, kind: "if_else", label, params: { left, op, right }, then: thenNodes, else: elseNodes };
}

function filter(id: string, symbols: string[], children: TreeNode[], label?: string): FilterNode {
  for (const symbol of symbols) requireNifty500(symbol);
  return { id, kind: "filter", label, params: { assetClasses: ["Equity"], symbols }, children };
}

function strongerOf(id: string, leftSymbol: string, rightSymbol: string, leftNode: TreeNode, rightNode: TreeNode, label?: string): IfElseNode {
  return ifElse(id, kpi("roc_12", leftSymbol), ">", kpi("roc_12", rightSymbol), [leftNode], [rightNode], label);
}

function treeDoc(id: string, name: string, description: string, children: TreeNode[]): StrategyTreeV1 {
  return {
    treeVersion: "1",
    id,
    name,
    description,
    interval: "day",
    createdAt: `${AS_OF}T00:00:00+05:30`,
    updatedAt: `${AS_OF}T00:00:00+05:30`,
    children,
  };
}

function holyGrailLogic(prefix: string, includeCash: boolean): TreeNode {
  const logic = ifElse(
    `${prefix}-trend`,
    kpi("close", NSE_SLEEVE.market),
    ">",
    kpi("sma_200", NSE_SLEEVE.market),
    [
      ifElse(
        `${prefix}-heat`,
        kpi("rsi_14", NSE_SLEEVE.market),
        ">",
        num(79),
        [asset(`${prefix}-gold`, NSE_SLEEVE.defensive)],
        [asset(`${prefix}-nifty`, NSE_SLEEVE.market)],
        `IF RSI(${NSE_SLEEVE.market}) > 79 → ${NSE_SLEEVE.defensive} else ${NSE_SLEEVE.market}`,
      ),
    ],
    [
      ifElse(
        `${prefix}-it`,
        kpi("rsi_14", NSE_SLEEVE.market),
        "<",
        num(31),
        [asset(`${prefix}-it-sleeve`, NSE_SLEEVE.it)],
        [
          ifElse(
            `${prefix}-it-oversold`,
            kpi("rsi_14", NSE_SLEEVE.it),
            "<",
            num(30),
            [asset(`${prefix}-it-bounce`, NSE_SLEEVE.it)],
            [
              ifElse(
                `${prefix}-below20`,
                kpi("close", NSE_SLEEVE.market),
                "<",
                kpi("sma_20", NSE_SLEEVE.market),
                [
                  strongerOf(
                    `${prefix}-hedge`,
                    NSE_SLEEVE.cash,
                    NSE_SLEEVE.bond,
                    asset(`${prefix}-liquid`, NSE_SLEEVE.cash),
                    asset(`${prefix}-gilt`, NSE_SLEEVE.bond),
                    `Stronger of ${NSE_SLEEVE.cash} vs ${NSE_SLEEVE.bond} (roc_12)`,
                  ),
                ],
                [asset(`${prefix}-nifty-resume`, NSE_SLEEVE.market)],
                `IF ${NSE_SLEEVE.market} < SMA 20 → hedge else ${NSE_SLEEVE.market}`,
              ),
            ],
            `IF RSI(${NSE_SLEEVE.it}) < 30 → ${NSE_SLEEVE.it}`,
          ),
        ],
        `IF RSI(${NSE_SLEEVE.market}) < 31 → ${NSE_SLEEVE.it}`,
      ),
    ],
    `IF ${NSE_SLEEVE.market} > SMA 200`,
  );
  if (!includeCash) return logic;
  return weight(`${prefix}-cash-split`, [
    sleeve(80, logic),
    sleeve(20, asset(`${prefix}-cash`, NSE_SLEEVE.cash, `${formatTickerName(NSE_SLEEVE.cash)} · cash sleeve (~20% as published)`)),
  ], "80% logic / 20% cash");
}

const HOLY_GRAIL: ComposerStrategyCard = {
  id: "holy-grail",
  name: "The Holy Grail",
  description: `RELIANCE trend sleeve: HINDUNILVR when RSI is hot, TCS on oversold, and ITC vs POWERGRID when Reliance is below its 20-day average.`,
  sourceUrl: "https://www.composer.trade/trading-strategies/the-holy-grail-MmQbpf2U5TMQFmr9Nt2e",
  asOf: AS_OF,
  marketNote: IN_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: `${RSI_MAP} TQQQ→RELIANCE, UVXY→HINDUNILVR, TECL/SOXL→TCS, SQQQ→ITC, BSV→POWERGRID. No 3x/inverse on NSE.`,
  categories: ["Trend/momentum", "Nifty 500", "Reliance", "Defensive hedge"],
  stats: UNRUN_STATS,
  tree: treeDoc("holy-grail", "The Holy Grail", "Nifty 500 adaptation of The Holy Grail.", [holyGrailLogic("holy", true)]),
};

const HOLIER_GRAIL: ComposerStrategyCard = {
  id: "holier-grail",
  name: "The Holier Grail (NMB Cleaned)",
  description: "Holy Grail sibling on Nifty 500: RELIANCE uptrend unless RSI>79 (HINDUNILVR); otherwise oversold TCS or the stronger of ITC vs POWERGRID.",
  sourceUrl: "https://www.composer.trade/trading-strategies/the-holier-grail-nmb-cleaned-QNYVjfpD6XdMVEdDHAIN",
  asOf: AS_OF,
  marketNote: IN_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: `${RSI_MAP} Same Nifty 500 map as Holy Grail. No 20% cash sleeve on this page.`,
  categories: ["Trend-following", "Momentum", "Nifty 500", "Defensive hedge"],
  stats: UNRUN_STATS,
  tree: treeDoc("holier-grail", "The Holier Grail (NMB Cleaned)", "Nifty 500 adaptation of The Holier Grail (NMB Cleaned).", [holyGrailLogic("holier", false)]),
};

const SIMONS_KMLM: ComposerStrategyCard = {
  id: "simons-kmlm",
  name: "Simons KMLM switcher (single pops) V2",
  description: "Event-driven Nifty 500 switcher: HINDUNILVR when Reliance/TCS look hot, TCS/SUNPHARMA bounce when cold, otherwise TCS vs HINDALCO into the weaker growth names or ITC vs POWERGRID.",
  sourceUrl: "https://www.composer.trade/trading-strategies/simons-kmlm-switcher-single-pops-bt-41322-ar-466-dd-22-v2-u5iBJE751BM5FKPRJvKf",
  asOf: AS_OF,
  marketNote: IN_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: `${RSI_MAP} SPY→RELIANCE, TECL/SOXL/SPXL→TCS/RELIANCE, LABU→SUNPHARMA, UVXY/SVIX→HINDUNILVR, QQQE→TCS, KMLM→HINDALCO, SQQQ→ITC, TLT→POWERGRID.`,
  categories: ["Tactical", "Nifty 500", "Defensive timing", "Diversifier"],
  stats: UNRUN_STATS,
  tree: treeDoc("simons-kmlm", "Simons KMLM switcher V2", "Nifty 500 adaptation of Simons KMLM switcher V2.", [
    ifElse(
      "simons-hot-gate",
      kpi("rsi_14", NSE_SLEEVE.market),
      ">",
      num(80),
      [asset("simons-gold-nifty", NSE_SLEEVE.defensive)],
      [
        ifElse(
          "simons-hot-or",
          kpi("rsi_14", NSE_SLEEVE.it),
          ">",
          num(80),
          [asset("simons-gold-it", NSE_SLEEVE.defensive)],
          [
            ifElse(
              "simons-cold",
              kpi("rsi_14", NSE_SLEEVE.it),
              "<",
              num(30),
              [
                filter("simons-bounce", [NSE_SLEEVE.it, NSE_SLEEVE.market, NSE_SLEEVE.pharma, NSE_SLEEVE.junior], [
                  group("simons-bounce-group", "Washed-out bounce basket", [
                    asset("simons-it", NSE_SLEEVE.it),
                    asset("simons-nifty", NSE_SLEEVE.market),
                    asset("simons-pharma", NSE_SLEEVE.pharma),
                    asset("simons-junior", NSE_SLEEVE.junior),
                  ]),
                ], `Filter bounce names (${NSE_SLEEVE.it} / ${NSE_SLEEVE.market} / ${NSE_SLEEVE.pharma} / ${NSE_SLEEVE.junior})`),
              ],
              [
                ifElse(
                  "simons-tech-kmlm",
                  kpi("roc_12", NSE_SLEEVE.it),
                  ">",
                  kpi("roc_12", NSE_SLEEVE.metal),
                  [
                    filter("simons-weak-2", [NSE_SLEEVE.it, NSE_SLEEVE.junior, NSE_SLEEVE.defensive], [
                      group("simons-weak-group", `2 weakest of ${NSE_SLEEVE.it} / ${NSE_SLEEVE.junior} / ${NSE_SLEEVE.defensive}`, [
                        asset("simons-w-it", NSE_SLEEVE.it),
                        asset("simons-w-junior", NSE_SLEEVE.junior),
                        asset("simons-w-gold", NSE_SLEEVE.defensive),
                      ]),
                    ], "Filter: 2 weakest (select-N not in tree params — label only)"),
                  ],
                  [
                    strongerOf(
                      "simons-defensive",
                      NSE_SLEEVE.cash,
                      NSE_SLEEVE.bond,
                      asset("simons-liquid", NSE_SLEEVE.cash),
                      asset("simons-gilt", NSE_SLEEVE.bond),
                      `Stronger of ${NSE_SLEEVE.cash} vs ${NSE_SLEEVE.bond}`,
                    ),
                  ],
                  `IF ${NSE_SLEEVE.it} roc_12 > ${NSE_SLEEVE.metal} roc_12`,
                ),
              ],
              `IF RSI(${NSE_SLEEVE.it}) < 30 → bounce basket`,
            ),
          ],
          `IF RSI(${NSE_SLEEVE.it}) > 80 → ${NSE_SLEEVE.defensive}`,
        ),
      ],
      `IF RSI(${NSE_SLEEVE.market}) > 80 → ${NSE_SLEEVE.defensive}`,
    ),
  ]),
};

const INVERSE_BETA_BALLER: ComposerStrategyCard = {
  id: "inverse-beta-baller",
  name: "Inverse of [DEV] Beta Baller v0.21",
  description: "Daily ITC-vs-POWERGRID regime: if cash-like ITC leads, buy HINDUNILVR when Reliance RSI>76 else TCS; if POWERGRID leads, hold the stronger of HINDUNILVR vs ITC.",
  sourceUrl: "https://www.composer.trade/trading-strategies/inverse-of-dev-beta-baller-v021-deez-oct22-0hwHbRPQjoOk0XV3zrEa",
  asOf: AS_OF,
  marketNote: IN_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: `${RSI_MAP} BIL→ITC, BND→POWERGRID, SPY→RELIANCE, UVXY/VIXY→HINDUNILVR, SOXL→TCS, SOXS→HINDUNILVR (no inverse IT product).`,
  categories: ["Tactical", "Daily rebalance", "Defensive", "IT"],
  stats: { ...UNRUN_STATS, rebalance: "day" },
  tree: treeDoc("inverse-beta-baller", "Inverse Beta Baller v0.21", "Nifty 500 adaptation of Inverse Beta Baller v0.21.", [
    ifElse(
      "ibb-regime",
      kpi("roc_12", NSE_SLEEVE.cash),
      ">",
      kpi("roc_12", NSE_SLEEVE.bond),
      [
        ifElse(
          "ibb-nifty-hot",
          kpi("rsi_14", NSE_SLEEVE.market),
          ">",
          num(76),
          [
            filter("ibb-defensive", [NSE_SLEEVE.defensive, NSE_SLEEVE.metal], [
              strongerOf(
                "ibb-metal-pick",
                NSE_SLEEVE.metal,
                NSE_SLEEVE.defensive,
                asset("ibb-silver", NSE_SLEEVE.metal, "More beaten-down metal name"),
                asset("ibb-gold", NSE_SLEEVE.defensive, "More beaten-down defensive name"),
                "Whichever name looks more beaten-down (lower roc_12)",
              ),
            ], "80% defensive sleeve as published — remainder not named"),
          ],
          [asset("ibb-it", NSE_SLEEVE.it)],
          `IF RSI(${NSE_SLEEVE.market}) > 76 → ${NSE_SLEEVE.defensive} or ${NSE_SLEEVE.metal}`,
        ),
      ],
      [
        strongerOf(
          "ibb-gold-liquid",
          NSE_SLEEVE.defensive,
          NSE_SLEEVE.cash,
          asset("ibb-gold-def", NSE_SLEEVE.defensive),
          asset("ibb-liquid", NSE_SLEEVE.cash),
          `Stronger of ${NSE_SLEEVE.defensive} vs ${NSE_SLEEVE.cash} (page: last 3 days; mapped to roc_12)`,
        ),
      ],
      `IF ${NSE_SLEEVE.cash} stronger than ${NSE_SLEEVE.bond}`,
    ),
  ]),
};

const RAMS_SOXX: ComposerStrategyCard = {
  id: "rams-soxx",
  name: "Ram's SOXX",
  description: "Single-name daily flip: if TCS rose more than about 2.5% yesterday, hold ITC; otherwise hold TCS.",
  sourceUrl: "https://www.composer.trade/trading-strategies/rams-soxx-SkTp0zaQZb8sdGOs8YS7",
  asOf: AS_OF,
  marketNote: IN_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: "SOXX/SOXL→TCS, SOXS→ITC (no inverse IT product on NSE). Yesterday’s change is log_return(TCS) > 0.025.",
  categories: ["IT", "Mean reversion", "Daily switching", "Nifty 500"],
  stats: { ...UNRUN_STATS, rebalance: "day" },
  tree: treeDoc("rams-soxx", "Ram's SOXX", "Nifty 500 adaptation of Ram's SOXX.", [
    ifElse(
      "rams-it-move",
      kpi("log_return", NSE_SLEEVE.it),
      ">",
      num(0.025),
      [asset("rams-liquid", NSE_SLEEVE.cash)],
      [asset("rams-it", NSE_SLEEVE.it)],
      `IF ${NSE_SLEEVE.it} log_return > 2.5% → ${NSE_SLEEVE.cash} else ${NSE_SLEEVE.it}`,
    ),
  ]),
};

const KMLM_ORIGINAL: ComposerStrategyCard = {
  id: "kmlm-switcher-original",
  name: "KMLM Switcher of Simon97 - Original",
  description: "Same public skeleton as Simons V2 on Nifty 500: HINDUNILVR on heat, Reliance/TCS bounce when cold, otherwise TCS vs HINDALCO into risk-on mean-reversion or ITC/POWERGRID.",
  sourceUrl: "https://www.composer.trade/trading-strategies/kmlm-switcher-of-simon97-original-syMn9OgFREE0wo8LtYsG",
  asOf: AS_OF,
  marketNote: IN_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: `${RSI_MAP} Same Nifty 500 map as Simons V2. KMLM→HINDALCO is a metals diversifier, not managed futures.`,
  categories: ["RSI mean-reversion", "Metals signal", "Nifty 500"],
  stats: UNRUN_STATS,
  tree: treeDoc("kmlm-switcher-original", "KMLM Switcher of Simon97 - Original", "Nifty 500 adaptation of KMLM Switcher Original.", [
    ifElse(
      "kmlm-hot",
      kpi("rsi_14", NSE_SLEEVE.market),
      ">",
      num(80),
      [asset("kmlm-gold", NSE_SLEEVE.defensive)],
      [
        ifElse(
          "kmlm-cold",
          kpi("rsi_14", NSE_SLEEVE.it),
          "<",
          num(30),
          [
            group("kmlm-bounce", "Rebound Nifty 500 basket", [
              asset("kmlm-it", NSE_SLEEVE.it),
              asset("kmlm-nifty", NSE_SLEEVE.market),
              asset("kmlm-junior", NSE_SLEEVE.junior),
            ]),
          ],
          [
            ifElse(
              "kmlm-tech",
              kpi("roc_12", NSE_SLEEVE.it),
              ">",
              kpi("roc_12", NSE_SLEEVE.metal),
              [
                filter("kmlm-mr", [NSE_SLEEVE.it, NSE_SLEEVE.junior, NSE_SLEEVE.defensive], [
                  group("kmlm-mr-group", `Mean-revert ${NSE_SLEEVE.it} / ${NSE_SLEEVE.junior} / ${NSE_SLEEVE.defensive}`, [
                    asset("kmlm-mr-it", NSE_SLEEVE.it),
                    asset("kmlm-mr-junior", NSE_SLEEVE.junior),
                    asset("kmlm-mr-gold", NSE_SLEEVE.defensive),
                  ]),
                ], "Risk-on mean-reversion filter"),
              ],
              [
                strongerOf(
                  "kmlm-def",
                  NSE_SLEEVE.cash,
                  NSE_SLEEVE.bond,
                  asset("kmlm-liquid", NSE_SLEEVE.cash),
                  asset("kmlm-gilt", NSE_SLEEVE.bond),
                  `Defensive: stronger of ${NSE_SLEEVE.cash} vs ${NSE_SLEEVE.bond}`,
                ),
              ],
              `IF ${NSE_SLEEVE.it} > ${NSE_SLEEVE.metal} (roc_12)`,
            ),
          ],
          `IF RSI(${NSE_SLEEVE.it}) < 30 → bounce`,
        ),
      ],
      `IF RSI(${NSE_SLEEVE.market}) > 80 → ${NSE_SLEEVE.defensive}`,
    ),
  ]),
};

const TQQQ_FTLT_V2: ComposerStrategyCard = {
  id: "tqqq-ftlt-v2",
  name: "Nifty For The Long Term V2",
  description: "Daily one-name rotation on RELIANCE’s 200-day trend: Reliance unless RSI heat (HINDUNILVR); downtrend uses TCS/INFY oversold bounces or ITC vs POWERGRID.",
  sourceUrl: "https://www.composer.trade/trading-strategies/tqqq-for-the-long-term-v2-2267-rr461-max-dd-m8Hkj9NHOTljuTRLmVoy",
  asOf: AS_OF,
  marketNote: IN_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: `${RSI_MAP} SPY/TQQQ/SPXL/UPRO→RELIANCE, UVXY→HINDUNILVR, TECL→TCS, SQQQ→ITC, BSV→POWERGRID.`,
  categories: ["Trend following", "Daily rebalance", "Nifty 500"],
  stats: { ...UNRUN_STATS, rebalance: "day" },
  tree: treeDoc("tqqq-ftlt-v2", "Nifty For The Long Term V2", "Nifty 500 adaptation of TQQQ FTLT V2.", [
    ifElse(
      "ftltv2-trend",
      kpi("close", NSE_SLEEVE.market),
      ">",
      kpi("sma_200", NSE_SLEEVE.market),
      [
        ifElse(
          "ftltv2-heat",
          kpi("rsi_14", NSE_SLEEVE.market),
          ">=",
          num(80),
          [asset("ftltv2-gold", NSE_SLEEVE.defensive)],
          [asset("ftltv2-nifty", NSE_SLEEVE.market)],
          `IF RSI(${NSE_SLEEVE.market}) ≥ 80 → ${NSE_SLEEVE.defensive} else ${NSE_SLEEVE.market}`,
        ),
      ],
      [
        ifElse(
          "ftltv2-it",
          kpi("rsi_14", NSE_SLEEVE.market),
          "<",
          num(31),
          [asset("ftltv2-it-name", NSE_SLEEVE.it)],
          [
            ifElse(
              "ftltv2-junior",
              kpi("rsi_14", NSE_SLEEVE.market),
              "<",
              num(30),
              [asset("ftltv2-setfnif", NSE_SLEEVE.market2)],
              [
                ifElse(
                  "ftltv2-gold-hot",
                  kpi("rsi_14", NSE_SLEEVE.defensive),
                  ">",
                  num(70),
                  [asset("ftltv2-gold-hold", NSE_SLEEVE.defensive)],
                  [
                    ifElse(
                      "ftltv2-nifty-20",
                      kpi("close", NSE_SLEEVE.market),
                      ">",
                      kpi("sma_20", NSE_SLEEVE.market),
                      [asset("ftltv2-nifty-hold", NSE_SLEEVE.market)],
                      [
                        strongerOf(
                          "ftltv2-def",
                          NSE_SLEEVE.cash,
                          NSE_SLEEVE.bond,
                          asset("ftltv2-liquid", NSE_SLEEVE.cash),
                          asset("ftltv2-gilt", NSE_SLEEVE.bond),
                          `Stronger of ${NSE_SLEEVE.cash} vs ${NSE_SLEEVE.bond}`,
                        ),
                      ],
                      `IF ${NSE_SLEEVE.market} > SMA 20 → ${NSE_SLEEVE.market}`,
                    ),
                  ],
                  `IF RSI(${NSE_SLEEVE.defensive}) high → ${NSE_SLEEVE.defensive} (page: high; 70 is a labeled reconstruction)`,
                ),
              ],
              `IF RSI(${NSE_SLEEVE.market}) < 30 → ${NSE_SLEEVE.market2}`,
            ),
          ],
          `IF RSI(${NSE_SLEEVE.market}) < 31 → ${NSE_SLEEVE.it}`,
        ),
      ],
      `IF ${NSE_SLEEVE.market} > SMA 200`,
    ),
  ]),
};

const TQQQ_FTLT_REDDIT: ComposerStrategyCard = {
  id: "tqqq-ftlt-reddit",
  name: "Nifty For The Long Term (Reddit Post Link)",
  description: "RELIANCE 200-day gate into Reliance or a heat hedge (HINDUNILVR). Below trend: try TCS/INFY rebounds, else the stronger of ITC vs POWERGRID.",
  sourceUrl: "https://www.composer.trade/trading-strategies/tqqq-for-the-long-term-reddit-post-link-HukRwDJLlYPLMbrQbua5",
  asOf: AS_OF,
  marketNote: IN_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: `${RSI_MAP} Same Nifty 500 map as FTLT V2. Rebound uses the weaker of TCS/INFY via roc_12.`,
  categories: ["Trend following", "Daily rotation", "Nifty 500"],
  stats: { ...UNRUN_STATS, rebalance: "day" },
  tree: treeDoc("tqqq-ftlt-reddit", "Nifty For The Long Term (Reddit)", "Nifty 500 adaptation of TQQQ FTLT (Reddit).", [
    ifElse(
      "ftltr-trend",
      kpi("close", NSE_SLEEVE.market),
      ">",
      kpi("sma_200", NSE_SLEEVE.market),
      [
        ifElse(
          "ftltr-heat",
          kpi("rsi_14", NSE_SLEEVE.market),
          ">",
          num(79),
          [asset("ftltr-gold", NSE_SLEEVE.defensive)],
          [asset("ftltr-nifty", NSE_SLEEVE.market)],
          `IF 10-day heat (mapped RSI>79) → ${NSE_SLEEVE.defensive} else ${NSE_SLEEVE.market}`,
        ),
      ],
      [
        ifElse(
          "ftltr-rebound",
          kpi("rsi_14", NSE_SLEEVE.it),
          "<",
          num(35),
          [
            strongerOf(
              "ftltr-rebound-pick",
              NSE_SLEEVE.market2,
              NSE_SLEEVE.it,
              asset("ftltr-setfnif", NSE_SLEEVE.market2),
              asset("ftltr-it", NSE_SLEEVE.it),
              `Weaker rebound name of ${NSE_SLEEVE.it} vs ${NSE_SLEEVE.market2}`,
            ),
          ],
          [
            strongerOf(
              "ftltr-def",
              NSE_SLEEVE.cash,
              NSE_SLEEVE.bond,
              asset("ftltr-liquid", NSE_SLEEVE.cash),
              asset("ftltr-gilt", NSE_SLEEVE.bond),
              `Stronger of ${NSE_SLEEVE.cash} vs ${NSE_SLEEVE.bond} (~10d → roc_12)`,
            ),
          ],
          `Rebound ${NSE_SLEEVE.it}/${NSE_SLEEVE.market2} if washed out, else defensive`,
        ),
      ],
      `IF ${NSE_SLEEVE.market} > SMA 200`,
    ),
  ]),
};

const WOODEN_ARKK: ComposerStrategyCard = {
  id: "wooden-arkk",
  name: "Wooden ARKK Machine 2.2",
  description: "Daily POWERGRID vs BEL RSI(7) regime: buy the worst recent performer from a bullish Nifty 500 list if POWERGRID leads, else from a defensive list. About 90% in that name.",
  sourceUrl: "https://www.composer.trade/trading-strategies/wooden-arkk-machine-22-kl2dR0Rlp4RgZUHAJY2k",
  asOf: AS_OF,
  marketNote: IN_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: "IEI→POWERGRID, SPHB→BEL, leveraged bull list→BEL/TCS/LT/POWERGRID/HDFCBANK, inverse list→HINDUNILVR/ITC/HINDALCO. Worst 4-day pick is labeled on a Filter; roc_12 is the closest registry window.",
  categories: ["Mean reversion", "Nifty 500", "Daily"],
  stats: { ...UNRUN_STATS, rebalance: "day" },
  tree: treeDoc("wooden-arkk", "Wooden ARKK Machine 2.2", "Nifty 500 adaptation of Wooden ARKK Machine 2.2.", [
    weight("arkk-90-10", [
      sleeve(90, ifElse(
        "arkk-regime",
        kpi("rsi_7", NSE_SLEEVE.bond),
        ">",
        kpi("rsi_7", NSE_SLEEVE.junior),
        [
          filter("arkk-bull", [NSE_SLEEVE.junior, NSE_SLEEVE.it, NSE_SLEEVE.infra, NSE_SLEEVE.bond, NSE_SLEEVE.bank], [
            group("arkk-bull-group", "Worst 4-day bullish Nifty 500 name", [
              asset("arkk-junior", NSE_SLEEVE.junior),
              asset("arkk-it", NSE_SLEEVE.it),
              asset("arkk-infra", NSE_SLEEVE.infra),
              asset("arkk-gilt", NSE_SLEEVE.bond),
              asset("arkk-bank", NSE_SLEEVE.bank),
            ]),
          ], "Filter bullish list — pick worst 4-day (label only)"),
        ],
        [
          filter("arkk-bear", [NSE_SLEEVE.defensive, NSE_SLEEVE.cash, NSE_SLEEVE.metal], [
            group("arkk-bear-group", "Worst 4-day defensive name", [
              asset("arkk-gold", NSE_SLEEVE.defensive),
              asset("arkk-liquid", NSE_SLEEVE.cash),
              asset("arkk-silver", NSE_SLEEVE.metal),
            ]),
          ], "Filter defensive list — pick worst 4-day (label only)"),
        ],
        `IF RSI(7) ${NSE_SLEEVE.bond} > RSI(7) ${NSE_SLEEVE.junior}`,
      )),
      sleeve(10, asset("arkk-cash", NSE_SLEEVE.cash, `${formatTickerName(NSE_SLEEVE.cash)} · uninvested cash (~10% as published)`)),
    ], "90% selected name / 10% cash"),
  ]),
};

export const COMPOSER_STRATEGIES: ComposerStrategyCard[] = [
  SIMONS_KMLM,
  KMLM_ORIGINAL,
  INVERSE_BETA_BALLER,
  HOLY_GRAIL,
  HOLIER_GRAIL,
  WOODEN_ARKK,
  TQQQ_FTLT_REDDIT,
  TQQQ_FTLT_V2,
  RAMS_SOXX,
];

export type ComposerSortKey = "annualized" | "cumulative" | "sharpe";

function publishedStat(card: ComposerStrategyCard, key: "annualizedReturnPct" | "cumulativeReturnPct" | "sharpe"): number {
  const value = card.stats[key];
  return typeof value === "number" ? value : Number.NEGATIVE_INFINITY;
}

export function sortComposerStrategies(
  strategies: readonly ComposerStrategyCard[],
  key: ComposerSortKey = "annualized",
): ComposerStrategyCard[] {
  const copy = [...strategies];
  copy.sort((left, right) => {
    const delta = (() => {
      switch (key) {
        case "annualized":
          return publishedStat(right, "annualizedReturnPct") - publishedStat(left, "annualizedReturnPct");
        case "cumulative":
          return publishedStat(right, "cumulativeReturnPct") - publishedStat(left, "cumulativeReturnPct");
        case "sharpe":
          return publishedStat(right, "sharpe") - publishedStat(left, "sharpe");
        default: {
          const _never: never = key;
          return _never;
        }
      }
    })();
    if (delta !== 0) return delta;
    return left.name.localeCompare(right.name);
  });
  return copy;
}

export function composerStrategyById(id: string): ComposerStrategyCard | undefined {
  return COMPOSER_STRATEGIES.find((item) => item.id === id);
}

export function featuredComposerStrategy(): ComposerStrategyCard {
  return sortComposerStrategies(COMPOSER_STRATEGIES, "annualized")[0]!;
}
