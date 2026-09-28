#!/usr/bin/env bash
# Builds the Safari version of my new tab extension on a Mac: wraps extension/ in a macOS app
# with Apple's packager, signs it with my Developer ID, notarizes and staples it, and writes
# public/downloads/chris-new-tab-safari.zip for the tools page to link to. The zip gets
# committed, since the deploy removes anything that isn't in the build.
#
#   npm run safari
#
# One-time setup (see README): Xcode signed in to my Apple Developer account, APPLE_TEAM_ID in
# .env, and a notarytool keychain profile named chriselkins-io.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP='Chris New Tab'
BUNDLE_ID='io.chriselkins.ChrisNewTab'
NOTARY_PROFILE='chriselkins-io'
OUT="$ROOT/public/downloads/chris-new-tab-safari.zip"

if [[ "$(uname)" != Darwin ]]; then
  echo "The Safari build needs a Mac with Xcode." >&2
  exit 1
fi

TEAM_ID="$(sed -n 's/^APPLE_TEAM_ID=//p' "$ROOT/.env" 2>/dev/null || true)"
if [[ -z "$TEAM_ID" ]]; then
  echo "Add APPLE_TEAM_ID=<team ID> to .env." >&2
  exit 1
fi
VERSION="$(node -p 'require(process.argv[1]).version' "$ROOT/extension/manifest.json")"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# The generated project points at extension/ instead of copying it, so Chrome and Safari build
# from the same files. It's thrown away afterward, so nothing in it is ever hand-edited.
xcrun safari-web-extension-packager "$ROOT/extension" --project-location "$WORK" \
  --app-name "$APP" --bundle-identifier "$BUNDLE_ID" --macos-only --swift --no-open --no-prompt
PROJECT="$(find "$WORK" -maxdepth 2 -name '*.xcodeproj')"

# Notarization needs the hardened runtime. Safari 18.4, the first to load Developer ID
# extensions, runs on macOS 13 and later, and the packager's default deployment target is older
# than the Swift code it generates allows. The app's version follows manifest.json.
xcodebuild archive -quiet -project "$PROJECT" -scheme "$APP" -configuration Release \
  -archivePath "$WORK/app.xcarchive" -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGN_STYLE=Automatic ENABLE_HARDENED_RUNTIME=YES \
  MACOSX_DEPLOYMENT_TARGET=13.0 MARKETING_VERSION="$VERSION" CURRENT_PROJECT_VERSION="$VERSION"

cat > "$WORK/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>developer-id</string>
  <key>signingStyle</key><string>automatic</string>
  <key>teamID</key><string>$TEAM_ID</string>
</dict>
</plist>
EOF
xcodebuild -exportArchive -quiet -archivePath "$WORK/app.xcarchive" -exportPath "$WORK/export" \
  -exportOptionsPlist "$WORK/ExportOptions.plist" -allowProvisioningUpdates
APP_PATH="$WORK/export/$APP.app"

# Stapling attaches Apple's ticket so Gatekeeper can check the app offline, and it fails if
# notarization didn't pass (xcrun notarytool log <id> --keychain-profile chriselkins-io says why).
ditto -c -k --keepParent "$APP_PATH" "$WORK/notarize.zip"
xcrun notarytool submit "$WORK/notarize.zip" --keychain-profile "$NOTARY_PROFILE" --wait
xcrun stapler staple "$APP_PATH"
spctl --assess --type execute -vv "$APP_PATH"

mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
ditto -c -k --keepParent "$APP_PATH" "$OUT"
echo "Wrote $OUT (version $VERSION). Commit it, then deploy."
