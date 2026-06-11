# Salvage & Build — the world is made of stuff, and stuff is never a dead end

**Status:** spec pinned 2026-06-11; build order in `docs/PACKETS.md` (P-70→P-73).
**Law:** THE DM TEST governs everything here. There is no build mode, no placement
grid, no crafting menu. You SAY what you do — "I tear the barrel apart for boards,"
"I spend the week raising a palisade" — and the DM resolves it with checks, time,
and consequences. The fiction is the interface; the engine supplies materials,
recipes, time-costs, and a structure-writing mutation.

## The idea (Tim, 2026-06-11)

Anything in the environment can be destroyed, and destruction yields materials.
Materials climb an escalating ladder:

1. **Improvise** — smash a barrel, grab a board, hit a man with it. No skill,
   instant, crude. (PHB improvised weapon: 1d4.)
2. **Craft** — with skill and tools, boards become something *made*: a torch,
   a splint, a barricade, a raft. Skill-gated, minutes-to-hours.
3. **Build** — with enough material, time, and **labor**, construction scales:
   lean-to → palisade fort → house → castle. Quality shows its inputs — a house
   of salvaged barrel boards is a bad house, and the prose should say so.

Labor is the moral fork: do it alone over months, hire a sawyer and crew with
gold (RAW: skilled hireling 2gp/day), or force people to do it — and the
morality engine watches which one you choose. Coerced labor writes `cruelty`
deeds, witnesses remember, the county talks, the soul pays. "Enough time or
enough slaves" is a real choice with a real bill.

The "Fortnite aspect," translated: not real-time placement — the *loop*.
Harvest the world, convert it into shelter and defense, and have the built
things persist and matter.

## D&D anchors (every rung is conventional)

| Rung | Rule anchor |
|---|---|
| Objects have stats | DMG: AC by material (wood 15, stone 17), HP by size |
| Board as weapon | PHB improvised weapons, 1d4 |
| Skill/tools to craft | Tool proficiencies (carpenter's, mason's, smith's) — already on our 5e sheets via backgrounds |
| Downtime crafting | Xanathar's: gold + days + tool proficiency |
| Hired labor | DMG hirelings: skilled 2gp/day |
| Stronghold tier | DMG stronghold costs (keep ≈ 50,000gp / 400 days); 2024 Bastions |

## What already exists in the engine

- **Destruction adjudication** — the physics parser resolves "I smash the
  barrel"; `modifyFurniture` / `removeFurniture` ops exist; every interior has
  a furniture list (`engine/decompression/furniture.js`).
- **A home for built things** — `engine/structures/` (generation, interiors,
  anchors, topology, discovery) and persistent `scars`. A player-built fort is
  a structure the player authored instead of the seed.
- **Typed items** — `inventory.items` ({id, defRef, equipped}) with damage
  dice, properties, rarity, prices; `addItem`/`removeItem`/`equipItem` ops;
  the unused `junk` category becomes the materials bucket.
- **Time** — `time.hours` with the long-rest clock precedent for jumps.
- **Money** — purse + `addCurrency`; building is the endgame gold sink that
  makes loot worth having.
- **Morality** — `recordDeed` cruelty/aid; witness memory; rumors. The labor
  fork plugs straight in.
- **Storylines** — a player fort is an arc anchor; things can come TO it.

What's missing, by layer: **yield** (destruction leaves nothing), **materials**
(item defs for boards/stone/hide/nails), **recipes** (materials + check + time
→ goods), **construction** (materials + days + labor → structure op), and the
**labor model** (solo / hired / coerced).

## Design pillars

1. **Prose in, prose out.** Salvage, craft, and build requests route through
   the same intent pipeline as everything else. The DM may ask one clarifying
   question ("with what?"), never present a menu.
2. **Materials are items.** `kind: 'material'` defs in the typed item system
   (board, timber, stone, nail, hide, cordage…). Salvage yield is deterministic
   per object + seed. Materials stack (`qty` on the instance).
3. **Quality is provenance.** Crafted/built things carry a quality derived
   from materials + skill + time spent. Quality surfaces in PROSE and in
   mechanics (a barrel-board shack: poor shelter die; a sawyer-cut house:
   real rest benefits). Never a star rating.
4. **Time is the cost.** Crafting consumes hours; building consumes days
   (downtime jumps with world ticks running — the world moves while you
   build; abandonment clocks on story arcs keep ticking).
5. **Labor is a moral instrument.** Solo = time. Hired = gold/day, needs a
   settlement's labor pool (economy tie-in: the sawyer). Coerced = fast,
   cheap, and the deed/witness/rumor machinery prices it correctly.
6. **Built structures are canon.** A new `buildStructure` delta op writes into
   `world.structures` (+ map anchor). They persist, render, can be entered,
   can shelter NPCs (decompression machinery), can be attacked or burned —
   destruction applies to player works too. worldHash covers them.
7. **Determinism throughout.** Yields, check DCs, build clocks: all seeded.
   No `Math.random`.

## The ladder, concretely

| Tier | Input | Gate | Time | Output |
|---|---|---|---|---|
| Salvage | a destroyed object | none | a turn | materials in inventory (+ a board IS a 1d4 club) |
| Field craft | few materials | skill or tool prof check | minutes–hours | small goods (torch, splint, barricade, raft) |
| Shelter | armful of materials | Survival check | hours | lean-to/camp: real rest quality |
| Construction | stockpile | carpenter's tools + plan | days + labor | palisade, shack, house — persistent structure |
| Stronghold | wagonloads + crew + gold | wealth, time, labor model | seasons | fort, keep, castle — Bastion-tier endgame |

## Out of scope (v1)

- Real-time/positional building UI of any kind.
- Structural physics (load, collapse simulation) — quality + prose carry it.
- NPC autonomous construction projects (later: factions build too).
- Siege warfare against player forts (later — but burnable from day one).

## Done-when for the whole feature

A player can, in plain prose, on the live surface: smash a barrel, pocket the
boards, club a bandit with one, splint a wound with another, spend two days
turning the rest into a lean-to that actually improves rest — and come back
next session to find it still standing, with the county aware someone's
squatting there. Every step deterministic, every step DM-narrated, zero menus.
