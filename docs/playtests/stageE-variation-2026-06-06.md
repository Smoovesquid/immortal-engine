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
## Built this pass (engine/playloop.js)
- `pickVariant(variants, world, key)` — DETERMINISTIC ROTATION: index = (base offset from
  seed+node+key + count of `resolution` events in the timeline) mod N. Same world-state +
  key → same pick (replay-safe); each resolved action adds exactly one resolution event →
  the ordinal advances by 1 → consecutive repeats rotate to the next variant. (First tried
  `timeline.length`, but it jumps by varying amounts per turn and could land the same index
  twice — switched to the resolution-event count for a reliable +1.)
- Converted the grounded fallback families to 2–3 variants each, via pickVariant:
  `genericGroundedOutcome` (take/ask/listen/smell/wait/read/cast + generic last resort) and
  `combatGroundedOutcome` (now takes `world`; updated the 3 combat call sites). Every
  variant stays grounded (names the place/thing, outcome-correct).

## Node checks
- `I wait quietly` ×5 → 3 distinct, 0 consecutive repeats.
- `I do the thing` / `the thing` / `I improvise` ×5 → 4–5 distinct, 0 consecutive repeats.
- DETERMINISM: same fresh state twice → identical prose+mechanics; an N-turn run reproduces
  the exact same sequence (replay-safe).
- U104 (7): vary-no-verbatim ×3 · deterministic (same-state + N-turn reproduce) · every
  variant grounded (no floor, well-formed) · outcomes still distinguishable.
- U21 determinism green; suite **7220/7220**; prose gate PASS; playtest:quick clean.

## Live (v1.html, AI on)
- **(ss_1027cb8bj / ss_7469cn28y)** "I wait and watch" ×3 → three DISTINCT responses on
  screen: "The modest room within Roadside's single building holds a quiet stillness…" /
  "The hum of Roadside's modest life carries on around you — Brennan's eyes flicker…" /
  "Your gaze drifts slowly across the modest interior…". Repeated identical input no longer
  echoes verbatim. (AI-on rides on the now-varied base.) ✅

## Findings
| check | result |
| --- | --- |
| repeated action varies | ✅ 0 consecutive verbatim repeats (rotation) |
| deterministic / replay-safe | ✅ U104-B + U21 |
| every variant grounded | ✅ U104-C, gate PASS |
| outcomes distinguishable | ✅ U104-D |
| visible | ✅ live, 3 distinct on screen |

## NOT verified / deferred (later Stage E slices)
- Variation NOT yet applied to `physicalObjectOutcome` (force/break/climb/pick) or the
  legacy `trivialNarration` default ("You do so without difficulty.") — they still echo
  verbatim on repeat. Next variation pass.
- World-TONE vectors into prose (safe vs dire wording); `guard.js` AI-contradiction / id-
  leak blocking; pacing/length shaping — remaining Stage E scope.
- Found + flagged a pre-existing bug (spawn task): a targetless force/move verb (e.g. "I
  ponder my next move" matches "move") yields "force the it" in `physicalObjectOutcome`.

## Verdict: GREEN (slice 1) — repeated situations read differently, deterministically and
replay-safe, every variant grounded. Live-verified. Remaining Stage E (tone, guard, more
families) tracked above.
