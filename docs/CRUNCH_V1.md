# Crunch v1 — RPG Mechanical Substrate

**Status:** Draft v1, 2026-04-11
**Ruleset:** 5e-lite (inspired by D&D 5e, not compatible with it — tuned for narrative pacing and approach verbs)
**Depends on:** `engine/state.js`, `engine/resolve.js`, `engine/combat/`, `engine/gear/gearProps.js`, `engine/effectsCore.js`

---

## Purpose

Layer full RPG crunch (stats, items, spells, bestiary, loot, XP, leveling) on top of the existing engine without rewriting what already works. Most of the scaffolding is already in `world.party[0]` and `world.ruleset` — this doc formalizes the evolution.

---

## What already exists (and why Track A is smaller than expected)

Reading `engine/state.js`:

```js
world.party[0] = {
  id, name, archetype, vibe,
  stress: 0..6,
  wounds: 0..6,
  stats: { MIGHT, AGILITY, WITS, GRIT, CHARM },   // ← already 5-stat
  inventory: {
    weapons: [], armor: [], tools: [], spells: [],
    consumables: [], tech: [], oddities: [], junk: [], clothes: []
  },
  traits: { ... },
  background: { ... },
  signature: { itemName, meaning },
  companion: null | {...}
}
world.ruleset = { id: 'core', version: 1 }
```

**What this means:** the stat block is already there. The inventory slots are already there. The ruleset hook is already there. Items are currently *strings* in arrays — that's the main gap. Stress/wounds exist but are 0..6 flat — they need to scale with level.

**Decision:** we evolve, we don't replace. Existing delta ops that touch `wounds` and `stress` keep working. We add new fields and new ops alongside.

---

## Stats mapping

The existing 5-stat system maps to 5e abilities as follows:

| Engine stat | 5e analogue         | Governs                          |
|-------------|---------------------|----------------------------------|
| MIGHT       | STR                 | melee attack, heavy lift, break  |
| AGILITY     | DEX                 | ranged attack, stealth, dodge    |
| WITS        | INT                 | lore, magic, investigation       |
| GRIT        | CON                 | HP, fortitude saves, endurance   |
| CHARM       | CHA                 | persuasion, intimidation, trade  |

**Wisdom-equivalent** is folded into WITS + CHARM depending on context. We do not add a sixth stat.

**Modifier formula (5e-identical):** `mod(stat) = floor((stat - 10) / 2)`.

**Approach verb mapping:** the existing approach differentiation (`force/finesse/endure/heart/focus`) keys off stats:
- `force` uses MIGHT
- `finesse` uses AGILITY
- `endure` uses GRIT
- `heart` uses CHARM
- `focus` uses WITS

`resolve.js` gets a `proficiencyBonus` input based on character level and whether the character is proficient in the approach.

---

## HP / wound track (scaled)

Keep `wounds: 0..maxWounds` as the wound track. Expose `maxWounds` as a computed field:

```
maxWounds(level, gritMod) = 6 + (level - 1) * 2 + max(0, gritMod)
```

Level 1: 6 wounds (current default).
Level 5: 14 wounds.
Level 10: 24 wounds.

`stress` (0..6) remains a separate axis — mental/composure damage, depleted by fear, charm attacks, high-stakes social. Does not scale with level.

**Why this model:** HP-feel without breaking existing code. Every `applyDeltas` op that currently touches `wounds` continues to work; the cap just grows with level.

---

## Level and XP

New fields on `world.party[0]`:

```js
{
  level: 1..20,
  xp: 0..infinity,
  xpToNext: int  // derived from level
}
```

**Leveling model:** milestone-based. XP gain comes from named events (defeat a named enemy, close a major thread, solve a scar, return home with a recovered artifact) — not from grinding. `effectsCore.applyDeltas` gets a `grantXp` op.

**Level-up table (simplified):**

| Level | XP | Prof bonus | New features                            |
|-------|------|-----------|-----------------------------------------|
| 1     | 0    | +2        | Start. Pick 3 skill foci.               |
| 2     | 100  | +2        | +1 to any stat (chosen at levelup).     |
| 3     | 250  | +2        | Second skill focus pick (4 total).      |
| 4     | 500  | +2        | +1 to any stat.                         |
| 5     | 1000 | +3        | Extra approach advantage per scene.     |
| ...   |      |           |                                         |

Full table lives in `engine/ruleset/core/levelTable.js`.

---

## Skills / foci

Skills are proficiencies attached to approach verbs, with a topical narrowing. Example foci:

- `athletics` (force, body): +prof on force approaches involving climbing, jumping, lifting
- `stealth` (finesse, shadow): +prof on finesse approaches involving hiding, sneaking
- `arcana` (focus, magic): +prof on focus approaches involving spells, rituals, magical lore
- `insight` (heart, social): +prof on heart approaches reading NPCs
- `survival` (endure, wilderness): +prof on endure approaches outdoors
- etc.

