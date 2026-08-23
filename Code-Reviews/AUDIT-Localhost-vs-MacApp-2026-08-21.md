# 🔍 AUDIT — Localhost vs Stratji.app chrome/launch · REQUEST CHANGES

**Scope:** DIR mode — native/web chrome and launch only. Dirty-tree files in this surface included; Satya / digest / earnings / Health KPI files excluded unless they own workspace/section chrome.
**Repo:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard`
**Branch:** `AppKit` @ `cbb3356e846eabd64f713bec4c6431e81a8fec72` (`origin/AppKit`)
**Base / trunk:** `origin/main` @ `c0a85491e26dadcf2dfd9decf4d266d1827e1b1f`
**Dirty tree:** chrome/launch subset is dirty (`StratjiWorkspaceGlassBar.swift` +270/−?, `StratjiDashboardViewController.swift` −198 net, `FlaskServiceSupervisor.swift` +193, `native-chrome.css` +54, `page.tsx` / `shared-ui.tsx` / `workspace-routing.ts`, native tests). This audit reads **working-tree files**, not HEAD-only.
**Date:** 2026-08-21 · **Flags:** none (`--fix` not applied; no production edits; Flask `:5050` not touched)

**Coverage:**
- **Audited in full:** `apple-app/Stratji/StratjiWorkspaceGlassBar.swift`, `FlaskServiceSupervisor.swift`, `StratjiDashboardViewController.swift`, `apple-app/Outline/DashboardOutline.swift`, `DashboardNativeRoute.swift`, `apple-app/Shared/StratjiWorkspace.swift`, `StratjiDocumentBrowser.swift` (owns-sections inject), `app/dashboard/workspace-routing.ts`, `app/native-chrome.css`, `app/dashboard/shared-ui.tsx` (`WorkspaceSectionNav` / `DashboardTabs` / `nativeChromeHidesSection`), `app/page.tsx` chrome/nativeChrome/DashboardTabs/selectWorkspace branches (lines 123–180, 588–773, 780–937; remaining page is data-refresh, sampled), `app/layout.tsx` FOUC script, `tests/native-launch-refresh.test.mjs`, `tests/native-sidebar-click.test.mjs`, `tests/workspace-routing.test.mjs`, `tests/rendered-html.test.mjs` nav/nativeChrome assertions (~567–772, 1108–1134, 2161–2218).
- **Sampled:** `StratjiSessionModel.swift` bootstrap/select/hydrate, `AppDelegate.swift` kickoff, iOS `DashboardBrowser.swift` (no owns-sections), `InvestmentWorkspace.tsx` exclusive-section `hidden=`, `app/dashboard/utils.ts` `barLabel` table.
- **Excluded:** Satya corpus/chat, Axis ingest, Health KPI rows, Symphony editor, appearance CSS churn except native-chrome.

**Assumptions:** Operator still launches Dock `/Applications/Stratji.app` and/or `~/Applications/Stratji.app` unless told otherwise. Flask on `:5050` is the Mac document origin. I did not launch Stratji.app or hit `:5050`. Binary mtimes were read from disk.

**Dock vs source (process, not a code P0):**

| Binary | mtime (local) | owns-sections inject |
|---|---|---|
| `/Applications/Stratji.app` | **2026-08-20 12:44:30** | absent in that build (pre-inject) |
| `~/Applications/Stratji.app` | **2026-08-20 12:44:29** | same stale copy |
| `apple-app/build/Stratji.app` | **2026-08-21 01:01:34** | present in current source (`dataset.nativeOwnsSections = '1'`) |

Launching Dock is sufficient to paint **two chrome rows** against **current** Flask HTML/CSS. That is an operator/process finding. It is also a **code** finding: current web CSS defaults the web droplet **on** unless a WK inject the Dock binary never runs. See P1.

## Verdict: **REQUEST CHANGES**

The live screenshot (Sectors + I-1 board + Investment canvas) is explained without inventing a routing bug. Dock Stratji.app is a day behind `apple-app/build/Stratji.app`. Current `native-chrome.css` keeps `.workspace-navigation.mode-dial` at `display:flex !important` unless `html[data-native-owns-sections="1"]`. Localhost `:3000` is supposed to show the combined full-name droplet; a stale Mac shell plus that CSS stacks native overlay **and** web `DashboardTabs`. Current source has the inject; the hide switch still lives in a rebuilt binary, not in the FOUC path that already detects `Stratji/` UA. That is not mergeable as “chrome parity Done.” Hover-preview of another workspace over the live board is a second, current-source way to reproduce Sectors-on-Investment.

No P0 data-loss or Flask-kill path survived falsification. `kickoffAtLaunch` / `adoptLiveGatewayWithoutRecycle` skip a live `:5050`. Do not treat Dock as current.

| Dimension | Score | Note |
|---|---|---|
| Correctness & safety | 6/10 | Dual chrome on stale Mac + current web; hover preview lies about workspace; Intel→S-1 leftover is actually guarded |
| Security | 9/10 | Chrome flags are presentation-only; iOS/Mac UA is not an auth boundary |
| Structural quality (judo) | 5/10 | Hide contract split across WK inject / FOUC / CSS / tests; two full droplet UIs |
| Layout & modularity | 7/10 | Files sit in the right layers; section catalog is duplicated Swift vs TS |
| Tests | 5/10 | Source-grep freezes the dual-chrome hedge; no FOUC Macintosh+owns-sections assertion |
| Legibility & docs | 7/10 | CSS comments state the hedge clearly; test title “hides workspace tabs” contradicts its asserts |
| Operability | 4/10 | Dock vs `apple-app/build` is the incident; app does not warn that the running binary is stale |
| **Weighted** | **6.3/10** | |

## 🧨 Presumptive blockers

1. **Spaghetti / scattered feature check:** `native-owns-sections` is the Mac-only hide switch, but it is set only in `StratjiDocumentBrowser` WKUserScript. FOUC, CSS default, `page.tsx` (always mounts `DashboardTabs`), and `rendered-html` hide-selector tests all conspire to show the web cluster. Stale Dock binaries are the production path.
2. **1000-line rule:** not tripped in chrome source. `app/page.tsx` is **938** (was 503 vs trunk) — yellow, not a blocker. `tests/rendered-html.test.mjs` is **2244** (test tables; waived).
3. **Import cycle:** none in this surface.
4. **CI weakened / tests deleted:** no. Tests **pin** the dual-chrome default.

## 🥋 Code-judo assessment

**JUDO AVAILABLE** — one hide contract, evaluated at first paint, not “a rebuilt binary set a dataset flag.”

- **Concepts today (5):** `?nativeChrome=1`, `native-chrome-embed` class, FOUC script, WK `nativeOwnsSections` inject, CSS last-wins hide.
- **Proposed (2):** (1) FOUC: Macintosh + `Stratji/` UA → `data-native-owns-sections=1` (Mac overlay owns the droplet). (2) everyone else (`:3000` browser, iOS `iPhone`/`iPad` + `Stratji/`) keeps the web combined cluster.
- **What disappears:** “stale Dock + new CSS = two bars” as a class of incident; the requirement that chrome parity waits on copying `apple-app/build` to `/Applications`.
- **Behavior preserved:** yes for localhost `:3000` (no Stratji UA). yes for iOS (UA is not Macintosh). yes for current `apple-app/build` (inject becomes redundant). **Behavior change (desired):** 20 Aug Dock app loading 21 Aug Flask HTML hides the web droplet.
- **Effort:** DO NOW (< 30 min FOUC + one test). Risk: **low**.

Rejected alternative: “always hide `.workspace-navigation` under `native-chrome-embed`.” That would strip iOS of its only combined cluster (`DashboardBrowser.swift` never sets owns-sections; CSS comments say that is intentional).

**ALREADY MINIMAL (subset):** Swift `GlassEffectContainer` vs web CSS droplet — CSS cannot do macOS 26 liquid glass; two implementations are the right split. Exclusive `?section=` via `nativeChromeHidesSection` on all six workspaces — one rule, not a native-only special case. Flask `adoptLiveGatewayWithoutRecycle` — do not recycle a live `:5050`.

---

## Findings

### [P1] Web cluster stays visible unless a rebuilt Mac binary injects `nativeOwnsSections` · `app/native-chrome.css:127` · `app/layout.tsx:57` · `apple-app/Shared/StratjiDocumentBrowser.swift:140` · CONFIRMED

**What:** Mac Stratji overlay is supposed to own the combined workspace+section droplet. The hide is gated on `html[data-native-owns-sections="1"]`. Current Flask CSS **forces the web cluster visible** for every other native-chrome document. FOUC already detects `Stratji/` UA and sets `native-chrome-embed`, but **does not** set owns-sections. Only Mac `StratjiDocumentBrowser.makeBootstrapScript` sets the flag.

**Why it matters:** Dock `/Applications/Stratji.app` and `~/Applications/Stratji.app` are **2026-08-20 12:44**. They do not run the 21 Aug inject. They still load **today’s** Flask document. Result: native overlay (workspace pills, often abbreviated `Sectors`) stacked on web `DashboardTabs` (section chips / I-1 collapsible on the Investment board). Localhost `:3000` looks correct because there is no overlay. `apple-app/build/Stratji.app` **2026-08-21 01:01** is the binary that matches source.

This is **both** a process finding (operator launched Dock) **and** a code defect (hide switch is not in the HTML/CSS the stale app actually executes).

**Evidence:**

```125:156:app/native-chrome.css
/* Native overlay draws the combined workspace + section droplet. Keep the web
   cluster visible unless a rebuilt Stratji binary sets native-owns-sections. */
