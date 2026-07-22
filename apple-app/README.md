# Portfolio Intelligence iPhone App

The Xcode project is the primary iPhone client for the private Portfolio Intelligence dashboard. It is an enhanced hybrid app:

- SwiftUI owns onboarding, workspace navigation, Tailscale/LAN connection state, startup-audit status, HealthKit sync, offline recovery, settings, and report sharing.
- One persistent `WKWebView` renders the complete Investment, Sectoral Analytics, and Health & Wellness workspaces.
- The Mac remains the private data plane for Kite, Mail, Podcasts, Calendar, Reminders, Notes, earnings verification, sector snapshots, PDF generation, and stored Health snapshots.

The Safari PWA remains a fallback. It is not the primary HealthKit-capable product.

## Prerequisites

- macOS with Xcode supporting iOS 17
- An Apple development team configured for the app target
- HealthKit capability enabled for `com.adityasharma.InvestmentDashboard`
- Tailscale installed and signed into the same tailnet on Mac and iPhone
- Portfolio Intelligence built and running on the Mac

## Prepare the Mac

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
- Health `status=live` through D-1
- every sector `status=live`

If paid Kite market data is unavailable, sector snapshots correctly remain `public_delayed`; the app must not label them live.

## Enable private iPhone access

Run:

```bash
npm run remote
```

This configures Tailscale Serve for the Flask gateway. The native app defaults to:

```text
https://adis-mbp.tailfd8d7f.ts.net/
```

You can change the address during onboarding or in Connection & Health settings.

## Install on a physical iPhone

1. Open `apple-app/InvestmentDashboard.xcodeproj`.
2. Select the `InvestmentDashboard` target.
3. Choose your Apple development team.
4. Confirm the HealthKit entitlement and privacy manifest are present.
5. Select the physical iPhone and Run.
6. Complete onboarding:
   - verify the Mac Tailscale URL,
   - generate a HealthKit pairing code on the Mac,
   - enter the code on iPhone,
   - grant Health read access.

Generate the one-time pairing code:

```bash
npm run iphone:pair
```

The code expires after five minutes and is single-use. The resulting upload token is stored in the iPhone Keychain. The server stores only its SHA-256 hash in `artifacts/private/health-pairings.json`.

## Workspaces

The native workspace selector routes the persistent WebView to:

- `/?view=investment`
- `/?view=sectors`
- `/?view=health`

The web application remains responsible for detailed section state and rendering.

Sectoral invariants remain mandatory:

- S-2 industry selection may affect S-2 only.
- S-3 remains complete and unfiltered.
- S-4 keeps all earnings visible, enabled, and selectable.
- The S-4 Decision Framework selector is local to its own cards.

## HealthKit contract

The iPhone reads the latest completed day and computes 7-day and 30-day comparisons for:

- Activity
- Sleep
- Heart
- Respiratory
- Mobility
- Nutrition

Body Measurements and Hearing are excluded. Missing values are not inferred.

The app uploads the validated aggregate to `POST /_health/snapshot`. Raw HealthKit samples stay on the iPhone.

## Offline and failure behavior

When the Mac or Tailscale is unavailable, the native shell:

- names the connection problem,
- shows the last successful load time,
- allows the last rendered dashboard to remain visible,
- offers retry and connection settings.

It does not claim cached content is live. The Mac must be awake for live Kite or Apple-source refreshes.

## Report sharing

The native Report control opens the existing report export flow. PDF generation still runs on the Mac PDF helper. When WebKit receives the PDF download, the iPhone presents the native share sheet.

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
  -scheme InvestmentDashboard \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  test
```

Physical-device acceptance must cover:

1. Fresh install and onboarding
2. Tailscale and same-Wi-Fi fallback
3. Investment, Sectoral, and Health workspace routing
4. HealthKit D-1 upload and visible sync status
5. Foreground and manual refresh
6. Mac unavailable and recovery
7. Kite daily auth boundary
8. S-2/S-3/S-4 isolation
9. Report download and share
10. Dynamic Type, portrait, and landscape

## TestFlight release checklist

1. Increment `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION`.
2. Confirm the bundle identifier and Apple development team.
3. Validate `PrivacyInfo.xcprivacy` and App Store privacy answers.
4. Archive a Release build.
5. Run the complete startup audit against the intended Mac.
6. Install the TestFlight build on a clean device.
7. Repeat the physical-device acceptance checklist.
8. Do not publish publicly: the app requires a user-controlled Mac and private tailnet.

## Security

- Broker and Apple Mail credentials never belong in the iPhone binary.
- Health upload tokens are per-install and stored in Keychain.
- Pairing codes are short-lived and generated only from localhost or with the Mac admin token.
- Tailscale HTTPS is the primary connection.
- Private artifacts and token registries remain ignored by Git.
