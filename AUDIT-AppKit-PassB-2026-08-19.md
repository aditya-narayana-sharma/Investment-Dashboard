# 🔍 AUDIT — AppKit Pass B (code-quality only)

**Scope:** DIFF · base `c0a85491` (origin/main) → head `0296f52` · ~420 files, +71362/−3848  
**Coverage:** audited in full: glass overlay, refresh modes, hover-pop CSS, native-chrome CSS, `LlmAssistPanel.tsx`, `StratjiSessionModel.swift`, `StratjiDashboardViewController.swift`, `FlaskServiceSupervisor.swift`, `StratjiWorkspaceGlassBar.swift`, `refresh-dashboard-data.sh`. Partial: `IntelligenceWorkspace.tsx`, `InvestmentWorkspace.tsx`, `page.tsx`, `StratjiSettingsWindow.swift`, `globals.css` / `visual-overhaul.css` native-chrome + hover regions. Not deep-read: remaining ~380 files, `algorithm-builder.css`, `content-digest-server.mjs`, `tests/rendered-html.test.mjs`.  
**Assumptions:** dirty tree at conversation start was already committed as `0296f52`. Pass A defects and Pass C layout (except 1k-line sizes) are out of scope.

No merge verdict (Pass B only).

---

## 🥋 Code-judo assessment

**JUDO AVAILABLE** — invert hover-pop from “scale everything, then freeze a denylist” to a single opt-in class; collapse native chrome to one HTML class and one stylesheet; delete `PORTFOLIO_SKIP_HEALTH_ZIP` so refresh is only `complete | incremental`.

- Concepts today: hover allowlist + denylist + table-row `display:grid` workaround; 3 native-chrome signals × 2 CSS files; 3 Health ingest modes; `incremental: Bool` on a 836-line session god-object.
- Proposed: `.vo-pop` only; `html.native-chrome-embed` only; `PORTFOLIO_REFRESH_MODE`; `RefreshKind` + extracted splash interpolator.
- Behavior preserved: yes · Effort: DO IN THIS PR IF FEASIBLE for hover-pop + skip-flag deletion; FOLLOW-UP for 1k-line workspace/CSS splits · Risk: low–med (CSS last-wins is the regression surface).

---

## 🧨 Presumptive blockers (1k-line rule)

These files crossed 1000 lines, or went further past 1000, on this branch. Waiver does not hold: they are not cohesive declarative tables.

| File | Before | After | Δ | Flag |
|---|---|---|---|---|
| `app/globals.css` | 1065 | 4375 | +3310 | **FURTHER PAST 1K** |
| `app/visual-overhaul.css` | 0 | 2444 | +2444 | **CROSSED 1K** (new) |
| `app/dashboard/IntelligenceWorkspace.tsx` | 700 | 1180 | +480 | **CROSSED 1K** |
| `app/dashboard/InvestmentWorkspace.tsx` | 482 | 1103 | +621 | **CROSSED 1K** |
| `app/dashboard/builder/algorithm-builder.css` | 0 | 1669 | +1669 | **CROSSED 1K** (new; sampled) |
| `tests/rendered-html.test.mjs` | 718 | 1984 | +1266 | **CROSSED 1K** |
| `scripts/content-digest-server.mjs` | 1298 | 1842 | +544 | FURTHER PAST 1K (pre-existing over 1k) |

Named files that did **not** cross 1k (still size pressure):

| File | Before | After | Δ | Flag |
|---|---|---|---|---|
| `app/page.tsx` | 503 | 957 | +454 | approaching 1k |
| `apple-app/Shared/StratjiSessionModel.swift` | 0 | 836 | +836 | approaching 1k |
| `apple-app/Stratji/StratjiSettingsWindow.swift` | 0 | 674 | +674 | yellow |
| `app/dashboard/LlmAssistPanel.tsx` | 0 | 516 | +516 | yellow; +428 in `0296f52` |
| `apple-app/Stratji/StratjiDashboardViewController.swift` | 0 | 404 | +404 | green/yellow |
| `apple-app/Stratji/StratjiWorkspaceGlassBar.swift` | 0 | 258 | +258 | green |

---

## Findings

### [P1] Hover-pop is an opt-in class plus a second allowlist plus a denylist plus a WKWebView table-row special case · `app/visual-overhaul.css:234` · CONFIRMED

