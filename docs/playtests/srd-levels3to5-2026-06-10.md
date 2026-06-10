# Playtest — Levels 3–5: The Tier-One Arc (2026-06-10)

**Build:** v2-polish, WORLD_VERSION 24 (eighth packet of the 5e integration)
**Persona:** crusty DM. "Level 5 is where characters become who they are. Extra Attack or it didn't happen."
**Surface:** unit matrix (U117, 10 tests) + live `v1.html` (level-5 fighter planted via the production save path).

## Verdict: GREEN

## What the climb to 5 brings

- **Slot progression per the PHB:** full casters reach 4×1st/2×2nd at 3 and
  add 2×3rd at 5; half-casters lag by the book; **pact magic tiers up** — a
  level-3 warlock has ONLY two 2nd-level slots, and every escape-combat cast
  finds the lowest live slot and upcasts through it.
- **Upcasting is real:** magic missile +1 dart per level, witch bolt +1d12,
  cure wounds +1d8, divine smite +1d8, **armor of agathys 5 temp HP per slot
  level** (a pact-slot warlock wears 10 HP of black ice). Beats name the slot:
  *"(level-2 slot)"*.
- **ASI at 4 (+2 class primary, DM-assigned deterministically):** the full
  cascade — abilities, mods, saves, skills, retroactive HP for CON, **AC
  recomputed from the finished sheet** (a monk's DEX bump raises unarmored AC),
  spell DC, and the legacy MIGHT/AGILITY projection all move together.
- **Subclass features at 3 (SRD subclasses):** Champion's **Improved Critical
  (19–20)** and Hunter's **Colossus Slayer (+1d8 vs wounded foes)** fire in
  combat; Frenzy, Cutting Words, Open Hand, Sacred Weapon, Fast Hands,
  Metamagic, Pact Boon, Land Circle ride the sheet as real entries.
- **Level 5, the power spike:** **Extra Attack** (martials swing twice every
  Attack action; Action Surge doubles to four), **cantrip scaling** (2d10 fire
  bolts), proficiency +3 with every derived number re-derived, and sneak
  attack now scales (1d6 per two levels, rounded up).

## Verified

- Slot tables 1..5 vs the PHB incl. the pact-magic tier quirk (U117-01/-02);
  ASI cascade with legacy projection (U117-03); Champion nat-19 crits via
  seed-hunted natural 19 (U117-04); Colossus Slayer (U117-05); Extra Attack
  2/4 swings (U117-06); cantrip scaling + DC re-derivation (U117-07); cure
  upcast through a 2nd-level slot when 1sts are dry (U117-08); monk AC
  recompute (U117-09); determinism + invariants at 5 (U117-10).
- Full suite 7,386 green; playtest:full 500 runs clean.
- Live: level-5 fighter (STR 18 post-ASI, prof +3, HP 44, AC 18) through the
  production save/load path — panel and kit correct (/tmp/l5-panel.png).

## Honest limits

- ASI auto-assigns +2 to the class primary; a player-facing choice (or +1/+1)
  is a chargen-UI follow-up.
- The XP curve is the engine's own (faster than the PHB's 300/900/2700) —
  deliberate for this game's pacing.
- Spells KNOWN don't grow past chargen yet (a level-3 wizard still knows the
  level-1 list; new slots make them stronger, not broader). Spell-learning is
  its own packet.
- Levels 6+ features beyond profBonus are unwritten; the recompute
  architecture handles the numbers either way.
