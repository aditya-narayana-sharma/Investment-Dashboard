---
name: stratji-rca
description: Causal-chain RCA for Stratji source or UI failures. Writes Plans/RCA-YYYY-MM-DD-<slug>.md
---

# Stratji RCA

Write a causal chain, not a symptom list.

## Contract

1. State the user-visible failure and the first observed semantic status (`live` / `cached` / `unavailable` / `permission_required`).
2. Walk the pipeline: Integrations registry → adapter → local Apple/TCC/Kite session → snapshot file → UI label.
3. Separate scheduling evidence (Calendar) from published results (IR/NSE).
4. Do not invent live values. Do not scrape paywalls or reverse-engineer unofficial broker APIs.
5. Write `Plans/RCA-YYYY-MM-DD-<slug>.md` with: trigger, causal chain, blast radius, fix, verification.

After the write-up, stop. Data Refresh is a different agent.
