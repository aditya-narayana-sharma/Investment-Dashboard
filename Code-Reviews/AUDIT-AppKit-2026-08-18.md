# 🔍 AUDIT — AppKit · BLOCK

**Scope:** DIFF mode · base `1137606c73091d7b696ca4ea13ad19f8062db0a6` (Visual-Overhaul) → head `7b3cf9d324a491cb52830fc2d50aa02cee9b12f2` · working tree clean · 198 files, +25651/−1925
**Coverage:** audited in full: license stack, LLM secrets/client/route, integrations API + public/settings split, workspace-routing, `page.tsx` shell, HealthWorkspace, Flask proxy/loopback, StratjiLicense/LocalSecrets, kite-order-funds, yfinance-search, layout/license-snapshot, dashboard refresh route, NativeActionBoard, license/integrations tests. Sampled: Intelligence/Investment/Sectors isolation, IntegrationsWorkspace, refresh-merge, NativeRefreshCoordinator, LlmAssistPanel, kite place_order, apple-app chrome. Excluded: binaries, Plans/, marketing docs, package-lock, CSS pixel review, full SwiftUI view trees.
**Assumptions:** Tailscale / `0.0.0.0` bind is a first-class path (`npm run flask` / `npm run remote` / `flask_gateway.py:759` / AGENTS.md Mac+Tailscale verification). Default gunicorn bind is `127.0.0.1`; the P0s fire whenever Flask is reachable off-box.

## Verdict: **BLOCK**

This branch is not mergeable. The AppKit shell, chrome-vs-workspace split, and Ultra-on-first-paint work are real — but the new license and LLM surfaces leak master-key and API-key material to anyone who can hit the Flask gateway. The loopback gate is Host-header based and is true for every Flask-proxied request. That is not an honor-system license; it is a secret-exfiltration bug on the documented remote URL.

Working code that ships the author master key in SSR JSON and Settings HTML is a net negative.

| Dimension | Score | Note |
|---|---|---|
| Correctness & safety | 4/10 | License PUT `author:true` writes the master key; Health Daily still required and displayed; splash treats cached Mail as success |
| Security | 2/10 | Two P0 secret leaks on the Flask/Tailscale path; unauthenticated LLM complete |
| Structural quality (judo) | 5/10 | Chrome view is the right cut; dual TS/Swift license+secrets stacks and a 953-line `page.tsx` remain |
| Layout & modularity | 5/10 | Routing module is findable; apple-app grew a second dashboard model graph |
| Tests | 5/10 | New suites exist; they encode the broken Host-only loopback check and keep Health Daily wired |
| Legibility & docs | 7/10 | Exhaustive switches, comments that match honor-system intent |
| Operability | 6/10 | Splash progress exists; cached/partial marked `ok` will mislead the operator |
| **Weighted** | **4.3/10** | |

## 🧨 Presumptive blockers

1. Security-sensitive paths (`/api/license`, `/api/integrations?secrets=1`, `/api/llm/complete`) have no real authorization on the Flask/Tailscale surface.
2. The new “loopback” primitive is Host-based and is true for every request Flask proxies to `127.0.0.1:3000`.
3. Master license material is not committed (good) but is returned on the public license type and rendered in Settings.

1000-line under→over: not tripped as a new crossing. `page.tsx` 749→953 is the near-miss. Already-over files grew (`IntelligenceWorkspace` 1066→1151, `InvestmentWorkspace` 1060→1103, `globals.css` 3692→4236).

## 🥋 Code-judo assessment

**JUDO AVAILABLE** — one local-operator gate; delete Host-based `isLoopbackRequest` and `PublicLicense.key`.

- Concepts today: Host-loopback + X-Forwarded-Host + public license key + unauthenticated PUT `author` + duplicate Swift license/secrets readers
- Proposed: Flask already has `_is_loopback_request()` on `remote_addr`. Inject a hop-authenticated `X-Stratji-Local-Operator: 1` only when the peer is loopback. Next trusts that header only from `127.0.0.1`. `PublicLicense` never carries `key`. Settings reads the key from a loopback-only, key-redacting endpoint or from AppKit Keychain. LLM complete and license writes require the same gate.
- What disappears: Host spoof, `x-forwarded-host` OR-logic, `author: boolean` on the public PUT body, master key in RSC/HTML
- Behavior preserved: yes for author-Mac Ultra SSR (tier/source only) · Effort: DO IN THIS PR IF FEASIBLE · Risk: low

