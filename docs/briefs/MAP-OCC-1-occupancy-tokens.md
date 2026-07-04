# MAP-OCC-1 — the map draws who's actually there (occupancy-driven tokens)

**Model:** Claude Sonnet. **Lane:** renderer (`public/map/`). **Your tests: U398–U399.**
**Packet of record:** `docs/PACKETS.md` → MAP-OCC-1 (spec'd 2026-07-03). This brief inlines it
and re-baselines it against v0.28.8 (`a1b4bea`, landed 2026-07-04 08:31).

## Why (one breath)

The outdoor map **invents people**: `public/map/placeFromNode.js:143-147` seed-scatters the
*whole settlement roster* along the road, with no concept of who is actually near the player.
That's the recurring "map shows people who aren't there" fiction break. The engine already owns
the truth: `engine/structures/roomOccupancy.js` (`occupantsOfRoom` / `outdoorOccupants`) — the
SAME module the DM's presence logic uses. The map must read it, not improvise.

## Re-baseline first (the world moved yesterday)

v0.28.8 made the INTERIOR view render via `renderLocalMap` → `handDrawnInterior` (graph-paper
floor plan) while OUTSIDE (and combat) stays on the continuous overworld map. Your packet is
about the **outdoor/place token set** (`placeFromNode.js`) — verify current behavior on a fresh
boot before editing, and confirm whether the interior path draws its occupants from occupancy
already (if it does, leave it alone; your scope is the outdoor scatter).

## The fix

- In `placeFromNode.js`: the people/creature token set derives from occupancy —
  `outdoorOccupants` for the outdoor place; NO off-room roster NPC may produce a token.
  Roster (who exists in the settlement) still comes from state; the map just stops sprinkling
  absent people onto the ground.
- **Strongly prefer ZERO `public/v1.js` changes** — another lane is active in that file today.
  If passing room/interior context truly requires a v1 seam, make it a minimal, clearly-marked
  single hunk and FLAG it prominently in your report so Basecamp merges it with care.

## Tests (U398–U399)

- **U398:** build the place for the `tallow` boot world (player wakes alone) and assert the
  token set names NO off-room roster NPC; then a multi-occupant fixture draws exactly the
  room/outdoor occupants — no more, no fewer.
- **U399** (if needed): determinism — token layout stays a pure seed projection (same seed →
  identical layout; worldHash untouched by rendering).

## Guardrails

- **Forbidden:** touching the engine movement/occupancy path (roomOccupancy is truth — READ it,
  never change it); `Math.random` (seeded rng only); writing ux/uy into engine state (breaks
  U21 — MAP-OCC-2 is making that structural); inventing a renderer-side "who's here" heuristic
  (must derive from roomOccupancy).
- MAP-FIDELITY RULE: Basecamp does the final live-screenshot verification at land; you verify
  headless via unit tests + (if feasible) a map-proto lab page that imports the REAL builders.

## Done-when

- The empty wake world draws no phantom neighbours; a populated fixture draws exactly its
  occupants; U398(-U399) green; full suite + convergence green.
- One local commit on your branch (do NOT push): `fix(map): MAP-OCC-1 — tokens derive from
  room/outdoor occupancy, not roster scatter`.

## Rollback

Revert the `placeFromNode.js` token-source change (restores roster scatter).

## Report (plain English for Tim)

What was broken (the map decorated the road with everyone who lives in town, whether or not
they were there), what changed (it now draws exactly who the engine says is present), why it
matters (the map stops contradicting the DM — the "map never lies" floor).
