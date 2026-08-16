/**
 * Composer.trade public reconstructions (as-of 2026-08-16).
 * Trees are rebuilt from publicly visible How-it-works block structure into StrategyTreeV1.
 * US listed symbols are intentional; Indian-market seeds stay in seed-tree.ts.
 */
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

export type ComposerPublishedStats = {
  oosStart: string;
  cumulativeReturnPct: number;
  annualizedReturnPct: number;
  sharpe: number;
  maxDrawdownPct: number;
  stdevPct: number;
  calmar: number;
  trailing1mPct?: number;
  trailing3mPct?: number;
  trailing1yPct?: number;
  rebalance?: "day" | "";
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
const US_NOTE = "Uses US-listed symbols published on Composer (SPY, TQQQ, SOXL, and similar). This is not the Indian-market Algorithm Builder seed.";
const RECON_NOTE = "Composer-public reconstruction from the strategy page’s How-it-works text. Not a live broker-connected portfolio and not a Composer Symphony export.";
const RSI_MAP = "Composer pages that name a 10-day RSI are mapped to registry kpiId rsi_14 (no rsi_10 in the 128-KPI catalog). 10-day relative strength uses roc_12.";

function kpi(kpiId: string, symbol: string): TreeOperand {
  return { type: "kpi", kpiId, symbol };
}

function num(value: number): TreeOperand {
  return { type: "number", value };
}

function asset(id: string, symbol: string, label?: string): AssetNode {
  return { id, kind: "asset", label: label ?? symbol, params: { symbol }, children: [] };
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
  return { id, kind: "filter", label, params: { assetClasses: ["ETF"], symbols }, children };
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
    kpi("close", "TQQQ"),
    ">",
    kpi("sma_200", "TQQQ"),
    [
      ifElse(
        `${prefix}-heat`,
        kpi("rsi_14", "TQQQ"),
        ">",
        num(79),
        [asset(`${prefix}-uvxy`, "UVXY", "ProShares Ultra VIX Short-Term Futures")],
        [asset(`${prefix}-tqqq`, "TQQQ", "ProShares UltraPro QQQ")],
        "IF RSI(TQQQ) > 79 → UVXY else TQQQ",
      ),
    ],
    [
      ifElse(
        `${prefix}-tecl`,
        kpi("rsi_14", "TQQQ"),
        "<",
        num(31),
        [asset(`${prefix}-tecl`, "TECL", "Direxion Daily Technology Bull 3X")],
        [
          ifElse(
            `${prefix}-soxl`,
            kpi("rsi_14", "SOXL"),
            "<",
            num(30),
            [asset(`${prefix}-soxl`, "SOXL", "Direxion Daily Semiconductor Bull 3X")],
            [
              ifElse(
                `${prefix}-below20`,
                kpi("close", "TQQQ"),
                "<",
                kpi("sma_20", "TQQQ"),
                [
                  strongerOf(
                    `${prefix}-hedge`,
                    "SQQQ",
                    "BSV",
                    asset(`${prefix}-sqqq`, "SQQQ", "ProShares UltraPro Short QQQ"),
                    asset(`${prefix}-bsv`, "BSV", "Vanguard Short-Term Bond ETF"),
                    "Stronger of SQQQ vs BSV (roc_12)",
                  ),
                ],
                [asset(`${prefix}-tqqq-resume`, "TQQQ", "ProShares UltraPro QQQ")],
                "IF TQQQ < SMA 20 → hedge else TQQQ",
              ),
            ],
            "IF RSI(SOXL) < 30 → SOXL",
          ),
        ],
        "IF RSI(TQQQ) < 31 → TECL",
      ),
    ],
    "IF TQQQ > SMA 200",
  );
  if (!includeCash) return logic;
  return weight(`${prefix}-cash-split`, [
    sleeve(80, logic),
    sleeve(20, asset(`${prefix}-cash`, "BIL", "Cash sleeve (page: often ~20% cash; BIL as T-bill proxy)")),
  ], "80% logic / 20% cash");
}

