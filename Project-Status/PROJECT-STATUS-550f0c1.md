# Project status — Investment Dashboard (Stratji) · post-commit `550f0c1`

**Generated-at:** 2026-08-24 ~16:56 IST (Asia/Kolkata)
**Root:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard`
**Branch:** `AppKit`
**SHA:** `550f0c1` (parent `976503b`) — pushed to `origin/AppKit`
**Working tree:** clean
**This pass:** Localhost vs Mac App sequence **complete** — `$project-status` (976503b, 00:36 IST) → `$auditor` (`Code-Reviews/AUDIT-AppKit-2026-08-24.md`) → `$rca-agent` (`RCAs/2026-08-24-appkit-550f0c1.md`) → this closing status. This snapshot is a **delta** on the 976503b/00:36 ledger for what commit `550f0c1` changed; it does **not** re-derive all 107 dashboard rows or re-audit live surfaces.
**Excluded from walk:** `node_modules`, `.git`, `.next`/`.vinext` caches, `dist`/`build` except Stratji.app mtime, `__pycache__`, `.venv-flask`, Apple `DerivedData*`, `artifacts/private` payloads, large binaries.
**Workspace derivation:** six product surfaces from `app/dashboard/utils.ts` / `workspace-routing.ts` `WORKSPACE_VIEW_VALUES` + `AGENTS.md`. Scanner (`scan_dashboard.py`) confirmed: builder, health, intelligence, investment, sectors, strategies.

**Delta status counts (this commit only):** ✅ Landed **8** (remediation phases) · ⚠️ Open follow-ups **3** (from audit+RCA) · ❌ Regressions **0**. Carried-forward conflicts from the 976503b ledger remain open (see that file).

---

## What changed since `976503b`

The 00:36 IST ledger recorded a **dirty tree** (Satya draft pop-out, story prompts, M-1 weekend evidence window, native glass / document browser). That tree is now committed as **`550f0c1`** (69 files, +5,628 / −916) and pushed. The `$project-status → $auditor → $rca-agent` sequence AGENTS.md requires before claiming Done has now run in full.

| # | Remediation phase (plan Phases 1–8) | Status | Evidence |
|---|---|---|---|
| 1 | Adopt-live launch — `kickoffAtLaunch` skips stop when `serviceReady`; ports-free guard refuses a second stack | ✅ Landed | `FlaskServiceSupervisor.swift`; `tests/native-launch-refresh.test.mjs` ✔ |
| 2 | Web hover no longer impersonates selection (`pillIndex → activeIndex`) | ✅ Landed | `shared-ui.tsx`, `page.tsx`, `utils.ts`; `rendered-html` ✔ |
| 3 | Satya draft pop-out — macOS NSPanel bridge; iOS falls back to web dialog (handler macOS-gated) | ✅ Landed | `StratjiSatyaDraftBridge.swift`, `DashboardBrowser.swift`, `satya-draft-*.ts`; `satya-draft-popout/status` ✔ |
| 4 | Daily-action policy + workspace daily actions (shared board) | ✅ Landed | `daily-action-policy.ts`, `workspace-daily-actions.ts`; suites ✔ |
| 5 | M-1 Monday uses weekend mail as newest-mintable | ✅ Landed | `intelligence-daily-actions.ts`; `intelligence-daily-actions` ✔ |
| 6 | Documents/TCC — no re-`stat` of checkout on `?view=` change | ✅ Landed (mechanism caveat ⚠️ #A) | `StratjiConfiguration.swift`; `stratji-documents-tcc` ✔ |
| 7 | Satya prompt reframed narrative (`EVIDENCE INVENTORY`) | ✅ Landed | `app/satya/chat.ts`; `satya-api` (sampled) ✔ |
| 8 | 1k-line judo — draft state extracted; `satya.css`/`SatyaPresence` kept small | ⚠️ Partial (see #B) | `satya-client.ts` net-flat; `satya.css`/`SatyaPresence` grew |

**Verification:** 38/38 related-suite assertions green this pass (`daily-action-policy`, `workspace-daily-actions`, `satya-draft-popout`, `satya-draft-status`, `intelligence-daily-actions`, `native-launch-refresh`, `stratji-documents-tcc`, `satya-suggestions`).

---

## Open follow-ups (from `$auditor` + `$rca-agent`)

| ID | Item | Sev | Status | Owner surface | Pointer |
|---|---|---|---|---|---|
| **#A** | Documents-Allow persistence is inert under `app-sandbox = false` — sandbox-only entitlements + `.withSecurityScope` bookmarks do nothing; persistence relies on FDA, not the added mechanism. RCA root cause #5 left half-fixed. | **P1** | ⚠️ Open | native / integration | `Stratji.entitlements:37,46`; `StratjiConfiguration.swift:258,168`; RCA §P1 |
| **#B** | 1k-rule breach vs plan criteria — `SatyaPresence.tsx` 1122→1161, `satya.css` 945→1046; plan #8 claimed both under/flat. | P2 | ⚠️ Open | code/docs | audit §P2; decompose `SatyaPresence` into `satya-draft-*` |
| **#C** | RCA scanner double-counts (worktree inside root; 14,730 files). | P3 | ⚠️ Open | tooling | add `.claude/worktrees/` to `scan_dashboard.py` ignore |

---

## Carried-forward conflicts (unchanged by `550f0c1`)

These remain open from the 976503b ledger and were **not** re-adjudicated this pass:
- PRD (Health & Wellness / non-scrolling H-1–H-3) vs current My Feed nav.
- iPhone data-plane: master plan says Tailscale; code uses Bonjour + pairing.
- Kanban three-lane identity vs compact-layout asks (AGENTS.md forbids compact).
- Dock / `/Applications` Stratji.app binaries were 2 days stale at 00:36 IST — **operator action** to recopy `apple-app/build/Stratji.app`; not verifiable from this read-only pass.

## Not re-audited this pass (honest coverage)

Live rendering (desktop / iPhone portrait+landscape), chart & collapsible interaction, S-2 isolation, Kite read-only pulls, Apple Health export, and the PDF route were **not** exercised — services were not running and this pass does not authenticate. Source freshness (Kite/Mail/Health/Sectors/Earnings) stays a Settings/Integrations ops-ledger concern; do **not** read "tests green" as "complete dashboard current."

## Next action

Address **#A** first (it is the only P1 and it is the recurrence of a prior root cause): decide `app-sandbox` on-with-FDA-audit vs off-with-inert-keys-removed, so the manifest and code agree. Then **#B** decomposition, then **#C** scanner ignore. A follow-up **live** RCA is still needed before any workspace surface is called visually verified.
