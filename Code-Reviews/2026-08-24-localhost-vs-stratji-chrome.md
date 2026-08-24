# 🔍 AUDIT — Localhost vs Stratji.app chrome / launch · REQUEST CHANGES

**Scope:** DIR + dirty-tree DIFF — native Stratji chrome vs localhost web chrome, launch path, Satya draft NSPanel, Documents TCC, uncommitted Satya / M-1.
**Repo:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard`
**Branch:** `AppKit` @ `976503b` (`origin/AppKit`)
**Review range:** working tree vs `976503b` (branch == HEAD; there is no committed-ahead range). Dirty + untracked is the change set.
**Prior step:** `$project-status` at `Project-Status/PROJECT-STATUS.md` / `Plans/PROJECT-STATUS.md` (2026-08-24 00:36 IST). This is sequence step 2. Do not implement.
**Date:** 2026-08-24 · **Flags:** none (`--fix` not applied; Flask `:5050` not touched)

**Dirty tree:** +1062 / −338 across 31 tracked files, plus 9 untracked (Satya draft pop-out, TCC test, suggestions test, status snapshots). Largest deltas: `satya-suggestions.ts` +280 net, `satya-client.ts` +95, `intelligence-daily-actions.ts` +102, `StratjiConfiguration.swift` +91, `SatyaPresence.tsx` +31, new `StratjiSatyaDraftBridge.swift` 365.

**Coverage:**
- **Audited in full:** `StratjiSatyaDraftBridge.swift`, `SatyaDraftPopout.tsx`, `FlaskServiceSupervisor.swift`, `StratjiConfiguration.swift`, `Stratji.entitlements`, `StratjiDocumentBrowser.swift`, `DashboardBrowser.swift`, `scripts/start-flask-app.sh`, `scripts/stop-flask-app.sh`, `app/layout.tsx` FOUC, `app/native-chrome.css` hide contract, `shared-ui.tsx` `DashboardTabs` hover, `intelligence-daily-actions.ts` date walkback, `satya-client.ts` draft-popout surface (770–889), `local-llm-assist.ts`, `StratjiApplePermissions.swift` (Documents is not this file), `tests/satya-draft-popout.test.mjs`, `tests/stratji-documents-tcc.test.mjs`, `apple-app/InvestmentDashboardTests/SatyaDraftPopoutTests.swift`, Monday walkback in `tests/intelligence-daily-actions.test.mjs`.
- **Sampled:** `SatyaPresence.tsx` (draft open / mount; not every line of 1153), `SatyaBriefingRoom.tsx` draft wiring, `satya-suggestions.ts` catalogs, `app/satya/chat.ts` evidence-inventory prompt, `StratjiSessionModel.swift` `select` / `waitUntilFlaskReady` / `pollRefreshProgress`, `StratjiWorkspaceGlassBar.swift` `clusterWorkspace`, `AppDelegate.swift` kickoff, workspace `useSatyaTaskContext` call sites, `tests/rendered-html.test.mjs` native-chrome asserts, `tests/native-launch-refresh.test.mjs` recycle pins, `scripts/run-dashboard-service.sh` boot order, `FlaskHealthDTO`, `flask_gateway.py` health 503.
- **Excluded:** Health KPI rows, Symphony editor internals, Satya FTS retrieve, appearance CSS beyond `native-chrome.css`, status-canvas React, `artifacts/private`.

**Assumptions:** Unattended. Did not launch Stratji.app or hit `:5050` / `:3000` (sandbox blocked `ps`/`lsof`). Binary hashes and `strings` were read from disk. Operator still launches Dock `/Applications/Stratji.app` unless told otherwise.

**Dock vs `apple-app/build` (process, not a code P0):**

| Binary | mtime | size | sha256 (Mach-O) | `satyaDraft` / bookmark |
|---|---|---|---|---|
| `apple-app/build/Stratji.app` | **2026-08-24 00:41:09** | 10480976 | `16eaf7dd6f712c854ed52d81c9f90c1fbfa338cdb953c15dc039f6f8405e9295` | **present** (`StratjiSatyaDraftBridge`, `StratjiRepoRootBookmark`, `nativeOwnsSections`) |
| `/Applications/Stratji.app` | 2026-08-21 20:55:53 | 10097856 | `148bd6432e3c60e99f87a596325a08d20e84678389ec5fc01e3c6192aa503e88` | **absent** |
| `~/Applications/Stratji.app` | 2026-08-21 20:55:53 | 10097856 | `148bd643…` (same as Applications) | **absent** |

Launching Dock is sufficient to miss the NSPanel, bookmark cache, and the 24 Aug overlay. That is an **operator/process** finding. Prefer `apple-app/build/Stratji.app`. Recopying Dock is not a code change. The **code** findings below still ship even if the operator opens the build.

---

## Verdict: **REQUEST CHANGES**

The Aug 21 dual-chrome hide contract is now in FOUC + CSS (Macintosh + `Stratji/` owns sections; iOS / `?nativeChrome=1` opt back in with `data-native-web-nav`). Native glass hover is correct. M-1 Monday walkback and the Satya NSPanel split (Mac panel / web dialog / current-turn only) are the right shapes.

The dirty tree is not mergeable as chrome/Satya/TCC Done. iOS registers `satyaDraft` and then compiles the panel out, so Pop out is a silent no-op. `kickoffAtLaunch` still kills a healthy `:3000`/`:5050` on every Stratji recycle — that is the vinext connection-refused path, and tests pin it. Localhost hover still expands another workspace’s sections. `satya.css` crossed 1000 lines; `satya-client.ts` and `SatyaPresence.tsx` grew further past 1k. Documents TCC is better on workspace change (cache, no `stat` on `select`) and still wrong on Refresh / launch (Documents cwd, sandbox-off entitlements).

No P0 data-loss or Flask-kill-of-a-healthy-listener outside Stratji’s own stop-then-start survived falsification. Do not treat Dock as current. Do not kill a leftover healthy `:5050` except that explicit recycle.

| Dimension | Score | Note |
|---|---|---|
| Correctness & safety | 5/10 | iOS pop-out no-op; hover lies; always-recycle leaves `:3000` refused |
| Security | 8/10 | Draft handler is same-origin; entitlements are decorative, not a new hole |
| Structural quality (judo) | 5/10 | Draft state stuffed into a 1k+ client; two suggestion catalogs; 1k CSS |
| Layout & modularity | 6/10 | `SatyaDraftPopout.tsx` + Swift bridge are in the right layers; state is not |
| Tests | 6/10 | Monday + draft unit tests are real; hover uncovered; TCC/launch are source-greps |
| Legibility & docs | 7/10 | Comments on TCC / owns-sections / current-turn are honest |
| Operability | 4/10 | Dock vs build is the incident; recycle is designed-in; FDA button is a workaround |
| **Weighted** | **5.9/10** | |

### Approval bar

| Bar | Met? |
|---|---|
| No clear structural regression | **No** — `satya.css` 945→1016; `satya-client` / `SatyaPresence` grown further past 1k |
| No obvious missed simplification | **No** — adopt-live launch; iOS must not register `satyaDraft`; hover = `activeIndex` |
| No unjustified file-size explosion | **No** — 1k tripwire + 146% `satya-suggestions.ts` |
| No spaghetti growth | **No** — web hover still impersonates selection; iOS handler is a special-case trap |
| No hacky / magical abstraction | Yes — NSPanel vs web dialog is the right split |
| No unnecessary wrapper / cast churn | Yes |
| No architecture-boundary leak | Partial — Refresh still `cwd`s Documents from the supervisor |
| No missed obvious decomposition | **No** — extract draft-popout module from `satya-client.ts` |
| No unmitigated P0 / P1 correctness | **No** — three P1 functional, two P1 structural |
| Tests for new behavior / the bug | Partial — M-1 and draft yes; hover / iOS / recycle-adopt no |

## 🧨 Presumptive blockers

1. **1000-line rule:** `app/dashboard/satya.css` **945 → 1016**. Split pop-out / companion rules out before merge.
2. **Ad-hoc branching:** web `pillIndex = hoverIndex ?? …` still expands a foreign workspace. Native already does not.
3. **Launch special case:** `kickoffAtLaunch` always `stopDataPlane` then dash-start. A live `serviceReady` stack is killed. Tests freeze that “fresh start.”
4. **Security-sensitive path without a working surface:** iOS adds `satyaDraft` and then `#if os(macOS)` no-ops the panel; web modal is suppressed. No runtime test.
5. **Import cycle / CI weakened:** none tripped.

