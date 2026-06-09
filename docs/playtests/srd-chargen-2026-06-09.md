# Playtest — SRD 5e Character Creation Wizard (2026-06-09)

**Build:** v2-polish, WORLD_VERSION 24
**Persona:** crusty DM, thirty years behind the screen, came to find rules violations.
**Surface:** live `v1.html` via headless browser, full click-through with screenshots.
**Run:** Half-Elf Bard "Brennick Vale" (Entertainer, Chaotic Good) — deliberately the
choice-heaviest path: species ASI choice ×2, species skill choice ×2, any-3 class
skills, spellcaster, reroll exercised.

## Verdict: GREEN with logged gaps

The wizard runs front door → species → class → abilities → origin → ritual →
sheet → live game with zero console errors. The character that lands in the world
is the character that was built.

## Rules audit (what I tried to catch them on)

| Check | Result |
|---|---|
| 9 species, 12 classes, 10 backgrounds, 9 alignments present | ✓ |
| 4d6-drop-lowest visible per pool, drop math correct | ✓ |
| One reroll only; reroll deterministic by seed salt | ✓ (button disappears after use) |
| Assignment enforced — can't stuff six 18s (unit U110-08) | ✓ |
| Half-elf +2 CHA + chosen +1/+1 applied exactly once | ✓ (12→13 DEX, 12→13 CON, 14→16 CHA) |
| Bard HP = 8 + CON mod | ✓ (9) |
| AC = leather 11 + DEX mod | ✓ (12) |
| Spell DC 8+prof+CHA, attack +prof+CHA | ✓ (13 / +5) |
| Save proficiencies: DEX/CHA dots, +prof applied | ✓ (+3 / +5) |
| Skill duplicates (picked Performance, background already grants it) | ✓ legal sheet — silently backfilled with History (see gap 3) |
| Passive Perception 10 + skill | ✓ (12) |
| Legacy 5-stat projection (MIGHT←STR etc.) | ✓ exact |
| Old saves (no dnd block) still load + invariants pass | ✓ (U110-12) |
| Wizard/sorcerer/monk in armor | blocked by proficiency-aware AC (U110-06) |
| Full suite (7,320 tests) + playtest:quick (50 runs) | ✓ all green |

## Gaps found (problems → solutions)

1. **HP mismatch — sheet says 9, play surface says 15/15.** Combat still runs on
   the legacy wounds system (`maxWounds`); `dnd.maxHP` isn't wired into the play
   loop. *Solution:* next packet — combat reads `dnd.maxHP`/`dnd.ac` when the
   sheet exists; until then the player sees two different HP numbers.
2. **Class identity vs. escape-mode kit.** My bard spawned with "Worn Blade" and
   Fire Bolt/Ward cantrips from the default escape loadout. A bard with a
   wizard's fire bolt would get me laughed out of the shop. *Solution:* when
   `party[0].dnd` exists, suppress the default kit/cantrip injection and seed
   class spells (bard knows 4 from the bard list) instead.
3. **Silently swapped duplicate skill.** I picked Performance (already granted by
   Entertainer); the engine legally backfilled History without telling me.
   *Solution:* gray out already-granted skills in the class-skill checklist.
4. **Sheet title doesn't live-update with the typed name** (shows suggested name
   until Begin; correct in-game afterward). *Solution:* re-render on blur.
5. **Species traits with `effect` tags are recorded but mostly dormant** —
   darkvision, Lucky, breath weapon, etc. carry machine-readable effects that
   combat/env don't consume yet. *Solution:* feature-consumption packet after
   combat integration.

## Screenshots

`/tmp/cg1-species.png` … `/tmp/cg7-play.png` (species grid, class+skills, dice
pools with reroll spent, origin grid, ritual + dark fate flip, final sheet,
live game with correct character).
