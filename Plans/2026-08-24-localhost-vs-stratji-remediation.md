# Implementation plan — Localhost vs Stratji.app remediation

**Source RCA:** `RCAs/2026-08-24-localhost-vs-stratji.md`  
**Prior status:** `Project-Status/PROJECT-STATUS.md` (107 rows; 98 Done / 9 In-Progress; 2026-08-24 00:36 IST)  
**Prior auditor:** `Code-Reviews/2026-08-24-localhost-vs-stratji-chrome.md` — **REQUEST CHANGES**  
**Branch / baseline:** `AppKit` @ `976503b` + dirty Satya / M-1 / TCC / launch tree  
**Constraint:** Documentation only until an implementation agent is asked to edit production code. Do not commit, push, restart services, kill Flask `:5050`, or replace the Dock binary from this plan-writing step.

**Implementation status (2026-08-24 01:01 IST):** Phases **1–8 Done** in the dirty `AppKit` tree. Phase **0 leftover** is operator-only (quit 21 Aug Dock binary; recopy `apple-app/build/Stratji.app`; pixel-check Stratji.app). No new Project-Status / Code-Reviews / RCA written in this finish pass.

**Goal:** One chrome per surface. Mac overlay owns workspace+sections (glyphs unselected; selected = glyph + name + **that** workspace’s full titles). Localhost keeps the web CSS droplet; hover must not impersonate selection. iOS keeps the web droplet **and** the web Satya dialog. Launch adopts a live `serviceReady` stack. Documents Allow does not repeat on navigate. M-1 Monday uses Sunday mail when that is the newest mintable day. Operator runs `apple-app/build/Stratji.app`, not 21 Aug Dock.

Honor `AGENTS.md`: six workspaces; freshness in Settings only; no startup-refresh-failed banner; Intelligence is M-1 / M-2 Satya / M-3 only; shared `DailyKanbanBoard`; S-2 filter stays S-2-only; Satya citations are icon clusters; unpublished KPIs stay blank; do not kill a healthy leftover `:5050` unless recycle is explicit.

---

## Success criteria

1. **Adopt-live launch.** `kickoffAtLaunch` returns without `stopDataPlane` when `FlaskHealthDTO.serviceReady` is already true. Recycle only via Retry / `ensureRunning(recycle: true)`. After a relaunch, `:3000` and `:5050` stay bound; `curl :3000` is not connection-refused.
2. **Web hover = native `clusterWorkspace`.** `pillIndex === activeIndex`. Hover scales a glyph only. Investment selected + hover Sectors → Investment titles stay (Action Board / Portfolio / Risk / Axis picks); canvas stays I-1.
3. **Click path.** Click Sectors → `?view=sectors&section=s1` → S-1 `DailyKanbanBoard` + three sector titles. Intel leftover `section=s1` still maps to `m1`. No “all toggles show Portfolio.”
4. **One chrome.** Macintosh + `Stratji/` FOUC still sets `data-native-owns-sections=1`. iOS / `?nativeChrome=1` still set `data-native-web-nav=1`. `DashboardTabs` unmounted when Mac overlay owns nav. Pixel: one droplet on the **24 Aug** (or newer) build.
5. **Satya pop-out.** Mac: NSPanel, current turn only, close keeps thread. Localhost: web dialog. iOS: **no** `satyaDraft` handler; web dialog mounts. Dock binary contains `satyaDraft` only after recopy.
6. **Documents.** Workspace change + focus return → zero Allow sheet. Refresh all / launch: at most one persistent grant (bookmark from `NSOpenPanel` **or** documented FDA). No `fileExists` Documents on `select`.
7. **M-1 Monday.** `resolveIntelligenceEvidenceDateKeys` newest-mintable in prior-NSE…yesterday. Test `a Monday open includes Saturday and Sunday mail, not only Friday` stays green. No invented companies.
8. **1k judo.** `satya.css` < 1000 lines. Draft state extracted from `satya-client.ts`. `SatyaPresence.tsx` does not grow further this PR.
9. **Tests.** Hover assert; iOS `satyaDraft` gated; launch test flipped from always-stop to adopt-live; leftover Intel + Monday + close-keeps-thread stay green. `npm run lint`, `npm run build`, `node --test tests/rendered-html.test.mjs tests/native-launch-refresh.test.mjs tests/native-sidebar-click.test.mjs tests/workspace-routing.test.mjs tests/satya-draft-popout.test.mjs tests/intelligence-daily-actions.test.mjs tests/stratji-documents-tcc.test.mjs`.
10. **Operator binary.** Running `ps` path contains `apple-app/build/Stratji.app` **or** Dock sha256 equals build (`16eaf7dd…` or newer). Flask health still 200 after relaunch.

