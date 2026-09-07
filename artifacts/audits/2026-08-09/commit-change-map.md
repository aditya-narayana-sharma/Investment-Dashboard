# Investment Dashboard — Commit, Ref, and Change-Topology Audit

**Audit time:** 2026-08-09 07:49 IST  
**Project:** `/Users/adityasharma/Documents/GitHub/Investment Dashboard`  
**Mode:** Read-only; no source, refs, worktree, stash, or runtime state changed.  
**Baseline:** all **28 commits** reachable from local heads, local remote-tracking refs, and `refs/stash` (25 non-merge objects, 3 merge objects, including Git-created stash helpers); current worktree at `0855923f653a55b57bb1db7c5ac267de1c1cec8d`. Remote findings describe the locally cached remote-tracking refs, not a fresh network fetch.

## Executive verdict

**Change-management health: Degraded / not release-canonical.** The current checked-out `Visual-Overhaul` branch is clean and exactly matches `origin/Visual-Overhaul`, but the repository has no single authoritative release line: local `main` is one commit ahead and two behind `origin/main`, while `Visual-Overhaul` and `origin/main` each contain two commits absent from the other. The default remote branch therefore lacks the two substantive commits that define the current local product, while it contains README-only commits not present on the product branch.

The history also contains a complete duplicated six-commit development chain, a redundant stash representing the first duplicate commit, 2,004 generated Firecrawl files (including 1,987 vendored `node_modules` files and a credential-named cookie file), no CI workflow, no tags/releases, and several very large commits whose test evidence is incomplete. One committed audit artifact is internally contradictory and claims two deliverables that are absent from the tree.

## Findings, ordered by risk

