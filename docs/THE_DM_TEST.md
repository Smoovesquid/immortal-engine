# THE DM TEST — the governing principle

> For **any** player input, the correct behavior is whatever a competent human DM at a
> table would do. Resolve the player's intent **in the fiction**. The DM is the
> interface; the mechanics (tiles, cardinals, dice, nodes) serve the fiction and stay
> invisible unless the fiction surfaces them.

This is the answer, as always. When unsure how something should behave, don't reach for a
game-system design — ask: **"What would my DM do if I said this at the table?"** Then do that.

## The test (run it on every response before shipping)
Would a real DM say or do this? If the answer is no, it's wrong — no matter how
"correct" the mechanic is.

**Failures (the machine leaking through):**
- "Out here you travel a step at a time. Which way — north, south, east, or west?"
  → No DM bounces your intent back as a movement prompt. You said where you're going.
- "a low hum threads through the walls…" for "force the door" → abstract filler; a DM
  describes the door and what happens to it.
- Stat dumps, raw ids, `[roll:12 vs DC:13]` as the *answer*, "command not recognized."
- Making the player operate the map/compass to do something they already stated in words.

**Passes (the DM resolving fiction):**
- "I go to the Old Shrine" → narrate the journey and get them there, with a time cost,
  an encounter, or a check **only if the fiction warrants** — never a UI prompt.
- "examine the throne" (none here) → "There's no throne, but your eye catches the…"
  (a DM redirects within the fiction).
- "am I hurt?" → an honest, in-voice read of how they feel, not a number dump.

## What this subordinates
The overworld tile/cardinal/node model, the local place-walk, the structure interior
system — all of it is **implementation in service of the DM**, not the player-facing
contract. The map is an aid. Movement, like everything, is resolved by the DM from what
the player *said they want*. If a player can state an intent a DM would honor, the engine's
job is to honor it — the mechanics adapt to the fiction, never the reverse.

## Why it's the top of the plan
Every workstream in `PROSE_MECHANIC_PLAN.md` is really one thing: make the engine behave
like a DM. "Ground the floor", "no dead-ends", "consequence & permanence", "voice" — these
are all just *the DM Test, applied*. When a stage's playtest finds a response that fails the
DM Test, that's the bug, even if every test is green.