**What:** Interaction language is defined three times, then undone a fourth time for tables.

**Why it matters:** The next “don’t pop this panel” bug will add another `:hover { transform: none }` selector. Readers cannot know whether a row pops without scanning ~250 lines of last-wins CSS. Future WKWebView transform bugs will keep mutating table display instead of the hover contract.

**Evidence:**

Canonical opt-in (plus a selector dump that is not `.vo-pop`):

```234:278:app/visual-overhaul.css
.vo-pop,
.workspace-tabs button,
.workspace-section-nav button,
/* … segmented, pills, kanban, axis-pick … */
.vo-pop:hover,
.vo-pop:focus-visible,
.workspace-tabs button:hover,
/* … */
{
  transform: translateY(-2px) scale(1.02);
}
```

Re-applied later, then frozen on whole panels:

```2123:2193:app/visual-overhaul.css
.vo-pop:hover,
/* … section-nav, kanban-card, strategy-card … */
{
  transform: translateY(-2px) scale(1.02);
}
.panel:hover,
.masthead:hover,
.kanban-lane:hover,
.analyst-matrix:hover,
/* … ~40 more freeze selectors … */
{
  transform: none;
}
```

Table-row scale, then isolate with `display: grid`:

```2238:2314:app/visual-overhaul.css
/* WKWebView promotes transform on display:table-row to the whole table */
.panel.analyst-matrix:hover,
.analyst-matrix .analyst-table thead tr:hover,
/* … */
{ transform: none !important; }
@media (min-width: 621px) {
  .analyst-matrix .analyst-table tbody tr {
    display: grid;
    /* 8-column template copied from the table */
  }
}
```

**Judo (tier A):** One class. Put `class="vo-pop"` on industry cards, industry rows, ticker rows, kanban cards, Axis pick rows, and small controls. Delete the second allowlist, the denylist, and the table-row grid. If a ticker must pop in WKWebView, render the matrix as a CSS grid list (`role="table"` if needed) — the mobile path already leaves table layout at `globals.css:767`.

```css
.vo-pop { transition: transform var(--vo-motion) var(--vo-ease), box-shadow var(--vo-motion) var(--vo-ease); }
.vo-pop:hover, .vo-pop:focus-visible { transform: translateY(-2px) scale(1.02); }
```

Behavior preserved: yes · Effort: DO IN THIS PR IF FEASIBLE

---

### [P1] Native chrome is three HTML signals × two stylesheets fighting overlay vs padding · `app/globals.css:193` · CONFIRMED

**What:** Stratji embed is encoded as `html.native-chrome-embed`, `html[data-native-chrome]`, and `.dashboard-app.native-chrome`, then restated in `visual-overhaul.css` as last-wins so the overlay does not zero `--section-nav-clearance`.

**Why it matters:** Overlay auto-hide (native) and section-nav clearance (web) became a CSS load-order conversation. A future globals.css tweak that zeros native-chrome margins will silently re-eat I-1 headings. Every new native-chrome rule is copy-pasted six times.

**Evidence:** Triple selectors in globals:

```193:214:app/globals.css
html.native-chrome-embed,
html[data-native-chrome],
html.native-chrome-embed body,
html[data-native-chrome] body { … }
html.native-chrome-embed .masthead,
html[data-native-chrome] .masthead,
.dashboard-app.native-chrome>.masthead { display:none!important; }
```

Same gap rules again at `globals.css:4366` and `visual-overhaul.css:2386` / `2435` with the comment “must not zero this gap — glass bar is an overlay, not a host.”

page.tsx writes all three:

```724:790:app/page.tsx
document.documentElement.classList.toggle("native-chrome-embed", nativeChrome);
if (nativeChrome) document.documentElement.dataset.nativeChrome = "1";
// …
<main className={`dashboard-app${nativeChrome ? " native-chrome" : ""}`} data-native-chrome={nativeChrome ? "1" : undefined}>
```

layout.tsx FOUC writes class + data (`app/layout.tsx:48`). `isNativeChromeDocument` still ORs class and data (`app/dashboard/workspace-routing.ts:29`).

