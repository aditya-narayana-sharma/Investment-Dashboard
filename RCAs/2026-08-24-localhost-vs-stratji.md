# RCA — Localhost vs Stratji.app chrome / launch drift

**Date:** 2026-08-24 · **Audit time:** 00:45–01:05 IST (Asia/Kolkata) · `healthTargetDate` window **D_OVERNIGHT** (00:00–01:59 → prior evening **2026-08-23**)  
**Mode:** Read-only. Sequence step 3 of 3 (`$project-status` → `$auditor` → `$rca-agent`). No production-code edits, commits, service restarts, or Flask `:5050` kill.  
**Incident class:** Localhost (`:3000` / Flask `:5050`) vs Stratji.app (WKWebView, liquid-glass overlay, splash/hydrate, Dock vs `apple-app/build`).  
**Prior artifacts (cited, not re-run):**

- `$project-status`: `Project-Status/PROJECT-STATUS.md` — 107 rows, **98 Done / 9 In-Progress / 0 NI**. Generated 00:36 IST. Dock / Applications **21 Aug 20:55** vs `apple-app/build/Stratji.app` **24 Aug**.
- `$auditor`: `Code-Reviews/2026-08-24-localhost-vs-stratji-chrome.md` — verdict **REQUEST CHANGES**. Weighted 5.9/10. Three functional P1s (iOS pop-out, always-recycle, web hover) plus two structural P1s (1k CSS / Satya files).
- Prior chrome RCA: `RCAs/RCA-2026-08-21-Localhost-vs-MacApp.md` (dual-chrome FOUC gap; hover as P2). **Aug 21 hide-contract judo has landed in current source.** This pass diagnoses what still produces localhost↔Mac drift.

**Scanner:** `python3 ~/.codex/skills/rca/scripts/scan_dashboard.py` → `/tmp/dashboard-rca-2026-08-24/` (`rca-inventory.md`, `rca-inventory.json`). Six workspaces from `WORKSPACE_VIEW_VALUES`. Private payloads excluded.

**Live stack (do not kill):** Flask PID **22307** `*:5050` · vinext PID **22302** `127.0.0.1:3000` · `GET /_flask/health` `{gateway:flask, upstreamStatus:200}` · `:3000` HTTP 200. This RCA did **not** launch Stratji.app or attach to a WK window.

---

## Executive diagnosis

- **Current health:** `Degraded` (chrome / launch / Satya pop-out / M-1 date window). Investment–Strategies **content pipelines and KPI math are not this incident.**
- **Highest severity:** **P1** — no P0 data-loss. Highest user-visible faults: (1) every Stratji recycle kills a healthy Vinext/Flask stack so `:3000` is connection-refused; (2) localhost hover still impersonates the selected workspace; (3) iOS registers `satyaDraft` then compiles the NSPanel out, so Pop out is a silent no-op.
- **Confirmed root causes (top 5):**
  1. **Always-recycle launch policy.** `kickoffAtLaunch` always `stopDataPlane()` then dash-start. `ensureRunning(recycle: false)` already knows how to adopt a live `serviceReady` gateway. Launch does not use that path. Tests **pin** the always-stop string.
  2. **Web droplet bound to hover, not selection.** `pillIndex = hoverIndex ?? focusIndex ?? activeIndex`. Native `clusterWorkspace = session.workspace`. Same screenshot class as “Sectors selected + Investment board” without a stale binary.
  3. **Feature-detects the handler, not the panel.** iOS `DashboardBrowser` adds `webkit.messageHandlers.satyaDraft`. `hasNativeSatyaDraftPopout()` is then true. `SatyaDraftPopout` returns `null`. Bridge `handle` is `#if os(macOS)` only.
  4. **Operator binary drift.** Dock `/Applications/Stratji.app` and `~/Applications/Stratji.app` are **21 Aug 20:55**, sha256 `148bd643…`, **no** `satyaDraft` / `StratjiRepoRootBookmark`. Canonical `apple-app/build/Stratji.app` is **24 Aug 00:41**, sha256 `16eaf7dd…`, both strings present. Launching Dock is sufficient to miss the NSPanel and bookmark cache.
  5. **Documents I/O still uses the checkout as cwd.** `repoRoot` cache stopped workspace-change `stat`s. Refresh / launch still `currentDirectoryURL = repoRoot` under `~/Documents/GitHub/…`. Bookmark is path-constructed (not `NSOpenPanel`). App Sandbox is **false**, so `files.bookmarks.app-scope` does not persist Allow.
- **Affected workspaces:** All six via shared chrome / launch. M-1 additionally via evidence-date walkback (dirty tree). Satya M-2 / companion orb via draft pop-out.
- **Data current through:** This pass did **not** re-audit Kite/Mail/Health bodies. Flask+vinext are reachable. Complete-dashboard freshness remains an ops ledger (Settings constellation), not a chrome ticket. Do not claim the complete dashboard is current from HTTP 200 alone.
- **Main residual risk:** Recopying Dock without adopt-live + hover + iOS-handler fixes leaves the next recycle / screenshot / iPhone Pop-out class open. FOUC hide is already in Flask HTML — Dock + current CSS no longer paints two droplets. Hover and always-recycle still do.

This is **not** an Intel→S-1 leftover (`parseWorkspaceSection("intelligence","s1")` → `"m1"`, tested). **Not** a fifth Market Intelligence section. **Not** a Flask-kill of a leftover healthy listener **outside** Stratji’s own stop-then-start. **Not** compact/single-lane Kanban.

---

## Findings — required table

Columns: Workspace | Section | Sub-Section | Function/File Name | Identified Problem | Root Cause | Proposed Solution

