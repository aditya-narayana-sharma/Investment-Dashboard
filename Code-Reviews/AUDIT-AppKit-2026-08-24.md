# 🔍 AUDIT — AppKit @ `550f0c1` · APPROVE WITH REQUIRED CHANGES

**Scope:** DIFF mode · base `976503b` → head `550f0c1` (single commit) · 69 files, +5,628 / −916
**Coverage:** audited in full — `daily-action-policy.ts`, `FlaskServiceSupervisor.swift` (launch policy), `StratjiConfiguration.swift` (bookmark/TCC), `Stratji.entitlements`, `app/satya/chat.ts`, `app/api/satya/sources/route.ts`, `StratjiSatyaDraftBridge.swift`, `DashboardBrowser.swift`. Sampled — `satya-suggestions.ts`, `intelligence-daily-actions.ts`, `TreeCanvas.tsx`, `SymphonyEditor.tsx`, builder CSS, workspace `.tsx` files. Excluded — generated `project.pbxproj`, test bodies (read for intent, not line-audited).
**Verification:** ran 8 related suites (`daily-action-policy`, `workspace-daily-actions`, `satya-draft-popout`, `satya-draft-status`, `intelligence-daily-actions`, `native-launch-refresh`, `stratji-documents-tcc`, `satya-suggestions`) → **38 pass / 0 fail**.

## Verdict: **APPROVE WITH REQUIRED CHANGES**

No P0/P1. The change is well-tested and the launch/adopt-live and Satya-draft-bridge work is clean. Two structural P2s hold it back from a clean approve: (1) the Documents-persistence migration ships **sandbox-only entitlements and security-scoped-bookmark code under `app-sandbox = false`**, where they are inert — this is the RCA's own root cause #5 left half-fixed; and (2) two files breach the 1000-line rule in direct contradiction of the remediation plan's own success criteria, with `SatyaPresence.tsx` (a non-declarative React component) the one that actually needs decomposition.

| Dimension | Score | Note |
|---|---|---|
| Correctness & safety | 8/10 | Launch adopt-live logic is sound; ports-free guard prevents double-stacks; tests green. |
| Security | 8/10 | No injection/authz regressions; entitlements broaden file access but only nominally (sandbox off). |
| Structural quality (judo) | 7/10 | New policy modules are cohesive; SatyaPresence keeps absorbing scope. |
| Layout & modularity | 6/10 | Draft feature correctly split into its own modules; but three files ≥1000 lines, one non-declarative. |
| Tests | 9/10 | New behavior + close-keeps-thread + adopt-live + Monday-mail all covered and green. |
| Legibility & docs | 8/10 | Strong doc-comments on the Swift launch/TCC paths. |
| Operability | 8/10 | Desktop-log breadcrumbs on every launch branch; FDA deep-links added. |
| **Weighted** | **7.6/10** | |

## 🧨 Presumptive blockers
- **#2 tripped (1000-line rule):** `satya.css` 945→1046 and `SatyaPresence.tsx` 1122→1161. CSS earns the declarative waiver (4E.3); `SatyaPresence.tsx` does not. Not treated as a hard block because it is pre-existing debt the PR *extends* rather than introduces — downgraded to P2 with a decomposition ask.
- No other blocker tripped.

## 🥋 Code-judo assessment
**ALREADY MINIMAL (new code) / JUDO AVAILABLE (SatyaPresence).** The new policy layer (`daily-action-policy.ts`, `workspace-daily-actions.ts`) is the simplest reasonable structure — a pure ranking/dedup/cap pipeline with no mode flags. The available judo move is on the pre-existing `SatyaPresence.tsx`: at 1161 lines it holds presence orb + briefing wiring + draft plumbing; the draft plumbing now has a natural home (`satya-draft-*.ts`) to migrate into. Effort: FOLLOW-UP. Behavior preserved: yes.

## Findings

### [P2] Documents-persistence migration is inert under `app-sandbox = false` · `apple-app/Stratji/Stratji.entitlements:46` · PLAUSIBLE
**What:** The commit adds `com.apple.security.files.user-selected.read-write` and `com.apple.security.files.bookmarks.app-scope`, and `StratjiConfiguration.swift` now creates/resolves the repo-root bookmark with `options: [.withSecurityScope]` and calls `startAccessingSecurityScopedResource()`. But `com.apple.security.app-sandbox` is `<false/>` (`Stratji.entitlements:37`).
**Why it matters:** Both entitlements are App-Sandbox-only and have no effect outside the sandbox; `.withSecurityScope` bookmark creation is unsupported for a non-sandboxed process, so `persistBookmark`/`resolveBookmarkedRepoRootLocked` degrade to the plain-path fallback. The "persist the Documents Allow so `?view=` changes don't re-prompt" goal is therefore **not** met by this mechanism — it works only via the pre-existing Full Disk Access path. This is precisely RCA root cause #5 ("App Sandbox is false, so `files.bookmarks.app-scope` does not persist Allow") — the remediation added the manifest keys but not the sandbox that would activate them, leaving a half-migration whose manifest now advertises a guarantee the build disables.
**Assumption (why PLAUSIBLE):** the exact runtime behavior of `.withSecurityScope` on a non-sandboxed app is asserted from Apple's contract, not verified by running the app; the *entitlements-inert* half is CONFIRMED (`app-sandbox=false` is a fact).
**Remedy (pick one, DO IN THIS PR IF FEASIBLE):**
- (a) Enable `app-sandbox` and complete the entitlement/FDA audit so the security-scoped bookmark actually persists Allow — the real fix, larger blast radius; or
- (b) Drop the two sandbox-only keys and the `.withSecurityScope` option, and document that persistence relies on Full Disk Access. Either way the manifest and the code should tell the same story about how access persists. Behavior preserved: (b) yes; (a) changes runtime access model.