**Judo (tier S):** One signal: `html.native-chrome-embed`. One file: `app/native-chrome.css` (or a single section at the end of visual-overhaul). FOUC script adds the class; page.tsx only toggles that class. Overlay geometry stays in AppKit (`StratjiDashboardViewController` already pins `webHost.top` to `safeArea`, not `glass.bottom` at `StratjiDashboardViewController.swift:120`). CSS never reserves overlay height.

Behavior preserved: yes · Effort: DO IN THIS PR IF FEASIBLE

---

### [P1] `PORTFOLIO_SKIP_HEALTH_ZIP` is a third ingest mode that splash must never use · `scripts/refresh-dashboard-data.sh:165` · CONFIRMED

**What:** Health ingest has three branches: skip env, incremental `--if-changed`, complete extract. Native splash’s contract is “never set the skip flag”; the supervisor deletes it on every run.

**Why it matters:** A boolean env leftover from a hot path now exists only as a landmine. Incremental already means “don’t re-extract unless mtime changed.” Anyone exporting `PORTFOLIO_SKIP_HEALTH_ZIP=1` in the parent environment (IDE, launchd leftover) still skips ZIP on a complete splash — the supervisor removes it from the *child* env, but the script still documents a mode Stratji.app is forbidden to set.

**Evidence:**

```164:173:scripts/refresh-dashboard-data.sh
if [[ "${PORTFOLIO_SKIP_HEALTH_ZIP:-0}" == "1" ]]; then
  printf 'Health ZIP\tskipped\tPORTFOLIO_SKIP_HEALTH_ZIP=1 …\n'
elif [[ "$REFRESH_MODE" == "incremental" ]]; then
  "$HEALTH_SCRIPT" --if-changed || true
else
  "$HEALTH_SCRIPT" || true
fi
```

```79:117:apple-app/Stratji/FlaskServiceSupervisor.swift
/// Splash / Reload All: … Never sets `PORTFOLIO_SKIP_HEALTH_ZIP`.
environment["PORTFOLIO_REFRESH_MODE"] = mode
environment.removeValue(forKey: "PORTFOLIO_SKIP_HEALTH_ZIP")
```

`runAudit(..., incremental: Bool)` then picks complete vs incremental (`StratjiSessionModel.swift:266`).

**Judo (tier S):** Delete `PORTFOLIO_SKIP_HEALTH_ZIP`. Two modes: `PORTFOLIO_REFRESH_MODE=complete|incremental`. Replace the Swift `incremental: Bool` with `enum RefreshKind { case complete, incremental }`. Tests that assert the skip flag is never set to `"1"` become “script has no SKIP_HEALTH_ZIP branch.”

```swift
enum RefreshKind { case complete, incremental }
await runAudit(kind: .complete)  // splash / Reload All
await runAudit(kind: .incremental) // ticks / focus
```

Behavior preserved: yes (skip path has no Stratji caller) · Effort: DO NOW

---

### [P1] `InvestmentWorkspace` and `IntelligenceWorkspace` crossed 1k by absorbing whole product slices · CONFIRMED

**What:** this pushes `InvestmentWorkspace.tsx` from 482 to 1103 and `IntelligenceWorkspace.tsx` from 700 to 1180. Decompose first.

**Why it matters:** Both files now mix shell (section nav + Kanban) with domain UI (treemap, Axis workbench, digest groups, earnings calendar). The next I-3 or M-2 change edits a 1100-line file.

**Evidence:** `InvestmentWorkspace.tsx` holds `layoutPortfolioMap` (`:53`), `RiskRadar` (`:180`), `MacroScenarioBoard` (`:337`), `AxisRecommendationWorkbench` (`:470`) before `export function InvestmentWorkspace` at `:648`. `IntelligenceWorkspace.tsx` holds digest grouping through `SectorIntelligenceDigest` (`:650`–~994) before the M-1–M-4 shell at `:1083`.

**Judo (tier B):**

Investment:

- `app/dashboard/investment/portfolio-map.ts` — `layoutPortfolioMap` + tooltip
- `app/dashboard/investment/AxisRecommendationWorkbench.tsx`
- `app/dashboard/investment/MacroScenarioBoard.tsx`
- `app/dashboard/investment/RiskRadar.tsx`
- `InvestmentWorkspace.tsx` remains I-1–I-4 chrome + composition (~250 lines)

Intelligence:

