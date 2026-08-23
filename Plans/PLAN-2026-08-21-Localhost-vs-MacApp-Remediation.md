# Implementation plan — Localhost vs Stratji.app chrome remediation

**Source RCA:** `RCAs/RCA-2026-08-21-Localhost-vs-MacApp.md`  
**Prior status:** `Project-Status/PROJECT-STATUS.md` (99 rows; 91 Done / 5 IP / 3 NI; 2026-08-21 01:22 IST)  
**Prior auditor:** `Code-Reviews/AUDIT-Localhost-vs-MacApp-2026-08-21.md` — **REQUEST CHANGES**  
**Branch / baseline:** `AppKit` @ `cbb3356e846eabd64f713bec4c6431e81a8fec72` + dirty chrome tree  
**Constraint:** Documentation only until an implementation agent is asked to edit production code. Do not commit, push, restart services, kill Flask `:5050`, or replace the Dock binary from this plan-writing step.

**Goal:** One combined workspace+section droplet on each surface. Mac Stratji overlay owns the droplet (full `DashboardOutline` titles). Localhost `:3000` keeps the web CSS droplet. iOS keeps the web droplet. Sectors selection must show S-1 Action Board / Industry Analytics / Decision Framework — never Investment I-1…I-4 chips. Hydrate stays splash-complete + silent; live `:5050` is never recycled.

Honor `AGENTS.md`: six workspaces; freshness in Settings only; no startup-refresh-failed banner; Intelligence is M-1 / M-2 Satya / M-3 only; shared `DailyKanbanBoard`; S-2 filter stays S-2-only.

---

## Success criteria

1. FOUC script: Macintosh + `Stratji/` UA sets `document.documentElement.dataset.nativeOwnsSections = "1"` at first paint. iPhone/iPad + `Stratji/` does **not**. Browser `:3000` (no Stratji UA, no `?nativeChrome=1`) does **not**.
2. CSS: `html[data-native-owns-sections="1"] .workspace-navigation.mode-dial { display:none !important }` remains the hide. Default under `native-chrome-embed` stays flex for iOS / `?nativeChrome=1`.
3. Running Mac process is `apple-app/build/Stratji.app` (mtime ≥ 2026-08-21 01:01, sha256 `f54d46c3c0a06b6fc3b8eff325f5756dc1e1327c7565214b0e9d1247b50cf854` or a newer rebuild), **not** `/Applications/Stratji.app` / `~/Applications/Stratji.app` (20 Aug 12:44, `bd8255ea…`).
4. Hovering Sectors does not expand Sectors section titles while `session.workspace` / `?view=` is Investment. Canvas follows URL.
5. Click Sectors → `?view=sectors&section=s1` → S-1 `DailyKanbanBoard`; three full-name chips. Intel leftover `section=s1` still maps to `m1`.
6. Tests: FOUC Macintosh vs iPhone assertion; renamed nativeChrome test; existing `workspace-routing`, `native-launch-refresh` (no `stop-flask-app.sh`), Intel M-1/M-2/M-3 greps stay green.
7. Flask `:5050` still listening after Stratji quit/relaunch. No `kickoffAtLaunch` bootout of a healthy gateway.
8. Health `stale` (dataDate 2026-08-18 vs target 2026-08-20) is **ops**, not a chrome ticket. Settings still hosts freshness; no main-canvas banner.

---

## Phase 0 — Operator / process (do before claiming the screenshot fixed)

**Owner:** operator. **Code:** none. **Do not kill `:5050`.**

1. Quit Stratji (Dock PID was **88138** `/Applications/Stratji.app` at RCA time).
2. Open `/Users/adityasharma/Documents/GitHub/Investment Dashboard/apple-app/build/Stratji.app` (21 Aug 01:01 Release).
3. Confirm `ps` command path contains `apple-app/build/Stratji.app`, not `/Applications` or `~/Applications`.
4. Optional: copy that app over `/Applications/Stratji.app` and `~/Applications/Stratji.app` so Dock is not a day behind. Bump `CFBundleVersion` on the next Xcode archive so Finder version is not stuck at `202608172145` for both hashes.
5. Pixel-check: one droplet; Sectors → Action Board / Industry Analytics / Decision Framework; canvas is S-1, not I-1.
6. If dual chrome **still** appears on the 01:01 binary, that is the FOUC gap (Phase 1), not “code missing the droplet.”

**Acceptance:** Running binary sha256 matches build (or newer). Flask health still 200.

---

## Phase 1 — P1 FOUC owns-sections (DO NOW, &lt; 30 min)

**Risk:** Low. Behavior change is **desired** for stale Dock + current Flask. Localhost and iOS preserved.

### 1.1 Edit the FOUC script

**File:** `app/layout.tsx` — `nativeChromeFoucScript` (today line 57).

Today:

```javascript
var native = /(?:^|[?&])(?:nativeChrome|native)=(1|true)(?:&|$)/.test(q) || /\bStratji\//i.test(ua);
if (native) {
  document.documentElement.classList.add("native-chrome-embed");
  document.documentElement.dataset.nativeChrome = "1";
}
```

