# ADJUDICATION_MAP — Existing Plumbing + Gaps (R1)

Inventory of the DM-adjudication machinery: what propose/resolve/delta infrastructure exists, which objects carry material/category, and what blocks the propose→resolve→log loop for "do anything" (R3).

**Written:** 2026-06-05 (R1 pass, exploration mode)
**Scope:** Read-only, no code changes, locates before building.

---

## The Loop We Need (R3 target)

```
playerText → propose (AI or heuristic)
         ↓
     resolve (D20 vs DC, approach, conditions)
         ↓
     validate & apply deltas (applyDeltas)
         ↓
     **log the ruling** (canon log entry)
         ↓
     narrate description
         ↓
     replay re-runs ruling, not AI
```

**Iron rule:** AI proposes (what could happen). Engine owns state mutation + dice + canon. Log the resolved ruling so replay is deterministic.

---

## Existing Propose Machinery

### 1. Physics Detection + Proposal (llmPhysics.js)

**What it does:**
- Detects player text references to furniture/items at current node (detectPhysicalInteraction)
- Matches against furniture `name`, `parts`, `notes` and inventory `name`
- Calls LLM (or offline fallback) with furniture + inventory context
- LLM returns structured proposal: `{ plausible: bool, result: string, deltas: [] }`

**Offline fallback (offlineFallback):**
- Pattern matching: force words (rip, break, smash) → damage + extract part
- Examine words (search, examine) → describe state + parts
- Take words (take, grab) → pickup if `bulk <= 2`
- Generic fallback: empty delta list, generic description

**Limitation:** Only triggers if furniture/item name is mentioned. No "what could I interact with?" query layer.

### 2. Conductor Proposals (conductor.js)

**What it does:**
- Examines thread tension, motif reinforcement, clock state, inevitability meter
- Proposes delta operations: escalateThread, introduceThread, reinforceMotif, increaseClock, spawnConsequence, forceBeat
- Returns `{ deltas: [], rationale: string, weightProfile: {} }`
- **Does NOT mutate directly**; playloop must call `applyConductorDeltas` to realize

**Limitations:**
- World-state tweaks only (clocks, threads, instruments)
- No impact on objects, furniture, position, or immediate scene

---

## Existing Resolve Machinery

### D20 vs DC (engine/resolve.js)
- Approaches: force/finesse/endure/heart/focus
- Maps to stats: MIGHT/AGILITY/GRIT/CHARM/WITS
- DC system exists, but not wired into physics yet

**Limitation:** `evaluatePhysics()` bypasses DC check entirely; LLM decides plausibility.

---

## Existing Delta Allowlist (effectsCore.applyDeltas)

The **sole mutation path**. All operations go through here.

### State Deltas
- **clock**: `{ op: 'clock', key, by }` — clamp to 0..12
- **resource**: `{ op: 'resource', entityId, key, by }` — entity resources dict
- **wound**: `{ op: 'wound', entityId, by }` — clamp to max wounds
- **stress**: `{ op: 'stress', entityId, by }` — clamp to 0..6
- **condition**: `{ op: 'condition', entityId, add|cond, until? }` — add condition to entity
- **position**: `{ op: 'position', entityId, set: { zone?, x?, y? } }` — entity position
- **time**: `{ op: 'time', key, by }` — world.time[key] (turn, scene, etc.)
- **env**: `{ op: 'env', key, by }` — environmental (noise, heat, scent, light) 0..6
- **advantage**: `{ op: 'advantage', actorId, by }` — advantage tokens, 0..2
- **threadRelief**: `{ op: 'threadRelief', by }` — reduce highest-tension thread
- **ledger**: `{ op: 'ledger', addFact?, addThreat?, addQuestion? }` — facts (cap 8)

