# The Building Builder — authoritative "what's left" list

*Status 2026-07-05. The house-builder (`public/house-builder.html`) authors rich structure
data (`house-builder/v7`); the NPC builder + mini library feed it. This doc is the definitive gap list.*

**DECISION (Tim, 2026-07-05): ENGINE LEADS.** The loader maps authored data down to what the engine
supports; richer features degrade.

**✅ Tier 0 #1 — THE LOADER LANDED (v0.29.4 b091).** A room drawn in the tool is now WALKABLE in the
game (`engine/structures/authoredStructure.js` `loadAuthoredStructure`; one room mapped down —
role/material/furniture/enterable; demo behind seed `loaderDemo`, default game byte-identical; accepts
`house-builder/v5+`). Tier 0 #4 (validate) + #5 (walk-it test) came with it (U513–U517, live LLM-off
receipt). **Also done same day (tool-side):** Tier 1 **#6 room roles** ✅ + **#7 full furniture set** ✅.

**Next (queued):** **LOAD-2** — attach an ARBITRARY tool export at a REAL map node (not just the demo
seed), + all rooms not just the first, + windows/doors as real openings. **LOAD-MR2C** — widen/unify the
pre-existing `authoredPlans.js` (MR-2c) registry (validates v5 only) with the new loader path. Then the
rest of Tier 1 (multi-floor/stairs — engine work; entrance; NPC/monster placement) and Tiers 2–3 stand.

## The one truth that shapes everything

The tool exports engine-shaped data, but the **engine's interior model is simpler than what the
tool authors**, and there is **no path from the JSON to a walkable place**. Two facts:

1. **No loader exists.** Until authored JSON becomes a `world.structures` entry attached to a map
   node, the builder is a drawing program. This is the make-or-break; everything else is polish.
2. **The tool is ahead of the engine.** The engine's interiors are rectangular rooms that abut and
   share walls, doorways as gaps, **single-storey** (`roomState.js` hardcodes `singleStorey:true`),
   **no corridors** (abolished, FP-1), no freeform/bowed walls, no per-wall curves. The tool authors
   all of those. Rooms (incl. round), materials, and furniture line up; the rest does not.

### THE decision that gates the loader (Tim's call)

**Does the tool lead, or the engine?**
- **Tool leads** — grow the engine's interior model to accept freeform/bowed walls, corridors,
  multi-floor, sized/angled openings, secrets. Honors the rich authoring; a real engine project.
- **Engine leads** — the loader maps authored data *down* to what the engine supports today (curves →
  nearest rects, tunnels → shared-wall doorways, one floor). Faster; lossy — some drawn detail won't
  render/play.

Everything below is scoped by this answer. Recommend deciding it before building the loader.

---

## TIER 0 — Make it real (without this it does not play)

1. **The loader.** `house-builder/v6` JSON → `world.structures` topology (rooms + reciprocal
   doorways *derived from which rooms touch*, the hard part) → attached at a map node (the
   `demoFigures` authored-content pattern) → deterministic (authored = fixed data, like packs, so
   `worldHash` stays stable). This is the spine.
2. **Walkable + narratable.** The built topology must drive the interior system (enter / move
   room-to-room / exit) and feed the DM truthful room names/roles (the DM-invents-geography guard).
3. **Rendered.** The tabletop map must draw the authored floorplan + place its minis (reuse
   `drawModel`/`handDrawnInterior`). Features ahead of the render model degrade or need render work.
4. **Validation.** The tool can draw invalid structures (disconnected rooms, a door on nothing,
   overlaps). A validate pass (`normalizeTopology` + invariants) so a bad building fails loudly.
5. **A "walk what you built" test loop.** Boot an authored structure in the live game and verify on
   screen (the map-fidelity / browser-screen acceptance rule) — the proof it actually plays.

---

## TIER 1 — Authoring completeness (a building isn't "done" without these)

6. **Room roles/types.** Assign each room one of the engine's ~30 roles (kitchen, cellar, dungeon,
   armory, barracks, solar, crypt, taproom, scullery, larder…). Today you can only *name* a room, not
   *type* it — and the role is what makes the DM narrate it right and furniture belong. HIGH value.
7. **The full furniture set.** The engine has ~40 furniture types (hearth, table, chest, altar,
   throne, statue, sarcophagus, well, anvil, loom, shelves, weapon rack, pew, bones, rubble, web,
   brazier…). The tool offers 4. Pull the whole catalogue like the Secrets item menu.
8. **Multi-floor / stairs.** A castle / mega-dungeon needs levels + stairs. The engine is explicitly
   single-storey today, and an LLM inventing floors the engine lacks is a KNOWN bug — so this is
   engine work first, then a tool floor-switcher. The biggest single gap for "castle."
9. **The entrance.** Designate which door/room connects to the outside world (where a player enters
   from the map node). Interiors have an entry room; the tool sets none.
10. **Place NPCs + monsters.** Populate the building with authored NPCs (from the NPC builder) and
    bestiary monsters (the queued BESTIARY-1) at squares. The mini library is the seed; needs the
    palette + placement + occupancy in the export.

---

## TIER 2 — Dungeon-craft depth

11. **Door locks / keys / states.** Locked / barred doors + which key opens them (maps to the
    engine's `lock-close` events). Dungeons need gated passages.
12. **Traps.** Hidden hazards — the sibling of Secrets: a concealed trigger with a find/disarm DC and
    an effect. Reuses the secret-placement pattern.
13. **Light & darkness.** Per-room dark flag (cellars/dungeons) + light sources. The engine already
    has a `dark` flag; matters for play (darkvision, torches).
14. **Terrain features.** Water, chasms, rubble, rough ground inside a structure (the engine draws
    water/features outdoors; interiors want the same).
15. **Cover / elevation.** Explicit tactical cover + elevation for combat (furniture is implicit
    cover today; the DND_XCOM direction wants it explicit).

---

## TIER 3 — Glue / production

16. **Where buildings live.** A directory / pack + the registration point the engine loads them from
    (parallel to the NPC RAG → `server/rag/corpus` + `demoFigures` path).
17. **The `cookpot` catalogue entry.** The one tool furniture type with no engine render hook
    (bed/barrel/dresser exist).
18. **Round-trip / sync.** A built structure stays re-editable; schema versioning as the model grows.

---

## The recommendation

The next real move is **NOT another authoring tool** — it's the **architecture decision above +
Tier 0 (the loader)**. Until one built room is walkable in the game, every new authoring feature adds
to a pile that doesn't play. Pick tool-leads vs engine-leads, then build the smallest loader that
walks one hand-authored room. Tiers 1–3 are then incremental and safe.
