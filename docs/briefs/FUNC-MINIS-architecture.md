# FUNC-MINIS-1 — Builder-placed furniture is engine truth (architecture note)

*Landed v0.35.0 build 144, 2026-07-09. Tim's commission + hard bar: "If a thing can
be placed, the world must believe in it." Tests U659–U664 (33 assertions), full
ladder green (135/135 convergence · 11,001/0 suite · screen truth locked).*

## The canonical object contract

A piece of furniture placed in the Building Builder exists in the engine on **two
surfaces joined by one identity**:

| Surface | Record | Lives at | Read by | Mutated by |
|---|---|---|---|---|
| **Model B — spatial/visual truth** | `{ id, kind, label, shape, material, light, cover, loot, flat, fx, fy, w, h, r, authored }` | topology rooms + `authoredPlan` rooms (world.structures, hashed) | floor-plan render (LocalMap via floorPlan), cover (coverFeatures), blocking (tacticalPos), narration (roomDetail/roomState) | never — the plan is the author's word |
| **Model A — interaction truth** | `{ name, kind, parts, bulk, weight, tags, notes, material, category, hardness, authored, structureId, roomId, pieceId }` | `node.furniture` (world.map, hashed) | objectsHere, llmPhysics (smash/search/burn), salvage lane, rest affordance | ONLY effectsCore `modifyFurniture` / `removeFurniture` deltas |

The join is `pieceId` (Model A) ↔ `id` (Model B piece), plus explicit
`structureId`/`roomId` provenance — never an affinity guess.

## Where Builder placement becomes engine truth

1. **Export** — the Builder writes `furniture: [{ type, x, y, w, h, rot, room, ux, uy }]`
   (house-builder/v6; already the case before this packet — the loader just dropped it).
2. **Load** (`authoredStructure.js` → `authoredFurniture.authoredPlanFurniture`) —
   each drawn piece becomes a Model B item on its room's topology record AND the
   authoredPlan: exact count, kind from the FURN catalog, drawn position (`ux/uy` →
   `fx/fy`), drawn footprint. A room with drawn pieces gets EXACTLY those (no role
   loadout, no injected crate); a room with nothing drawn keeps the roomDetail role
   loadout, so pre-FUNC exports read as before. `normalizeTopology` carries the
   field explicitly (the ensureCombat whitelist-trap lesson — normalizers that
   rebuild records field-by-field silently eat new fields).
3. **Materialize** (`applyGeneratedStructuresForNode` →
   `seedAuthoredNodeFurniture`) — when the structure lands at a node, each Model B
   piece mints its Model A twin: physics from `KIND_PHYSICS` (explicit material +
   hardness so llmPhysics never falls back to name-keyword inference — a 'cookpot'
   would read as ceramic), unique names per node (effectsCore ROM-4 resolves ops by
   name), **once per structure ever** (`node.furnitureSeeded` marker — a piece the
   player took or wrecked never resurrects).

## Where model/mini metadata lives

Nowhere in the engine — by design. The engine object carries `kind`; any GLB/mesh
association is a renderer-side lookup keyed by kind (miniLibrary et al). Rendering
is a projection of engine truth, never the source of it. New size tables must route
the WU_PER_FT seam (figures3d.js — the foot-tall-Hobbit law).

## Damage, destruction, salvage

Two existing lanes, both converging on the same stored truth:

- **Salvage lane (P-70)** — "smash the barrel" destroys the piece outright:
  `removeFurniture` splices it from `node.furniture` and the material drops as a
  real item (defRef `board`, id-prefixed `sv_`). This is the lane the verbs hit
  first in play (U661's receipt).
- **Rulings lane** (`rulings/index.js` via llmPhysics) — graded, material-aware:
  wood loses parts one blow at a time (`state: 'damaged'`, each part a salvage
  item), glass shatters, iron dents and keeps its parts, stone shrugs.

**The wreck predicate** (`authoredFurniture.isFurnitureDestroyed`): a piece is
destroyed when its state is terminal (`shattered/torn/broken/wrecked/destroyed/
collapsed`) **or** it is `damaged` with its parts exhausted **or** its Model A twin
is simply absent (taken/salvaged). No object HP/AC numbers — that is DM-GATE-1b,
kept separate per Tim's ruling (2026-07-09).

## Live-state cover and blocking (acceptance #6)

`coverForRoom(room, { world, structureId })` filters the Model B cover list
through `destroyedAuthoredPieceIds` — the same stored `node.furniture` records the
smash mutated. Consumers: escapeCombat `currentRoomCover` and combatHud (one-line
pass-throughs). The tactical walk (`resolveTacticalWalk`) subtracts the same
destroyed set from `furnitureBlockedCells`, so a wrecked barrel neither shelters
nor blocks. Seeded PLACEMENT stays conservative (spawn-blocking on a wreck's cell
is harmless and keeps placement streams stable). Procgen rooms have no stored
twins yet, so their cover behavior is byte-identical — see "Known limits."

## Affordances delivered

- **Smash → destruction → salvage**: live (both lanes, U661/U662).
- **Search/open**: `category: 'container'` (barrel, cookpot, dresser) — the
  existing physics/interaction class; dresser also carries `loot: 1`.
- **Sleep at bed**: an intact placed bed grants the full long rest (the same band
  as a settlement bed / sound shelter — an existing rule, not a new number), and
  it outranks the generic town-bed narration because sleeping in the bed you
  placed is the more truthful line. A wrecked bed grants nothing (U663).
- **Cover/hide**: barrel + dresser grant half cover per the FURN catalog; live
  state subtracts wrecks.

## How future furniture types join (the recipe)

1. Add the kind to `FURN` (roomDetail.js) — label, shape, material, cover, loot.
2. Add a `KIND_PHYSICS` row (authoredFurniture.js) — material, category, hardness,
   parts, bulk/weight. Skip it and the piece still works with material-derived
   defaults; an unknown kind NEVER silently vanishes (wood-default catch-all).
3. `node scripts/dump-furniture.mjs` — the Builder palette refreshes itself.
That's the whole surface. No renderer work is required for existence; a mini is
optional polish keyed by kind.

## BUILDER-OBJ-1 addendum (v0.36.0 b151, 2026-07-11)

- `KIND_PHYSICS` now covers the whole supported Builder palette (16 kinds):
  barrel, bed, cookpot, dresser + chest, crate, shelf, table, chair, nightstand,
  wardrobe, rug, runner, lantern, candles, hearth. The honesty rule that drove
  it: Model B's RENDER material must never leak into smash physics — a lantern
  is ironwork that carries fire (iron, h3, bulk 1 = takeable), candles are wax,
  a hearth is set masonry (stone, h5, bulk 5). Drawer-bearing kinds (nightstand,
  wardrobe, crate, chest) are `category: 'container'` = the open/search class.
- Kind→GLB art status lives in `public/map/propArt.js` (curated, single-object
  confirmed only, `wired: false` until a placed-piece GLB render path exists).
  The Builder's status chips read it; miniLibrary `sheet: true` marks audited
  multi-object sheets the Builder must refuse. Guards: U685 (palette ⊆ FURN,
  registry integrity), U686 (all-16-kind end-to-end contract).
- To add a supported palette kind: the 3-step recipe above + a PALETTE row in
  house-builder.html (footprint) + extend U685/U686's lists.

## BUILDER-OBJ-2 addendum (2026-07-11) — placed-piece GLB render path

- `figures3d.js`'s `buildPropMini(THREE, kind)` now PREFERS a confirmed GLB
  (`glbPropMini`, gated on `propArt.js`'s own `wired` flag) before falling
  back to its old procedural box — the box survives only for the four kinds
  that had one (barrel/bed/chest/dresser); every other wired kind renders
  GLB-or-nothing (never a fabricated placeholder shape).
- The GLB comes from `treeAssets.js`'s existing eager-preloaded furniture
  templates (`buildGLBProp`) — no second loader was built. `cookpot` is the
  one kind whose engine name differs from its GLB's REG kind (`cauldron`);
  `GLB_KIND_ALIAS` in figures3d.js carries that one mapping (a GLB never
  names the engine object).
- Wired kinds (propArt.js): barrel, bed, chest, dresser, hearth, table,
  chair, cookpot, rug — 9 of the Builder's 16. `rack`'s art lives on the
  lazy `miniLibrary` loader (a second, async loading path, not yet built) so
  it stays unwired.
- `drawModel.js`'s `PROP_MINI_KINDS` (which gates whether a furniture kind
  becomes a 3-D mini candidate at all) grew from 4 to 9 to match — hearth/
  table/chair/cookpot/rug previously never became minis (TT-PROPS's original
  "picked-up-off-the-table" framing predates the Builder's authored-object
  palette; Tim's own commission for this packet was the direct counter-case:
  "a placed table should look like the table GLB").
- `figures3d.js`'s `PROP_TRUE_SIZE` gained entries for the five new kinds,
  including a new `axis: 'footprint'` option (measured via the existing
  yaw-invariant `measureAuthoredFootprint`) for table/rug — their GLBs aren't
  authored axis-aligned the way the bed is, so a fixed-axis height read could
  land on a near-zero value and blow the true-size scale up hugely (the same
  failure class UNIT-CLASH-1 already named).
- Tests: U687 (new — hermetic gating/fallback proof + source-contract checks
  for the wiring, since three.js can't run headless in this test env); U685's
  wired-state expectation and U576a/U576e's byte-locks were updated
  consciously (each documents why in its own comment) since this packet
  legitimately grows both propArt.js's wired set and PROP_TRUE_SIZE.
- Live receipt: the tallow boot cottage's Hearth Room renders a detailed
  brick hearth (with chimney), an iron-banded chest, a flat rug, and a barrel
  as real GLB sculpts (not procedural boxes) — `window.__rendScaleAudit`
  additionally confirms `table`'s mini resolved (it has no procedural
  fallback, so its presence there is only possible via the GLB path).

## Known limits (honest scope)

- **Procgen cover staleness pre-exists**: a generic (non-authored) piece's
  destruction doesn't yet subtract its roomDetail cover twin — the Model A↔B join
  for procgen pieces is affinity-fuzzy. Authored pieces (this packet's subject)
  join exactly. Follow-up seam if the gate ever surfaces it.
- **Cooking has no mechanic to join**: the cookpot is a real, searchable,
  dentable iron object, but the engine has no cooking system — wiring one would
  be invented game design, not plumbing. Flagged, not faked.
- **Multi-floor exports still degrade to one storey** (pre-existing loader limit).
- **STRUCTURE_SCHEMA_VERSION deliberately NOT bumped** (brief said 27→28): the
  version pins PROCGEN interior identity (`stgen:v27:` ids); this packet leaves
  procgen byte-identical, and bumping would regenerate every procgen structure id
  — breaking save-interior continuity for zero benefit. The authored-plan field is
  additive and self-announcing (absent → role-loadout fallback).