const HOLY_GRAIL: ComposerStrategyCard = {
  id: "holy-grail",
  name: "The Holy Grail",
  description: "Nasdaq 3x trend sleeve with a heat hedge into UVXY, oversold TECL/SOXL bounces, and a SQQQ vs BSV defensive pick when TQQQ is below its 20-day average.",
  sourceUrl: "https://www.composer.trade/trading-strategies/the-holy-grail-MmQbpf2U5TMQFmr9Nt2e",
  asOf: AS_OF,
  marketNote: US_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: `${RSI_MAP} Page publishes TQQQ 200-day, RSI>79 / <31, SOXL RSI<30, TQQQ 20-day, and an ~20% cash sleeve.`,
  categories: ["Trend/momentum", "Leveraged ETFs", "Tech/Nasdaq", "Volatility hedge"],
  stats: {
    oosStart: "2022-07-20",
    cumulativeReturnPct: 2061.93,
    annualizedReturnPct: 113.37,
    sharpe: 1.52,
    maxDrawdownPct: 46.96,
    stdevPct: 62.41,
    calmar: 2.41,
    trailing1mPct: 8.47,
    trailing3mPct: 5.39,
    trailing1yPct: 53.43,
  },
  tree: treeDoc("holy-grail", "The Holy Grail", "Composer-public reconstruction of The Holy Grail.", [holyGrailLogic("holy", true)]),
};

const HOLIER_GRAIL: ComposerStrategyCard = {
  id: "holier-grail",
  name: "The Holier Grail (NMB Cleaned)",
  description: "Cleaned Holy Grail sibling: TQQQ uptrend unless RSI>79 (UVXY); otherwise oversold TECL/SOXL or the stronger of SQQQ vs BSV.",
  sourceUrl: "https://www.composer.trade/trading-strategies/the-holier-grail-nmb-cleaned-QNYVjfpD6XdMVEdDHAIN",
  asOf: AS_OF,
  marketNote: US_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: `${RSI_MAP} This page names RSI>79 and TECL/SOXL/SQQQ/BSV but not SMA 200; long-term uptrend is mapped to TQQQ close > sma_200 as published on the sibling Holy Grail page (identical OOS stats). No 20% cash sleeve on this page.`,
  categories: ["Trend-following", "Momentum", "Leveraged ETFs", "Volatility hedging"],
  stats: {
    oosStart: "2022-07-20",
    cumulativeReturnPct: 2061.93,
    annualizedReturnPct: 113.37,
    sharpe: 1.52,
    maxDrawdownPct: 46.96,
    stdevPct: 62.41,
    calmar: 2.41,
    trailing1mPct: 8.47,
    trailing3mPct: 5.39,
    trailing1yPct: 53.43,
  },
  tree: treeDoc("holier-grail", "The Holier Grail (NMB Cleaned)", "Composer-public reconstruction of The Holier Grail (NMB Cleaned).", [holyGrailLogic("holier", false)]),
};

