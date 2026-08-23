# RCA Report — Localhost vs Stratji.app chrome drift

**Date:** 2026-08-21 · **Audit time:** 01:27–01:32 IST (Asia/Kolkata) · `healthTargetDate` window **D_OVERNIGHT** (00:00–01:59 → prior evening **2026-08-20**)
**Mode:** Read-only chrome/nav/hydrate RCA. No production code edits, commits, pushes, service restarts, or Flask `:5050` kill.
**Incident:** Operator (~01:00 IST 21 Aug) saw Sectors tab selected, I-1…I-4 circular chips, Investment action board, no combined liquid-glass droplet with full names.
**Prior artifacts (cited, not re-run):**

- `$project-status`: `Project-Status/PROJECT-STATUS.md` — 99 rows, **91 Done / 5 IP / 3 NI**. Dock Stratji **20 Aug 12:44** vs `apple-app/build/Stratji.app` **21 Aug 01:01**. Generated 01:22 IST.
- `$auditor`: `Code-Reviews/AUDIT-Localhost-vs-MacApp-2026-08-21.md` — verdict **REQUEST CHANGES**. P1 dual chrome: CSS keeps web droplet unless rebuilt app sets `data-native-owns-sections`; FOUC detects Stratji UA but does not set owns-sections. Hover-preview can show Sectors + I-1 Investment (P2).
**Scanner:** `python3 ~/.codex/skills/rca/scripts/scan_dashboard.py` → `/tmp/dashboard-rca-localhost-mac/` (`rca-inventory.md`, `rca-inventory.json`). Six workspaces from `WORKSPACE_VIEW_VALUES`. Private payloads excluded.



## Executive diagnosis

- **Current health:** `Degraded` (chrome on the running Mac app; Health ops stale is a separate ledger row)
- **Highest severity:** **P1** — dual chrome on Stratji.app because the hide switch lives in a rebuilt WK inject, not in the FOUC path the stale Dock binary actually executes
- **Confirmed root causes:**
  1. **Process:** Operator is running `/Applications/Stratji.app` (20 Aug 12:44, sha256 `bd8255ea…`, **no** `nativeOwnsSections` string). `apple-app/build/Stratji.app` (21 Aug 01:01, sha256 `f54d46c3…`) is the binary that matches source. **Live PID 88138 is still Dock** as of 01:32 IST.
  2. **Code:** `native-chrome.css` forces `.workspace-navigation.mode-dial { display:flex !important }` unless `html[data-native-owns-sections="1"]`. FOUC (`app/layout.tsx`) sets `native-chrome-embed` for any `Stratji/` UA and **never** sets owns-sections. Only Mac `StratjiDocumentBrowser.makeBootstrapScript` injects the flag.
  3. **UX lie (independent of Dock):** `pillWorkspace = hoveredWorkspace ?? session.workspace` paints Sectors section titles over an Investment WK document. Four Investment chips (I-1…I-4 identity) plus I-1 board is the expected canvas when `?view=` stays `investment`.
- **Affected workspaces:** All six, via shared chrome (Investment I-1 is the screenshot surface). Content pipelines, KPI math, S-2 isolation, Intel M-1/M-2/M-3 shape: **not** this incident.
- **Data current through:** Kite **live** authenticated; sectors **live**; earnings **verified**. HealthKit **stale** (`dataDate=2026-08-18` vs operational target **2026-08-20**). Incremental tick at 01:28 IST also marked Mail/Podcasts/Calendar/Reminders **partial**. **Complete dashboard is not current.** Health/Mail gaps are **ops**, not chrome.
- **Main residual risk:** Copying `apple-app/build` to Dock without the FOUC fix leaves the next stale-binary class of incident open. Hover-preview remains a current-source way to screenshot “Sectors + Investment board” even on the 01:01 app.

This is **not** an Intel→S-1 leftover (`parseWorkspaceSection("intelligence","s1")` → `"m1"`), **not** a Flask-kill path, **not** localhost `:3000` missing the combined droplet, and **not** a fifth Market Intelligence section.

---



## Findings



### [P1] Running Dock Stratji loads today’s Flask HTML without `nativeOwnsSections` → two chrome rows