| Workspace | Section | Sub-Section | Function/File Name | Identified Problem | Root Cause | Proposed Solution |
| --- | --- | --- | --- | --- | --- | --- |
| Cross-cutting | Chrome | Dual bars / hide | `app/layout.tsx` `nativeChromeFoucScript`; `app/native-chrome.css:125–189`; `app/page.tsx:812`; `StratjiDocumentBrowser.swift:140–152` | Historical two bars (web `.workspace-navigation` + native glass). **Current source + current Flask HTML hide the web droplet on Macintosh+`Stratji/`.** Dock 21 Aug already contains `nativeOwnsSections`. Residual two-bar only if an older-than-21-Aug binary loads HTML that also lacks FOUC. | Aug 21 hide lived only in a rebuilt WK inject. FOUC now sets `data-native-owns-sections=1` for Macintosh+`Stratji/`; CSS default-hides `.workspace-navigation` under `native-chrome-embed` and iOS / `?nativeChrome=1` opt back in with `data-native-web-nav=1`. `page.tsx` does not mount `DashboardTabs` when `nativeOwnsWorkspaceNav`. | Keep FOUC + CSS + React unmount. Do not hide under all `native-chrome-embed` (strips iOS). Prefer `apple-app/build/Stratji.app`. Treat two-bar as **closed in source**; verify pixel on the 24 Aug build. |
| Cross-cutting | Chrome | Native overlay titles | `StratjiWorkspaceGlassBar.swift:39–41`; `DashboardOutline.swift:326–391`; `workspace-routing.ts:290–319` | Historical I-1…I-4 circular chips under a Sectors pill. Current **native** overlay uses `DashboardOutline` full titles (Action Board / Industry Analytics / Decision Framework). Web compact chips also render `section.label` (not prefix). Residual chip identity is the **web hover lie** or a **stale Dock** overlay. | Dual chrome stacked Investment’s four-chip droplet under a Sectors pill. Compact chips were `border-radius:999px` I-n prefixes. Overlay and `?view=` were not one source of truth during hover. | Native already `clusterWorkspace = session.workspace`. Web: `pillIndex = activeIndex`. Operator launches 24 Aug build. Zip-test Swift titles vs `WORKSPACE_SECTIONS[].label`. |
| Cross-cutting | Chrome | Web hover | `app/dashboard/shared-ui.tsx:377–434` | Hovering Sectors while Investment is selected expands S-1/S-2/S-3 titles over the Investment canvas. `?view=` stays `investment`. Click still switches. | `pillIndex = hoverIndex ?? focusIndex ?? activeIndex`; `dropletWorkspace` and `data-expanded` follow hover. Native already refuses this. No test asserts `pillIndex === activeIndex`. | `pillIndex = activeIndex`. Keep `hoverIndex` only for glyph scale / `data-hover`. Add rendered-html / unit assert. |
| Cross-cutting | Chrome | Intel leftover / click | `workspace-routing.ts:371–388`; `tests/workspace-routing.test.mjs:12–19`; `DashboardNativeRoute.swift:6–34`; `StratjiSessionModel.swift:368–374` | Historical “all toggles show Portfolio” / Intel→S-1. **Leftover `section=s1` on Intel maps to `m1` today.** Wrong canvas on a **completed** native click is overlay/URL desync or hover, not leftover mapping. | `parseWorkspaceSection` only accepts ids in that workspace’s catalog; foreign leftovers fall through to the workspace default. Native click: `session.select` → `document.load` → `history.replaceState` + `stratji:navigate`. Hover never commits `?view=`. | Do not rewrite `parseWorkspaceSection`. Fix web hover. Pixel-check click Sectors → `?view=sectors&section=s1` → S-1 board. Keep leftover tests green. |
| Cross-cutting | Launch | Hydrate / splash | `AppDelegate.swift:28–35`; `FlaskServiceSupervisor.swift:70–77,405–419`; `StratjiSessionModel.swift:539–569,580–589`; `app/page.tsx:779–782` | After Stratji recycle, localhost `:3000` connection-refused. Splash can sit on “Starting…” then Retry. Hydrate itself waits on `serviceReady` (Flask **and** vinext 200) — the wait is honest; the **policy of always stopping** is the defect. | `kickoffAtLaunch` always stop → wait ≤20s → dash-start. `waitUntilDashboardPortsFree` proceeds after 20s even if listeners remain. `start-flask-app.sh` may take leftover-`flask_bound` / vinext-only. `page.tsx` native path is silent hydrate (correct). Tests pin “stopping leftover… for a fresh start.” | If `isReachable()` before stop, adopt and return (same as `ensureRunning(recycle: false)`). Recycle only on Retry. After 20s port wait, fail to Retry/FDA — do not start a second stack. Flip launch test. **Do not kill a healthy leftover `:5050` unless recycle is explicit.** |
| Cross-cutting | Launch | Dock vs build | `apple-app/build/Stratji.app`; `/Applications/Stratji.app`; `~/Applications/Stratji.app` | Operator Dock is two days behind. 24 Aug build has `satyaDraft` + `StratjiRepoRootBookmark`. 21 Aug Dock has `nativeOwnsSections` (hide) but **not** the NSPanel or bookmark cache. | Process: Dock / Applications recopied 21 Aug 20:55 and never again. `CFBundleVersion` historically did not distinguish hashes. | Open `apple-app/build/Stratji.app`. Recopy over Dock / Applications. Bump `CFBundleVersion` on the next archive. Not a code P0. |
| Cross-cutting | Permissions | Documents TCC | `StratjiConfiguration.swift:55–73,122–137,250–317`; `FlaskServiceSupervisor.swift:158–171,437–446`; `Stratji.entitlements:7` | “Allow” on Refresh all / first launch. Workspace change **should** be quiet on the 00:41 build (`select` no longer `stat`s Documents). Refresh / recycle still touch `~/Documents/GitHub/…`. | Cache + no-`fileExists` on getter fixed navigate. `runRefreshScript` / `runStopScript` still `cwd` the checkout. `persistBookmark` is path-constructed, not user-selected. Sandbox **off** → bookmark entitlement is decorative. | Keep I/O on Application Support trampoline. Refresh via support wrapper after one `startAccessingSecurityScopedResource`. Persistent Allow = `NSOpenPanel` once **or** documented Full Disk Access. Sibling TCC chat. |
| Cross-cutting | Satya | Draft pop-out Mac | `StratjiSatyaDraftBridge.swift`; `SatyaDraftPopout.tsx`; `satya-client.ts:803–828`; `StratjiDocumentBrowser.swift:123–124` | Spec: Mac NSPanel for **current turn only**; close keeps thread on M-2 / orb. Source shape is correct. **Dock 21 Aug has no `satyaDraft`.** Dirty-tree auto-`openSatyaDraftPopout` on every M-2 / orb stream (not only Pop out). | Mac registers handler and compiles panel. Web dialog suppressed when handler exists. Dock binary predates the bridge. | Rebuild + recopy Dock. Confirm close-keeps-thread (already tested). Decide auto-open vs control-only before merge. |
| Cross-cutting | Satya | Draft pop-out iOS | `DashboardBrowser.swift:147–155`; `StratjiSatyaDraftBridge.swift:150–157`; `SatyaDraftPopout.tsx:110` | iPhone Pop out: JS posts `open`; native no-ops; web modal never mounts. Silent failure. | Handler existence is used as “native owns pop-out.” iOS adds the handler and `#if os(macOS)` skips the panel. | Register `satyaDraft` only on macOS. Then `hasNativeSatyaDraftPopout()` is false on iOS and the web dialog shows. |
| Cross-cutting | Satya | Suggestions | `satya-suggestions.ts:233,321`; workspace `useSatyaTaskContext` | Two catalogs (workspace vs `defaultSatyaSuggestions(task)`) will drift. Health now has context (status snapshot was stale). | Same Axis-picks / “never invent CMP” knowledge restated. +146% file growth. | Workspace catalogs are SoT. Task defaults pick a named catalog. FOLLOW-UP. |
| Cross-cutting | Satya | File size | `satya.css` 1016; `satya-client.ts` 1122; `SatyaPresence.tsx` 1153 | 1k tripwire crossed / extended. Next Satya feature lands in the same sinks. | Pop-out CSS and state stuffed into already-large files. `SatyaDraftPopout.tsx` + Swift bridge already exist. | Split `.satya-draft-popout*` CSS. Extract `satya-draft-popout.ts`. Do not grow `page.tsx`. |
| Investment | I-1 | Action Board | `InvestmentWorkspace.tsx`; `DailyKanbanBoard` | No chrome-specific Kanban defect. Canvas follows `?view=investment&section=i1`. Hover can **paint Sectors titles over this board**. | Web `pillIndex` hover. Exclusive `hidden` siblings stay I-1. | Hover fix. Keep three-lane identity. |
| Investment | I-2 | Portfolio / gauges / orbital / treemap | `InvestmentWorkspace.tsx`; `visual-components.tsx` | No localhost↔Mac KPI drift this pass. Charts not re-measured in WK. | — | No chrome ticket. Verify after hover/launch fixes that I-2 exclusive `hidden` still applies. |
| Investment | I-3 | Risk / radar / macro | `InvestmentWorkspace.tsx` | No chrome KPI drift. Radar min-heights are density (prior status), not Mac vs web. | — | Out of this RCA. |
| Investment | I-4 | Axis picks | `InvestmentWorkspace.tsx` | Satya chips must stay analyst-matrix, not MI promo. Dirty-tree suggestions in progress. | Dual suggestion catalogs. | Collapse catalogs. Never invent CMP. |
| Sectoral Analytics | S-1 | Action Board | `SectorsWorkspace.tsx` | Click Sectors must show S-1 board, not I-1. Current routing writes `section=s1`. Residual miss is hover or uncommitted overlay. | Hover / historical dual chrome. | Hover + pixel click path. |
| Sectoral Analytics | S-2 | Pulse / companies / rankings / lifecycle / structure / MECE | `SectoralAnalytics.tsx` | Industry toggle must stay S-2-only. No Mac-specific filter leak found in this chrome pass. Satya chips must be industry/framework. | — | Keep S-2 isolation tests. Suggestions FOLLOW-UP. |
| Sectoral Analytics | S-3 | Decision Lab | `SectorDecisionLab.tsx` | Local selector must not mutate S-2. No new chrome leak. | — | Keep isolation. |
| Market Intelligence | M-1 | Daily actions | `intelligence-daily-actions.ts:155–179`; `tests/intelligence-daily-actions.test.mjs:312–351` | Monday empty when fallback used `lastNseTradingDay` only (Friday). Sunday newsletters skipped. **Dirty tree walks prior-NSE…yesterday and picks the newest mintable day (Sunday).** HEAD still Friday-only. Dock does not ship minting. | `intelligenceEvidenceDateKey` = last NSE session. Weekend mail is not an NSE day. Walkback jumped to Friday. | Keep dirty-tree `resolveIntelligenceEvidenceDateKeys`. Do not mix into chrome merge until P1s land — do not rewrite again. Serve via current vinext, not HEAD-only. |
| Market Intelligence | M-2 | Satya canvas | `SatyaBriefingRoom.tsx`; `SatyaPresence.tsx` | M-2 is the briefing (not a digest wall). Pop-out / story prompt / suggestions are dirty-tree In-Progress. iOS pop-out no-op. | Handler vs panel; Dock missing bridge. | iOS register-only-macOS; rebuild; story prompt stays inventory-bound. |
| Market Intelligence | M-3 | Earnings calendar | `IntelligenceEarnings.tsx` | Sole complete earnings location. No sector-dim. No chrome drift. Calendar rows are scheduling evidence only. | — | Do not duplicate in Sectors. Unpublished KPIs stay blank. |
| My Feed | H-1…H-4 | Board / optimism / vitals / calendar | `HealthWorkspace.tsx` | No native overlay section catalog bug in current source (H-1…H-4 titles in `DashboardOutline`). Health Satya must not invent vitals. Incognito still gates values. Operational date is D_OVERNIGHT **2026-08-23** this audit hour. | — | Completeness is ops export, not chrome. No Satya KPI invention. |
| Algorithm Canvas | B-1…B-3 | Board / Canvas / JSON | `builder/` | Chrome title Algorithm Builder; nav Algorithm Canvas. No leftover Intel mapping. Suggestions dirty-tree. | Naming split is P3 copy, not click-wrong-workspace. | FOLLOW-UP copy. No industry filter here. |
| Strategies | Y-1 / Y-2 | Board / Library | `StrategiesWorkspace.tsx` | No chrome leftover mapping. Composer trees stay here. | — | No MI digest. |
| Chrome (not a workspace) | Integrations | Freshness | `PulseConstellation` | Freshness stays Settings-only. No main-canvas startup-fail banner. Hydrate silent on native. | — | Keep. Recycle must not be “fixed” by a banner. |
| iOS client | All | Web droplet | `DashboardBrowser.swift:134–155` | Correctly omits `nativeOwnsSections`. Incorrectly **adds** `satyaDraft`. | Shared browser bootstrap copied Mac handler. | `#if os(macOS)` around add + assign. |

