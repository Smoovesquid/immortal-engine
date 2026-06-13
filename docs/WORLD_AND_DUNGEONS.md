# The World & The Underworld — generator + canvas

**Status:** specced 2026-06-12 (Tim). The master plan for finishing the surface
geography and building the dungeon system beneath it. Camera substrate is
`docs/ONE_MAP.md` (M1–M5 shipped). Read that first.

## The vision (Tim's words)

> "This game will be both a **generator and a canvas**. People should someday be
> able to build their own worlds. For now, we follow actual D&D conventions. We
> need small underground **one-room shrines in people's basements**, and
> **Moria-like sprawling worlds beneath our feet with levels that seem to never
> reach a bottom**. We need all of this potential."

Two commitments fall out of that:

1. **Everything is authorable data.** A world, a region, a dungeon, a room — all
   are plain data (the pattern already proven by `content/arcs/*.arc.js`,
   `content/recipes/*`, build plans). **The generator is just one author.** Build
   the data schema and the consumers (renderer, crawl loop) FIRST; a procedural
   generator emits that data; a human writing the same data by hand is the
   "canvas" (user-built worlds, later). Never hard-code what could be data.
2. **One system, every scale.** A cellar shrine (1 room) and Moria (∞ levels)
   are the *same* dungeon system parameterized — not two features. If the schema
   and loop can't express both, they're wrong.

## Inherited laws (non-negotiable — see CLAUDE.md, docs/THE_DM_TEST.md)

- **The DM is the only verb.** Movement and action are conversation. The map is a
  PURE VIEWER (pan/zoom). No click-to-travel, no click-to-move. Navigate a
  dungeon by telling the DM ("I take the dark stairs down"). See
  [[project-dm-only-verb]].
- **Registers only what you've seen.** The map (surface and underground) is
  fog-of-war memory — blank until your boots earn it, frozen as last seen, never
  a Marauder's Map. **Dev exception (now):** render everything unfogged while we
  build the art; the fog hood goes back on as its own layer before play.
- **Determinism is the floor.** All generation seeded via `engine/rng.js`
  (`makeRng(seedFromString(...))`). No `Math.random`. `worldHash` stays
  replay-stable. Lazy/infinite content generates deterministically from
  `seed + id + depth`, so the 40th floor of Moria is the same every descent.
- **Narration ≠ canon; mutations via `applyDeltas`.** Standard engine contracts.
- **No WORLD_VERSION bump unless state shape genuinely changes** (and then the
  full CLAUDE.md checklist). Prefer pure projections (like `biome.js`).

---

# PART A — The Surface: finish the geography (M6)

Build the map's illustrated ground on the biome system that **already exists and
drives gameplay**: `engine/world/biome.js` → `biomeForNode(seed, node)` (biomes:
forest, plains, marsh, mountains, coastal, desert, arctic, wilderness; pure,
deterministic, node-aligned, used live for travel flavor + encounters). The map
must AGREE with what the DM narrates and what species/travel reactions will later
read. (`engine/world/regionGen.js` is a richer elev/moisture/river/sea generator
but is NOT wired to the live world and uses a different coordinate space — mine it
for technique only; do not render from it.)

The renderer (`public/map/oneMap.js`) paints the coarse canonical biome richly:

- **Forests** — conifer (fir silhouettes) AND deciduous (irregular canopy clumps)
  varied within `forest` country. **Organic clumping, no lollipop trees.**
- **marsh → swamp** (reeds + black standing water); **desert** (dune hatch);
  **mountains/arctic** (peaks + snow).
- **Water threaded in**: rivers tracing high→sea, lakes, small ponds, pocketed by
  biome (wet biomes get more).