- **Status:** Confirmed
- **Confidence:** High
- **Affected:** Cross-cutting chrome → all six workspaces → combined droplet / `DashboardTabs`
- **Symptom:** Native overlay (workspace pills, selected **Sectors**) stacked on web `DashboardTabs` (Investment I-1…I-4 circular chips). Canvas is Investment action board. No single combined liquid-glass droplet with full names.
- **Reproduction:** Live process `88138` = `/Applications/Stratji.app/Contents/MacOS/Stratji` started **01:19:48 IST**. Binary mtime **2026-08-20 12:44:30**, size **9592656**. `strings` has `StratjiWorkspaceGlassBar` / `_hoveredWorkspace` / NativeRoute `history.replaceState` and **does not** contain `dataset.nativeOwnsSections`. Flask `:5050` (PID **88565**, started 01:20:00) serves current CSS. `GET http://127.0.0.1:5050/?view=sectors&nativeChrome=1` with Stratji UA: `workspace-navigation` present, `dataset.nativeOwnsSections` **absent** from HTML/FOUC.
- **Observation/evidence:** Status table (`Project-Status/PROJECT-STATUS.md` lines 24–32). Auditor P1 (`AUDIT-Localhost-vs-MacApp-2026-08-21.md` findings). Binary hashes: Dock/`~/Applications` identical `bd8255ea808746d981370fb182ac986d4633c03e5709d88239e694c4ec5dc529`; build `f54d46c3c0a06b6fc3b8eff325f5756dc1e1327c7565214b0e9d1247b50cf854`. CFBundleVersion both `202608172145` — **version does not distinguish builds**.
- **Proximate mechanism:** CSS last-wins hide is gated on a dataset flag the Dock WKUserScript never writes. FOUC already knows `Stratji/` but only adds `native-chrome-embed`. React `page.tsx` hydrate also toggles embed / `data-nativeChrome` and never owns-sections. `page.tsx:797` always mounts `<DashboardTabs>` under nativeChrome (tests **require** this).
- **Root cause:** The Mac-only hide contract was implemented as “a rebuilt binary injects a flag,” not as “first-paint FOUC: Macintosh + Stratji UA owns the overlay droplet.” Stale Dock plus current Flask is therefore sufficient.
- **Trigger:** Operator launched Dock `/Applications/Stratji.app` (still running). Screenshot ~01:00 IST; process still Dock at 01:32.
- **Contributing factors:** Tests freeze the hedge (`rendered-html` hide-selectors must match `masthead` only; must **not** mention `workspace-navigation`). iOS correctly omits owns-sections (`DashboardBrowser.swift:134-139`) so the CSS default cannot become “hide under any native-chrome-embed.” No Dock-vs-build warning in the running app. README still says “Native sidebar client.”
- **User impact:** Dual bars; Sectors selection does not look like the localhost combined droplet; Investment I-1 board appears under a Sectors pill.
- **Corrective action:** FOUC: if `/\bStratji\//.test(ua) && /Macintosh/.test(ua)`, set `dataset.nativeOwnsSections="1"`. Keep iOS and `:3000` browsers on the web cluster. Quit Dock; open `apple-app/build/Stratji.app` until FOUC ships. Do **not** kill `:5050`.
- **Verification:** After FOUC, Stratji UA + Macintosh HTML has `data-native-owns-sections="1"` without WK inject. iPhone UA does not. Localhost `:3000` still shows masthead + combined droplet. Running binary mtime ≥ 21 Aug 01:01 **and** no web `.workspace-navigation` visible in Mac WKWebView.
- **Code:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard/app/native-chrome.css:125-156` · `app/layout.tsx:57` · `app/page.tsx:715-723,797` · `apple-app/Shared/StratjiDocumentBrowser.swift:135-147` · `tests/rendered-html.test.mjs:614-704`
- **Source:** Live `stat`/`strings`/`ps`/`curl` 2026-08-21 01:27–01:32 IST



### [P1] Four Investment chips under a Sectors pill because the WK document stayed on Investment

- **Status:** Confirmed (mechanism) · screenshot path = Dock dual chrome **plus** overlay/URL desync
- **Confidence:** High
- **Affected:** Investment I-1 canvas + Sectoral overlay chrome
- **Symptom:** Overlay **Sectors** selected; web chips **I-1…I-4** (Investment has four sections; Sectors has three); board title **Investment action board**.
- **Reproduction:** Compact web chips are `border-radius:999px` (`globals.css:288-292`). `WORKSPACE_SECTIONS.investment` is i1–i4. `CollapsibleSection` paints a 36×36 `I-1` square (`shared-ui.tsx:562-563`, `globals.css:582`). `nativeChromeHidesSection` keeps sibling I-2/I-3/I-4 **hidden** when `activeSection` defaults to `i1` — so the canvas is the I-1 board, and the four circular controls are the **web Investment droplet**, not S-1/S-2/S-3. Localhost `GET :3000/?view=sectors` SSR has **S-1** and **no I-1** — localhost is not wrong when the URL is actually sectors.
- **Observation/evidence:** `DashboardTabs` `pillIndex = hoverIndex ?? focusIndex ?? activeIndex` (`shared-ui.tsx:377`). Native `pillWorkspace = hoveredWorkspace ?? session.workspace` (`StratjiWorkspaceGlassBar.swift:36-38`). Section highlight requires `destination.view == session.workspace.rawValue` (`:200-203`) — hovered Sectors droplet has **no** selected chip. `page.tsx` `hidden={workspace !== "investment"}` (`:826`) follows URL, not overlay hover.
- **Proximate mechanism:** Overlay chrome and WK `?view=` are not one source of truth during hover (current source) and are additionally stacked as two bars on Dock (P1 above). Click path in **current** source does `session.select` → `document.load` → `DashboardNativeRoute.apply` (`replaceState` + `stratji:navigate`). Dock **has** NativeRoute strings, so a completed click **can** retarget the SPA; the screenshot’s four Investment chips mean the document was still `investment` (hover, or overlay selected without the URL commit).
- **Root cause:** Combined droplet preview uses **hover workspace** for section titles while the document stays on **selected** workspace. Dual chrome made that lie look like “Sectors tab + I-1 chips.”
- **Trigger:** Hovering Sectors (or selecting Sectors in overlay without URL sync) while Investment remained the WK view.
- **Contributing factors:** Dock overlay may lack current `Decision Framework` string (present in 01:01 build, absent in Dock `strings`) — 20 Aug overlay is not the full-name combined droplet even after FOUC hides the web cluster.
- **User impact:** Operator cannot tell which workspace is real. Clicking a web I-n chip would mutate Investment, not Sectors.
- **Corrective action:** Preview only the **selected** workspace’s sections; hover = scale/tint on the workspace label. FOUC hide (P1) so Mac has one droplet. Operator must launch the 01:01 binary for native full names (`Action Board`, `Industry Analytics`, `Decision Framework`).
- **Verification:** Hover Sectors while `?view=investment&section=i1`: overlay still shows Investment Action Board / Portfolio / Risk / Axis picks; canvas stays I-1. Click Sectors: URL `?view=sectors&section=s1`, canvas S-1 `DailyKanbanBoard`, three sector titles.
- **Code:** `apple-app/Stratji/StratjiWorkspaceGlassBar.swift:36-42,176-179,417-428` · `app/dashboard/shared-ui.tsx:371-478` · `app/dashboard/InvestmentWorkspace.tsx:239-243` · `app/page.tsx:588-594,826`
- **Source:** Auditor P2; live HTML `view=sectors` vs screenshot four-chip Investment identity



### [P2] Hover preview of a foreign workspace is a current-source screenshot path (even on 01:01 build)

- **Status:** Confirmed
- **Confidence:** High
- **Affected:** Mac overlay + localhost web cluster (in-flow, less severe)
- **Symptom:** Same Sectors-on-Investment composition without a stale binary.
- **Reproduction:** `setHover` never clears on `hovering: false` except `clearHoverIfLeavingCapsule` (`StratjiWorkspaceGlassBar.swift:417-428`). Web `onMouseEnter` → `setHoverIndex` (`shared-ui.tsx:433`).
- **Root cause:** Droplet expansion was bound to hover workspace, not selected workspace.
- **Corrective action:** Bind section droplet to `session.workspace` / `active`. Keep hover pop scale.
- **Verification:** Pixel: overlay titles match `?view=`. Tests: glass bar `pillWorkspace` must not use hover for `sectionDestinations` (or equivalent).
- **Code:** `StratjiWorkspaceGlassBar.swift:36-42` · `shared-ui.tsx:377,413`
- **Source:** Auditor P2



### [P2] Tests pin the dual-chrome hedge and cannot see Dock vs build

- **Status:** Confirmed
- **Confidence:** High
- **Affected:** CI / chrome contract
- **Symptom:** `rendered-html` test name “hides … workspace tabs” asserts the opposite: `DashboardTabs` still rendered; CSS `display:flex !important`; hide loop forbids `workspace-navigation`. `native-sidebar-click` greps Swift source for `dataset.nativeOwnsSections = '1'` — green while Dock runs a binary without that string.
- **Root cause:** Tests encode “web cluster stays unless inject” as the product contract.
- **Corrective action:** Rename test. Assert FOUC Macintosh+Stratji sets owns-sections; iPhone+Stratji does not. Optional README: Dock/`~/Applications` mtimes must be ≥ `apple-app/build`. Do not launch Stratji.app from CI.
- **Code:** `tests/rendered-html.test.mjs:614-704` · `tests/native-sidebar-click.test.mjs:33`
- **Source:** Auditor P2 tests finding



### [P2] Section catalog duplicated (Swift outline vs TS `WORKSPACE_SECTIONS`)

- **Status:** Confirmed
- **Confidence:** High
- **Affected:** All six workspace droplets
- **Symptom:** Native titles from `DashboardOutline` children; web compact chips from `WORKSPACE_SECTIONS` (`compact ? section.label`). Today they match. Nothing compiles them together. Dock binary already missing `Decision Framework` string vs build.
- **Root cause:** Two tables, no zip test.
- **Corrective action:** Test that zips `sectionDestinations` titles to `WORKSPACE_SECTIONS[].label`. Do not add a runtime bridge.
- **Code:** `apple-app/Outline/DashboardOutline.swift:326-377` · `app/dashboard/workspace-routing.ts:274-306`
- **Source:** Auditor P2 catalog finding



### [P3] Algorithm Canvas naming split; README still says sidebar; liquid/fallback copy-paste

- **Status:** Confirmed
- **Confidence:** High
- **Affected:** Algorithm Canvas chrome copy; `apple-app/README.md`; `StratjiWorkspaceGlassBar` liquid vs material
- **Symptom:** Visible bar `Canvas`; a11y web `Algorithm Canvas`; native help `Algorithm Builder`. README: “Native sidebar client” / “WKWebView is an optional inspector” — false after glass-bar overlay. Liquid and fallback droplet UIs duplicated (~160 lines).
- **Root cause:** Copy and README not updated with overlay chrome. `#available(macOS 26)` split copied the whole HStack.
- **Corrective action:** FOLLOW-UP. Align AGENTS vs barLabel. Fix README launch path (`apple-app/build/Stratji.app` vs Dock). Share button tree; swap only glass vs material.
- **Code:** `StratjiWorkspace.swift:26-34` · `utils.ts:583-589` · `apple-app/README.md:7` · `StratjiWorkspaceGlassBar.swift:70` vs `:232`