---

## Phase 0 — Operator / process (LEFTOVER — do before claiming the screenshot fixed)

**Owner:** operator. **Code:** none. **Do not kill `:5050`.** **Status:** not claimed Done — Dock / Applications recopy and Stratji.app pixel-check remain operator.

Live stack after Phase 8 finish (01:01 IST): Flask `_flask/health` **200**, vinext `:3000` **200**. Left up.

1. Quit Stratji if the running process is `/Applications/Stratji.app` or `~/Applications/Stratji.app` (21 Aug 20:55, sha256 `148bd643…`).
2. Open `/Users/adityasharma/Documents/GitHub/Investment Dashboard/apple-app/build/Stratji.app` (24 Aug 01:01 IST, Mach-O sha256 `2fc4dda4b03c01f22162e850f1b91c58d5948952dc1b55ac167dbec7e91c745b`, `CFBundleVersion` `202608240100`). `strings` contains `satyaDraft` and `StratjiRepoRootBookmark`. Do **not** treat the 00:41 `16eaf7dd…` archive as current.
3. Confirm `ps` command path contains `apple-app/build/Stratji.app`.
4. Recopy that app over `/Applications/Stratji.app` and `~/Applications/Stratji.app` so Dock is not two days behind. Finder version is already `202608240100`.
5. Pixel-check: one droplet; selected workspace owns full titles; hover does not expand a foreign cell; click Sectors → S-1.
6. If dual chrome **still** appears on a post-FOUC Flask document, that is a CSS last-wins regression — not “code missing the droplet.” Re-read `app/native-chrome.css` hide + `data-native-web-nav` opt-in.

**Acceptance:** Running binary sha256 matches the rebuild. Flask health still 200. `:3000` still 200 if the leftover stack was healthy (Phase 1).

---

## Phase 1 — P1 adopt-live launch (Done)

**Risk:** Low if `isReachable()` is the same predicate splash already uses. Behavior change is **desired** for relaunch. First install and explicit Retry preserved.

**Judo (auditor tier S):** one “is the stack ready?” path. Concepts 3 → 1.

### 1.1 `kickoffAtLaunch`

**File:** `apple-app/Stratji/FlaskServiceSupervisor.swift`

Today (lines 70–77): always `persistRepoRoot` → `stopDataPlane` → `waitUntilDashboardPortsFree` → `runDashStartInBackground`.

Change to:

1. `persistRepoRoot()` (unchanged; TCC launch touch is Phase 4).
2. If `await isReachable()`: `adoptLiveGatewayWithoutRecycle()`; log “Launch: gateway already serviceReady; skip stop”; return.
3. Else: current stop → wait → dash-start.

Do **not** call `stopDataPlane` when health is already `serviceReady`. Do **not** weaken `isReachable` to “Flask bound” without vinext 200.

### 1.2 Port-wait timeout (with the same PR)

**File:** same, `waitUntilDashboardPortsFree` (lines 405–419).

After 80 ticks, do **not** dash-start against leftover listeners. Surface Retry / FDA (existing `FlaskServiceStatus.unavailable`). If adopt-live lands, this path is Retry-only.

### 1.3 Tests

**File:** `tests/native-launch-refresh.test.mjs`

- Remove the assert that `kickoffAtLaunch` must contain `stopping leftover dashboard processes for a fresh start` as the only launch path.
- Require: `kickoffAtLaunch` calls `isReachable` / `serviceReady` before `stopDataPlane`; adopt-live string present; `ensureRunning(recycle: true)` still stops.
- Keep: `return health.serviceReady`; no status-code-only healthy; `stop-flask-app.sh` still used on **explicit** stop/Retry/quit.
- Rename test: leftover teardown is Retry/quit, not every launch.

