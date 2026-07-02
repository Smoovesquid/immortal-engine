---
name: play
description: Open the live game fresh so Tim is guaranteed to be playing the latest build. Use when Tim says "play", "open the game", "pull it up in a browser", "I need to playtest", or doubts he's on the current version.
---

# /play — open the game, guaranteed fresh

Kills the stale-build class of phantom bugs (Tim has playtested old builds twice and reported ghosts).

## Steps

1. Run `bash scripts/play.sh`. It starts the dev server on :5179 if needed, checks that
   `package.json` and the `public/v1.js` header agree on the version, and opens `v1.html` with a
   cache-busting query string.
2. Tell Tim, in one line, exactly what the header should say — e.g. **"You should see: Immortal
   Engine — v0.23.1, build 040."** If the screen shows anything else, he should hard-refresh
   (Cmd+Shift+R) and tell you.
3. If the script reports a VERSION MISMATCH, fix the lockstep first (update `public/v1.js` title +
   build line to match `package.json`, or vice versa), commit it, and rerun — never hand Tim a
   mismatched build.