html.native-chrome-embed .workspace-navigation.mode-dial,
html[data-native-chrome] .workspace-navigation.mode-dial,
.dashboard-app.native-chrome>.workspace-navigation.mode-dial {
  display:flex !important;
  ...
}
html[data-native-owns-sections="1"] .workspace-navigation.mode-dial {
  display:none !important;
  ...
}
html[data-native-owns-sections="1"] .dashboard-app {
  padding-top:86px;
}
```

```57:57:app/layout.tsx
const nativeChromeFoucScript = `(function(){try{var q=location.search||"";var ua=navigator.userAgent||"";var native=/(?:^|[?&])(?:nativeChrome|native)=(1|true)(?:&|$)/.test(q)||/\\bStratji\\//i.test(ua);if(native){document.documentElement.classList.add("native-chrome-embed");document.documentElement.dataset.nativeChrome="1";}}catch(e){}})();`;
```

```135:147:apple-app/Shared/StratjiDocumentBrowser.swift
            document.documentElement.classList.add('native-chrome-embed');
            document.documentElement.dataset.nativeChrome = '1';
            document.documentElement.dataset.nativeOwnsSections = '1';
```

iOS `DashboardBrowser.swift:134-139` sets `native-chrome-embed` only — correctly keeps the web cluster. `page.tsx:797` always mounts `<DashboardTabs>` under nativeChrome (`showWorkspaceShell && <DashboardTabs`, not `&& !nativeChrome`). Tests **require** that (`tests/rendered-html.test.mjs:643-644`, `:701-703` hide-selector loop must match `masthead` and must **not** mention `workspace-navigation`).

**Remedy:** In `nativeChromeFoucScript`, if `/\bStratji\//.test(ua) && /Macintosh/.test(ua)`, set `dataset.nativeOwnsSections="1"`. Keep iOS and localhost browsers on the web droplet. Add a unit assertion on the FOUC source (Macintosh vs iPhone). Behavior preserved: no for stale Dock (desired hide). Effort: DO NOW.