---

## P1 detailed chains

No P0 survived falsification.

### [P1] `kickoffAtLaunch` always kills a live Vinext/Flask stack → `:3000` connection refused

- **Status:** Confirmed  
- **Confidence:** High  
- **Affected:** Cross-cutting launch / splash / localhost `:3000` / all six workspaces after recycle  
- **Symptom:** After quit/reopen or Stratji recycle, browser `http://127.0.0.1:3000` is connection-refused. Splash stays until Flask `serviceReady` or Retry. Operator with a **healthy** leftover `:5050`+`:3000` loses both.  
- **Observation:** Live this pass (before any Stratji launch): Flask 22307 + vinext 22302, health `upstreamStatus:200`. Source:

```70:77:apple-app/Stratji/FlaskServiceSupervisor.swift
    static func kickoffAtLaunch() async {
        StratjiConfiguration.persistRepoRoot()
        appendDesktopLog("Launch: stopping leftover dashboard processes for a fresh start\n")
        stopDataPlane()
        await waitUntilDashboardPortsFree()
        appendDesktopLog("Launch: running dash-start in background\n")
        runDashStartInBackground()
    }
```

`ensureRunning(recycle: false)` already adopts when `isReachable()` (`:91–94`). `isReachable` requires `FlaskHealthDTO.serviceReady` (gateway flask **and** upstream 200). Flask health is 503 when vinext is down — honest. `waitUntilDashboardPortsFree` (`:405–419`) gives up after 80×250ms and dash-starts anyway. `AppDelegate.applicationDidFinishLaunching` always awaits `kickoffAtLaunch` before `finishLaunchingOnMain`. `tests/native-launch-refresh.test.mjs:257` matches `stopping leftover dashboard processes for a fresh start`. Session `waitUntilFlaskReady` (`:541–569`) polls up to 180s (+ extra while dash-start runs). Native `page.tsx:779–782` silent-hydrates after splash — not a second complete audit.  
- **Reproduction:** 1) Confirm `:5050` health 200 and `:3000` 200. 2) Quit and reopen Stratji (or any path that calls `kickoffAtLaunch`). 3) Immediately `curl :3000` → connection refused until vinext rebinds (up to ~90s in `run-dashboard-service.sh`). 4) Splash waits on `serviceReady`. **This RCA did not perform step 2** (would kill the healthy stack). Mechanism is source-confirmed; auditor + status agree.  
- **Proximate mechanism:** Launch policy = always stop. Port wait is best-effort. `start-flask-app.sh:102–125` can vinext-only against a dying leftover Flask if `flask_bound` after a partial teardown.  
- **Root cause:** “Fresh start on every launch” was encoded as the product contract (comment line 70 + test name). Adopt-live exists and is unused at kickoff.  
- **Trigger:** Stratji recycle / quit-reopen while a leftover stack is healthy.  
- **Contributing factors:** 20s port timeout continues; launch-refresh test freezes always-stop; operator may hit `:3000` directly (vinext) while splash only cares about Flask health; Dock vs build does not change this policy (it is in HEAD **and** dirty tree).  
- **User impact:** Localhost and any vinext client fail during the window. Splash/Retry. Complete refresh then re-runs. Violates “do not kill a healthy `:5050`.”  
- **Corrective action:** `kickoffAtLaunch`: if `await isReachable()` { `adoptLiveGatewayWithoutRecycle()`; return }. Else current stop → wait → dash-start. Retry / `ensureRunning(recycle: true)` unchanged. After port-wait timeout, surface Retry/FDA instead of a second stack. Rewrite launch test to “stop only when not `serviceReady`.”  
- **Verification:** Recycle Stratji with live health 200 → both ports stay bound; splash dismisses; no connection-refused on `:3000`. First install (nothing listening) still dash-starts. Explicit Retry still recycles. Do not kill leftover `:5050` in verification except that Retry.  
- **Code:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard/apple-app/Stratji/FlaskServiceSupervisor.swift:70–77,91–94,405–419` · `AppDelegate.swift:28–35` · `StratjiSessionModel.swift:539–569` · `scripts/start-flask-app.sh:102–125` · `tests/native-launch-refresh.test.mjs:239–257` · `app/page.tsx:779–782`  
- **Source:** Live `lsof`/`curl` 2026-08-24 00:47 IST; auditor P1; status SF-recycle.

### [P1] Web droplet hover impersonates the selected workspace

- **Status:** Confirmed  
- **Confidence:** High  
- **Affected:** Localhost `:3000` / `:5050` without Mac overlay; iOS / `?nativeChrome=1` web cluster; all six workspaces’ section titles  
- **Symptom:** Hover Sectors (or Intel / Feed / Builder / Strategies) while Investment is selected → foreign section titles expand over the Investment board. Screenshot class “Sectors + I-1 board” **without** a stale Dock binary.  
- **Observation:**

```377:378:app/dashboard/shared-ui.tsx
  const pillIndex = hoverIndex ?? focusIndex ?? activeIndex;
  const dropletWorkspace = visibleWorkspaces[pillIndex] ?? visibleWorkspaces[activeIndex];