| ID | Sev. | Status / confidence | Finding | Evidence | Impact / required action |
|---|---|---|---|---|---|
| C-01 | **P1** | Confirmed / High | **Default-branch/product-branch divergence creates deployment drift.** `origin/main` is `c0a8549`, current/local product is `Visual-Overhaul` `0855923`; merge-base is `5eb666d`. Each side has 2 unique commits. The Visual-side delta from the merge-base spans **91 files, +13,255/-1,920**. | `git rev-list --left-right --count Visual-Overhaul...origin/main` → `2 2`; `git diff --shortstat origin/main...Visual-Overhaul`; `git diff --name-status origin/main...Visual-Overhaul`. | A clone/deploy from default `origin/main` omits Phase 3 and Visual Overhaul behavior across all four workspaces, APIs, Health, refresh scripts, and tests. Choose a canonical branch, review/merge the divergent README edits, then tag a verified release. |
| C-02 | **P1** | Probable / High | **Potential sensitive runtime material is permanently tracked.** `0c71858` adds `.firecrawl/fii-dii/nse-cookies.txt` (131-byte blob). Its content was intentionally not inspected. | `git ls-files | rg -i '(cookie|token|secret|credential|session)'`; `git cat-file -s HEAD:.firecrawl/fii-dii/nse-cookies.txt` → `131`; introducing commit from `git log --all -- ...` → `0c71858`. | A cookie file can expose session material even after later deletion. Confirm content out-of-band; if sensitive, revoke/rotate it and rewrite published history. Add a pre-commit/CI secret scan. |
| C-03 | **P2** | Confirmed / High | **Generated/vendor dump dominates the repository.** `0c71858` adds 2,004 `.firecrawl` files and 243,673 lines, including **1,987 `node_modules` files**, with zero tests. Current tree has 2,253 tracked paths, 2,015 (89.4%) under `.firecrawl`. `.gitignore` now ignores `.firecrawl/`, but tracked content remains. | `git diff-tree --root --shortstat -r 0c71858`; `git ls-files '.firecrawl/**'`; current area counts; `.gitignore: .firecrawl/`. | Slower clones/reviews, noisy diffs, supply-chain ambiguity, possible private research/cookies retained forever. Remove tracked generated content in a dedicated reviewed cleanup; consider history rewrite only with coordination. |
| C-04 | **P2** | Confirmed / High | **Six commits exist twice as patch-identical parallel chains.** Exact patch/tree pairs: `5cc6adf`=`5924c27`, `66efa1c`=`33ca078`, `913b1b0`=`54424bd`, `c5a08fa`=`9678fc9`, `13411f5`=`033f950`, `ba9b9c1`=`efdba55`. The final pair has identical trees. | Stable `git patch-id` output; `git diff --quiet ba9b9c1 efdba55` → 0; identical tree IDs. | History and authorship/review evidence are duplicated; bisect and audit counts are misleading. Preserve only the canonical reachable chain when pruning obsolete branches; document the duplication rather than treating it as independent testing. |
| C-05 | **P2** | Confirmed / High | **The remaining stash is redundant and structurally unusual.** `refs/stash` is a three-parent commit: base `40f703e`, empty index tree `fa94852` (same tree as base), and untracked tree `6010f53`. Its tracked delta plus the 22 untracked paths exactly comprise duplicated commit `5cc6adf`/`5924c27`. | `git show -s --format='%H %P %T' refs/stash`; `git diff 5cc6adf refs/stash` shows exactly the 22 third-parent paths as deletions. | The stash is not unique recovery evidence and keeps generated/private candidates reachable. After confirming no unique intent, drop it through a deliberate recoverability workflow. |
| C-06 | **P2** | Confirmed / High | **Committed audit evidence contradicts itself and the operating contract.** `artifacts/AUDIT-SUMMARY.md` says “PRODUCTION READY,” “7 data sources verified production-ready,” and “no warnings,” while its own committed `startup-verification.log` records Mail/Podcasts failed (`partial`) and Health failed (`stale`), and `build-log.txt` contains a Node deprecation warning plus Vinext route-classification warnings. The summary also says H-1–H-4/2×2 although the product contract is H-1–H-3, and claims `RCA-COMPREHENSIVE.md/.csv` deliverables that do not exist in commit `1d65e39`. | `git show 1d65e39:artifacts/{AUDIT-SUMMARY.md,startup-verification.log,build-log.txt}`; `git cat-file -e 1d65e39:artifacts/RCA-COMPREHENSIVE.md` → missing; same for CSV. | These files cannot serve as release evidence. Regenerate audit artifacts from reproducible commands, require source-contract pass/fail consistency, and stop committing transient logs as authoritative proof. |
| C-07 | **P2** | Confirmed / High | **Insufficient commit-level verification and poor bisectability.** No `.github/workflows` or other CI configuration was found; no tags/releases; all reachable commits are unsigned. Only `d47b4cb` explicitly records lint/build/targeted test execution in its commit body. Major commits: `a5ea522` 111 files/+11,713 with 2 test files; `0c71858` 2,004 files/+243,673 with 0 tests; `0855923` 46 files/+7,221 with 6 test files and only the message “Visual Overhaul.” | CI file search returned empty; `git tag -l` empty; `%G?` = `N`; commit bodies; per-commit file/test counts. | Regressions cannot be associated reliably with a verified build. Add CI for required lint/build/render/API/Health/native checks, smaller scoped commits, test results/limitations in PRs, and signed release tags. |
| C-08 | **P2** | Confirmed / High | **Current product documentation is inconsistent after the visual branch.** `AGENTS.md` requires H-3 to use three comparison-direction columns with no unavailable column; current `README.md` still says four direction columns. | `rg -n 'three comparison-direction|four direction columns' AGENTS.md README.md` → AGENTS line 84 vs README line 89. `0855923` changed AGENTS but not README. | Maintainers can implement/test the wrong layout. Reconcile README with the controlling contract in the canonical merge. |
| C-09 | **P3** | Confirmed / High | **Obsolete local branches and remote-gone tracking remain.** `codex/dashboard-console-health-refresh` and `cursor/cloud-agent-...` both show upstream `[gone]`; the latter points to the duplicate chain. | `git for-each-ref ... %(upstream:track)`; `git branch -a -vv`. | Clutters release topology and can lead to accidental checkout/push of obsolete history. Archive the mapping, then delete local refs after explicit confirmation. |
| C-10 | **P3** | Confirmed / High | **Working tree is clean but contains an empty untracked Xcode directory.** Git status/diff/index are clean; `git clean -nd` would remove `apple-app/.../xcshareddata/`, indicating only an untracked empty directory hierarchy. | `git status --porcelain=v2 --branch`; `git diff-files --quiet`; `git diff-index --quiet HEAD --`; `git clean -nd`. | No current implementation edits are pending. The empty directory is harmless but should not be mistaken for a tracked change. |

## Ref and topology map

