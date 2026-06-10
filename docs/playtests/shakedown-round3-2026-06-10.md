# Playtest — Shakedown Round 3: Roads, Interiors, Tier C (2026-06-10)

**Build:** v2-polish · **Probe:** `scripts/probes/road-shakedown.mjs` (interiors → named travel → road encounters, all four answers, across seeds)
**Persona:** crusty DM, working the toll roads.

## Verdict: GREEN after fixes

## Tier C shipped — the DM asks instead of guessing

`/api/intent` may now return `{"clarify": "..."}` for genuinely ambiguous
input. Probed live: *"go deal with the thing and then handle the other guy"* →
**"What 'thing' and which 'other guy' are you referring to?"** (free, no turn);
the control input *"take cover and bless myself"* still splits cleanly. The
client renders the question as a DM line and waits.

## Road & interior findings, all fixed

| # | Found | Fix |
|---|---|---|
| 1 | Talking/slipping/paying past a road encounter earned **0 XP** while killing the same brigands earns 25 — the engine paid for blood only | All four resolutions pay the encounter's XP: "(+25 XP)" on talked/slipped/paid; fight earns through combat victory as before |
| 2 | Road checks used legacy CHARM/AGILITY, ignoring the sheet | Talk reads **Persuasion**, slip reads **Stealth** off the 5e sheet (legacy stats for sheet-less saves) |
| 3 | "go inside" while already indoors → "That way is blocked from here" | *"You're already indoors. 'Go outside' first if you're after a different roof."* |
| 4 | "A toll-gang **are** still eyeing…" (collective-noun agreement) | Slip line reworded to dodge the agreement trap |
| 5 | "look around" mid-combat described the architecture, not the fight | Fight first, scenery second: combat status + "Beyond the fight: …" |

## Verified

- All four road answers exercised end-to-end across seeds (talk ✓ XP, slip ✓
  XP + reworded line, pay ✓ XP, fight ✓ spawns the brigand and combat XP
  flows); interiors enter/move/blocked/exit clean; journey ambushes (spotted
  and surprise variants) resolve into normal combat.
- UX2-12 locks the talked-XP contract through the production playerMove path.
- Suite 7,406 green; playtest:full 500 clean. No crashes, no invariant
  violations in any probe run.

## Session-wide scorecard (rounds 1–3, one day)

Punchlist: 22/22 closed. Shakedown: 11 more findings found and fixed same-day.
UX2 regression table: 12 tests, ~50 utterance rows, grows monotonically.
The conversational engine now answers questions anywhere, respects negation
and targeting, splits multi-action sentences, asks when it can't tell, rewards
every solution equally, and keeps honest time.
