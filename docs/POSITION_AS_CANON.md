# POSITION AS CANON — the tactical-grid contract (TAC design step 1)

**Status:** CONTRACT (Fable design, 2026-07-04). Decides the TAC epic's "one hard decision"
before any code, per the packet's sequence: contract → packetize → build (serial, after the
current playloop lane clears).
**Siblings:** `TABLETOP_MAP.md` (what the map draws) · `DND_XCOM.md` (the tactical destination) ·
`MAP_PATH.md` Phase 2 (reactive positioning) · the two-tier travel ruling
([[project_tactical_travel_two_tier]]) · `PROSE_TO_WORLD_CONTRACT.md` (the pattern: propose →
ground → commit).

---

## 0. The ruling

**Tactical position becomes CANON: engine-owned, deterministic, inside `worldHash`.**
Not renderer-side.

Why (in order of force):

1. **The engine adjudicates it, so the engine must own it.** Movement is becoming a primary
   action with a budget (30 ft/turn) and consequences (reach, cover, escape). "You won't reach
   him this turn" is computed *from* position. Anything the DM rules from is mechanics, and
   mechanics live in the deterministic engine — that's the house invariant.
2. **The moat.** "I left the barrel by the cell door" must survive save/reload/replay. A
   renderer position dies with the browser tab; canon never forgets.
3. **The map law stays one-way.** If position lived in the renderer, the map would be partly
   self-authoritative — exactly what "state is not influenced by map truth" forbids. With
   position in canon, the map goes back to being a pure reading.
4. **Combat already lives this way.** escapeCombat's range bands are engine truth; this extends
   the same principle to finer resolution rather than inventing a second authority.

**The U21 lesson is honored, not contradicted:** what broke determinism before was *pixel*
coordinates (`ux/uy`) leaking toward state. The contract line is: **cells in canon, pixels in
the renderer.** (`MAP-OCC-2` is making the pixel side structural at the hash.)

## 1. The position model

```
pos = null                                  // not tactically placed (journeying, or absent)
pos = { frame: 'place:<nodeId>',  gx, gy }  // outdoors on the node's local grid
pos = { frame: 'struct:<structId>', gx, gy } // inside a building/dungeon structure
```

- **1 cell = 5 ft.** gx/gy are integers within the frame's bounds.
- **One frame per structure, not per room.** `floorPlan.js` already lays all of a structure's
  rooms into one building-local space; *which room you're in* is **derived** from which room
  rect contains your cell — geometry is the single source, room-membership is a projection.
- **Frames per node outdoors.** The outdoor grid is the place layout's walkable mask
  (`placeNav`) at 5-ft resolution.
- **Between nodes** (mid-journey) `pos = null` — the node graph is the journey scale; the grid
  is the walkable scale. One walkable scale, preserved.
- **Units mapping** (place-units→ft, floorPlan-units→ft) is pinned ONCE at TAC-1 as named
  constants with tests. No renderer may embed its own conversion.

## 2. Who has a position

- **Party members, NPCs present at the node, active monsters, positioned objects** (the
  cover-relevant furniture: barrel, cart, altar — MAP_PATH 2.1's "grounded positioned objects").
- Roster NPCs elsewhere: `pos = null` (node-level presence only, as today).
- **Materialization is deterministic:** when an entity becomes present, its spawn cell is
  `f(worldSeed, entityId, frameId, entryContext)` — arrivals enter at the doorway/road edge
  they came by; otherwise a seeded walkable cell. Committed as an engine event through
  `applyDeltas`, never invented at render time. No new randomness source (`rng.js` only).

## 3. Movement semantics (the two-tier ruling, made precise)

- **Tactical move** (the default for "go east", "cross the room", "get behind the cart"):
  engine resolves a target cell, clamps to the **movement budget — 30 ft (6 cells) per turn**
  (flat v1; speed stats later), walks a greedy straight path on the walkable mask, and **stops
  honestly** at obstruction or budget: *"Forty feet of open ground — you close twenty of it."*
  Partial progress is a real, committed move (DM Test: never bounce "invalid move").
  Deltas: `{ op:'pos', id, frame, to:{gx,gy} }` through `applyDeltas()` — the sole mutation path.
- **"go east" NEVER node-jumps.** It is a tactical move east, up to budget, on the current grid.
- **Journey** is the ONLY node-changer: an explicit verb ("journey/travel to Aldermere"),
  resolved as today's node travel (time, roads, encounters), arrival cell seeded at the entry
  edge. Tactical moves compose upward into journeys only through this verb.
- **Threshold crossing:** stepping through an entry doorway swaps frame `struct:` ↔ `place:` at
  the door's mapped cells (`floorPlan` doors already carry `x, y, dir` — they become the
  transition cells).