```

`onMouseEnter` → `setHoverIndex(index)` (`:434`). `data-expanded` follows `dropletWorkspace`. Compact chips render `section.label` (`WorkspaceSectionNav` `:101`) — full names, not I-1 prefixes, in **current** web source. Native:

```39:41:apple-app/Stratji/StratjiWorkspaceGlassBar.swift
    private var clusterWorkspace: StratjiWorkspace {
        session.workspace
    }
```

`tests/native-sidebar-click.test.mjs:90–91` greps native `clusterWorkspace == workspace` / `session.workspace`. No web `pillIndex === activeIndex` assert.  
- **Reproduction:** Open `http://127.0.0.1:5050/?view=investment&section=i1` (no Stratji UA). Hover the Sectors glyph. Titles become Action Board / Industry Analytics / Decision Framework while the canvas stays I-1 `DailyKanbanBoard`. Click Sectors → URL `?view=sectors&section=s1` (click path works).  
- **Proximate mechanism:** Combined droplet preview uses hover workspace for section titles; document `?view=` stays selected.  
- **Root cause:** Hover was treated as selection for cluster expansion. Native already corrected; web was not.  
- **Trigger:** Mouse enter on a non-active workspace cell.  
- **Contributing factors:** Historical dual chrome made the same composition look like “native Sectors + web I-1 chips.” Intel leftover mapping is **not** required for this screenshot.  
- **User impact:** Operator cannot tell which workspace is real. Section chips of the hovered workspace would mutate **that** workspace if clicked (`selectSectionFor` uses the cell’s workspace) while the canvas may still be Investment — or click workspace tab then section. Cognitive lie either way.  
- **Corrective action:** `pillIndex = activeIndex`. Hover/focus only scale glyph / `data-hover`. Click still `onChange(workspace.key)`.  
- **Verification:** Hover Sectors on Investment URL → Investment titles stay (Action Board / Portfolio / Risk / Axis picks). Click Sectors → S-1 board + three sector titles. Add a test.  
- **Code:** `app/dashboard/shared-ui.tsx:377–434` · `StratjiWorkspaceGlassBar.swift:39–41`  
- **Source:** Auditor P1; status hover In-Progress row.

