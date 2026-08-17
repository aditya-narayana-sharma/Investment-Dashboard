# Stratji License and Distribution

**Status:** TARGET for P7 public launch. AS-BUILT repo is a private personal dashboard.

## 1. Intended model

- **GitHub:** source-available. Users can read and build. Commercial use of the product brand and installer requires a yearly license.
- **stratji.co.in:** marketing, docs, Razorpay yearly checkout, license portal, ToS / Privacy / disclaimer.
- **Cloud contents:** marketing + signed license JWT **only**.

## 2. What never goes to cloud or git

- Kite API secrets and access tokens
- Mail bodies and research PDFs
- Apple Health XML/ZIP and HealthKit samples
- Reminder / note contents
- Claude / ChatGPT keys
- `artifacts/private/**`

## 3. Bundle and identity (AS-BUILT → TARGET)

| Surface | AS-BUILT | TARGET |
| --- | --- | --- |
| iOS / existing hybrid | `com.adityasharma.InvestmentDashboard` | Rebrand Stratji; TestFlight remains private (Mac + tailnet required) |
| Chrome Dock wrapper | `com.adityasharma.portfolio-intelligence.desktop` | Fallback only |
| AppKit desktop | — | `com.stratji.macos` (or keep adityasharma until P7) display name **Stratji** |

## 4. Installer path (TARGET)

1. `scripts/install-stratji.sh` (P1)
2. Notarized `.pkg` (P7)
3. Native Stratji.app starts Flask and loads `http://127.0.0.1:5050/`

## 5. v1 honor + key file (AS-BUILT)

- **This author’s Mac** writes `~/Library/Application Support/Stratji/license.json` on first Stratji launch (and on Settings save) with **Ultra** and a stable **master key** (`stratji-ultra-master-…`). That file is local, gitignored, and never committed.
- **Downstream GitHub clones** stay **Basic** until they paste a paid key (`stratji-pro-…` / `stratji-ultra-…`). v1 is an honor + key file, not Stripe or Auth0.
- Other people must buy a key for Pro/Ultra. Do not copy the author’s master key into the repo or installer.

## 6. License files to add at P7

LICENSE, CODE_OF_CONDUCT, SECURITY, plus this pack already in `docs/stratji/`.
