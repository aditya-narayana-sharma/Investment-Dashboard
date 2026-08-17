#!/usr/bin/env bash
# Create Auth0 Native apps for Stratji (macOS) and InvestmentDashboard (iOS).
# Does not print client IDs. Writes Auth0.plist in the Apple app folders.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MAC_BUNDLE="com.adityasharma.Stratji"
IOS_BUNDLE="com.adityasharma.InvestmentDashboard"
AUTHOR_EMAIL="${AUTH0_AUTHOR_EMAIL:-YOUR_AUTHOR_EMAIL}"

if ! command -v auth0 >/dev/null 2>&1; then
  printf 'Install the Auth0 CLI first:\n  brew install auth0/auth0-cli/auth0\n  auth0 login\n' >&2
  exit 1
fi

if ! auth0 tenants list --csv --no-input >/dev/null 2>&1; then
  printf 'Auth0 CLI is not logged in. Run:\n  auth0 login\nthen re-run this script.\n' >&2
  exit 1
fi

umask 077
TENANTS="$(mktemp -t auth0-tenants)"
auth0 tenants list --csv --no-input >"$TENANTS" 2>&1
DOMAIN="$(awk -F, '/^→/{gsub(/→/, "", $1); gsub(/^ +| +$/, "", $1); print $1; exit}' "$TENANTS")"
if [[ -z "$DOMAIN" ]]; then
  DOMAIN="$(awk -F, 'NR==2 {print $1; exit}' "$TENANTS")"
fi
rm -f "$TENANTS"
if [[ -z "$DOMAIN" ]]; then
  printf 'Could not detect the active Auth0 tenant domain.\n' >&2
  exit 1
fi

MAC_CALLBACK="${MAC_BUNDLE}://${DOMAIN}/macos/${MAC_BUNDLE}/callback"
IOS_IOS_CALLBACK="${IOS_BUNDLE}://${DOMAIN}/ios/${IOS_BUNDLE}/callback"
IOS_MAC_CALLBACK="${IOS_BUNDLE}://${DOMAIN}/macos/${IOS_BUNDLE}/callback"

write_plist() {
  local path="$1"
  local client_id="$2"
  cat >"$path" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>ClientId</key>
	<string>${client_id}</string>
	<key>Domain</key>
	<string>${DOMAIN}</string>
	<key>AuthorEmail</key>
	<string>${AUTHOR_EMAIL}</string>
</dict>
</plist>
EOF
}

MAC_OUT="$(mktemp -t auth0-macos-app)"
auth0 apps create \
  --name "Stratji macOS" \
  --type native \
  --auth-method none \
  --callbacks "$MAC_CALLBACK" \
  --logout-urls "$MAC_CALLBACK" \
  --json \
  --no-input >"$MAC_OUT" 2>&1
MAC_CLIENT_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("client_id",""))' "$MAC_OUT")"
rm -f "$MAC_OUT"
if [[ -z "$MAC_CLIENT_ID" ]]; then
  printf 'Failed to create the macOS Native Auth0 application.\n' >&2
  exit 1
fi
write_plist "$ROOT_DIR/apple-app/Stratji/Auth0.plist" "$MAC_CLIENT_ID"

IOS_OUT="$(mktemp -t auth0-ios-app)"
auth0 apps create \
  --name "Stratji iOS" \
  --type native \
  --auth-method none \
  --callbacks "${IOS_IOS_CALLBACK},${IOS_MAC_CALLBACK}" \
  --logout-urls "${IOS_IOS_CALLBACK},${IOS_MAC_CALLBACK}" \
  --json \
  --no-input >"$IOS_OUT" 2>&1
IOS_CLIENT_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("client_id",""))' "$IOS_OUT")"
rm -f "$IOS_OUT"
if [[ -z "$IOS_CLIENT_ID" ]]; then
  printf 'Failed to create the iOS Native Auth0 application.\n' >&2
  exit 1
fi
write_plist "$ROOT_DIR/apple-app/InvestmentDashboard/Auth0.plist" "$IOS_CLIENT_ID"

# Refresh token rotation + offline access (native public clients).
auth0 api patch "clients/${MAC_CLIENT_ID}" --data '{"refresh_token":{"rotation_type":"rotating","expiration_type":"expiring","leeway":0,"token_lifetime":2592000,"infinite_token_lifetime":false,"idle_token_lifetime":1296000,"infinite_idle_token_lifetime":false},"oidc_conformant":true}' --no-input >/dev/null 2>&1 || true
auth0 api patch "clients/${IOS_CLIENT_ID}" --data '{"refresh_token":{"rotation_type":"rotating","expiration_type":"expiring","leeway":0,"token_lifetime":2592000,"infinite_token_lifetime":false,"idle_token_lifetime":1296000,"infinite_idle_token_lifetime":false},"oidc_conformant":true}' --no-input >/dev/null 2>&1 || true

printf 'Wrote Auth0.plist for Stratji macOS and InvestmentDashboard iOS.\n'
printf 'Set AuthorEmail in those plists if AUTH0_AUTHOR_EMAIL was not exported.\n'
printf 'Optional Regular Web Application for loopback Vinext/Flask:\n'
printf '  auth0 apps create --name "Stratji Dashboard" --type regular \\\n'
printf '    --callbacks "http://127.0.0.1:5050/_auth/callback,http://127.0.0.1:3000/auth/callback,http://localhost:5050/_auth/callback,http://localhost:3000/auth/callback" \\\n'
printf '    --logout-urls "http://127.0.0.1:5050,http://127.0.0.1:3000,http://localhost:5050,http://localhost:3000" \\\n'
printf '    --origins "http://127.0.0.1:5050,http://127.0.0.1:3000,http://localhost:5050,http://localhost:3000"\n'
printf 'Copy AUTH0_DOMAIN / AUTH0_CLIENT_ID / AUTH0_CLIENT_SECRET into artifacts/private/auth0.env (gitignored).\n'
