# Map Fidelity Spec — what MUST register on the map

*The checklist for the governing rule: **"ALL FIXES MUST REGISTER CORRECTLY ON THE MAP IF THEY ARE MAP-RELATED."** (Tim, 2026-06-26 — a sibling of THE_DM_TEST / THE_TABLE_TEST.) See the rule's rationale in memory `feedback_map_fidelity_rule`.*

**What this is:** the definitive, exhaustive enumeration of every world-state change with a spatial footprint — the universe of things the map is responsible for showing. **This is a SPEC, not a status audit.** It deliberately does NOT record what currently works; status/coverage is audited separately, against this list.

**The governing principle behind it:** the map is a *projection of the player's OBSERVED and REMEMBERED slice of canonical world-state* — never the hidden whole. Canon Log wins (narration ≠ canon), but the map shows only what the player can presently observe **plus** what they have previously seen (greyed as fog-of-war / memory). Within that observed slice, **any canonical change that has a where — a position, a presence, an opening, a mark on the land, a change of light — is not "done" until the map shows it at the scale it lives at.** What the player cannot observe does not belong on the map, and the map shows *symptoms and surfaces, never hidden causes* (see §0). The map never invents world facts and never mutates canonical state — it reads. This document enumerates the footprint-bearing categories so nothing slips through.

**Scale tags** (the map is one continuous semantic zoom; a change must read correctly at *its* scale):
- **[O]** overworld / region scale (the Map tab `oneMap`)
- **[S]** settlement / street scale (the place map — the live play screen)
- **[I]** interior scale (building → floor → room)

**§0 hard law (do not violate on the map):** the map shows *physical symptoms and observable surfaces*, never hidden causes or abstract truth — political or cosmological. The cosmology is NEVER surfaced in-world: blight, a scar, a wrong-looking tile, yes; the cause, the cycle, the substrate, never. The same goes for politics: a banner, a patrol, a burned village, a wanted poster, yes — but abstract *"faction territory / control"* shading is hidden political truth, **not a default map obligation**, and appears only insofar as it is physically visible now or remembered from before.

---

## A. The player & party — "you are here"

1. **Overworld position** — which node / region you occupy. [O]
2. **Settlement walk-position** — where you stand within a town's organic layout. [S]
3. **Interior position** — which building → which floor → which room. [I]
4. **Inside vs. outside a structure** — and *which side you emerge from* (climb out the east window → marker outside the east wall). [S][I]
5. **Heading / facing** — the direction you last moved or came from ("you entered from the west road"). [O][S]
6. **Stealth / hidden state** — sneaking reads as concealed, not a blazing marker; breaking cover re-exposes you. [S][I]
7. **Transport mode** — on foot vs. mounted vs. boat (icon + reach/speed). [O][S]
8. **Carried light at night** — a torch punches a lit radius in the dark; dropping/dousing it collapses the radius. [S][I]
9. **Companions traveling with you** — party-member markers, and them peeling off / rejoining. [O][S][I]
10. **Your death / incapacitation** — you fall; the marker reflects down/dead, not standing.

## B. People (NPCs) — governed by line-of-sight

1. **Occupancy** — who is actually present at this node / room / patch of open ground. [O][S][I]
2. **Only what you can SEE** — fog-of-war / line-of-sight is the master filter; sight passes *through* open windows and doors, is blocked by walls and shutters. The map shows the visible, not the roster. [S][I]
3. **NPC movement over time** — schedules: the market by day, hearths by night; a guard's patrol; someone walking off down the road. [S][I]
4. **Disposition** — friendly / wary / hostile reads differently. [S][I]
5. **Who you're engaged with** — the NPC in conversation or trade is distinguished. [S][I]
6. **Departure / death / removal** — an NPC who leaves, dies, or flees stops appearing (or leaves a body). [S][I]
7. **Crowds & gatherings** — a market press, a full tavern, a funeral, a mob — density reads as density. [S]
8. **Named vs. unknown** — whether you've learned a name changes how they're labeled. [S][I]

## C. Enemies & threats — combat and the wilds

1. **Enemy positions** — when spotted or in combat, foes have a where. [S][I]
2. **Approach / retreat** — closing distance, flanking, fleeing — movement shows. [S][I]
3. **Ambushers revealed** — hidden → seen the instant they break cover or you spot them. [S][I]
4. **Enemy death / rout** — removed, or a corpse marker left behind. [S][I]
5. **Roaming wilderness creatures** — ecology predators, herds, lone beasts on the overworld. [O]
6. **Threat proximity to a place** — a horde nearing a settlement, a fire marching across tiles. [O][S]
7. **The engagement area** — where the fight is happening (chokepoint, open ground, a specific room). [S][I]
8. **Danger left behind** — you escaped; the threat is now *back there*, not on top of you. [O][S]

## D. Structures & buildings