## 🥋 Code-judo assessment

**JUDO AVAILABLE** — three independent deletions, not one mega-refactor.

1. **Launch adopt-live (tier S).** Today: every Stratji open stops Flask + Vinext, waits ≤20s, dash-starts, splash waits on Flask `serviceReady`. Proposed: if `/_flask/health` already has `serviceReady`, skip stop (same as `ensureRunning(recycle: false)`). Recycle only on Retry. Concepts 3 → 1 (one “is the stack ready?” path). Behavior preserved for first install and explicit Retry. **Desired change:** relaunch no longer refuses `:3000`. Effort: DO IN THIS PR IF FEASIBLE. Risk: low.
2. **iOS does not own the NSPanel (tier S).** Do not `userContentController.add(..., satyaDraft)` on iOS. Then `hasNativeSatyaDraftPopout()` is false and the web dialog is the one surface. Deletes the “handler exists / panel compiled out” illegal state. Effort: DO NOW.
3. **Web hover = native `clusterWorkspace` (tier A).** `pillIndex = activeIndex` (hover only scales). Deletes the hover-impersonates-selection branch. Native already did this. Effort: DO NOW.

Rejected: merging NSPanel + web dialog behind a mode flag. Two hosts are correct (AppKit cannot be CSS; CSS cannot be liquid glass).