**Storage:**
```js
world.party[0].foci = [ 'stealth', 'arcana', 'insight' ]   // picked at chargen
```

**Resolve:** `resolve.js` accepts a `focus: string` input on the intent. If the focus matches one of the player's known foci AND the approach matches, `proficiencyBonus` is added to the roll. Otherwise only the stat mod applies.

---

## Equipment as first-class items

### Current state
`world.party[0].inventory.weapons` is `string[]`. "steel longsword" as a string has no mechanical weight.

### New state
Items are objects with IDs that reference an item catalog in the ruleset:

```js
world.party[0].inventory = {
  items: [
    { id: "item:sword_of_morning", defRef: "longsword_magic_1", equipped: "main_hand" },
    { id: "item:studded_leather_01", defRef: "studded_leather", equipped: "armor" },
    ...
  ]
}
```

**Item definitions** live in `engine/ruleset/core/items/*.js` and are loaded into the ruleset at world genesis:

```js
// engine/ruleset/core/items/weapons.js
export const longsword = {
  defRef: 'longsword',
  kind: 'weapon',
  slot: 'main_hand',
  damage: { dice: '1d8', type: 'slashing' },
  versatile: '1d10',
  weight: 3,
  properties: ['versatile'],
  rarity: 'common'
};
```

**Magic variants** extend base definitions:
```js
export const longsword_magic_1 = {
  ...longsword,
  defRef: 'longsword_magic_1',
  name: 'Sword of Morning',
  bonus: { attack: +1, damage: +1 },
  properties: [...longsword.properties, 'light (bright radius 10ft)'],
  rarity: 'uncommon',
  loreSeed: 'seed:swordofmorning'   // → rumor/prose-to-world hook
};
```

### Equip / unequip
New `effectsCore` ops:
```js
{ op: 'equipItem', itemId, slot }
{ op: 'unequipItem', itemId }
{ op: 'addItem', item }
{ op: 'removeItem', itemId }
```

### Combat reads equipped gear
`combat/combatResolve.js` computes player attack: `d20 + profBonus + mod(stat) + weapon.bonus.attack` vs enemy AC. Damage: `weapon.damage.dice + mod(stat) + weapon.bonus.damage`. Armor sets player AC.

`gear/gearProps.js` already exists as the seam for gear-as-physics-input. We extend it.

---

## Spells

Spells are typed effects, not free-form text.

### Definition
```js
// engine/ruleset/core/spells/fireball.js
export const fireball = {
  defRef: 'fireball',
  name: 'Fireball',
  level: 3,
  school: 'evocation',
  castingTime: 'action',
  range: '150ft',
  components: ['V', 'S', 'M'],
  duration: 'instant',
  savingThrow: 'DEX',
  effects: [
    { kind: 'damage', dice: '8d6', damageType: 'fire',
      area: { shape: 'sphere', radius: 20 },
      saveHalf: true }
  ],
  scalingByLevel: { extraDice: '1d6' }
};
```

### Player state
```js
world.party[0].spells = {
  known: [ 'fireball', 'shield', 'mage_armor', 'misty_step' ],
  slots: { 1: 4, 2: 3, 3: 2, 4: 0, 5: 0 },
  maxSlots: { 1: 4, 2: 3, 3: 2, 4: 0, 5: 0 },
  concentration: null     // or { spellRef, startedAt }
}
```

### Casting
New intent parser branch: `cast fireball at the bandits`. Resolves via `resolve.js` + a new `engine/spell/castSpell.js` module that:
1. Verifies slot availability.
2. Consumes slot via delta.
3. Routes effect through `effectsCore.applyDeltas` — `damage`, `applyCondition`, `moveEntity`, etc.
4. Emits a `spellCast` Canon Log event.
5. LLM narrates the result given the structured effect.

### Concentration
A new spell that requires concentration replaces the existing one. Damage to caster above threshold requires a GRIT save. Deterministic.

### Slice spell list
- `fire_bolt` (cantrip)
- `mage_armor` (1st)
- `shield` (1st, reaction)
- `misty_step` (2nd)
- `fireball` (3rd)
- `counterspell` (3rd, reaction)

Six spells is enough to prove the system.

---

## Bestiary

Monster stat blocks live in `engine/ruleset/core/bestiary/*.js`:

```js
export const owlbear = {
  defRef: 'owlbear',
  name: 'Owlbear',
  size: 'large',
  type: 'monstrosity',
  ac: 13,
  hp: { dice: '7d10+21', avg: 59 },
  speed: { walk: 40 },
  stats: { MIGHT: 20, AGILITY: 12, WITS: 3, GRIT: 17, CHARM: 7 },
  senses: { darkvision: 60 },
  cr: 3,
  xp: 700,
  actions: [
    { name: 'Multiattack', kind: 'action', sub: ['claws', 'beak'] },
    { name: 'Claws', kind: 'attack', bonus: +7, reach: 5,
      damage: { dice: '2d8+5', type: 'slashing' } },
    { name: 'Beak', kind: 'attack', bonus: +7, reach: 5,
      damage: { dice: '1d10+5', type: 'piercing' } }
  ],
  loreSeed: 'seed:owlbear_lore',
  loot: { table: 'monstrous_common', bonus: [] }
};
```

