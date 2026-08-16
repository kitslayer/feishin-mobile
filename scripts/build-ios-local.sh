#!/usr/bin/env bash
# Build an unsigned Feishin .ipa entirely on local hardware -- no CI.
#
# The work is split because neither machine can do both halves:
#   * the JS bundle needs RAM (the ~25MB sourcemap exhausts V8's heap on
#     small builders), so it is built here on the Linux box
#   * xcodebuild only runs on macOS, so the archive happens on the Mac
#
# The resulting .ipa is unsigned on purpose: it gets re-signed on-device by a
# sideloader (SideStore/AltStore) with a free Apple ID. That path does not care
# which iOS version Xcode has DeviceSupport for, which is what makes an old
# Xcode able to target a much newer phone.
#
# Usage:
#   MAC_HOST=192.168.1.48 MAC_USER=mcoviello scripts/build-ios-local.sh
set -euo pipefail

MAC_HOST="${MAC_HOST:?set MAC_HOST to the build Mac}"
MAC_USER="${MAC_USER:?set MAC_USER to the login on that Mac}"
MAC_REPO="${MAC_REPO:-feishin-mobile}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${OUT:-$REPO/dist}"

export PATH="$HOME/.local/bin:$PATH"
mac() { SSH_ASKPASS= ssh -o ConnectTimeout=30 "${MAC_USER}@${MAC_HOST}" "$@"; }

echo "==> [1/4] building web bundle locally (sourcemaps off)"
cd "$REPO"
FEISHIN_SOURCEMAP=false pnpm build:web >/dev/null
echo "    $(du -sh out/web | cut -f1) of assets"

echo "==> [2/4] shipping assets to ${MAC_HOST}"
# macOS 15 ships openrsync, which rejects GNU rsync's flags -- tar over ssh
# avoids the whole incompatibility.
mac "rm -rf ~/${MAC_REPO}/ios/App/App/public && mkdir -p ~/${MAC_REPO}/ios/App/App/public"
tar czf - -C out/web . | mac "cd ~/${MAC_REPO}/ios/App/App/public && tar xzf -"
echo "    $(mac "ls ~/${MAC_REPO}/ios/App/App/public/assets | wc -l" | tr -d ' ') asset files landed"

echo "==> [3/4] archiving on the Mac (slow on old hardware)"
mac "cd ~/${MAC_REPO}/ios/App && xcodebuild \
    -project App.xcodeproj -scheme App -configuration Release \
    -sdk iphoneos -destination 'generic/platform=iOS' \
    -archivePath \$HOME/App.xcarchive archive \
    CODE_SIGNING_ALLOWED=YES AD_HOC_CODE_SIGNING_ALLOWED=YES \
    CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='-' \
    CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM='' \
    | tail -5"

echo "==> [4/4] packaging .ipa and pulling it back"
mac "set -e
    APP=\$HOME/App.xcarchive/Products/Applications/App.app
    test -d \"\$APP\"
    rm -rf \$HOME/Payload \$HOME/Feishin-unsigned.ipa
    mkdir -p \$HOME/Payload && cp -R \"\$APP\" \$HOME/Payload/
    cd \$HOME && zip -qry Feishin-unsigned.ipa Payload"

mkdir -p "$OUT"
mac "cat ~/Feishin-unsigned.ipa" > "$OUT/Feishin-unsigned.ipa"

echo
echo "==> done: $OUT/Feishin-unsigned.ipa ($(du -h "$OUT/Feishin-unsigned.ipa" | cut -f1))"
echo "    Sideload it with SideStore/AltStore; it re-signs on-device."