Do **not** copy Dock → treat as current. Copy or launch `apple-app/build/Stratji.app` until FOUC lands; even then, the 20 Aug overlay may still lack the combined section droplet — process still matters.

---

### [P2] Hover preview paints a foreign workspace over the live board · `apple-app/Stratji/StratjiWorkspaceGlassBar.swift:36` · CONFIRMED

**What:** `pillWorkspace` is `hoveredWorkspace ?? session.workspace`. Hovering Sectors expands Sectors section titles while `session.workspace` and WKWebView stay on Investment (`?view=investment&section=i1`). Selected section highlight requires `destination.view == session.workspace.rawValue`, so the Sectors droplet has **no** selected chip. The Investment I-1 `CollapsibleSection` remains the canvas.

**Why it matters:** This is a **current-source** reproduction of “Sectors + I-1 + Investment board” **without** the stale Dock binary. Web `DashboardTabs` (`shared-ui.tsx:371-377`) does the same hover-index trick; on localhost the droplet is in-flow. On Mac the overlay sits on the canvas, so the lie is louder.

**Evidence:**

```36:42:apple-app/Stratji/StratjiWorkspaceGlassBar.swift
    private var pillWorkspace: StratjiWorkspace {
        hoveredWorkspace ?? session.workspace
    }
    private var sectionDestinations: [DashboardDestination] {
        DashboardOutline.sectionDestinations(forView: pillWorkspace.rawValue)
    }
```