const SIMONS_KMLM: ComposerStrategyCard = {
  id: "simons-kmlm",
  name: "Simons KMLM switcher (single pops) V2",
  description: "Event-driven switcher: UVXY when several equity sleeves look hot, leveraged bounce basket when cold, otherwise Tech vs KMLM into the two weakest of TECL/SOXL/SVIX or the stronger of SQQQ vs TLT.",
  sourceUrl: "https://www.composer.trade/trading-strategies/simons-kmlm-switcher-single-pops-bt-41322-ar-466-dd-22-v2-u5iBJE751BM5FKPRJvKf",
  asOf: AS_OF,
  marketNote: US_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: `${RSI_MAP} “Many funds look very hot (~80)” is reconstructed as any RSI>80 on SPY/TECL/SOXL/SPXL from the published ticker list. Tech vs KMLM uses QQQE (published ticker) vs KMLM via roc_12. Page lists 20 assets; tree uses the named sleeves only.`,
  categories: ["Tactical", "Volatility timing", "Leveraged ETFs", "Managed futures"],
  stats: {
    oosStart: "2024-07-22",
    cumulativeReturnPct: 1892.51,
    annualizedReturnPct: 327.49,
    sharpe: 2.15,
    maxDrawdownPct: 31.42,
    stdevPct: 83.56,
    calmar: 10.42,
    trailing1mPct: 72.69,
    trailing3mPct: 99.47,
    trailing1yPct: 161.32,
  },
  tree: treeDoc("simons-kmlm", "Simons KMLM switcher V2", "Composer-public reconstruction of Simons KMLM switcher V2.", [
    ifElse(
      "simons-hot-gate",
      kpi("rsi_14", "SPY"),
      ">",
      num(80),
      [asset("simons-uvxy-spy", "UVXY", "ProShares Ultra VIX Short-Term Futures")],
      [
        ifElse(
          "simons-hot-or",
          kpi("rsi_14", "TECL"),
          ">",
          num(80),
          [asset("simons-uvxy-tecl", "UVXY", "ProShares Ultra VIX Short-Term Futures")],
          [
            ifElse(
              "simons-cold",
              kpi("rsi_14", "TECL"),
              "<",
              num(30),
              [
                filter("simons-bounce", ["TECL", "SOXL", "SPXL", "LABU"], [
                  group("simons-bounce-group", "Washed-out bounce basket", [
                    asset("simons-tecl", "TECL"),
                    asset("simons-soxl", "SOXL"),
                    asset("simons-spxl", "SPXL"),
                    asset("simons-labu", "LABU"),
                  ]),
                ], "Filter bounce names (TECL / SOXL / SPXL / LABU)"),
              ],
              [
                ifElse(
                  "simons-tech-kmlm",
                  kpi("roc_12", "QQQE"),
                  ">",
                  kpi("roc_12", "KMLM"),
                  [
                    filter("simons-weak-2", ["TECL", "SOXL", "SVIX"], [
                      group("simons-weak-group", "2 weakest of TECL / SOXL / SVIX (page)", [
                        asset("simons-w-tecl", "TECL"),
                        asset("simons-w-soxl", "SOXL"),
                        asset("simons-w-svix", "SVIX"),
                      ]),
                    ], "Filter: 2 weakest (select-N not in tree params — label only)"),
                  ],
                  [
                    strongerOf(
                      "simons-defensive",
                      "SQQQ",
                      "TLT",
                      asset("simons-sqqq", "SQQQ"),
                      asset("simons-tlt", "TLT"),
                      "Stronger of SQQQ vs TLT",
                    ),
                  ],
                  "IF QQQE roc_12 > KMLM roc_12",
                ),
              ],
              "IF RSI(TECL) < 30 → bounce basket",
            ),
          ],
          "IF RSI(TECL) > 80 → UVXY",
        ),
      ],
      "IF RSI(SPY) > 80 → UVXY",
    ),
  ]),
};

const INVERSE_BETA_BALLER: ComposerStrategyCard = {
  id: "inverse-beta-baller",
  name: "Inverse of [DEV] Beta Baller v0.21",
  description: "Daily BIL-vs-BND regime: if T-bills lead, buy UVXY/VIXY when SPY RSI>76 else SOXL; if bonds lead, hold the stronger 3-day name of SOXS vs BIL.",
  sourceUrl: "https://www.composer.trade/trading-strategies/inverse-of-dev-beta-baller-v021-deez-oct22-0hwHbRPQjoOk0XV3zrEa",
  asOf: AS_OF,
  marketNote: US_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: `${RSI_MAP} BIL vs BND “stronger” and the 3-day SOXS/BIL race use roc_12. Page says 80% in the beaten-down vol ETF; the unnamed remainder is omitted rather than invented.`,
  categories: ["Tactical", "Daily rebalance", "Volatility (VIX)", "Semiconductors"],
  stats: {
    oosStart: "2022-11-10",
    cumulativeReturnPct: 1649.69,
    annualizedReturnPct: 115.04,
    sharpe: 1.25,
    maxDrawdownPct: 80.84,
    stdevPct: 108.6,
    calmar: 1.42,
    trailing1mPct: -17.32,
    trailing3mPct: -28.43,
    trailing1yPct: 231.77,
    rebalance: "day",
  },
  tree: treeDoc("inverse-beta-baller", "Inverse Beta Baller v0.21", "Composer-public reconstruction of Inverse Beta Baller v0.21.", [
    ifElse(
      "ibb-regime",
      kpi("roc_12", "BIL"),
      ">",
      kpi("roc_12", "BND"),
      [
        ifElse(
          "ibb-spy-hot",
          kpi("rsi_14", "SPY"),
          ">",
          num(76),
          [
            filter("ibb-vol", ["UVXY", "VIXY"], [
              strongerOf(
                "ibb-vol-pick",
                "VIXY",
                "UVXY",
                asset("ibb-vixy", "VIXY", "More beaten-down vol ETF"),
                asset("ibb-uvxy", "UVXY", "More beaten-down vol ETF"),
                "Whichever vol ETF looks more beaten-down (lower roc_12)",
              ),
            ], "80% vol sleeve as published — remainder not named"),
          ],
          [asset("ibb-soxl", "SOXL", "Direxion Daily Semiconductor Bull 3X")],
          "IF RSI(SPY) > 76 → UVXY or VIXY",
        ),
      ],
      [
        strongerOf(
          "ibb-soxs-bil",
          "SOXS",
          "BIL",
          asset("ibb-soxs", "SOXS", "Direxion Daily Semiconductor Bear 3X"),
          asset("ibb-bil", "BIL", "SPDR Bloomberg 1-3 Month T-Bill"),
          "Stronger of SOXS vs BIL (page: last 3 days; mapped to roc_12)",
        ),
      ],
      "IF BIL stronger than BND",
    ),
  ]),
};