| Ref | Commit | Relationship / state | Audit interpretation |
|---|---|---|---|
| `HEAD`, `Visual-Overhaul`, `origin/Visual-Overhaul` | `0855923` | Exact match, ahead/behind 0/0 | Clean current local product line. |
| `main` | `1d65e39` | `origin/main`: ahead 1, behind 2 | Contains Phase 3 but not Visual Overhaul; lacks remote README/test commits. |
| `origin/main`, `origin/HEAD` | `c0a8549` | Default remote-tracking line | Contains README rewrite/test only; lacks Phase 3 and Visual Overhaul. |
| `origin/test/github-mcp-verification` | `c1efbeb` | Parallel sibling of `c0a8549` | Patch-identical README test commit; not merged as the same object. |
| `codex/dashboard-console-health-refresh` | `d47b4cb` | upstream gone; fully contained in active/main lines | Obsolete local topic ref; substantive commit retained through merge. |
| `cursor/cloud-agent-1784738826519-44jsd` | `ba9b9c1` | upstream gone; duplicate of canonical `efdba55` chain | Obsolete duplicated branch. |
| `refs/stash` | `efda76f` | three-parent stash rooted at `40f703e` | Redundant with first duplicate cloud-agent commit when third parent included. |
| Tags | none | no release anchor | Cannot identify a tested/released commit from refs. |

### Graph interpretation

1. `3242281 → f5b6f78 → a5ea522 → 40f703e` forms the initial web/live-platform baseline.
2. Two patch-identical mobile chains were created from equivalent `40f703e + local changes` states. The canonical path uses `5924c27 → 33ca078 → 54424bd → 9678fc9 → 033f950 → efdba55`; the obsolete Cursor branch uses `5cc6adf → 66efa1c → 913b1b0 → c5a08fa → 13411f5 → ba9b9c1`.
3. `d47b4cb` was made on `efdba55`. Merge `0f29899` has `efdba55` and descendant `d47b4cb` as parents, so its tree is exactly `d47b4cb`; it is a topology-only merge.
4. `0c71858` branches from `efdba55` and adds only `.firecrawl`. Merge `5eb666d` combines `0c71858` and `0f29899`, producing the shared base of all present release candidates.
5. Local product path: `5eb666d → 1d65e39 → 0855923`. Default remote path: `5eb666d → 15de454 → c0a8549`. The sibling `c1efbeb` has the same patch/tree as `c0a8549`.

## Commit-by-commit impact and verification map

“Tests” below means test files added/modified by that commit, not proof they ran. Only explicit recorded execution evidence is called out.