### [P3] Hydrate/Retry vs live Flask is code-fixed; splash return is ops/binary

- **Status:** Confirmed (code) · Not reproduced as a new hydrate race this pass
- **Confidence:** High (code path) / Medium (live splash — did not attach to the Stratji window)
- **Affected:** Launch splash / Integrations freshness
- **Symptom:** Historical “Retry” / splash return. Current: `kickoffAtLaunch` skips if `/_flask/health` reachable (`FlaskServiceSupervisor.swift:51-56`); `adoptLiveGatewayWithoutRecycle` does not bootout (`:278`). Post-hydrate `refreshAll(false, { silent: true })` (`page.tsx:764-767`). `applicationDidBecomeActive` incremental only (`AppDelegate.swift:111-115`). Live Flask **88565** healthy `{status:ok, upstream:3000, upstreamStatus:200}`. Stratji Dock started 12s before Flask — splash waited; complete refresh finished **01:22:59 IST** with Health failed (1 failure); incremental **01:28:09** Failures **2**.
- **Root cause (historical):** Recycle of live `:5050`. **Not present** in current supervisor.
- **User impact this pass:** None from Flask-kill. Health still stale after hydrate (ops).
- **Corrective action:** Do not recycle `:5050`. Do not treat hydrate as the chrome fix.
- **Code:** `FlaskServiceSupervisor.swift:51-56,112-119,278` · `page.tsx:764-767` · `tests/native-launch-refresh.test.mjs`
- **Source:** `~/Library/Logs/PortfolioIntelligence/startup-refresh.log` (sanitized); `curl :5050/_flask/health`

