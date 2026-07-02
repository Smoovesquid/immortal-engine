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

# Highest existing number for the prefix, across tracked AND untracked test files
# (an in-flight worker's uncommitted test still reserves its number).
MAX=$( (git ls-files 'tests/*'; ls tests 2>/dev/null) \
  | grep -E '\.test\.(js|mjs)$' \
  | sed 's|.*/||' \
  | grep -oE "^${P}[0-9]+" \
  | grep -oE '[0-9]+' \
  | sort -n | tail -1 )
MAX=${MAX:-0}

for i in $(seq 1 "${N}"); do
  echo "${P}$((MAX + i))"
done
