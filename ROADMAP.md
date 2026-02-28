# AI Dungeon Master (V2) — Roadmap Bites (toward Final Form)

This roadmap keeps the engine deterministic, offline-first by default, modular (no monoliths), and test-backed.

**Prime rule:** canon is the engine. AI can only polish display or propose constrained deltas.

---

## Bite 1 — Living Terrain Engine v1 (Narrative Map Graph)
**Objective:** introduce a persistent, evolving spatial memory layer (Zork-like) that the scene system must respect.

### Deliverables
- Add `world.map` with deterministic graph generation + fog-of-war.
- Scene selection comes from `world.map.currentNodeId` + adjacency (no free rotation).
- Scars/ecology visibly tag locations and bias tone.

### Engine modules (new)
- `engine/map/generateMap.js`
  - `generateInitialMap({ seed, packId }) -> { nodes[], edges[] }`
  - Nodes: `{ id, name, tags[], motifs[], scars[] }`
  - Edges: `{ a, b, kind:'path'|'road'|'tunnel' }`
- `engine/map/mapState.js`
  - `ensureMap(map)`
  - `discoverNode(world, nodeId)`
  - `moveToNode(world, nodeId)` (must be adjacent)
  - `scarifyNode(world, nodeId, scarId)`

### Integrations
- `engine/state.js`: ensure `world.map`
- `engine/sceneDirector.js`: derive `location/objective/tone` from current node + neighbor pressure
- `engine/playloop.js`: travel intents change `currentNodeId`

### Determinism rules
- Graph generation seeded solely by `world.meta.seed` and pack id.
- Movement constrained by edges only.

### Tests
- `tests/map_determinism.test.js`
  - same seed => same nodes/edges
  - discovery persists after save export/import
- `tests/map_scene_integration.test.js`
  - ecology/scars affect emotional tone deterministically

### Scope
- **M** (core system + small integration, no major UI)

---

## Bite 2 — Gear as Physics Inputs v1 (weight/noise/light)
**Objective:** items become real physics inputs; they affect rolls, clocks, and world tick—without UI bloat.

### Deliverables
- Expand gear schema to include a minimal property set:
  - `weight` (0..5), `noise` (0..5), `light` (0..5), `bulk` (0..5)
- Resolver uses equipped/used items to influence DC/roll consequences.
- World tick consumes aggregate signals (noise/light) into pressure/dread.

### Engine modules (new)
- `engine/gear/gearProps.js`
  - `scoreInventorySignals(entity) -> { weight, noise, light, bulk }`

### Integrations
- `engine/resolve.js`: incorporate signals into DC (small deltas only)
- `engine/worldTick.js`: if `noise>=X` increase threat pressure deterministically

### Tests
- `tests/gear_signals.test.js`
  - noisy kit -> higher pressure drift than quiet kit

### Scope
- **S/M**

---

## Bite 3 — Character Genesis v2 (ritual choices without dropdown hell)
**Objective:** character creation becomes ownership: flaws/details/keepsakes with deterministic choice.

### Deliverables
- Add micro-tables per pack for:
  - `detail` (tell), `keepsake`, `lineYouWontCross`, `rumor`
- UI step: for each category, roll 3 options, pick 1.
- Add `entity.traits` fields and print sheet support.

### Engine modules (new)
- `engine/chargen/details.js`
  - `rollDetailOptions(packId, seed, rng)`

### Tests
- `tests/chargen_choices.test.js`
  - same seed + same picks => identical entity

### Scope
- **M**

---

## Bite 4 — Environmental Signals v1 (noise/heat/scent/light)
**Objective:** make consequences emergent: actions leave residue that worldTick turns into escalation.

### Deliverables
- Add `world.env = { noise, heat, scent, light }` (0..6)
- `resolveMove` emits env deltas based on approach + gear tags
- `worldTick` consumes env deterministically:
  - high noise -> threat escalation
  - low light + high dread -> darker tone + higher risk bias

### Engine modules (new)
- `engine/env/envCore.js`
  - `applyEnvDeltas(world, deltas)`

### Tests
- `tests/env_tick_effects.test.js`

### Scope
- **M**

---

## Bite 5 — Factions/Threads anchored to Map (politics becomes geographic)
**Objective:** faction hostility and threads bind to places; war/famine/corruption show up as spatial pressure.

### Deliverables
- Living threads gain `nodeId`
- Faction moves target nodes and can scarify nodes
- SceneDirector surfaces faction pressure from current node

### Engine changes
- `engine/state.js`: ensure living threads include `nodeId`
- `engine/worldTick.js`: offscreen actions update map node tags/scars

### Tests
- `tests/faction_map_pressure.test.js`

### Scope
- **M/L**

---

## Bite 6 — Composer/Instrument v3 (scar-weighted myth pressure)
**Objective:** narration becomes inevitably consequence-aware without extra sentences.

### Deliverables
- Composer pulls a small `worldBias` vector:
  - active scars, ecology severity, faction war posture
- Add deterministic lexicon switches (still 1 sentence)

### Tests
- `tests/composer_scars.test.js`

### Scope
- **S/M**

---

## Bite 7 — Online AI as constrained planner v2 (less brittle, more legible)
**Objective:** online AI helps without becoming a writer; failures become debuggable.

### Deliverables
- Improve server parsing/validation reason codes (dev-only)
- Constrain CONDUCT deltas to existing safe ops; forbid new nouns; guard any addFact
- Add a small “AI last result” debug line in Advanced (not Release)

### Tests
- `tests/ai_contract_reasons.test.js`

### Scope
- **S/M**

---

## Bite 8 — Living Terrain Engine v2 (tactical zoom optional)
**Objective:** keep default Zork node travel but allow tactical “zoom” during confrontation.

### Deliverables
- `world.map.tactical = { active, zoneLayout }` only when beatType=confrontation
- Resolution uses zone layout + cover tags deterministically

### Tests
- `tests/tactical_zoom.test.js`

### Scope
- **L** (do last)

---

# Recommended order
Start with **Bite 1 (Map v1)**, then **Bite 2 (Gear signals)** or **Bite 4 (Env signals)** depending on whether you want “world feels heavy” (gear) or “world reacts” (env) sooner.