- `app/dashboard/intelligence/SectorIntelligenceDigest.tsx` (already a named export)
- `app/dashboard/intelligence/MarketEarningsCalendar.tsx`
- `IntelligenceWorkspace.tsx` remains M-1–M-4 chrome (~120 lines)

Check for cycles: these currently import from `./shared-ui` and `./utils` only; split does not create a cycle.

Behavior preserved: yes · Effort: DO IN THIS PR IF FEASIBLE

---

### [P1] `globals.css` 1065→4375 and `visual-overhaul.css` 0→2444 — motion, tokens, and native chrome share one dump · CONFIRMED

**What:** this pushes `globals.css` further past 1k (+3310) and lands `visual-overhaul.css` at 2444 with no module boundary.

**Why it matters:** Native-chrome last-wins (`visual-overhaul.css:2386`) exists because both files own sticky nav. Hover-pop last-wins exists because both files own `.panel`. Token changes (`--font-size-body: 15px` in visual-overhaul `:root`) fight globals. A reader cannot find “WKWebView table-row” without knowing the 0296f52 commit message.

**Judo (tier B):** Split by job, not by “overhaul”:

- `app/tokens.css` — `:root` type/radius/gap (one source for the 15/13/14/13 contract)
- `app/native-chrome.css` — embed hide-list + overlay-not-host clearance
- `app/interaction.css` — `.vo-pop` only
- Keep `visual-overhaul.css` for named instruments (orbital planet, gravity well, briefing rail)
- Keep `globals.css` for layout shells, under 1000 if tokens/interaction/native move out (~1500–2000 remaining is still too large; next cut is sector/investment blocks)

Behavior preserved: yes · Effort: FOLLOW-UP (file: “Split dashboard CSS by tokens / native-chrome / interaction”)

---

### [P2] `LlmAssistPanel` dock overlay adds geometry, observers, and a portal instead of CSS · `app/dashboard/LlmAssistPanel.tsx:300` · CONFIRMED

**What:** Full-width overlay is implemented by walking every ancestor with `MutationObserver`, measuring `#dashboard-workspace-panel`, and portaling a `position:fixed` box. `defaultSuggestions` is ~175 lines of prompt tables in the same file.

**Why it matters:** Dock vs collapsed is a boolean that changes layout math (`open ? top : bottom` at `:386`). Invisible anchors (`aria-hidden` at `:494`) plus overlay on `document.body` mean two DOM homes per instance. Six workspaces each mount a panel.

**Judo (tier B):** Extract `defaultSuggestions` to `llm-assist-suggestions.ts`. Dock with CSS: `position: sticky; bottom: 0; width: 100%` inside the workspace panel (or a single portal host owned by `page.tsx`). Drop ancestor MutationObserver; visibility follows the workspace `hidden` attribute already used by `nativeChromeHidesSection`.

Behavior preserved: yes for CSS sticky; portal-on-body was compensating for overflow clipping — if a workspace `overflow:auto` clips sticky, put the dock as a sibling of `.workspace-panel`, not inside the scrolling section. Effort: DO IN THIS PR IF FEASIBLE

---

### [P2] Glass overlay auto-hide is four booleans and two pointer pipelines · `apple-app/Stratji/StratjiDashboardViewController.swift:20` · CONFIRMED

**What:** Reveal state is `isGlassRevealed`, `isPointerInRevealStrip`, `isPointerInsideGlassBar`, `isInteractingWithGlass`, plus a local `NSEvent` monitor *and* `StratjiDashboardRootView` tracking areas, plus SwiftUI `onHover` that only sets `isPointerInsideGlassBar = true` (never false) at `:104`.

**Why it matters:** Hide-after-0.8s is a tiny state machine encoded as flags. `onPointerInsideChange` cannot clear “inside bar,” so leave-bar depends on the AppKit hit test. Dual tracking is how this class grew to 404 lines for one overlay.

**Evidence:** `updateGlassReveal` at `:312`; `handlePointerLocation` at `:293`; `installMouseMonitorIfNeeded` at `:267`; root tracking at `:379`. Overlay does not inset WKWebView (`webHostView.top` = `safeArea` at `:123`) — that part is already the right model.

**Judo (tier B):**

```swift
enum GlassChrome { case hidden, shown, interacting }
```

