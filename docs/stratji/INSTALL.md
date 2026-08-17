# Install Stratji (any Mac user)

**Status:** clone path for a local Mac app. Tailscale and Auth0 are not required.

## 1. Requirements

- macOS 14+ for Stratji.app (AppKit target)
- Node.js 22.13+
- **Full Xcode** to build Stratji.app. Command Line Tools alone cannot run `xcodebuild` for the Stratji scheme.
- These installers do **not** change system `xcode-select`. They look for `/Applications/Xcode.app`, `/Applications/Xcode-beta.app`, and `/Applications/DevApps/Xcode.app`, then set `DEVELOPER_DIR` for that process.
- An Apple Development identity in Keychain is used when present. Otherwise Stratji.app is ad-hoc signed for local open.
- Full Disk Access for Stratji.app if the checkout lives under `~/Documents`.

## 2. Clone install

```bash
git clone <this-repo>
cd "Investment Dashboard"
npm install
npm run flask:setup
npm run lint
npm run build
npm run flask:service
npm run desktop
```

Flask health: `http://127.0.0.1:5050/_flask/health`

After Flask is reachable, every start runs `scripts/refresh-dashboard-data.sh`. Inspect:

```text
~/Library/Logs/PortfolioIntelligence/startup-refresh.log
```

Do not treat a browser refresh as a complete data refresh.

## 3. Desktop app (Stratji.app)

```bash
npm run desktop
```

That builds Release **Stratji**, signs it, and copies it to `~/Applications/Stratji.app`. Flask on `http://127.0.0.1:5050/` is the data plane.

Unlock uses **Touch ID or your Mac login password** for this launch. **Stratji → Lock** locks the session. Auth0.plist placeholders do not block launch.

Sidebar toggle is the standard toolbar **sidebar.leading** icon (Hide Sidebar / Show Sidebar). View menu keeps the same action.

## 4. First-run integrations

Open **Stratji → Settings**. Set **your** paths:

- Kite MCP project directory (`KITE_MCP_PROJECT_DIR`)
- Newsletters + research mailbox names
- Reminder list names
- Health ZIP folder

Do not commit `artifacts/private/integrations-config.json` or `~/Library/Application Support/Stratji/license.json`.

## 5. Licenses (Basic / Pro / Ultra)

v1 is an honor + key file, not Razorpay/Stripe and not stratji.co.in.

| Tier | Unlocks |
| --- | --- |
| Basic | Investment I-1–I-4, Sectors S-1/S-2, Settings wizard |
| Pro | + Market Intelligence, Health, S-3, PDF brief |
| Ultra | + Algorithm Canvas, Strategies, Streak checklist |

Customers paste `stratji-pro-<token>` or `stratji-ultra-<token>` in Settings, or set `STRATJI_LICENSE_KEY`. Publishers can set the operator tier on their own Mac. Selling later: issue those prefixed keys privately; a signed JWT is TARGET.

## 6. Kite

See [INTEGRATIONS.md](INTEGRATIONS.md) §3A. Authenticate in the browser when `auth_required`. Daily ~06:00 IST token boundary.

## 7. Permissions

- Mail / Reminders / Calendar: macOS TCC + Full Disk Access as needed
- Health: validate ZIP contains `apple_health_export/export.xml`
- Network: loopback Flask on `127.0.0.1:5050`

## 8. Uninstall

```bash
npm run flask:stop
rm -rf ~/Applications/Stratji.app /Applications/Stratji.app
```
