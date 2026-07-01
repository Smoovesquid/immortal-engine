# Map — autonomous packet queue

**STATUS (2026-07-01): all four packets DONE.**
- P1 ✅ enemy figures on the combat board — v0.16.0 (`010a83d`)
- P2 ✅ populate the world (camps + livestock) — v0.17.0 (`558f5fe`)
- P3 ✅ authored landmark buildings in town — v0.18.0 (`71e1509`)
- P4 ✅ green check (`node --test` 9032 pass / 0 fail; determinism intact) + real-builder
  verification of every place. Note: v1's 3D map is a hub-accessed read-only aid not
  reachable from the play screen headless, so the "tour" was verified via map-proto labs
  that import the REAL builders (buildSettlement/Wilderness/ChapelRuin/Building,
  buildArchetypeFigure) — the same code the game runs. Live v1 boots clean at v0.18.0.

---


Four bounded packets that take the demo region from "assets gathered" → "walkable,
populated, fightable." Each needs **no new input from Tim** (all assets already in
`public/map/assets/`), self-verifies (live preview screenshot / harness importing the
real builders), commits itself, and bumps the version when player-facing. Run in order;
report after each. If a taste call comes up, pick a sensible default and flag it — don't
stall (see [[feedback_autonomous_loop_no_stall]]).

Current state: cottage interiors LIVE (v0.14.0) · chapel LIVE (v0.15.0) · full enemy +
building + prop roster gathered as GLB packs. Splitter = `glbSplit.splitIslands`.

---

## Packet 1 — MAKE IT FIGHTABLE (enemies on the combat board)
Split the enemy packs into individual figures and serve the right foe per fight.
- `figureKit` loader (sibling of `ruinKit`): load each `enemies_*.glb`, split into figures,
  index them. Map enemy → figure by archetype + name keywords: undead →
  skeleton/wraith/deathknight/lich; beast → wolf; humanoid/bandit → bandit; boss/elite →
  warlord. Hook into `figures3d.buildArchetypeFigure` (already has a GLB seam via
  `figureAssets`), human-height, elites upscaled.
- **Verify:** seed combat saves (a bandit, a chapel skeleton/wraith, a wolf) and screenshot
  each on the live combat board.
- **Done when:** ≥3 distinct enemy types render correctly on the live board. Version bump.
- *Default I'll pick:* the enemy-name → figure mapping.

## Packet 2 — POPULATE THE WORLD (Greenwood · Crowfoot Camp · Aldermere)
Put the cast into the places.
- Wire **Crowfoot Camp** (the `buildCampTent` scene is built-but-dark): tents + campfire +
  palisade + bandit figures + loot (barrels/crates), on the camp node.
- Scatter **wolves + a bandit** in the Greenwood (wilderness node).
- Add **livestock** (chickens/ducks/cows/goats) to Aldermere.
- **Verify:** live-map screenshots — forest with wolves, camp with bandits, town with animals.
- **Done when:** all four places show their inhabitants on the live map. Version bump.
- *Default I'll pick:* placement density + camp layout.

## Packet 3 — POLISH BUILDINGS & INTERIORS
Make what's live look intentional.
- Interior: confirm + tune the furniture (dresser/chair/stool/cauldron placement, fix any
  overlap/scale), rug + floor read; give the **inn** a fuller interior (procedural bar
  counter + kegs).
- Exteriors: drop authored shells (`inn_crooked`, `smithy`, `cottage_blue`,
  `cottage_thatched`) into town as **landmark buildings** for silhouette variety
  (non-peelable; the procedural cottages stay the enterable ones).
- **Verify:** peel screenshot (clean interior) + town skyline (authored landmarks).
- **Done when:** interiors intentional + town has authored landmark variety. Version bump.

## Packet 4 — WALK THE DEMO + GREEN CHECK (end-to-end)
Prove it holds together.
- `npm run check` (suite + determinism + convergence + git sync); confirm `worldHash`
  stable (the map is pure-view, so it should be) and fix any regression.
- Drive the live game through the four places + one fight; capture a **screenshot tour**;
  fix visual bugs found, or queue them.
- Sync docs (`MAP_ASSETS`, `DEMO_ASSET_LIST`, `MAP_PATH`); ensure everything committed.
- **Done when:** `npm run check` green + a screenshot tour (town/forest/camp/chapel/fight),
  issues fixed or queued.

---

Sequence rationale: **fightable → populated → polished → verified.** After these four, the
demo region is something you can walk through, meet its people, and fight its monsters —
the first genuinely playable slice of the map vision.

---

## NEXT PACKET — one-scene continuous zoom into the fight (the true finish)

Combat is now the one map's tactical view (v0.19.x): no separate combat *screen* anywhere
(`renderContinuousMap` owns it; both the in-play embed and the fullscreen Map screen route
through it). BUT combat still mounts as its OWN 3D scene (`mountCombat3D`) rather than being
the overworld scene zoomed in. The remaining "finish" = render the fight INSIDE the
`mountSlice3D` overworld scene at the player's node, so you scroll in and the board is *there*
on the same ground. Scale checks out: `TILE_WU=40` (~1 m/unit), 5 ft ≈ **1.5 units/cell**, so
a 12×10 board ≈ 18×15 m ≈ **half a node tile** — visible at deepest zoom.

Steps (each verifiable via map-proto labs importing the real builders):
1. **Extract** `buildTacticalBoard(THREE, combatScene, { cell, buildFig, makeLabel })` from
   `mountCombat3D` (dais + 5-ft grid + minis + 30-ft move range + labels → Group + minis[]).
   `mountCombat3D` calls it (regression-check combat-lab renders identically).
2. **sliceScene**: include `combat: combatSceneFromWorld(world)` when active.
3. **mountSlice3D**: when `sceneData.combat`, add `buildTacticalBoard` at the player node
   world pos (`px,pz`) with `cell ≈ 1.5` (5 ft); register its minis into the breathe loop.
4. **continuousMap**: DROP the `renderCombatBoard` short-circuit; always 2D + `mountSlice3D`.
   On combat-start, auto-drive the zoom deep (frame the player node); zoom-out shows it in
   overworld context = continuous.
5. **Retire** `combatView.js` / `mountCombat3D` (or keep the 2D board as the no-WebGL fallback).
6. **Verify**: seeded fight → zoom in → board materializes at the player's node on the one
   scene; zoom out → overworld. Suite green; determinism unaffected (pure view).

Risk: scale/position + camera choreography need visual iteration; do it as a focused pass,
not tail-of-session — rushing risks the working combat view.
