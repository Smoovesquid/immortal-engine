# Playtest — Parley & The Long Rest (2026-06-09)

**Build:** v2-polish, WORLD_VERSION 24 (sixth packet of the 5e integration)
**Persona:** crusty DM. "If the players can't try talking, you're not running D&D — you're running a tower defense."
**Surface:** unit matrix (U115, 8 tests) + live `v1.html` (sleep at the home settlement).

## Verdict: GREEN

## Talking your way out (THE DM TEST in combat)

"I try to talk them down" / "parley" / "let us pass" / "I threaten them" now
resolve in escape combat:

- **Skill off the sheet:** threats roll Intimidation, everything else rolls
  Persuasion (legacy characters roll raw CHARM). The check is shown at the
  table: *"(Persuasion 16 vs DC 13) … they ease off, and the road is yours."*
- **The DC moves like a DM's would:** 13 cold · 10 once you've dropped as many
  as still stand ("they've seen what you can do") · **8 if one of them is
  charmed** — your "friend" vouches for you. Charm Person → parley is now a
  real two-spell play, exactly the synergy the spells imply.
- **Bless applies** (+1d4 — it's an attack on their resolve, ruled generously).
- **Beasts don't bargain:** `canParley: false` foes get *"Words mean nothing
  to it"* and the round proceeds.
- **Failure costs the turn:** *"Words fail. Steel answers."* — and steel does.
- Parley victory ends combat with no loot (you didn't kill anyone) and a
  distinct mechanics line `[combat:parley | Persuasion N vs DC M]`.

## The long rest

"I find a bed and sleep for the night" / "make camp" / "turn in":

- **At a settlement:** full HP, **all spell slots restored** (closing the rest
  economy for wizards/clerics/druids/bards), lay-on-hands pool and relentless
  endurance reset. One replayable timeline event (`updateKind: 'long-rest'`).
- **In the wild:** refused in voice — *"The open country is no bed — every
  sound out here has teeth."* (`[rest:denied]`)
- Deliberate language only: bare "rest" stays a body action; sleep/camp/turn
  in trigger the night.

## Verified

- U115 (8): verb parsing with the right lever, visible checks, intimidation
  via Menacing half-orc, no-bargain beasts, failed-parley enemy turns, full
  restore + invariants, settlement-vs-wild gating through the real
  `playerMove` path, determinism.
- Full suite 7,366 green; playtest:full 500 runs, no bugs.
- Live: rolled a Human Cleric, typed "I find a bed and sleep for the night"
  on turn one — woke at 9/9 with slots back, `[rest:long]`, no console errors
  (screenshot /tmp/rest-play.png).

## Still open

- Charmed parley currently lowers the DC; a charmed foe could eventually be
  steered as an ally for the fight's duration (needs ally-action model).
- Long rest takes no in-world time yet — when the clock economy matters,
  sleeping should advance threads/worldTick (the world moves while you dream).
- Darkvision → env light model remains the biggest dormant species trait.
