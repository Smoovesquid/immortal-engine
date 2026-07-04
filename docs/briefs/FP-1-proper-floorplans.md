# FP-1 — proper floorplans: rooms share walls, doorways open room into room

**Model:** Opus (engine geometry with position interplay — `engine/structures/floorPlan.js` +
`public/map/planModel.js` consumers). **Your tests: U429–U431** (U420–U423 and U426–U428 are held by
in-flight/armed lanes — do not use them even if the allocator offers them).
**Tim's ruling (2026-07-04-pm4, verbatim):** "The 'rooms-interconnected-by-corridors' is actually an
old bug. That's not how floorplans are supposed to look. They should look like proper floorplans.
Meaning rooms with doorways that open into one another."

## Why this is a coherence fix, not just taste

The FICTION already behaves like Tim's ruling: movement narrates "You step through into the pantry,"
`getRoomState` describes "a doorway leading deeper in," and no narration anywhere mentions corridors.
The geometry (`floorPlan.js`: rooms padded apart, `corridors:[...]` bridging them, doors sitting in
the pad gaps) contradicts the game's own words. Align the geometry with the fiction.

## The fix (engine-side; every renderer inherits via the shared brain)

In `engine/structures/floorPlan.js` (and `public/map/planModel.js` where the door/corridor shaping
lives after TT-DRAW-3):
1. **Rooms TILE their layout cells** — adjacent rooms on the compass grid ABUT: shared wall segments,
   zero pad-void between connected neighbors. Keep the existing character: per-room sizes/shapes from
   `roomDetail` may still vary WITHIN the abutting constraint (a wide nave, a narrow closet — vary
   the shared-wall length/offsets, not by floating rooms apart); round rooms/apses keep their shape,
   meeting the neighbor at a flat chord if needed.
2. **Doorways are gaps IN the shared wall**, placed on the edge the topology connection crosses —
   "go north" must still reach the room drawn to the north (the module's own compass-honesty promise
   is untouchable: `interiorCompassLayout` stays the placement truth).
3. **Corridors cease to exist as auto-generated bridges.** If the topology genuinely models a
   hallway-like room, it's just a room. If you find connected rooms the compass layout places
   NON-adjacent (verify whether that's even possible), STOP and flag with the example rather than
   re-inventing bridges.
4. The building shell hugs the tiled rooms (no shell ballooning around pad-voids).

## The load-bearing interplay (handle, don't hand-wave)

- **TAC-1 positions:** `engine/map/spatial/tacticalPos.js` seeds `pos` into floorPlan room rects, and
  `engine/invariants.js` asserts `roomOf(pos)` consistency — MOVING WALLS MOVES ROOM RECTS. Handle
  saves whose `pos` was seeded under old geometry: the least-destructive repair (re-derive the pos
  into the same ROOM's new rect in `ensureWorld`, or null-and-backfill) — old saves must load without
  throwing, prove it with a test. If this requires touching `engine/state.js`, keep the hunk tiny and
  PROMINENTLY FLAGGED: a sibling lane (JR-1) may touch a different region of `state.js`
  (`ensureCombat` whitelist) — zero overlap expected, but call it out for integration.
- **STRUCTURE_SCHEMA_VERSION (pinned 27):** room IDS and topology are unchanged (layout-only), so no
  bump SHOULD be needed — verify nothing derives ids from layout geometry; if a bump turns out to be
  truly required, STOP and flag (it has its own protocol).
- **Test relocks, deliberate + documented:** U418 asserts the corridor model (relock to the tiled
  model); TT-DRAW-3's interior byte-identity proof will intentionally break (the interior view is
  SUPPOSED to change — that's the ruling); sweep the coherence/interior fixtures that reference
  corridors. `npm run convergence` 100% (relocks documented).
- **worldHash:** floorPlan itself is a pure projection (not hashed) — but `pos` IS hashed; replay
  equality U19/21/22/27/30 must hold across the change (fresh worlds seed deterministically under the
  new geometry; that's fine — the suite proves it).

## Tests (U429–U431)

- **U429 — tiling:** for every structure in the tallow boot world: connected rooms share a wall
  segment; every doorway is a gap ON a shared wall reachable per topology; no corridor entries
  remain; compass honesty (the room drawn north of you is topology-north). Deterministic ×2.
- **U430 — pos survival:** a save with `pos` seeded under OLD geometry loads through `ensureWorld`
  without throwing and lands in the SAME room's new rect; fresh-world seeding is deterministic;
  determinism replay green with pos hashed.
- **U431 — fiction agreement:** `getRoomState` doorway descriptions and the drawn plan agree — the
  count of drawn door-gaps for the current room equals the topology's exits for that room (the map
  may never show a doorway movement can't take, nor hide one it can).

## Verification

Lab screenshots: the wake cottage at plan zoom (tiled rooms, shared walls, door gaps opening room
into room, graph paper beneath) + the in-play interior view (which now also shows the proper plan) +
one larger building (the chapel or inn if generable) proving the model scales. Paths in the report.

## Done-when

Tim's sentence is true on screen ("rooms with doorways that open into one another"); no corridors
anywhere; U429–U431 green; relocks documented; full suite + convergence + determinism green;
`playtest:quick` clean. One local commit (no push); package.json patch bump only.

## Rollback

Revert the commit (pad-and-corridor geometry returns everywhere at once — the shared brain cuts both
ways).

## Report (plain English for Tim)

What was wrong (the building generator has been drawing every home like a cluster of sheds connected
by breezeways — and the game's own narration never believed it: it always said "you step through into
the pantry"), what changed (rooms now share walls like a real floorplan, and the doorway you walk
through is a gap in the wall between two rooms — on the map, in the interior view, and in the
positions the engine records), why it matters (one more place where what you see, what the DM says,
and what the engine knows are now the same thing).