| Commit | Date | Change size | Primary file/surface impact | Test/change evidence | Audit quality |
|---|---:|---:|---|---|---|
| `3242281` | Jul 13 | 33 files, +13,277 | Initial Vinext app, Investment dashboard/report, CSS, portfolio fixture, Sites config, D1 example, build config. | 1 rendered-HTML test file. | Huge root commit; acceptable bootstrap but weak component-level coverage. |
| `f5b6f78` | Jul 13 | 1 file, +28/-66 | Reworked rendered-HTML QA only. | 1 test file; no production change. | Focused test commit; execution not recorded. |
| `a5ea522` | Jul 22 | 111 files, +11,713/-159 | Adds all live pipelines/APIs, Kite, sectors, earnings, content, Health importer, Flask/service scripts, PWA, report/PDF, native Apple app, artifacts, integrations. Affects every workspace and delivery surface. | 2 test files (`rendered-html`, Flask gateway). | Over-broad; too little visible test delta for 111 files and several data/security boundaries. |
| `40f703e` | Jul 22 | 33 files, +2,282/-1,506 | Splits dashboard components, creates Health/Investment/Sector workspaces, earnings verification, freshness/API and service hardening, responsive CSS. | 3 test files including freshness/isolation. | Better scoped but still large cross-cutting migration. |
| `5cc6adf` | Jul 22 | 48 files, +4,009/-360 | Kite session reuse, portfolio donut, thesis/Axis recommendations, report/UI/service updates; also Firecrawl snapshots, viewport PNG and `tsconfig.tsbuildinfo`. | 5 test files. | Generic message; mixes product, runtime, generated evidence. Patch-identical to `5924c27`. |
| `6010f53` | Jul 22 | 22 files, +2,962 | Stash helper root storing previously untracked Firecrawl, image, helpers/tests, build info. | 3 test paths included as untracked payload. | Not a product commit; only reachable via stash. |
| `fa94852` | Jul 22 | 0 files | Stash index helper with same tree as `40f703e`. | None. | Empty helper object, not independent work. |
| `efda76f` | Jul 22 | merge helper | Three-parent stash wrapper. | None. | Redundant recovery ref; not a release commit. |
| `66efa1c` | Jul 22 | 20 files, +1,902/-499 | Hybrid iPhone shell, native browser/status/pairing, HealthKit, Flask pairing/upload, scripts. | 2 test files. | Patch-identical duplicate of `33ca078`. |
| `913b1b0` | Jul 22 | 2 files, +10/-8 | Sector live server mobile contract fix. | 1 rendered test file. | Focused; duplicate of `54424bd`. |
| `c5a08fa` | Jul 22 | 2 files, +25/-13 | Swift shell portability. | 0 tests. | Focused but no native test change; duplicate of `9678fc9`. |
| `13411f5` | Jul 22 | 4 files, +86/-6 | Native install/test scripts, package command, Apple README. | 0 repository test files; adds a test runner script. | Duplicate of `033f950`; execution not recorded. |
| `ba9b9c1` | Jul 22 | 13 files, +123/-27 | Native release/assets, Health pairing/security, Flask gateway. | 1 Flask test file. | Security-sensitive; duplicate of `efdba55`. |
| `5924c27` | Jul 22 | 48 files, +4,009/-360 | Same product/generated bundle as `5cc6adf`; canonical merged path. | Same 5 test files. | Generic message; exact duplicate patch. |
| `33ca078` | Jul 22 | 20 files, +1,902/-499 | Same hybrid iPhone change as `66efa1c`; canonical path. | Same 2 test files. | Exact duplicate patch. |
| `54424bd` | Jul 22 | 2 files, +10/-8 | Same sector/mobile contract fix as `913b1b0`. | 1 rendered test file. | Exact duplicate patch. |
| `9678fc9` | Jul 22 | 2 files, +25/-13 | Same Swift shell portability fix as `c5a08fa`. | 0 test files. | Exact duplicate patch. |
| `033f950` | Jul 22 | 4 files, +86/-6 | Same native install workflow as `13411f5`. | 0 repository test files. | Exact duplicate patch. |
| `efdba55` | Jul 22 | 13 files, +123/-27 | Same native release/Health security fix as `ba9b9c1`; canonical path. | 1 Flask test file. | Exact duplicate patch; security assertions should have stronger traceability. |
| `d47b4cb` | Jul 29 | 86 files, +9,316/-1,247 | Full console overhaul: all four workspaces, earnings calendar, Decision Lab, Health date policy across TS/Python/Swift, content sanitization, FII/DII, sector benchmarks, refresh/PDF/native gateway. | 15 test files. Commit body explicitly says lint, build, targeted Node tests, Health importer tests were run. | Best documented major commit, but still very broad and lacks saved command output/CI provenance. |
| `0f29899` | Jul 29 | merge; tree=`d47b4cb` | PR merge of `d47b4cb`; no new content. | No additional test change. | Valid topology marker but redundant because second parent already descends from first. |
| `0c71858` | Jul 29 | 2,004 files, +243,673 | Firecrawl research/vendor dump only: 1,987 vendored dependency files plus snapshots and `nse-cookies.txt`. | 0 tests. | Critical repository-hygiene failure; commit title understates scope. |
| `5eb666d` | Jul 29 | merge | Combines Firecrawl branch with dashboard-overhaul merge. | No merge-only test change. | Establishes bloat/sensitive-path content in every later line. |
| `1d65e39` | Aug 6 | 65 files, +6,214/-1,616 | Phase 3 automation, Market Intelligence M-1–M-4, earnings/calendar/reminders, Health navigation/directions, Kite order scaffolding, source freshness, configs, scripts, audit artifacts. | 11 test files; committed build/startup logs. | Stronger test delta, but committed audit evidence is contradictory and reports failed freshness while declaring production ready. |
| `0855923` | Aug 7 | 46 files, +7,221/-484 | Visual overhaul across all workspace components/CSS, chart visual components, Axis PDF links, yfinance quote route, sector news/benchmarks, Health import and UI. | 6 test files. | Very large UI/data commit with a two-word message and no recorded execution/accessibility/browser evidence. Current active product. |
| `15de454` | Aug 7 | 1 file, +267/-241 | README rewrite on default branch fork. | 0 tests. | Documentation-only but diverges from product branch instead of following it. |
| `c1efbeb` | Aug 7 | 1 file, +3/-1 | GitHub MCP verification text in README on test branch. | 0 tests. | Patch/tree-identical sibling of `c0a8549`; operational test pollutes product README. |
| `c0a8549` | Aug 7 | 1 file, +3/-1 | Same GitHub MCP verification change merged as distinct object on `origin/main`. | 0 tests. | Default branch tip is an infrastructure smoke-test commit, not a release commit; exact patch duplicate of `c1efbeb`. |

