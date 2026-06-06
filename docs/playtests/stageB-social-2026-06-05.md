# Playtest — Stage B: argued social adjudication — 2026-06-05

Surface: live v1.html · Persona: The Skeptic · Governing: THE_DM_TEST
Design (Tim): speak/argue at an NPC in your own words; the DM reads the APPROACH and
the LEVER you claim, judges plausibility + how good the argument is, rolls the fitting
stat against that NPC's PERSONALITY, and the NPC reacts (with a real trust consequence).

## Model
- Approach from language: intimidate / charm / deceive / persuade (explicit verbs OR
  natural cues — threats → intimidate, flattery/flirt → charm, lies → deceive, appeals
  → persuade). Plain "talk to X" still opens dialogue (unchanged).
- Lever (claimed stat): "use my superior strength" → MIGHT; "my awesome wit" → WITS; etc.
  PLAUSIBILITY-GATED — a lever only counts if it fits the approach (strength can
  intimidate, not seduce); otherwise fall back to the approach's default stat.
- Quality nudge (deterministic): you actually said the line / gave a vivid specific
  argument → +bonus; bare verb → neutral; claimed a joke/song with no content → penalty.
- Resolution: d20 + statMod + quality vs a DC set by the NPC's PERSONALITY —
  intimidate is easy on the fearful (high selfPreservation), hard on the brave (low);
  charm/persuade land on the open (trustOfOutsiders) and those who already trust you;
  deceive fools the trusting, not the street-smart. Deterministic/seeded.
- Consequence: trust shifts (success up; fail down; intimidate-success buys compliance
  but COSTS trust — fear isn't friendship). The world remembers.
- Default stats: intimidate→GRIT, charm→CHARM, deceive→WITS, persuade→CHARM (lever overrides if plausible).

## Pre-registered attack list (committed BEFORE the build)
- [ ] "I use my superior strength to lift this massive boulder to intimidate the guard" → intimidate via MIGHT (lever plausible), rolled, NPC reacts
- [ ] "Hey sexy, you look great in that outfit. Let me in and I'll take you out for dinner later." → charm via CHARM, rolled
- [ ] "persuade the guard to let me pass" → persuade
- [ ] "I tell the elder I'm the new sheriff" / "lie to him" → deceive
- [ ] PERSONALITY matters: intimidating a FEARFUL npc (high selfPreservation) succeeds more than a BRAVE one (low)
- [ ] charming an OPEN npc (high trustOfOutsiders) lands more than a wary one
- [ ] implausible lever ("use my strength to charm her") → falls back to CHARM, doesn't reward the mismatch
- [ ] quality: a vivid argued line gets an edge; "I tell a joke" with no joke gets a penalty
- [ ] trust consequence: success raises trust, failure lowers it; intimidate-success lowers trust
- [ ] no NPC present → graceful ("no one here to sway"), no crash, no floor
- [ ] no abstract floor for a social attempt with an NPC
- [ ] "talk to X" still opens dialogue (no regression); deterministic; full suite green

## Grading
DM-test (reads intent + person)? · personality drives outcome? · lever plausibility-gated? · quality matters? · trust consequence? · no floor? · deterministic? · visible?

---
## Built this pass
## Node checks
## Live (screenshots)
## Findings
## NOT verified / deferred
## Verdict: not yet
