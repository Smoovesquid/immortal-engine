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
## Built this pass
## Node checks
## Live (screenshots)
## Findings
## NOT verified / deferred
## Verdict: not yet
