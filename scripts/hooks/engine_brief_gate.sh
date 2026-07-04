#!/bin/bash
# ENGINE BRIEF GATE (PreToolUse: Edit|Write) — Tim's 2026-07-04 rule:
# a request that touches engine/** must first be rendered back as a Form Prompt
# (docs/FORM_PROMPT.md) and get Tim's explicit OK before any engine edit runs.
# The OK is recorded by touching .claude/engine-edit-ok (valid 4h).
# Worker worktrees are exempt structurally: this hook is wired only in
# .claude/settings.local.json (not checked in, so absent from worktrees), and
# the path guard below additionally exempts anything under .claude/worktrees/.
# See CLAUDE.md "Engine-brief ritual".

REPO="${CLAUDE_PROJECT_DIR:-/Users/timothysmith/Projects/immortal-engine}"
MARKER="$REPO/.claude/engine-edit-ok"
TTL_SECS=14400  # 4 hours

INPUT="$(cat)"
FILE="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
[ -z "$FILE" ] && exit 0

case "$FILE" in
  /*) ABS="$FILE" ;;
  *)  ABS="$REPO/$FILE" ;;
esac

# Gate ONLY engine/** inside the MAIN checkout. Worktree paths live under
# $REPO/.claude/worktrees/<agent>/engine/... and do not match this prefix.
case "$ABS" in
  "$REPO"/engine/*) : ;;
  *) exit 0 ;;
esac

# Fresh approval marker = Tim already OK'd a Form Prompt for this window of work.
if [ -f "$MARKER" ]; then
  NOW=$(date +%s)
  MT=$(stat -f %m "$MARKER" 2>/dev/null || echo 0)
  if [ $((NOW - MT)) -lt "$TTL_SECS" ]; then exit 0; fi
fi

cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"ENGINE BRIEF GATE (Tim's rule, 2026-07-04): edits to engine/** require his OK on a Form Prompt first. Protocol: (1) render the CURRENT request as a Form Prompt brief per docs/FORM_PROMPT.md and show it to Tim in chat; (2) STOP and wait for his explicit OK — do not touch the marker without it; (3) after his OK, run `touch .claude/engine-edit-ok` (authorizes engine edits for 4 hours) and retry. If Tim is away: do NOT self-approve — queue the brief in docs/PACKETS.md or dispatch it to a worker worktree (worktrees are exempt; their approval happened at dispatch). This gate exists so engine changes are always spec'd and approved before they run."},"systemMessage":"⛔ engine/ edit held — render the request as a Form Prompt and get Tim's OK (then: touch .claude/engine-edit-ok)"}
JSON
exit 0
