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
- `scripts/lib/proseGraders.mjs` — the importable heart of the gate. Pure graders:
  `gradeCrash`, `gradeInvisible`, `gradeValueLeak`, `gradeFloor`, `gradeDeadEnd`,
  `gradeFormatting` + `gradeAll`/`gradeNarration`. Both the gate and tests/F1 import them,
  so the gate's judgment is itself unit-tested.
- `scripts/prose-playtest.mjs` upgraded to the ENFORCED gate: exits NONZERO on ANY issue
  (not just crashes); prints `✅ PROSE GATE: PASS` / `❌ PROSE GATE: FAIL`. Added a SOCIAL
  + TRAVEL corpus and a `PROSE_GATE_SELFTEST=<class|all>` injection mode.
- `npm run prose:gate` wired in package.json.
- **The gate's first catch (the whole point):** with the FLOOR grader widened from
  "physical inputs only" to "any resolved action", it exposed that the abstract floor
  was NOT dead — it leaked on **54 / 216** inputs (take/grab/pickup, ask, listen/smell,
  wait, cast, read, generic/garbage, travel variants, and combat). Stage B's grader had
  been too narrow to see it.
- **Fixed the leak it found** — generalized the Stage B grounding:
  `genericGroundedOutcome(world,text,outcome)` (take/ask/listen/smell/wait/read/cast +
  grounded generic last resort) and `combatGroundedOutcome(enemyName,outcome)`. Wired as
  a floor-replacement: when the composer would emit the abstract floor, substitute
  grounded, outcome-aware prose (specific handlers still win; good composer lines pass
  through). Applied at the generic resolveMove site + all 3 combat-narration sites.
  Narration-only (no state, no RNG) → determinism-safe.
- Also caught + fixed a real bug: social narration started lowercase when the NPC's
  "name" was an article ("the trader warms…" → "The trader warms…").

## Node checks
- `npm run prose:gate` → **PASS, 0 issues across 216 inputs**, exit 0 (was 54 issues).
- Self-test per class → exit 1 each (crash, invisible, value_leak, floor, dead_end,
  formatting); `--selftest=all` reports every class; clean run → exit 0.
- Full suite **7183/7183 green** (U21 determinism, U100/U101 floor, UX2, U102 social all
  intact). `npm run playtest:quick` → 50 runs, 0 crashes, no bugs.

## Self-test (the severe playtest: regress → caught)
`tests/F1.proseGate.test.js` (22): grader PRECISION (each class flagged; 7 known-good DM
lines + non-prose routes clean — no false positives) + ENFORCEMENT (spawns the gate as a
subprocess; clean corpus → exit 0; each planted regression class → exit 1; `all` reports
every tag). This is "intentionally regress a handler and confirm the gate catches it,"
made permanent as a test.

## Live (v1.html, AI on — the floor-grounding is player-facing)
- **(ss_4867p9590)** "take the torch" → *"At Wayfarers' Outpost, Yara watches with mild
  curiosity as you tug at the wall-mounted torch, its iron bracket holding firm against
  your grip."* (roll 3 vs DC 12 → failure) — grounded, names the torch, no floor.
- **(ss_4731uwivg)** "cast fire bolt" → *"A tongue of flame sputters from your fingertips
  and scorches the air inside Wayfarers' Outpost … burning through your focus like green
  wood — wasteful and uneven at the edges."* (roll 10 vs DC 11 → mixed) — grounded.
- **(ss_894815h2x)** "I wait and watch the room" → grounded wait beat (failure), tail
  visible; transcript bounded/scrollable (no map-clip regression). No abstract floor on
  any of the three. AI-on elaborates the grounded base, never invents.

## Findings
| class | gate behavior | proof |
| --- | --- | --- |
| CRASH | exit 1 | selftest + F1-C |
| INVISIBLE | exit 1 | selftest + F1 |
| VALUE_LEAK | exit 1 | selftest + F1 |
| FLOOR (resolved action) | exit 1 | selftest; caught 54 real leaks → fixed |
| DEAD_END (THE_DM_TEST) | exit 1 | selftest + F1 (7 phrasings) |
| FORMATTING | exit 1 | selftest; caught the lowercase social-name bug → fixed |
| good DM prose | not flagged | F1-B (no false positives) |
| live corpus | exit 0 | `npm run prose:gate` |

## NOT verified / deferred
- The gate is pure-node (AI-OFF deterministic base, per the bar). True browser-visibility
  (CSS clipping, render) stays the HUMAN depth tier of PLAYTEST_PROTOCOL (screenshots) —
  no headless-browser dep added (repo is deliberately dep-light). Live screenshots above
  cover the depth tier for this stage's player-facing change.
- The generic last-resort line is intentionally plain; specific verb classes read better.
  Richer per-verb grounding can keep improving, but no leak remains (gate enforces it).
- The DEAD_END grader covers known bounce-back phrasings; new ones can be added as found.

## Verdict: GREEN — the standing prose gate ships. It fails loudly on crash / invisible /
value-leak / floor / dead-end / formatting (proven by self-test + F1), passes the clean
live corpus, is wired (`npm run prose:gate`) and documented. Its first act caught 54 real
floor leaks Stage B's narrow grader had hidden; those are now grounded, so "Stage B
complete" is finally true. Green means green.
