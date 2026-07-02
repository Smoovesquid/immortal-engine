#!/usr/bin/env bash
# play — open the live game guaranteed-fresh so Tim always plays the latest build.
# Starts the dev server if needed, verifies version lockstep (package.json vs the
# v1.js front-door header), and opens v1.html with a cache-busting query string.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT=5179
PKG_V=$(node -p "require('./package.json').version" 2>/dev/null || echo "?")
UI_TITLE=$(grep -oE "Immortal Engine — v[0-9.]+" public/v1.js | head -1)
UI_V=$(echo "${UI_TITLE}" | grep -oE "[0-9][0-9.]*" || echo "?")
UI_BUILD=$(grep -oE "build [0-9]+ · [0-9-]+ · [^']*" public/v1.js | head -1)

if ! curl -s -o /dev/null --max-time 2 "http://localhost:${PORT}/v1.html"; then
  echo "server not running — starting npm run dev (log: /tmp/immortal-dev.log)…"
  nohup npm run dev >/tmp/immortal-dev.log 2>&1 &
  for _ in $(seq 1 30); do
    curl -s -o /dev/null --max-time 2 "http://localhost:${PORT}/v1.html" && break
    sleep 1
  done
fi

STATUS=0
if [ "${PKG_V}" != "${UI_V}" ]; then
  echo "⚠️  VERSION MISMATCH: package.json v${PKG_V} vs v1.js v${UI_V} — fix lockstep before playtesting."
  STATUS=1
fi

URL="http://localhost:${PORT}/v1.html?fresh=$(date +%s)"
open "${URL}"
echo "Opened ${URL}"
echo "You should see: ${UI_TITLE} (${UI_BUILD})."
echo "If the header on screen differs, hard-refresh: Cmd+Shift+R."
exit ${STATUS}