**ALREADY MINIMAL (subset):** Swift `GlassEffectContainer` vs web droplet. Exclusive `?section=` via `nativeChromeHidesSection`. FOUC Macintosh + `Stratji/` → `data-native-owns-sections` (the Aug 21 judo **landed**). M-1 `resolveIntelligenceEvidenceDateKeys` newest-mintable-in-window (not Friday-only). `currentSatyaTurn` last-user slice.

---

## Findings

### [P1] iOS registers `satyaDraft` then compiles the panel out — Pop out is a silent no-op · `apple-app/InvestmentDashboard/DashboardBrowser.swift:147` · `app/dashboard/SatyaDraftPopout.tsx:110` · `apple-app/Shared/StratjiSatyaDraftBridge.swift:150` · CONFIRMED

**What:** iOS WKWebView adds `webkit.messageHandlers.satyaDraft`. `hasNativeSatyaDraftPopout()` is then true. `SatyaDraftPopout` returns `null`. The bridge’s `handle` is `#if os(macOS)` only.

**Why it matters:** On iPhone, tap Pop out on M-2 / the orb. JS posts `open`. Native does nothing. Web modal never mounts. The operator sees no window and no error. Mac Stratji uses `StratjiDocumentBrowser` (panel exists) and is fine.

**Evidence:**

```147:155:apple-app/InvestmentDashboard/DashboardBrowser.swift
        let satyaDraft = StratjiSatyaDraftBridge()
        configuration.userContentController.add(satyaDraft, name: StratjiSatyaDraftBridge.messageName)
        // ...
        satyaDraft.webView = view
```

```150:157:apple-app/Shared/StratjiSatyaDraftBridge.swift
        DispatchQueue.main.async { [weak self] in
            #if os(macOS)
            StratjiSatyaDraftPanelController.shared.attach(webView: self?.webView)
            StratjiSatyaDraftPanelController.shared.handle(payload)
            #endif
        }
```

```110:110:app/dashboard/SatyaDraftPopout.tsx
  if (!open || hasNativeSatyaDraftPopout() || !host) return null;
```

**Remedy:** Register `satyaDraft` only on macOS (`#if os(macOS)` around add + assign). Behavior preserved: yes on Mac; iOS gains the web dialog (desired). Effort: DO NOW.

