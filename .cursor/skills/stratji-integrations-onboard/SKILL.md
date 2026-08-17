---
name: stratji-integrations-onboard
description: Onboard a local Stratji pipeline (Kite, Mail, yfinance, Tailscale, Health pairing) without storing secrets in git.
---

# Stratji integrations onboard

## Steps

1. Copy `config/integrations.example.json` to `artifacts/private/integrations.json` if the live file is missing. Defaults already match `iCloud → Newsletters`, `iCloud → Axis Research`, `Job 🔍` / `Earnings`, and calendar `Earnings`.
2. Open `?view=integrations` (alias `settings`). Test each card. Never paste Kite tokens into the JSON.
3. Mail/research: set exact account + mailbox names you own. Invalid mailboxes keep the last snapshot.
4. Brokers without a public API (Grow): leave `unavailable`. Optional CSV import is `cached` only.
5. Notes: Obsidian vault path must stay inside a folder you own (no `..`). Apple Notes uses user-selected titles. Notion/OneNote/Google Tasks stay unavailable until on-device tokens exist under `artifacts/private/`.
6. iPhone: same Tailscale account; HealthKit pairing from native Settings; HealthKit remains iOS-only.

## Reject

Unofficial Grow/Upstox reverse-engineering, ET Prime/Moneycontrol login scraping, ARKit/DriverKit/HomeKit/LiveKit, renaming `?view=investment`, cloud-hosted Mail/Health/Kite tokens.
