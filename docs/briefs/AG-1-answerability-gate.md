# AG-1 — the Answerability Gate (keystone; Sonnet lead, Codex-consult on the pre-roll)

**Model:** Claude Sonnet (lead). **Solo packet — no parallel lane** (it touches both grace and playloop, so
other grace/playloop lanes would collide; they fan out after this lands). The playloop edits are small, named,
guarded insertions — if the pre-roll gating turns gnarly, STOP and flag it for a Codex sub-packet rather than
deep-editing playloop.

## Context — the one root behind the treadmill
Per `docs/briefs/FAILURE_META_DIAGNOSIS.md` (Fable, 47-gate meta-analysis): the engine enforces "never say a
falsehood" as a hard **postcondition at the exits** (so fabrication died), but only "always resolve the intent"
as **pattern-matching at each entrance** (so DM_TEST_DEADEND relocates forever — patch the meta path, it
re-emerges on the dialogue path the same day). AG-1 is the structural fix: **one classifier + one postcondition
enforced at the sinks**, so a direct question can never terminate as a non-answer — it reroutes to the
answer/decline machinery that *already exists*. This is DTD-B's unified-predicate lesson at family scale, and it
is the 2026-06-19 gate verdict finally shipped structurally instead of narrowly.

## Read first
- `docs/briefs/FAILURE_META_DIAGNOSIS.md` §2 (roots R1/R2/R3), §4 (the AG-1 packet spec), §3 (predictions P1–P5).
- `engine/grace/gracefulAdjudication.js`: `isQuestionShaped` (:651), `buildLocationSurvey` (:2488), the
  npc-address helpers from DTD-A (`handleNpcAddressedQuestion` / the direct-address guard), and the existing
  reroute machinery you'll deliver *to*: `answerOrDeclineQuestion` / `declineInfoSeek` / `confrontationReaction`
  / `personQuery` / `placeQuery` (grep them — they already answer or decline from canon).
- `engine/playloop.js`: `genericGroundedOutcome` (:6934, the gen-bank/atmosphere-filler sink),
  `npcReferentClarify` (:4704, emits `[clarify:referent]`, called at :1174/:1651/:2708/:6386), and the pre-roll
  gate region (~:6539 "the pre-roll gate and the post-roll narration can never disagree").

## Fix shape (reroute to existing answers — invent NO new answer content)
1. **Classifier — new `engine/grace/answerability.js`:** `directQuestionIntent(text, world)` → `null` or a typed
   `{ kind: 'rules'|'self'|'npc-addressed'|'place'|'object'|'referent-followup', addressee, parts[] }`. Build on
   `isQuestionShaped` + npc-address + imperative-info forms ("name/tell/show/walk me…") + **action-verb
   exclusion** (reuse the existing exploration/action exclusion so "I search the room" is NOT a question).
   **Recall-biased by design:** a false positive costs a graceful in-voice line; a false negative costs a HARD
   dead-end (the 06-19 cost-asymmetry finding). Export it.
2. **Postcondition at the non-dialogue sinks:** at `buildLocationSurvey`'s return sites, `genericGroundedOutcome`'s
   gen-bank/atmosphere-filler, and the `npcReferentClarify` (`[clarify:referent]`) emitter — **if
   `directQuestionIntent` is non-null and the pending output is one of these non-answer sinks, replace it with the
   existing deliver-or-decline path** (`answerOrDeclineQuestion` / `declineInfoSeek` / `confrontationReaction` /
   `personQuery` / `placeQuery`). The gate only *reroutes*; it never invents a fact.
3. **Pre-roll rule (R3):** a `directQuestionIntent` turn never reaches `resolve()` as a gradeable d20 unless it
   embeds a declared perception/social ACTION. (Kills "were you born here?" → NAT1 → hedge, and "is Gravedigger a
   class?" → rolled.)

## DEFERRED to DLG-1 (do NOT do here)
The **dialogue-enter sink** ("who are you?" → enter-and-wait). That's DLG-1, the immediate next packet — it needs
this classifier PLUS Tim's approved C16-001 relock ("enter dialogue AND the first line answers from the roster or
declines in voice"). Leave the dialogue-enter branch untouched; just export the classifier for DLG-1 to consume.

## Invariants — by reference (do not weaken)
Road A / Biblioteca V11 — reroute to canon answers; never let the LLM supply the fact/outcome. THE_DM_TEST +
THE_TABLE_TEST. Determinism: `engine/rng.js` sole randomness; `worldHash` stable; U19/21/22/27/30 green.
LLM never throws. **Over-match discipline (critical):** the classifier is recall-biased but must NOT swallow
declared ACTIONS or exploration ("I search the chest", "I look around") — those still route to their resolvers.
Prove no regression against the large existing meta/action corpus (full suite + `npm run convergence` 100%).

## Test plan
- **`tests/corpus/C17.*.corpus.mjs`** (pre-assigned; next free C) — a paraphrase corpus: one case per non-dialogue
  sink × phrasing family (rules / self / place / object / referent-followup), each with paraphrases, locked.
- **`tests/U312.*.test.js`** (pre-assigned) — LLM-off: the re-gate's non-dialogue repros resolve, not bounce —
  "who's it from? is there a name at the bottom?" no longer emits `[clarify:referent]`; "were you born here?" no
  longer rolls a d20 (honest decline is fine until NBIO-1); a rules question routes to an answer, not a roll.
  Diverge guards: "I search the room" / "I attack the guard" still route to their action resolvers.
- Existing corpus stays 100%; existing meta/action tests green.

## Done-when
`U312` + `C17` green · existing `npm run convergence` 100% locked · `node --test` fully green · determinism green ·
**`npm run playtest:quick` 0 bugs** (playloop touched). Bump the version (solo): `package.json` → **0.20.5**,
`public/v1.js` → **v0.20.5 / build 030 · 2026-07-02 · every question gets an answer**.

## Commit protocol
Stage ONLY your files by explicit path (`answerability.js`, `gracefulAdjudication.js`, `playloop.js`,
`package.json`, `public/v1.js`, `tests/corpus/C17.*`, `tests/U312.*`) — untracked briefs/docs are in the tree, so
**never `git add -A`**. Commit locally (`feat(grace): AG-1 — the answerability gate (a question can't end as a
non-answer)`). **Report the commit hash; do NOT push** — this is the keystone; Basecamp verifies it carefully
(re-runs the gate, checks the over-match guards, confirms the classifier is recall-biased) and pushes.