---

### [P1] `kickoffAtLaunch` always kills a live Vinext/Flask stack · `apple-app/Stratji/FlaskServiceSupervisor.swift:70` · `scripts/start-flask-app.sh:102` · CONFIRMED

**What:** Every Stratji launch calls `stopDataPlane()` then `runDashStartInBackground()`. `ensureRunning(recycle: false)` already knows how to `adoptLiveGatewayWithoutRecycle` when `serviceReady`. Launch does not use that path. `waitUntilDashboardPortsFree` gives up after 20s and dash-starts anyway. `start-flask-app.sh` can take the leftover-`flask_bound` / vinext-only path, or exit 0 while `run-dashboard-service.sh` is still waiting on `:3000`.

**Why it matters:** Operator has a healthy `:5050` + `:3000`. They quit/reopen Stratji (or the app recycles). Stop kills both. Browser `:3000` is connection-refused until Vinext binds again (up to 90s in `run-dashboard-service.sh`). Splash waits on Flask `serviceReady` (good), but localhost `:3000` and any client that hit Vinext directly fail. `tests/native-launch-refresh.test.mjs` **pins** “stopping leftover dashboard processes for a fresh start.”

**Evidence:**

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

```405:419:apple-app/Stratji/FlaskServiceSupervisor.swift
        for tick in 0 ..< 80 {
            if ports.allSatisfy({ !isPortListening($0) }) { ... return }
            ...
        }
        appendDesktopLog("Launch: leftover listeners still bound after 20s; dash-start will wait\n")
```

`isReachable` already requires `FlaskHealthDTO.serviceReady` (`gateway == flask` **and** `upstreamStatus == 200`). Flask `/_flask/health` is HTTP 503 when Vinext is down. The health check is honest; the **policy** of always stopping is the defect.

**Remedy:** If `isReachable()` before stop, adopt and return. Recycle only when `ensureRunning(recycle: true)` / Retry. Flip the launch-refresh test from “always stop” to “stop only when not `serviceReady`.” Behavior preserved: no for relaunch (desired: keep the live stack). Effort: DO IN THIS PR IF FEASIBLE. Do not kill a healthy leftover `:5050` unless recycle is explicit.

---

### [P1] Web droplet hover still impersonates the selected workspace · `app/dashboard/shared-ui.tsx:377` · CONFIRMED

**What:** Native `clusterWorkspace = session.workspace` (hover scales a glyph only). Localhost `DashboardTabs` still sets `pillIndex = hoverIndex ?? focusIndex ?? activeIndex` and expands that workspace’s section titles while `?view=` stays on the selected workspace.

**Why it matters:** Hover Sectors while Investment is selected → S-1/S-2/S-3 titles over the Investment board. Click still switches `?view=`. This is the screenshot class of bug without a stale Dock binary. No test asserts `pillIndex === activeIndex`.

**Evidence:**

```377:378:app/dashboard/shared-ui.tsx
  const pillIndex = hoverIndex ?? focusIndex ?? activeIndex;
  const dropletWorkspace = visibleWorkspaces[pillIndex] ?? visibleWorkspaces[activeIndex];
```

```39:41:apple-app/Stratji/StratjiWorkspaceGlassBar.swift
    private var clusterWorkspace: StratjiWorkspace {
        session.workspace
    }
```

**Remedy:** `pillIndex = activeIndex`. Keep `hoverIndex` only for glyph scale / `data-hover` if CSS needs it. Behavior preserved: click still switches workspace. Hover preview of foreign sections is removed (desired, matches native). Effort: DO NOW.

---

### [P1] `satya.css` crosses 1000 lines · `app/dashboard/satya.css` 945 → 1016 · CONFIRMED

**What:** This dirty tree pushed companion / draft-popout CSS over the 1k tripwire.

**Why it matters:** Presumptive blocker. The file is already the Satya kitchen sink (orb, briefing, popup, waveform, reduced-motion). Pop-out rules should not be the increment that crosses.