- **Set-pieces, seeded per world** (each world different):
  - **Ocean on one edge** — a ragged Maine-style coastline (deeply indented bays
    + peninsulas) with offshore **islands**, placed beyond the node cloud so it
    never swallows a node. Wave-hatched.
  - **Mountains as a RANGE** — a seeded ridge-line spine of overlapping peaks (a
    Misty-Mountains backbone), not just scattered cells. It reads as a barrier
    (future travel cost / passes) and is the natural home of dungeons.
  - **The Blasted Heath** — a blackened, cracked, Mordor-ish dead zone placed
    FAR off (possibly across the ocean). Rendered map-side for now; structured to
    graduate into a real `biome.js` biome later (the file already notes a special
    `volcanic` hook).
- **No blank**: biome fills corner to corner. **Organic shapes** (wobbled/noised
  boundaries, never clean ellipses).
- **Queryable**: expose `biomeAtWorld(seed, wx, wy)` (the `biomeForNode`
  projection in world units) so the future "species & characters react to
  environments; travel changes" logic and the map read ONE truth.

**Conifer vs deciduous**: render as variation within the single `forest` biome
for now. If they should become distinct canonical biomes the game knows about,
that's a small `biome.js` addition (decision deferred to Tim).

**Done-when (M6):** open the map → a continuous, wall-to-wall world with every
feature PRESENT and correct: two forest types, desert, swamp, lakes/rivers/ponds,
a mountain range, an ocean coast with islands, a far Blasted Heath — all
deterministic per seed, organic, no lollipops. (M6 is about the geography being
THERE and right; M7 makes it beautiful.) Suite + playtest:quick green;
live-verified with screenshots (curate a biome-spanning demo seed). Pure viewer.

## M7 — the finish (beautification): make it award-winning

M6 gets every feature on the parchment; **M7 is the dedicated art pass that makes
it gorgeous** — Tim's founding ask was "make it more beautiful, like award
winning," and that is a tracked deliverable, not a side effect of M6. Beauty is
TASTE: screenshot every pass and iterate with Tim's eye; "geographically complete
but programmer-art" is NOT done.

The finish checklist (carry-over from the ONE_MAP M5 iteration list, plus):
- **Trees** — denser, varied conifer/deciduous clumping; organic, never lollipops.
- **Labels** — a calligrapher's hand: paper-colored halo so names read over
  terrain; small-caps/italic registers per feature type (settlement vs region vs
  water); curved labels following coasts/ranges where it sings.
- **Parchment** — real fiber/stain/age texture and edge wear, beyond the vignette.
- **Glyphs** — proper cartographer's marks for towns/POIs (cluster-of-roofs,
  ringed dots), a compass rose, a scale cartouche, maybe a title frame.
- **Ink consistency** — unify the near-band village/cutaway buildings (M2/M3,
  cleaner-edged) with the sepia hand-drawn world: one pen drew the whole map.
- **Color & light** — cohesive aged-map grade across all bands; biome palettes
  that harmonize; the Blasted Heath genuinely *wrong* against the warm parchment.
- **Heard-of annotations** — refine the scrawl (varied hands, ink bleed) so it
  reads unmistakably as the player's own uncertain pencil.

**Done-when (M7):** the map reads as illustrated antique cartography you'd frame
on a wall — at every zoom band, surface and (later) underground. Verified with
Tim's eye over screenshots; deterministic; pure viewer; suite + playtest green.

---

# PART B — The Underworld: the dungeon system

## The data schema (build this first — it's the contract for generator AND canvas)

A **dungeon** is data, authorable by hand or machine:

```
Dungeon {
  id, seed, theme,            // theme: 'mine'|'crypt'|'shrine'|'lair'|'sewer'|
                              //   'hold'|'infernal'|... (drives rooms/dressing/foes)
  entranceNodeId,             // the surface node you descend from
  scale,                      // 'shrine'(1 room) | 'small' | 'site' | 'mega'(∞)
  levels: [ Level, ... ]      // lazily extended for 'mega' (never a hard floor)
}
Level {
  depth,                      // 0 = entry; deeper = deadlier (tier scales)
  topology,                   // room graph — REUSE engine/structures topology.js
  rooms: { roomId: Room },
  downStairs, upStairs        // links between levels
}
Room {
  id, role,                   // 'entry'|'chamber'|'corridor'|'vault'|'lair'|
                              //   'shrine'|'crypt'|'prison'|'cache'|'puzzle'...
  exits,                      // directional, REUSE interiorDirectionalExits
  contents: [                 // populated deterministically by tier+theme:
    {kind:'encounter', ...},  //   bestiary + biome tables, CR by depth
    {kind:'treasure', ...},   //   hoard tables + sealed magic (P-77)
    {kind:'trap', ...},       //   P-76 (to build)
    {kind:'feature', ...},    //   shrine effect, lever, fountain, inscription
    {kind:'boss', ...}        //   P-75 legendary/lair, at the heart
  ],
  dressing,                   // REUSE engine/decompression furniture
  light                       // dark by default — REUSE engine/env light residue
}
```