```417:421:apple-app/Stratji/StratjiWorkspaceGlassBar.swift
    private func setHover(_ workspace: StratjiWorkspace, hovering: Bool) {
        guard hovering else { return }
        animateDroplet {
            hoveredWorkspace = workspace
        }
    }
```

**Remedy:** Preview only the **selected** workspace’s sections; use hover for a scale/tint on the workspace label, not a foreign droplet. Or, while hovering another workspace, dim/hide the board (behavior change — justify separately). Behavior preserved if preview is limited to the selected pill: **yes** for clicks; hover animation changes. Effort: DO IN THIS PR IF FEASIBLE. Label: behavior-preserving if the droplet no longer follows hover.

---

### [P2] Section catalog exists twice and will drift · `apple-app/Outline/DashboardOutline.swift:326` · `app/dashboard/workspace-routing.ts:274` · CONFIRMED

**What:** Native droplet titles come from `DashboardOutline` children. Web compact chips come from `WORKSPACE_SECTIONS`. Workspace abbreviated labels are duplicated again (`StratjiWorkspace.barLabel` vs `app/dashboard/utils.ts` `workspaces[].barLabel`). Today they match (Action Board / Industry Analytics / Satya / …). Nothing compiles them together.

**Why it matters:** The next renamed chip (already happened: M-2 Satya, H-4 Calendar + Reminders, no M-4) will ship on one surface. `tests/workspace-routing.test.mjs:49-57` pins the TS side only. Native titles are grepped in `native-sidebar-click.test.mjs` as scattered strings, not as a zip against `WORKSPACE_SECTIONS`.

**Remedy:** One table (JSON or generated Swift from the TS const, or a test that zips `sectionDestinations` titles to `WORKSPACE_SECTIONS[].label`). Do not add a runtime bridge. Behavior preserved: yes. Effort: FOLLOW-UP if FOUC is this PR; otherwise DO IN THIS PR IF FEASIBLE.

---

### [P2] `app/page.tsx` is one chrome mount away from the 1000-line tripwire · `app/page.tsx` 503 → **938** · CONFIRMED

**What:** Trunk `page.tsx` was 503 lines. Working tree is 938. Chrome (`DashboardTabs`, nativeChrome class, stayMounted workspaces) lives here with Kite/content/health refresh orchestration.

**Why it matters:** The 1000-line rule is presumptive blocker **when crossed**. This PR should not be the one that crosses it. `DashboardTabs` already moved to `shared-ui.tsx` (right call). The remaining chrome is a few branches; the bulk is snapshot merge.

**Remedy:** Keep chrome diffs out of `page.tsx` (tabs already extracted). Next workspace-mount change should not add another 80 lines here. Behavior preserved: yes. Effort: FOLLOW-UP (do not split in this chrome audit).

---

### [P2] Native chrome tests freeze the dual-chrome hedge and do not see Dock vs build · `tests/rendered-html.test.mjs:614` · CONFIRMED

**What:** Test name says “nativeChrome hides web masthead **and workspace tabs**.” Asserts require `DashboardTabs` still rendered under nativeChrome, CSS `display:flex !important` on `.workspace-navigation.mode-dial`, and hide-selectors limited to `masthead`. `native-sidebar-click.test.mjs:33` greps `dataset.nativeOwnsSections = '1'` in Swift source — it cannot fail when the operator runs a binary that does not contain that string.

**Why it matters:** CI stays green on the screenshot incident. Source-grep of the inject is not a launch-path test.

**Remedy:** Rename the test. Assert FOUC Macintosh+Stratji sets owns-sections (after P1). Optional: a comment/check in `apple-app/README.md` that Dock/`~/Applications` mtimes must be ≥ `apple-app/build`. Do not add a test that launches Stratji.app. Effort: DO NOW with P1.

