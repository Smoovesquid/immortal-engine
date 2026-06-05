# OBJECT_MODEL_R2 — Unified Schema + Query + Inference

**Status:** Design + implementation in progress (no playtesting needed yet)
**Done when:** Objects queryable, material/category inference works, state machines defined, determinism suite green

---

## The Goal

Every physical thing on a scene is a first-class object: `{ id, material, category, state, properties }`. The DM can query the world ("what's wooden?", "what's breakable?") and the physics engine infers outcomes (wood → splinters, glass → shards + noise).

---

## Unified Object Schema

All objects (furniture, items, scene features) conform to one shape:

```javascript
{
  // Identity
  id: string,              // "furniture:n1:0", "item:party:rope-coil"
  name: string,            // "wooden table", "iron brazier"
  
  // Classification (machine-readable)
  material: 'wood' | 'stone' | 'metal' | 'glass' | 'cloth' | 'ceramic' | 'organic',
  category: 'furniture' | 'tool' | 'light' | 'container' | 'weapon' | 'decoration' | 'food',
  
  // State & durability
  state: string,           // 'intact', 'damaged', 'destroyed', 'burned', 'rusted', etc.
  stateProgression: [],    // valid states for this object (computed from material+category)
  hp: number,              // durability (1..10); 0 = destroyed
  
  // Physical properties (signals)
  properties: {
    weight: 0..5,          // 0=feather, 5=anvil
    noise: 0..5,           // 0=silent, 5=deafening when moved
    light: 0..5,           // 0=dark, 5=blinding (light sources only)
    bulk: 0..5,            // 0=pocket, 5=structure; >2 means can't carry
    flammable: 0..5,       // 0=fireproof, 5=tinder-dry
    sharp: 0..5,           // 0=smooth, 5=razor
    hollow: boolean,       // can contain items
    conductive: boolean,   // conducts electricity/magic
    magnetic: boolean,     // attracted to magnets
  },
  
  // Optional structure
  parts: string[],         // removable pieces: ['leg', 'seat', 'back']
  containedItems: [],      // if hollow=true
  
  // Inferred behavior operators (computed)
  canBreak: boolean,       // material+state allows shattering
  canBurn: boolean,        // flammable > 0
  canRust: boolean,        // metal with moisture
  breakOutcome: {          // what happens when broken
    pieces: string[],      // "plank", "splinter", "shard"
    noise: 0..5,           // sound of breaking
    damage: 0..3,          // to creatures nearby
  },
  takeOutcome: {           // what happens when taken
    noise: 0..5,           // sound of pickup
    bulk: 0..5,            // resulting inventory bulk
    encumbrance: boolean,  // too heavy to move quickly
  },
}
```

---

## Material Inference Map

From name + tags → material:

| Material | Keywords | Material Props |
|----------|----------|----------------|
| **wood** | plank, table, chair, door, beam, log, stick | flammable:3, noise:1, weight:2 |
| **stone** | rock, brick, wall, floor, statue, basin | noise:0, weight:4, flammable:0 |
| **metal** | iron, steel, bronze, sword, nail, chain | noise:2, weight:3, conductive:true |
| **glass** | window, bottle, vial, lens, mirror | sharp:4, flammable:0, noise:3-on-break |
| **cloth** | cloth, canvas, rope, curtain, banner, sail | weight:1, flammable:2, noise:0 |
| **ceramic** | pot, jar, cup, tile, dish, pipe | breakable, noise:2 |
| **organic** | food, bone, leather, cork, paper, bark | flammable:2-3, noise:0, perishable |

---

## Category & Break Outcomes

| Category | Valid States | Break Outcome |
|----------|--------------|---------------|
| **furniture** | intact, damaged, destroyed | pieces from material; noise |
| **tool** | intact, damaged, broken | pieces; loss of function |
| **light** | lit, unlit, broken | extinguished; shards if glass |
| **container** | intact, damaged, destroyed | spills contents |
| **weapon** | intact, dulled, broken | damage reduced or unusable |
| **decoration** | intact, damaged, destroyed | pieces |
| **food** | fresh, stale, rotten | inedible |

---

## Object Query Layer

Core functions (deterministic, no RNG):

```javascript
// Find objects by property
worldObjects(world, nodeId)           // all objects at node
objectsNear(world, nodeId, distance)  // spatial radius
canBreak(obj)                          // breakable?
canTake(obj)                           // pickup-able?
canBurn(obj)                           // flammable?
hasParts(obj)                          // disassemble-able?

// Infer outcome
breakOutcome(obj)                      // { pieces, noise, damage }
takeOutcome(obj)                       // { noise, bulk, encumbrance }
burnOutcome(obj)                       // { ash, noise, duration }
```

---

## State Machine per Material

**Wood:**
- intact → (impact) damaged → (more) destroyed
- intact → (fire) burned
- parts extractable until destroyed

**Glass:**
- intact → (impact) shattered
- extractable shards with sharp+noise
- shattered → dust

**Metal:**
- intact → (rust) corroded
- intact → (heat) warped
- (mostly indestructible via force)

**Stone:**
- intact → (earthquake) cracked
- (nearly indestructible)

**Cloth:**
- intact → (tear) torn
- torn → (more) tattered
- (fire) burned

---

## Integration Points

### llmPhysics (already has offline fallback)
- Replace hardcoded regex breakage with material-driven outcomes
- Query object schema for weight/noise/light instead of inferring from tags

### effectsCore delta allowlist
- Add `{ op: 'modifyObject', objectId, changes: { state, hp, ... } }`
- Extend `createItem` to reference object schema

### Furniture generation
- Assign material/category at generation time
- Derive properties from schema, not explicit per-item

### Narration
- "You wrench a **wooden** leg from the table (splinters, crash)" — material drives flavor
- "The **glass** lantern shatters (sharp shards, sound)" — category drives risk

---

## Not Storing / Not Persisting

- `properties`: **computed** from material + category, not stored
- `stateProgression`: **computed** from material, not stored
- `canBreak`, `canBurn`, etc.: **computed** on the fly, not stored
- Break outcomes: **deterministic** from object state, not RNG-sampled

Object state is minimal: `{ id, name, material, category, state, hp, parts[], containedItems[] }`
Everything else is derived.

---

## Implementation Order

1. **objects.js** — core schema, material map, inference functions
2. **objectQuery.js** — world object access layer
3. **objectOutcomes.js** — deterministic break/take/burn behavior
4. **Update llmPhysics** — use object schema instead of hardcoded patterns
5. **Update furniture generation** — assign material/category at generation
6. **Update delta allowlist** — add modifyObject op
7. **Tests** — U85+ for object determinism, material inference, queries
8. **Invariants** — object schema validation

---

## Example Flow (end-to-end)

**Player:** "smash the wooden table"

1. **llmPhysics.detectPhysicalInteraction** finds furniture at node
2. **objectQuery.canBreak(table)** → true (wood, intact)
3. **objectOutcomes.breakOutcome(table)** → { pieces: ['leg', 'plank'], noise: 4, damage: 1 }
4. **effectsCore.applyDeltas** → modifyFurniture → state: damaged, parts: ['plank']
5. **effectsCore.applyDeltas** → createItem → leg (from table, tags: [wood])
6. **narrator** → "You wrench the table's leg free. Wood splinters crash down."

All deterministic, all queryable, all material-driven.