const RAMS_SOXX: ComposerStrategyCard = {
  id: "rams-soxx",
  name: "Ram's SOXX",
  description: "Single-name daily flip: if SOXX rose more than about 2.5% yesterday, hold SOXS; otherwise hold SOXL.",
  sourceUrl: "https://www.composer.trade/trading-strategies/rams-soxx-SkTp0zaQZb8sdGOs8YS7",
  asOf: AS_OF,
  marketNote: US_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: "Yesterday’s SOXX change is mapped to log_return(SOXX) > 0.025. Page publishes the 2.5% cut and the SOXL/SOXS pair.",
  categories: ["Semiconductors", "Mean reversion", "Daily switching", "Leveraged ETFs"],
  stats: {
    oosStart: "2021-12-16",
    cumulativeReturnPct: 1336.61,
    annualizedReturnPct: 77.62,
    sharpe: 1.07,
    maxDrawdownPct: 83.06,
    stdevPct: 115.78,
    calmar: 0.93,
    trailing1mPct: 3.59,
    trailing3mPct: 124.01,
    trailing1yPct: 629.67,
    rebalance: "day",
  },
  tree: treeDoc("rams-soxx", "Ram's SOXX", "Composer-public reconstruction of Ram's SOXX.", [
    ifElse(
      "rams-soxx-move",
      kpi("log_return", "SOXX"),
      ">",
      num(0.025),
      [asset("rams-soxs", "SOXS", "Direxion Daily Semiconductor Bear 3X")],
      [asset("rams-soxl", "SOXL", "Direxion Daily Semiconductor Bull 3X")],
      "IF SOXX log_return > 2.5% → SOXS else SOXL",
    ),
  ]),
};

