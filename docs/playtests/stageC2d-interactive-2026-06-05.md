# Playtest — Stage C.2d: interactive road encounters — 2026-06-05

Surface: live v1.html · Persona: The Skeptic · Governing: THE_DM_TEST
Decision (Tim): full Pay / Talk / Slip / Fight.

Charter: a journey across ROAD-ish terrain (plains/settlement) can throw a HUMAN
encounter — brigands/a toll — that PAUSES the trip and offers a choice, instead of an
instant beast ambush. Wild terrain (forest/marsh/mountains/desert/arctic) keeps the
beast ambush. The DM presents the situation and resolves the player's choice in fiction.

## Model
- Trigger: on a journey leg's encounter roll, if terrain is road-ish → set
  `world.travel.pending` (the brigands block the way) and narrate the scene + options.
  Wild terrain → beast combat ambush (unchanged).
- Player's next input resolves the pending encounter:
  - **Pay** (pay/coin/toll/bribe): spend a coin → they let you pass. No coin → can't pay.
  - **Talk** (talk/persuade/negotiate/parley): CHARM check; pass → through, fail → they attack.
  - **Slip** (slip/sneak/past/evade): AGILITY check; pass → by unseen, fail → they attack.
  - **Fight** (fight/attack/draw): straight to combat.
  - Unrecognized → re-prompt the options (no turn consumed).
- After pass/fight you're at the encounter node; resume by travelling again
  (consistent with the combat-interrupt resume).

## Pre-registered attack list (committed BEFORE the build)
- [ ] road-ish journey can trigger a brigand/toll encounter (paused, options shown)
- [ ] wild-terrain journey still gives a beast ambush (not a toll)
- [ ] `pay` with a coin → pass; coin deducted; pending cleared
- [ ] `pay` with NO coin → told you can't; still pending (must choose else)
- [ ] `talk` → CHARM check; success passes, failure → combat
- [ ] `slip past` → AGILITY check; success passes, failure → combat
- [ ] `fight` → combat with the brigands
- [ ] gibberish while pending → re-prompts options, no turn consumed, no crash
- [ ] CHARM-heavy char talks past more often than a low-CHARM char (skill matters)
- [ ] after resolving, you can resume travel to the destination
- [ ] deterministic: same seed + choice → same outcome
- [ ] no regression: combat ambush / beats / multi-hop still work; full suite green

## Grading
DM-test (presents + resolves in fiction)? · each choice resolves correctly? · skill checks scale? · resume works? · deterministic? · visible? · no regression.

---
## Investigation notes
## Built this pass
## Node checks
## Live (screenshots)
## Findings
## NOT verified / deferred
## Verdict: not yet