Change to (same IIFE, still no secrets):

- Keep embed + `nativeChrome` when query flag **or** `Stratji/` UA (iOS + Mac + `?nativeChrome=1`).
- **Additionally:** if `/\bStratji\//i.test(ua) && /Macintosh/i.test(ua)`, set `dataset.nativeOwnsSections = "1"`.
- Do **not** set owns-sections for `iPhone` / `iPad` / `iPod`, nor for Macintosh Safari/Chrome without `Stratji/`.
- Do **not** set owns-sections for `?nativeChrome=1` in a desktop browser (dev embed must keep the web cluster).

`page.tsx` hydrate effect (`:715-723`) should **not** delete owns-sections. If it toggles `native-chrome-embed` off for non-native, leave owns-sections alone or delete only when `!nativeChrome`. Do not grow `page.tsx` toward 1000 lines — prefer keeping the rule in FOUC only.

**Do not** change `DashboardBrowser.swift` (iOS must omit owns-sections).  
**Do not** remove Mac `StratjiDocumentBrowser.swift` inject (becomes redundant, still correct).  
**Do not** hide `.workspace-navigation` under all `native-chrome-embed` (would strip iOS).

### 1.2 CSS

**File:** `app/native-chrome.css`

- Keep the flex `!important` default (lines 125–143) for embed without owns-sections.
- Keep the hide block (146–156).
- Update the comment: hide is FOUC Macintosh+Stratji **or** rebuilt inject, not “only a rebuilt binary.”

### 1.3 Tests (same PR as 1.1)

**File:** `tests/rendered-html.test.mjs`

- Rename `"nativeChrome hides web masthead and workspace tabs, keeps in-page sections"` to match reality: hides masthead; workspace tabs remain in DOM; CSS hides them when owns-sections is set.
- Assert `nativeChromeFoucScript` source contains Macintosh + `nativeOwnsSections` (or `dataset.nativeOwnsSections`).
- Assert iPhone is not in that conjunct (negative: setting owns-sections on any `Stratji/` without Macintosh must fail).
- After FOUC change, the hide-selector loop (today `:697-704`) still forbids hiding `workspace-navigation` on **embed-without-owns-sections** selectors. Selectors that include `data-native-owns-sections` **may** hide `workspace-navigation`. Split the loop: embed hide = masthead only; owns-sections hide = workspace-navigation.

**File:** `tests/native-sidebar-click.test.mjs`

- Keep grep of Swift inject.
- Add grep of `layout.tsx` FOUC Macintosh owns-sections so CI does not depend on Dock.

**Do not** add a test that launches Stratji.app.

### 1.4 Acceptance

- `node --test tests/rendered-html.test.mjs tests/native-sidebar-click.test.mjs tests/workspace-routing.test.mjs tests/native-launch-refresh.test.mjs`
- `curl` Flask `/?view=sectors` with UA `… Macintosh … Stratji/1` → HTML/FOUC would set owns-sections (script source contains the assign). With UA `… iPhone … Stratji/1` → no Macintosh conjunct.
- Localhost `:3000` still shows combined droplet + masthead.
- `parseWorkspaceSection("intelligence","s1") === "m1"` still.

---

## Phase 2 — P2 hover must not impersonate selection (DO IN THIS PR IF FEASIBLE)

**Risk:** Low for clicks; hover animation changes (desired).

### 2.1 Mac overlay

**File:** `apple-app/Stratji/StratjiWorkspaceGlassBar.swift`

- `sectionDestinations` must use `session.workspace.rawValue`, **not** `pillWorkspace`.
- Keep `hoveredWorkspace` for `hoverPopScale` / tint on the **workspace** label only.
- `setHover` / `clearHoverIfLeavingCapsule` stay.
- Liquid **and** material fallback (`:232+`) must share the rule — if duplicating the change, do both; prefer extracting `sectionDestinations` once (Phase 4 judo can wait if both call sites use `session.workspace`).

### 2.2 Web cluster (parity)

**File:** `app/dashboard/shared-ui.tsx` `DashboardTabs`

- Expand droplet from `activeIndex` (selected workspace), not `hoverIndex ?? focusIndex ?? activeIndex`.
- `hoverIndex` may still drive scale/z-index on the tab cell.
- Compact chips stay `section.label` (full names), never prefix `I-1` as the visible compact text.

### 2.3 Tests

- `rendered-html` or a small glass-bar grep: `sectionDestinations(forView: session.workspace` (or equivalent) and **doesNotMatch** `forView: pillWorkspace`.
- Optional: `shared-ui` grep that droplet expansion uses `active === workspace.key` rather than `dropletWorkspace` from hover.

### 2.4 Acceptance

Hover Sectors on an Investment document: overlay still shows Investment Action Board / Portfolio / Risk / Axis picks; canvas I-1. Click Sectors: URL and S-1 board update. No screenshot path “Sectors + I-1…I-4.”

---

## Phase 3 — P2 catalog zip + README (FOLLOW-UP if Phase 1+2 fill the PR)

### 3.1 Zip test