const KMLM_ORIGINAL: ComposerStrategyCard = {
  id: "kmlm-switcher-original",
  name: "KMLM Switcher of Simon97 - Original",
  description: "Same public skeleton as the Simons V2 switcher: UVXY on heat, 3x bounce when cold, otherwise XLK/QQQE vs KMLM into risk-on mean-reversion or SQQQ/TLT.",
  sourceUrl: "https://www.composer.trade/trading-strategies/kmlm-switcher-of-simon97-original-syMn9OgFREE0wo8LtYsG",
  asOf: AS_OF,
  marketNote: US_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: `${RSI_MAP} Page names RSI ~80 / <30, UVXY, TECL/SOXL/SPXL, and XLK vs KMLM. XLK is not in the extracted ticker list; QQQE (published) is the tech comparison asset.`,
  categories: ["RSI mean-reversion", "KMLM signal", "Leveraged ETFs"],
  stats: {
    oosStart: "2024-07-22",
    cumulativeReturnPct: 1077.72,
    annualizedReturnPct: 231.16,
    sharpe: 1.87,
    maxDrawdownPct: 36.07,
    stdevPct: 81.64,
    calmar: 6.41,
    trailing1mPct: 71.39,
    trailing3mPct: 106.01,
    trailing1yPct: 88.46,
  },
  tree: treeDoc("kmlm-switcher-original", "KMLM Switcher of Simon97 - Original", "Composer-public reconstruction of KMLM Switcher Original.", [
    ifElse(
      "kmlm-hot",
      kpi("rsi_14", "SPY"),
      ">",
      num(80),
      [asset("kmlm-uvxy", "UVXY")],
      [
        ifElse(
          "kmlm-cold",
          kpi("rsi_14", "TECL"),
          "<",
          num(30),
          [
            group("kmlm-bounce", "Rebound 3x basket", [
              asset("kmlm-tecl", "TECL"),
              asset("kmlm-soxl", "SOXL"),
              asset("kmlm-spxl", "SPXL"),
            ]),
          ],
          [
            ifElse(
              "kmlm-tech",
              kpi("roc_12", "QQQE"),
              ">",
              kpi("roc_12", "KMLM"),
              [
                filter("kmlm-mr", ["TECL", "SOXL", "SVIX"], [
                  group("kmlm-mr-group", "Mean-revert TECL / SOXL / SVIX", [
                    asset("kmlm-mr-tecl", "TECL"),
                    asset("kmlm-mr-soxl", "SOXL"),
                    asset("kmlm-mr-svix", "SVIX"),
                  ]),
                ], "Risk-on mean-reversion filter"),
              ],
              [
                strongerOf(
                  "kmlm-def",
                  "SQQQ",
                  "TLT",
                  asset("kmlm-sqqq", "SQQQ"),
                  asset("kmlm-tlt", "TLT"),
                  "Defensive: stronger of SQQQ vs TLT",
                ),
              ],
              "IF QQQE > KMLM (roc_12)",
            ),
          ],
          "IF RSI(TECL) < 30 → bounce",
        ),
      ],
      "IF RSI(SPY) > 80 → UVXY",
    ),
  ]),
};

const TQQQ_FTLT_V2: ComposerStrategyCard = {
  id: "tqqq-ftlt-v2",
  name: "TQQQ For The Long Term V2",
  description: "Daily one-ETF rotation on SPY’s 200-day trend: TQQQ unless 10-day heat, UVXY when hot; downtrend uses TECL/SPXL oversold bounces or SQQQ vs BSV.",
  sourceUrl: "https://www.composer.trade/trading-strategies/tqqq-for-the-long-term-v2-2267-rr461-max-dd-m8Hkj9NHOTljuTRLmVoy",
  asOf: AS_OF,
  marketNote: US_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: `${RSI_MAP} Page publishes SPY 200-day, 10-day RSI ~≥80 → UVXY, TQQQ RSI<31 → TECL, SPY RSI<30 → SPXL, UVXY heat, TQQQ vs SMA 20, then stronger of SQQQ vs BSV.`,
  categories: ["Trend following", "Daily rebalance", "Leveraged ETFs"],
  stats: {
    oosStart: "2022-08-24",
    cumulativeReturnPct: 967.78,
    annualizedReturnPct: 81.95,
    sharpe: 1.27,
    maxDrawdownPct: 51.17,
    stdevPct: 62.25,
    calmar: 1.6,
    trailing1mPct: 2.36,
    trailing3mPct: -0.55,
    trailing1yPct: 46.02,
    rebalance: "day",
  },
  tree: treeDoc("tqqq-ftlt-v2", "TQQQ For The Long Term V2", "Composer-public reconstruction of TQQQ FTLT V2.", [
    ifElse(
      "ftltv2-trend",
      kpi("close", "SPY"),
      ">",
      kpi("sma_200", "SPY"),
      [
        ifElse(
          "ftltv2-heat",
          kpi("rsi_14", "TQQQ"),
          ">=",
          num(80),
          [asset("ftltv2-uvxy", "UVXY")],
          [asset("ftltv2-tqqq", "TQQQ")],
          "IF RSI(TQQQ) ≥ 80 → UVXY else TQQQ",
        ),
      ],
      [
        ifElse(
          "ftltv2-tecl",
          kpi("rsi_14", "TQQQ"),
          "<",
          num(31),
          [asset("ftltv2-tecl", "TECL")],
          [
            ifElse(
              "ftltv2-spxl",
              kpi("rsi_14", "SPY"),
              "<",
              num(30),
              [asset("ftltv2-spxl", "SPXL")],
              [
                ifElse(
                  "ftltv2-uvxy-hot",
                  kpi("rsi_14", "UVXY"),
                  ">",
                  num(70),
                  [asset("ftltv2-uvxy-hold", "UVXY")],
                  [
                    ifElse(
                      "ftltv2-tqqq-20",
                      kpi("close", "TQQQ"),
                      ">",
                      kpi("sma_20", "TQQQ"),
                      [asset("ftltv2-tqqq-hold", "TQQQ")],
                      [
                        strongerOf(
                          "ftltv2-def",
                          "SQQQ",
                          "BSV",
                          asset("ftltv2-sqqq", "SQQQ"),
                          asset("ftltv2-bsv", "BSV"),
                          "Stronger of SQQQ vs BSV",
                        ),
                      ],
                      "IF TQQQ > SMA 20 → TQQQ",
                    ),
                  ],
                  "IF RSI(UVXY) high → UVXY (page: high; 70 is a labeled reconstruction)",
                ),
              ],
              "IF RSI(SPY) < 30 → SPXL",
            ),
          ],
          "IF RSI(TQQQ) < 31 → TECL",
        ),
      ],
      "IF SPY > SMA 200",
    ),
  ]),
};

