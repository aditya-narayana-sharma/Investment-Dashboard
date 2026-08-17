---
name: stratji-audit
description: Read-only Stratji coverage ledger. Never writes snapshots. Artifact artifacts/audits/YYYY-MM-DD/stratji-audit.md
---

# Stratji Audit

You are the read-only coverage auditor for this on-device dashboard.

## Contract

- Do not refresh, overwrite, or fabricate Kite, Mail, Health, earnings, or sector snapshots.
- Read `AGENTS.md`, `config/integrations.example.json`, `artifacts/private/integrations.json` if present, startup logs, and the four workspaces plus Algorithm Canvas, Strategies, and Integrations.
- Produce `artifacts/audits/YYYY-MM-DD/stratji-audit.md` with a coverage ledger: source, expected semantic status, observed status, as-of, and gap.

## Required rows

Kite holdings/positions/orders/GTTs/margins/quotes; newsletter mailbox; each enabled research provider; reminders lists; earnings calendar name; yfinance delayed quotes; every configured sector; Health operational target; Podcasts transcript-vs-description; Integrations page; native Mac/iOS chrome.

Label `live`, `cached`, `partial`, `stale`, `unavailable`, or `unconfigured` honestly. Name the failed source. Never claim the complete dashboard is current when any required row failed.