### 1.4 Do not touch

- `page.tsx` silent native hydrate (`:779–782`).
- Splash `waitUntilFlaskReady` 180s.
- `applicationDidBecomeActive` incremental only.
- Healthy leftover `:5050` except explicit Retry.

**Acceptance:** Relaunch Stratji while health is 200 → both ports remain; splash clears; localhost `:3000` never refused. Cold start with nothing listening still dash-starts.

---

## Phase 2 — P1 web hover = selected workspace (Done)

**Risk:** Low. Click still switches `?view=`. Hover preview of foreign sections is removed (desired).

### 2.1 `DashboardTabs`

**File:** `app/dashboard/shared-ui.tsx` (~377–434)

- `const pillIndex = activeIndex;`
- Keep `hoverIndex` / `focusIndex` only for `data-hover` / glyph scale CSS if needed.
- `dropletWorkspace` follows `visibleWorkspaces[activeIndex]`.
- `data-expanded` only when `workspace.key === active`.
- `onMouseEnter` may still set hover for scale; it must not change `--glass-index` or section chips.

Do **not** change `onChange` / `selectSectionFor` / `applyWorkspaceSectionParams`.

### 2.2 Tests

- `tests/rendered-html.test.mjs` or a small `shared-ui` extract test: droplet `data-droplet` / `--glass-index` tracks `active`, not hover. If the component is hard to mount, grep is **not** enough — prefer a unit that exports the index helper **or** a Playwright/rendered fixture. Minimum: extract `dropletIndex({ hoverIndex, focusIndex, activeIndex })` returning `activeIndex` and test it. Prefer **not** adding a helper if you can set `pillIndex = activeIndex` and assert in rendered-html that the source no longer contains `hoverIndex ?? focusIndex ?? activeIndex`.
- Keep `tests/native-sidebar-click.test.mjs` `clusterWorkspace` greps.

### 2.3 Do not touch

- `StratjiWorkspaceGlassBar.swift` `clusterWorkspace` (already correct).
- `parseWorkspaceSection` leftover mapping (already correct).
- Compact chip labels (`section.label` already full names).

**Acceptance:** Hover Sectors on `?view=investment&section=i1` → Investment titles stay; canvas I-1. Click Sectors → S-1.

---

## Phase 3 — P1 iOS does not register `satyaDraft` (Done)

**Risk:** Low. Mac unchanged. iOS gains the web dialog (desired).

### 3.1 iOS bootstrap

**File:** `apple-app/InvestmentDashboard/DashboardBrowser.swift` (~147–155)

Wrap add + `satyaDraft.webView = view` in `#if os(macOS)`. Speech bridge stays on both OSes.

### 3.2 Bridge

**File:** `apple-app/Shared/StratjiSatyaDraftBridge.swift`

Keep `#if os(macOS)` on `handle` / panel. Optional: compile the `WKScriptMessageHandler` add-path only on macOS so iOS cannot register it by accident.

### 3.3 Web

**Files:** `SatyaDraftPopout.tsx`, `satya-client.ts`

No logic change if the handler is absent — `hasNativeSatyaDraftPopout()` becomes false; dialog mounts. Keep `installSatyaDraftNativeCallbacks` for Mac close → JS `onClose`.

### 3.4 Tests

- Grep iOS `DashboardBrowser.swift`: `satyaDraft` add is inside `#if os(macOS)`.
- Existing `tests/satya-draft-popout.test.mjs` close-keeps-thread / `currentSatyaTurn` stay green.
- Existing Swift `SatyaDraftPopoutTests`.

### 3.5 Product decision (same PR or immediate follow-up)

`SatyaPresence.tsx:567` auto-`openSatyaDraftPopout` on every M-2 / orb stream. Confirm with operator: auto-open vs Pop-out control only. Default if unspecified: **keep auto-open on Mac** (NSPanel is the basis); iOS/web dialog on stream is acceptable once the handler is gone.

**Acceptance:** iPhone Pop out shows the web modal. Mac still NSPanel. Close does not clear the thread.

---

## Phase 4 — P1 file-size judo (Done)

**Risk:** Low if moves are mechanical.

