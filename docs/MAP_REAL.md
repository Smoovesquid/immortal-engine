# MAP-REAL — the drawn world and the simulated world are the same object

*Tim's commission, 2026-07-05 (live playtest session): "make this map function properly and not just
make minimal fixes… I need walls, doors and windows and all architecture drawn on the map to be
functionally real." This doc is the arc contract. Siblings: `POSITION_AS_CANON.md` (position model —
MR-1 executes its rollout), `MAP_PATH.md` (phases 1–2 fold into this arc), `TABLETOP_MAP.md` (the TT
render layers this binds to truth), `MINIS_WISHLIST.md` (Tim's standing asset ledger).*

## STATUS: ✅ COMMISSION COMPLETE — v0.30.0 build 098 (2026-07-06)
All six promises live or machine-guarded (position probe + GEOMETRY_BREACH + FEATURE_BLOCK + CG-ARCH
standing in `npm run check`). Falsifier list below remains ACTIVE law — any reproducible violation
reopens the arc.

## The ruling
The map is not a picture OF the world; it is a view INTO the one real world. Ink is law: anything
drawn is simulated, anything simulated is drawn. Symptoms retired by this arc, named at cut time:
the go-outside 1 km teleport (2026-07-05), ghost-Galen "in the bedroom", five strangers assigned to
the wake cottage, DM-invented geography (the historical root class).

## The six promises (each is a falsifier, not a vibe)
1. **Architecture is real.** Walls block everyone (player, NPCs, narration). Doors are the only
   crossings and carry state — open / shut / barred / locked — as engine facts (**Tim: "full
   crunch"**; a locked door is real play: picks, force, a window, talk — with noise and witnesses).
   Windows are true apertures: sight both ways, sound, story use.
2. **Position never lies.** Wake = your bed. Outside = your doorstep, through your actual door.
   Walk/journey/fight = the marker is where the body is. No snaps at any zoom.
3. **What's drawn there is what's there.** People/props = engine occupancy (OCC-STORY reasons why);
   no mini ever renders inside ink that isn't its own.
4. **One continuous map.** Region ↔ room, one coordinate space, one camera law (player-centered,
   THE MOVEMENT LAW's continuous sheet).
5. **Beauty is locked.** The 2026-07-05 paper/ink/minis look survives every stage. "Real" changes
   what ink MEANS, never how it looks.
6. **Read-only.** DM is the only verb; the map informs and never becomes the controller.

## Interview rulings (Tim, 2026-07-05 — LAW for this arc)
- **Wilderness = fog-procgen:** walkable scenes materialize on demand in the visibility bubble,
  deterministic in (seed, position) — revisits regenerate identically; canon (mintFact/narration)
  is never re-rolled. Journey fast-travel skips materialization except at event stops. Trees (and
  wild props) are minis; you are a mini among them.
- **Minis pipeline = mix by role:** GLB/Meshy for landmarks, architecture, hero pieces; procedural
  archetype figures for crowds/filler. Wishlist rows carry the tag.
- **Floorplans stay ALWAYS-OPEN** (DM-screen aesthetic; roofs rejected). Consequence: strict
  placement rules are the ONLY defense against wrong-looking figures → TT-OCC is load-bearing.
- **Doors = full crunch** (see promise 1).

## Stages (root-first; every stage ships, bumps the version, and is verified on Tim's screen)
| Stage | Packet(s) | What it is | Lane |
|---|---|---|---|
| 0 | **MR-ORACLE** (U496–497) | Position-truth probe in the playtest harness: after each scripted transition (wake/exit/enter/walk/journey), assert marker-vs-fiction anchor + interior moves vs room topology. RED against today's build by design (the 1 km bug becomes a failing test first). Optional mode (`playtest:position`) until MR-1 lands, then wired into `npm run check`. | harness, parallel — **DISPATCHED** |
| 3a (early) | **TT-OCC** (U494–495) | No mini inside foreign ink: outdoor scatter excludes all plan footprints + margin. Renderer-only. | `public/map`, parallel — **DISPATCHED** |
| 1 | **MR-1** (cut on `POSITION_AS_CANON.md` §7 template) | One engine-owned position store; v1 walk-pos becomes a view; egress-through-the-door to doorstep coords. Turns MR-ORACLE green. | engine serial — **QUEUED behind SL-5's slot**; brief to Tim for OK at cut |
| 2 | **MR-2** (slice on cut) | Ink functional: walls block movement, door states + crossing law, windows as LOS apertures, DM proposals ground against the real plan (kills DM-invented geography). House-builder loader = authored plans become truth. | engine serial, after MR-1 |
| 3 | **MR-3** | Fog-procgen wilderness scenes (deterministic bubble), OCC-STORY behaviors visible on the sheet, wishlist minis wired as they arrive. | renderer + engine/world, parallelizable |

## Standing duties
- Every lane that wants an asset APPENDS to `MINIS_WISHLIST.md` (dated, tagged GLB/procedural).
- Every stage's done-when includes a live screenshot from Tim's actual screen (map fidelity rule).
- Falsifier list for the arc: any reproducible wall-walk, doorless exit, position snap > one square,
  mini inside foreign ink, or DM line naming architecture the plan lacks = the arc is NOT done.