### [P1] iOS registers `satyaDraft` then compiles the panel out — Pop out is a silent no-op

- **Status:** Confirmed  
- **Confidence:** High  
- **Affected:** iOS WKWebView M-2 + companion orb; **not** Mac Stratji (`StratjiDocumentBrowser` + NSPanel)  
- **Symptom:** Tap Pop out (or auto-open on stream). No panel, no web modal, no error.  
- **Observation:** iOS `DashboardBrowser.swift:147–155` adds `StratjiSatyaDraftBridge.messageName`. `hasNativeSatyaDraftPopout()` (`satya-client.ts:803–805`) is `webkit.messageHandlers.satyaDraft != null`. `SatyaDraftPopout.tsx:110` `if (!open || hasNativeSatyaDraftPopout() || !host) return null`. Bridge `handle` (`:150–157`) is `#if os(macOS)` only. Mac `StratjiDocumentBrowser` also adds the handler **and** compiles the panel — correct. Dock 21 Aug **lacks** `satyaDraft` entirely (process).  
- **Reproduction:** iPhone Stratji build from current source → M-2 Pop out. Handler present, panel compiled out, dialog suppressed.  
- **Proximate mechanism:** Illegal state “handler exists / panel cannot show.” Web treats handler as native ownership.  
- **Root cause:** Feature detection on the message-handler name instead of “this OS can present the NSPanel.” iOS bootstrap copied the Mac add.  
- **Trigger:** Pop out or `openSatyaDraftPopout` on iOS (`SatyaPresence.tsx:567` auto-opens on stream).  
- **Contributing factors:** Auto-open on every stream makes the no-op more frequent. No runtime iOS test.  
- **User impact:** Draft pop-out is dead on iPhone. Thread still exists on M-2 / orb (close path unused).  
- **Corrective action:** `#if os(macOS)` around `userContentController.add(..., satyaDraft)` and `satyaDraft.webView = view`. iOS then mounts the web dialog.  
- **Verification:** iOS: `hasNativeSatyaDraftPopout()` false; dialog `data-testid="satya-draft-popout"` mounts. Mac: NSPanel still opens; dialog stays null. Add source assert that iOS add is gated.  
- **Code:** `apple-app/InvestmentDashboard/DashboardBrowser.swift:147–155` · `apple-app/Shared/StratjiSatyaDraftBridge.swift:150–157` · `app/dashboard/SatyaDraftPopout.tsx:110` · `app/dashboard/satya-client.ts:803–805`  
- **Source:** Auditor P1.

