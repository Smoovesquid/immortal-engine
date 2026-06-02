# Combat Mechanics Spec — CRUNCH v2

> The engine always runs the full math. The presentation layer decides
> whether the player sees numbers or prose. Deep mechanics make rich narration
> possible.

## Design Principles

1. **Always crunchy underneath.** Every interaction resolves mechanically — damage types, resistances, conditions, saving throws. The narrator reads the resolution and describes it.
2. **Surprise through combination.** Individual mechanics are learnable. Creatures combine them in ways that create novel puzzles. A veteran player should still encounter things they haven't seen.
3. **Traits are code, not strings.** Every trait hooks into the resolver at defined extension points. New traits extend the system without rewriting it.
4. **Physics-first.** Every mechanic has a physical or logical justification. "Immune to fire" because it's made of fire. "Feeds on healing" because it's a metabolic parasite. No arbitrary keyword soup.

---

## 1. Damage Types

### Primary Types (physical)
| Type | Description | Common sources |
|------|-------------|----------------|
| **slashing** | Edged cuts | Swords, claws, wind blades |
| **piercing** | Puncture wounds | Arrows, fangs, spears, bullets |
| **bludgeoning** | Impact trauma | Hammers, fists, falling, shockwaves |

### Energy Types
| Type | Description | Common sources |
|------|-------------|----------------|
| **fire** | Combustion, heat | Flame spells, lava, incendiary rounds |
| **cold** | Freezing, heat drain | Ice magic, cryo weapons, void exposure |
| **lightning** | Electrical discharge | Storm magic, power conduits, tesla coils |
| **acid** | Corrosive dissolution | Ooze attacks, chemical weapons, digestive spray |
| **sonic** | Pressure waves, vibration | Thunder spells, screams, explosions |

### Exotic Types
| Type | Description | Common sources |
|------|-------------|----------------|
| **radiant** | Pure energy, divine light | Holy weapons, stellar phenomena, truth magic |
| **necrotic** | Life drain, cellular decay | Undead touch, entropy fields, cursed wounds |
| **psychic** | Mental assault, cognitive overload | Telepathic attacks, memory parasites, despair auras |
| **poison** | Biological/chemical toxin | Venom, gas clouds, tainted food |
| **force** | Raw magical/physical energy | Magic missiles, gravity crushes, concussion |
| **temporal** | Time distortion, aging, stasis | Time magic, chronal parasites, entropy accelerators |
| **entropic** | Reality degradation, existential erosion | Cosmic entities, void exposure, things that shouldn't exist |

### How resistance works

Each creature has a `resistances` map:

```js
resistances: {
  fire: 'immune',       // takes 0 damage
  cold: 'resistant',    // takes half damage (floor)
  psychic: 'vulnerable' // takes double damage
  // unlisted types: normal (1x damage)
}
```

**Resistance levels:**
- `immune` — 0 damage. The attack connects but does nothing. Narration describes why.
- `resistant` — half damage (rounded down, minimum 0). Partial effect.
- `normal` — (default) full damage.
- `vulnerable` — double damage. The weak point.
- `absorb` — heals instead of damages. Rare. A fire elemental absorbs fire. A temporal parasite feeds on temporal damage.

Resistances can be **conditional**: `{ fire: { level: 'resistant', condition: 'while_submerged' } }`. The resolver checks active conditions before applying resistance.

---

## 2. Conditions

### Condition Object Shape

```js
{
  name: string,          // 'poisoned', 'stunned', 'ac+5:shield'
  until: number|string,  // turn number, 'end_of_next_turn', 'save_ends', 'permanent'
  source: string,        // what applied it: spell ref, trait ref, creature ref
  severity: number,      // optional: stacking intensity (poison severity 1-5)
  saveToEnd: {           // optional: save to shake it off each turn
    stat: string,        // 'GRIT', 'WITS', etc.
    dc: number
  },
  onTick: string|null,   // optional: trait ref that fires each turn while active
  stackBehavior: string  // 'replace'|'stack'|'extend'|'highest'
}
```

