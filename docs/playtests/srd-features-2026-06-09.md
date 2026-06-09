# Playtest — Class & Species Features Fire in Combat (2026-06-09)

**Build:** v2-polish, WORLD_VERSION 24 (third packet of the 5e integration)
**Persona:** crusty DM. "A barbarian who can't rage is a commoner with a good axe."
**Surface:** unit matrix (U112, 12 tests) + live `v1.html` roll-up.

## Verdict: GREEN

## What fires now

| Feature | Who | Mechanics |
|---|---|---|
| Rage | Barbarian | Verb "rage": +2 melee damage, incoming weapon damage halved, per fight. Tagged in beats. |
| Second Wind | Fighter | Verb "second wind"/"rally": heal 1d10+level, once per fight. |
| Sneak Attack | Rogue | +1d6 (doubled on crit) with finesse/ranged weapon when striking from cover or in the opening round. |
| Savage Attacks | Half-Orc | One extra weapon die on melee crits. |
| Lucky | Halfling | Natural 1 on any attack roll is rerolled, with a beat. |
| Relentless Endurance | Half-Orc | The blow that would drop you leaves you at 1 HP, once per rest. |
| Breath Weapon | Dragonborn | Verb "breathe": 2d6 ancestry damage to every foe, DC 8+CON+prof save for half, once per fight. |
| Lay on Hands | Paladin | Pool of 5×level, heal up to 5 per use, refills on rest. |
| Cure Wounds | Cleric/Bard/Druid | Verb "cure"/"heal": 1d8+cast mod (+3 for Life Domain), consumes a real 1st-level slot via `consumeSpellSlot`. |
| Fighting styles | Fighter | Archery +2 ranged attack; Dueling +2 one-handed melee damage; Defense already in chargen AC. |
| Spell slots | All casters | Chargen seeds known spells (class cantrip + 2 signature level-1 spells) and slots; spellbook panel shows them. |
| Unarmored Defense | Barbarian/Monk | Verified live: barbarian AC 15 = 10 + DEX 2 + CON 3 on the play surface. |

## State & purity

- Feature state in `meta.escapeFeats` (normalized in ensureWorld; survives
  serialize→load; invariants pass). Per-fight fields scoped to `combat.beganAt`;
  paladin pool and relentless persist and replenish on `shortRest`.
- Wrong-class verbs get DM table-talk, not errors ("You grit your teeth, but
  fury is not your discipline." / "You huff. Nothing comes out.").
- Legacy sheet-less saves: zero behavior change (no featureActions, no feats writes).
- Deterministic: same world + same input → identical feats/beats (U112-12).
- Full suite 7,341 green; playtest:full 500 runs, no bugs.

## Live verification

Half-Orc Barbarian "Thokk": kit panel shows Greataxe / Guard / Rage, HP 15/15
(d12+CON), AC 15 via Unarmored Defense, no spell section. Screenshot
/tmp/feat-play.png. No console errors.

## Honest limits (logged, not hidden)

- Sneak Attack's "advantage" approximation: cover or round 1 (the resolver has
  no facing/ally model yet).
- Rage doesn't expire from not-attacking, and rage uses aren't capped at 2/day
  (per-fight cap instead — rests are abstracted).
- Great Weapon Fighting and Two-Weapon Fighting styles are recorded but inert.
- Bardic Inspiration needs an ally model; inert until companions join combat.
- Slot spells beyond cure wounds (bless, magic missile, witch bolt) are known
  and displayed but not yet castable in escape combat — the deep engine's
  castSpell can resolve them; wiring it into the escape loop is the next packet.
