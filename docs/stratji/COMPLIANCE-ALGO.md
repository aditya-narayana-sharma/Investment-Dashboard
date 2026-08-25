# Stratji Compliance — White-box retail algo awareness

**Status:** living. Labels: **AS-BUILT** / **TARGET** / **INVARIANT**.  
This is **awareness documentation for a software tool**, not legal advice.

## 1. Product classification (INVARIANT)

- Stratji is **software tooling** for a user who authors or reconstructs strategies in the open.
- It is **not** investment advice.
- It is **not** a SEBI Research Analyst (RA) product.
- It is **not** a black-box algo marketplace selling third-party signals.

## 2. White-box requirement (INVARIANT)

Every strategy shown in Algorithm Builder or Strategies must be inspectable as `StrategyTreeV1` / `StrategyGraphV2` text and JSON. Missing KPIs render as `—`. Backtest `ran: true` only when the engine actually ran.

## 3. Live execution venue (INVARIANT product lock)

**Live strategy execution is only via Zerodha Streak.**

| Allowed | Forbidden |
| --- | --- |
| Export a recipe + approval checklist | Unofficial Streak scraping |
| User deploys and confirms inside Streak | Stratji-core silent auto-trade |
| Kite order/GTT/alert **tickets** with typed confirmation | Unattended `place_order` loops |
| Paper / dry-run sinks (TARGET P5) | Hosted execution on stratji.co.in |

This slice ships a **copy-only checklist stub**. It does **not** claim Streak live trading works.

## 4. SEBI / NSE retail algo awareness (TARGET for Pro live)

Operators should treat the following as a **checklist to complete in the broker venue**, not as Stratji asserting a license:

1. **White-box text** of the strategy the user intends to run.
2. **Static IP** attestation as required by the broker / exchange algo facility.
3. **OPS (orders per second)** threshold guidance — typical retail ≤10 unless the broker documents otherwise.
4. **Algo-ID** field filled in Streak / broker console when issued.
5. **Change log** when logic edits; re-approval before going live again.
6. User remains the **trading member’s client**; Stratji is not the execution member.

Re-read current SEBI circulars and NSE/Zerodha Streak docs before P6 ship. Rules change; this file must be updated rather than assumed eternal.

## 5. Kite tickets vs algo live (AS-BUILT vs TARGET)

**AS-BUILT:** manual BUY/SELL, GTT, TSL, and alert tickets on Portfolio Overview require reviewed confirmation. That is discretionary order entry, not an unattended algo.

**TARGET Pro:** unattended live path is Streak-only. Groww and other brokers start as **read + ticket** adapters. They do not become a second live algo venue until a broker-approved facility exists.

## 6. Data residency (INVARIANT)

Mail, Health, notes, and broker tokens stay on the user’s Mac (and HealthKit aggregates on the paired iPhone). stratji.co.in holds marketing + license JWT only.

## 7. Disclaimers (INVARIANT)

Educational research and private wellness tracking. Not investment or medical advice. Past reconstructions of public Composer-style logic on NSE names are not performance promises.

## 8. Built-in strategy signals — Y-3 (AS-BUILT)

Two strategies ship in the Strategies workspace, section **Y-3 Signals**.

| Strategy | What it computes | Trigger |
| --- | --- | --- |
| **Bollinger Band Expansion** | Upper-band minima and lower-band maxima over the trailing 3 months (63 sessions); the absolute upper−lower price spread at maximum contraction; and the delta and percentage by which the current spread exceeds it | BUY **candidate** only on an upward width breakout out of a squeeze **with the close above the 20-period mid band**. A downside break is `watch`, never a candidate. |
| **Mean Comparison** | SMA 20 versus SMA 220, the gap as a percentage, and sessions since the relationship last flipped | BUY **candidate** while SMA 20 > SMA 220; a flip on the latest session is flagged as a fresh cross |

**Units.** The pre-existing `bbands_width_20` KPI is normalised (`(upper − lower) / mid`).
The Y-3 expansion KPIs are **absolute price spreads**, because a contraction-to-breakout
comparison is a rupee difference. They are not interchangeable and are registered separately.

**Data.** Daily candles come from yfinance (`period="2y"`, ~500 sessions) via the existing
`loadYfinanceStrategyKpis` loader — above the 220 sessions SMA-220 needs plus the 3-month
band lookback. Kite historical data is used only where a paid Kite Connect market-data
entitlement exists; a Zerodha Personal app cannot serve it. A symbol with insufficient
history is reported **unavailable with a stated reason** and shows no metrics at all.
No value is ever inferred, interpolated, or carried forward.

**Execution boundary (INVARIANT).** These are signals, not an algo.

1. A signal is a *candidate*. `app/strategy/builtin-signals.ts` and
   `app/strategy/allocation-planner.ts` are pure and contain no network or order code;
   a test guards this.
2. The allocation planner sizes whole shares from operator-entered capital and
   allocation, floors fractional quantities, and refuses any line without a live price.
3. A plan carrying any blocking error cannot pre-fill an order ticket at all.
4. Staging opens the existing reviewed **Kite order ticket**, whose typed-confirmation
   gate is unchanged. Nothing is placed automatically, on any schedule, or in the
   background. There is no unattended path.
5. This is discretionary order entry under §5, not an unattended algo, and therefore
   does not require an NSE algo-ID today. If a future release adds unattended
   execution of these strategies, §4 approval applies and this section must be revised
   before that ships.

**Disclaimer.** Machine-computed indicator values from public daily price history.
Not investment advice, not a recommendation, and not a performance promise.
