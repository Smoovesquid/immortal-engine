# Map Asset Library

Authored 3D assets for the map (Meshy-generated → game-ready). All live in
`public/map/assets/*.glb`, decimated (`gltfpack -si 0.85 -noq`) and WebP-shrunk
(gltf-transform `resize` + `webp`). **60 assets, ~49MB total.**

Pipeline + gotchas: `[[meshy-textures-not-tileable]]` memory. Preview via
`public/map-proto/_glbview.html?src=/map/assets/NAME.glb` and the assembled-room
proto `public/map-proto/interior-lab.html`.

## Inventory

### Characters (9) — wired LIVE via `figureAssets.js` (map + combat board)
| file | role |
|---|---|
| hero.glb | player figure |
| lich.glb | undead archetype |
| villager_maid / homemaker / desert / lumberjack / green / grizzled / wasteland | townsfolk pool |

### Enemy / creature packs (⚠ decimated packs — need SPLITTING into individual figures)
Raw Meshy "legion" sheets were ~1.9M tris / 65MB each; decimated to ~150k tris / ~5MB.
Each is a **parts sheet of ~16–20 figures** → split via `splitIslands` (glbkit) into
individual enemies, then wire like `figureAssets.js`.
- `enemies_undead_a.glb` — undead roster: death knights, hooded wraiths, skeletons, liches.
- `enemies_undead_b.glb` — second undead legion (20 figures, similar).
- `enemies_menagerie.glb` — animals: **wolves** (Greenwood enemy) + chickens, ducks,
  cows, goats (Aldermere livestock / ambient).
- `enemies_bandits_a.glb`, `enemies_bandits_b.glb` — human bandits/warriors (6 each).
- `enemies_warlords.glb` — hulking brutes → **bandit captains / elites** (6).
- `enemies_skullbound.glb` — the Skullbound Covenant (cultists — bonus, 31 islands).
- Roster now COMPLETE (all as packs to split): undead · wolves · bandits + captains.

### Foliage (3) — wired LIVE via `treeAssets.js` (instanced scatter)
`tree_verdant.glb`, `tree_gnarled.glb`, `bloom.glb` (flowering shrub)

### Clutter / props (4) — wired LIVE via `treeAssets.js`
`barrel_rustic.glb`, `barrel_wood.glb`, `chest_iron_a.glb`, `chest_iron_b.glb`

### Furniture (6) — LIVE via `makeInterior` (revealed on the cottage roof-peel)
`bed_rustic.glb`, `bed_ice.glb`, `dresser_wood.glb`, `table_rustic.glb`,
`chair_wood.glb`, `stool_wood.glb` (+ `hearth`, `cauldron`, `rug_crimson`, `chest_iron_*`).
Registered in `treeAssets.js`; placed by `worldAssets.makeInterior`. v0.14.0.

### Interior surfaces + fixtures (10) — STAGED in `interior-lab.html`
Wall **panels** (modeled ~1.9m slabs, assemble into rooms — NOT tileable textures):
`wall_planks_wood.glb`, `wall_planks_blue.glb`, `wall_stone.glb`,
`wall_logcabin.glb` (window), `wall_curtain_red.glb` (window),
`portal_timber.glb` (rustic door — used as the room's door),
`portal_gothic.glb` (arched door — reserved for the Hollowed Chapel / crypt).
Fixtures: `hearth.glb` (emissive fire), `cauldron.glb`, `rug_crimson.glb` (floor).

### Buildings (5) — sealed single-mesh shells (no interior; open/dress via panels)
- `cottage_red.glb` — reference cottage shell
- `inn_crooked.glb` — **The Crooked Hearth Inn** (two-story, porch, chimney — the home base)
- `cottage_blue.glb` — Blue Timber Cottage (Tudor: stone base + timber upper, red doors)
- `smithy.glb` — the forge (anvil + chimney; an armored figure is fused into the base)
- `gatehouse_crimson.glb` — fortified gatehouse/keep (twin towers, crimson banner) —
  town gate / keep / campaign use, NOT a smithy

*All fused (1 mesh / 1 texture atlas each): reusable as whole buildings + can take
additions + can be opened for interiors, but NOT separable into parts.*

### Ruin kit + set-pieces (2 files → a whole kit)
- `ruin_kit.glb` — grey cathedral-stone **parts sheet**; **auto-splits into 5 wall
  sections + 2 rubble** via `public/map-proto/glbkit.js` (`splitIslands` =
  connected-components over welded verts). This is the chapel's stone kit; the
  `chapel-proto.html` builder assembles a ruined chapel from it with seeded damage.
- `ruin_gate.glb` — greenstone gateway **set-piece** (one welded gate + 10 loose
  rubble bits); place whole — a forest ruin / chapel outer gate.
- `fortress_kit.glb` — **7-piece** fortress kit (crenellated towers, arched gates, wall
  blocks; more *intact* than ruin_kit) → keep / watchtower / town defenses.
- `fireplace_stone.glb` — **5-piece** stone fireplace/arch kit → inn + cottage hearths,
  or arched wall niches/alcoves.
- `block_iron.glb`, `block_monolith.glb`, `block_weathered.glb` — solid single stone
  blocks (~1.9³) → **tactical cover** on the combat board, monoliths/standing stones,
  altar bases, foundation chunks.

**Capability unlocked:** a Meshy export holding several *separated* objects (a "parts
sheet") splits into individual reusable pieces; a *welded* building/set-piece does not.
So: to get a kit, generate the pieces spread apart on one sheet; to get a building,
generate it cohesive.

### Villages, cottages & the chapel (from the refined "parts sheet" prompt)
- `chapel_ruins.glb` ⭐ — **THE chapel kit**: 2 gable structures + gravestones + altar +
  pews + wall sections (29 separable pieces, grey stone). Furnishes the whole Hollowed Chapel.
- `ruins_gothic.glb` — gothic ruin/terrain kit (17 pieces: broken walls, standing stones).
- `village_timberframe.glb` — timber-frame **cottage kit** (walls, roofs + 2 whole houses).
- `village_weathered.glb`, `village_stone.glb`, `village_timbered.glb` — more timber
  building kits (overlapping; keep the best 1–2).
- `cottage_thatched.glb` — whole thatched cottage (+ fence).
- `cottage_timberstone.glb` — 2–3 timber-and-stone buildings.

## Status
- **Live in the game:** characters, foliage, barrels, chests, **the cottage interior
  furniture** (hearth, table, chair, stool, dresser, bed, chest, cauldron, rug — shown
  when you zoom-peel a house; `makeInterior`, v0.14.0).
- **Proto-only:** the authored wall *panels* (`wall_*`) — the live cottage uses its own
  procedural half-timbered walls, so these stay in `interior-lab.html` for now. The
  chapel kit (`chapel_ruins`) is next: wire `buildChapelRuin` to build from it.

## Wishlist (open)
The core cottage kit is **complete** (walls, door, hearth, rug, full furniture set).
Optional future additions: plain plaster wall, flagstone floor, shelf/hutch,
lantern/candlestick, window-with-shutters.