---



## 5 Whys (incident)


| #   | Why                                                      | Answer                                                                                                                                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Why Sectors selected + I-1…I-4 chips + Investment board? | Overlay chrome showed Sectors; WK document stayed `?view=investment` (hover or uncommitted select); Investment droplet has four circular chips; exclusive section shows I-1 board.                                                                                                                                                        |
| 2   | Why two chrome rows instead of one combined droplet?     | Native glass bar **and** web `DashboardTabs` both painted. CSS keeps the web cluster visible without `data-native-owns-sections`.                                                                                                                                                                                                         |
| 3   | Why didn’t the Mac hide the web cluster?                 | Only a rebuilt WK inject sets owns-sections. FOUC detects `Stratji/` but does not set the flag. Running app is Dock **20 Aug 12:44**, which lacks the inject.                                                                                                                                                                             |
| 4   | Why is Dock not the 01:01 build?                         | `/Applications` and `~/Applications` were not replaced after building `apple-app/build/Stratji.app`. Bundle version `202608172145` is identical — Finder version is useless.                                                                                                                                                              |
| 5   | Why can this recur after replacing Dock?                 | Hide still depends on the inject. Next stale copy of Stratji.app against newer Flask CSS repeats dual chrome. Hover-preview still lies on the new binary. **Root (prevent recurrence):** first-paint Macintosh+Stratji FOUC owns-sections + selected-only droplet + operator launches `apple-app/build` (or a copy with matching sha256). |


---



## Scope and baseline

- **Project root:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard`
- **Canonical runtime:** Flask `http://127.0.0.1:5050` (PID **88565**, waitress, upstream vinext `:3000` PID **88554**). **Do not kill.**
- **Branch/commit:** `AppKit` @ `cbb3356e846eabd64f713bec4c6431e81a8fec72` + dirty chrome/Satya tree (working-tree files audited, not HEAD-only)
- **Comparison baseline:** `$project-status` 01:22 IST + `$auditor` REQUEST CHANGES + live binaries/process
- **Audit time:** 2026-08-21 01:27–01:32 IST
- **URLs:** `http://127.0.0.1:3000/?view=sectors` (browser UA); `http://127.0.0.1:5050/?view=sectors&nativeChrome=1` (Stratji UA); `/_flask/health`
- **Private-data handling:** No snapshot bodies, mail, health values, or tokens in this report. Freshness log excerpted as status lines only.
- **Excluded/unavailable:** Pixel attach to the live Stratji window (no Computer Use this RCA). iPhone portrait/landscape not painted. Tailscale URL not fetched. Did not launch `apple-app/build/Stratji.app` (would compete with Dock). Did not run `npm run lint`/`build` (read-only; auditor already sampled tests).

---



## Change map


| Change group                       | Files                                                                                                                                                                                                                                                                                   | Affected surfaces                    | Risk                       | Tests                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------- |
| Uncommitted chrome (this incident) | `native-chrome.css` +54; `layout.tsx` FOUC; `page.tsx` tabs always-on; `shared-ui.tsx` DashboardTabs; `workspace-routing.ts`; `StratjiDocumentBrowser.swift` inject; `StratjiWorkspaceGlassBar.swift` +270 hover droplet; `FlaskServiceSupervisor.swift` +193; `DashboardOutline.swift` | Mac overlay vs web cluster vs launch | **P1** dual chrome if Dock | `rendered-html`, `native-sidebar-click`, `native-launch-refresh`, `workspace-routing` |
| Deployment drift                   | `/Applications/Stratji.app` = `~/Applications/Stratji.app` 20 Aug 12:44 vs `apple-app/build/Stratji.app` 21 Aug 01:01                                                                                                                                                                   | Operator Mac window                  | **P1** process             | None (source-grep only)                                                               |
| Runtime                            | Flask 88565 live; Stratji 88138 Dock; Health stale in startup-refresh.log                                                                                                                                                                                                               | Freshness / splash                   | Ops (Health)               | —                                                                                     |
| Unrelated dirty (Satya/MI/license) | `app/satya/*`, digest, Groww JWT, etc.                                                                                                                                                                                                                                                  | M-2 content, not chrome              | Out of scope               | satya-* tests                                                                         |
| Generated / private                | `.next`/`.vinext`, `artifacts/private`                                                                                                                                                                                                                                                  | Excluded                             | —                          | —                                                                                     |


