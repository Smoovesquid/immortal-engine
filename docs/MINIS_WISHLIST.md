# MINIS WISHLIST — the running list of miniatures that help the cause

*Standing ledger (Tim's ask, 2026-07-05): "I'll make more miniatures as we need them. Keep a running
list of minis that will help the cause." Any lane may APPEND a row (append-only, date it). Tim reads
this when he sits down to make assets. Spec format per entry firms up once the pipeline call is made
(GLB / house-builder export / procedural reference) — until then, subject + why + where-it-appears.*

**Status codes:** 🎯 wanted next · 🧱 wanted for the architecture-real arc · 🌲 wilderness scenes ·
🏘 settlement life · ✅ have it (procedural or asset)

## Architecture kit (functionally-real buildings need their moving parts) 🧱
| Mini | Why it helps | Where you'd see it |
|---|---|---|
| Door leaf (open / shut / barred states) | THE door is about to become a real object — it needs a body to swing | every building |
| Window shutters (open / shut) | windows become real apertures; shutters are their state made visible | cottages, the inn |
| Roof caps (per footprint size, liftable) | if the dollhouse rule wins the interview, outside-view buildings wear roofs | all of Aldermere |
| Stairs / ladder | multi-floor topology exists in stgen; give it a body | inn, watchtower |
| Cellar hatch | the inn cellar is load-bearing (it hides a dungeon door) | Aldermere inn |
| Fence run + gate | yards and pens make the village plan read; gates are doors outdoors | crofts, coop |
| Bridge (short, stone or plank) | the Greenwood road worry is a road worry — the crossing is a set piece | Greenwood road |
| Well | the classic village anchor; an errand spot for story-placement | Aldermere square |

## Wilderness (you are a mini among tree minis) 🌲
| Mini | Why it helps | Where you'd see it |
|---|---|---|
| Tree variants: conifer ×2, broadleaf ×2 | one tree shape repeated reads as wallpaper; four break the tiling | everywhere wild |
| Stump / deadfall log | walkable-woods texture + natural cover for the XCOM brain later | Greenwood |
| Boulder cluster | same — terrain that blocks and hides | hills, riverbanks |
| Thicket / brush clump | soft cover, ambush texture, forage target | road margins |
| Campfire + bedroll | journey stops and camps become scenes, not abstractions | Crowfoot Camp, camps |
| Tent (weathered) | Crowfoot Camp is a camp — it needs canvas | Crowfoot Camp |

## Settlement life 🏘
| Mini | Why it helps | Where you'd see it |
|---|---|---|
| Market stall | Galen the artisan needs a daytime anchor you can SEE | Aldermere square |
| Handcart | streets read alive; movable prop for story beats | lanes |
| Signpost | crossroads legibility at walking scale | road junctions |
| Forge + anvil | a smith anchor building wants its tell | artisan row |
| Bell tower / hung bell | the cold-open's bell that rang on its own — give the mystery a body | Aldermere chapel end |
| Laundry line / woodpile | domestic truth at the door of homes | crofts |
| Chicken coop + chickens | livestock category exists; also: Carl has opinions about chickens | crofts |
| Goat / pig | livestock variety beyond the current set | pens |

## People (archetype figures beyond the current set)
| Mini | Why it helps | Where you'd see it |
|---|---|---|
| Guard (spear, watchful stance) | post-anchored NPCs read at a glance | gates, walls |
| Innkeep (apron) | the inn is the social hub; its keeper is furniture-with-a-soul | the inn |
| Hooded lurker | the "up to something" minority deserves a silhouette you notice late | edges, shadows |
| Carl with chisel (hero mini) | the failed sculptor at work among failed sculptures | Carl's workshop |

## ✅ Already standing (for reference — don't remake)
Barrels, beds, dressers, chests (TT-PROPS furniture set) · generic people archetype figures ·
grove trees (settlement-scale) · livestock (base set) · corpse_assemblage + corpse_remains_red
(TT-MINIS, wired 2026-07-05 — a defeated combat enemy renders as one of these instead of a
toppled standing figure).

---
*Append below this line, newest first, date every add.*

**2026-07-05 · WIRED (TT-MINIS):** corpse_assemblage + corpse_remains_red are live. A defeated
combat enemy's mini now swaps to one of these two GLBs (figures3d.js's buildCorpseMini,
deterministic per entity id/name — same foe always shows the same corpse) instead of the old
toppled-archetype pose; falls back to that toppled pose gracefully if the GLB isn't loaded/fails.
Moved out of "untracked" above.

