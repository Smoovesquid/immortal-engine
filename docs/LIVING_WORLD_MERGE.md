# Living-World Merge — bringing the infinite world into the canonical engine

**Goal.** "An Ordinary Morning" should open into a living, varied world — a region with
biomes, an ecology that remembers, discoverable stories, and a hidden Will shaping
your magic — all on the *canonical* engine (Canon Log, determinism, save, AI DM, voice),
not the throwaway prototype loop (`public/map/worldSession.js`).

## Where we are

Two world models grew in parallel:

- **Canonical (`v1` / `engine/playloop.js`):** real map (`engine/map/`), nodes with
  `id/name/nodeType/x/y`, travel, sight, scarification, goals, dialogue, escape +
  deep combat, a *global abstract* `w.ecology` (3 scalars: corruption/instability/
  scarcity) that drives factions/scars/threads. Save + WORLD_VERSION + AI DM live here.
- **Prototype systems (already pure engine modules):** `engine/ecology/` (biome
  foodwebs, species populations, spawns, events), `engine/discovery/` (rumor/story
  distribution), `engine/magic/` (hidden Will), `engine/world/regionGen.js` (biomes/
  rivers/roads). These were consumed by the prototype's separate `worldSession`, never
  wired into the canonical world.

The merge = wire those systems into the canonical world.

## Design principles

1. **Extend the canonical engine; never fork it.** The prototype's `worldSession` is a
   sandbox, not the trunk.
2. **Prefer deterministic projections over new mutable state.** Biome, ecology snapshot,
   discovery payoff = pure functions of `(seed, node, timeline)`. This keeps `worldHash`
   replay-stable and avoids a WORLD_VERSION bump where possible. Only bump the version
   when a field genuinely must persist (and then follow the CLAUDE.md checklist).
3. **Determinism is law.** `rng.js` only; same seed → same world. No `Math.random`.
4. **LLM stays silent-fallback.** All new prose must read well with the AI off.
5. **Each phase ships green** (full `node --test`) and is verified live.

## Phases

- **P1 — Biome the world. ✅ DONE.** Pure `biomeForNode(seed, node)` projection
  (`engine/world/biome.js`, spatially coherent). Travel/arrival narration reflects the
  biome ("You reach Roadside, where heat ripples off the sand."). Tests: `LW1`. Verified
  live. No worldHash/version impact (pure projection).
- **P2 — Biome-appropriate encounters. ✅ DONE.** `selectCreatures(cr,count,region,rng,biome)`
  prefers creatures native to the node's biome (via bestiary `habitat`→`biomeOf`), wired
  at both spawn call sites in `engine/playloop.js`. Tests: `LW2`. (Note: escape-mode
  ambushes fire rarely in bounce-nav; the filter itself is unit-proven 100% native.)
- **P3 — Living ecology over time. ✅ DONE.** `engine/ecology/snapshot.js` —
  `ecologySnapshot(seed,biome,day)` projects prey/predator/scavenger levels on slow
  seasonal cycles from the world clock (no stored state). Surfaced sparsely (~1 in 4
  arrivals) as travel flavor: "The hunters are bold this season — you are not the only
  thing that kills here." Tests: `LW3`.
- **P4 — Discovery surfaced. ✅ DONE.** Meeting an NPC surfaces their WANT
  (`engine/npc/npcArc.js`, role-appropriate, mostly mundane), and for the perceptive
  (WITS) an unreliable tell when they carry a deeper thread. Most lead nowhere; a few
  hint at more. Wired into the dialogue-enter in `engine/playloop.js`. Tests: `LW4`.
  (Also fixed a "Dax the Wary the elder" double-"the" seam.)
- **P5 — Hidden Will surfaced. ✅ DONE.** Live casting now passes `will:true`
  (`engine/playloop.js` → `castSpell`). Deeds bend which schools answer: a wrathful
  caster throws fire freely (0/40 miscasts); a merciful one struggles (12/40). The feel
  is computed but never shown — zero readout. Covered by `M3`.
- **P6 — The open horizon. ✅ DONE.** Decision (user): no win destination, fully
  open-ended. Removed the begin-time reach goal + destination objective and the
  win-on-arrival lock in `engine/playloop.js`; the objective is now ambient ("Your
  life is your own. See where the road leads."). Arriving anywhere is just arrival.
  Combat-defeat remains the one real fail state (the road still has teeth). Verified:
  0 reach-victories across 25 random runs; the world stays open. No victory tests
  broke (they exercise the goal/ending mechanisms directly, not the escape wiring).

## Test plan

`LW#` prefix. P1: `LW1.biome.test.js` (determinism, coherence, valid-biome). Each later
phase adds its own `LW#`. Determinism suite (`U19/21/22/27/30`) must stay green at every
phase.
