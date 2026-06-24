# H-53b fix-forward — strike-object branch over-fires on movement/people targets

Paste below the line to the **same Codex window** that did H-53 (it has the context). H-53's commits are
local + unpushed; add a fix-forward commit on top — the queue owner will verify the whole stack and push.

---

## What's wrong

H-53's new strike-object branch in `genericGroundedOutcome` (`engine/playloop.js`) is correct for strikable
props but **over-fires on movement idioms and people**, because `cut` is in `OBJECT_STRIKE_VERB_RE` and
`across`/`through` are aggressive prepositions. Verified live:

```
"I cut across the courtyard" → "Your strike catches the courtyard clean and sends pieces skittering."   ✗ (movement)
"I cut through the crowd"     → "You hit the crowd squarely; it breaks under the strike."                 ✗ (people — disturbing)
"I cut across the tablecloth" → strikes the tablecloth                                                     ✓ (legit — keep)
"I swing ... at the bread basket" / "strike the lantern" → strikes                                         ✓ (keep)
```

The `swing by|around|past|toward` movement guard works; the gap is `cut/hack/chop ... across|through <place|people>`.
The honest disambiguator is the **target's nature** (strikable object vs place/crowd), not the verb or prep —
"cut across the tablecloth" (object) and "cut across the courtyard" (place) are syntactically identical.

## The fix

Add a small **non-strikable-target denylist** to the strike-object branch: when `strikeTargetOf(t)` resolves
to a place/area or a people/crowd noun, do **not** take the strike branch — fall through to the generic
`gen:*` outcome (movement/idiom phrasings resolve as before). Keep everything else as-is.

- New module-level set, e.g. `NON_STRIKABLE_TARGET` — places/areas and people/groups. Seed it generously:
  `courtyard, yard, square, plaza, field, meadow, street, road, lane, alley, hall, room, chamber, corridor,
   bridge, gate, gateway, market, marketplace, distance, gap, corner, line, throng, crowd, mob, people, folk,
   crowds, guards, soldiers, villagers, onlookers, bystanders` (extend if obvious siblings come to mind).
- In the strike branch, after extracting `target`, also skip when the LAST word of `target` is in the set
  (so "the jeering crowd" / "the inner courtyard" still match on `crowd`/`courtyard`). Match on the final
  token, not the whole phrase, to catch adjectives.
- Do not change `strikeTargetOf`, the verb regex, the move-prep guard, or any `gen:*`/other branch. This is a
  single guard added inside the existing `if (target) { ... }` block.

## Tests (extend `tests/U216.objectStrikeNarration.test.js`)

Add cases (RED-first against current H-53 code — they fail now):
1. `"I cut across the courtyard"` (success) → NOT a strike-object line; falls to a `gen:*` outcome.
2. `"I cut through the crowd"` (success) → NOT a strike line (no "breaks under the strike" / no "hit the crowd").
3. `"I hack through the throng of guards"` (success) → NOT a strike line.
4. Regression-keep (must STILL strike): the existing `"cut across the tablecloth"` case, plus
   `"swing ... at the bread basket"` and `"strike the lantern"` — unchanged, still name+strike the object.
5. Adjective-target guard: `"cut across the inner courtyard"` → NOT a strike line (final-token match on
   `courtyard`).

## Done-when

1. New U216 cases RED-first, then all green; the H-53 strike cases stay green.
2. Full suite green (`node --test`); determinism U19/21/22/27/30 green; `npm run playtest:quick` clean.
3. `git diff --stat` for the fix-forward commit shows only `engine/playloop.js` + `tests/U216...` (+ your
   `docs/AGENT_CHANGELOG.md` DONE-update line).
4. Update the H-53 `DONE` changelog entry (or add an H-53b note) recording the over-fire + the denylist guard.
5. **Commit locally, do NOT push** — queue owner verifies the full H-53+H-53b stack per §7 and pushes.

## Out of scope

- Don't try to perfectly classify every noun; a generous denylist that kills the movement/people idioms while
  keeping obvious strikable props (basket, lantern, table, tablecloth, crate, door, barrel, sack) is the bar.
- Don't touch combat, grace, or `llmAdapter`. Don't remove `cut` from the verb list (it's legit for objects —
  "cut the rope/tablecloth"); the denylist is the right lever, not the verb list.