The same schema expresses a 1-room cellar shrine (`scale:'shrine'`, one Room with
a `feature`) and an endless Moria (`scale:'mega'`, `levels` generated lazily).

## The scale spectrum (all of it — "we need all this potential")

| Scale | Shape | Lives where |
|---|---|---|
| **shrine** | 1 room, a feature or single encounter | a basement/cellar under a building; a roadside crypt |
| **small** | 5–12 rooms, one level, an objective/boss | a hill cave, a ruin |
| **site** | 20–60 rooms, multi-level, locked sections, descent, real boss | a mountain hold, a necropolis |
| **mega** | lazily-infinite levels, tier climbs with depth, "never a bottom" | the deep places beneath the mountains — Moria |

Same generator, same crawl loop, same renderer — parameterized by `scale`.

## D&D conventions (the grounding — "follow actual D&D for now")

Room types, dungeon dressing, **encounters by CR**, **treasure by hoard**,
**traps** (DC to spot/disarm, save/effect), **boss + lair actions**, locked doors
+ keys, secret doors, light/darkness, the descent. Lean on SRD/DMG conventions
already encoded in the bestiary (CR bands), loot tables, and P-75.

## What already exists — REUSE, do not rebuild

- **Room-to-room navigation**: `engine/structures/interiors.js`
  (`enterStructureInterior`, `moveWithinInterior`, `interiorDirectionalExits`,
  `getInteriorView`) + `topology.js`. A dungeon level is a structure with a
  bigger, branchier room graph. This is the crawl primitive.
- **The map IS the dungeon interface**: M3 roof-cutaway renders interiors in
  world space; the fog law means **the dungeon map inks in room by room as you
  crawl** — the best fog-of-war there is. The continuous camera makes
  surface→descent a zoom. (`public/map/oneMap.js`, `worldSpace.js`.)
- **Boss mechanics (P-75, shipped)**: legendary + **lair actions** (literally a
  dungeon-boss feature) + phases. Elite bestiary has dungeon bosses ready
  (Entropic Sphinx, Necropolis Gate). `engine/combat/bossActions.js`.
- **Treasure (P-77, shipped)**: sealed magic loot + identify/attune + named
  uniques. `engine/ruleset/core/items/magic.js`.
- **Encounters**: bestiary (642 creatures, CR bands) + biome encounter tables +
  the geographic danger tier (`placeFromNode` tier; `biomeForNode`).
- **Light/dark**: `engine/env/` residue (a dark dungeon is a real condition).
- **Villain & confrontation arc (P-74c)**: the dungeon at the villain's seat.
- **Movement by conversation**: the DM-only-verb path through `playerMove`.

## What's NEW to build

1. **Dungeon generator** → emits the schema deterministically (`seed + node →
   dungeon`), themed by the surface biome/mountain it sits under. Extends
   `structures/` topology to dungeon scale + branchiness + multi-level.
2. **Population** → place encounters/treasure/traps/features/boss across rooms by
   depth-tier + theme, deterministically.
3. **The crawl loop** → wire `dungeon_entrance` nodes: descend → explore room by
   room (conversational) → map reveals (fog) → fights/traps/loot/features → boss
   climax → reward → ascend/exit. Mostly composition of the above.