## File/surface impact roll-up

| Surface | Main introducing/evolution commits | Current branch effect | Change-risk observation |
|---|---|---|---|
| Investment (I-1–I-4), portfolio/risk/charts | `3242281`, `a5ea522`, `40f703e`, `5cc/5924`, `d47b4cb`, `1d65e39`, `0855923` | Active Visual branch contains all changes. | Frequently modified hotspots: `app/page.tsx` (10 commits), `InvestmentWorkspace.tsx` (6), `portfolio-data.ts` (8), `globals.css` (8). Large coupled commits increase regression radius. |
| Sectoral Analytics / S-2/S-3 / charts | `a5ea522`, `40f703e`, `913/544`, `d47b4cb`, `1d65e39`, `0855923` | Active branch adds refreshed visuals/news/benchmark registry. | Default `origin/main` lacks Phase 3 + visual changes; filter/isolation behavior depends on branch chosen. |
| Market Intelligence / M-1–M-4 / earnings | `d47b4cb`, `1d65e39`, `0855923` | Active branch is the only line with the latest structure and styling. | Default branch stops before Phase 3 restructuring. README on default branch cannot substitute for code. |
| Health & Wellness / native HealthKit | `a5ea522`, duplicate mobile chains, `d47b4cb`, `1d65e39`, `0855923` | Active branch includes operational-date and visual changes. | Cross-language policy spans TS/Python/Swift; exact commit and test provenance matter. README currently contradicts AGENTS on 3 vs 4 columns. |
| APIs/data pipelines | `a5ea522`, `40f703e`, `5cc/5924`, `d47b4cb`, `1d65e39`, `0855923` | Kite, mail/content, earnings, sector, yfinance, Axis PDF, Health pipelines accumulated across mega-commits. | Default branch omits latest order, market-calendar, sector-news/quotes and visual-data wiring. |
| Flask/service/native delivery | `a5ea522`, duplicate mobile chains, `d47b4cb` | Service script resolves the currently checked-out repo path, so local runtime can differ solely by checkout. | No immutable build/release tag; current checkout determines canonical macOS service source. |
| Tests | All major product commits except generated Firecrawl and documentation commits | 23 test files current; package script includes build, rendered HTML, selected Node suites, and Python Health importer. | No CI workflow proves these checks for each ref; native test scripts are not part of default `npm test`. |
| Generated/private evidence | `a5ea522`, `5cc/5924`, `0c71858`, `1d65e39` | `.firecrawl`, screenshots/PDF/ZIP, build info/logs remain tracked. | Generated evidence is mixed with source and includes a credential-named file. |

## Commit quality and test-coverage assessment

| Control | Result | Evidence / interpretation |
|---|---|---|
| Atomicity | **Fail** | Four major commits span 46–111 source files; `0c71858` spans 2,004 generated files. Product, data, scripts, native, docs, logs and tests are often combined. |
| Descriptive messages | **Mixed** | `d47b4cb` and `1d65e39` have useful bodies. `Visual Overhaul`, `Firecrawl Integration`, and `Cursor: Apply local changes...` materially under-describe thousands of lines and several security/data surfaces. |
| Test co-change | **Mixed** | Later commits improve test breadth (15 in `d47b4cb`, 11 in `1d65e39`), but test file count is not execution evidence; generated and documentation commits have none. |
| Recorded verification | **Weak** | Only `d47b4cb` explicitly states commands ran. `1d65e39` saves build/startup logs, but freshness failed and the summary overstates readiness. `0855923` records no verification. |
| Continuous integration | **Absent** | No `.github/workflows`, GitLab CI, Jenkinsfile, or equivalent discovered. |
| Release traceability | **Absent** | No Git tags or release branch; default branch diverges from current product branch. |
| Commit authenticity | **Not established** | All reachable commits report `%G? = N` (no verifiable signature). Local GPG tooling/config also emitted verification warnings, but `N` establishes no signature is present. |
| Secret/generated-file controls | **Fail** | `.firecrawl` is ignored now but 2,015 paths remain tracked; credential-named `nse-cookies.txt` remains in every current line. No CI secret scan found. |
| Documentation consistency | **Fail** | AGENTS vs README H-3 column mismatch; committed audit summary contradicts logs and references absent artifacts. |