Add `tests/native-section-catalog.test.mjs` (or extend `native-sidebar-click`):

| `WORKSPACE_SECTIONS` id | Expected native title (`DashboardOutline` leaf/group `title`) |
|---|---|
| investment i1–i4 | Action Board, Portfolio, Risk, Axis picks |
| sectors s1–s3 | Action Board, Industry Analytics, Decision Framework |
| intelligence m1–m3 | Action Board, Satya, Earnings Calendar |
| health h1–h4 | Action Board, Daily Optimism, Vital Metrics, Calendar + Reminders |
| builder board/canvas/json | Action Board, Canvas, JSON |
| strategies y1–y2 | Action Board, Library |

No M-4. No runtime Swift↔TS bridge.

### 3.2 README / AGENTS operability

**File:** `apple-app/README.md`

- Replace “Native sidebar client” / “WKWebView optional inspector” with: Mac chrome is `StratjiWorkspaceGlassBar` overlay; Flask `:5050` is the document origin.
- Document: if `apple-app/build/Stratji.app` is newer than Dock/`~/Applications`, launch the build (or copy it). Do not kill a healthy `:5050`.
- Note CFBundleVersion does not currently distinguish 20 Aug vs 21 Aug hashes.

### 3.3 `page.tsx` line budget

Do not add chrome branches here. Tabs already live in `shared-ui.tsx`. Next workspace-mount change must not push `page.tsx` over 1000 lines (today 938).

---

## Phase 4 — P3 maintainability (FOLLOW-UP)

1. **Glass-bar judo:** Share HStack/ForEach/button tree; swap `.glassEffect` vs `.ultraThinMaterial` only (`StratjiWorkspaceGlassBar.swift` liquid vs fallback).
2. **Naming:** Pick one visible bar label for workspace 5 (`Canvas` vs `Algorithm Canvas`) and one a11y name; align `AGENTS.md` (“Nav label is Algorithm Canvas; chrome title inside is Algorithm Builder”).
3. **Rename** `nativeChromeHidesSection` → `exclusiveSectionHidden` (behavior unchanged; all six workspaces).
4. **CFBundleVersion** bump on each Release so Dock vs build is visible in Finder.

---

## Phase 5 — Ops (not chrome; do not mix into the FOUC PR)

From RCA freshness ledger (01:28 IST):

| Item | Action |
|---|---|
| Health stale `dataDate=2026-08-18` vs target **2026-08-20** | Run **Health** Apple Shortcut for missing dates; `scripts/import_health_shortcut.py` → `artifacts/private/health-overrides.json`; refresh. If ZIP corrupt, keep last valid `export.xml`. |
| Incremental Mail/Calendar/Reminders/Podcasts `ensure-failed` | Re-run complete refresh after chrome verify; do not invent live. |
| Freshness UI | Settings / Integrations `PulseConstellation` only. No startup-fail banner. |

Inverse-vol / strategy ensemble / I-3 620px radar / S-2 `min-width:1100px` remain status In-Progress / NI from `PROJECT-STATUS.md`. **Out of this plan.**

---

## Implementation sequence (when asked to implement)

```text
Phase 0  operator binary (can run in parallel with coding)
Phase 1  FOUC + tests          ← merge blocker for “chrome parity Done”
Phase 2  hover selected-only   ← same PR if small
Phase 3  catalog zip + README  ← same PR or follow-up
Phase 4  judo / naming         ← follow-up
Phase 5  Health export         ← ops, separate
```

**Stop condition:** Dual chrome gone on **running** `apple-app/build/Stratji.app`; Sectors click shows S-1 and three sector titles; localhost droplet unchanged; Flask still on `:5050`; Intel still M-1/M-2/M-3.

**Do not** implement from this document until the operator asks. After implementation: `$auditor` on the running 01:01 (or newer) process — not Dock.

---

## File checklist

| File | Phase | Change |
|---|---|---|
| `app/layout.tsx` | 1 | FOUC Macintosh owns-sections |
| `app/native-chrome.css` | 1 | Comment; no iOS hide |
| `app/page.tsx` | 1 | Touch only if hydrate strips the flag (avoid) |
| `tests/rendered-html.test.mjs` | 1 | Rename; FOUC assert; split hide-selector loop |
| `tests/native-sidebar-click.test.mjs` | 1–3 | FOUC grep; catalog zip optional |
| `apple-app/Stratji/StratjiWorkspaceGlassBar.swift` | 2, 4 | Selected-only sections; later judo |
| `app/dashboard/shared-ui.tsx` | 2 | Selected-only web droplet |
| `apple-app/README.md` | 3 | Dock vs build |
| `apple-app/Stratji/Info.plist` | 4 | Version bump on next archive |
| Health Shortcut / import scripts | 5 | Ops only |

**Do not edit:** `FlaskServiceSupervisor.kickoffAtLaunch` skip-if-live; `adoptLiveGatewayWithoutRecycle`; Intelligence `m1|m2|m3`; `DailyKanbanBoard`; S-2 isolation; Satya corpus/chat in this chrome PR.
