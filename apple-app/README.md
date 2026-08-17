# Stratji Apple apps

This folder contains two native clients that share `InvestmentDashboard.xcodeproj`:

| Target | Platform | Role |
| --- | --- | --- |
| **Stratji** | macOS AppKit + SwiftUI | Native sidebar client. Flask on `127.0.0.1:5050` is the data plane. WKWebView is an optional inspector only. |
| **InvestmentDashboard** | iOS | Native SwiftUI client: six workspaces, action board, holdings JSON, HealthKit sync, Tailscale settings. WKWebView is an optional debug sheet only. |

Do not treat the iPhone as a second data plane. The Mac remains the private host for Kite, Mail, Podcasts, Calendar, Reminders, Notes, earnings verification, sector snapshots, PDF generation, and stored Health snapshots.

Wired kits:

- **AppKit** — Stratji window, menus, settings, and service supervisor. SwiftUI hosts the native workspaces.
- **HealthKit** — iOS `InvestmentDashboard` only (`HealthKitSync.swift`).
- **EventKit** — Stratji.app Settings Connect requests Calendar/Reminders full access. Reminder write-back still uses `scripts/complete-reminder-eventkit.swift` from the content-digest server.

Not wired (do not add): ARKit, DriverKit, HomeKit, LiveKit.

The Safari PWA and Chrome `--app` Dock wrapper remain fallbacks. They are not the HealthKit-capable product.

## Mac AppKit (Stratji)

### Prerequisites

- macOS 14+
- **Full Xcode** (not only Command Line Tools) to build Stratji.app. These scripts look for `/Applications/Xcode.app` and `/Applications/DevApps/Xcode.app`. They set `DEVELOPER_DIR` for the build process only; they do **not** change system `xcode-select`.
- An Apple Development signing identity is preferred if one is already in Keychain. Otherwise the installer ad-hoc signs (`codesign --sign -`) for local Gatekeeper.
- Node.js 22.13+
- Portfolio Intelligence / Stratji Flask gateway on `127.0.0.1:5050`

### Prepare the Mac data plane

From the repository root:

```bash
npm install
npm run lint
npm run build
npm run flask:setup
npm run flask:service
```

After Flask is reachable, every start runs `scripts/refresh-dashboard-data.sh`. Inspect:

```text
~/Library/Logs/PortfolioIntelligence/startup-refresh.log
```

Do not treat a browser or WebView reload as a successful complete refresh. The audit requires:

- Kite `status=live`
- Mail and Podcasts `status=live`
- earnings `status=verified`
- Health `status=live` through the operational target date: D from 8:00 PM through 1:59 AM, otherwise D-1
- every sector `status=live`

Sector snapshots load via yfinance and must report `status=live` when fresh quotes succeed. Kite paid market-data is optional for Sectoral Analytics; do not require it for the sector audit row.

### Build and install Stratji.app

One-line user path after the data plane is running:

```bash
npm run desktop
```

That is `scripts/install-desktop-app.sh` → `scripts/install-stratji-macos.sh`. It:

1. Ensures Flask is set up and healthy at `http://127.0.0.1:5050/_flask/health` (starts it if needed).
2. Writes the repo path to `~/Library/Application Support/Stratji/repo-root` so the app can re-start Flask later.
3. Builds the **Stratji** macOS scheme with `xcodebuild -configuration Release`.
4. Code-signs with the local Apple Development identity when present, otherwise ad-hoc.
5. Copies `Stratji.app` to `~/Applications/Stratji.app` (and `/Applications/Stratji.app` when that folder is writable).
6. Pins it to the Dock and launches it.

If Xcode is missing or the native build fails, **the command fails** and prints the next step (install Xcode, open the Stratji scheme, select your team). It does **not** silently install Chrome.

From Xcode:

```bash
open apple-app/InvestmentDashboard.xcodeproj
```

Select scheme **Stratji** (My Mac) and press Run. The window title is **Stratji**. The main UI is native AppKit + SwiftUI (sidebar, loading bar, action board, holdings). WKWebView is **Refresh → Inspect Data Plane** only. Flask still serves `http://127.0.0.1:5050/` as the data plane (override with `STRATJI_DASHBOARD_URL` or `PORTFOLIO_DESKTOP_URL`).

Command line (scripts already pass `DEVELOPER_DIR` when Xcode is not the active xcode-select):

```bash
export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
# or: export DEVELOPER_DIR="/Applications/DevApps/Xcode.app/Contents/Developer"
"$DEVELOPER_DIR/usr/bin/xcodebuild" \
  -project apple-app/InvestmentDashboard.xcodeproj \
  -scheme Stratji \
  -configuration Release \
  -destination 'platform=macOS' \
  -derivedDataPath apple-app/DerivedData \
  build
```

