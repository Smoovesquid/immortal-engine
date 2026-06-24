# ROADMAP — to the goal

One durable map so we stop drifting. Read with `IMMORTAL_INVARIANTS.md` and
`PACKETS.md`. Update this when a phase lands; don't let it go stale.

## The goal (one sentence)
An infinite, **voice-first, deterministic RPG that plays like tabletop D&D with a
great DM**: you say what you do in plain language — *anything plausible* — and the DM
adjudicates it, moves your piece on the one hand-drawn board, adjusts the math, and
narrates; all replay-stable, in a living world (ecology, people with wants, rumors),
with hidden Thelemic will and a world-native bestiary.

The differentiator vs. a video game: **nothing is set dressing.** "Smash the barrel,
grab a board, swat the hornet" must work — the DM rules on it. That flexibility,
streamlined and made deterministic, is the whole project.

## Where we are (honest)
**Solid / done:**
- Truth layer: deterministic engine, Canon Log authoritative, worldHash replay tests, invariants throw. (The non-negotiable floor — strong.)
- Living world (projections, no version risk): biomes, biome-appropriate encounters, ecology over time, NPC wants + discovery, hidden Will in casting, open-ended (no win). `docs/LIVING_WORLD_MERGE.md`.
- The board: ONE continuous walkable hand-drawn scale (interiors + village embedded), collision (`placeNav`), fog/LOS, click/compass/text move one token, click-to-interact (talk/fight). Authored-catalog interiors. Real-node villages. Bedroom start.
- Intent spine: text + click converge to one intent (`engine/intent/`); voice is the same pipe once STT is added.
- Process: REPO_MAP, INVARIANTS, PACKETS docs; packet discipline adopted.

**Plumbing exists but not assembled (the soul is unbuilt):**
- DM adjudication of improvised actions — `conductor.js` (delta proposals), `llmPhysics.js`, `gear/gearProps`, `env/envCore`, `decompression/furniture`, `effectsCore.applyDeltas` (bounded mutation). Present, not yet wired into a propose→resolve→log loop for "do anything."
- An object model where every prop is a real thing (material + category + state) the DM can reference and reason about — partial.

**Not started:** voice input (STT); position persistence in save (P-66c, deferred).

## The critical path (do in order; each is a packet, verified, suite green)

- **R0 — Foundation debt.** Finish P-66c (persist walk position in save + retire the
  `scene.interior` "mode") with the WORLD_VERSION checklist. Small; clears the last
  seam in the board so it's saveable and truly one-scale. *(tasked: #67)*

- **R1 — Inventory the adjudication plumbing.** Read `llmPhysics`, `conductor`,
  `gearProps`, `env/envCore`, `decompression/furniture`, and the `effectsCore` delta
  allowlist. Write `docs/ADJUDICATION_MAP.md`: what propose/resolve/delta machinery
  exists, which objects carry material/category, what the gaps are. No code. (The
  manual's "locate before you build" — we've tried this before; don't reinvent.)

- **R2 — Object model: nothing is set dressing.** Every prop/furniture/feature on a
  scene is a first-class thing with `{material, category, state}`, queryable ("what's
  near me I could use/break/hide behind?"). Material+category drive inferred behavior
  (wood→planks; glass→shards+noise) so we don't hand-stat everything. Feeds both
  spatial referents and adjudication.

- **R3 — DM Adjudication engine v1 (the soul).** The loop: utterance → AI proposes a
  structured ruling (plausible? approach, DC, consequences as candidate deltas) →
  engine validates (objects exist, deltas allowed) + rolls + applies + **logs the
  resolved ruling** → narrator describes. Prove it on ONE scenario end-to-end ("smash
  the barrel → planks + crash/noise"; then "swat with the board → improvised attack"),
  replay-stable. Iron rule: AI proposes, engine owns dice+state, log the ruling so
  replay re-runs the ruling not the AI.

- **R4 — Rulings library + delta vocabulary.** Codify the common rulings (break,
  improvised weapon, fire/spread, fall, noise, block/brace, move-object) so the DM is
  *consistent*; expand the delta allowlist just enough to express them. AI improvises
  only the genuine edges. This is the central tension: expressive enough for tabletop,
  bounded enough for safety. Grow deliberately, each ruling tested.

- **R5 — Spatial adjudication on the board.** The movement corner of the same engine:
  "hide behind the barrels", "flank the wolf", "retreat", "through the doorway" —
  ground referents (R2) to board positions, drive `walkTo` + cover/LOS math, log the
  resolved move. The DM moves your piece from your words.

- **R6 — Voice in.** Speech-to-text feeding the existing intent/adjudication pipe;
  TTS-out already exists. Now it's voice-playable end to end.

- **R7 — Tabletop feel pass.** Pacing (free out of combat, turns in combat), the DM's
  conversational voice, ruling consistency, the streamline (instant adjudication),
  graceful "the DM considers it" (plausible→roll, needs-a-tool→redirect, nonsense→
  nudge). Red-team for the feel.

## Continuing in parallel (North Star, not on the critical path)
Bestiary depth (toward 1000, world-native), rumor-collapse, prose-to-world world
generation, religions/factions. These advance opportunistically; the critical path
above is what turns this into *tabletop you can speak to.*

### Future spatial layers (rescued 2026-06-24 from the retired spatial gate ladder)
Un-built spatial intent beyond today's node/road/building/structure rendering — all
deterministic and *projection-only* (never canon authority), reproducible from seed:
- **Interior maps** — deterministic layouts per structure type (house, tavern, temple, tower, shop, dungeon), each yielding a tactical grid.
- **Tactical interaction layer** — interiors support interaction: deterministic obstacles, defined entry/exit, a valid movement grid.
- **Landmark nodes** — major landmarks (ruin, fortress, ancient shrine, wizard tower) get unique structure grammar, deterministic per node.
- **Dungeon generation** — procedural labyrinths (rooms, corridors, branch loops, boss chamber); see also `WORLD_AND_DUNGEONS.md`.
- **Faction spatial influence** — faction pressure shapes settlement layout (military → walls/towers, religious → temples, trade → markets).
- **Spatial discovery memory** — the player remembers discovered locations (node, structure, last-visited turn).

*(Full acceptance criteria preserved in `_archive/SPATIAL_EXPLORATION_VICTORY_GATES.md`; renamed off the old `S7–S12` labels to avoid the clash with the `S#` Canonical-Surface test names.)*

## Anti-drift commitments
1. **One phase at a time**, as a packet with a written done-when, verified + suite
   green before the next. No sprawling multi-direction sessions.
2. **Locate before building** (R1 before R3) — don't reinvent existing plumbing.
3. **The iron rule everywhere:** AI proposes, the deterministic engine owns position +
   dice + state, the resolved ruling is logged so replay is stable. Never let the AI
   be canon.
4. This file + INVARIANTS are the anchor. If a step doesn't move a phase here forward,
   question it.