## Current working-tree state

| Check | Result |
|---|---|
| Branch/upstream | `Visual-Overhaul...origin/Visual-Overhaul`, 0 ahead / 0 behind |
| HEAD | `0855923f653a55b57bb1db7c5ac267de1c1cec8d` |
| Tracked modifications | None (`git diff-files` and `git diff-index HEAD` both exit 0) |
| Staged changes | None |
| Untracked files | None |
| Empty untracked directory | `apple-app/InvestmentDashboard.xcodeproj/project.xcworkspace/xcshareddata/` reported by `git clean -nd`; Git does not track empty directories |
| Other worktrees | None |
| Stashes | 1 redundant stash at `efda76f` |

## Recommended remediation sequence

| Priority | Action | Acceptance evidence |
|---:|---|---|
| 1 | Freeze branch movement and name the intended canonical release branch. Reconcile `origin/main` with `Visual-Overhaul` through a reviewed PR, not a blind merge. | One default branch contains the approved Phase 3 + Visual changes and README; `git rev-list --left-right --count canonical...origin/canonical` is `0 0`. |
| 2 | Treat `nse-cookies.txt` as potentially compromised until reviewed. Rotate/revoke if sensitive; decide whether coordinated history rewrite is required. | Secret scan clean; file absent from reachable release history or formally risk-accepted; rotation documented without exposing values. |
| 3 | Remove tracked `.firecrawl/node_modules`, cookies, build-info, transient logs/screenshots that are not intentional product artifacts. | `git ls-files '.firecrawl/**/node_modules/**'` returns 0; generated paths remain ignored; clean clone builds. |
| 4 | Replace contradictory audit artifacts with reproducible test/freshness output. | Audit verdict fails when any required source fails; all referenced deliverables exist; H-section count and health-direction contract agree. |
| 5 | Add required CI and release tagging. | CI runs lint, build, rendered HTML, domain Node/Python tests, and applicable native checks on PR/default branch; signed or otherwise protected release tag identifies deployed commit. |
| 6 | Archive then prune obsolete duplicate branch/stash refs after confirmation. | Patch-identical mapping retained in audit notes; `git branch -vv` has no `[gone]` refs; redundant stash removed recoverably. |
| 7 | Enforce commit/PR hygiene. | PR template records affected workspaces/data pipelines, tests run, source freshness limits, screenshots for UI, and migration/deployment consequences. |

## Reproducible evidence commands

```bash
git status --short --branch
git for-each-ref --format='%(refname)|%(objectname:short)|%(upstream:short)|%(upstream:track)|%(subject)' refs/heads refs/remotes refs/tags refs/stash
git rev-list --all --count
git log --all --graph --decorate --oneline --date-order
git rev-list --left-right --count Visual-Overhaul...origin/main
git merge-base --all Visual-Overhaul origin/main
git diff --shortstat origin/main...Visual-Overhaul
git diff --name-status origin/main...Visual-Overhaul
git stash list
git show -s --format='%H%n%P%n%T%n%s' refs/stash
git ls-files '.firecrawl/**' | wc -l
git ls-files '.firecrawl/**/node_modules/**' | wc -l
git log --all --oneline -- .firecrawl/fii-dii/nse-cookies.txt
git cat-file -s HEAD:.firecrawl/fii-dii/nse-cookies.txt
git diff-tree --root --no-commit-id --shortstat -r 0c71858
git log --all --format='%h|%G?|%s'
git tag -l
rg --files .github
rg -n 'three comparison-direction|four direction columns' AGENTS.md README.md
git show 1d65e39:artifacts/startup-verification.log
git show 1d65e39:artifacts/build-log.txt
git cat-file -e 1d65e39:artifacts/RCA-COMPREHENSIVE.md
```

## Evidence limits

- Remote refs were not fetched during this read-only lane; `origin/*` is the local remote-tracking snapshot last updated in the reflog on 2026-08-07.
- Historical commits were statically inspected; they were not checked out or built, so test status is based only on changed tests, commit text, and committed logs.
- The cookie file content and all private source snapshots were deliberately not inspected or reproduced.
- Runtime process state, localhost/Tailscale rendering, source freshness, and UI screenshots are covered by other audit lanes, not inferred from Git history here.