### NPC Deltas
- **npcTrustDelta**: `{ op: 'npcTrustDelta', npcId, by }` — trust 0..10
- **npcSecretRevealed**: `{ op: 'npcSecretRevealed', npcId, secretFactId }` — add to revealedSecrets
- **npcKnowledgeShared**: `{ op: 'npcKnowledgeShared', npcId, fact }` — add to knowledgeGraph + topicsDiscussed (cap 20)
- **npcMemoryAdd**: `{ op: 'npcMemoryAdd', npcId, entry }` — add memory (cap 12, FIFO)

### Furniture/Item Deltas (Physics-driven)
- **createItem**: `{ op: 'createItem', entityId, bucket, item: { name, tags[], weight, noise, light, bulk, notes } }`
  - Validates: weight/noise/light/bulk in 0..5 range
  - Checks banned words in notes (Heartbreak Principle: no drama)
  - Item can come from nowhere (LLM-generated)

- **removeItem**: `{ op: 'removeItem', entityId, bucket, itemName }` — removes by name from bucket

- **modifyFurniture**: `{ op: 'modifyFurniture', nodeId, furnitureId, changes: { state?, parts[], notes? } }`
  - Mutates in-place: state, parts (reorder/remove), notes
  - Used by offline fallback: damage state, remove part

- **removeFurniture**: `{ op: 'removeFurniture', nodeId, furnitureId }` — delete furniture item

### Companion/Party Deltas
- **recruitCompanion**: `{ op: 'recruitCompanion', sourceNpcId, nodeId? }` — mint party member from NPC
- **dismissCompanion**: `{ op: 'dismissCompanion', entityId }` — remove from party

### Inventory (New Schema)
- **addItem**: `{ op: 'addItem', entityId, item: { id, defRef, equipped? } }` — T2 structured items
- **removeItemById**: `{ op: 'removeItemById', entityId, itemId }` — T2 remove by id
- **equipItem**: `{ op: 'equipItem', entityId, itemId, slot }` — set equipped slot
- **unequipItem**: `{ op: 'unequipItem', entityId, itemId }` — unequip
- **addCurrency**: `{ op: 'addCurrency', entityId, currency, amount }` — purse mutation

### Combat Deltas
- **combatState**: `{ op: 'combatState', set: {...}, enemyHpDelta: [], enemyDefeated: [], enemyConditions: [] }` — CM2/CM5/CM6

### Rumor Deltas
- **mintRumor**: `{ op: 'mintRumor', rumor: { id, sourceSeedId, carrierNpcId?, body, tags[], hopCount, tier, age } }`
- **forgetRumor**: `{ op: 'forgetRumor', rumorId }`

### Spell/Concentration Deltas
- **consumeSpellSlot**: `{ op: 'consumeSpellSlot', level }` — T3
- **setConcentration**: `{ op: 'setConcentration', spellRef?, startedAt? }` — T3
- **restoreSpellSlots**: `{ op: 'restoreSpellSlots' }` — T3

### Timeline/Conductor
- **rollRequest**: `{ op: 'rollRequest', action, dcSuggestion?, stat? }` — info-only, stored for playloop
- **timeline**: `{ op: 'timeline', add: string }` — narrative note

---

## Object Model (What Exists)

### Furniture (node.furniture[])
Each piece is a loose object with **optional** typed fields:

```javascript
{
  name: string,           // "wooden table" — the only required field
  parts: string[],        // ["leg", "plank", "edge"] — breakable pieces
  state: string,          // "intact", "damaged", "destroyed" — mutations update this
  bulk: 0..5,             // too heavy if > 2
  weight: 0..5,           // used by physics to determine breakability
  tags: string[],         // ["wood", "furniture", "light"] — inferred behavior signals
  notes: string           // "rough planks pinned with iron nails"
}
```

**Gaps:**
- No `material` field (implicit in `tags` and `notes`)
- No `category` enum (e.g. "furniture", "tool", "light", "container")
- No `state` machine definition (what states are valid?)
- No `properties` object for metadata (flamable?, conductive?, hollow?)
- No destruction formula (how many parts before gone?)

### Items (inventory.bucket[])
Two schemas coexist:

