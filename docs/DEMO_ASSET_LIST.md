# Demo Asset List — what we need to build the whole demo in 3D

The shippable demo (`docs/DEMO_REGION.md` scope-lock) is **one ~100 km² region, four places**:
**Aldermere** (town / home base) · **The Greenwood** (forest — wolves + roaming bandits) ·
**Crowfoot Camp** (bandit camp) · **The Hollowed Chapel** (haunted undead dungeon).

This is the full 3D asset list for those four places. ✅ = already in the library
(`docs/MAP_ASSETS.md`, 33 assets). 🔲 = still to generate. Every 🔲 line is one Meshy target.

**How buildings work:** exteriors are single sealed Meshy shells (like `cottage_red`);
interiors are **assembled from panels** (like the cottage kit we just built). So "an inn"
= one exterior shell + a handful of interior panels/props, most of which we reuse.

---

## Characters

### Player + townsfolk
- ✅ Player hero (`hero.glb`)
- ✅ 7 townsfolk (`villager_*`) — the Aldermere populace
- 🔲 Innkeeper (apron, older) — the home-base face
- 🔲 Blacksmith (burly, sooty)
- 🔲 A child + a merchant (round out the town) — *optional, Tier 3*

### Enemies — Greenwood + Crowfoot Camp
- ✅ **Bandit** — `enemies_bandits_a/b.glb` (6 warriors each; need split)
- ✅ **Bandit captain** — `enemies_warlords.glb` (hulking brutes = boss tier)
- ✅ Bonus cultists — `enemies_skullbound.glb` (the Skullbound Covenant)
- ✅ **Wolf** (Greenwood predator) — in `enemies_menagerie.glb` (needs split)
- 🔲 Dire wolf (alpha, bigger) — *optional*

### Enemies — The Hollowed Chapel (undead)
- ✅ Lich (`lich.glb`) — the **chapel boss** (already wired to combat)
- ✅ **Ghost / wraith**, **Skeleton**, **Zombie / death-knight** — all in
  `enemies_undead_a.glb` + `enemies_undead_b.glb` (16–20 figures each; need split into
  individual enemies, then wire like `figureAssets.js`).

---

## Buildings (exteriors — sealed shells)
- ✅ Cottage (`cottage_red.glb`) — generic house
- ✅ **The Inn** (`inn_crooked.glb` — the Crooked Hearth, home base)
- ✅ Blue Timber Cottage (`cottage_blue.glb`) — second house style
- ✅ **Smithy / forge** (`smithy.glb` — anvil + chimney; armored figure fused in)
- ✅ **Ruined chapel shell** — built from `ruin_kit.glb` (auto-split grey-stone kit) +
      `portal_gothic.glb` door; see `chapel-proto.html`. Still wants set-dressing (below).
- ✅ Gatehouse/keep (`gatehouse_crimson.glb`) — town gate / campaign (not a smithy)
- ✅ Ruin gateway set-piece (`ruin_gate.glb`) — forest ruin / chapel outer gate
- 🔲 Mill — a town landmark — *optional, Tier 3*

---

## Interiors (assembled from panels)
- ✅ **Cottage interior — COMPLETE** (5 wall panels, door, hearth, rug, table, chair,
      stool, dresser, chest, bed, cauldron)
- 🔲 **Inn interior extras:** a bar counter + kegs (reuse cottage panels + table/chair/stool
      + `barrel_*`)
- ✅ **Chapel set-dressing** — `chapel_ruins.glb` delivers altar + pews + gravestones +
      gable structures + walls (29-piece kit). Only a brazier/candle (light) + coffin still open.
- 🔲 Flagstone floor tile (stone floor for chapel/inn vs the cottage's planks)

---

## Nature & terrain — The Greenwood
- ✅ 2 trees (`tree_verdant`, `tree_gnarled`), flowering shrub (`bloom`)
- 🔲 Fallen log (also tactical cover)
- 🔲 Tree stump
- 🔲 Rock / boulder cluster (cover + terrain)
- 🔲 Generic bush / fern (undergrowth)
- 🔲 1 more tree — a dead/bare tree (spooky near the chapel) — *optional*
- 🔲 Mushroom cluster — *optional flavor*

---

## Props, clutter & tactical cover
- ✅ 2 barrels, 2 iron chests, cauldron
- 🔲 **Campfire** (Crowfoot Camp centerpiece — the `cauldron` hangs over it)
- 🔲 **Tent** (bandit camp — proper GLB)
- 🔲 Wooden crate (loot / cover)
- 🔲 Market stall (Aldermere town life)
- 🔲 Wooden fence / gate section (town edge + camp palisade)
- 🔲 Bandit banner / totem (camp marker) — *optional flavor*
- 🔲 Signpost, cart/wagon — *optional Tier 3*

---

## Generation queue (priority order)

**Tier 1 — demo-critical (can't ship without these ~13):**
Bandit · Bandit captain · Wolf · Ghost/wraith · Skeleton · Zombie ·
Inn (exterior) · Smithy · Ruined chapel (exterior) ·
Tent · Campfire · Altar · Broken pews

**Tier 2 — makes it rich (~11):**
1 extra house style · Innkeeper · Blacksmith · Gravestone · Coffin · Brazier ·
Fallen log · Rock cluster · Bush/fern · Crate · Flagstone floor · Bar counter · Market stall

**Tier 3 — polish (optional):**
Mill · Dire wolf · Bandit sergeant · Extra villagers · Dead tree · Mushrooms ·
Fence/gate · Banner · Signpost · Cart

**Keep the style consistent:** same hand-painted look, ~2 m scale, and for enemies keep
them roughly human-height so they read on the combat board next to the hero.
