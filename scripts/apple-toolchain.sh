#!/usr/bin/env bash
# Resolve full Xcode without changing the system xcode-select path.
# Source this file; do not execute it.
# shellcheck shell=bash

apple_toolchain_candidates() {
  printf '%s\n' \
    "${DEVELOPER_DIR:-}" \
    "/Applications/Xcode.app/Contents/Developer" \
    "/Applications/Xcode-beta.app/Contents/Developer" \
    "/Applications/DevApps/Xcode.app/Contents/Developer" \
    "/Applications/DevApps/Xcode-beta.app/Contents/Developer" \
    "$HOME/Applications/Xcode.app/Contents/Developer" \
    "$HOME/Applications/Xcode-beta.app/Contents/Developer"
  mdfind "kMDItemCFBundleIdentifier == 'com.apple.dt.Xcode'" 2>/dev/null \
    | sed 's|$|/Contents/Developer|' || true
  local selected
  selected="$(xcode-select -p 2>/dev/null || true)"
  if [[ -n "$selected" && "$selected" != *CommandLineTools* ]]; then
    printf '%s\n' "$selected"
  fi
}

resolve_apple_toolchain() {
  local candidate xcodebuild_bin
  while IFS= read -r candidate; do
    [[ -z "$candidate" ]] && continue
    xcodebuild_bin="$candidate/usr/bin/xcodebuild"
    if [[ -x "$xcodebuild_bin" ]]; then
      export DEVELOPER_DIR="$candidate"
      export XCODEBUILD="$xcodebuild_bin"
      return 0
    fi
  done < <(apple_toolchain_candidates | awk 'NF && !seen[$0]++')

  unset XCODEBUILD
  return 1
}

apple_xcodebuild() {
  if [[ -z "${XCODEBUILD:-}" ]]; then
    resolve_apple_toolchain || return 1
  fi
  "$XCODEBUILD" "$@"
}

resolve_codesign_identity() {
  if [[ -n "${STRATJI_CODESIGN_IDENTITY:-}" ]]; then
    printf '%s\n' "$STRATJI_CODESIGN_IDENTITY"
    return 0
  fi

  local names line
  names="$(security find-identity -v -p codesigning 2>/dev/null | sed -n 's/.*"\(.*\)"$/\1/p' || true)"
  while IFS= read -r line; do
    case "$line" in
      "Apple Development:"*)
        printf '%s\n' "$line"
        return 0
        ;;
    esac
  done <<<"$names"

  printf '%s\n' "-"
}

resolve_development_team() {
  if [[ -n "${PORTFOLIO_DEVELOPMENT_TEAM:-}" ]]; then
    printf '%s\n' "$PORTFOLIO_DEVELOPMENT_TEAM"
    return 0
  fi

  local identity subject ou
  identity="$(resolve_codesign_identity)"
  if [[ "$identity" != "-" ]]; then
    subject="$(security find-certificate -c "$identity" -p 2>/dev/null | openssl x509 -noout -subject 2>/dev/null || true)"
    ou="$(printf '%s' "$subject" | sed -n 's/.*OU=\([^,]*\).*/\1/p')"
    if [[ -n "$ou" ]]; then
      printf '%s\n' "$ou"
      return 0
    fi
  fi

  return 1
}

print_xcode_required() {
  local selected
  selected="$(env -u DEVELOPER_DIR xcode-select -p 2>/dev/null || true)"
  printf '\nNative Stratji / iPhone builds need full Xcode, not only Command Line Tools.\n' >&2
  printf 'System xcode-select is: %s\n' "${selected:-unknown}" >&2
  printf 'These scripts do not run sudo xcode-select -s; they set DEVELOPER_DIR for this process only.\n\n' >&2
  printf 'Next steps:\n' >&2
  printf '  1. Install Xcode from the App Store or https://developer.apple.com/xcode/\n' >&2
  printf '  2. Keep it at /Applications/Xcode.app, or export DEVELOPER_DIR to its Contents/Developer folder.\n' >&2
  printf '     This machine also looks in /Applications/DevApps/Xcode.app.\n' >&2
  printf '  3. Open apple-app/InvestmentDashboard.xcodeproj\n' >&2
  printf '  4. Select scheme Stratji (My Mac) or InvestmentDashboard (your iPhone) and your Apple Development team.\n' >&2
  printf '  5. Product → Build, then rerun npm run desktop or npm run iphone:native\n\n' >&2
}