**Legacy (bucket-based):**
```javascript
{
  name: string,
  tags: string[],
  weight: 0..5, noise: 0..5, light: 0..5, bulk: 0..5,
  notes: string
}
```

**New (T2, items[] array):**
```javascript
{
  id: string,
  defRef: string,         // pointer to item definition
  equipped: string|null   // slot name or null
}
```

**Gaps:**
- Two schemas → two code paths
- defRef points to ruleset item def (not accessible from engine without import)
- Signals (weight, noise, light) are derived, not stored in T2 items
- No unified query layer

### Gear Properties (gearProps.js)

**What it computes:**
- `computeAttack(entity)` — attack bonus, damage dice, bonus, type from equipped weapon
- `computeAC(entity)` — AC from armor + DEX mod + accessories
- `scoreInventorySignals(entity)` → `{ weight, noise, light, bulk }`
- `scoreItemSignals(item)` → same signals
- `deriveSignalsFromTagsAndName(name, tags)` — infers signals from item metadata

**How it works:**
- Explicit fields take precedence (e.g. item.weight = 3)
- Falls back to regex + tag matching (lantern → light: 4; armor tag → weight: 3, bulk: 3)
- Produces clamped 0..5 values

**Limitations:**
- Tag-based inference is hardcoded regex list
- No way to query "what equipment bonuses does X provide?"
- No way to express "this sword glows faintly" as both combat bonus AND light signal

### Environmental Signals (envCore.js)

World-wide 0..6 scalars:
- `env.noise` — ambient sound level
- `env.heat` — temperature/fire presence
- `env.scent` — smell intensity
- `env.light` — visibility

**Gaps:**
- No per-object light/heat/noise emission (only world-level)
- No decay/diffusion (environmental is static)
- No "what's the light source here?" query

---

## Validation Machinery

### Physics Deltas (llmPhysics.validateDeltas)
- Checks op type (createItem, removeItem, modifyFurniture, removeFurniture)
- Validates required fields per op
- Validates item properties (weight/noise/light/bulk range 0..5)
- Checks banned words in notes
- Validates node/furniture/entity existence before approving
- **All-or-nothing**: one bad op = reject entire batch

### Conductor Deltas (conductor.js)
- No validation beyond type/existence checks
- applyConductorDeltas uses `mode: 'conductor'|'advisory'` to apply or dry-run

### Effect Core (effectsCore.js)
- Per-op validation (field presence, range clamping, existence checks)
- Silent skip if invalid (no error thrown)
- Clamping is permissive (bad value → default safe value)