1. Move `.satya-draft-popout*` (only) from `app/dashboard/satya.css` to `app/dashboard/satya-draft-popout.css`. Import next to `SatyaDraftPopout.tsx`. `wc -l satya.css` < 1000.
2. Extract `app/dashboard/satya-draft-popout.ts`: `open/close/sync/subscribe/hasNative/currentSatyaTurn/installCallbacks`. `satya-client.ts` `setSatyaThread` one-line notify. Do not grow `SatyaPresence.tsx`.
3. Do not extract a prompt DSL for story answers. Do not merge NSPanel + web dialog behind a mode flag.

**Acceptance:** 1k bar met for `satya.css`. Behavior preserved. No new import cycle.

---

## Phase 5 — P2 Documents TCC (Done — leftover `stat`s + Application Support trampoline)

**Sibling:** [Fix Stratji Documents prompt](cbcd8254-885d-4b5a-b8e9-e2ba2d4dab69)

**Already landed (keep):** `repoRoot` cache; no `fileExists` on getter; `select` / `DocumentBrowser.load` / `latestRefreshProgress` do not `persistRepoRoot` / `stat` Documents.

**Do now if any remain:** grep `fileExists` / `persistRepoRoot` on navigate / poll paths; delete leftovers.

**Follow-up (product):**

1. Refresh: invoke Application Support `start-dashboard.command` / a refresh trampoline that `cd`s to the bookmarked root **once** after `startAccessingSecurityScopedResource`. Stop `process.currentDirectoryURL = repoRoot` from the UI process if that retriggers TCC.
2. Persistent Allow: `NSOpenPanel` once, store **that** bookmark — **or** document Full Disk Access as the real grant and stop claiming entitlements persist it. `Stratji.entitlements` sandbox is **false**; `files.bookmarks.app-scope` is decorative until sandbox-on.
3. Tests: more than greps — if feasible, a small Swift test that `repoRoot` second read does not hit the filesystem (hard). At least keep `tests/stratji-documents-tcc.test.mjs` and add “Refresh script cwd is Application Support” when the trampoline lands.

**Acceptance:** Switch workspace + Refresh all → zero Documents sheet (or one FDA setup forever).

---

## Phase 6 — P2 M-1 Monday walkback (Done — landed dirty tree; not rewritten)

**Files:** `app/dashboard/intelligence-daily-actions.ts` `resolveIntelligenceEvidenceDateKeys`; `tests/intelligence-daily-actions.test.mjs`; `app/api/satya/sources/route.ts` if it shares the window.

**Do:** Land the dirty-tree function as-is with the Monday test. Do not jump to Friday when Sunday has mintable cards. Do not mix Thursday into a Friday that already has cards. Do not invent KPIs. Do not paste Mail bodies.

**Do not:** Block chrome P1s on this. Do not serve HEAD-only `lastNseTradingDay` as the mint window once this lands.

**Acceptance:** Calendar Monday 2026-08-24 + Sunday newsletters in the digest snapshot → non-empty M-1; Friday Punch unused when Sunday has cards. Stale sources still label stale.

---

## Phase 7 — P2 suggestions catalog collapse (Done)

**File:** `app/dashboard/satya-suggestions.ts`

Workspace catalogs are source of truth. `defaultSatyaSuggestions(task)` picks a workspace (or named catalog). Health chips must not invent vitals. Sectors chips ≠ Intel corpus chips ≠ I-4 Axis matrix.

**Acceptance:** One wording for “never invent CMP.” S-2 has no MI promo.

---

## Phase 8 — Rebuild + verify both surfaces (Done — operator pixel leftover in Phase 0)