4. **Traps & hazards (P-76)** → the one genuinely-missing mechanic (specced in
   PACKETS, parked behind R2/object-model). Build a lean trap system inside the
   dungeon work, or pull R2 forward — Tim's call at that packet.
5. **Multi-level descent + lazy-infinite** → levels generated on demand from
   `seed + dungeonId + depth`; tier/CR scales with depth; no hard bottom.

## Staged packets (the new window executes these in order, airlock discipline)

- **M6** — finish the surface geography (Part A): every feature present & correct.
  ✅ **DONE 2026-06-13.** `public/map/geography.js` (new) is the pure, seeded
  *author* — it emits the world as drawable DATA and draws nothing itself: world
  rect, a ragged ocean coast + offshore islands on a seeded edge (proven never to
  swallow a node), the mountain RANGE as a banded ridge-spine, the far Blasted
  Heath, rivers tracing high→sea, lakes pocketed by biome wetness, and
  domain-warped biome terrain STAMPS (organic, interlocking, no lollipops).
  `worldSpace.biomeAtWorld(seed,wx,wy)` is the ONE-truth projection of the LIVE
  `biomeForNode`, so the painted ground AGREES with what the DM narrates (and the
  future species/travel logic reads the same truth). `oneMap.js` is the *pen*:
  per-biome motifs (conifer + deciduous firs, reeds over black standing water,
  dune hatch, snow-capped peaks, scrub, grass), faint regional fills, fading out
  across the settlement band so M2/M3 village layouts own the close ground.
  `Z_MIN`→0.012 frames the whole world. Pure viewer (pan/zoom only); deterministic
  (`makeRng`/seeded value-noise, no `Math.random`); client-side, so `worldHash` is
  untouched. U136 ×7; suite 7,578 green; playtest:quick clean; live-verified in
  v1.html on the `blackvale` demo seed — ocean coast, the snow-capped range band,
  two forest types, lakes, rivers, the cracked Heath, all eight biomes present;
  settlement-band layouts confirmed intact (screenshots). **M7 makes it beautiful.**
- **M7** — the finish (beautification): the dedicated art pass that makes it
  award-winning. Taste-driven — iterate with Tim over screenshots. Can run right
  after M6, and again later to beautify the dungeon interiors once D0–D3 land.
- **D0** — the dungeon **data schema** + a trivial generator + the **one-room
  shrine** (smallest scale) reachable from a `dungeon_entrance` (or a building
  basement), rendered as a cutaway on the one-map with fog-reveal, navigated by
  conversation. Proves the whole spine end-to-end at minimum scale.
- **D1** — the **small multi-room dungeon** generator (D&D room graph, themed) +
  **population** (encounters + treasure, reusing bestiary/loot) + the **crawl
  loop**. A real short crawl, fog-revealed, conversational.
- **D2** — **traps, locked/secret doors, light/dark** (P-76 lean + env).
- **D3** — **multi-level + descent** + **boss climax** (P-75) + **reward** (P-77
  named loot) + optional villain-seat binding (P-74c).
- **D4** — the **megadungeon**: lazy infinite descent, depth-scaling tier, never a
  bottom. (Moria.)
- **D5 (later)** — the **canvas**: hand-authorable dungeon data files (like arcs)
  — the seed of user-built worlds.

Each packet: small bounded diff; baseline tests first; full `node --test` +
`npm run playtest:quick` (use `playtest:full` if it touches worldTick/state
shape/combat) green; **live-verify in v1.html with screenshots** per
`docs/PLAYTEST_PROTOCOL.md`; apply THE_DM_TEST to every player-facing string;
commit `feat(<module>)` with files staged by path; mark the packet done in this
doc in the SAME commit; push. If a packet can't be made green in scope, revert it
cleanly, mark BLOCKED here with why, and continue.

## Out of scope (now)

- User-facing world-builder UI (D5 lays the data groundwork; the editor is later).
- Making biomes mechanically real (species/travel reactions) — a separate engine
  effort the M6 `biomeAtWorld` query sets up; not built here.
- Siege/destruction of player-built forts; real-time anything.