One pointer source (tracking area on the 14pt strip + overlay). SwiftUI `onHover` becomes the only inside-bar signal, including `false`. Delete the local mouse monitor or the root tracking — not both.

`StratjiWorkspaceGlassBar` `workspaceButton` / `fallbackButton` (`:112` / `:163`) are near-duplicates; one button + glass vs material background is enough.

Behavior preserved: yes · Effort: DO IN THIS PR IF FEASIBLE

---

### [P2] `StratjiSessionModel` is splash interpolator + Kite login + refresh orchestration · `apple-app/Shared/StratjiSessionModel.swift:196` · CONFIRMED

**What:** `runAudit` takes `incremental: Bool`, which changes timeout, Health ZIP behavior, and captions. Same file owns progress interpolation (`:568`), Kite continuation (`:365`), and source evaluation (`:491`). 836 lines, new file, approaching the 1k tripwire.

**Why it matters:** The next splash copy tweak will touch the same function that decides whether Health ZIP runs. `incremental` is a boolean that changes what the function *does* (4B.3).

**Judo (tier A):** `RefreshKind` as above. Move `tickSplashProgress` / `SplashProgressInterpolator` to `StratjiSplashProgress.swift`. Move Kite prompt/open/finish to `StratjiKiteAuth` (already a type at `StratjiKiteAuth.swift`). Session keeps bootstrap/reload/tick.

`FlaskServiceSupervisor.runRefreshScript` duplicates the wait-until-deadline loop (`:143` and `:165`) — extract `await wait(process:until:onTick:)`.

Behavior preserved: yes · Effort: FOLLOW-UP for the split; DO NOW for `RefreshKind` + wait-loop collapse

---

### [P2] `nativeChromeHidesSection` is not a native-chrome special case · `app/dashboard/shared-ui.tsx:433` · CONFIRMED

**What:** `nativeChromeHidesSection(activeId, sectionId)` returns `activeId != null && activeId !== sectionId`. Used as the `hidden` predicate on every workspace section (`IntelligenceWorkspace.tsx:1130`).

**Why it matters:** The name teaches that section hiding is an embed quirk. It is the shared focus-section mechanism. Native chrome already hides masthead + workspace dial in CSS; this helper is unrelated. Feature logic leaking into a name that will attract more `if (nativeChrome)` branches.

**Judo (tier C):** Rename to `sectionIsInactive` / `hidesInactiveSection`. Do not pass native chrome into it.

Behavior preserved: yes · Effort: DO NOW

---

### [P3] Settings freshness chips are already the simple model · `apple-app/Stratji/StratjiSettingsWindow.swift:125` · CONFIRMED

**What:** `freshnessSection` binds `session.liveFeedSources` through `StratjiFreshnessChipStrip` + private `StratjiFlowLayout`.

**Why it matters:** This is the right shape (one payload, wrap in-window). File is 674 lines because Settings is a kitchen sink, not because freshness was over-abstracted. Do not extract FlowLayout unless a second wrap strip appears.

**Judo:** **ALREADY MINIMAL** for freshness. Considered a shared SwiftUI chip in `StratjiNativeViews` — worse, because Settings is the only native consumer. File-size split of Settings sections is FOLLOW-UP, not this PR.

---

### [P3] `StratjiAppearanceStore` is already the simple model · `apple-app/Shared/StratjiAppearanceStore.swift:49` · CONFIRMED

**What:** One store, inject `data-appearance` at WKUserScript document-start and on Settings change.

**Judo:** **ALREADY MINIMAL**. Considered syncing via `page.tsx` localStorage only — that is what left Black as leftover sepia. Keep the store.

---

## Spaghetti list (new special cases)