### [P1] `satya.css` crosses 1000 lines; draft state grew two files already over 1k

- **Status:** Confirmed (structural / merge bar)  
- **Confidence:** High  
- **Affected:** Satya maintainability — M-2 / orb / pop-out  
- **Symptom:** Presumptive 1k blocker. `satya.css` 945→1016; `satya-client.ts` 1027→1122; `SatyaPresence.tsx` 1122→1153.  
- **Observation:** `wc -l` this pass. New `SatyaDraftPopout.tsx` (147) and `StratjiSatyaDraftBridge.swift` (365) are the right layers; state/CSS are not.  
- **Reproduction:** `wc -l app/dashboard/satya.css` → 1016.  
- **Proximate mechanism:** Pop-out rules and `open/close/sync/currentSatyaTurn` landed in kitchen-sink files.  
- **Root cause:** No extract step when the Swift/TSX split already proved the concept has a home.  
- **Corrective action:** `satya-draft-popout.css` + `satya-draft-popout.ts`. `setSatyaThread` one-line notify.  
- **Verification:** `wc -l satya.css` < 1000; client/presence do not grow further this PR. Behavior preserved.  
- **Code:** `app/dashboard/satya.css` · `satya-client.ts` · `SatyaPresence.tsx`  
- **Source:** Auditor P1 structural.

---

## P2 / P3 (short chains)

### [P2] Documents TCC — workspace nav quieter; Refresh / launch still touch Documents

- **Status:** Confirmed · **Confidence:** High  
- **Symptom:** Allow sheet on Refresh all / first launch. Workspace change should not re-`stat` on 00:41+ source (`select` comment `:366–367`; `repoRoot` cache `:55–73`).  
- **Root cause:** Checkout remains the Refresh/Stop cwd (`FlaskServiceSupervisor.swift:158–171,437–446`). Bookmark without `NSOpenPanel`. Sandbox false.  
- **Corrective action:** Support trampoline for Refresh; NSOpenPanel or documented FDA. Sibling TCC chat. Tests today only grep `cachedRepoRoot`.

### [P2] Dock / Applications 21 Aug vs `apple-app/build` 24 Aug

| Binary | mtime | size | sha256 (Mach-O) | `satyaDraft` | `StratjiRepoRootBookmark` | `nativeOwnsSections` |
| --- | --- | --- | --- | --- | --- | --- |
| `apple-app/build/Stratji.app` | **2026-08-24 00:41:09** | 10480976 | `16eaf7dd6f712c854ed52d81c9f90c1fbfa338cdb953c15dc039f6f8405e9295` | present | present | present |
| `/Applications/Stratji.app` | 2026-08-21 20:55:53 | 10097856 | `148bd6432e3c60e99f87a596325a08d20e84678389ec5fc01e3c6192aa503e88` | **absent** | **absent** | present |
| `~/Applications/Stratji.app` | 2026-08-21 20:55:53 | 10097856 | `148bd643…` (same) | **absent** | **absent** | present |

- **Status:** Confirmed (process) · **Confidence:** High  
- **Root cause:** Operator launch path is Dock. Hide-contract string exists on 21 Aug Dock (FOUC + current CSS also hide). NSPanel and bookmark do not.  
- **Corrective action:** Launch/recopy `apple-app/build/Stratji.app`. Prefer build over Dock in every verification. Not a code change.

### [P2] Hover, iOS pop-out, adopt-live lack behavioral tests; launch test pins the bug

- **Status:** Confirmed  
- **Corrective action:** Assert droplet follows `active`. Assert iOS does not add `satyaDraft`. Rewrite launch test.

### [P2] Two Satya suggestion catalogs

- **Status:** Confirmed · FOLLOW-UP · Do not invent Health vitals or CMP.

### [P3] Port wait continues after 20s with listeners still bound

- Secondary to always-recycle. With adopt-live, Retry-only.

### [NOTE] Intel→S-1 leftover mapping is closed in source

`parseWorkspaceSection("intelligence","s1"|"i1"|"m4")` → `"m1"`. `applyWorkspaceSectionParams` writes that workspace’s own section. `isLocationView` ignores sibling leftover `section=`. Native `DashboardNativeRoute` `replaceState` + `stratji:navigate`. Historical “all toggles show Portfolio” = hover + dual chrome + Investment default canvas, **not** leftover `s1` driving Intel.

### [NOTE] I-1 chips vs full names

Current web compact chips show `section.label` (Action Board, Portfolio, …). Native overlay uses `DashboardOutline` titles. Circular I-1…I-4 **identity** in the 21 Aug screenshot was the **web Investment droplet** under dual chrome, plus compact `border-radius:999px`. Full-name contract is Done in source; residual is hover + stale Dock chrome chrome.

### [NOTE] M-1 Monday walkback is in the dirty tree

HEAD `intelligenceEvidenceDateKey` = `lastNseTradingDay` only. Dirty `resolveIntelligenceEvidenceDateKeys` (`:162–179`) uses today’s session if mintable; else newest day in prior-NSE…yesterday (Sunday mail included). Test `a Monday open includes Saturday and Sunday mail, not only Friday` would fail on Friday Punch leaking over Sunday newsletters. Do not invent KPIs. Do not paste Mail bodies.

### [NOTE] Aug 21 hide-contract judo landed