---



## Workspace and section coverage (chrome / nav / hydrate)

Scanner collapsibles: I-1…I-4, S-1 (+ S-2/S-3 in workspace), M-1…M-3, H-1…H-4, builder board/canvas/json, strategies y1/y2. Integrations is chrome, not a seventh workspace.


| Workspace           | Section               | Children                              | Collapsible    | Sources                | States tested (this RCA)                               | Result                                                          |
| ------------------- | --------------------- | ------------------------------------- | -------------- | ---------------------- | ------------------------------------------------------ | --------------------------------------------------------------- |
| Investment          | I-1                   | `DailyKanbanBoard`                    | yes            | Kite/actions           | Dual chrome + exclusive `hidden=`                      | **P1** screenshot surface; board correct for `?view=investment` |
| Investment          | I-2…I-4               | Portfolio/Risk/Axis                   | yes            | Kite/Axis              | Exclusive hide when `section=i1`                       | Hidden by design; not a native-only bug                         |
| Sectoral Analytics  | S-1                   | Kanban                                | yes            | sectors                | Localhost `?view=sectors` SSR has S-1                  | URL-correct; overlay can lie                                    |
| Sectoral Analytics  | S-2 / S-3             | Analytics / Decision Lab              | yes            | sectors                | Isolation not re-audited                               | Chrome-only; S-2 filter not this incident                       |
| Market Intelligence | M-1 / M-2 Satya / M-3 | Kanban / briefing / calendar          | yes            | digest/corpus/earnings | Outline no M-4; Intel leftover → m1                    | **OK** product shape                                            |
| My Feed             | H-1…H-4               | Kanban / optimism / vitals / calendar | yes            | HealthKit/Cal/Rem      | Hydrate Health stale                                   | **Ops stale**, chrome OK                                        |
| Algorithm Canvas    | board / canvas / json | Kanban / Symphony / JSON              | exclusive tabs | local trees            | Naming Canvas vs Algorithm Canvas                      | **P3** copy                                                     |
| Strategies          | y1 / y2               | Kanban / library                      | exclusive      | Composer trees         | —                                                      | Chrome shared; NI compare/ensemble out of scope                 |
| Settings            | integrations          | PulseConstellation                    | n/a            | freshness API          | No main-canvas freshness strip; no startup-fail banner | **OK**                                                          |


---



## Tabular RCA — chrome / nav / hydrate surfaces