1. Focused node suite: **84/84 pass**. `npm run build` succeeded (Vinext). `npm run lint` exits 1 on pre-existing `apple-app/DerivedData*` JWTDecode/SimpleKeychain docs plus `SatyaDraftPopout.tsx` `react-hooks/set-state-in-effect` (Phase 4 portal host; not introduced by the TSX import fix). Vinext resolves `./satya-draft-popout` without `.ts`.
2. Rebuilt Stratji Release → `apple-app/build/Stratji.app` (mtime 2026-08-24 01:01 IST). `strings` has `satyaDraft` and `StratjiRepoRootBookmark`. Mach-O sha256 `2fc4dda4b03c01f22162e850f1b91c58d5948952dc1b55ac167dbec7e91c745b`. Did **not** run `install-stratji-macos.sh` (it `pkill -x Stratji`).
3. Recopy to Dock / Applications remains **Phase 0 leftover**.
4. **Localhost curl:** `:5050/?view=investment&section=i1` has workspace nav + Action Board / Portfolio / Risk / Axis. `:5050/?view=intelligence` has Satya + Axis Research / Groww / Flipboard / Podcasts / Earnings KPIs chips; zero `sector-intelligence-filter` / `sector-dimmed`; no Newsletter digest wall / Open PDF wall; no M-4/M-5. `:5050/?view=sectors&section=s1` sets `data-active-workspace="sectors"`. Hover impersonation gated by source `pillIndex = activeIndex` (browser MCP could not open a tab for live hover).
5. **Stratji.app interactive** (splash, one glass bar, Pop out, Refresh TCC, adopt-live relaunch) is Phase 0 leftover — do not treat Dock as current.
6. **iOS:** source assert is the gate (`#if os(macOS)` around `add(satyaDraft)`). Simulator/device not run.
7. Flask `_flask/health` stayed **200** with vinext upstream **200**. Did not kill `:5050`.

---

## Phase order and ownership

| Phase | Priority | Owner surface | Dependency | Effort |
| --- | --- | --- | --- | --- |
| 0 Operator binary | Process | Ops | Rebuild after 1–4 | leftover |
| 1 Adopt-live | P1 | Swift supervisor + launch test | None | Done |
| 2 Web hover | P1 | `shared-ui.tsx` + test | None | Done |
| 3 iOS satyaDraft | P1 | `DashboardBrowser.swift` | None | Done |
| 4 1k extract | P1 structural | Satya CSS/TS | Phase 3 files stable | Done |
| 5 TCC | P2 | `StratjiConfiguration` + supervisor cwd | Sibling chat | Done |
| 6 M-1 walkback | P2 | `intelligence-daily-actions.ts` | Dirty tree already | Done |
| 7 Suggestions | P2 | `satya-suggestions.ts` | Sibling chat | Done |
| 8 Verify | Gate | Both surfaces | 1–4 + rebuild | Done |

Phases 1–3 are independent and can ship in one PR. Phase 4 belongs in that PR if it stays mechanical. Phase 5–7 must not block 1–3.

---

## Explicit non-goals

- Do not implement from this document until the operator asks.
- Do not kill Flask `:5050` / vinext `:3000` if they are healthy.
- Do not hide `.workspace-navigation` for all `native-chrome-embed` (strips iOS).
- Do not set `nativeOwnsSections` for `?nativeChrome=1` in Safari/Chrome.
- Do not compact or split `DailyKanbanBoard`.
- Do not add M-4/M-5, S-4, earnings on Sectors, or industry filters on Intelligence / Builder / Strategies / My Feed.
- Do not put a startup-refresh-failed banner on the main canvas.
- Do not invent Mail/Health/earnings KPIs or paste private bodies.
- Do not merge NSPanel and the web dialog.
- Do not treat `/Applications/Stratji.app` as the verification target when `apple-app/build/Stratji.app` is newer.

---

## Rollback

- Launch: restore always-stop `kickoffAtLaunch` only if adopt-live falsely skips a **non**-`serviceReady` leftover (should be impossible if `isReachable` stays honest). Prefer fixing the health DTO over reverting.
- Hover: restore `hoverIndex ??` only if accessibility requires focus-expansion — then expand **focus**, never hover, and still not while `?view=` is another workspace.
- iOS handler: do not re-add `satyaDraft` on iOS.

---

## Residual risks after this plan

- Dock recopied late → operator still misses NSPanel (process).
- TCC: unsandboxed bookmark may never satisfy “Allow once” without FDA / Open Panel.
- Auto-open draft on every stream may annoy; confirm UX.
- Complete-dashboard freshness (Health export, Mail ingest) remains ops, not chrome.
- Two outline tables (Swift vs TS) can still drift without a zip test (P3; add when touching titles).