**2026-07-05 · RECEIVED from Tim (GLB, dropped in `public/map/assets/`):** corpse_assemblage ·
corpse_remains_red — death/aftermath set pieces (combat scenes, the Underworld someday). Wiring into
the renderer = a TT lane packet (loader + scale/anchor pass); untracked until that lane claims them.

## Interior furniture — the 39 engine types (Tim's ask 2026-07-07: real 3D minis, not placeholders) 🎯
*The house-builder places these and the engine's room-detailer scatters them; today only barrel/chest/
dresser/bed have (crude procedural) minis — the other 35 draw as 2D placeholder icons. Source of truth
= `public/map/furniture.json` (the `type` id is the wiring key). **Wiring contract per mini:** author in
FEET at real scale · **Y-up** · origin at the BASE CENTRE (feet on the ground plane) · export GLB named
by `type`. I add each `type`'s true-size + true-axis to `PROP_TRUE_SIZE` (figures3d.js) and prefer the
GLB in `buildPropMini` (the same graceful-fallback path `buildCorpseMini` already uses). "True axis" =
the dimension the map scales to real size (height for uprights; LENGTH for long low pieces; FOOTPRINT
diameter for round things). ✅ = already has a placeholder mini to replace.*

| `type` | name | target true size (ft) | true axis |
|---|---|---|---|
| bed | bed ✅ | 7 long | length |
| bedding | straw bedding | 6 long | length |
| nightstand | nightstand | 2 tall | height |
| wardrobe | wardrobe | 6.5 tall | height |
| dresser | dresser ✅ | 4.2 tall | height |
| shelf | shelves | 6 tall | height |
| chair | chair | 3 tall | height |
| bench | bench | 5 long | length |
| stool (via chair) | — | — | — |
| table | table | 4 across | footprint |
| longtable | long table | 9 long | length |
| counter | counter | 5 long | length |
| chest | chest ✅ | 3.5 long (2.2 tall) | length |
| crate | crate | 3 cube | height |
| barrel | barrel ✅ | 3.2 tall | height |
| sack (via crate) | — | — | — |
| rug | rug | 6 long | length (flat) |
| runner | aisle runner | 8 long | length (flat) |
| hearth | hearth | 5 wide | width |
| firepit | fire pit | 3.5 ring | footprint |
| brazier | brazier | 3 tall | height |
| cookpot | cooking pot | 1.5 tall | height |
| candles | candles | 1 tall | height |
| lantern | lantern | 1.5 tall | height |
| loom | loom | 6 tall | height |
| rack | weapon rack | 5 tall | height |
| anvil | anvil | 2.5 tall | height |
| altar | altar | 3.5 tall | height |
| font | font | 3.5 tall | height |
| fountain | fountain | 6 across | footprint |
| basin | stone basin | 2.5 tall | height |
| well | well | 4 across | footprint |
| lectern | lectern | 4 tall | height |
| pew | pew | 6 long | length |
| statue | statue | 7 tall | height |
| pillar | stone pillar | 10 tall | height |
| throne | throne | 5 tall | height |
| sarcoph | sarcophagus | 7 long | length |
| stall | market stall | 7 tall (6×4 base) | height |
| bones | bone pile | 3 across | footprint (low) |
| rubble | rubble | 4 across | footprint (low) |
| web | web mass | 5 span | footprint |
| eggsac | egg sac | 2.5 tall | height |

*Priority tiers if batching: (1) the domestic core a cottage always has — bed✅, table, chair, chest✅,
hearth, shelf, barrel✅, crate, stool, dresser✅, rug. (2) tavern/hall — longtable, bench, counter,
wardrobe, brazier. (3) chapel/temple — altar, font, pew, lectern, statue, pillar, candles. (4) dungeon/
decay — sarcoph, bones, rubble, web, eggsac, anvil, loom, rack. Note `stall`/`well` overlap the
Settlement/Architecture sections above; one mini serves both.*
