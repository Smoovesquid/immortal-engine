# Playtest — Spell Learning & The Fireball (2026-06-10)

**Build:** v2-polish, WORLD_VERSION 24 (ninth packet of the 5e integration)
**Persona:** crusty DM. "A wizard who hits 5 and doesn't reach for the bead of light has been mis-rolled."
**Surface:** unit matrix (U118, 8 tests) + live `v1.html` (level-5 wizard via production save path).

## Verdict: GREEN

## Repertoires grow with levels

- **Curated SRD learning tables per class per level** (every ref verified in
  the 137-spell catalog): the wizard copies two into the book per level
  (Burning Hands/Mage Armor at 2 → Scorching Ray/Misty Step at 3 → Hold
  Person/Blink at 4 → **Fireball/Counterspell at 5**); known-casters add
  their one; prepared casters pick up the list staples as their slot tiers
  unlock; half-casters learn on their curve (ranger: entangle at 3, spike
  growth at 5). Martials learn nothing arcane.
- **Level-up beats name the spells:** "Learned: Fireball, Counterspell."

## Three new castables, tier-gated

| Spell | Gate | Mechanics |
|---|---|---|
| Scorching Ray | 2nd-level slot | Three rays (+1 per slot above 2nd), each its own attack roll, walking across the line of foes — spillover rays seek the next target. |
| Hold Person | 2nd-level slot | WIS save or **paralyzed** (CM2 condition): loses its turns, and every melee hit against it is an automatic critical (SRD). Countdown narrated; "the hold breaks." |
| Fireball | 3rd-level slot | "A bead of light streaks out and the world goes orange." One damage pool (8d6, +1d6 per slot above 3rd), every foe saves DEX vs your DC for half. |

Tier gating is honest: a wizard with 1st-level slots but no 3rd is told
*"Fireball needs a 3rd-level slot. The bead of light refuses to form."* —
the slot is not burned.

## Verified

- Learning tables across classes incl. half-casters and martial emptiness
  (U118-01/-02); verb parsing without disturbing the fire bolt cantrip
  (U118-03); fireball refusal-below-tier, full-room damage, and slot
  accounting (U118-04); ray walking (U118-05); paralysis with lost turns and
  melee auto-crits, seed-hunted (U118-06); kit tier notes (U118-07);
  determinism + invariants (U118-08).
- Full suite 7,394 green; playtest:full 500 runs clean.
- Live: level-5 elf wizard — rack shows all seven castables, slots
  4/4 L1 · 3/3 L2 · 2/2 L3 in the panel, INT 18 post-ASI, HP 32
  (/tmp/wiz5-panel.png).

## Crunch scorecard (the user asked to finish the crunch first)

Done: chargen (9 species × 12 classes, full PHB order) · sheet-driven combat ·
class/species features L1–L5 · slot magic with upcasting · control spells ·
parley · rests (short/long/pact) · XP/leveling 1–5 with ASI · subclasses at 3 ·
Extra Attack + cantrip scaling at 5 · spell learning.

Remaining crunch candidates: levels 6+ (the architecture recomputes numbers
for any level; features unwritten) · player-facing ASI choice · ritual
casting/out-of-combat utility spells · multiclassing (far) · feats (far).
The crunch core is now COMPLETE for tier 1 (levels 1–5) — the natural pivot
point to the conversational session-zero and other feel work.
