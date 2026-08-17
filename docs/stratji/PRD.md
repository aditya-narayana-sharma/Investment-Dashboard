# Stratji PRD

**Status:** living. Labels: **AS-BUILT** / **TARGET** / **INVARIANT**.  
**Bible:** [Plans/STRATJI-Publish-Ready-Master-Plan.md](../../Plans/STRATJI-Publish-Ready-Master-Plan.md)

## 1. Product

Stratji is an on-device macOS portfolio, research, wellness, and white-box strategy cockpit for Indian equities. The iPhone is a private Tailscale client. It is **software tooling**, not investment advice, not a SEBI Research Analyst product, not a black-box algo marketplace.

## 2. Users

| Persona | Need |
| --- | --- |
| Any Mac user | Install, customize connectors, use licensed workspaces without personal hardcoded paths. |
| Pro subscriber | Mail, Calendar, Reminders, Health, PDF, S-3. |
| Ultra subscriber | Algorithm Canvas, Strategies library, Streak export checklist. |

## 3. Surfaces

### Six workspaces (INVARIANT count)

| Nav label | URL | Notes |
| --- | --- | --- |
| **Portfolio Overview** (TARGET label; key `investment`) | `?view=investment` | Aliases `portfolio`, `portfolio-overview`. AS-BUILT sections I-1–I-4. |
| Sectoral Analytics | `?view=sectors` | S-2 filter isolation INVARIANT. yfinance free for all. |
| Market Intelligence | `?view=intelligence` | Always unfiltered. Alias `market-intelligence`. M-3 sole earnings calendar. |
| Health & Wellness | `?view=health` | Non-scrolling H-1/H-2/H-3. Incognito. Operational IST date policy. |
| Algorithm Canvas | `?view=builder` | Nav label Algorithm Canvas; chrome title Algorithm Builder. Alias `algorithm-canvas`. |
| Strategies | `?view=strategies` | Alias `strategy-library`. |

### Chrome (not a workspace) — TARGET

| Label | URL | Must not include |
| --- | --- | --- |
| Integrations | `?view=integrations` (alias `settings`) | `DailyKanbanBoard`, industry filters, earnings calendar, Health console |

## 4. Action board (INVARIANT)

Every **workspace** mounts the same `DailyKanbanBoard`: To Do Today / Monitor / Completed Today. I-1 visual contract. No compact or workspace-specific variants. Integration Page does not mount it.

## 5. Success metrics (product, not fabricated live values)

- Freshness strip names failed sources; never claims complete-live when any audit row failed.
- A clean Mac can complete wizard → Kite BYOK → live holdings → S-2 yfinance (Basic ship gate).
- Stratji core places **zero** unattended broker orders. Streak is the only live venue (Pro TARGET).

## 6. Out of scope for this slice

Razorpay, JWT license server, Groww live API, Streak scraping, hosted Mail/Health, public SaaS data plane.

## 7. Non-goals

- Seventh DailyKanbanBoard workspace.
- Cloud storage of broker tokens, Mail, Health, or notes.
- Fake backtest `ran: true`.
- ARKit / DriverKit / HomeKit in v1.
