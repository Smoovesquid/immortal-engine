# RULINGS_LIBRARY_R4 — Common Adjudications Codified

**Goal:** The DM is consistent and fair. Every ruling follows a pattern so the player learns the rules and trusts the engine.

**Done when:** 7 core rulings tested end-to-end, each with a worked example, each replay-stable.

---

## The Problem

Without a rulings library, every action is LLM-generated, and the player can't learn the rules. One turn the DM lets you climb a wall; the next turn, the same action fails for a different reason.

With a rulings library, the player learns: "force actions are MIGHT vs DC 10. Finesse actions are AGILITY vs DC 12. If I succeed, I get what I want; if I fail, something else happens."

---

## Seven Core Rulings

### 1. **BREAK** — Smash an object apart

**Preconditions:** Target is breakable (material allows it), not already destroyed.

**Resolution:**
- Approach: force
- Stat: MIGHT
- DC: 10 + object.breakability modifier
- Success: Object → damaged state, yield parts as items
- Mixed: Object → damaged state (no parts yield)
- Failure: Object unchanged, narrate resistance

**Example:**
```
Player: "smash the barrel"
DC: 10 (wood, default breakability)
Roll: 16 + 2 (MIGHT mod) = 18 vs 10
Outcome: SUCCESS
- Barrel state: intact → damaged
- Items created: staves × 2, iron hoop × 1
- Narration: "Splinters fly..."
```

**Delta ops needed:**
- modifyFurniture (state, parts)
- createItem (multiple, from parts)
- env delta (noise from breaking)

---

### 2. **IMPROVISED WEAPON** — Use a mundane object as a weapon

**Preconditions:** Object exists, is holdable (bulk ≤ 2), is not a real weapon.

**Resolution:**
- Approach: force (if swinging) or finesse (if throwing)
- Stat: MIGHT or AGILITY
- DC: 11 (harder than a real weapon, +1)
- Success: Object acts as weapon (damage = material), can attack
- Mixed: Object acts as weapon (half damage)
- Failure: Object breaks or slips from hand

**Example:**
```
Player: "use the chair leg as a club"
DC: 11 (improvised)
Roll: 14 + 1 (MIGHT) = 15 vs 11
Outcome: SUCCESS
- Chair leg now usable as weapon (1d6 bludgeoning)
- Lasts until next break attempt
```

**Delta ops needed:**
- createItem (weapon version of object)
- modifyFurniture (state: broken, parts removed)
- combat integration (allow equip)

---

### 3. **LIGHT A FIRE** — Set something aflame

**Preconditions:** Target is flammable (material.flammable > 0), you have ignition source.

**Resolution:**
- Approach: finesse (precision) or force (pile fuel)
- Stat: AGILITY or MIGHT
- DC: 9 + target.wet_modifier (soaked = harder)
- Success: Fire spreads, damage 2d6 heat to nearby, consumes fuel over time
- Mixed: Fire starts but small, damage 1d6
- Failure: Ignition fails, target unchanged

**Example:**
```
Player: "light the wooden door on fire"
DC: 9 (wood, dry)
Roll: 12 + 1 (AGILITY) = 13 vs 9
Outcome: SUCCESS
- Fire starts on door (damage 2d6)
- Env delta: noise+3, heat+3, light+2
- Spreads to adjacent wooden structures over 3 turns
```

**Delta ops needed:**
- modifyFurniture (state: burning)
- env deltas (noise, heat, light)
- damage to adjacent objects/characters
- time-based fire spread

---

### 4. **FALL** — Gravity adjudication (vertical drops, being pushed)

**Preconditions:** Distance > 5 feet, no safe landing.

**Resolution:**
- Approach: endure (grip something) or force (controlled tumble)
- Stat: GRIT or MIGHT
- DC: 10 + (distance in 5-ft increments)
- Success: Land safely, take half damage
- Mixed: Land hard, take full damage, prone
- Failure: Tumble + extra damage

**Example:**
```
Player: "fall from 15 feet (3 increments)"
DC: 10 + 3 = 13
Roll: 8 + 2 (GRIT) = 10 vs 13
Outcome: FAILURE
- Fall damage: 3d6 (from distance)
- Extra: 1d6 (from fall failure)
- Condition: prone
- Narration: "You crash down hard..."
```

**Delta ops needed:**
- wounds delta (fall damage)
- condition delta (prone)
- position delta (new location)

---

### 5. **NOISE** — How loud is an action?

**Preconditions:** Any action that makes sound (breaking, footsteps, yelling).

**Resolution:**
- Automatic (no roll): noise = material.noise + action.noise modifier
- Noise spreads: affects perception checks, draws attention
- Cumulative: multiple loud actions attract more notice

**Example:**
```
Action: "smash the barrel"
Material noise: 3 (wood)
Action noise modifier: +2 (smashing force)
Total noise: 5
Effect: Alerts creatures within 100 feet (5 × 20ft per noise level)
Env delta: noise + 5
Timeline: Logged in env deltas
```

**Delta ops needed:**
- env delta (noise += amount)
- perception checks (NPC awareness)
- encounter spawn checks (noise attracts enemies)

---

### 6. **HIDE BEHIND / BLOCK** — Using objects for cover

**Preconditions:** Object is large enough (bulk ≥ 3), is between you and threat.

