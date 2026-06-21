#!/usr/bin/env bash
# Stop hook — end-of-turn regression sentinel (see docs/PROMPT_ARCHITECTURE.md §5).
# If engine/ or tests/corpus changed this turn (uncommitted), report the convergence
# locked-pass line so a regression can't slip by silently. Read-only, free, fail-safe.
# OFF: delete the "hooks" block from .claude/settings.local.json.
set -e
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT" 2>/dev/null || exit 0

# Only speak when engine/corpus has uncommitted changes (staged or unstaged).
if git diff --quiet -- engine tests/corpus 2>/dev/null \
   && git diff --cached --quiet -- engine tests/corpus 2>/dev/null; then
  exit 0
fi

line="$(npm run convergence 2>/dev/null | grep -m1 'Overall locked-pass' || true)"
if [ -n "$line" ]; then
  if echo "$line" | grep -q '100.0%'; then
    echo "🔁 corpus green — $line (engine/corpus changed this turn)"
  else
    echo "⚠ corpus NOT 100% — $line (engine/corpus changed this turn; expected if mid-fix)"
  fi
fi
exit 0
