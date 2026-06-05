# ADJUDICATION_ENGINE_R3 — The Soul

**Goal:** Propose → Validate → Roll → Apply → Log. The loop that adjudicates "anything plausible" deterministically.

**Done when:** One scenario end-to-end (smash barrel → splinters), replay-stable, logging captures the ruling so replay re-runs the ruling not the AI.

---

## The Loop (Iron Rule)

```
Player: "smash the wooden barrel"
         ↓
    AI proposes: approach=force, DC=10, target=barrel
         ↓
Engine validates: barrel exists? can be broken?
         ↓
    Roll (if needed): d20 vs DC
         ↓
   Apply deltas: state → damaged, create items → splinters
         ↓
 **Log ruling**: { action, approach, dc, roll, outcome, deltas }
         ↓
  Narrate from log (not AI)
         ↓
Replay re-runs log entry (deterministic, no AI)
```

**The contract:**
- AI proposes (plausible? approach? DC?)
- Engine owns dice + state + validation
- Log captures the ruling (what was decided, what was rolled, what happened)
- Replay executes the log entry, not the AI

---

## Proposal: What the AI Suggests

Format:
```javascript
{
  plausible: boolean,        // is this physically reasonable?
  approach: string,          // 'force'|'finesse'|'endure'|'heart'|'focus'
  dcSuggestion: number,      // proposed DC (0..20)
  targetId: string,          // 'furniture:n1:0', 'npc:corwin', etc.
  deltas: [],                // candidate deltas (for preview)
  narrative: string          // what might happen (fallback only)
}
```

Sources:
- **LLM path:** Claude reasons about plausibility + approach + DC
- **Offline fallback:** material-driven outcomes from object model

---

## Validation: Engine Checks Reality

1. **Object exists?** `query.objectsAtNode(world, nodeId)` → find target
2. **Action is plausible?** Material + state allows it? `query.canBreak(obj)`, etc.
3. **Deltas are valid?** `validateDeltas()` — check op types, references exist
4. **Safety:** No cross-node mutations, no NPC deletion, no state corruption

If any check fails → return rejection + fallback to offline outcome

---

## Resolution: Roll (If Needed)

DC system from `resolve.js`:
- Approach → stat mapping: force→MIGHT, finesse→AGILITY, endure→GRIT, heart→CHARM, focus→WITS
- d20 vs DC: success (≥DC), mixed (≥DC-5), failure (<DC-5)
- Generate candidate deltas from outcome

Example:
- Player: "I try to pick the lock"
- Approach: finesse, DC: 12, Stat: AGILITY
- Roll: 16 + mod(player.AGILITY) vs 12
- **Success** → lock opens, deltas applied
- **Mixed** → lock partially opens, complications
- **Failure** → lock jams, requires a different approach

---

## Application: Execute Deltas

All deltas go through `effectsCore.applyDeltas()` — the sole mutation path.
Deltas include:
- `modifyFurniture` — state, parts, notes
- `createItem` — loot from breaking
- `position` — movement side effects
- `ledger` — log the fact ("lock picked by player")
- `env` — noise from breaking (updates `world.env.noise`)
- Any other mutation flagged in the allowlist

---

## Logging: Capture the Ruling

Timeline entry (deterministic, replayable):
```javascript
{
  t: world.timeline.length,
  kind: 'ruling',
  data: {
    action: 'smash the barrel',     // what the player said
    approach: 'force',
    targetId: 'furniture:n1:0',     // what was affected
    dcSuggestion: 10,               // DM's proposal
    roll: 16,                        // d20 result
    outcome: 'success',             // success|mixed|failure
    deltas: [                        // applied mutations
      { op: 'modifyFurniture', ... },
      { op: 'createItem', ... }
    ],
    narrativeOverride: null         // null = use default, or custom
  }
}
```

Replay:
- Read log entry
- Execute deltas (deterministic)
- Narrate from default template (no AI needed)

---

## Narrative: Read from Log, Not AI