---

### [P3] Liquid glass and material fallback are copy-pasted droplet UIs · `apple-app/Stratji/StratjiWorkspaceGlassBar.swift:70` vs `:232` · CONFIRMED

**What:** `combinedGlassCapsule` / `dropletCell` / `sectionButton` / `workspaceButton` are repeated as `materialFallbackBar` / `fallbackDropletCell` / `fallbackSectionButton` / `fallbackButton` (~160 lines). Label foreground helpers are already duplicated (`labelForeground` vs `fallbackLabelForeground` — identical).

**Why it matters:** macOS 26 `#available` is real; the duplication is not. The next section-hit-target or a11y identifier fix will land in one path.

**Remedy:** Share the HStack/ForEach/button tree; swap only `.glassEffect` vs `.ultraThinMaterial`. Behavior preserved: yes. Effort: FOLLOW-UP.

---

### [P3] AGENTS nav label “Algorithm Canvas” vs barLabel “Canvas” · `apple-app/Shared/StratjiWorkspace.swift:34` · `app/dashboard/utils.ts:588` · CONFIRMED (both surfaces agree; AGENTS disagrees)

**What:** Visible glass label is `Canvas`. Accessibility on web uses `workspace.label` “Algorithm Canvas”. Native `help`/`accessibilityLabel` uses `title` “Algorithm Builder”. AGENTS.md: “Nav label is Algorithm Canvas; chrome title inside the workspace is Algorithm Builder.”

**Why it matters:** Not a localhost-vs-Mac drift. It is a three-way name split (Canvas / Algorithm Canvas / Algorithm Builder) that the next screenshot review will call a bug.

**Remedy:** Pick one visible bar label and one a11y name; align AGENTS. Behavior change: copy only. Effort: FOLLOW-UP.

---

## Pass A — CODE-REVIEW (clean statements)

- **Flask kill:** `FlaskServiceSupervisor.kickoffAtLaunch` returns if `/_flask/health` is reachable (`:53-56`). Live gateway writes the LaunchAgent plist and **does not** bootout (`adoptLiveGatewayWithoutRecycle`, `:277-281`). Tests forbid `stop-flask-app.sh` / Terminal `open`. Fallback `recycleLaunchAgent` is after 180+180s of a **down** health check; `start-flask-app.sh` nohup is the documented reason bootout should not kill a bound `:5050`. I did not start or stop Flask.
- **Intel → S-1:** `parseWorkspaceSection("intelligence", "s1")` returns `"m1"` (`workspace-routing.ts:366-367`, test `tests/workspace-routing.test.mjs:12-18`). `selectWorkspace` drops leftover section when `view` changes (`page.tsx:591`). Native `session.select` loads `workspace.defaultDestination` (`StratjiWorkspaceGlassBar.swift:176-179`). `rendered-html` asserts intelligence native HTML has no `S-1 Sectoral action board` (`:766-769`).
- **Exclusive sections:** `nativeChromeHidesSection` (`shared-ui.tsx:512-514`) hides sibling section nodes whenever URL `section` is set — localhost and Mac. Investment I-1 board with I-2/I-3 hidden is intended, not a native-only bug. The name is misleading; the behavior is the combined-droplet contract.
- **Hydrate:** splash `runCompleteRefresh`; post-hydrate `refreshAll(false, { silent: true })` (`page.tsx:764-767`). `waitForDocumentReady` force-loads then waits `isLoading` ≤ 25s. No second complete refresh on `applicationDidBecomeActive` (`AppDelegate.swift:111-115` incremental only).
- **Security:** `nativeChrome` / owns-sections are CSS. No new authz. iOS and Mac share `Stratji/1` UA; that is why owns-sections must not be “any Stratji UA.”

## Pass B — CODE-QUALITY

Hide-switch scatter is the judo (P1). Hover-as-workspace is a special case in a bar whose job is “show the selected workspace’s sections” (P2). Duplicate Swift/TS catalogs (P2). Liquid/fallback copy-paste (P3). `DashboardTabs` extraction into `shared-ui.tsx` is the right direction; `page.tsx` still always mounts it so CSS can hide it — extra concept until FOUC owns the flag.

## Pass C — CODE LAYOUT

