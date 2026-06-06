# Playtest — Stage E: voice & variation (no verbatim repeats) — 2026-06-06

Surface: live v1.html + node + prose gate · Persona: The Skeptic · Governing: THE_DM_TEST

## Why this slice
A real DM never says the exact same sentence twice. The grounded base lines shipped in
Stages B/D/F (`genericGroundedOutcome`, `combatGroundedOutcome`, the wait/listen/smell/
take fallbacks, social outcomes) return FIXED strings — repeat an action and you get a
verbatim echo (AI-off). The bar: AI-off must read well on its own. This slice adds
DETERMINISTIC variation so repeated situations read differently, without breaking replay.

## Slice 1 charter
- Add `pickVariant(variants, world, key)` — selects from a small variant array via seeded
  RNG keyed on (seed, current node, timeline length, key). Same world-state + key → same
  pick (determinism/replay preserved); a LATER turn (timeline advanced) → a different pick.
- Convert the highest-repeat grounded line families to 2–3 variants each: the generic
  fallback (success/mixed/failure), combat beats, and wait/listen/smell/take.
- Every variant stays grounded (names the thing/place, correct outcome) — no floor, no
  format glitch, no value leak (prose gate still PASS).
- Out of scope (later Stage E slices): world-tone vectors into prose; `guard.js` AI-
  contradiction/id-leak blocking; pacing/length shaping.

## Pre-registered attack list (committed BEFORE the build)
- [ ] repeat the SAME action across consecutive turns → the prose VARIES (not verbatim)
- [ ] DETERMINISM: same seed + same timeline position + same input → IDENTICAL prose
      (replay/U21 safe; U101/U102/U103 same-state repeats still identical)
- [ ] every variant is grounded — names the object/place + correct outcome word
- [ ] prose gate still PASS (no floor / format / value-leak from any variant)
- [ ] success/mixed/failure still distinguishable in every family (U101-D style)
- [ ] combat beats vary across turns; social/open lines unaffected unless varied on purpose
- [ ] full suite green; playtest:quick clean
- [ ] LIVE: do "wait" (or a generic action) 3× in a row on v1.html — visibly different prose (screenshot)

## Grading
repeats read differently? · still deterministic/replayable? · still grounded? · gate PASS? ·
outcomes still distinguishable? · visible?

---
## Built this pass
## Node checks
## Live (screenshots)
## Findings
## NOT verified / deferred
## Verdict: not yet
