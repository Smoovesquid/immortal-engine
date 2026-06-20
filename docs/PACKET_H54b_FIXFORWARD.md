# H-54b fix-forward — META_DAMAGE_RULE (R3) over-fires on in-fiction actions AND affirms a false stat (Claude-Sonnet, grace)

Paste below the line to the **same Claude-Sonnet window** that did H-54 (it has the context). H-54 is already
pushed (`d49ad65`); this is a fix-forward commit on top. Same file you already own — still file-disjoint from
the in-flight H-55 (`playloop.js`). You own ONLY `engine/grace/gracefulAdjudication.js` + `tests/U217...`.

---

## What's wrong (caught in §7 verification — passed your U217 but fails adversarial probes)

Your R3 detector and answer are both too loose. Verified live against `handleMetaQuestion`:

```
"yes or no: do I add the poison to the blade?" → "Yes — your ability modifier adds to a hit's damage…"   ✗ (in-fiction ACTION swallowed as a rules answer)
"do I add my CHARM to melee damage?"           → "Yes … with your current CHARM modifier (-1)…"           ✗ (affirms a FALSE rule — CHARM never adds to melee damage)
"do I add my MIGHT +1 to melee damage…"        → "Yes … MIGHT modifier (+1)…"                              ✓ (correct — keep)
```

Two distinct defects:

1. **Over-fire.** The `\byes\s+or\s+no:?\s+do\s+i\s+add\b` arm of `META_DAMAGE_RULE` matches "yes or no: do I
   add \<anything\>" — including in-fiction actions ("add the poison to the blade", "add it to the brazier"
   slips through only because it lacks the "yes or no" lead-in, but "yes or no: do I add the poison…" is
   caught). The arm must require a **damage/mod object**, not bare "do i add".
2. **Stat-blind affirmation.** The answer says "Yes" and echoes whatever stat the player named, even CHARM/
   WITS/GRIT. Canon: melee damage uses the **MIGHT** modifier (force approach) or **AGILITY** (finesse
   weapon) — confirmed in `engine/resolve.js` (force→MIGHT at the mechanics line; `finesse`→`AGILITY` at the
   approach→stat map, ~L79). No other stat adds to melee damage. The answer must **correct** a wrong stat, not
   rubber-stamp it.

## The fix

### Narrow the detector
Tighten the `yes or no` arm of `META_DAMAGE_RULE` so it only fires when the object is damage/mod-related —
i.e. require "to (melee) damage" / "the right mod" / a "1dN+N" hit form to appear, the same context the other
arms already demand. "yes or no: do I add the poison to the blade?" must NOT match (and stay
`isMetaQuestion === false` → falls through to action resolution). Do not touch the other three arms; they're
correct.

### Validate the stat in the answer
In the R3 branch of `handleMetaQuestion`, read the named stat and branch:
- **MIGHT or AGILITY** → affirm: "Yes — your weapon die plus your `<STAT>` modifier (`<fmtMod>`); that's the
  right mod." (AGILITY only when the question/weapon is finesse-framed; if unsure, MIGHT is the melee default —
  keep the existing default but only for an unspecified/MIGHT ask.)
- **Any other stat (CHARM/WITS/GRIT/etc.)** → **correct it**: "No — melee damage uses your MIGHT modifier (or
  AGILITY for a finesse weapon), not `<STAT>`." Never echo a non-damage stat as "the right mod."

Keep the change surgical — the detector regex + the answer branch. Don't touch R1/R2/R4 or any other handler.

## Tests (extend `tests/U217.metaQueryAnswerBinding.test.js`)

RED-first against current H-54 code (they fail now):
1. `"yes or no: do I add the poison to the blade?"` → `isMetaQuestion === false` (or at minimum NOT answered
   by the damage-rule branch); it must fall through, not get the rules reply.
2. `"do I add my CHARM to melee damage?"` → answer is the **correction** ("not CHARM" / "uses your MIGHT"),
   NOT an affirmation; assert the string does not start with/contain "Yes —".
3. Regression-keep: `"do I add my MIGHT +1 to melee damage with these blades?"` and the
   `"yes or no: do I add my MIGHT +1 to melee damage…"` gate phrasing STILL get the correct affirmation.
4. Keep all existing U217 cases green.

## Done-when

1. New U217 cases RED-first, then all green; existing U217 + grace meta-query tests still green.
2. Full suite green (`node --test`); determinism U19/21/22/27/30 green.
3. `git diff --stat` for the fix-forward shows ONLY `engine/grace/gracefulAdjudication.js` + `tests/U217...`
   (+ your `docs/AGENT_CHANGELOG.md` H-54b note).
4. Add an H-54b note to the changelog (the over-fire + stat-blind affirm + the two-part fix).
5. Claude-Sonnet: commit AND push (still §7-verified after).

## Out of scope
- No `playloop.js` / `resolve.js` / `llmAdapter.js` edits (H-55 owns playloop; STOP if you think you need it).
- Don't rebuild R1/R2/R4. This is purely R3 detector-narrowing + stat-validated answer.
- No `WORLD_VERSION` bump, no `Math.random`/`Date.now`.
