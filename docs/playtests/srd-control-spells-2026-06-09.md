# Playtest — Control Spells & Pact Magic Rest (2026-06-09)

**Build:** v2-polish, WORLD_VERSION 24 (fifth packet of the 5e integration)
**Persona:** crusty DM. "Control is half a caster's job. The other half is knowing your patron's terms."
**Surface:** unit matrix (U114, 7 tests) + live `v1.html` roll-up (Human Druid).

## Verdict: GREEN

## What lands now

| Spell / rule | Who | Mechanics |
|---|---|---|
| Charm Person | Bard | "charm": WIS save vs the sheet's spell DC. On a fail the foe stands down for 2 rounds — it won't raise a hand, and the beats narrate the hold each round. When it breaks: "it remembers." Slot spent win or lose (RAW). |
| Entangle | Druid | "entangle": every foe makes a STR save vs spell DC. Failures are **restrained** (the engine's canonical CM2 condition): −4 on their attacks, +4 to be hit, and a STR save each round to rip free. |
| Pact Magic | Warlock | Spell slots restore on a **short rest** (any safe travel hop) — RAW, that's the entire deal with the patron. Wizard/cleric/druid/bard slots stay spent (long rest only; no long-rest surface yet). |

## Design notes

- Conditions ride the existing CM2 framework (`applyCondition`/`hasCondition`/
  `removeAllConditions`) and the enemy `conditions` array that `ensureCombat`
  already normalizes — no new state invented. Survives serialize → load →
  invariants (U114-06).
- Restrained's ±4 is the escape model's standing approximation of
  advantage/disadvantage (same convention as sneak attack's trigger).
- Save-or-suck respects immunities: a foe with `conditionImmunities:
  ['charmed']` shrugs the spell off with its own beat.
- Wrong-class casts stay in voice: "You smile your warmest smile. Nothing
  magical happens." / "You call to the green. The green does not answer you."

## Verified

- Slot spent on a successful save (RAW) but never on a wrong-class attempt.
- Charmed foes skip their attacks; countdown decrements; break is narrated.
- Determinism: identical casts → identical worlds and beats (U114-07).
- Full suite 7,358 green; playtest:full 500 runs, no bugs.
- Live: Human Druid kit shows Scimitar / Produce Flame / Ward / Cure Wounds /
  Entangle, Slots 2/2 L1, AC 15 = leather + DEX + wooden shield
  (screenshot /tmp/control-play.png). No console errors.

## Still open

- Long rest surface (sleep at an inn/home) for full casters' slots — the last
  rest-economy gap.
- Darkvision → env light model; exploration features (Lucky outside combat,
  Stonecunning, Keen Senses on perception checks).
- Charmed foes could be talked to (parley hook exists on enemies) — a charmed
  bandit who can be convinced to walk away is very much THE DM TEST.
