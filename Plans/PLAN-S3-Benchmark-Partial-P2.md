# Plan — S-3 Factor Benchmark Resilience (P2)

## Problem

`/api/sectors/benchmarks` → `status=partial`  
Insufficient series: **NIFTY Alpha 50**, **NIFTY200 Alpha 30**, **NIFTY100 Low Volatility 30**.  
NSE historical API returns **503**; Yahoo fallback yields 0–1 closes / missing ticker.

## Steps

1. Map exact Yahoo tickers (if any) in `scripts/fetch-sector-benchmarks-yfinance.py`.  
2. Add NSE retry/backoff + session headers; treat 503 as soft-fail.  
3. Cache last-good EOD series; serve as `cached` with as-of.  
4. UI: per-index unavailable/cached chip in `SectorDecisionLab`.  
5. Keep audit accepting `live|partial`.

## Acceptance

Four liquid indices remain live; three factor indices either recover histories or show honest cached/unavailable states without breaking S-3.

## Files

- `scripts/fetch-sector-benchmarks-yfinance.py`  
- `app/api/sectors/benchmarks/route.ts` (if present)  
- `app/dashboard/SectorDecisionLab.tsx`