### Core Conditions

#### Movement / Position
| Condition | Mechanical Effect |
|-----------|-------------------|
| **prone** | Melee attacks against have -2 DC (advantage). Ranged attacks +2 DC. Standing costs movement. |
| **restrained** | Speed 0. Attacks against have -2 DC. Attacks made at +2 DC. |
| **grappled** | Speed 0. Can attempt escape (force/finesse vs grappler's force DC). |
| **immobilized** | Cannot change zone. Can still attack/cast. |
| **slowed** | Cannot advance zone this turn. DC +1 on finesse approaches. |

#### Impairment
| Condition | Mechanical Effect |
|-----------|-------------------|
| **blinded** | Cannot target specific enemies (random target). Attacks at +3 DC. Immune to gaze effects. |
| **deafened** | Cannot hear — immune to sonic damage and sound-based effects. Cannot respond to verbal commands. |
| **stunned** | Lose next turn. Attacks against have -3 DC. |
| **paralyzed** | Lose all turns until save. Attacks against auto-hit. Melee hits are critical. |
| **incapacitated** | Cannot take actions or reactions. Not unconscious — still aware. |
| **unconscious** | Incapacitated + prone + auto-fail MIGHT/AGILITY saves. Melee auto-crit. |

#### Ongoing Damage / Drain
| Condition | Mechanical Effect |
|-----------|-------------------|
| **poisoned** | +2 DC on all approaches. Takes poison damage = severity at start of each turn. GRIT save to end. |
| **bleeding** | Takes slashing damage = severity at start of each turn. Endure approach or healing ends it. |
| **burning** | Takes fire damage = severity at start of each turn. Can spend action to end (force DC 10). |
| **corroding** | AC reduced by severity. Persists until acid source removed. |
| **freezing** | Speed halved. AGILITY approaches at +2 DC. Severity increases by 1 each turn unless heat source. |

#### Mental / Psychic
| Condition | Mechanical Effect |
|-----------|-------------------|
| **frightened** | Cannot willingly move toward source. +2 DC on approaches while source visible. |
| **charmed** | Cannot attack source. Source has -3 DC on heart approaches against you. |
| **confused** | Each turn, roll d4: 1=attack self, 2=do nothing, 3=attack random, 4=act normally. |
| **memory_fog** | Cannot use focus approach. Forget most recent ledger fact. WITS save to end. |
| **identity_bleed** | Take on a trait from the source creature for duration. Your stats shift toward theirs. |
| **despair** | Cannot use heart approach. Stress +1 per turn. CHARM save to end. |

#### Buffs / Enhancement
| Condition | Mechanical Effect |
|-----------|-------------------|
| **hasted** | Extra action per turn. +2 AC. AGILITY approaches at -2 DC. When it ends: lose next turn (crash). |
| **shielded** | +AC equal to severity. Absorbs damage up to shield HP, then breaks. |
| **invisible** | Attacks against at +5 DC. Attacks made at -3 DC. Broken by attacking or casting. |
| **regenerating** | Heal severity HP at start of each turn. Stopped by fire or acid damage. |
| **blessed** | -1 DC on all approaches. +1 to all saves. |
| **enlarged** | +1 damage die size. MIGHT approaches at -2 DC. AC -1 (bigger target). |

#### Exotic / Novel
| Condition | Mechanical Effect |
|-----------|-------------------|
| **phased** | Exists partially out of reality. 50% chance to ignore any damage (coin flip via RNG). Cannot interact with physical objects. |
| **gravity_inverted** | Falls upward. Treated as prone unless flying. Movement is chaotic (+3 DC on all physical approaches). |
| **echo** | Actions repeat 1 turn later as ghostly echo (half effect). Lasts until dispelled. |
| **time_locked** | Cannot act, cannot be damaged, cannot be affected. Removed after fixed duration. Effectively removed from combat. |
| **parasitized** | Host to a creature. Takes damage = severity per turn. Killing the parasite requires focus approach DC 15+ targeting the host. |
| **mirrored** | Damage dealt is also dealt to self. Lasts until save or dispelled. |
| **resonance** | Linked to another entity. Both take damage when either is hit. Both benefit from healing to either. |

### Condition Stacking Rules

- `replace` — new application replaces old (default for most conditions)
- `stack` — severity increases (poison stacks: severity 2 + severity 3 = severity 5)
- `extend` — duration extends but severity stays
- `highest` — keep whichever has higher severity

### Condition Expiration

Each turn start, the resolver:
1. Ticks all `onTick` effects (poison damage, bleeding, etc.)
2. Checks `until` — remove if expired
3. Offers `saveToEnd` rolls — remove on success
4. Checks for condition interactions (burning + freezing cancel; resonance breaks if one entity dies)

---

## 3. Saving Throws

Every stat can be targeted:

| Stat | Saves Against | Fantasy Example | Weird Example |
|------|---------------|-----------------|---------------|
| **MIGHT** | Grapples, shoves, crushing, restraint, gravity | Giant's slam | Gravity well |
| **AGILITY** | Area attacks, traps, projectile barrages | Dragon breath | Collapsing architecture |
| **WITS** | Illusions, psychic assault, confusion, memory effects | Mind flayer blast | Identity parasite |
| **GRIT** | Poison, disease, exhaustion, death effects, concentration | Poisoned blade | Entropy field |
| **CHARM** | Fear, charm, despair, possession, emotional manipulation | Vampire's gaze | Despair aura |

### Save Formula

```
Roll: d20 + stat modifier + proficiency (if proficient)
vs DC: set by source (spell DC, creature trait DC, or fixed)
```

- **Success:** effect negated or halved (per effect definition)
- **Failure:** full effect applied
- **Critical save (natural 20):** always succeeds, even against effects that normally can't be saved against
- **Critical fail (natural 1):** always fails, effect applied at maximum severity

### Save Proficiency

Player characters have proficiency in 2 saving throw stats (chosen at character creation or derived from class/background). Proficiency adds the proficiency bonus to the save roll.

Creatures have `saveProficiencies: ['GRIT', 'WITS']` in their template — stat saves they're trained in.

---

## 4. Action Economy

### Turn Structure (revised)

Each round:

1. **Initiative** — Player rolls d20 + AGILITY mod. Each enemy has a fixed initiative modifier. Higher goes first. Ties: player wins vs enemies, otherwise by AGILITY stat.

2. **Each entity's turn (in initiative order):**
   - **Start-of-turn:** tick conditions, saving throws to end conditions
   - **Action:** one action (attack, cast spell, use item, dash, dodge, help, hide)
   - **Bonus action:** one bonus action (if available — some spells, traits, or items grant these)
   - **Movement:** change zone (one zone shift per turn unless hasted/dashing)
   - **Reaction:** one reaction per round (used between turns — shield spell, counterspell, opportunity attack)
   - **End-of-turn:** process end-of-turn effects

3. **Round ends** after all entities have acted.

### Actions Available

| Action | Effect |
|--------|--------|
| **Attack** | Use an approach (force/finesse) against a target. Weapon damage applies. |
| **Cast Spell** | Cast a spell using a spell slot or cantrip. |
| **Dash** | Move an extra zone this turn. |
| **Dodge** | Until next turn, attacks against you are at +3 DC. |
| **Help** | Give an ally -2 DC on their next approach. |
| **Hide** | AGILITY vs observers' WITS. If successful, gain invisible-like benefits until you attack or are found. |
| **Use Item** | Consume a potion, activate a device, etc. |
| **Grapple** | MIGHT vs target's MIGHT or AGILITY (target chooses). Success: target is grappled. |
| **Shove** | MIGHT vs target's MIGHT or AGILITY. Success: target is prone or pushed one zone. |

### Enemy Action Economy

Enemies use their `actions` array. Each action has:

```js
{
  name: 'Claw',
  toHit: number,        // added to d20 roll
  damage: string,       // dice expression: '2d6+4'
  type: string,         // damage type
  range: number|null,   // null = melee, number = feet
  save: {               // optional: save instead of attack roll
    stat: 'AGILITY',
    dc: 15,
    halfOnSave: true
  },
  conditions: [{        // optional: conditions applied on hit
    name: 'poisoned',
    severity: 2,
    until: 'save_ends',
    saveToEnd: { stat: 'GRIT', dc: 13 }
  }],
  recharge: number|null // optional: recharges on d6 roll >= this number at start of turn
}
```

### Multiattack

Creatures with the `Multiattack` trait specify which actions they take:

```js
traits: [{
  ref: 'multiattack',
  actions: ['claw', 'claw', 'bite']  // takes these actions on its turn
}]
```

### Legendary Actions

Elite+ creatures can have legendary actions — extra actions taken at the end of other entities' turns:

```js
legendaryActions: {
  perRound: 3,
  options: [
    { name: 'Tail Sweep', cost: 1, action: { ... } },
    { name: 'Wing Buffet', cost: 2, action: { ... } },
    { name: 'Frightful Presence', cost: 2, action: { ... } }
  ]
}
```

### Lair Actions

Mythic creatures can have lair actions — environmental effects that trigger on initiative count 20:

```js
lairActions: [
  { name: 'Tremor', effect: 'All ground creatures make AGILITY save DC 15 or fall prone' },
  { name: 'Darkness', effect: 'All light sources in lair extinguished. Creatures without darkvision are blinded.' },
  { name: 'Summon', effect: 'Roll encounter from lair encounter table. 1d4 minions appear.' }
]
```

### Reactions

Creatures can have reactions that trigger on specific events:

```js
reactions: [
  {
    name: 'Parry',
    trigger: 'hit_by_melee',    // when this happens
    effect: { acBonus: 3 },     // add +3 AC against that attack
    uses: 1                      // per round
  }
]
```

---

## 5. Trait System

### Trait Shape

A trait is a named mechanical modifier with hooks into the combat resolver:

```js
{
  ref: string,              // unique identifier: 'pack_tactics'
  name: string,             // display name: 'Pack Tactics'
  description: string,      // what it does in plain language
  hooks: {
    onTurnStart: fn|null,         // fires at start of this creature's turn
    onTurnEnd: fn|null,           // fires at end of this creature's turn
    onDealDamage: fn|null,        // fires when this creature deals damage
    onReceiveDamage: fn|null,     // fires when this creature takes damage
    onConditionApplied: fn|null,  // fires when a condition is applied to this creature
    onConditionRemoved: fn|null,  // fires when a condition is removed
    onAllyDamaged: fn|null,       // fires when an allied creature takes damage
    onEnemyDefeated: fn|null,     // fires when an enemy is defeated
    onCombatStart: fn|null,       // fires when combat begins
    onCombatEnd: fn|null,         // fires when combat ends
    onApproachRoll: fn|null,      // modifies the d20 roll for approaches
    onSaveRoll: fn|null,          // modifies saving throw rolls
    modifyDC: fn|null,            // modifies the DC of approaches against this creature
    modifyDamage: fn|null,        // modifies damage dealt or received
  }
}
```

### Hook Contract

Every hook receives `(context)` and returns `(modifications)`:

```js
// context always includes:
{
  world,          // current world state
  self,           // this creature's state
  combat,         // current combat state
  rng,            // seeded RNG
  trigger,        // what caused this hook to fire
}

// hook returns modifications (or null for no change):
{
  damageModifier: number,   // multiply damage by this
  dcModifier: number,       // add to DC
  conditions: [],           // conditions to apply
  narrative: string,        // narration hint for the prose layer
  cancel: boolean,          // cancel the triggering action entirely
}
```

### Example Traits

#### Combat Positioning
| Trait | Hook | Effect |
|-------|------|--------|
| **Pack Tactics** | `onApproachRoll` | -2 DC when an ally is within one zone of the target |
| **Flyby** | `onTurnEnd` | Does not provoke opportunity attacks when leaving engaged zone |
| **Ambush** | `onCombatStart` | If hidden at combat start, first attack is at -5 DC and deals double damage |
| **Hold the Line** | `modifyDC` | Enemies cannot move through this creature's zone without MIGHT save |

#### Damage Modification
| Trait | Hook | Effect |
|-------|------|--------|
| **Reckless** | `onApproachRoll` | -3 DC on force attacks, but attacks against this creature also get -3 DC until next turn |
| **Evasion** | `onSaveRoll` | On successful AGILITY save, take 0 damage instead of half |
| **Uncanny Dodge** | `onReceiveDamage` | Once per round, halve incoming damage from an attack you can see |
| **Absorb Element** | `onReceiveDamage` | When hit by elemental damage, gain resistance to that type until end of next turn + next melee attack deals +1d6 of that type |

#### Resource / Healing
| Trait | Hook | Effect |
|-------|------|--------|
| **Regeneration** | `onTurnStart` | Regain HP = severity unless took fire or acid damage last round |
| **Feeds On Magic** | `onReceiveDamage` | Damage from spells heals instead. Spell slots used against this creature are wasted. |
| **Death Burst** | `onEnemyDefeated` (self) | When this creature dies, all entities in same zone take Xd6 damage (type varies) |
| **Life Drain** | `onDealDamage` | Heal HP equal to necrotic damage dealt |

#### Senses / Information
| Trait | Hook | Effect |
|-------|------|--------|
| **Blindsight** | `modifyDC` | Not affected by blinded condition. Detects invisible creatures within range. |
| **Tremorsense** | `modifyDC` | Detects creatures touching the ground within range. Not fooled by invisibility. |
| **Telepathy** | n/a | Can communicate silently. Heart approaches work regardless of language. |
| **Magic Sense** | `onCombatStart` | Knows all active spells and conditions on all entities at combat start. |

#### Reality-Breaking (novel mechanics)
| Trait | Hook | Effect |
|-------|------|--------|
| **Phase Shift** | `onReceiveDamage` | 50% chance (RNG) to ignore physical damage. Always takes force/psychic. |
| **Mirror Self** | `onCombatStart` | Creates 1d4 mirror images. Each image must be destroyed (1 HP each) before real creature can be hit. |
| **Gravity Well** | `onTurnStart` | All entities within one zone make MIGHT save DC X or are pulled to engaged range and slowed. |
| **Time Slip** | `onTurnEnd` | 25% chance to take an extra turn immediately. Cannot chain. |
| **Causal Loop** | `onReceiveDamage` | First time this creature would be reduced to 0 HP, it resets to the HP it had 2 rounds ago. Once per combat. |
| **Existential Doubt** | `onDealDamage` | Psychic damage dealt also reduces the target's highest stat by 1 until rest. |
| **Probability Collapse** | `modifyDC` | All d20 rolls within this creature's zone are replaced by a flat 10. No luck, only math. |
| **Sympathetic Damage** | `onReceiveDamage` | When this creature takes damage, one random ally of the attacker also takes half that damage. |
| **Narrative Awareness** | `onApproachRoll` | This creature knows what approach the player chose before resolution. Adjusts its counter accordingly (+2 AC vs force, +2 DC on heart). |
| **Dimensional Anchor** | `modifyDC` | Teleportation within 60ft fails. Misty step, phase shift, and zone-skipping abilities are suppressed. |
| **Wound Echo** | `onDealDamage` | Wounds dealt by this creature reopen 3 rounds later, dealing half the original damage again. |
| **Despair Aura** | `onTurnStart` | All enemies within one zone make CHARM save DC X or gain despair condition. |
| **Probability Storm** | `onApproachRoll` | All d20 rolls near this creature have their result inverted (1→20, 2→19, ..., 20→1). |

---

## 6. Spell System (expanded framework)

### Spell Shape

```js
{
  ref: string,              // 'fireball', 'gravity_crush', 'memory_wipe'
  name: string,
  level: number,            // 0 = cantrip, 1-9 = leveled
  school: string,           // see schools below
  castTime: string,         // 'action', 'bonus_action', 'reaction', 'ritual_1min'
  range: number|string,     // feet, 'self', 'touch'
  area: string|null,        // '20ft_sphere', '30ft_cone', '60ft_line', null for single target
  duration: string,         // 'instant', '1_round', '1_minute', '1_hour', 'concentration_1min'
  components: string[],     // ['V', 'S', 'M']
  concentration: boolean,
  damage: {
    dice: string,           // '8d6'
    type: string,           // damage type
    scaling: { ... }        // per-level scaling
  } | null,
  save: {
    stat: string,
    halfOnSave: boolean
  } | null,
  conditions: [{            // conditions applied by the spell
    name: string,
    severity: number,
    until: string,
    saveToEnd: { stat, dc } | null
  }] | null,
  effects: string[],        // special effect refs: 'teleport_30ft', 'create_mirror_images'
  description: string       // for narration layer
}
```

### Spell Schools

| School | Domain | Examples |
|--------|--------|----------|
| **Evocation** | Direct energy/damage | Fireball, lightning bolt, force missile |
| **Abjuration** | Protection/negation | Shield, counterspell, dimensional anchor |
| **Conjuration** | Summoning/teleportation | Misty step, summon swarm, create terrain |
| **Transmutation** | Transformation/enhancement | Enlarge, haste, polymorph, stone to flesh |
| **Divination** | Knowledge/detection | True sight, detect thoughts, identify weakness |
| **Enchantment** | Mind control/emotion | Charm, command, dominate, suggestion |
| **Necromancy** | Death/undeath/life force | Animate dead, life drain, revivify |
| **Illusion** | Deception/misdirection | Mirror image, invisibility, phantasmal killer |
| **Chronomancy** | Time manipulation | Slow, haste, time stop, rewind |
| **Entropics** | Reality/probability | Probability collapse, existential doubt, void bolt |

### Spell Count Targets

The system should support **200+ spells** at maturity:
- ~30 cantrips (reliable at-will options across all schools)
- ~40 level 1-2 (bread and butter)
- ~40 level 3-4 (encounter-defining)
- ~30 level 5-6 (powerful, fight-changing)
- ~30 level 7-8 (rare, dramatic)
- ~15 level 9 (world-shaking, once-per-day)
- ~20+ unique creature-only spells (not in the player list — surprises)

---

## 7. Creature Combat Template (revised)

The full creature template for combat resolution:

```js
{
  // Identity
  ref: string,
  name: string,
  cr: number,
  tier: string,

  // Core stats
  maxHp: number,
  ac: number,
  speed: number,
  stats: { MIGHT, AGILITY, WITS, GRIT, CHARM },
  saveProficiencies: string[],    // stats this creature has save proficiency in

  // Damage interaction
  resistances: {
    [damageType]: 'immune'|'resistant'|'vulnerable'|'absorb'
  },
  conditionImmunities: string[],  // conditions that cannot be applied

  // Action economy
  actions: [{
    name: string,
    toHit: number,
    damage: string,       // dice expression
    type: string,         // damage type
    range: number|null,
    save: { stat, dc, halfOnSave } | null,
    conditions: [{ name, severity, until, saveToEnd }] | null,
    recharge: number|null
  }],
  multiattack: string[]|null,     // action names used in multiattack
  legendaryActions: { perRound, options } | null,
  lairActions: [] | null,
  reactions: [] | null,

  // Traits (mechanical modifiers)
  traits: string[],       // trait refs from the trait registry

  // Spells (if spellcaster)
  spellcasting: {
    ability: string,          // stat used for spell DC
    spellDC: number,
    spellAttack: number,      // toHit for spell attacks
    slots: { 1: n, 2: n, ... },
    knownSpells: string[]     // spell refs
  } | null,

  // Gear (if equipped)
  gear: [{ ref: string, slot: string }] | null,

  // Senses
  senses: {
    darkvision: number|null,      // range in feet
    blindsight: number|null,
    tremorsense: number|null,
    truesight: number|null
  },

  // Ecology (narration fuel)
  habitat: string,
  ecology: string,            // diet, lifecycle, reproduction
  behavior: string,           // what it does when it sees you
  encounterSign: string,      // what you notice before you see it
  socialStructure: string,    // solitary, pack, hive, court
  physicalDescription: string,
  weakness: string,           // the smart-player hint
  loreHook: string,

  // Classification
  tags: string[],
  canParley: boolean,
  languages: string[]|null,

  // Loot
  lootTableRef: string
}
```

---

## 8. Player Presentation Toggle

The resolver emits a **combat event** with both mechanical and narrative data:

```js
{
  mechanical: {
    source: 'death_adder',
    target: 'player',
    damage: 4,
    damageType: 'poison',
    conditionApplied: { name: 'poisoned', severity: 2, until: 'save_ends', saveToEnd: { stat: 'GRIT', dc: 13 } },
    hpBefore: 22,
    hpAfter: 18
  },
  narrative: {
    // LLM-generated from mechanical data + creature loreHook + encounterSign
    prose: "The adder's fangs sink into your forearm. Within seconds your vision yellows at the edges and your stomach turns."
  }
}
```

Player sees one or both based on their preference setting:
- **Crunch mode:** "Death Adder hits for 4 poison. You are Poisoned (severity 2, GRIT DC 13 to end). HP: 18/22."
- **Narrative mode:** "The adder's fangs sink into your forearm. Within seconds your vision yellows at the edges and your stomach turns."
- **Hybrid mode:** Prose description + stat bar showing HP, active conditions, and damage numbers on hover/tap.

---

## 9. Implementation Phases

This spec is the contract. Implementation rolls out in passes:

### Phase 1: Foundation
- Damage type system + resistance matrix in resolver
- Condition framework (apply, tick, expire, save-to-end)
- Saving throws for all 5 stats
- Presentation toggle (crunch/narrative/hybrid)

### Phase 2: Action Economy
- Initiative system
- Enemy actions from template (replacing flat damage)
- Multiattack
- Reactions
- Bonus actions

### Phase 3: Traits as Code
- Trait registry with hook system
- 20 core traits implemented
- Trait composition on creatures

### Phase 4: Spells Expansion
- Spell school framework
- 50+ spells (up from 6)
- Creature spellcasting

### Phase 5: Elite Mechanics
- Legendary actions
- Lair actions
- Mythic traits (second health pool, phase transitions)

### Phase 6: Ongoing
- Expand spell list toward 200+
- Expand trait library
- Novel mechanics per creature batch
- Creature-only spells (surprises for players)

---

## 10. Compatibility Notes

- **Existing 5 approaches remain.** Force/finesse/endure/heart/focus are the player's verbs. The expanded action economy applies to enemies and NPCs.
- **Wounds/stress dual track remains.** HP damage maps to wounds via thresholds. Psychic/despair damage can target stress directly.
- **Zone system remains.** Far/near/engaged still govern positioning. Traits and spells can add zones (e.g., "above" for flying).
- **Determinism contract preserved.** All new mechanics route through seeded RNG via `engine/rng.js`. No `Math.random()`.
- **Canon Log remains authoritative.** Combat events are Canon Log entries. The resolver writes them, the narrator reads them.
- **LLM layer never throws.** If the narrative presenter can't generate prose, it falls back to mechanical output. The crunch always works.