Alternative considered and rejected: “v1 is honor-system so unauthenticated Ultra is fine.” Honor-system can unlock a tier. It cannot put the master key or LLM keys on the Tailscale URL.

## Findings

### [P0] Flask-proxied “loopback” is always true — LLM keys leak · `app/local-llm-secrets.ts:213` · CONFIRMED

**What:** `isLoopbackRequest` returns true if *any* of URL hostname, `X-Forwarded-Host`, or `Host` is loopback.

**Why it matters:** Flask binds remotely (`flask_gateway.py:759`, `scripts/start-remote-app.sh` writes `0.0.0.0`) and proxies to `http://127.0.0.1:3000`. It strips the client `Host` and sets `X-Forwarded-Host` to `request.host`, while urllib sets `Host: 127.0.0.1:3000`. Next therefore sees `Host: 127.0.0.1` on every proxied call. `hosts.some(isLoopbackHost)` is true for Tailscale and LAN.

Failure: `GET http://<tailnet>:5050/api/integrations?secrets=1` returns `settingsIntegrationsConfig` with `openaiApiKey` / `anthropicApiKey` / `geminiApiKey` / `cursorApiKey`. `PUT /api/integrations` does the same whenever the spoofed loopback check passes (`app/api/integrations/route.ts:27-51`).

The test only constructs `new Request("http://example.ts.net/...")` with no Flask `Host` (`tests/integrations-workspace.test.mjs:343-344`). That test is green and does not model production.

**Evidence:**

```213:219:app/local-llm-secrets.ts
export function isLoopbackRequest(request: Request): boolean {
  const hosts = [
    safeHostname(request.url),
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
  ];
  return hosts.some((host) => isLoopbackHost(host));
}
```

```351:362:flask_gateway.py
def _request_headers() -> dict[str, str]:
    ...
        if lowered in HOP_BY_HOP_HEADERS or lowered in {"host", "content-length", "accept-encoding"}:
            continue
    ...
    headers["X-Forwarded-Host"] = request.host
    headers["X-Forwarded-For"] = request.remote_addr or ""
```

**Remedy:** Delete Host-OR loopback. Use Flask `_is_loopback_request()` (`remote_addr`) and a hop-authenticated header, or gate `/api/integrations` in Flask before proxying. Never return raw keys over HTTP. Behavior preserved: yes for on-box Settings. Effort: DO NOW.

---

### [P0] Master license key is a public API field and an unauthenticated write · `app/license.ts:265` · CONFIRMED

**What:** Author resolution puts the master key on `PublicLicense.key`. `GET /api/license` has no gate. `PUT /api/license` accepts `{ author: true }`, then copies `readMasterLicenseKey()` onto disk.

**Why it matters:** `layout.tsx` SSRs `readDashboardLicense()` into `LicenseSnapshotProvider`. The key is in the RSC/hydration payload for every dashboard load. Settings renders it (`IntegrationsWorkspace.tsx:503`). A Tailscale client can `PUT {"author":true}` and become Ultra, then `GET` the master key.

`artifacts/private/license-master.txt` is gitignored and **not committed**. Auth0 plists are placeholders. The leak is runtime, not git — still a secret leak.

**Evidence:**

```265:276:app/license.ts
  if (authorMac) {
    const key = stored.key || master || null;
    return {
      tier: "ultra",
      ...
      key,
    };
  }
```

```151:171:app/license-server.ts
  if (typeof body.author === "boolean") {
    author = body.author;
  }
  ...
  if (keyIsMaster || author) {
    author = true;
    tier = "ultra";
    if (!key && master) key = master;
  }
```

```6:8:app/api/license/route.ts
export async function GET() {
  return Response.json(await readPublicLicense(), { headers: NO_STORE });
}
```

**Remedy:** `PublicLicense.key` is always `null` on GET/SSR. Drop `author` from the public PUT body. Settings shows the key only via a local-operator endpoint that redacts unless `remote_addr` is loopback. Behavior preserved: Ultra-on-first-paint via `tier`+`source` only. Effort: DO NOW.

---

### [P1] `/api/llm/complete` is unauthenticated and burns stored keys · `app/api/llm/complete/route.ts:26` · CONFIRMED