const TQQQ_FTLT_REDDIT: ComposerStrategyCard = {
  id: "tqqq-ftlt-reddit",
  name: "TQQQ For The Long Term (Reddit Post Link)",
  description: "SPY 200-day gate into TQQQ or a 10-day heat hedge (UVXY). Below trend: try TECL/UPRO rebounds, else the stronger ~10-day name of SQQQ vs TLT.",
  sourceUrl: "https://www.composer.trade/trading-strategies/tqqq-for-the-long-term-reddit-post-link-HukRwDJLlYPLMbrQbua5",
  asOf: AS_OF,
  marketNote: US_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: `${RSI_MAP} This page does not publish a numeric heat cut. RSI>79 is taken from the sibling FTLT V2 / Holy Grail pages in the same catalog. Rebound uses the weaker of TECL/UPRO via roc_12.`,
  categories: ["Trend following", "Daily rotation", "Leveraged ETFs"],
  stats: {
    oosStart: "2023-01-24",
    cumulativeReturnPct: 890.64,
    annualizedReturnPct: 91,
    sharpe: 1.37,
    maxDrawdownPct: 50.19,
    stdevPct: 60.22,
    calmar: 1.81,
    trailing1mPct: 2.36,
    trailing3mPct: -0.55,
    trailing1yPct: 45.71,
    rebalance: "day",
  },
  tree: treeDoc("tqqq-ftlt-reddit", "TQQQ For The Long Term (Reddit)", "Composer-public reconstruction of TQQQ FTLT (Reddit).", [
    ifElse(
      "ftltr-trend",
      kpi("close", "SPY"),
      ">",
      kpi("sma_200", "SPY"),
      [
        ifElse(
          "ftltr-heat",
          kpi("rsi_14", "TQQQ"),
          ">",
          num(79),
          [asset("ftltr-uvxy", "UVXY")],
          [asset("ftltr-tqqq", "TQQQ")],
          "IF 10-day heat (mapped RSI>79) → UVXY else TQQQ",
        ),
      ],
      [
        ifElse(
          "ftltr-rebound",
          kpi("rsi_14", "TECL"),
          "<",
          num(35),
          [
            strongerOf(
              "ftltr-rebound-pick",
              "UPRO",
              "TECL",
              asset("ftltr-upro", "UPRO"),
              asset("ftltr-tecl", "TECL"),
              "Weaker rebound name of TECL vs UPRO",
            ),
          ],
          [
            strongerOf(
              "ftltr-def",
              "SQQQ",
              "TLT",
              asset("ftltr-sqqq", "SQQQ"),
              asset("ftltr-tlt", "TLT"),
              "Stronger of SQQQ vs TLT (~10d → roc_12)",
            ),
          ],
          "Rebound TECL/UPRO if washed out, else defensive",
        ),
      ],
      "IF SPY > SMA 200",
    ),
  ]),
};

