# RCA → Remediation — AppKit P0/P1/P2 + 1k-line + secrets-only

**Source:** thermonuclear audit canvas · `0296f52` · 19 Aug 2026
**Goal:** Unblock merge. API keys and the license master key never leave the process as HTTP/HTML.

## RCA table (audit findings)

| Workspace | Section | Sub-Section | Function/File | Identified problem | Root cause | Proposed solution |
|---|---|---|---|---|---|---|
| App / Settings | Integrations | LLM keys | `app/local-llm-secrets.ts:213` | Keys leak on Flask hops | Host-OR `isLoopbackRequest` is true after Flask sets `Host: 127.0.0.1` | Flask sets `X-Stratji-Local-Operator` from `remote_addr` only; Next trusts that header + X-Forwarded-For loopback; **GET never serializes keys** |
| App / Settings | License | Master key | `app/license.ts` | Master key in SSR/JSON | `PublicLicense.key` + ungated PUT `author:true` | Drop `key` from public license; PUT author/key requires operator |
| App / LLM | Interrogate | complete | `app/api/llm/complete/route.ts` | Unauthenticated spend/exfil | No gate | Operator required on POST; GET stays availability-only |
| Health | H-2 | Daily Optimism | `content-digest-server.mjs` | Mail live depends on Health Daily note | Deprecated note in `requiredSources` | Remove note from required live set; H-2 uses HealthKit only |
| Stratji | Splash | Refresh | `FlaskServiceSupervisor.swift:155` | Timeout treated as success | `return true` always | Return `terminationStatus == 0` |
| Sectors | Splash | Snapshots | `refresh-dashboard-data.sh:8` | IT/Metals never refresh | `SECTORS` is 11 ids | Use all 13 catalog ids |
| Health | Incremental | Shortcut | `refresh-apple-health.sh:77` | Health Stats skipped | `--if-changed` returns before shortcut import | Import Health Stats even when ZIP unchanged |
| Investment | I-4 / Kite | Authenticate | `kite-auth-presentation.ts:13` | Flask follows 302 | `redirect=1` + urlopen | JSON login URL only (same as AppKit) |
| Tests | Integrations | Loopback | `integrations-workspace.test.mjs:386` | Green test misses Flask hop | No Host header | Assert Flask-shaped request is not enough without operator header; secrets never in JSON |
| Stratji | Shared | Session | `StratjiSessionModel.swift` | Mac session in Shared | Wrong layer | Move session + splash views to `Stratji/` |
| Sectors | Catalog | Identity | six files | 13 ids copied | No `sector-catalog.ts` | Single catalog module |
| S-2 | Breadth table | Hover | `visual-overhaul.css:2209` | Whole table scales | WKWebView table-row transform | Isolate like analyst matrix |
| CSS / workspaces | 1k-line | — | globals, visual-overhaul, Intelligence, Investment, algorithm-builder | Files past 1000 | Dump convention | Extract native-chrome.css, hover-pop.css, split workspace sections, split builder CSS |

## Implementation order

1. Secrets-only API + operator header (P0/P1 security).
2. Splash/Health/Kite/tests (P1).
3. Catalog + Shared move (P1 layout).
4. Hover isolation + CSS/workspace splits (P2 + 1k).
5. Lint, targeted tests, rendered-html.

## Secrets-only contract

- `GET /api/integrations` never includes `openaiApiKey`, `anthropicApiKey`, `geminiApiKey`, `cursorApiKey`.
- `GET /api/license` and SSR `PublicLicense` never include `key`.
- Settings shows “configured” placeholders; PUT writes new keys only on operator requests.
- `POST /api/llm/complete` requires operator; pairing token does not unlock it.
