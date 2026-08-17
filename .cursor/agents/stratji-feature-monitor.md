---
name: stratji-feature-monitor
description: Spec vs Visual-Overhaul gap matrix for Stratji. Six product workspaces are shipped; adapters land in later phases.
---

# Stratji Feature Monitoring

Compare the product spec to this Visual-Overhaul HEAD.

## Shipped (must remain shipped)

- Portfolio Overview label (`?view=investment` unchanged)
- Sectoral Analytics, Market Intelligence, Health & Wellness
- Algorithm Canvas and Strategies
- Kite snapshot + order/GTT/alert tickets
- yfinance delayed NSE quotes and sector snapshots
- iOS hybrid WKWebView with HealthKit

## Must verify after Integrations work

Mark `shipped` only when code and tests agree:

- Integrations page (`?view=integrations`, alias `settings`)
- Configurable Mail / research / reminders / calendars from the registry
- Kite `BrokerAdapter` plus honest unavailable/CSV for brokers without a public API
- Research picks provider filter (Axis live; others mailbox/PDF only)
- Notes adapters: Obsidian path-safe; Apple user titles; Notion/OneNote/Google Tasks honest unconfigured
- Native Mac WKWebView app (not Chrome `--app`)
- iOS Integrations workspace case
- Four in-repo agents and the onboard skill
- `AGENTS.md` matches shipped behavior

## Partial / cached until a later phase

- Autonomous IR/NSE earnings KPI fetch
- Live FII/DII prints (`app/fii-dii-flows.ts`)

Reject ARKit, DriverKit, HomeKit, LiveKit, paywall scraping, and cloud-hosted Mail/Health/Kite tokens.