pin_app_to_dock() {
  local app_path="$1"
  local label="$2"
  local bundle_id="$3"
  python3 - "$app_path" "$label" "$bundle_id" <<'PY'
import os, plistlib, subprocess, sys, pathlib
app = pathlib.Path(sys.argv[1]).resolve()
label = sys.argv[2]
bundle_id = sys.argv[3]
url = app.as_uri() + "/"
domain = "com.apple.dock"
raw = subprocess.check_output(["defaults", "export", domain, "-"], text=False)
data = plistlib.loads(raw)
apps = data.get("persistent-apps", [])

def is_ours(tile):
    try:
        tile_data = tile.get("tile-data", {})
        file_url = tile_data.get("file-data", {}).get("_CFURLString", "").rstrip("/")
        ident = tile_data.get("bundle-identifier", "")
        name = tile_data.get("file-label", "")
        return (
            file_url == url.rstrip("/")
            or ident in {
                "com.adityasharma.Stratji",
                "com.adityasharma.portfolio-intelligence.desktop",
            }
            or name in {"Stratji", "Portfolio Intelligence"}
        )
    except Exception:
        return False

apps = [tile for tile in apps if not is_ours(tile)]
apps.append({
    "tile-type": "file-tile",
    "tile-data": {
        "file-data": {
            "_CFURLString": url,
            "_CFURLStringType": 15,
        },
        "file-label": label,
        "bundle-identifier": bundle_id,
    },
})
data["persistent-apps"] = apps
tmp = pathlib.Path(os.environ.get("TMPDIR", "/tmp")) / "stratji-dock.plist"
tmp.write_bytes(plistlib.dumps(data, fmt=plistlib.FMT_BINARY))
subprocess.check_call(["defaults", "import", domain, str(tmp)])
subprocess.check_call(["killall", "Dock"])
print(f"Pinned to Dock: {app}")
PY
}

write_app_icon_icns() {
  local icon_src="$1"
  local dest="$2"
  if [[ ! -f "$icon_src" ]]; then
    return 0
  fi
  local iconset_dir
  iconset_dir="$(mktemp -d)/AppIcon.iconset"
  mkdir -p "$iconset_dir"
  local size
  for size in 16 32 128 256 512; do
    sips -z "$size" "$size" "$icon_src" --out "$iconset_dir/icon_${size}x${size}.png" >/dev/null
    sips -z $((size * 2)) $((size * 2)) "$icon_src" --out "$iconset_dir/icon_${size}x${size}@2x.png" >/dev/null
  done
  iconutil -c icns "$iconset_dir" -o "$dest" >/dev/null
  rm -rf "$(dirname "$iconset_dir")"
}

ensure_flask_ready() {
  local root_dir="$1"
  if [[ ! -x "$root_dir/.venv-flask/bin/waitress-serve" ]]; then
    "$root_dir/scripts/setup-flask-app.sh"
  fi
  if curl -sf --max-time 3 http://127.0.0.1:5050/_flask/health >/dev/null 2>&1; then
    return 0
  fi
  if "$root_dir/scripts/start-flask-app.sh"; then
    return 0
  fi
  printf 'Warning: Flask is not healthy at http://127.0.0.1:5050/_flask/health.\n' >&2
  printf 'Stratji.app will still be built; it starts scripts/start-flask-app.sh on launch when the repo path is known.\n' >&2
  printf 'You can also run: scripts/run-dashboard-service.sh\n' >&2
  return 0
}