Deterministic narration templates by material + action + outcome:

```javascript
templates[material][action][outcome]

// Example:
templates.wood.break.success →
  "You wrench the barrel apart. Wood splinters crash down, releasing the contents."

templates.metal.force.failure →
  "You strike the door, but it holds firm. Your impact rings out loudly."
```

If LLM-narration available: enhance but don't mutate. The log + template is canon.

---

## Plausibility: Local Heuristics (No LLM)

If LLM unavailable or offline, use rules-of-thumb:

- **Force:** wood/cloth/ceramic breakable, stone/metal mostly not
- **Finesse:** locks, delicate mechanisms, stealth
- **Endure:** poison/hunger/exhaustion, physical obstacles
- **Heart:** persuade NPCs, bargain, cooperate
- **Focus:** magic, memory, perception, decipher

Example offline proposal:
```javascript
{
  plausible: true,
  approach: 'force',
  dcSuggestion: 12,                 // 10 base + 2 for wood
  targetId: 'furniture:n1:0',
  deltas: physicsOutcome(obj),      // from object model
  narrative: ''                       // filled by template on narrate
}
```

---

## End-to-End Example

**Setup:**
- Player at node n1 with a wooden barrel (furniture index 0)
- Player says: "I smash the barrel and look inside"

**Step 1: Parse & Detect**
- Intent: break + examine
- Detection: finds furniture "wooden barrel"

**Step 2: Propose**
- LLM or offline → { plausible: true, approach: 'force', dc: 10 }

**Step 3: Validate**
- Barrel exists? ✓
- Can break? ✓ (wood, intact)
- Deltas valid? ✓

**Step 4: Roll**
- d20 + mod(MIGHT) vs 10
- Roll 14 + 2 (MIGHT 13) = 16 → **Success**

**Step 5: Generate Deltas**
- Material outcomes: wood breaks → splinters
- modifyFurniture: state=damaged, parts=[]
- createItem: splinters × 2-3

**Step 6: Apply & Log**
- applyDeltas() executes
- Timeline entry: { kind: 'ruling', action: 'smash the barrel', approach: 'force', roll: 16, outcome: 'success', deltas: [...] }
- world.env.noise += 3 (crash of breaking wood)

**Step 7: Narrate**
- Template for wood + break + success:
  "You raise the barrel and smash it open. Wood splinters fly. Inside, you find..."
- Loot descriptions from created items

**Step 8: Replay**
- Same input → read log → execute deltas → same state
- worldHash identical

---

## Architecture: Core Modules

**adjudicate.js** — main loop
```javascript
export function adjudicate(world, packs, playerText) {
  // 1. Parse intent
  // 2. Propose ruling (LLM or offline)
  // 3. Validate
  // 4. Roll (if needed)
  // 5. Apply deltas
  // 6. Log ruling
  // 7. Narrate
  return { world, narration, mechanics }
}
```

**ruling.js** — proposal + validation + logging
```javascript
export function proposeRuling(world, intent) {}
export function validateRuling(world, proposal) {}
export function applyRuling(world, ruling) {}
export function logRuling(world, ruling) {}
```

**adjudicationTemplates.js** — deterministic narration
```javascript
export const templates = {
  wood: { break: { success: "...", mixed: "...", failure: "..." }, ... },
  ...
}
```

---

## Not in Scope (Later)

- **R5 Spatial:** "hide behind the barrel", "flank the wolf" — ground referents to board positions
- **R6 Voice:** STT → utterance → adjudicate
- **R7 Tabletop feel:** Pacing, conversation, grace nudges

---

## Checklist

- [ ] adjudicate.js — main loop
- [ ] ruling.js — proposal/validation/logging
- [ ] adjudicationTemplates.js — narration by material+action+outcome
- [ ] U86+ tests — one scenario end-to-end (smash barrel)
- [ ] Determinism: worldHash stable under replay
- [ ] Playtest: one successful scenario, breakage captured in log
