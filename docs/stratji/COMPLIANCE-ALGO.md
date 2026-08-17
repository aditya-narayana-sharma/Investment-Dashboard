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
