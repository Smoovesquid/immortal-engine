# MR-2 — FUNCTIONAL INK: walls block, doors have states, windows see, the DM can't invent geography

*MAP-REAL stage 2 design (Basecamp/Fable, 2026-07-05). Tim's ruling: "walls, doors and windows and
all architecture drawn on the map must be functionally real" + interview: doors = FULL CRUNCH.
Slices below queue AFTER MR-1a/1b land. Engine slices need Tim's OK at dispatch (gate ritual).*

## The one law
The floorplan is the single physical truth. Engine movement, DM narration, and the renderer all read
THE SAME plan. Anything the plan lacks does not exist; anything it has, works.

## Slices (cut order; each independently shippable)

### MR-2a — walls block + door states (engine, serial; **WORLD_VERSION bump**)
- Walkable mask derived from each structure's plan (walls → blocked cells; door cells = the ONLY
  struct↔region crossings; `POSITION_AS_CANON` §3 threshold law already pins this).
- Door state = canon: `{open|shut|barred|locked}` per door, stored on the structure (schema addendum
  → ONE `WORLD_VERSION` bump, full protocol: ensureWorld defaults, invariants, old-save warn, grep
  version-embedded test strings). Default derivation seeded (homes shut, shops open by daylight,
  wake-cottage door shut-not-locked). All mutations via `applyDeltas` ops (`door` op).
- Movement resolution consumes the mask: a tactical move stops honestly at a wall; a shut door is a
  one-action open-first; barred/locked = real play (force/pick rolls exist already in resolve.js —
  wire, don't invent). Lockpicks finally matter. Noise/witness hooks: emit a ledger fact on forced
  entry (moral-physics seam — consequence, not blocking).
- Falsifier: any committed move that crosses a wall segment without a door = red (MR-ORACLE grows a
  GEOMETRY_BREACH assertion the same packet).

### MR-2b — the DM grounds architecture claims (engine narration seam, serial)
- Propose→ground→commit (V15, Rung-1): before narration ships, architecture references (doors,
  stairs, rooms, windows) ground against the real plan — the guard/composer seam gains a plan-facts
  bundle (rooms, doors+states, windows, exits) so the DM describes THE house, never A house.
- Coherence checker (CG family) gains an architecture class: narrated-geometry-not-in-plan.
- Falsifier: DM names a room/door/stair the plan lacks → CG flags it; corpus probe locks the wake
  cottage's real layout.

### MR-2c — house-builder loader (engine/world, parallel after 2a schema)
- Loader for the authoring tool's export (verified shape: walls as segments; `openings` =
  doors/windows `{x,y,orient,len}`; tunnels dual-exported): authored plan → structure topology +
  plan + mask, keyed by structure id; authored OVERRIDES procgen for that id, stgen keeps the rest
  (STRUCTURE_SCHEMA_VERSION note: bump only if the interior contract changes — target is no bump).
- Determinism: loading is pure; same file → same structure; worldHash stable under replay.
- Falsifier: Tim draws a house, walks its rooms in-game; any mismatch between drawn and walked = red.

### MR-2d — windows are apertures (engine LOS, after 2a)
- Window cells = sight-permeable, not walkable. Look-around composes through them: from inside, the
  street's outdoor occupants within the window's facing arc are visible ("through the shutter you
  see Galen at his stall"); from outside, lit/occupied rooms read through their windows.
- Feeds `roomOccupancy`'s line-of-sight model (its header already promises "you can see OUT through
  windows"); OCC-STORY reasons ride along when that lane lands.
- Falsifier: seeing an NPC through a wall, or failing to see one square through an open window.

## Sequencing + lanes
MR-1a → MR-1b → **2a** (serial, gated, the bump) → **2b** (serial) ∥ **2c** (parallel post-schema)
→ **2d**. TT-lane renders door/window states visually whenever assets exist (door leaf + shutters
are already top of `MINIS_WISHLIST.md` — procedural placeholders acceptable until Tim's minis land).

## Explicit non-goals (v1 of stage 2)
Multi-floor pathing (stairs = room links, not 3D), NPC pathfinding around furniture (A* deferred per
POSITION_AS_CANON non-goals), sound propagation physics (noise = ledger facts, not simulation),
climbing through windows as a movement verb (story-resolvable via DM, not a mechanic yet).