Chrome lives where a stranger would look: Swift overlay in `StratjiWorkspaceGlassBar.swift`, destinations in `DashboardOutline.swift`, web cluster in `shared-ui.tsx`, routing in `workspace-routing.ts`, embed CSS in `native-chrome.css`, launch in `FlaskServiceSupervisor.swift`. After this dirty tree, the repo is **slightly harder** to navigate because the hide rule is not in any one of those files — it is the **intersection** of FOUC + CSS default + a Mac-only WK inject. `tests/rendered-html.test.mjs` at 2244 lines remains a layout boulder (pre-existing; this surface added nav asserts, not the boulder).

No new import cycle. `WorkspaceSectionNav` remains exported and used by `DashboardTabs` compact chips; in-page workspace files correctly do not mount a second nav (`rendered-html` `doesNotMatch /<WorkspaceSectionNav/` on those files).

## 📐 Metrics

| File | Before (trunk) | After (worktree) | Δ | Flag |
|---|---|---|---|---|
| `app/page.tsx` | 503 | 938 | +435 | yellow, approaching 1k |
| `app/dashboard/shared-ui.tsx` | 258 | 656 | +398 | yellow |
| `app/dashboard/workspace-routing.ts` | 0 | 521 | +521 | yellow |
| `app/native-chrome.css` | 0 | 168 | +168 | |
| `apple-app/Stratji/StratjiWorkspaceGlassBar.swift` | 0 | 430 | +430 | yellow; liquid/fallback dup |
| `apple-app/Stratji/FlaskServiceSupervisor.swift` | 0 | 535 | +535 | yellow |
| `apple-app/Stratji/StratjiDashboardViewController.swift` | 0 | 266 | +266 | overlay+webview split is tight |
| `apple-app/Outline/DashboardOutline.swift` | 0 | 587 | +587 | yellow; catalog |
| `tests/rendered-html.test.mjs` | 718 | 2244 | +1526 | test file; waived 1k |
| `tests/native-launch-refresh.test.mjs` | 0 | 451 | +451 | source-grep |

## 🗺 Layout verdict

The map still tells the truth: Mac overlay vs web fallback vs shared outline. The **territory** of “who paints the droplet” is split across four files and a Dock binary the repo does not control. Until FOUC (or an equivalent first-paint rule) owns Mac hide, navigating the chrome requires knowing which Stratji.app the operator double-clicked.

## ✅ What's good here

- Combined droplet titles are full names (`Action Board`, `Industry Analytics`, `Satya`) on both `WORKSPACE_SECTIONS` and `DashboardOutline` children — compact web chips do **not** render `I-1` prefixes (`shared-ui.tsx:101` `compact ? section.label`).
- Live Flask is not recycled on launch (`adoptLiveGatewayWithoutRecycle` / `kickoffAtLaunch` skip). Overlay is pass-through around the cluster (`StratjiPassThroughOverlay.hitTest`). WKWebView stays full-height; padding, not a second host, clears the overlap.
- Intel leftover `section=s1` cannot become S-1 (`parseWorkspaceSection` + `selectWorkspace` drop + tests).

## ❓ Open questions for the author

1. After FOUC Macintosh+owns-sections, should the 20 Aug Dock overlay (possibly workspace-only, no section droplet) still be considered unsupported, i.e. must the operator launch `apple-app/build/Stratji.app` anyway for section chips?
2. Is hover-preview of a **foreign** workspace a product requirement, or was it copied from the web cluster without noticing the overlay lie?

## 📋 Follow-up tickets suggested

- FOUC Macintosh + `Stratji/` sets `data-native-owns-sections=1` (this P1).
- Zip-test `DashboardOutline.sectionDestinations` titles against `WORKSPACE_SECTIONS`.
- Document in `apple-app/README.md`: Dock/`~/Applications` are not current if `apple-app/build/Stratji.app` is newer; do not kill `:5050`.
- Collapse glass-bar liquid/fallback duplication.

## Dock binary vs source — one-line ruling

**Process:** Dock and `~/Applications` (20 Aug 12:44) are not the 21 Aug 01:01 Release; launching them is the incident trigger.  
**Code:** current CSS/FOUC make that trigger sufficient. Not a routing defect, not a Flask defect, not “localhost is wrong.”