**Remedy:** Move `.satya-draft-popout*` (and only those) to `satya-draft-popout.css` imported next to `SatyaDraftPopout.tsx`, or into a short section file. Check for an import cycle: none if it only uses existing tokens. Behavior preserved: yes. Effort: DO NOW.

---

### [P1] Draft pop-out grew two files that were already over 1000 lines · `app/dashboard/satya-client.ts` 1027 → 1122 · `app/dashboard/SatyaPresence.tsx` 1122 → 1153 · CONFIRMED

**What:** `satya-client.ts` absorbed pop-out state, native `postMessage`, `currentSatyaTurn`, and callbacks. `SatyaPresence.tsx` gained auto-open-on-stream + `<SatyaDraftPopout />`. Both were already over 1k at `976503b`.

**Why it matters:** This **propagates** an existing 1k breach. The next Satya feature will land in the same two files. `SatyaDraftPopout.tsx` (147) and `StratjiSatyaDraftBridge.swift` (365) already prove the concept has a home.

**Remedy:** Extract `app/dashboard/satya-draft-popout.ts` (`open/close/sync/subscribe/hasNative/currentSatyaTurn/installCallbacks`). Leave `setSatyaThread` as a one-line notify. `SatyaPresence` only imports the opener. Behavior preserved: yes. Effort: DO IN THIS PR IF FEASIBLE.

---

### [P2] Documents TCC: workspace nav is fixed; Refresh / launch still touch the checkout; sandbox-off entitlements do not persist Allow · `apple-app/Stratji/StratjiConfiguration.swift:55` · `FlaskServiceSupervisor.swift:158` · `Stratji.entitlements:7` · CONFIRMED

**What:** `repoRoot` now caches and does not `fileExists` Documents on the getter. `select` / `DocumentBrowser.load` / `latestRefreshProgress` no longer `stat` the checkout — that should stop **workspace-change** re-prompts. `persistRepoRoot` still `bookmarkData`s a path-constructed URL (not `NSOpenPanel`). App Sandbox is **false**; `files.user-selected.read-write` and `files.bookmarks.app-scope` do not apply. `runRefreshScript` still sets `currentDirectoryURL = repoRoot` and execs `scripts/refresh-dashboard-data.sh` from Documents. `runStopScript` same. Onboarding adds “Grant Full Disk Access for `apple-app/build/Stratji.app`.”

**Why it matters:** Operator Allows on Refresh all / first launch; workspace change may now be quiet (if they run the 00:41 build). Refresh all and Stratji recycle still access `~/Documents/GitHub/…`. Bookmark-without-user-selection + unsandboxed process is not a persistent all-file grant. Tests only grep for `cachedRepoRoot` / entitlement keys.

**Remedy:** Keep I/O on Application Support wrappers (already used for dash-start). For Refresh, invoke the support trampoline that `cd`s to the bookmarked root **once** after `startAccessingSecurityScopedResource`, or copy the refresh script beside the trampoline. If persistent Allow is the product, use `NSOpenPanel` once and store that bookmark — or document FDA as the real grant and stop claiming entitlements persist it. Behavior preserved: yes if the checkout path stays the same. Effort: FOLLOW-UP (sibling TCC chat) for panel/FDA; DO NOW to stop Refresh `fileExists` on Documents if any remain.

---

### [P2] Two Satya suggestion catalogs will drift · `app/dashboard/satya-suggestions.ts:233` · `app/dashboard/satya-suggestions.ts:321` · CONFIRMED

**What:** `satyaSuggestionsForWorkspace` (Investment / Sectors / Intel / Health / Builder / Strategies) and `defaultSatyaSuggestions(task)` both own chip lists. Workspaces now call `useSatyaTaskContext` with the workspace catalog (including Health — status said it did not). Task defaults remain for assist slots.

**Why it matters:** 192 → 472 lines (146%). The arrays are declarative (waiver-adjacent), but the **same knowledge** (Axis-picks wording, “never invent CMP”) lives twice. The next copy change will miss one.