1. **Footprints & positions** — every building's place and shape in the settlement's organic (non-grid) layout. [S]
2. **Type differentiation** — inn / shop / temple / smithy / cottage / barn read distinctly, not all "generic cottage." [S]
3. **Doors** — position, open/closed, **locked/unlocked** (including the night-lock 10pm–6am, always open from inside). [S][I]
4. **Windows** — position, **per-window facing**, open vs. **shuttered**. [S][I]
5. **Interior reveal on entry** — entering exposes the room layout: entry, common room, back rooms. [I]
6. **Multi-floor / stairs** — vertical structure; which floor you're on. [I]
7. **Structural damage / destruction** — burned, collapsed, barricaded, breached (the scars system's lasting marks). [S][I]
8. **New / changed structures** — something built, walled off, or opened up since you last saw it. [S]
9. **The opening you actually used** — door vs. *which* window — must be the one shown (the recent climb-out-named-window marker). [S][I]

## E. Terrain, biome & region

1. **Biome tiles, visually distinct** — forest ≠ mountain ≠ plains ≠ swamp ≠ desert; legible at a glance. [O][S]
2. **Region boundaries & names** — where one region gives way to the next. [O]
3. **Water & elevation** — rivers, lakes, coast, highlands, valleys. [O][S]
4. **Roads / paths / trails** — organic, non-grid; the routes that actually connect places. [O][S]
5. **Chokepoints** — bridges, fords, gates, passes, town walls. [O][S]
6. **Special features** — worm-circle tiles, the pale root, ruins, standing stones, shrines — the singular places. [O][S]
7. **Terrain change from events** — scorched earth, blight, flood, new growth, a felled forest (incl. gratuitous-magic environmental recoil). [O][S]
8. **Landmark / resource points** — a well, a forge, a herb patch, a quarry. [S]

## F. Time, light & weather — the environment

1. **Day / night** — sun/moon glyph + clock (simple corner badge, no dimming — Tim's taste). [O][S]
2. **Visibility radius** — sight tightens at night and in gloom; widens at dawn / from a vantage. [S][I]
3. **Time-driven world changes** — shops shut, NPCs go home, night-locks engage, patrols change — the map at 2am ≠ the map at noon. [S][I]
4. **Weather** — rain / snow / fog / storm, if/when modeled (aspirational until the state exists). [O][S]
5. **Season** — if/when modeled (aspirational until the state exists). [O][S]

## G. Objects & interactables

1. **Dropped items / loot** — things on the ground worth a marker. [S][I]
2. **Containers** — chest, barrel, crate, cart. [I]
3. **Notable placed objects** — a body, a campfire, a signpost, the news-stand, a wagon. [S][I]
4. **Player-placed things** — a fire you lit, a trap you set, a torch you dropped. [S][I]
5. **Resource / harvest nodes** — gatherable points in the world. [O][S]
6. **Interactable fixtures** — well, lever, altar, forge, gate-winch. [S][I]

## H. Discovery / fog of war

1. **Explored vs. unexplored** — the fog itself; what you've never seen stays dark. [O][S][I]
2. **Live line-of-sight reveal** — the active sight radius, passing through openings, blocked by walls. [S][I]
3. **Remembered, not live** — places once seen render as greyed memory, not current truth. [O][S]
4. **Heard-of, not seen** — a rumor-marker for a place named but never visited (rides the rumor layer). [O]
5. **Vantage reveal** — climbing high (tower, ridge) widens what the map shows. [O][S]

## I. Factions, threads & the living world

*Observation-gated, like everything else. Abstract faction territory/control is hidden political truth and is **NOT** a default map obligation (see §0) — the map shows only the physically observable signs of a faction, and only when you can see them now or have seen them before (greyed memory).*

1. **Observable faction signs** — banners, guards, patrols, camps, checkpoints, crowds, fortifications, wanted posters, a burned village: the *visible* evidence of who holds or contests a place. Shown when observed or remembered; never as abstract territory shading. [O][S]
2. **Active threads / events** — a fire, a battle, a festival, a flood, a market day playing out *where* it's happening, insofar as you can see it. [O][S]
3. **Scars** — the lasting marks worldTick leaves after an event resolves, once you've come upon them. [O][S]
4. **Reputation footprint** — a settlement where you're known / welcomed / wanted reads differently *through its observable surface* (a wanted poster, a wary guard, the newspaper's diegetic column) — not an invisible reputation stat painted on the map. [O][S]
5. **Ecology state** — a dying forest, a bloom, a migration shifting the overworld over time, as you witness it. [O]

---

## J. The cross-cutting invariant — scale & continuity

Every item above must read correctly **at the scale it lives at**, and stay consistent **across the continuous zoom** (overworld ↔ settlement ↔ interior). A change is not "on the map" until it shows at the right zoom *and* doesn't contradict the adjacent zoom. The marker that says "east of the building" at street scale must agree with "in this settlement" at region scale.

**Determinism rider:** map state is derived from canonical world-state and seeded RNG only. A map fix must never become a back-door mutation — the marker reads position; it does not invent it. (See `map_marker_reads_v1_walk_pos`: the place marker reads the v1 walk position; direct ux/uy writes break determinism gate U21.)