### [P2] 1k-line breaches contradict the plan's own success criteria · `app/dashboard/SatyaPresence.tsx:1` · CONFIRMED
**What:** `SatyaPresence.tsx` grew 1122→1161 and `satya.css` grew 945→1046. The remediation plan (`Plans/2026-08-24-localhost-vs-stratji-remediation.md`, success criterion #8) states *"`satya.css` < 1000 lines"* and *"`SatyaPresence.tsx` does not grow further this PR"* — both are violated by the commit that claims Phases 1–8 done.
**Why it matters:** a plan that reports "Done" while its measurable criteria regressed erodes the ledger's trustworthiness (this feeds `$project-status` next). `SatyaPresence.tsx` is a non-declarative component well past the 250-line component threshold and still accreting; `satya.css` crossed 1000 even though a sibling `satya-draft-popout.css` was created — the split landed the *new* rules elsewhere but didn't relieve the base file.
**Remedy (FOLLOW-UP):** migrate the draft plumbing out of `SatyaPresence.tsx` into the existing `satya-draft-*.ts` modules; either bring `satya.css` back under 1000 or amend the plan's success criteria to state the real post-change line counts. Behavior preserved: yes.

### [P3] `algorithm-builder.css` crossed 1000 (824→1005) · `app/dashboard/builder/algorithm-builder.css:1` · CONFIRMED
Declarative CSS → 4E.3 waiver applies; noted for the layout ledger, not blocking. If it keeps growing, split by builder subsection (canvas / json / palette).

## 📐 Metrics (files crossing thresholds this commit)
| File | Before | After | Δ | Flag |
|---|---|---|---|---|
| app/dashboard/satya.css | 945 | 1046 | +101 | **crossed 1000** (declarative waiver) |
| app/dashboard/SatyaPresence.tsx | 1122 | 1161 | +39 | **>1000, grew** (no waiver — component) |
| app/dashboard/builder/algorithm-builder.css | 824 | 1005 | +181 | **crossed 1000** (declarative waiver) |
| app/dashboard/satya-client.ts | 1027 | 1028 | +1 | >1000, net-flat (draft state extracted) |
| app/dashboard/intelligence-daily-actions.ts | 290 | 450 | +160 | healthy |
| app/dashboard/satya-suggestions.ts | 192 | 350 | +158 | healthy (declarative catalogs) |

## 🗺 Layout verdict
The repo is **easier** to navigate after this change in the parts that matter: the Satya draft feature is correctly isolated into `SatyaDraftPopout.tsx` / `satya-draft-popout.ts` / `satya-draft-status.ts` / `StratjiSatyaDraftBridge.swift` rather than bolted onto existing files, and daily-action policy now has a named home (`daily-action-policy.ts`, `workspace-daily-actions.ts`) instead of scattering feature checks. The one regression is vertical: `SatyaPresence.tsx` keeps absorbing responsibilities it could now delegate.

## ✅ What's good here
- **Adopt-live launch is the right fix, cleanly done.** `kickoffAtLaunch` early-returns on a `serviceReady` gateway; `waitUntilDashboardPortsFree` now returns `Bool` and refuses to stack a second data plane after 20s. Every branch leaves a desktop-log breadcrumb.
- **Bridge retain hygiene is correct.** `StratjiSatyaDraftBridge` holds `weak var webView`, dispatches with `[weak self]`, and closes via `windowWillClose` — no retain cycle, macOS-gated so iOS falls back to the web dialog exactly as the plan requires.
- **`route.ts` multi-day flatMap is correct** — `listRecentSatyaCorpusDocuments(asOf)` filters by exact date prefix, so the inclusive prior-session→today range yields disjoint rows, no duplication.
- **Well-tested:** 38 related assertions green, including close-keeps-thread, adopt-live-not-recycle, no-re-stat-on-navigate, and the Monday-includes-weekend-mail case.

## ❓ Open questions for the author
- Is `app-sandbox` intended to stay `false` long-term? That decision is what makes the entitlement/bookmark finding either "delete the inert keys" or "finish enabling the sandbox."
- `app/satya/chat.ts` reframes the LLM prompt from `REQUIRED HEADINGS` (directive) to `EVIDENCE INVENTORY` (narrative). Intentional product shift bundled into a chrome/launch remediation commit — confirm it belongs here rather than in a Satya-prompt commit.

## 📋 Follow-up tickets suggested
- **Resolve the Stratji sandbox/bookmark half-migration** — enable App Sandbox and finish the FDA/entitlement audit, or remove the sandbox-only keys and `.withSecurityScope` and document FDA reliance.
- **Decompose `SatyaPresence.tsx` below 1000 lines** — migrate draft plumbing into `satya-draft-*` modules.
- **Reconcile the remediation plan's success criteria** with the real post-change line counts.