| Workspace           | Section          | Sub-Section                | Function/File Name                                     | Identified Problem                                                         | Root Cause                                                                   | Proposed Solution                                                            |
| ------------------- | ---------------- | -------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Cross-cutting       | Combined droplet | Mac overlay vs web cluster | `native-chrome.css` `:125-156`                         | Web `.workspace-navigation` stays `display:flex !important` on Stratji.app | Hide gated on `data-native-owns-sections`; CSS comments say “rebuilt binary” | FOUC Macintosh+`Stratji/` sets owns-sections; CSS hide follows               |
| Cross-cutting       | Combined droplet | First paint                | `layout.tsx` `nativeChromeFoucScript` `:57`            | FOUC sets embed + `nativeChrome`, never owns-sections                      | UA detection used only for masthead hide                                     | Add Macintosh conjunct; leave iPhone on web droplet                          |
| Cross-cutting       | Combined droplet | React hydrate              | `page.tsx` `:715-723`                                  | Hydrate reaffirms embed, never owns-sections                               | Flag treated as WK-only                                                      | Same FOUC/dataset; do not require inject                                     |
| Cross-cutting       | Combined droplet | Mount                      | `page.tsx` `:797` `DashboardTabs`                      | Tabs always mounted under nativeChrome                                     | iOS/localhost `?nativeChrome=1` need the web cluster; tests pin always-on    | Keep mount; hide with owns-sections on Mac only                              |
| Cross-cutting       | Combined droplet | iOS                        | `DashboardBrowser.swift` `:134-139`                    | iOS has no overlay droplet                                                 | Intentional; must not set owns-sections                                      | Keep; FOUC must test `Macintosh` not merely `Stratji/`                       |
| Cross-cutting       | Combined droplet | Mac inject                 | `StratjiDocumentBrowser.swift` `:140`                  | Inject exists only in 21 Aug 01:01 binary                                  | Dock 12:44 lacks string                                                      | FOUC makes inject redundant; still launch matching binary for overlay titles |
| Cross-cutting       | Combined droplet | Operator binary            | `/Applications/Stratji.app` PID 88138                  | Live app is 20 Aug 12:44; build is 21 Aug 01:01                            | Dock/`~/Applications` not replaced; bundle version identical                 | Quit Dock; open `apple-app/build/Stratji.app`; copy over Applications        |
| Cross-cutting       | Combined droplet | Hover                      | `StratjiWorkspaceGlassBar.swift` `pillWorkspace` `:36` | Sectors titles over Investment document                                    | `hoveredWorkspace ?? session.workspace`                                      | Section droplet from `session.workspace` only                                |
| Cross-cutting       | Combined droplet | Web hover                  | `shared-ui.tsx` `DashboardTabs` `:377`                 | Same hover-index trick in-flow                                             | Droplet bound to hover                                                       | Bind to `active`; hover = scale only                                         |
| Cross-cutting       | Combined droplet | Chip shape                 | `globals.css` `:288-292` `:582`                        | Operator saw circular I-1…I-4                                              | Capsule chips + 36px `I-1` heading                                           | Full names already in compact `section.label`; hide web cluster on Mac       |
| Investment          | I-1              | Action Board               | `InvestmentWorkspace.tsx` `:239-243`                   | I-1 board under Sectors pill                                               | `workspace` from URL `investment`; exclusive i1                              | Fix overlay/URL coupling; not Kanban                                         |
| Investment          | I-1…I-4          | Web chips                  | `workspace-routing.ts` `WORKSPACE_SECTIONS` `:275-280` | Four chips identify Investment not Sectors                                 | URL still investment                                                         | Click/select must commit `?view=`; hover must not look committed             |
| Investment          | I-2…I-4          | Exclusive hide             | `nativeChromeHidesSection` `:512-514`                  | Name suggests native-only                                                  | Shared exclusive-section contract                                            | Rename later; do not fork Kanban                                             |
| Sectoral Analytics  | S-1              | Overlay select             | `session.select` + `defaultDestination`                | Click should load S-1                                                      | Hover can look like select without `select()`                                | Selected-only droplet                                                        |
| Sectoral Analytics  | S-2              | Industry Analytics         | `DashboardOutline.swift` `:349`                        | Dock `strings` missing `Decision Framework`                                | Stale overlay catalog                                                        | Launch 01:01 build                                                           |
| Sectoral Analytics  | S-3              | Decision Framework         | Dock vs build strings                                  | 20 Aug overlay incomplete vs source                                        | Binary drift                                                                 | Same                                                                         |
| Market Intelligence | M-1…M-3          | Leftover `section=s1`      | `parseWorkspaceSection` `:366-367`                     | Prior Intel→S-1 screenshot                                                 | **Not** leftover map; hybrid desync                                          | Parser stays; tests already pin m1                                           |
| Market Intelligence | M-2              | Satya                      | Outline `intelligence/m2`                              | Not a fifth section                                                        | Product already M-1/M-2/M-3                                                  | No chrome change                                                             |
| Market Intelligence | —                | No M-4                     | `native-sidebar-click.test.mjs` `:18-21`               | —                                                                          | —                                                                            | Keep                                                                         |
| My Feed             | H-1…H-4          | Hydrate freshness          | `startup-refresh.log`                                  | Health `stale` dataDate 2026-08-18 vs target 2026-08-20                    | Export/Shortcut not through D_OVERNIGHT target                               | Ops: Health Shortcut for 2026-08-20; not chrome                              |
| Algorithm Canvas    | barLabel         | Canvas vs Algorithm Canvas | `StratjiWorkspace.swift` `:32` · `utils.ts` `:588`     | Three-way name split                                                       | Docs vs compact label                                                        | FOLLOW-UP copy                                                               |
| Strategies          | y1/y2            | Shared chrome              | same hide/hover                                        | Dual chrome applies                                                        | Same P1/P2                                                                   | Same FOUC + hover                                                            |
| Settings            | Integrations     | PulseConstellation         | `IntegrationsWorkspace` / `page.tsx`                   | Freshness not on main canvas                                               | Already Settings-only; no startup-fail banner (`rg` empty)                   | Keep                                                                         |
| Launch              | Splash           | Complete refresh           | `FlaskServiceSupervisor.runCompleteRefresh`            | Health failed during splash                                                | Ops export gap                                                               | Do not recycle Flask                                                         |
| Launch              | Kickoff          | Live gateway               | `kickoffAtLaunch` `:53-56`                             | —                                                                          | Skip dash-start if healthy                                                   | Do not kill `:5050`                                                          |
| Launch              | Retry            | Hydrate                    | `waitForDocumentReady` / `page.tsx` silent refresh     | Prior race code-fixed                                                      | Splash wait while Flask 01:20 came up after Stratji 01:19                    | Leave supervisor; operator Retry only if document error                      |
| Tests               | Chrome contract  | Hide selectors             | `rendered-html.test.mjs` `:697-704`                    | CI green on screenshot incident                                            | Tests require web cluster visible                                            | Assert FOUC owns-sections Macintosh                                          |
| Tests               | Inject grep      | Source only                | `native-sidebar-click.test.mjs` `:33`                  | Cannot fail on Dock binary                                                 | Source ≠ running process                                                     | Document sha256/mtime; FOUC test                                             |
| Docs                | README           | Stratji role               | `apple-app/README.md` `:7`                             | “sidebar / optional WKWebView”                                             | Overlay is the Mac chrome                                                    | Document Dock vs `apple-app/build`                                           |


