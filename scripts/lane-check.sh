#!/usr/bin/env bash
# lane-check — pre-integration safety snapshot for parallel-lane work.
# See docs/LANE_MAP.md. Run BEFORE any push/merge into the mainline.
#
# Prints: working tree, outgoing commits (what you'd push), incoming commits
# (origin advanced under you), and the authors/subjects of outgoing commits so a
# foreign lane's work stands out. Also flags uncommitted edits to HOT files — the
# signature of another lane editing this working directory (use worktree-per-lane).
#
# Exit 1 if origin advanced OR a hot file has foreign uncommitted edits (a real gate
# you must acknowledge); exit 0 when clean.
set -uo pipefail

TARGET="${1:-v2-polish}"
REMOTE="${2:-origin}"
HOT='engine/playloop\.js|engine/npc/dialogue\.js|engine/grace/|engine/llmAdapter\.js|engine/composer\.js|engine/escapeCombat\.js|engine/state\.js|engine/rng\.js|engine/effectsCore\.js'

echo "── lane-check vs ${REMOTE}/${TARGET} ──"
git fetch "${REMOTE}" "${TARGET}" --quiet 2>/dev/null || echo "  (fetch skipped — offline?)"

echo ""; echo "Working tree:"
git status --short || true

echo ""; echo "Outgoing (would push — ${REMOTE}/${TARGET}..HEAD):"
git log "${REMOTE}/${TARGET}..HEAD" --format='  %h %an: %s' 2>/dev/null || true

echo ""; echo "Incoming (origin advanced — HEAD..${REMOTE}/${TARGET}):"
git log "HEAD..${REMOTE}/${TARGET}" --format='  %h %an: %s' 2>/dev/null || true

OUT=$(git rev-list --count "${REMOTE}/${TARGET}..HEAD" 2>/dev/null || echo 0)
IN=$(git rev-list --count "HEAD..${REMOTE}/${TARGET}" 2>/dev/null || echo 0)
# Uncommitted edits to hot files (foreign-lane signature in a shared working dir).
HOT_DIRTY=$(git status --porcelain | grep -E "^.M|^M" | grep -E "${HOT}" || true)

echo ""; echo "Summary: ${OUT} outgoing, ${IN} incoming."

STATUS=0
# Version lockstep: package.json semver must match the public/v1.js front-door header
# (Tim plays the live build and must know which one — see CLAUDE.md Versioning).
PKG_V=$(node -p "require('./package.json').version" 2>/dev/null || echo "?")
UI_V=$(grep -oE "Immortal Engine — v[0-9.]+" public/v1.js 2>/dev/null | head -1 | grep -oE "[0-9][0-9.]*" || echo "?")
if [ "${PKG_V}" != "${UI_V}" ]; then
  echo "⚠️  VERSION LOCKSTEP BROKEN: package.json v${PKG_V} vs public/v1.js v${UI_V} — fix both before push."
  STATUS=1
fi
if [ -n "${HOT_DIRTY}" ]; then
  echo "⚠️  HOT files have uncommitted edits — another lane may share this working dir:"
  echo "${HOT_DIRTY}" | sed 's/^/     /'
  echo "    → Use worktree-per-lane (git worktree add). Do NOT commit edits you didn't make."
  STATUS=1
fi
if [ "${IN}" -gt 0 ]; then
  echo "⚠️  ${REMOTE}/${TARGET} ADVANCED — rebase before integrating: git pull --rebase && npm run check"
  STATUS=1
fi
if [ "${OUT}" -gt 0 ]; then
  echo "→ Confirm every outgoing commit above is THIS lane's before pushing."
fi
[ "${STATUS}" -eq 0 ] && echo "✓ clear to integrate (after npm run check)."
exit ${STATUS}