**Remedy:** Workspace catalogs are the source of truth. `defaultSatyaSuggestions` should pick a workspace (or a named catalog) instead of restating chips. Behavior preserved: yes if mapping is 1:1. Effort: FOLLOW-UP.

---

### [P2] Hover, iOS pop-out, and adopt-live have no behavioral tests · `tests/rendered-html.test.mjs:639` · `tests/native-launch-refresh.test.mjs:257` · CONFIRMED

**What:** Native chrome tests assert FOUC Macintosh + hide CSS (good; Aug 21 gap closed). They do not assert web `pillIndex === activeIndex`. Launch tests require the always-stop string. Draft tests are real for `currentSatyaTurn` / close-keeps-thread, then fall back to wiring greps. TCC test is a source slice.

**Why it matters:** The three P1s above can regress without a red test. Grep tests freeze the **wrong** launch policy.

**Remedy:** One `shared-ui` / rendered-html assert that the droplet `data-droplet` follows `active`, not hover. One iOS-browser assert that `satyaDraft` is not added (or is `#if os(macOS)`). Rewrite launch test to allow adopt-live. Effort: DO NOW for hover; with the iOS / launch fixes.

---

### [P3] `waitUntilDashboardPortsFree` continues after 20s with listeners still bound · `apple-app/Stratji/FlaskServiceSupervisor.swift:419` · CONFIRMED

**What:** After 80 × 250ms, dash-start proceeds. Combined with leftover `flask_bound`, `start-flask-app.sh` may vinext-only against a dying Flask.

**Why it matters:** Secondary to the always-recycle P1. If adopt-live lands, this path is Retry-only.

**Remedy:** After timeout, treat as recycle-failed (surface FDA / Retry) instead of starting a second stack. Behavior change: yes (safer). Effort: with the launch judo.

---

### [NOTE] Dock vs build is a process finding

`apple-app/build/Stratji.app` (24 Aug 00:41, `16eaf7dd…`) contains `satyaDraft` and `StratjiRepoRootBookmark`. Dock / Applications (21 Aug 20:55, `148bd643…`) contain neither. Opening Dock against today’s Flask HTML is an operator miss, not a missing inject in current source (FOUC now sets owns-sections). Still: **do not treat Dock as current.**

### [NOTE] Aug 21 hide-contract judo landed

`layout.tsx:57` FOUC: Macintosh + `Stratji/` → `data-native-owns-sections=1`; else `data-native-web-nav=1`. `native-chrome.css:125` hides `.workspace-navigation` for every `native-chrome-embed`, then iOS/localhost opt back in. Stale Dock + new CSS no longer paints two droplets. That was the right fix.

### [NOTE] M-1 Monday walkback is the simplest reasonable date model

`resolveIntelligenceEvidenceDateKeys` (`intelligence-daily-actions.ts:162`) uses today’s session if mintable; else newest day in prior-NSE…yesterday, including Sunday mail. Test `a Monday open includes Saturday and Sunday mail, not only Friday` (`tests/intelligence-daily-actions.test.mjs:312`) would fail if Friday Punch leaked over Sunday newsletters. Do not mix this with chrome merge until the P1s above are done — but do not rewrite the date function.

---

## PASS A — CODE-REVIEW

Functional defects: iOS pop-out (P1), always-recycle vinext refuse (P1), web hover (P1). M-1 walkback and current-turn pop-out (close does not clear thread) are correct and tested. `isReachable` / `FlaskHealthDTO.serviceReady` correctly require Vinext 200; Flask health is 503 when upstream is down. `installSatyaDraftNativeCallbacks` runs from `SatyaDraftPopout` even when the dialog returns null (effects still fire) — Mac close → JS `onClose` works. No new injection/auth hole. `evaluateJavaScript` close is a fixed string. Chat remains operator-Mac-only (out of this dirty chrome set). No P0.

## PASS B — CODE-QUALITY