FOUC Macintosh+`Stratji/` → `nativeOwnsSections`. CSS default-hides web nav for `native-chrome-embed`; `native-web-nav` opts iOS/localhost embed back in. `page.tsx:812` unmounts `DashboardTabs` when Mac overlay owns nav. Stale Dock 21 Aug + current Flask HTML should **not** paint two droplets.

### [NOTE] Hydrate race vs always-recycle

Splash/hydrate **wait** is correct (`serviceReady`, silent React hydrate). The race operators feel is **created** by killing vinext first. Do not “fix splash” by dismissing early. Do not add a main-canvas startup-fail banner.

---

## 5 Whys (operator screenshot class + recycle)

| # | Why | Answer |
| --- | --- | --- |
| 1 | Why Sectors (or Intel) looks selected while the board is Investment / I-1? | Overlay or hover chrome showed the other workspace; WK `?view=` stayed `investment`; exclusive section shows I-1. |
| 2 | Why would chrome show a foreign workspace? | Web `pillIndex` follows hover. Historical dual chrome stacked two bars. Native hover no longer expands (source). |
| 3 | Why two bars on Mac historically? | Hide switch lived in a rebuilt inject; Dock served current CSS that kept the web droplet unless `owns-sections`. **FOUC now sets the flag.** |
| 4 | Why `:3000` dies after opening Stratji? | Launch always stops leftover listeners, then dash-starts. Vinext rebind is slow. |
| 5 | Why does that policy still exist? | Tests and comments define launch as “fresh start.” Adopt-live is Retry-adjacent, not kickoff. |

---

## Scope and baseline

- **Project root:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard`
- **Canonical runtime:** Flask `:5050` + vinext `:3000`; Mac chrome = `apple-app/build/Stratji.app` (not Dock)
- **Branch/commit:** `AppKit` @ `976503b` (`origin/AppKit`) + dirty tree (+1062 / −338 across 31 tracked; untracked Satya pop-out / TCC tests / this RCA+plan)
- **Comparison baseline:** Working tree vs `976503b`; binaries vs 21 Aug Dock; prior RCA 2026-08-21
- **Audit time:** 2026-08-24 00:45–01:05 IST
- **URLs:** `http://127.0.0.1:5050/_flask/health` 200; `http://127.0.0.1:3000/` 200. Stratji WK **not** attached this pass.
- **Private-data handling:** No Mail bodies, Health samples, tokens, or corpus rows.
- **Excluded/unavailable:** Pixel Stratji window; SearchConversations MCP; complete source-freshness re-audit of private snapshots.

---

## Change map

| Change group | Files | Affected surfaces | Risk | Tests |
| --- | --- | --- | --- | --- |
| User / dirty chrome+Satya | `satya-client.ts`, `SatyaPresence.tsx`, `SatyaDraftPopout.tsx`, `StratjiSatyaDraftBridge.swift`, `DashboardBrowser.swift`, `StratjiDocumentBrowser.swift`, `satya.css`, `local-llm-assist.ts`, `chat.ts` | M-2, orb, iOS pop-out, Mac NSPanel | P1 iOS no-op; 1k growth | `satya-draft-popout.test.mjs`, Swift `SatyaDraftPopoutTests` |
| User / dirty M-1 | `intelligence-daily-actions.ts`, `app/api/satya/sources/route.ts` | M-1 Monday | Correct if served; uncommitted | `intelligence-daily-actions.test.mjs` Monday case |
| User / dirty TCC | `StratjiConfiguration.swift`, `Stratji.entitlements`, `StratjiSessionModel.swift` `select`, permissions onboarding | Launch, Refresh, workspace nav | Refresh still Documents cwd | `stratji-documents-tcc.test.mjs` (grep) |
| User / dirty launch | `FlaskServiceSupervisor.swift` (comment/log polish; **kickoff still always-stop**) | Recycle | P1 vinext refuse | `native-launch-refresh.test.mjs` **pins the bug** |
| User / dirty suggestions | `satya-suggestions.ts`, workspace shells | All six Satya chips | Catalog drift | `satya-suggestions.test.mjs` |
| Status / review docs | `Project-Status/*`, `Code-Reviews/2026-08-24-…`, this RCA, plan | Process | None | — |
| Deployment drift | Dock vs `apple-app/build` | Running Mac chrome | Miss NSPanel / bookmark | none (ops) |
| Runtime / private | `artifacts/private` (not inspected) | Freshness | Ops | — |
| Generated | `.next` / `.vinext` / `DerivedData` (excluded) | — | — | — |

---

## Workspace and section coverage

| Workspace | Section | Children | Collapsible | Sources | States tested this pass | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Investment | I-1 | 3-lane Kanban | exclusive `hidden` | Kite actions | Code path + hover | Hover can lie; board OK |
| Investment | I-2 | gauges, orbital, treemap | exclusive | Kite | Code only | No KPI RCA |
| Investment | I-3 | stack, radar, macro | exclusive | Kite / flows | Code only | No KPI RCA |
| Investment | I-4 | Axis meters, radar | exclusive | Axis / CMP | Suggestions dirty | No invented CMP |
| Sectors | S-1 | Kanban | exclusive | sector actions | Routing tests | Click OK; hover lie |
| Sectors | S-2 | pulse…MECE | pages | snapshots / news | Isolation assumed prior | S-2-only filter |
| Sectors | S-3 | lab charts | local selector | benchmarks | Prior isolation | OK |
| Intelligence | M-1 | Kanban | exclusive | digest / earnings / corpus dates | Unit Monday test in dirty tree | HEAD Friday-only; dirty walkback |
| Intelligence | M-2 | Satya | exclusive | two mailboxes + PDFs + podcasts + verified KPIs | Source review | iOS pop-out P1 |
| Intelligence | M-3 | month grid | exclusive | verified IR/NSE | Code only | Sole calendar |
| My Feed | H-1…H-4 | board / optimism / vitals / cal | exclusive | HealthKit + lists | Date policy only | Ops completeness |
| Builder | B-1…B-3 | board / tree / JSON | exclusive | strategy tree | Code only | Naming P3 |
| Strategies | Y-1 / Y-2 | board / library | exclusive | Composer trees | Code only | OK |
| Chrome | Integrations | constellation | n/a | freshness API | Contract | No banner |

