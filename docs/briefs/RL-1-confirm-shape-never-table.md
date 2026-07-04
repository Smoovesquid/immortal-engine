# RL-1 — rules questions: confirm the SHAPE, never the table

**Model:** Claude Sonnet (grace/narration lane). **Serial:** touches the grace/playloop meta seam — runs
ONLY when the JR-1 lane has landed (playloop free). **Your tests: U426–U428.**
**Tim's ruling (2026-07-04-pm3, verbatim): "confirm the shape, never the table."**
**Evidence:** `docs/playtests/opus-gate-2026-07-04-2.md` — the Rules-Lawyer cluster, 8 of 14 fails.

## The four exchanges to kill (from the gate, quoted)

1. _"what does the modifier in parentheses mean, and how do I roll to hit?"_ → **raw breakpoint-table
   dump** ("Modifier breakpoints: 3 → -4, 4–5 → -3, …") — DM_ARTIFACT_LEAK, twice.
2. _"is my attack roll d20 minus 2 versus a target number, yes or no, and what's the TN?"_ → dodged the
   yes/no, re-dumped the modifier table.
3. _"what defense value do I need to beat … against a basic foe?"_ → answered with the PLAYER'S OWN
   Armor ("Your Armor is 10") — twice, even after the player corrected it.
4. The player gave up and assumed symmetry.

## The design (Tim's law, operationalized)

**A real DM confirms the shape of the mechanic in fiction and keeps the innards.** Boundaries:
- **Allowed (diegetic):** die names ("a d20"), stat NAMES ("your might behind it"), yes/no
  confirmations of the shape ("Yes — d20, your might, against the foe's guard"), and the player's OWN
  sheet numbers (they can see their -2; acknowledging it is not a leak).
- **NEVER:** numeric TNs/DCs/defense values, modifier breakpoint tables, percentages, internals of
  the resolve math. The foe's guard is answered RELATIVELY, computed honestly from real state:
  compare the foe's actual defense to the player's own Armor → "about level with your own" / "a touch
  stiffer" / "softer than yours" (the comparison words must match the real numbers — test it).
- **Self ≠ foe:** a question about the ENEMY's number must never be answered with the player's stat.

## Three seams, one packet

1. **Deterministic rules-answer floor** (grace/meta seam — locate it: the gate turns carried mech
   `(none)`, so find which path produced those replies): detect mechanics/rules questions (to-hit,
   modifiers, TN/defense, "how do I roll") → curated in-fiction shape answers + the honest relative
   calibration above. Direct yes/no questions get the yes/no FIRST.
2. **The leak guard** (deterministic, in the narration-validator seam — `engine/llmAdapter.js`,
   ML-1's `validateNarrationCandidate` precedent): reject DM prose containing table/mechanics dumps
   (breakpoint sequences like `\d+ → [+-]\d`, `DC \d`, `TN \d`, stat-block runs) → fall back to the
   deterministic floor's answer, never the dump.
3. **One standing line in the DM system prompt** codifying the law (confirm shape; never tables,
   TNs, or DCs; foe difficulty relative only).

## Guardrails

- THE LAW siblings: `docs/DND_XCOM.md` narrate-the-read-never-the-number; the hide-the-math commit
  (`b65ad23`). This packet EXTENDS them to rules-questions; do not weaken either.
- LLM-off repro FIRST on the four quoted utterances; corpus: relock any row asserting table dumps
  (document each), add locks for all four.
- Determinism green (U19/21/22/27/30); convergence 100%; `rng.js` only; no `WORLD_VERSION`.

## Tests (U426–U428)

- **U426:** the four gate utterances, LLM-off → shape answers (yes/no confirmed where asked; die+stat
  named; no numeric TN/DC anywhere; foe question never answered with a self stat).
- **U427:** the leak guard — breakpoint/DC/TN dumps rejected with the floor's answer substituted;
  clean in-fiction prose passes untouched.
- **U428:** relative-calibration honesty — across hand-built foes (guard equal / higher / lower than
  the player's Armor), the comparative wording matches the true relationship.

## Done-when

All four exchanges produce Tim's-law answers LLM-off AND LLM-on (leak guard proven); U426–U428 green;
`npm run check` GREEN; `playtest:quick` clean; one local commit (no push); package.json patch bump
only; changelog + PACKETS row updated.

## Rollback

Revert the commit (table dumps return).

## Report (plain English for Tim)

What was wrong (a player who asked "how do I hit things, yes or no?" got a spreadsheet dumped on the
table, and when they asked about the ENEMY's defense the DM read them their own armor value — twice),
what changed (the DM now answers like a person: "Yes — a d20 with your might behind it, against the
foe's guard; a common bandit's guard sits about level with your own" — and a tripwire rejects any
answer that tries to leak a table), why it matters (your law — the math stays behind the screen, but
the player always gets a real answer).