The AppKit app is unsandboxed. It does **not** execute Git scripts from `~/Documents` (macOS TCC returns `Operation not permitted`). Instead it writes `~/Library/Application Support/Stratji/run-service.sh`, registers `~/Library/LaunchAgents/com.adityasharma.portfolio-intelligence.plist`, and `launchctl kickstart`s that job. The repo path is persisted in UserDefaults and `~/Library/Application Support/Stratji/repo-root` by `npm run desktop`. Reload with **Refresh → Reload All** (`⌘R`). The loading bar runs until the startup audit finishes (Kite/sectors live, Mail/Podcasts live, earnings verified, Health live).

### Chrome `--app` fallback (not the product)

Chrome is an explicit opt-in only. Do not treat it as the Stratji install.

```bash
npm run desktop:chrome
# or: ./scripts/install-desktop-app.sh --chrome
```

The wrapper still starts Flask first, then opens `http://127.0.0.1:5050/`. It is not AppKit and does not own WKWebView.

## iPhone (InvestmentDashboard)

The Xcode **InvestmentDashboard** target is a native SwiftUI iPhone client. The Mac remains the private data plane. The iPhone discovers that Mac on the same Wi-Fi (Bonjour `_stratji._tcp`), pairs with `npm run iphone:pair`, then loads JSON and renders native workspaces. It is **not** a Tailscale browser and **not** a full-screen WKWebView.

Native shell:

- Compact workspace bar on iPhone and `NavigationSplitView` on iPad for the six workspaces: Portfolio Overview, Sectoral Analytics, Market Intelligence, Health & Wellness, Algorithm Builder, and Strategies.
- Determinate loading bar until `GET /api/dashboard/freshness` and `GET /api/dashboard/refresh` complete.
- Native three-lane action board (To Do Today / Monitor / Completed Today).
- Holdings, digests, earnings, Health tiles, and strategy names from Mac JSON APIs.
- Settings for the LAN address, HealthKit pairing (`npm run iphone:pair`), and read-only Integrations status.
- Offline screen with last success time when the Mac is down. Cached rows are labeled Cached or Stale, never Live.
- Optional **Inspect data plane** sheet (WKWebView) from Settings. Not the home screen.

HealthKit operational-day upload stays native (`HealthKitSync.swift`).

### Prerequisites

- macOS with Xcode supporting iOS 17
- An Apple development team configured for the **InvestmentDashboard** target
- HealthKit capability enabled for `com.adityasharma.InvestmentDashboard`
- iPhone and Mac on the same Wi-Fi
- Stratji built and running on the Mac

### Enable private iPhone access

Run:

```bash
npm run remote
```

This binds Flask to the LAN (`0.0.0.0:5050`) and advertises `Stratji._stratji._tcp.local`. The iPhone app discovers that Mac during onboarding. You can also paste `http://<lan-ip>:5050/` in Connection & Health settings.

The Mac Stratji app talks to localhost. The iPhone talks to the Mac over the local network with a pairing token. Tailscale is not part of this path.

Non-loopback Flask routes require that pairing token. Generate it with `npm run iphone:pair`.

### Install on a physical iPhone

Connect and trust the iPhone. Then:

```bash
npm run iphone:native
```

That is `scripts/build-and-install-iphone-app.sh`. It:

1. Uses full Xcode via `DEVELOPER_DIR` (same lookup as the Mac installer).
2. Auto-detects a connected iPhone, or uses `PORTFOLIO_IOS_DEVICE_ID`.
3. Builds a signed Release `InvestmentDashboard.app`.
4. Always copies the artifact to `apple-app/build/InvestmentDashboard.app`.
5. Installs with `devicectl` when a physical device is available.

If no phone is connected, the Release `.app` is still produced. This script does **not** upload to TestFlight. Install from Xcode: open `apple-app/InvestmentDashboard.xcodeproj`, select the **InvestmentDashboard** target, choose your Apple Development team, pick the iPhone, press Run.

Override the device:

```bash
PORTFOLIO_IOS_DEVICE_ID="<device-id>" npm run iphone:native
```

UDID from `xcrun devicectl list devices` (with `DEVELOPER_DIR` set if `xcode-select` still points at Command Line Tools).

After installation, complete onboarding:

   - pick the discovered Mac or enter its LAN URL,
   - generate a HealthKit pairing code on the Mac,
   - enter the code on iPhone,
   - grant Health read access.

## HealthKit pairing

Generate the one-time pairing code on the Mac (not inside Stratji.app):

```bash
npm run iphone:pair
```

The code expires after five minutes and is single-use. The resulting upload token is stored in the iPhone Keychain. The server stores only its SHA-256 hash in `artifacts/private/health-pairings.json`.

The iPhone reads the Health operational target and computes 7-day and 30-day comparisons ending on that date. The target rolls forward at 8:00 PM IST and remains anchored to the prior evening from midnight through 1:59 AM.

- Activity
- Sleep
- Heart
- Respiratory
- Mobility
- Nutrition

Body Measurements and Hearing are excluded. Missing values are not inferred.

The app uploads the validated aggregate to `POST /_health/snapshot`. Raw HealthKit samples stay on the iPhone.

## EventKit (Calendar, Reminders, write-back)

