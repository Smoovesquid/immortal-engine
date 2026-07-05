# MR-3 — THE FOG-PROCGEN WILD: the fog hides a world that was always there

*MAP-REAL stage 3 design (Basecamp, 2026-07-05 night). Tim's own ruling (interview): "Why not just
procgen what is in the fog of war area?" — adopted as LAW with one addition: deterministic in
(seed, position). Sibling rulings that bind here: trees are minis and you are a mini among them;
mix-by-role assets (procedural until Tim's GLBs land); beauty locked (ink/paper — the unrevealed
world is UNPAINTED PARCHMENT, never black fog); THE MOVEMENT LAW (≤6 cells walking, journey = priced
fast-forward); one continuous sheet.*

## The one law
Every wild feature is a pure function of (worldSeed, region cell). Nothing is stored; nothing
re-rolls; the visibility bubble materializes on demand and re-derives identically forever. Walking
back to the same clearing shows the same trees — permanence WITHOUT memory. (Canon overlays — "you
chopped that tree" — are ledger/canon facts layered on top, OUT of scope v1; see non-goals.)

## Slices

### MR-3a — the wild-feature derivation (engine)  ·  U533–U536
- New pure module (suggest `engine/world/wildFeatures.js`): `wildFeaturesAround(world, {gx,gy},
  radius)` → features `{kind, cell, sizeClass, blocking}`. Kinds v1: tree, boulder, brush, deadfall,
  stump. Seeded per cell-cluster with the FNV/h32 technique the map already uses — zero Math.random.
- Biome-aware density (slice region terrain data): forest dense · margins sparse · clearings seeded ·
  ROADS AND RIVERS KEEP CLEAR CORRIDORS (the one-road-truth data) · settlement footprints excluded
  (settlements own their ink).
- Blocking features block: their cells join the region-frame walkable picture; a tactical move stops
  honestly at a tree ("the pine's in your way — you're two strides short"). Position probe grows the
  outdoor assertion: committed pos never lands ON a blocking cell.
- Tests: determinism ×2 boots · density bounds per biome · corridor clearance · blocking honored by a
  tactical move · worldHash untouched (pure reads only).

### MR-3b — the wild drawn (renderer)  ·  after 3a + TT-MINIS  ·  U539–U541
- Walking zoom outside settlements: the bubble's features render as minis on the paper (procedural
  archetypes now; wishlist GLBs slot in per mix-by-role as Tim makes them). Beyond the bubble: the
  page fades to unpainted parchment — a soft ink-wash edge, no hard ring, NEVER darkness.
- Camera law unchanged (player-centered). Read-only map unchanged. Determinism: same (world, pos) →
  identical feature token model.
- Tests: token-model determinism · no feature tokens inside settlement footprints · fade band exists ·
  TT-OCC's no-foreign-ink law extended to wild features (no tree grows through a drawn building).

### MR-3c — the wild narrated (engine look seam)  ·  after 3a  ·  U542–U544
- Outdoor look-around composes the derived scene (narratorContext outdoor facts: notable features by
  direction — "deadfall to the north; the road runs west"), capped and stable-ordered; DM prompt gets
  the same facts, hide-the-math. Journey interruptions (JR-1) land in a materialized bubble — the
  look at an event stop reads real features.
- Tests: LLM-off composition reads features deterministically · caps hold · CG detector bank silent
  on composed output.

## Sequencing
LOADER-MERGE (in flight) ∥ **MR-3a (engine, dispatch now)** ∥ **TT-MINIS (renderer, dispatch now —
U537–U538: defeated entities render as corpse minis via the sibling's miniLibrary.js seed + Tim's
GLBs)** → then MR-3b (renderer, needs 3a's shape + TT-MINIS' loader precedent) ∥ MR-3c (engine seam).

## Falsifiers (the arc is NOT done if…)
Same clearing renders differently on revisit · a walk between two slice settlements crosses void
inside the bubble · a tactical move ghosts through a blocking feature · any `Math.random` · a tree
inside a building's ink · the fog edge reads as darkness instead of unpainted page.

## Non-goals v1 (representable later, not owed now)
Feature destruction/persistence (canon-overlay packet, kin of OCC-STORY-2) · wildlife/creature spawns
(bestiary lane) · weather/seasons · wild interiors (caves = structures, existing machinery).