Judo above. Spaghetti: hover branch in `DashboardTabs`; iOS handler as a feature check in the wrong place (`hasNative` is “handler exists,” not “panel can show”). 1k rule tripped on `satya.css`; two more files extended over 1k. `satya-suggestions.ts` growth is mostly tables — keep the table, delete the second catalog. Health `useSatyaTaskContext` is the right home (status is stale). Story prompt in `local-llm-assist.ts` / `chat.ts` is long but one switch + one inventory string — ALREADY MINIMAL vs a prompt DSL.

## PASS C — CODE LAYOUT

`SatyaDraftPopout.tsx` next to `SatyaPresence` / `satya-client` is findable. `StratjiSatyaDraftBridge.swift` in `apple-app/Shared` matches `StratjiSatyaSpeechBridge`. iOS `DashboardBrowser` should not import a Mac-only panel’s handler. Launch scripts stay under `scripts/`. No new import cycle. After this change the repo is **harder** to navigate in Satya (three 1k files) and **easier** in chrome (FOUC owns the hide) and TCC (cache lives in `StratjiConfiguration`).

## 📐 Metrics

| File | Before | After | Δ | Flag |
|---|---|---|---|---|
| `app/dashboard/satya.css` | 945 | 1016 | +71 | **1k crossed** |
| `app/dashboard/satya-client.ts` | 1027 | 1122 | +95 | already >1k, grew |
| `app/dashboard/SatyaPresence.tsx` | 1122 | 1153 | +31 | already >1k, grew |
| `app/dashboard/satya-suggestions.ts` | 192 | 472 | +280 | +146%, yellow |
| `app/dashboard/intelligence-daily-actions.ts` | 290 | 392 | +102 | yellow |
| `apple-app/Stratji/StratjiConfiguration.swift` | 235 | 326 | +91 | |
| `apple-app/Shared/StratjiSatyaDraftBridge.swift` | 0 | 365 | +365 | new, fine |
| `app/dashboard/SatyaDraftPopout.tsx` | 0 | 147 | +147 | new, fine |
| `apple-app/Stratji/FlaskServiceSupervisor.swift` | 631 | 628 | −3 | |
| `app/dashboard/SatyaBriefingRoom.tsx` | 391 | 368 | −23 | |
| `app/page.tsx` | — | 953 | — | yellow, pre-existing |
| `tests/rendered-html.test.mjs` | 2292 | 2301 | +9 | test tables; waived |

## 🗺 Layout verdict

Chrome hide contract is now discoverable from `layout.tsx` FOUC + `native-chrome.css` without requiring a rebuilt binary. Satya draft has a correct **file** split (TSX + Swift) and a wrong **state** home (`satya-client.ts`). Launch policy is still “always recycle” in the supervisor, which is the opposite of the Application Support trampoline work. Net: easier to find the hide switch; harder to own Satya and launch.

## ✅ What's good here

- Aug 21 judo landed: FOUC Macintosh+`Stratji/` owns sections; CSS defaults hide; iOS opts in with `data-native-web-nav`.
- Native glass `clusterWorkspace = session.workspace` is the spec. Close-keeps-thread is encoded in both Swift and `closeSatyaDraftPopout`.
- M-1 newest-mintable-in-weekend-window with a test that would fail on Friday-only walkback.
- TCC: `select` / poll / `latestRefreshProgress` stopped `stat`ing Documents. dash-start prefers Application Support `start-dashboard.command`.

## ❓ Open questions for the author

- Is auto-`openSatyaDraftPopout` on every M-2 / orb stream the intended Mac UX, or only the Pop out control? Code always opens.
- Should first-launch still recycle if `serviceReady` is true from a leftover LaunchAgent? This audit says no.

## 📋 Follow-up tickets suggested

- Recopy `apple-app/build/Stratji.app` over Dock / Applications (process; not a PR).
- NSOpenPanel or documented FDA as the only persistent Documents grant.
- Collapse `defaultSatyaSuggestions` onto workspace catalogs.

---

## Self-audit (INSTRUCTION 12)

Cited lines re-read in the working tree. Three passes produced findings. Judo is not a rename. 1k counts from `wc -l` vs `git show HEAD`. Dock vs build classified as process. Verdict matches open P1s. Flask `:5050` not killed. No implementation.