| Special case | Where | What it branches on | Judo |
|---|---|---|---|
| Overlay auto-hide vs reserved glass gap | `StratjiDashboardViewController.swift:120`, `globals.css:200`, `visual-overhaul.css:2388` | Native glass is overlay; CSS must not pad/zero `--section-nav-clearance` | One embed class; CSS never knows about glass height |
| Triple native-chrome selectors | `globals.css:193`, `page.tsx:724`, `layout.tsx:48` | class OR data-attr OR `.dashboard-app.native-chrome` | `html.native-chrome-embed` only |
| `nativeChromeHidesSection` | `shared-ui.tsx:433` | Named native; implements generic section focus | Rename |
| `PORTFOLIO_SKIP_HEALTH_ZIP` vs complete vs incremental | `refresh-dashboard-data.sh:165`, `FlaskServiceSupervisor.swift:117`, `StratjiSessionModel.swift:266` | Three ingest modes; splash forbidden to use skip | Delete skip; `RefreshKind` |
| Hover-pop allowlist | `visual-overhaul.css:234`, `:2123` | `.vo-pop` plus dumped selectors | `.vo-pop` only |
| Hover-pop denylist | `visual-overhaul.css:2143` | Freeze panels/headers/lanes | Delete if pop is opt-in |
| WKWebView `display:grid` on `tr` | `visual-overhaul.css:2281` | `display:table-row` + transform lifts whole table | Grid list, not table-row |
| Analyst matrix freeze list | `visual-overhaul.css:2241` | Hover on thead/tbody/group-header | Goes away with opt-in pop |
| LLM dock open vs collapsed geometry | `LlmAssistPanel.tsx:386` | `open` switches `top` vs `bottom` | CSS sticky sibling |
| Liquid vs material glass buttons | `StratjiWorkspaceGlassBar.swift:112` vs `:163` | macOS 26 availability | One button + background |
| Refresh wait-loop duplication | `FlaskServiceSupervisor.swift:143` vs `:165` | FileHandle vs no handle | One `wait(process:)` |
| `incremental: Bool` on `runAudit` | `StratjiSessionModel.swift:196` | Boolean mode | `RefreshKind` |

---

## Per-change judo (non-trivial)

| Change | Verdict | Why |
|---|---|---|
| Glass overlay auto-hide | JUDO AVAILABLE | Collapse 4 flags + dual pointer paths |
| Native-chrome CSS hide-list | JUDO AVAILABLE | One class, one file |
| Complete vs incremental refresh | JUDO AVAILABLE | Delete skip env; enum not Bool |
| Hover-pop allow/deny + table grid | JUDO AVAILABLE | Opt-in class; don’t fight `table-row` |
| LLM full-width dock | JUDO AVAILABLE | Suggestions file + CSS dock |
| Intelligence/Investment 1k cross | JUDO AVAILABLE | Extract digest / map / Axis / macro |
| globals + visual-overhaul growth | JUDO AVAILABLE | tokens / native-chrome / interaction |
| Settings live-feed chips | ALREADY MINIMAL | Bound to refresh payload; wrap layout is local |
| Appearance store inject | ALREADY MINIMAL | Document-start is the correct seam |
| Sector catalog 13 industries | ALREADY MINIMAL (sampled) | One catalog is the judo vs picker-only/matrix-only split called out in `0296f52` |

---

## 📐 Metrics (1k tripwire)

See tables above. Waivers: none for source CSS/TS/Swift. `tests/rendered-html.test.mjs` 718→1984 is a test table dump — still over 1k; split by workspace if it keeps growing. Binary/PNG “line counts” ignored.

---

## ✅ What's good here

- Overlay glass (not `webHost.top = glass.bottom`) is the correct layout model; the CSS fight is the leftover.
- Incremental vs complete as `PORTFOLIO_REFRESH_MODE` is the right axis; skip-ZIP is the leftover.
- `.vo-pop` as a named interaction is the right abstraction — it just isn’t the only path.
- Settings freshness chips read the live refresh payload instead of a hardcoded source list.
- `0296f52` commit message states the hover-pop and Health ZIP contracts in English; the code still implements them as denylists and forbidden flags.

---

## ❓ Open questions

- Is `PORTFOLIO_SKIP_HEALTH_ZIP` still set by any LaunchAgent or human shell profile outside this repo? If yes, deleting the branch is a behavior change for that profile.
- Does any WKWebView-only transform still apply to non-`.vo-pop` rows after the denylist is deleted? (Falsify by removing denylist in a worktree and hovering I-3.)

---

## 📋 Follow-up tickets suggested

- Split `globals.css` / `visual-overhaul.css` into tokens, native-chrome, interaction.
- Extract Intelligence digest + Investment map/Axis/macro/risk modules.
- Extract `StratjiSplashProgress` from `StratjiSessionModel`.
- Split `tests/rendered-html.test.mjs` by workspace once it next grows.
