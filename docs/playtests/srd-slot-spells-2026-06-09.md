# Playtest — Slot Spells Castable in Combat (2026-06-09)

**Build:** v2-polish, WORLD_VERSION 24 (fourth packet of the 5e integration)
**Persona:** crusty DM. "Slots on the sheet you can't spend are decoration."
**Surface:** unit matrix (U113, 10 tests) + live `v1.html` roll-up (Elf Wizard).

## Verdict: GREEN

## What casts now (all consume real 1st-level slots via consumeSpellSlot)

| Spell | Who | Mechanics |
|---|---|---|
| Magic Missile | Wizard, Sorcerer | "missile": three darts, 1d4+1 each, auto-hit. |
| Witch Bolt | Warlock | "witch bolt": spell attack (sheet bonus), 1d12 lightning. Outranks the generic "bolt" in the parser. |
| Bless | Cleric | "bless": +1d4 on the player's attack rolls (weapon, cantrip, and spell attacks) for the fight. Refuses double-cast without burning the slot. |
| Shield | Wizard, Sorcerer | "shield": +5 AC until your next turn. DM-adjudicated word: a caster who knows Shield with a slot left gets the spell; anyone else saying "shield" just guards (+4, free). |
| Armor of Agathys | Warlock | "agathys": 5 temp HP; while the ice holds, melee attackers take 5 cold (can drop them). Temp HP soaks before real HP. |

## Caught during build (the kind of bug this discipline exists for)

`featState()`'s fresh-fight branch didn't include the new fields, so
`tempHp += 5` was `undefined + 5 = NaN`, which the state normalizer clamped
to 0 — black ice that shattered instantly while claiming to be active. Found
because U113-08 asserted `agathysActive === (tempHp > 0)` coherence. Fixed,
plus a defaulting spread for saves written before these fields existed.

## Verified

- Out-of-slot casts refuse with table-talk and never underflow (U113-03).
- A fighter "casting" magic missile: "You trace the sigil, but that spell is not yours."
- Per-fight scoping: bless/agathys die with the fight; pact slot counts honest
  (warlock has exactly 1).
- Kit panel lists every castable slot spell with its verb and cost; character
  panel shows live slot count (2/2 L1 on the wizard, live screenshot
  /tmp/slots-play.png).
- Determinism: identical casts → identical worlds (U113-10).
- Full suite 7,351 green; playtest:full 500 runs, no bugs. No console errors live.

## Still open

- Charm Person and Entangle (control spells) are known but ride the deep
  engine's castSpell path, not the escape loop — needs an enemy
  condition model in the escape resolver.
- Slots restore on long rest only in spirit — no long-rest surface exists yet;
  currently they do NOT replenish on shortRest (intentional: slots are
  precious, rests are abstracted).
- Darkvision/light, Lucky-outside-combat, and exploration features: next.
