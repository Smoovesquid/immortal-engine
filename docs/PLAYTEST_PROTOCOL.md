# PLAYTEST_PROTOCOL — Hand over a working game, every time

**The rule (non-negotiable):** When we agree on a goal that ends in Tim playtesting,
I must **playtest every new feature myself, through the real play surface, and confirm
it visibly functions — BEFORE handing it over.** The default has been the opposite:
I hand over a broken game and then debug live. Stop doing that. Debug ahead of time.

> If I haven't watched the feature work on screen as a player would, it is not done.

---

## Why this exists (the pattern to break)

Real failures from this project where I said "ready, go play" and it wasn't:

1. **Wrong surface.** I wired the grace layer into the server `/api/move` endpoint and
   declared it done. The live UI (`public/v1.html` / `v1.js`) runs the engine
   **client-side** and never calls that endpoint. The feature never executed in play.
2. **Invisible output.** I confirmed prose by reading the DOM with `get_page_text`.
   The narration was in the DOM but **clipped to a 20px sliver behind the map** —
   the player saw nothing. "Commands not functioning."

Both would have been caught in 60 seconds by actually playing and *looking at the screen*.

---

## The two play surfaces (know which one is live)

- **`public/v1.html` + `public/v1.js` = the live game.** It imports the engine modules
  and runs `beginAdventure` / `playerMove` **in the browser**. This is what Tim plays.
- The Express server (`server.js`) mostly serves static files. Server-side game endpoints
  can be **dead code**. A passing server test proves nothing about the live UI.
- See `docs/REPO_MAP.md` "two play surfaces" for the canonical warning.

**Implication:** verifying a feature means driving `v1.html` in a browser, not calling
an API or running a Node harness alone.

---

## Pre-handoff checklist (run ALL of it, in order)

1. **Unit/contract tests green** — `node --test` full suite. New feature has its own tests.
2. **Determinism/crash sweep** — `npm run playtest:quick` (0 crashes).
3. **Prose/engine harness** (if prose touched) — `node scripts/prose-playtest.mjs`
   (0 crashes, 0 issues). Drives realistic inputs through the real routing.
4. **LIVE BROWSER WALKTHROUGH — the part I keep skipping:**
   - Load `http://localhost:5179/v1.html`, click **Begin** (note: often needs a
     second click after a fresh load).
   - Exercise **each new feature** with the actual inputs a player would type.
   - **Take a screenshot and look at it.** Confirm the result is *visible on screen* —
     not just present in the DOM. `get_page_text` ≠ verification; it sees clipped/hidden
     content a human can't.
   - Check the browser console for errors (`read_console_messages`).
5. **Only then** tell Tim it's ready, and say exactly what I verified and how.

## Verification standard

- **Screenshot, not DOM dump.** If I claim a player can see/do X, a screenshot must show X.
- **Real inputs, real surface.** Type what a player types, in `v1.html`.
- **One honest sentence on what I did NOT verify.** If I couldn't reach a state
  (e.g. an exterior survey, deep combat), say so plainly instead of implying it works.

## Handoff message format

When handing over for playtest, state:
- What the goal was and what features it added.
- The checklist results (tests, playtest, harness, **live walkthrough with screenshot**).
- Any honest gaps / things not verified.
- The exact things worth trying first.

---

## TL;DR

Tests prove logic. **Only playing proves the game.** Watch it work on screen as a
player before handing it to Tim. Hand over a functioning game, not a debugging session.
