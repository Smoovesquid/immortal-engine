# Playtest — Stage D: consequence & permanence (the world remembers) — 2026-06-06

Surface: live v1.html · Persona: The Skeptic · Governing: THE_DM_TEST
Companion: PROSE_TO_WORLD.md is AUTHOR-TIME (prose→pack at build). Stage D is RUNTIME
scene-state permanence — orthogonal, no overlap.

## What already holds (verified before building)
- **break / smash / take** on named furniture ALREADY persist: the physics branch
  applies `modifyFurniture`/`removeItem` deltas, pushes a replayable `resolution` event,
  and examine reflects the new state (intact→damaged, parts removed). Determinism-safe:
  `replayFromTimeline` re-runs `playerMove(text)` for resolution events, and furniture
  isn't in `worldHash`. So Stage D is partly done for destructive verbs.

## The gap this slice closes
- **open / close / shut / unlock** narrate ("You open the crate.") but DON'T mutate — the
  world forgets. Re-opening gives identical text; examine never reflects "open". This is
  the literal done-when miss: "an opened crate stays open."

## Slice 1 charter
For open/close/shut/unlock on a furniture piece present at the node:
1. First open → mutate `furniture.state` to `open` (close → `closed`) via a `modifyFurniture`
   delta, push a replayable resolution event, narrate the change naming the piece.
2. Re-doing it → acknowledge the prior change ("The wooden crate is already open."),
   no redundant mutation.
3. examine / room overview reflect the current state afterward ("It stands open.").
4. Opening reveals contents when the piece has any (nice-to-have; grounded if absent).
5. Determinism preserved (replay re-runs text → same mutation; furniture unhashed).
6. Out of scope (later slices): force/pry persistence via the resolveMove path; "a broken
   door becomes a real map exit" (couples to map/interior topology — its own slice);
   sensory residue (noise/scent) chaining.

## Pre-registered attack list (committed BEFORE the build)
- [ ] `open the <crate>` (real furniture) → narrates, state becomes `open`
- [ ] `examine the <crate>` after opening → reflects it's open
- [ ] `open the <crate>` again → "already open", no double-mutation
- [ ] `close the <crate>` after opening → state back to `closed`, narration acknowledges
- [ ] `look around` after opening → overview reflects the open piece (or at least doesn't
      contradict it)
- [ ] open a piece with contents → contents surfaced; open an empty one → grounded, no leak
- [ ] `open the <thing not here>` → grounded ("nothing like that here to open"), no crash
- [ ] LEAVE the node and RETURN → the piece is STILL open (true permanence across moves)
- [ ] break still persists (no regression); examine still reflects damage
- [ ] determinism: sim == export == replay (U21 green); same seed+inputs → same prose
- [ ] full suite green; prose gate PASS; playtest:quick clean
- [ ] LIVE on v1.html: open a thing, examine it, leave + return, see it remembered (screenshot)

## Grading
world remembers across turns AND moves? · re-attempt acknowledges prior state? · examine/
overview reflect it? · grounded (no floor/leak)? · deterministic? · visible on screen?

---
## Built this pass (engine/playloop.js)
- `tryFurnitureStateChange(world, text)` — gated before the trivial gate (after the
  physics intercept). For open/close on a furniture piece PRESENT at the node:
  applies a `modifyFurniture` delta (`state: open|closed`), pushes a replayable
  `resolution` event (`updateKind: furniture:<state>`), and narrates the change naming
  the piece. Already-in-state → acknowledges ("…already stands open.") with no
  re-mutation. Not-a-real-piece → returns null so the trivial gate still answers.
- `tryExamineTarget` state clause now reads naturally: `open`/`ajar` → "It stands open.",
  `closed` → silent, other non-intact → "It looks <state>."
- Bug fixed mid-build: my delta used `kind:` but `applyDeltas` reads `op.op` — the
  mutation silently no-op'd until I matched the real delta shape (`op: 'modifyFurniture'`).
  (Caught by the node probe before any test/live claim.)

## Node checks (scripts, throwaway)
- open crate → state `open`, "You open the wooden crate; it stands open now."
- examine after open → "…It stands open. You make out its plank, lid, rope handle."
- open again → "The wooden crate already stands open." (no re-mutation)
- close → state `closed`, "You swing the wooden crate shut."; close again → "already shut"
- **LEAVE (go outside) + RETURN (go inside) → crate state STILL `open`** (true permanence)
- open a piece not here ("portcullis") → falls through to trivial, no crash, no furniture change
- break still persists (physics path) → state `damaged`, parts removed (no regression)

## Tests
- U103 (8): open persists + names it · examine reflects open · re-open acknowledged ·
  close reverses + acknowledged · permanence across leave/return · graceful absent +
  break-still-persists · deterministic (prose+mechanics+state).
- U21 determinism green (replay re-runs the text → same deterministic mutation; furniture
  isn't in worldHash). UX2 + U100 + U101 green. Full suite **7205/7205**. Prose gate
  PASS. `playtest:quick` clean.

## Live (v1.html, AI on)
- **(ss_2628slsu2)** "examine the crate" (intact) → grounded description, no state clause.
- **(ss_98804d0xa)** after `open the crate` → `go outside` → `go inside` → "examine the
  crate" → *"…you run your fingers along the crate's weathered planks … and the open lid
  revealing whatever lies within."* — the crate REMEMBERED it was open after leaving the
  building and returning. AI elaborated the grounded "it stands open" base. ✅

## Findings
| check | result |
| --- | --- |
| open mutates + persists | ✅ state=open |
| examine reflects it | ✅ "It stands open" / AI "open lid revealing…" |
| re-attempt acknowledges prior state | ✅ "already stands open" |
| close reverses | ✅ state=closed |
| permanence across MOVES (leave+return) | ✅ live-verified |
| graceful on absent target | ✅ falls through, no crash |
| break still persists | ✅ no regression |
| deterministic | ✅ U21 + U103-E |

## NOT verified / deferred (later slices)
- **"A broken door becomes a real map exit"** — couples to map/interior topology
  (doors aren't modeled as blocking exits yet); its own slice. This slice covers
  furniture STATE permanence, not exit-graph mutation.
- force/pry persistence via the resolveMove path (break already persists via physics).
- Contents reveal on open — furniture has no `contents` field (no model); skipped honestly.
- Sensory residue / consequence chaining (noise → response) — Stage D later slice.

## Verdict: GREEN (slice 1) — the world remembers open/closed across turns AND moves.
"An opened crate stays open" is true, live-verified. Destructive permanence (break) was
already in place. Remaining Stage D scope (door-as-exit, residue chains) is tracked above.
