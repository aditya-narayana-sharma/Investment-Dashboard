# Feature suggestions — post `550f0c1` (evidence-grounded)

**Generated-at:** 2026-08-24 IST · **Branch:** `AppKit` @ `550f0c1`
**Basis:** `$auditor` (`Code-Reviews/AUDIT-AppKit-2026-08-24.md`) + `$rca-agent` (`RCAs/2026-08-24-appkit-550f0c1.md`) + code read.
Each item is anchored to code or a finding — nothing here is speculative product wishing. Ranked by leverage (impact ÷ effort). These are engineering/product ideas, not financial advice.

---

## Tier S — close a real gap the audit exposed

### 1. Folder-access **self-test** in Settings → Integrations (from RCA #A)
**Why now:** the Documents-Allow migration is inert under `app-sandbox = false` (`Stratji.entitlements:37`), and the failure is *silent* — the operator can't tell whether persistence came from the (dead) bookmark path or from Full Disk Access.
**Feature:** a one-line capability probe that, on launch, actually writes+reads a token under the checkout and reports in Settings: `Folder access: persisted via {security-scoped bookmark | Full Disk Access | not persisted — will re-prompt}`. Turns a latent P1 into a visible, self-diagnosing state.
**Anchor:** `StratjiConfiguration.swift:250` (`resolveBookmarkedRepoRootLocked`), `FlaskServiceSupervisor` desktop-log breadcrumbs.
**Effort:** S (½ day). **Leverage:** very high — it also de-risks a future `app-sandbox` flip.

### 2. **Launch-state HUD** (adopt-live vs recycled)
**Why now:** `550f0c1` added a genuinely better launch policy (adopt a live `serviceReady` stack; refuse to double-stack after 20s) but its whole signal lives in `~/Library/Logs/PortfolioIntelligence`. The operator can't see *which* path a given launch took.
**Feature:** a small, non-blocking Settings chip — `Data plane: adopted live :3000/:5050 · 16:41` / `recycled (Retry) · …` / `waiting on leftover listeners` — read from the existing breadcrumbs. No new plumbing, just surfacing.
**Anchor:** `FlaskServiceSupervisor.kickoffAtLaunch` / `waitUntilDashboardPortsFree` return value.
**Effort:** S. **Leverage:** high — directly serves the localhost-vs-Stratji drift class this whole remediation targets.

---

## Tier A — extend what just shipped

### 3. Daily-action **"why this card"** provenance trace
**Why now:** `daily-action-policy.ts` already ranks (`actionRank`), dedups (`actionKeysCollide`), and tags source chrome (`sourceChrome`) — the provenance exists but is discarded before the UI.
**Feature:** tap a Smart Action → reveal its triggering evidence (source family, doc title, `receivedAt`, quoted KPI) using the corpus rows `route.ts` already surfaces. Makes the board auditable and reinforces the "never invent CMP/KPI" invariant.
**Anchor:** `daily-action-policy.ts:68` (`sourceChrome`), `app/api/satya/sources/route.ts`.
**Effort:** M. **Leverage:** high — trust in the action board.

### 4. Satya draft pop-out → **pinned multi-turn panel**
**Why now:** `StratjiSatyaDraftBridge` shows the *current turn only* and close-keeps-thread — clean, but single-shot. The retain-safe NSPanel scaffolding is already there.
**Feature:** let the operator pin 2–3 drafts side-by-side (e.g. an earnings answer next to a sector answer) for cross-reading, still macOS-gated with the iOS web-dialog fallback intact.
**Anchor:** `StratjiSatyaDraftPanelController` (`ensurePanel`/`show`), `satya-draft-popout.ts`.
**Effort:** M. **Leverage:** medium-high.

### 5. **Weekend-window contribution badge** on the corpus preview
**Why now:** `route.ts` now flatMaps `intelligenceCorpusPreviewDateKeys()` (prior NSE session → today, inclusive) — correct, but the UI can't tell whether today's board is riding Friday, the weekend, or a fresh Monday digest.
**Feature:** a tiny badge — `Evidence: Fri 22 + Sat 23 + Mon 24` — so M-1 makes its date provenance explicit (matches the AGENTS.md "show exact dates, never infer" rule).
**Anchor:** `intelligence-daily-actions.ts:157`, `app/api/satya/sources/route.ts`.
**Effort:** S. **Leverage:** medium.

---

## Tier B — make the process self-defending

### 6. **Plan-criteria / 1k-rule CI gate**
**Why now:** the audit found the remediation plan marked criterion #8 Done while `SatyaPresence.tsx` (1161) and `satya.css` (1046) regressed past their stated limits — a silent drift a human had to catch.
**Feature:** a CI check (`node --test` sibling or a tiny script) that fails when a named file crosses a declared line budget, with the budgets living next to the code. Converts the subjective "is this file too big" into a tripwire, exactly as the auditor's 1k rule intends.
**Anchor:** audit §P2; `Plans/2026-08-24-localhost-vs-stratji-remediation.md` success criteria.
**Effort:** S. **Leverage:** high (compounding — prevents the next silent breach).

### 7. **Live-RCA harness** (boot → headless capture per workspace/viewport)
**Why now:** both `$auditor` and `$rca-agent` could only verify *code + unit tests* — every live surface (desktop/iPhone portrait+landscape, charts, S-2 isolation, PDF route) was blocked because services weren't running and the pass doesn't authenticate.
**Feature:** a scripted harness that boots the data plane, drives the in-app browser across the six workspace URLs at three viewports, captures DOM dimensions + console errors (not just screenshots), and writes an artifact the next RCA can cite. Closes the RCA's standing "blocked evidence" gap.
**Anchor:** RCA "Residual risks / blocked evidence"; `scan_dashboard.py` (extend, and fix its `.claude/worktrees/` double-count while there — RCA #C).
**Effort:** M–L. **Leverage:** high (every future RCA benefits).

---

## Suggested order
**1 → 2 → 6** first (small, and each kills a class of silent failure the audit surfaced), then **3 / 5** (surface provenance the code already computes), then **4** and **7** (larger builds). Item **1** is also the natural companion to remediation **#A** — ship the fix and its self-test together.
