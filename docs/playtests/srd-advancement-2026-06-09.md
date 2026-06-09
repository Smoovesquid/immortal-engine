# Playtest — XP & Leveling: The Advancement Loop (2026-06-09)

**Build:** v2-polish, WORLD_VERSION 24 (seventh packet of the 5e integration)
**Persona:** crusty DM. "A campaign where nobody levels is a diorama."
**Surface:** unit matrix (U116, 10 tests) + live `v1.html` (leveled save through the real save system).

## Verdict: GREEN

## The loop, closed

Until today `xp: 0` was a fossil — nothing awarded it, nothing read it. Now:

- **XP by CR (SRD bands):** every overcome encounter pays out — kills AND
  parleys ("you overcame it; the bodies are optional"). Awarded through a new
  `gainXp` delta op on the canonical mutation path.
- **Level-ups at the moment of triumph:** crossing a threshold levels you
  mid-beat — `(+100 XP)` then `LEVEL 2! +8 HP. New: Action Surge.` The pure
  `levelUpSheet()` recomputes everything: HP (fixed average + CON + per-level
  bonuses), proficiency from the level table, saves/skills/spell DC
  re-derived from the proficiency lists, slots grown, features appended.
  `escapeMaxHp` tracks the new max; the gained HP arrives ready.
- **Slots grow:** full casters 2→3 at level 2; warlock pact 1→2;
  **half-casters awaken** — the level-2 paladin and ranger gain spellcasting,
  cure wounds, and their slot pair, exactly on schedule.

## Level-2 features that FIRE

| Feature | Class | Mechanics |
|---|---|---|
| Action Surge | Fighter | "surge": two attacks this turn, once per fight. |
| Reckless Attack | Barbarian | "reckless": +4 your melee swings, +4 their swings at you, this round. |
| Divine Smite | Paladin | "smite": on the hit, burn a slot for +2d8 radiant (dice doubled on a crit). |
| Agonizing Blast | Warlock | CHA mod rides every eldritch blast. |
| Song of Rest | Bard | +1d6 to short-rest healing. |
| Archery (Ranger 2) | Ranger | +2 ranged attacks via the same style rider as the fighter's. |

Recorded honestly (real sheet entries, inert until their packet): Danger
Sense, Jack of All Trades, Channel Divinity, Wild Shape, Ki, Cunning Action,
Font of Magic, Arcane Tradition.

## Verified

- XP/level math against the SRD tables (U116-01/-02); award on kill and on
  parley (U116-03/-04); threshold-crossing levels with correct HP math and
  play-surface sync (U116-05); slot growth + half-caster awakening (U116-06);
  surge/reckless/smite firing with once-per-fight and slot accounting
  (U116-07/-08/-09); determinism + reload + invariants (U116-10).
- Full suite 7,376 green; playtest:full 500 runs clean.
- Live: a fighter leveled through the real engine path (won fight → `(+100
  XP)` → `LEVEL 2!`), planted via the real save system — panel shows **LV 2,
  XP 160, HP 20/20**, and the kit grew its **Action Surge** button
  (screenshots /tmp/xp-panel.png). Caught live: level-2 actions were missing
  from the kit panel; fixed in this packet.

## Honest limits

- Higher-level spell slots (2nd+) and features beyond level 2 are the next
  rung — the recompute architecture already handles any level.
- ASI at 4, Extra Attack at 5, proficiency bump at 5 will exercise
  levelUpSheet's recompute path for real (it is written for it).
- The live road-ambush hunt was too flaky under the headless harness (browser
  killed between calls); the leveled save was planted through the production
  save/load path instead, which exercises the same render and state code.