---



## Rendering and interaction


| Surface                           | Desktop                                                               | iPhone portrait  | iPhone landscape | Console/API              | Finding                       |
| --------------------------------- | --------------------------------------------------------------------- | ---------------- | ---------------- | ------------------------ | ----------------------------- |
| Localhost `:3000` `?view=sectors` | Combined web droplet; masthead; S-1 in SSR; no `data-native-chrome=1` | n/a this pass    | n/a              | HTML 55330 bytes         | **Correct** for browser       |
| Localhost `?nativeChrome=1`       | Masthead hidden; **web** droplet stays; padding-top 96px              | n/a              | n/a              | Auditor + CSS `:100-102` | Intended iOS/dev embed        |
| Flask `:5050` Stratji UA          | Same HTML as nativeChrome; FOUC script **no** owns-sections           | n/a              | n/a              | `/_flask/health` 200     | Mac needs inject **or** FOUC  |
| Dock Stratji.app                  | Dual chrome; hover lie; 20 Aug overlay                                | n/a              | n/a              | PID 88138                | **Incident**                  |
| `apple-app/build/Stratji.app`     | Inject present; overlay full names in source                          | n/a              | n/a              | mtime 01:01:15           | **What operator should open** |
| iOS WKWebView                     | Web combined cluster                                                  | Not pixel-tested | Not pixel-tested | No owns-sections         | Keep web droplet              |


Charts/KPI alignment: not in this chrome incident. Density leftovers (I-3/I-4 620px radar, S-2 table min-width) remain status **In-Progress** (`PROJECT-STATUS.md`) and are **not** dual-chrome.

---



## Source freshness ledger

Operational target at 01:28 IST: Health **D_OVERNIGHT** = **2026-08-20**. Evidence: `~/Library/Logs/PortfolioIntelligence/startup-refresh.log`.


| Source                               | Required-through            | Observed-through                       | Ingested-at                   | Status                       | Evidence                                                  | Gap                                                              |
| ------------------------------------ | --------------------------- | -------------------------------------- | ----------------------------- | ---------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| Kite                                 | live session                | live · authenticated                   | 01:22:59 / 01:28:09           | **live**                     | log `status=live · auth=authenticated`                    | none                                                             |
| Sectors (14) + news + NSE benchmarks | live                        | live                                   | same                          | **live**                     | log rows OK                                               | none                                                             |
| Earnings                             | verified                    | verified                               | same                          | **verified**                 | log                                                       | none                                                             |
| Mail + Podcasts                      | live                        | live at 01:22:59; **partial** 01:28:09 | incremental tick              | **partial** (tick)           | complete OK then incremental FAILED                       | ops tick; not chrome                                             |
| Calendar / Reminders / Axis mailbox  | live                        | ensure-failed on incremental           | 01:28:09                      | **stale/unavailable** (tick) | log `ensure-failed`                                       | ops; not chrome                                                  |
| HealthKit operational snapshot       | live through **2026-08-20** | `dataDate=2026-08-18`                  | ZIP unchanged skip re-extract | **stale**                    | log `expected=live through operational target 2026-08-20` | Operator Shortcut/export for 19–20 Aug. **Not this chrome RCA.** |


Do not claim the complete dashboard is updated. Do not render a startup-refresh-failed banner (none in tree). Communicate via Settings / Integrations.

---



## Cross-section reconciliation


| Entity/metric      | Surfaces compared                                  | Expected                                                              | Observed                                   | Difference                       | Cause                               |
| ------------------ | -------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------ | -------------------------------- | ----------------------------------- |
| Selected workspace | Overlay vs `?view=` vs canvas                      | One workspace                                                         | Overlay Sectors; URL/canvas Investment     | Desync                           | Hover / dual chrome                 |
| Section chips      | Overlay vs web vs Sectors catalog                  | 3 full names (Action Board / Industry Analytics / Decision Framework) | 4 Investment circular chips                | Wrong workspace’s chips          | Web cluster on Investment           |
| Intel leftover s1  | `parseWorkspaceSection` vs screenshot 20 Aug 23:38 | m1                                                                    | Parser returns m1                          | Prior hybrid desync, not map bug | Same overlay≠URL class              |
| Binary identity    | Dock vs build vs bundle version                    | Matching mtime/sha                                                    | Version both `202608172145`; hashes differ | Version useless                  | No CFBundle bump on rebuild         |
| Flask              | Status 01:22 PID 65110 vs now 88565                | One live gateway                                                      | 88565 since 01:20:00                       | PID rolled at Stratji launch     | Supervisor start-only; left running |


---



## Desktop vs Mac


| Concern           | Localhost desktop (`:3000` / browser) | Stratji.app Mac                           | Ruling                                           |
| ----------------- | ------------------------------------- | ----------------------------------------- | ------------------------------------------------ |
| Combined droplet  | Web CSS droplet; full `section.label` | Native `GlassEffectContainer` (macOS 26+) | Two implementations are correct; **one visible** |
| Who hides web nav | No overlay; nav visible               | Must hide when overlay owns sections      | Broken on Dock + current CSS                     |
| Masthead          | Visible                               | Hidden (`native-chrome-embed`)            | OK                                               |
| Freshness strip   | Settings only                         | Settings only                             | OK                                               |
| Hydrate           | `refreshAll(true)` on web             | Splash complete + silent hydrate          | Code OK; Health ops stale                        |
| Flask             | vinext `:3000` upstream               | Same `:5050`                              | Do not recycle                                   |