**Gaps:**
- No schema validation (zod, ajv, etc.)
- No cross-field consistency checks
- No invariant assertion on delta batch (e.g., can't both createItem and removeItem for same target)

---

## Known Gaps Blocking R3

### 1. No Object Query Layer
- Can't ask "what furniture is near me?"
- Can't ask "what can I interact with in this scene?"
- Can't ask "is that wooden or stone?"
- llmPhysics needs explicit text mention to trigger

### 2. No Material/Category Schema
- Furniture has `tags` but no formal `{ material, category, state }` triple
- Inferred behavior (wood → planks, glass → shards + noise) is hardcoded in llmPhysics offline fallback
- No way for LLM to reason about properties systematically

### 3. No Inferred Behavior Vocabulary
- Destruction outcomes are LLM-generated (no guarantees)
- No "rulings library" (break, improvised weapon, fire/spread, fall, noise, block, move-object)
- Common outcomes (wood splinters into 1d4 shards) aren't codified

### 4. No State Machine for Objects
- Furniture has `state` string, but no valid states enum
- No way to express "intact → damaged → destroyed" progression
- No way to handle locked, open, sealed states

### 5. Missing Delta Operations
- No way to set object position on a scene (only entity position)
- No way to query object properties in a unified way
- No `modifyNode` for non-furniture scene properties
- No "create structure/building" op (only recruit companion)

### 6. No Spatial Adjudication
- Position ops exist (entity.position) but not grounded in furniture/LOS
- No "hide behind X" or "flank the wolf" support
- R5 (spatial adjudication) will need placeNav integration

### 7. Logging Not Connected to Physics
- llmPhysics returns deltas but doesn't log the ruling
- playloop would need to add a `{ kind: 'ruling', ... }` timeline entry manually
- No structure for "who proposed, what was plausible, what DC, what roll, what outcome"

### 8. Two Item Schemas
- Legacy bucket-based items vs. new T2 structured items
- Both paths in effectsCore; code duplication
- No unified property scoring

### 9. No Adjacency Cache
- Furniture generation is per-node, deterministic
- But playloop doesn't cache what's at the current node
- Every physics call re-scans all furniture

### 10. No Prop Generation from Rules
- Furniture templates are hardcoded (generateFurniture.js)
- No way to parameterize "a smithy should have anvil, tongs, crucible"
- Buildings have no embedded property hints (a tavern gets tavern-like furniture?)

---

## What Works Well (Keep This)

1. **Determinism floor is solid**
   - rng.js is the only source of randomness
   - All objects are generated deterministically per seed
   - Furniture is the same every replay (same node + same seed)

2. **Delta allowlist is bounded**
   - effectsCore is the sole path
   - New ops are opt-in, validated
   - Handles world state, inventory, combat, NPC trust, threads

3. **LLM is optional**
   - llmPhysics has offline fallback
   - Game continues deterministically if API is down
   - No silent failures (errors are caught, fallback is used)

4. **Furniture exists and is queryable**
   - generateFurniture.js produces deterministic sets
   - decompress.js populates node.furniture on decompression
   - Each piece has name, parts, state, bulk, weight, tags, notes

5. **NPC mutations are safe**
   - Trust, secrets, memory, knowledge — all go through effectsCore
   - Caps and FIFO eviction prevent overflow
   - conversationState tracks interactions deterministically

---

## How to Build R2 (Object Model)

From the gaps above, R2 needs:

1. **Unified object schema:** `{ id, material, category, state, properties: {}, furniture/item-specific fields }`
2. **Query layer:** "what's at this node?", "what's in my inventory?", "can I interact with X?"
3. **Material+category inference:** wood/stone/metal/cloth/glass → inferred outcomes
4. **State machine:** per category (e.g., wood: intact → damaged → destroyed; glass: intact → shattered; door: closed → open → broken)
5. **Property scoring:** centralize the signal derivation (weight, noise, light, bulk, breakability, flammability, etc.)
6. **Inferred behavior ops:** "break → extract part + noise", "take → check bulk", etc.
7. **Node object cache:** decompression pre-loads node.furniture with deterministic generation
8. **Prop templates:** building type → embedded furniture hints (smithy gets forge, anvil, tongs)

---

## How to Build R3 (DM Adjudication Engine)

Once R2 object model exists:

1. **Plausibility check:** AI (or local heuristic) proposes approach + DC
2. **Validate against objects:** do the referenced objects exist? can the approach physically work?
3. **Roll (if needed):** d20 vs DC, apply approach modifier
4. **Generate deltas:** map approach + roll outcome to delta ops
5. **Log the ruling:** add timeline entry: `{ kind: 'ruling', action, approach, dc, roll, outcome, deltas }`
6. **Apply deltas:** effectsCore.applyDeltas
7. **Narrate:** from timeline ruling entry (replay reads the ruling, not LLM)

---

## Next Steps

- **R2:** Write object schema, build query layer, unify item schemas
- **R3:** Wire llmPhysics into ruling logger; build compact ruling inliner for replay
- **R4:** Rulings library; expand delta vocab to match common cases
- **R5:** Spatial adjudication; placeNav integration

---

**Questions for code review:**
- Should R2 create a separate `objects.js` module, or extend state.js?
- Should node.furniture be pre-generated at newWorld() or lazily at decompression?
- Should object properties be stored as fields or computed on-the-fly?
- How do we handle durability progression (wood: intact → splintered → gone)?