`combat/combatLifecycle.js` consumes these definitions to mint enemies. Existing combat enemy shape (hp, damage) is computed from the bestiary definition at mint time, not hand-authored per encounter.

### Slice bestiary
Eight entries: goblin, goblin archer, wolf, bandit, bandit captain, owlbear, cultist, and one unique named NPC-turned-enemy.

---

## Loot

Loot tables are pack-authored, referenced by creature or encounter:

```js
// engine/ruleset/core/loot/monstrous_common.js
export const monstrous_common = {
  rolls: 1,
  entries: [
    { weight: 40, result: null },                                // nothing
    { weight: 30, result: { kind: 'currency', amount: '1d6*10' } },
    { weight: 15, result: { kind: 'item', defRef: 'healing_potion_minor' } },
    { weight: 10, result: { kind: 'item', defRef: 'rope_silk' } },
    { weight:  5, result: { kind: 'magic', table: 'minor_trinkets' } }
  ]
};
```

Loot is rolled deterministically via `rng.js` on victory, rolled into `combatLifecycle.mintVictoryLoot`, and offered to the player via a new dialogue intent `loot` that wraps `addItem` deltas.

---

## Economy

Currency is a first-class inventory field:

```js
world.party[0].purse = {
  copper: 0,
  silver: 0,
  gold: 0,
  platinum: 0
}
```

Shop interactions are dialogue intents: `buy <item> from <npc>`, `sell <item> to <npc>`. NPCs can have a `shop` flag with `stock: [{defRef, price, restock}]`. Prices come from item definitions (base price × locale multiplier from region).

**New effectsCore ops:** `grantCurrency`, `spendCurrency`, `transferItem`.

---

## Ruleset module layout

```
engine/ruleset/
  core/
    index.js               // exports the whole ruleset as a single object
    stats.js               // mod() and DC scaling
    levelTable.js          // XP → level, features by level
    items/
      index.js
      weapons.js
      armor.js
      consumables.js
      magic.js
    spells/
      index.js
      fireball.js
      shield.js
      ...
    bestiary/
      index.js
      goblin.js
      owlbear.js
      ...
    loot/
      index.js
      monstrous_common.js
      ...
```

`world.ruleset = { id: 'core', version: 1 }` loads `engine/ruleset/core/index.js` at genesis.

---

## Character creation for the slice

Wanderer archetype, one-page chargen flow:

1. Name the character.
2. Distribute 27 points across the 5 stats (starting each at 8, max 15 before racial).
3. Pick 3 skill foci from the full list.
4. Pick a background: `soldier`, `scholar`, `outlander`, `criminal`, `folk hero`. Grants a cosmetic hook + 1 starting item.
5. Receive starting inventory: basic weapon, basic armor, 2 consumables, 10 gold.
6. Pick a signature item description (narrative only, mechanical = common).
7. If INT-focused, pick 2 cantrips + 2 1st-level spells. If not, no spells.

Existing chargen code lives in `engine/chargen/`. Extend it, don't replace it.

---

## Invariants to add

1. `level ≥ 1 and ≤ 20`.
2. `xp ≥ 0`.
3. `wounds ≤ maxWounds(level, gritMod)`.
4. Every `inventory.items[x].defRef` references a real item def in the ruleset.
5. Every `inventory.items[x].equipped` slot matches the item def's valid slot.
6. At most one item per slot.
7. `spells.slots[lvl] ≤ spells.maxSlots[lvl]`.
8. `spells.known[x]` references a real spell def.
9. `purse` values all ≥ 0.

---

## Test gates

- **R01 — stat mod:** `mod(10)=0, mod(15)=2, mod(20)=5`.
- **R02 — prof bonus by level:** fixture table matches the rules.
- **R03 — maxWounds scaling:** level 1 = 6, level 5 with GRIT 14 = 16.
- **R04 — equip cycle:** equip → save → load → `worldHash` equal; item still equipped.
- **R05 — attack roll:** deterministic roll fixture produces correct hit/miss.
- **R06 — damage roll:** fixture weapon + stat → correct damage.
- **R07 — spell slot consume:** cast fireball → slot count decremented, can't cast again at 0.
- **R08 — concentration break:** damage to concentrating caster above threshold → save → concentration drops on fail.
- **R09 — loot determinism:** same seed + same kill → same loot.
- **R10 — xp milestone:** defeating a named enemy grants deterministic XP.
- **R11 — level-up:** hitting XP threshold bumps level, recomputes maxWounds, grants feature per table.

---

## Non-goals

- Multiclassing.
- Feats as a separate system.
- Encumbrance beyond soft weight tracking.
- Opportunity attacks / reactions beyond the two listed spells.
- Grid combat.
- Crafting.
- Dual-wielding mechanics (property exists, not mechanically implemented).
