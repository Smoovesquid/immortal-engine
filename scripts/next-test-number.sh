#!/usr/bin/env bash
# next-test-number — allocate the next free test number(s) for a prefix.
# Prevents parallel workers all claiming the same number (the triple-U322
# collision, 2026-07-02). Basecamp runs this BEFORE dispatch and hands each
# worker its numbers in the prompt; solo workers run it themselves.
#
#   scripts/next-test-number.sh            → next U number
#   scripts/next-test-number.sh C          → next C number
#   scripts/next-test-number.sh U 3        → next three U numbers
set -uo pipefail
cd "$(dirname "$0")/.."

P="${1:-U}"
N="${2:-1}"

# Highest existing number for the prefix. Scanned in TWO places, because a single
# file can carry MANY subtest labels (e.g. tests/U385.*.test.js used U385/U386/U387
# internally — filename-only scanning would re-hand out U386/U387, the collision this
# script exists to prevent):
#   1. the FILENAME number (the ##.shortName convention), and
#   2. every `<prefix><digits>` label INSIDE each test file's contents.
# Across tracked AND untracked files (an in-flight worker's uncommitted test still
# reserves its numbers). Over-counting is the safe direction — it only skips ahead.
FILES=$( { git ls-files 'tests/*.test.js' 'tests/*.test.mjs'; \
           ls tests/*.test.js tests/*.test.mjs 2>/dev/null; } | sort -u )
MAX=$( {
    printf '%s\n' "$FILES" | sed 's|.*/||' | grep -oE "^${P}[0-9]+"
    while IFS= read -r f; do
      [ -n "$f" ] && [ -f "$f" ] && grep -hoE "${P}[0-9]+" "$f"
    done <<< "$FILES"
  } 2>/dev/null \
  | grep -oE '[0-9]+' \
  | sort -n | tail -1 )
MAX=${MAX:-0}

for i in $(seq 1 "${N}"); do
  echo "${P}$((MAX + i))"
done
