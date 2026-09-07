# Plan — SSR Freshness Honesty (P2)

## Problem

SSR footer shows `HealthKit data through 2026-07-16` from hardcoded `fallbackHealth` while validated snapshot is `2026-08-07` (API). Misleads operators and RCA.

## Steps

1. Replace fabricated fallback date with loading/unavailable semantics **or** hydrate initial state from `artifacts/private/health-snapshot.json` on the server.  
2. While `refreshing`, footer should say loading / omit date.  
3. Add/adjust `tests/rendered-html.test.mjs` assertion.  
4. `npm run lint` + focused tests.

## Acceptance

No SSR HTML contains `2026-07-16` after fix; date matches validated snapshot or explicit non-date loading copy.

## Files

- `app/dashboard/utils.ts`  
- `app/page.tsx`  
- `tests/rendered-html.test.mjs`