**What:** POST accepts any `task`+`prompt`+`context` and calls Anthropic/OpenAI/Gemini with the Mac’s keys. No loopback check, no session, no rate limit.

**Why it matters:** Anyone who can reach Flask can (1) spend the author’s API quota, (2) exfiltrate Mail/earnings/builder context in the prompt, (3) obtain a drafted StrategyTree. GET already discloses that keys are configured.

**Remedy:** Same local-operator gate as integrations. Cap prompt size. Do not accept arbitrary `context` from remote clients. Behavior preserved: yes on-box. Effort: DO NOW.

---

### [P1] H-2 still runs and displays Apple Notes “ Health Daily” · `scripts/content-digest-server.mjs:375` · CONFIRMED

**What:** AGENTS.md: Apple Notes Health Daily / v2 must not be run, displayed, or referenced. Health reconciliation is Health Shortcut → `health-overrides.json` + HealthKit export.

**Why it matters:** The digest still AppleScripts the exact note `" Health Daily"` as a **required** source. `HealthWorkspace` renders `healthNote.dailyOptimism` as Daily Optimism and parses the note summary as “Health Shortcut / Health Stats”. Missing the deprecated note fails a required source. Tests lock this wiring in (`tests/rendered-html.test.mjs:1353-1357`).

**Evidence:**

```371:376:scripts/content-digest-server.mjs
const healthNoteScript = String.raw`
...
const note = account.notes().find((candidate) => String(candidate.name()) === " Health Daily");
if (!note) throw new Error('The exact note " Health Daily" was not found');
```

```181:204:app/dashboard/HealthWorkspace.tsx
  const optimismText = healthNote?.dailyOptimism?.trim() || "";
  ...
      {optimismText ? <p className="health-optimism-text">{optimismText}</p> : null}
