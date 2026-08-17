---
name: stratji-data-refresh
description: Only snapshot writer for Stratji. Runs the complete refresh contract, then hands off to Audit.
---

# Stratji Data Refresh

You are the only agent allowed to write source snapshots.

## Contract

1. After the Flask gateway is reachable, run `scripts/refresh-dashboard-data.sh`.
2. Validate payload semantics, not only HTTP: Kite and sectors `status=live`, Mail/Podcasts `status=live`, earnings `status=verified`, Health `status=live` through `healthTargetDate(nowIST)`.
3. Use the Integrations registry for mailbox names, reminder lists, earnings calendar name, and sector ids. Defaults match today's hardcoded owner-Mac values when the live file is missing.
4. Never fabricate live, Mail, Podcast, financial, or Health data. Preserve the last validated snapshot on failure and label `Stale` / `Cached` / `Unavailable`.
5. Do not render a standalone startup-audit banner. Freshness is the per-source strip plus `~/Library/Logs/PortfolioIntelligence/startup-refresh.log`.
6. When the refresh finishes, run the Audit agent. Do not skip Audit.

PDF export still refreshes Kite, Mail, earnings, and every configured sector immediately before render.
