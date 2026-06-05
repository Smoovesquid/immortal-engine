# REPO_MAP — Immortal Engine

Concise map so an agent (or future-you) doesn't re-derive the architecture every
session. Verify against the tree before editing; this is a guide, not gospel.

## Run it
```
npm test                 # node --test, ~6900 tests, prefixes below
npm run dev              # node --watch server.js → http://localhost:5179 (the real game = /v1.html)
npm run playtest:quick  # headless 10 seeds × 50 turns
WORLD_VERSION = 20      # engine/state.js (source of truth)
```

## The one thing that bites every time: there are TWO play surfaces
- **`public/v1.html` + `public/v1.js` (~1900 LoC) = THE REAL GAME.** Canonical engine,
  save/load (`slot1`), AI DM, TTS, chargen, combat. This is the trunk. Ship here.
- **`public/__preview/play.html` = a PROTOTYPE sandbox.** It proved the fused loop
  (region→place→battle→discovery→will) on a *separate lightweight world model*
  (`public/map/worldSession.js`). It is NOT the trunk. Don't confuse the two.
- Many `public/map/` modules (handDrawnPlace, generatePlace, regionSketch, plans/*)
  were built for the prototype and are only now being wired into v1.

## Engine (`engine/`) — deterministic core, the truth layer
- `state.js` — `WORLD_VERSION`, `newWorld()`, `ensureWorld()` (normalizes/whitelists
  world shape — it will STRIP unknown fields; see invariants).
- `playloop.js` (~2300 LoC, largest) — `beginAdventure` / `playerMove` / `newScene`.
  Text-in is the spine: `playerMove(world, packs, text)` parses intent (move, attack,
  cast, talk, search, travel…) → resolve → deltas. Begin places the player.
- `effectsCore.js` — `applyDeltas()`, the SOLE mutation path.
- `resolve.js` — d20 vs DC; approaches force/finesse/endure/heart/focus → MIGHT/AGILITY/GRIT/CHARM/WITS.
- `worldTick.js` — factions, threads, global `w.ecology` (3 scalars), scars, time.
- `invariants.js` — `assertWorldInvariants()` (throws). `worldHash.js` — determinism fingerprint.
- `composer.js` / `llmAdapter.js` / `conductor.js` — narration assembly (LLM silent-fallback).
- `csl/` Canon Log (authoritative). `save.js` export/import.
- Subsystems: `combat/` (combatResolve = deep combat; escapeCombat = travel-ambush beats),
  `structures/` (floorPlan, roomDetail, generateStructures, structuresState, interiors, topology),
  `map/` (generateMap, mapState), `npc/` (genesis, dialogue, npcArc), `discovery/`,
  `magic/` (will, cosmology, willCost, daemon), `ecology/` (foodweb, simulate, regionEcology,
  events, snapshot), `world/` (biome, regionGen), `intent/` (schema, parseIntent, intentFromClick),
  `spell/` (castSpell), `tactical/` (visibility, battle — prototype combat), `goals/`, `chargen/`.

## Browser (`public/`)
- `v1.js` — the app shell (see above).
- `map/LocalMap.js` — the local renderer. Interior → `drawInteriorV2` (authored catalog
  via `planToSceneModel`) with fallback to plain `drawInterior`. Exterior → the
  continuous walkable place (`placeFromWorldNode` + `createPlaceMap`), NOT a tile grid.
- `map/placeNav.js` — collision + continuous movement (`buildPlaceGrid`, `walkTo`).
  Shared spatial truth: walls block, doors/windows carved open.
- `map/handDrawnPlace.js` — `createPlaceMap` (the continuous place renderer: embedded
  buildings, fog/LOS, hitboxes, screenToUnit).
- `map/handDrawnInterior.js` — `createInteriorMap`, `planToSceneModel` (authored plan →
  rich render), `floorPlanToSceneModel` (procedural fallback).
- `map/plans/` — the authored building catalog: `index.js` (PLANS: cottage, tavern,
  chapel, keep, market, longhouse, smithy, barn, mill, manor, bathhouse, …),
  `lairs.js`, `races.js`, `planTopology.js` (`structurePlanFor`, `planToTopology`, ALL_PLANS).
- `map/placeFromNode.js` — `placeFromWorldNode(world, nodeId)` builds the place from the
  node's REAL structures + settlement buildings + NPCs.
- Other map renderers (`MapView`, `Overworld`, `RegionMap`) — overworld/region views;
  the region zoom-out lives on the Map tab.

## Tests (`tests/*.test.js`, 258 files)
Prefixes: `S` surface gates · `N` narration gates · `U`/`UX` unit/audit · `C`/`CM` campfire/combat ·
`G` goals · `D` discovery · `M` magic · `IN` intent · `LW` living-world · `NAV` place nav ·
`ECO` ecology · `REG` region · `R` rumor/prose · `TAC` tactical · `IMM` bench · `W` world.
Determinism guards: `U19/21/22/27/30` (worldHash replay-stability).

## Docs
`docs/IMMORTAL_INVARIANTS.md` (non-negotiables), `docs/PACKETS.md` (active queue),
`docs/LIVING_WORLD_MERGE.md` (the region/ecology/discovery/will merge, P1–P6 done),
`docs/FAILURE_MODES.md` (known drift), plus `CLAUDE.md` (agent rules).