const WOODEN_ARKK: ComposerStrategyCard = {
  id: "wooden-arkk",
  name: "Wooden ARKK Machine 2.2",
  description: "Daily IEI vs SPHB RSI(7) regime: buy the worst recent performer from a bullish leveraged list if bonds lead, else from an inverse list. About 90% in that name.",
  sourceUrl: "https://www.composer.trade/trading-strategies/wooden-arkk-machine-22-kl2dR0Rlp4RgZUHAJY2k",
  asOf: AS_OF,
  marketNote: US_NOTE,
  reconstructionNote: RECON_NOTE,
  mappingNote: "Page publishes RSI(7) of IEI vs SPHB and a ~90% single-name sleeve. Worst 4-day pick is labeled on a Filter; roc_12 is the closest registry window. Bullish/bearish lists use only tickers printed on the page.",
  categories: ["Mean reversion", "Leveraged ETFs", "Daily"],
  stats: {
    oosStart: "2023-04-22",
    cumulativeReturnPct: 864.45,
    annualizedReturnPct: 98.83,
    sharpe: 1.47,
    maxDrawdownPct: 42.72,
    stdevPct: 58.28,
    calmar: 2.31,
    trailing1mPct: -0.84,
    trailing3mPct: 7.29,
    trailing1yPct: 118.53,
    rebalance: "day",
  },
  tree: treeDoc("wooden-arkk", "Wooden ARKK Machine 2.2", "Composer-public reconstruction of Wooden ARKK Machine 2.2.", [
    weight("arkk-90-10", [
      sleeve(90, ifElse(
        "arkk-regime",
        kpi("rsi_7", "IEI"),
        ">",
        kpi("rsi_7", "SPHB"),
        [
          filter("arkk-bull", ["EDC", "TECL", "TARK", "TMF", "SOXX"], [
            group("arkk-bull-group", "Worst 4-day bullish leveraged name", [
              asset("arkk-edc", "EDC"),
              asset("arkk-tecl", "TECL"),
              asset("arkk-tark", "TARK"),
              asset("arkk-tmf", "TMF"),
              asset("arkk-soxx", "SOXX"),
            ]),
          ], "Filter bullish list — pick worst 4-day (label only)"),
        ],
        [
          filter("arkk-bear", ["DRV", "PSQ", "SARK"], [
            group("arkk-bear-group", "Worst 4-day inverse name", [
              asset("arkk-drv", "DRV"),
              asset("arkk-psq", "PSQ"),
              asset("arkk-sark", "SARK"),
            ]),
          ], "Filter inverse list — pick worst 4-day (label only)"),
        ],
        "IF RSI(7) IEI > RSI(7) SPHB",
      )),
      sleeve(10, asset("arkk-cash", "BIL", "Uninvested cash (~10% as published)")),
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

export function sortComposerStrategies(
  strategies: readonly ComposerStrategyCard[],
  key: ComposerSortKey = "annualized",
): ComposerStrategyCard[] {
  const copy = [...strategies];
  copy.sort((left, right) => {
    const delta = (() => {
      switch (key) {
        case "annualized":
          return right.stats.annualizedReturnPct - left.stats.annualizedReturnPct;
        case "cumulative":
          return right.stats.cumulativeReturnPct - left.stats.cumulativeReturnPct;
        case "sharpe":
          return right.stats.sharpe - left.stats.sharpe;
        default: {
          const _never: never = key;
          return _never;
        }
      }
    })();
    if (delta !== 0) return delta;
    return right.stats.cumulativeReturnPct - left.stats.cumulativeReturnPct;
  });
  return copy;
}

export function composerStrategyById(id: string): ComposerStrategyCard | undefined {
  return COMPOSER_STRATEGIES.find((item) => item.id === id);
}

export function featuredComposerStrategy(): ComposerStrategyCard {
  return sortComposerStrategies(COMPOSER_STRATEGIES, "annualized")[0]!;
}