- **Diagonals:** 5 ft per step v1 (5e-style). Deferred: variable terrain cost, facing, elevation.

## 4. Propose → ground → commit (Rung-1 applied to space)

The LLM **interprets**, the engine **owns the geometry and the number** (V11: models get
direction right and magnitude wrong — never let the model set the number):

- The intent translator (INT arc) proposes a typed spatial packet:
  `{ kind:'move', ref:{type:'direction'|'object'|'npc'|'room'|'door', value}, relation:'behind'|'beside'|'toward'|'away'|'through', magnitudeFt? }`
- The **engine grounds** the ref to cells (object anchor + adjacency on the walkable mask;
  "behind X" = the far-side adjacent cell relative to the threat/player axis), validates
  (walkable, budget, blocking occupancy), then **commits or adjudicates** the shortfall
  in-fiction. The LLM never emits a coordinate that is trusted; `parseIntent` ("go east",
  "north 10 feet") stays the LLM-off floor.

## 5. Determinism, invariants, migration

- `pos` is hashed (it's canon). All writes via `applyDeltas`. Resolution is a pure
  `f(world, intent)`. Replay equality (U19/21/22/27/30) must hold across the change.
- **New invariants (TAC-1):** `pos` is null XOR (frame exists ∧ gx/gy integers in bounds ∧ cell
  walkable); while `roomOccupancy` remains primary, `roomOf(pos)` must AGREE with it (position
  starts as the *finer detail* of the occupancy truth, then a later packet flips the derivation
  so occupancy derives from position — staged, so nothing live breaks).
- **Blocking:** ≤1 blocking entity per cell inside combat frames (XCOM rule); soft outside
  combat in v1. Multi-cell creatures reserved (bestiary sizes) — v1 places everyone on 1 cell
  and flags the big ones as a follow-up.
- **`WORLD_VERSION` bump — once, at TAC-1**, full protocol: `ensureWorld` backfills `pos:null`
  + defaults; invariants added; old-save warn (d50c49f pattern); grep version-embedded test
  strings; full suite + `playtest:quick`.
- **Range-band coexistence:** escapeCombat's `far/near/engaged` stays authoritative for combat
  until a dedicated packet derives bands from cell distance. The mapping is pinned NOW so
  nothing drifts: **engaged ≤ 5 ft · near ≤ 30 ft · far > 30 ft.**

## 6. Renderer contract (what WS/map consume)

- `worldSpace.js` (WS-1) grows frame transforms: `{frame,gx,gy}` → `{wx,wy}` =
  frame origin + cell × CELL_WU. The mini/marker consumes **engine position** — room-granular
  today, cell-granular the moment TAC-1 lands (the renderer "snap" is one small change by then).
- Pixel walk-pos (`ux/uy`) is demoted permanently to *animation tween toward engine truth*.
- The map stays read-only: no click-to-move, ever; camera/zoom/tilt never write.

## 7. Rollout packets (serial lane: state/playloop; cut on the INT-3 template)

| Packet | What lands | Risk gate |
|---|---|---|
| **TAC-1** | schema + migration + invariants + seeded party/NPC placement (DARK — nothing consumes) | `WORLD_VERSION` bump; hash replay green |
| **TAC-2** | tactical move verb, LLM-off floor ("go east" walks ≤6 cells); honest partial-progress narration | playloop serial; corpus locks |
| **TAC-3** | INT spatial family — translator proposes the typed packet | INT-4 template; echo-first UX |
| **TAC-4** | renderer square-snap (worldSpace consumes `pos`; live map-fidelity verify) | renderer lane, parallel-safe |
| **TAC-5** | positioned objects + object-relative grounding ("behind the barrel") | MAP_PATH 2.1; schema addendum |
| *(then)* | DX-3+: cover / line-of-sight / flanking crunch in escapeCombat | out of this contract; enabled by it |

**Explicit non-goals v1:** A* pathfinding, facing, elevation, opportunity attacks, initiative
changes, multi-tile creatures, terrain movement costs. Each is *representable* under this model
and none is owed now.

## 8. What would falsify this contract

If TAC-1's hash-stability work shows seeded placement can't stay replay-stable across
`ensureWorld` upgrades, the fallback is NOT renderer-side position — it is narrowing scope:
canon position for party + combat-active entities only, `pos:null` for everyone else until
materialized. The ruling (canon, not renderer) does not flip.