Scanner inventory listed S-1 but not S-2/S-3 as numbered collapsibles (page-routed). They are in `WORKSPACE_SECTIONS` / `DashboardOutline`.

---

## Rendering and interaction

| Surface | Desktop | iPhone | Console/API | Finding |
| --- | --- | --- | --- | --- |
| Localhost `:5050` / `:3000` | Web droplet + masthead | n/a | health 200 | Hover P1; hide N/A |
| `?nativeChrome=1` desktop | Web droplet, no masthead, `native-web-nav` | n/a | FOUC | Correct opt-in |
| Mac Stratji 24 Aug build | Overlay owns sections | n/a | not launched | Source correct; prefer this binary |
| Mac Stratji Dock 21 Aug | Overlay; hide via FOUC+CSS; **no** NSPanel | n/a | not launched | Process miss |
| iOS Stratji | Web droplet | portrait/landscape not pixel-checked | — | satyaDraft P1 |
| Charts / PDF / Incognito | not re-run | — | — | Out of chrome incident |

---

## Source freshness ledger (chrome pass)

| Source | Required-through | Observed-through | Ingested-at | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| Flask gateway | live bind | 2026-08-24 00:47 IST | n/a | **live** | `upstreamStatus:200` PID 22307 | Do not kill |
| Vinext `:3000` | live bind | 2026-08-24 00:47 IST | n/a | **live** | HTTP 200 PID 22302 | Dies if kickoff runs |
| Kite / Mail / Podcasts / Health / sectors / earnings | complete-refresh contract | **not re-audited** | — | **unknown this pass** | Settings constellation; no private bodies | Do not claim complete dashboard current |
| M-1 mint date | IST Mon 2026-08-24 + weekend mail if present | dirty-tree function + test | — | **code-fixed in dirty tree** | Friday-only at HEAD | Empty Monday if HEAD served without dirty walkback |

---

## Cross-section reconciliation

| Entity | Surfaces | Expected | Observed | Difference | Cause |
| --- | --- | --- | --- | --- | --- |
| Workspace titles | Native outline vs `WORKSPACE_SECTIONS` | Same labels | Match in source | Dock may lack later title strings | Two tables, no zip test |
| Selected workspace | Overlay / droplet vs `?view=` | Same | Web hover can differ | Hover `pillIndex` | P1 |
| Intel leftover `section=s1` | URL vs canvas | M-1 | `parseWorkspaceSection` → `m1` | None in source | Closed |
| Satya pop-out | Mac / iOS / localhost | Mac panel; others dialog | iOS neither | Handler vs panel | P1 |
| Data plane | Launch vs leftover | Adopt if `serviceReady` | Always stop | Policy | P1 |

---

## Verification results

| Check | Command/action | Result | Evidence |
| --- | --- | --- | --- |
| Scanner | `scan_dashboard.py` | Six workspaces; dirty tree listed | `/tmp/dashboard-rca-2026-08-24/` |
| Git | `rev-parse` / `status` | `976503b` AppKit dirty | 31 modified + untracked |
| Binaries | `stat` + sha256 + `strings` | Build 24 Aug `16eaf7dd…`; Dock 21 Aug `148bd643…` | table above |
| Flask / vinext | `lsof` + `curl` | Both live 200 | PID 22307 / 22302 |
| Launch source | read supervisor + test | Always-stop confirmed | lines cited |
| Hover source | read `shared-ui.tsx` | `hoverIndex` first | :377 |
| iOS pop-out | read three files | Handler / `#if os(macOS)` / `return null` | cited |
| Leftover Intel | `workspace-routing.test.mjs` | Maps to `m1` | test name |
| M-1 Monday | dirty test + function | Walkback present | :162, test :312 |
| Stratji window | not launched | — | residual |
| `npm run lint` / build / rendered-html | **not run** (read-only RCA) | — | implementer |

---

## Residual risks and open questions

- **Blocked evidence:** No Stratji.app window attach; no pixel dual-chrome on Dock vs build this hour; no complete Mail/Health freshness re-audit.
- **Unverified hypotheses:** Auto-`openSatyaDraftPopout` on every stream may be intended Mac UX. First-launch should **not** recycle a leftover LaunchAgent that is already `serviceReady` (this RCA says no). 21 Aug Dock + current FOUC is one droplet (high confidence, not screenshotted).
- **Monitoring:** After adopt-live, watch `~/Library/Logs/PortfolioIntelligence/desktop-app.log` for “fresh start” vs “skip a second dash-start.” `ps` path must contain `apple-app/build` or Dock sha256 must equal build.
- **Follow-up date:** Next implement pass (only if operator asks). Sibling chats: Documents TCC, Satya suggestions, Satya pop-out answers.
- **Do not:** Kill healthy `:5050`. Treat Dock as current. Invent KPIs. Add a startup-fail banner. Compact the Kanban. Put Satya digest walls back on M-2.

---

## Deliverable pointers

- **RCA:** `RCAs/2026-08-24-localhost-vs-stratji.md` (this file)
- **Plan:** `Plans/2026-08-24-localhost-vs-stratji-remediation.md`
- **Prior:** `Project-Status/PROJECT-STATUS.md` · `Code-Reviews/2026-08-24-localhost-vs-stratji-chrome.md`