Stratji Settings **Connect** for Calendar and Reminders calls `EKEventStore.requestFullAccessToEvents` / `requestFullAccessToReminders` so the TCC prompt is owned by Stratji.app. After full access, the dashboard still refreshes Calendar and Reminders through the existing content-digest pipelines (SQLite + EventKit helper). Reminder completion remains `scripts/complete-reminder-eventkit.swift` with confirmation. Mail, Podcasts, and Notes Connect use Apple Events (`AEDeterminePermissionToAutomateTarget` / `NSAppleScript`) under `NSAppleEventsUsageDescription`.

## Workspaces

The native iPhone workspace selector is a SwiftUI `TabView` / `NavigationSplitView` for six workspaces. Integrations are Settings only. Optional **Inspect data plane** still deep-links the debug WebView to:

- `/?view=investment`
- `/?view=sectors`
- `/?view=intelligence`
- `/?view=health`
- `/?view=builder` (Algorithm Builder)
- `/?view=strategies`

The Mac Stratji window is a native client of the Flask data plane. The web application at `http://127.0.0.1:5050/` remains the optional browser console and inspector target.

Alias `/?view=market-intelligence` maps to Market Intelligence.
Alias `/?view=algorithm-canvas` maps to Algorithm Canvas.
Alias `/?view=strategy-library` maps to Strategies.

Sectoral and Market Intelligence invariants remain mandatory:

- S-2 industry selection may affect S-2 only.
- Market Intelligence remains complete and unfiltered.
- M-3 is the sole complete earnings calendar.
- The S-3 Decision Framework selector is local to its own cards.

## Offline and failure behavior

When the Mac is unavailable, the iPhone shell:

- names the connection problem,
- shows the last successful load time,
- allows the last rendered dashboard to remain visible,
- offers retry and connection settings.

It does not claim cached content is live. The Mac must be awake for live Kite or Apple-source refreshes.

Stratji.app shows a native status strip while Flask is starting or unreachable, then loads the WebView when `GET /_flask/health` succeeds.

## Report sharing

The iPhone Report control opens the existing report export flow. PDF generation still runs on the Mac PDF helper. When WebKit receives the PDF download, the iPhone presents the native share sheet. On Mac, Stratji reveals the downloaded file in Finder.

## Verification

Run repository checks:

```bash
npm run lint
npm run build
node --test tests/rendered-html.test.mjs
node --experimental-strip-types --test tests/freshness-and-isolation.test.mjs
python -m unittest tests/test_flask_gateway.py
```

On macOS, run native checks:

```bash
xcodebuild \
  -project apple-app/InvestmentDashboard.xcodeproj \
  -scheme Stratji \
  -destination 'platform=macOS' \
  build

xcodebuild \
  -project apple-app/InvestmentDashboard.xcodeproj \
  -scheme InvestmentDashboard \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  test
```

Physical-device acceptance must cover:

1. Fresh install and onboarding
2. Same-Wi-Fi Bonjour discovery and manual LAN address
3. Investment, Sectoral, Market Intelligence, Health, Algorithm Builder, and Strategies. Integrations live in Settings, not a seventh workspace.
4. Operational-day HealthKit upload and visible sync status
5. Foreground and manual refresh
6. Mac unavailable and recovery
7. Kite daily auth boundary
8. S-2 / Market Intelligence / S-3 isolation
9. Report download and share
10. Dynamic Type, portrait, and landscape

Mac AppKit acceptance:

1. `npm run desktop` launches `~/Applications/Stratji.app`
2. Window title is Stratji, with a native sidebar and loading bar
3. Workspace content appears only after the startup refresh audit; WKWebView is Inspect Data Plane only
4. Quitting Flask and using Reload All starts the service again when the repo path is known
5. Chrome fallback is explicit only: `npm run desktop:chrome`

## TestFlight release checklist

1. Increment `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` on **InvestmentDashboard**.
2. Confirm the bundle identifier and Apple development team.
3. Validate `PrivacyInfo.xcprivacy` and App Store privacy answers.
4. Archive a Release build.
5. Run the complete startup audit against the intended Mac.
6. Install the TestFlight build on a clean device.
7. Repeat the physical-device acceptance checklist.
8. Do not publish publicly: the app requires a user-controlled Mac on the same trusted Wi-Fi.

Stratji.app is a local workstation binary (`com.adityasharma.Stratji`). It is not the TestFlight iPhone product.

## Security

- Broker and Apple Mail credentials never belong in the iPhone binary or Stratji.app.
- Health upload tokens are per-install and stored in Keychain.
- Pairing codes are short-lived and generated only from localhost or with the Mac admin token.
- LAN HTTPS/HTTP plus a pairing token is the iPhone connection; the Mac AppKit app uses loopback.
- Author login is Auth0 Universal Login (Auth0.swift). Bundle IDs: `com.adityasharma.Stratji` and `com.adityasharma.InvestmentDashboard`. Callbacks use `{bundle}://{domain}/{ios|macos}/{bundle}/callback`.
- After native login, the app may POST tokens to Flask `/_auth/session` so Inspect Data Plane / loopback can carry a `stratji_author` cookie. Health pairing tokens stay separate.
- Private artifacts and token registries remain ignored by Git.