**Resolution:**
- Approach: finesse (careful positioning)
- Stat: AGILITY
- DC: 10 + threat.awareness (harder if enemy is already aware)
- Success: Gain cover (AC +2), can hide
- Mixed: Partial cover (AC +1)
- Failure: Exposed, lose action

**Example:**
```
Player: "hide behind the barrel"
DC: 10 (unaware enemy)
Roll: 15 + 3 (AGILITY) = 18 vs 10
Outcome: SUCCESS
- Gain full cover (AC +2)
- Can make ranged attacks from cover
- Enemy can't see you
```

**Delta ops needed:**
- condition delta (in-cover)
- ac bonus (tactical integration)
- visibility check (affects attacks)

---

### 7. **MOVE OBJECT** — Push/pull something (not break, just relocate)

**Preconditions:** Object is move-able (not fixed), you have strength/leverage.

**Resolution:**
- Approach: force (strength) or finesse (leverage)
- Stat: MIGHT or AGILITY
- DC: 10 + object.weight (heavier = harder)
- Success: Object moves to new location, use next action
- Mixed: Object moves 5 feet, use next action
- Failure: Object stuck or you lose footing

**Example:**
```
Player: "push the barrel out of the doorway"
DC: 10 + 3 (weight) = 13
Roll: 12 + 2 (MIGHT) = 14 vs 13
Outcome: SUCCESS
- Barrel moves from n1 to n2
- Doorway now clear
- Uses one of your next action
```

**Delta ops needed:**
- modifyFurniture (position on board)
- or removeFurniture + createItem at new location
- condition delta (uses action)

---

## Implementation Strategy

### Phase 1: Core Operators (Delta Allowlist Expansion)
Ensure effectsCore supports all needed ops:
- ✅ modifyFurniture (existing)
- ✅ createItem (existing)
- ✅ env deltas (existing)
- ✅ wounds delta (existing)
- ✅ condition delta (existing)
- ❓ position/move-object on furniture
- ❓ damage to nearby objects (AoE)

### Phase 2: Ruling Engine
```javascript
// Example structure
const rulings = {
  BREAK: {
    preconditions: (object) => query.canBreak(object),
    approach: 'force',
    stat: 'MIGHT',
    dcBase: 10,
    dcModifier: (object) => object.breakability || 0,
    outcomes: {
      success: (object) => breakOutcome(object),
      mixed: (object) => damagedOutcome(object),
      failure: (object) => []
    }
  },
  // ... 6 more
};
```

### Phase 3: Wiring into Adjudicate
```javascript
// In adjudicate.js
function adjudicateWithRulings(world, action) {
  const intent = parseIntent(action);
  const ruling = rulings[intent.ruleType];
  if (ruling) {
    // Use ruling engine instead of generic proposal
    return runRuling(world, ruling, intent);
  }
  // Fallback to generic adjudicate
  return adjudicate(world, action);
}
```

### Phase 4: Testing
For each ruling:
1. Unit test the ruling logic (preconditions, DCs, outcomes)
2. Integration test end-to-end (action → ruling → deltas → narration)
3. Determinism test (same seed → same outcome)
4. Worked example (one scenario showing all three outcomes)

---

## Worked Example: BREAK Ruling

**Setup:**
```
World seed: "example-break"
Player MIGHT: 12 (mod +1)
Target: wooden barrel (breakable, bulk 4)
```

**Scenario A: Success**
```
Roll: 18
Total: 18 + 1 = 19 vs DC 10
Outcome: SUCCESS
Deltas:
  - modifyFurniture: barrel state intact→damaged, parts reduced
  - createItem: barrel staves (weapon)
  - env: noise + 4
Timeline: Logged ruling
Narration: "Splinters spray everywhere as you wrench the barrel apart."
```

**Scenario B: Mixed**
```
Roll: 9
Total: 9 + 1 = 10 vs DC 10
Outcome: MIXED (ties fail in normal D&D, but ≥5 = mixed here)
Deltas:
  - modifyFurniture: barrel state intact→damaged, parts unchanged
  - env: noise + 2
Timeline: Logged ruling
Narration: "You crack the barrel, but it holds together."
```

**Scenario C: Failure**
```
Roll: 4
Total: 4 + 1 = 5 vs DC 10
Outcome: FAILURE
Deltas: (none)
Timeline: Logged ruling
Narration: "You strike the barrel hard, but it withstands the impact."
```

**Determinism Check:**
Same seed, same stats, same action → Scenario A always succeeds with same roll (18).

---

## Success Criteria

- [ ] 7 rulings defined with clear preconditions + DCs + outcomes
- [ ] Ruling engine wired into adjudicate
- [ ] Each ruling has worked example showing all 3 outcomes
- [ ] All 7 rulings end-to-end tested
- [ ] Determinism verified (same seed → same outcome)
- [ ] Player learns the rules from the pattern
- [ ] DM is consistent (no surprises, no special cases)
- [ ] Full test suite green + U88 tests (1 per ruling)

---

## Not in Scope (R5+)

- Spatial queries ("hide behind" uses boards, not objects)
- Multiple-target rulings (AoE damage spread)
- Chain reactions (fire spreads procedurally)
- Advanced tactics (Flanking, opportunity attacks)

These are R5+ work once the core 7 are locked.

---

## Timeline Estimate

- Ruling engine implementation: 1–2 hours
- 7 rulings coded: 1–2 hours
- Testing & verification: 1–2 hours
- **Total: 3–6 hours for R4 complete**

If solid, can push to R5 (spatial adjudication) same session.
