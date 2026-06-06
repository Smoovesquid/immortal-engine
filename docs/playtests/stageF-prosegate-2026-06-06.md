# Playtest — Stage F: the standing prose gate — 2026-06-06

Surface: `node` breadth gate (`scripts/prose-playtest.mjs`) + a self-test that proves
it catches a regression · Governing: THE_DM_TEST · Companion: PLAYTEST_PROTOCOL

Charter: the prose harness becomes an ENFORCED pre-handoff gate. It runs hundreds of
"things people say to a DM" through the real v1.js routing and FAILS LOUDLY (nonzero
exit) on any of: crash, invisible/empty output, raw value leak, formatting glitch,
abstract-floor leak on a resolved action, or a DM-TEST DEAD-END (intent bounced back as
a mechanical prompt — "which way?", "one tile at a time", "not a valid command", a bare
direction question). Graders are extracted to an importable module so they can be unit-
tested for precision. A self-test deliberately injects each regression class and proves
the gate catches it (Stage F's "intentionally regress a handler" requirement).

Why this matters: today the harness only exits nonzero on CRASHES — every other issue is
printed but the process still "passes." A gate that returns green while leaking floor or
bouncing intent is worse than no gate. This stage makes green mean green.

## Pre-registered attack list (committed BEFORE the build)
The gate must, on the LIVE corpus, return exit 0 (we believe the engine is clean), AND
the self-test must prove each class below is caught when present:
- [ ] CRASH — a handler throw → caught, nonzero exit, class shown
- [ ] INVISIBLE — empty / whitespace / "..." narration on an action or meta route → caught
- [ ] VALUE_LEAK — `undefined`/`null`/`NaN`/`[object Object]`/`${…}`/`{{…}}` in prose → caught
- [ ] FLOOR — the abstract literary filler ("a low hum threads through the walls",
      "the meaning slips", …) on a RESOLVED action route → caught (any action, not just physical)
- [ ] DEAD_END (DM-TEST) — "which way do you want to go?", "one tile at a time",
      "not a valid command", "please choose a direction", bare "North? South?" → caught
- [ ] FORMATTING — "the the", "X the X" doubling, double space, space-before-punct,
      no end punctuation, lowercase start, plural "1 others" → caught
- [ ] PRECISION — known-GOOD DM prose (grounded, terminated, names things) → NOT flagged
      (no false positives that would make people disable the gate)
- [ ] ENFORCEMENT — the gate's exit code is nonzero when ANY issue exists (not only crashes)
- [ ] LIVE CORPUS CLEAN — the real engine corpus passes the strict gate (0 issues)
- [ ] WIRED — `npm run prose:gate` exists; PLAYTEST_PROTOCOL names it as a handoff gate
- [ ] DETERMINISTIC — same corpus → same verdict, run to run
- [ ] SELF-TEST IS A TEST — `tests/F#` runs the gate in selftest mode and asserts it fails

## Grading
fails loudly on every class? · zero false positives on good prose? · live corpus clean? ·
self-test proves it catches a planted regression? · wired + documented? · deterministic?

---
## Built this pass
## Node checks
## Self-test (the severe playtest: regress → caught)
## Findings
## NOT verified / deferred
## Verdict: not yet