```

**Remedy:** Stop reading Notes. H-2 copy comes from Health Shortcut / HealthKit only. Drop `healthNote` from required digest sources. Update the rendered-html assertions that require `dailyOptimism` from Notes. Behavior preserved: no — this is the AGENTS contract. Effort: DO IN THIS PR IF FEASIBLE.

---

### [P1] Splash progress treats cached/partial Apple sources as success · `app/api/dashboard/refresh/route.ts:83` · CONFIRMED

**What:** Startup progress marks Calendar/Mail/Axis/Reminders/Podcasts `ok` when status is `live`, `verified`, `cached`, or `partial`.

**Why it matters:** AGENTS.md requires Mail/Podcasts `status=live` and forbids claiming a complete update when an audit row failed. Native splash-only refresh will show “received” for a stale mailbox. The operator then treats the dashboard as current.

```83:88:app/api/dashboard/refresh/route.ts
        const ok = source?.status === "live" || source?.status === "verified" || source?.status === "cached" || source?.status === "partial";
        writeStartupProgress({
          stage,
          state: ok ? "ok" : "failed",
```

**Remedy:** `ok` only for `live`/`verified`. Cached/partial → `failed` or a distinct `stale` stage the splash cannot paint as success. Behavior preserved: no — this is the refresh contract. Effort: DO NOW.

---

### [P2] `page.tsx` is one more god-shell away from 1000 lines · `app/page.tsx` 749→953 · CONFIRMED

**What:** The home client now owns chrome detection, license fetch, splash-vs-browser refresh, six workspaces, Integrations chrome, and Kite banner.

**Why it matters:** The next AppKit tweak will cross 1000. Refresh merge was extracted (good); the shell was not.

**Remedy:** Split `DashboardShell` (chrome/license/tabs) from `useDashboardRefresh` (already half-done in `dashboard-refresh-merge.ts`). Behavior preserved: yes. Effort: FOLLOW-UP if P0s slip; DO IN THIS PR IF FEASIBLE otherwise.

---

### [P2] Dual license and LLM-secret stacks · `app/license.ts` + `apple-app/Shared/StratjiLicense.swift` · CONFIRMED

**What:** Key parse, master-key file, author Ultra, and LLM env aliases are implemented twice (TS + Swift) and will drift. `parseLicenseKey` / `isMasterKey` already exist in both.

**Why it matters:** The next key-format change will unlock Ultra in one process and Basic in the other.

**Remedy:** One source of truth: the Next `/api/license` public snapshot (without `key`) for the webview; Swift reads tier/source only. Delete `repoMasterKey()` from the app once SSR is trusted. Behavior preserved: yes. Effort: FOLLOW-UP.

---

### [P2] iOS `NativeActionBoard` is a second action-board implementation · `apple-app/InvestmentDashboard/NativeActionBoard.swift:88` · CONFIRMED

**What:** AGENTS.md: `DailyKanbanBoard` is the only action-board implementation across all six workspaces. Mac Stratji.app uses WKWebView (web board). iOS native views ship a parallel three-lane board.

**Why it matters:** Completed-today state, catalog, and midnight reset will diverge from I-1.

**Remedy:** iOS workspace content should be the same WKWebView board, or this is an explicit AGENTS exception written down. Behavior preserved: yes if webview. Effort: FOLLOW-UP.

---

### [P3] Generated `tsconfig.tsbuildinfo` is in the branch diff · CONFIRMED

**What:** Build artifact in the change set. Not a secret. Do not merge generated TS build info.

**Remedy:** Revert the file; keep it gitignored. Effort: DO NOW.

## 📐 Metrics

| File | Before | After | Δ | Flag |
|---|---|---|---|---|
| `app/globals.css` | 3692 | 4236 | +544 | already >1000 |
| `app/visual-overhaul.css` | 1962 | 2087 | +125 | already >1000 |
| `tests/rendered-html.test.mjs` | 1421 | 1889 | +468 | already >1000 |
| `app/dashboard/IntelligenceWorkspace.tsx` | 1066 | 1151 | +85 | already >1000 |
| `app/dashboard/InvestmentWorkspace.tsx` | 1060 | 1103 | +43 | already >1000 |
| `app/page.tsx` | 749 | 953 | +204 | approaching 1000 |
| `app/integrations-types.ts` | 0 | 835 | +835 | new, yellow |
| `app/dashboard/IntegrationsWorkspace.tsx` | 0 | 770 | +770 | new, yellow |
| `apple-app/Shared/StratjiSessionModel.swift` | 0 | 668 | +668 | new, yellow |
| `flask_gateway.py` | 511 | 759 | +248 | yellow |

No new source file crossed 1000 from below.

## 🗺 Layout verdict

The repo is slightly easier to navigate for *web* chrome: `workspace-routing.ts` names Integrations as a chrome view, not a seventh workspace, and license/LLM modules have obvious homes. It is harder to navigate for *native*: `apple-app/` now has InvestmentDashboard + Stratji + Shared + Outline, with overlapping session/license/workspace models. That is a second map of the same product. Do not add more native dashboard models until the web shell is the single source.

AGENTS six-workspace / DailyKanbanBoard / S-2 isolation / MI unfiltered: **web path holds**. Integrations is chrome (`CHROME_VIEW_VALUES`), does not mount `DailyKanbanBoard`, and `selectedSectorIds` is not passed into Intelligence. Health is H-1/H-2/H-3 with the shared board on H-1.

## ✅ What's good here

- Integrations is explicitly not a seventh workspace; routing and tests protect that cut.
- Market Intelligence is not given `selectedSectorIds`; isolation tests still assert no `sector-dimmed` in MI.
- `license-master.txt` / `integrations-config.json` stay under `artifacts/private/` (gitignored). Auth0 plists are `YOUR_*` placeholders. `.env.example` is empty.
- Snapshot retain/merge was pulled out of `page.tsx` into `dashboard-refresh-merge.ts` instead of growing more inline merge branches.
- Exhaustive `switch`/`never` on license tiers, chrome views, and LLM providers.

## ❓ Open questions for the author

- Is `npm run flask` / Tailscale bind required for this merge, or is localhost-only an acceptable v1? (AGENTS.md still requires both URLs.)
- Is displaying Notes “Daily Optimism” an intentional temporary bridge, or an accident of the H-2 restore?

## 📋 Follow-up tickets suggested

- Single local-operator request primitive (Flask `remote_addr` → Next) — replace Host-loopback everywhere
- Delete Notes Health Daily from digest + H-2; Health Shortcut only
- Collapse Swift license/secrets to consume `/api/license` public snapshot
- Split `page.tsx` before it crosses 1000
- iOS action board: WKWebView `DailyKanbanBoard` or an AGENTS exception
