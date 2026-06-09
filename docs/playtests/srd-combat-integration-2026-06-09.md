# Playtest — 5e Sheet Drives the Game (2026-06-09)

**Build:** v2-polish, WORLD_VERSION 24 (follow-up to srd-chargen-2026-06-09.md)
**Persona:** the same crusty DM, back to check the table actually uses the sheet.
**Surface:** live `v1.html`, two full roll-ups (Dwarf Cleric ×2) + unit matrix.

## Verdict: GREEN — the gaps from the chargen playtest are closed

| Gap from last report | Status |
|---|---|
| HP mismatch (sheet 9 vs surface 15/15) | **Fixed** — `playerMaxHp`/`initEscapeHp` read `dnd.maxHP`; live run shows 13/13 matching d8 + CON +4 + Dwarven Toughness |
| Bard with a wizard's fire bolt | **Fixed** — per-class SRD cantrips (Vicious Mockery, Eldritch Blast, Sacred Flame, Produce Flame, Fire Bolt) with the sheet's spell attack bonus; martials get none (Guard action instead); high elves keep their INT-based wizard cantrip |
| Duplicate skill picks silently swapped | **Fixed** — species-granted skills grayed out in the class list; background cards warn about overlap with class picks |
| Sheet title not updating with typed name | **Fixed** — re-render on blur |

## New violations caught and fixed during this pass

1. **DEX 8 cleric "wielding" a light crossbow at −1** — the weapon picker took
   the biggest die and let ranged weapons swing off STR. Now: ranged uses DEX
   (RAW), finesse uses best of STR/DEX, and the pick maximizes expected damage
   ((die+1)/2 + mod) — the mace wins, as it should.
2. **"Any martial weapon" resolving to d4 fists** — generic equipment
   placeholder strings matched nothing in the weapon table, so a fighter would
   have punched his way through the campaign. All class equipment options are
   now concrete SRD weapons (fighter: longsword+shield / greataxe / rapier+shield
   / two handaxes, etc.).

## Verified live (screenshots /tmp/int-play.png, /tmp/int2-play.png)

- Character panel shows STR/DEX/CON/INT/WIS/CHA with mods, plus AC and alignment rows.
- Party HP equals `dnd.maxHP` exactly.
- Kit panel: real weapon ("Mace — type strike") + class cantrips with to-hit notes.
- Combat verbs parse: strike, eldritch blast, mock, sacred flame, cast, guard, take cover.
- Melee breaks cover; bows and cantrips fire from behind it.
- Legacy sheet-less saves keep the original hedge-caster math bit-for-bit (U111-02/-06).

## Unit coverage

U111 (9 tests): sheet HP/AC, weapon profiles per class incl. finesse/ranged
rules, all six caster cantrips registered in the spell catalog, kit injection
for sheets vs legacy, verb parsing, determinism. Full suite 7,329 green;
playtest:quick 50 runs, no bugs.

## Still open (next packets)

- Class features as combat mechanics: Rage, Second Wind, Sneak Attack, Bardic
  Inspiration, Lay on Hands, breath weapons — recorded on the sheet with
  machine-readable effects, not yet consumed by the resolver.
- Species effects into env/exploration: darkvision vs the light model, Lucky
  rerolls, Relentless Endurance.
- Spell slots: level-1 casters have slots on the sheet; the slot-casting flow
  (cure wounds, bless, burning hands) isn't wired into escape combat.
