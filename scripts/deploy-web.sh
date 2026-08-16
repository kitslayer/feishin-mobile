#!/usr/bin/env bash
# Build the Feishin web bundle and push it to the nginx container on .148.
#
# The container serves ./feishin/web from a read-only bind mount, so a deploy
# is just an rsync -- no image rebuild, no container restart.
#
# Usage: scripts/deploy-web.sh
set -euo pipefail

HOST="${FEISHIN_HOST:-192.168.1.148}"
DEST="${FEISHIN_DEST:-/home/miles/media-stack/feishin/web}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export PATH="$HOME/.local/bin:$PATH"

cd "$REPO"
echo "==> building web bundle"
pnpm build:web

echo "==> syncing to ${HOST}:${DEST}"
rsync -a --delete "$REPO/out/web/" "${HOST}:${DEST}/"

# The PWA service worker will happily serve a stale build from cache, which
# looks exactly like "my change did nothing". Report the bundle hash so you can
# confirm the phone actually picked up this build.
HASH="$(grep -o 'index-[A-Za-z0-9_-]*\.js' "$REPO/out/web/index.html" | head -1)"
SERVED="$(ssh "$HOST" "curl -s http://127.0.0.1:9180/ | grep -o 'index-[A-Za-z0-9_-]*\.js' | head -1")"

echo "==> built:  $HASH"
echo "==> served: $SERVED"
if [[ "$HASH" == "$SERVED" ]]; then
    echo "==> OK - http://${HOST}:9180"
    echo "    On the phone: pull-to-refresh, or close the PWA from the app"
    echo "    switcher and relaunch, to get past the service worker cache."
else
    echo "==> MISMATCH - nginx is not serving the build you just made" >&2
    exit 1
fi