---



## Verification results


| Check                  | Command/action                                           | Result                                                               | Evidence                                         |
| ---------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------ |
| Scanner                | `scan_dashboard.py` → `/tmp/dashboard-rca-localhost-mac` | OK                                                                   | 6 workspaces; chrome files dirty                 |
| Dock mtime/size/sha    | `stat` + `shasum`                                        | 20 Aug 12:44 · 9592656 · `bd8255ea…`                                 | `/Applications` = `~/Applications`               |
| Build mtime/size/sha   | same                                                     | 21 Aug 01:01:15 · 9934336 · `f54d46c3…`                              | `apple-app/build/Stratji.app`                    |
| Dock strings           | `nativeOwnsSections`                                     | **absent**; NativeRoute **present**; `Decision Framework` **absent** | vs build inject + Decision Framework **present** |
| Live Stratji           | `ps`                                                     | PID **88138** `/Applications/Stratji.app` since 01:19:48             | **Still Dock**                                   |
| Flask                  | `lsof :5050` + health                                    | PID **88565** 200 ok                                                 | Not killed                                       |
| SSR sectors localhost  | `curl :3000/?view=sectors`                               | S-1 present, I-1 absent, no `data-native-chrome=1`                   | URL-correct                                      |
| SSR nativeChrome Flask | `curl :5050/?view=sectors&nativeChrome=1` Stratji UA     | Tabs present; no owns-sections                                       | P1 FOUC gap                                      |
| Intel leftover         | `tests/workspace-routing.test.mjs`                       | s1 on intelligence → m1                                              | Not this incident                                |
| Startup banner         | `rg Startup refresh audit`                               | no matches                                                           | AGENTS honored                                   |
| Health                 | startup-refresh.log                                      | stale 2026-08-18 vs 2026-08-20                                       | Ops                                              |


---



## Blast radius

- **In blast:** Mac Stratji chrome (all six workspaces + Settings overlay padding). Operator screenshots. Hover on 01:01 build. Tests that freeze the hedge.
- **Not in blast:** Kite math, S-2 industry isolation, Satya retrieve, DailyKanbanBoard identity, Intel M-1/M-2/M-3, PDF, iOS web droplet (must stay). Flask listener.
- **Ops adjacent:** Health D-1/D_OVERNIGHT coverage; incremental Mail/Calendar ensure-failed. Fix via Shortcut/export, not chrome CSS.

---



## Remediation plan (summary)

Full implementation plan: `Plans/PLAN-2026-08-21-Localhost-vs-MacApp-Remediation.md`. Do **not** implement in this RCA step.


| Priority     | Action                                                | Owner surface                                                        | Dependency          | Acceptance test                                                      |
| ------------ | ----------------------------------------------------- | -------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------- |
| P1 DO NOW    | FOUC Macintosh+Stratji → owns-sections                | `layout.tsx` + FOUC unit assert                                      | none                | Macintosh UA HTML has flag; iPhone does not; `:3000` droplet remains |
| P1 OPS NOW   | Quit Dock Stratji; open `apple-app/build/Stratji.app` | Operator                                                             | Do not kill `:5050` | `ps` path is `…/apple-app/build/Stratji.app`; sha256 `f54d46c3…`     |
| P2           | Selected-only section droplet                         | `StratjiWorkspaceGlassBar.swift` (+ web `DashboardTabs` if same lie) | P1                  | Hover Sectors ≠ Investment chips                                     |
| P2           | Retarget chrome tests                                 | `rendered-html.test.mjs`                                             | P1 FOUC             | Test name matches asserts                                            |
| P2 FOLLOW-UP | Zip Swift/TS section titles                           | test                                                                 | —                   | `Decision Framework` both sides                                      |
| P3           | README Dock vs build; Canvas naming; glass-bar judo   | docs/Swift                                                           | —                   | README launch path true                                              |
| Ops          | Health Shortcut through 2026-08-20                    | operator                                                             | —                   | freshness Health `live` / dataDate=target                            |


---



## Residual risks and open questions

- **Blocked evidence:** No pixel of the 01:01 app in a window (Dock still owns the process). Hover not clicked in the live UI this pass.
- **Unverified:** Whether Dock overlay paints a combined section droplet or workspace pills only (missing `Decision Framework` string suggests incomplete titles). After FOUC, stale overlay might hide web chips and leave **no** full-name section row until 01:01 overlay runs — auditor open question 1 still holds: **operator must open the build app for native full names**.
- **Monitoring:** `ps` + `stat` on the three Stratji paths; FOUC assertion in CI; Health `dataDate` vs `healthTargetDate`.
- **Follow-up date:** Same day after FOUC + binary switch; then `$auditor` on the running 01:01 process if dual chrome remains.

**What the operator should open:** `apple-app/build/Stratji.app` (21 Aug 01:01). Quit `/Applications/Stratji.app` first. Flask `:5050` stays up.