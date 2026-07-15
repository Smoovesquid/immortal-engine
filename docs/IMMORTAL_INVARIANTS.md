# IMMORTAL_INVARIANTS — non-negotiables

If a change would violate one of these, stop and flag it — don't quietly cross it.
These are the rules we keep re-discovering by breaking; they're written down now so
they stop regressing.

## Determinism (the floor)
1. **`engine/rng.js` is the only source of randomness.** No `Math.random`, no
   `Date.now()` / wall-clock in any deterministic path.
2. **Same seed + same transcript → same canon and same `worldHash`.** Tests
   `U19/U21/U22/U27/U30` assert replay-stability. A hash *value* may change when a
   deterministic field is added; replay-*equality* must never break.
3. **Prefer deterministic projections over stored state.** New world-flavor systems
   (biome, ecology snapshot, will, discovery) are pure functions of (seed, node,
   timeline), not mutable state — so they add nothing to world shape and need no
   version bump. Only persist when it genuinely must survive a save.

## Mutation & canon
4. **All structured mutation goes through `engine/effectsCore.applyDeltas()`.** No
   direct world writes.
5. **Canon Log (`engine/csl/`) is authoritative.** On divergence, Canon Log wins.
6. **Narration never mutates canon.** `engine/llmAdapter`, `composer`, `conductor`
   are silent-fallback: if the LLM key is missing or errors, the game continues on
   deterministic base narration — it must read well with the LLM *off*.
7. **Invariants throw.** `engine/invariants.assertWorldInvariants()` runs on every
   `ensureWorld()`. Violations are hard failures (opposite of the LLM layer).
8. **`ensureWorld` whitelists world shape — it strips unknown fields.** If you add a
   new persisted field (e.g. a structure's `buildingType`), add it to the relevant
   normalizer or it vanishes on the next `ensureWorld`.

## Caps & contracts
9. Ledger caps: 8 facts, 8 threats, 8 questions. NPC dialogue topic cap ≤ 20; NPC
   must be at the player's node.
10. **The browser never sees the API key** — server-only.
11. Bumping `WORLD_VERSION`: update `state.js` (number + `ensureWorld` shape), add
    safe defaults + invariants for new fields, warn before upgrading old saves, grep
    tests for version-embedded strings, run the full suite + `playtest:quick`.

## Product/design invariants (the ones that kept regressing)
12. **v1 (`public/v1.js` + canonical engine) is the trunk.** The prototype
    (`public/__preview/play.html` + `worldSession.js`) is a sandbox, never the
    shipping surface. Ship in v1.
13. **The local map is ONE continuous walkable scale.** No separate "exterior" tile
    overworld at play scale and no interior/exterior *mode*: you walk a token through
    one space; walls block, doorways pass; stepping through a door puts you inside —
    no enter/leave seam. (The abstract region grid is a deliberate zoom-out on the
    Map tab only.) Collision and fog share one grid (`placeNav` ↔ `handDrawnPlace`)
    so what blocks sight blocks steps.
14. **Interiors render from the authored catalog** (`public/map/plans/`) via
    `planToSceneModel`, not the procedural stub — buildings must look hand-authored.
15. **The exterior place is built from the REAL node** (`placeFromWorldNode`): the
    village you see is the structures + NPCs that are actually there.
16. **Open-ended: no win destination.** Reaching a place is arrival, never a terminal
    lock. Combat death is the only fail state. The opening is "An Ordinary Morning" —
    you wake in your own bed, in a cottage, in a safe village (not a cave, not a
    dungeon escape).
17. **Hidden Will has zero readout.** Deeds bend casting; the player never sees a
    score or a skill tree.

## Workflow
18. Explore → plan (exact paths + done-when) → smallest diff → targeted test → full
    suite → red-team. Don't start by coding. Don't invent files/APIs/commands.
19. Don't replace a failing assertion with a weaker one; don't hide nondeterminism
    with snapshot churn. A reviewer should check assertion strength.
20. Staging discipline: never `git add -A`/`.` with unrelated changes present; stage
    by path. Never commit unless explicitly asked.

## DENIED — by design, forever (the buildability law)

The law behind every entry: **the engine RULES, it never SIMULATES.** Any player intent
is answered by a ruling — one authored consequence, then the world moves on — never by
standing up a new open-ended simulation. Denials land IN FICTION (a world reason,
gracefully — IDEA_GARDEN IG-10), never as a rules message. A brief or feature idea that
crosses one of these is out of scope *by definition* — stop and flag it, don't scope it.

21. **One timeline per world.** Saves suspend and resume; there is never a second copy
    of a world. No player-facing export/import/rewind — the `engine/save.js` serializer
    exists for tests/harness only and must never be wired back into the UI
    (tripwire: U700).
22. **The effect vocabulary is sealed at runtime.** Every structured world-change is one
    of `applyDeltas`' known ops; unknown ops are inert (tripwire: U701). Neither player
    prose nor the LLM may mint a new effect type, device, or spell with ongoing
    mechanical life. Infinite flavor, finite physics.
23. **Nothing propagates.** Fire, water, collapse damage what the ruling states, then
    stop — no cell-to-cell or tick-by-tick spreading simulation, ever. A larger
    consequence arrives later as an authored outcome (next scene, the tavern is a
    gutted shell).
24. **No freeform crafting.** Objects expose the authored verb set only; two objects
    never combine into a new mechanical object by player assertion. Rope + chandelier +
    lamp oil is one narrated attempt with a roll, never a new device with stats.
25. **The off-screen world moves in ticks, not minutes.** NPCs exist at scene
    granularity; tailing or staking out someone compresses to a single ruling of what
    you learn. No continuous schedule simulation.
26. **One body.** The player controls exactly one character. Companions have their own
    will and are never puppets; no alt or mule characters.
27. **One walkable plane, upward too.** No mechanical flight, burrowing, or free
    climbing on the collision grid (invariant 13 extended vertically). Vertical stunts
    are narrated transitions between authored positions.
28. **The region edge is real.** V1 is one authored slice; its borders are closed
    in-fiction (weather, war, sea) and the beyond is never simulated.
29. **Trade is per-merchant, never an economy.** Authored stock and prices; cornering a
    market is a reputation/rumor consequence, not a price simulation.
