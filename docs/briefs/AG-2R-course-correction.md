# AG-2R — course-correction for the in-flight AG-2 lane (supersedes AG-2)

**Model:** Claude Sonnet (same lane, same bounded size). **This redirects your IN-FLIGHT work — do not start over.**
Fable's second-order diagnosis (`docs/briefs/SECOND_ORDER_DIAGNOSIS.md`, commit `e4b6ce2`) traced every failing
turn through the shipped regexes and found AG-2's premise ("the classifier is already correct; widen its
consumers") is false. As scoped, AG-2 **cannot pass its own U316**. Two of your in-progress changes already proved
the diagnosis right in the wild (§9). Keep what's landing; change the approach on the rest.

## KEEP (landing correctly as scoped — do not revert)
- **Part B** — the presence-in-explore fix (`presence:true` + the `in it` widening on `PRESENCE_Q_RE`). Correct.
- **The letter-from fix** — direct-address over-match yielding to an object referent-followup. Correct.

## DROP (the diagnosis shows these are the treadmill, not the fix)
- **The `class|background|archetype` vocabulary carve-out you hoisted above `ACTION_PERM_RE`.** It fixes the
  Gravedigger repro but not the family — "what did I sense?", "what do I detect?", "how many do I see?" stay
  invisible under it (all null via the same `do/did I` exclusion). It's 3rd-generation enumeration disease
  (allowlists → exclusions → exclusion-exceptions). Replace it with item 1 below.
- **Widening the early explore-branch reroute to the broad `place` kind.** You already found this breaks
  convergence (C9/C12 — it swallows grounded answers owned by later specialists like "where's the tavern?" /
  "who runs this place?") and reverted it. Correct call — that's *why* the broad catch-all belongs at the egress
  (AG-3, a later packet), NOT at this entrance. Do not re-attempt it here.

## The real root (why the repros resist entrance-widening)
The classifier is **precision-biased despite its "recall-biased" header**: `ACTION_PERM_RE`
(`can|could|should|…|do|did|does|would|will|must` + `I/we`) runs at `answerability.js:26` *before* any `kind` is
assigned, so it cannot tell "**can I** climb it?" (feasibility — correctly excluded) from "what **can I** do with
my class?" / "what **did I** sense?" (info demands — wrongly nulled). Fix the *ordering*, not the vocabulary.

## AG-2R scope — three workstreams
1. **Classifier ordering fix** (`engine/grace/answerability.js`): a WH-governed clause must beat the auxiliary
   exclusion. `ACTION_PERM_RE` should null **only when the auxiliary LEADS the clause** ("can I climb…?"), never
   when a WH-word governs it ("**what** can I do", "**what** did I sense", "**how many** do I see"). Add `give`
   to `IMPERATIVE_INFO_RE` (so "give me the raw d20" classifies). `SENSORY_SURVEY_RE` should null **only when the
   sensory phrase is the whole ask** — a compound that also carries a second question part ("what do I see —
   *and who's standing in it?*") stays classified so Part B can route it. Kill the `QUESTION_SHAPE` mirror at
   `:15` if it's easy — one exported predicate, consumed everywhere (else note it for AG-3).
2. **Thread the intent** (`answerOrDeclineQuestion`, `playloop.js:~6912`): add an optional `intent` param. When
   supplied, **skip the re-derivation** (`isQuestionShaped` / `ACTION_PERMISSION_Q_RE` — Blocker B, the double-gate
   that makes the reroute silently no-op on imperatives like "tell me about the last traveler") and dispatch on
   `kind`. An `npc-addressed` **motive/secret** question ("what are you afraid I'll find?") routes to the NPC's
   **in-voice decline** — never a Wizard place-dump. (This also fixes LH-3, the wrong-fact-delivery shape the
   original buckets missed.)
3. **The scoped reroutes + Part B** exactly as you have them, now consuming the fixed classifier + threaded intent.

## OUT OF SCOPE (do NOT chase — later packets own these)
- **The movement-claim swallow** (LH-2: "who's in the next room?" → the room-transition handler moves the player).
  This is egress-class — note it as a known-open repro for **AG-3**; do NOT add a movement-branch guard (that's
  the treadmill).
- **Death-sense contentless success** → **DS-1a** (next packet). **The crunch compound-drop** ("d20 + damage die")
  → **CT-1** (next packet). Leave both.

## Test plan (the process lesson — test the BIAS, not just the repros)
- **`tests/corpus/…` exclusion-boundary corpus (NEW, the load-bearing one):** a must-classify unit set over the
  exclusion edge — `directQuestionIntent` returns **non-null** for "what can I do with my class?", "what did I
  sense?", "how many do I see?", "give me the raw d20"; and still **null** for the genuine feasibility forms
  ("can I climb it?", "should I try the lock?", "do I have rope?"). This is P6's antecedent and the durable guard
  against the bias silently re-inverting (§10 of the diagnosis). Put it where the corpus runner picks it up.
- **`tests/U316.*`** — the repros now pass *via the ordering fix + intent threading* (Gravedigger → rules answer;
  pallet "tell me about the last traveler" → answer/honest no-record, NOT clarify; LH-3 motive → in-voice decline;
  Part B roster names present NPCs). Diverge guards unchanged (bare look-around stays room-scoped; real unknown
  demonstrative still clarifies; declared actions still act).
- **`tests/corpus/C19.*`** + full `npm run convergence` **100%** (mind C9/C12 — the specialists you must not
  swallow).

## Invariants — by reference
THE_DM_TEST + THE_TABLE_TEST. Road A / V11 — reroute to canon answers/declines, invent nothing; honest voiced
decline is a valid terminal. Determinism: `rng.js` sole; `worldHash` stable; U19/21/22/27/30 green. §0 never
surfaced. **The crunch/hide-the-math behavior is OUT OF SCOPE** (CT-1 owns it; the law never fired — see §3).

## Done-when
exclusion-boundary corpus green · `U316` + `C19` green · `npm run convergence` 100% · `node --test` fully green ·
determinism green · `npm run playtest:quick` 0 bugs. Version stays **0.20.8 / build 033** (already bumped; keep it,
label it `v0.20.8 / build 033 · 2026-07-02 · questions classify, then answer`).

## Commit protocol
Stage ONLY your files by explicit path (`engine/grace/answerability.js`, `engine/grace/gracefulAdjudication.js`,
`engine/playloop.js`, `package.json`, `public/v1.js`, `tests/U316.*`, `tests/corpus/C19.*`, the new
exclusion-boundary corpus file) — **never `git add -A`** (Fable's diagnosis + other briefs are untracked in the
tree). Commit locally (`fix(grace): AG-2R — classifier ordering + intent threading close the answerability leaks`).
**Report the commit hash; do NOT push** — Basecamp verifies (the exclusion-boundary corpus + the 3 repros + the
C9/C12 anti-regression + determinism) and pushes.
