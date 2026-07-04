# AG-3 — the one-way door: no question can silently dead-end

**Model:** Codex 5.5 (deep playloop surgery — the worker-routing lane for the reducer's hot path). **Solo,
serial** — this is the structural keystone; it owns `playloop.js`'s egress, so nothing else runs on playloop while
it's in flight. Build it INCREMENTALLY and keep `node --test` + `npm run convergence` green at every step (the 119
locked corpus cases ARE the proof that answer-bearing paths still answer — never let them go red).

## Context — why the family kept relocating
Fable's second-order diagnosis (`docs/briefs/SECOND_ORDER_DIAGNOSIS.md`, §2 + §7 packet 4) is the spec. The short
version: AG-1 tried to catch questions at the **entrances**, where a guard is forced fail-closed (a false catch
breaks a real action) → it grows precision exclusions → it goes blind. Every sink-default fix (CMB-SINK-1, DLG-1,
NBIO-1) that changed **what happens by default** held 12/12 under the adversarial gate; the one entrance-detector
leaked. AG-3 moves the contract to the **one place downstream of every sink — the egress — where recall-bias is
finally free** (a false catch just attempts a better answer; if the machinery returns null, keep the original).
This flips the default so a NEW code path is guarded *by default*: an untagged non-answer on a question turn gets
repaired, not shipped. That inversion is what ends the treadmill.

**Prerequisites are all landed** (AG-2R classifier fix, CT-1, DS-1a) — the dispatch targets AG-3 routes to are now
correct, so AG-3 can trust them.

## The egress point (already located)
- **`engine/playloop.js:477` `playerMove`** wraps `playerMoveCore` (`:589`): `const res = playerMoveCore(...)`.
  This is the **single non-recursive outer funnel** — `playerMoveCore` recurses internally (`:955/:1506/:1536`) for
  chained turns, but the final `(text → res)` pair always surfaces here. The wrapper lives at `:478`, on `res`,
  before `playerMove` returns. Do NOT put it inside `playerMoveCore` (it recurses).
- **AG-2R already killed the `QUESTION_SHAPE` mirror** (answerability.js now imports `isQuestionShaped`) — that
  diagnosis item is DONE; skip it.

## The four parts (Fable §2.3)
1. **Provenance, once.** Tag every return site's output with a `via:` field (or derive it from the existing
   `mechanics` tag where one already reliably marks the path — e.g. `[clarify:referent]`, `[combat:table-talk]`,
   `[dialogue ask|enter]`, `[info-check → no-record]`, gen-bank strings). Then **whitelist the answer-bearing
   provenances** — a closed, curated ~dozen-entry set (dialogue answer/enter, place/person query, the meta
   answers, presence/roster survey, the honest `…→ no-record` declines, DS-1a's definite-negative, grounded
   object/skill outcomes, combat table-talk *as an answer*). **Everything else — including a missing/unknown
   provenance — is suspect.** This one-time, greppable enumeration replaces the forever-enumeration of sinks.
2. **Recall-biased detection, at last.** At the egress, decide "is this turn owed an answer?" with the LOOSE test
   the 06-19 verdict wanted: `directQuestionIntent(text) != null` OR question-shaped OR imperative-info (incl.
   "give me"), with only *literal declared-action* exclusions. Over-matching is free here (see §default).
3. **Typed dispatch — consume the verdict, never re-derive.** When a suspect provenance meets an owed-answer turn,
   repair by routing on the classifier's `kind` (this KILLS blocker B — no `isQuestionShaped` re-litigation):
   presence→`buildLocationSurvey({presence:true})`; sheet/ledger→the meta answers; place/object→`placeQuery` /
   `answerOrDeclineQuestion(w, text, outcome, intent)`; npc-addressed→answer-in-voice or `declineInfoSeek`;
   experiential-sense→DS-1a's canon-scan; feasibility→the read (never the odds). All READ-ONLY answerers.
4. **The default flips.** Owed-answer turn + every dispatcher returns null → an **honest voiced decline**
   (`declineInfoSeek`, `:6714`). **Never fall back to the gen bank / clarify / survey sink.** Today `dqFloor`-null
   (`:7036`) drops to the gen bank; that path becomes unreachable for question turns. The atmosphere bank remains
   for ACTIONS only. This is 06-19 verdict (ii), still never shipped — ship it.

This catches **LH-2 for free** (the movement-claim swallow AG-2R deliberately left open — "who's in the next
room?" that got walked through the door): the egress sees an owed-answer turn with a movement provenance and
repairs it, with NO movement-branch guard. That is the whole point — future unenumerated sinks are caught by
default.

## What STAYS upstream — do NOT move these to the egress (Fable §2.4)
- **Pre-roll suppression** (`:3010`) stays classifier-keyed and conservative. A wrongly-rolled question still exits
  through the door and gets its **narration** repaired post-roll — the player-visible harm was the fog, not the
  roll. (This is also the determinism seam — see below.)
- **Dialogue/combat mode claims** stay first (DLG-1/CMB-SINK-1 defaults hold and the gate proved it).

## Invariants — determinism is the hard gate
- **The egress repairs NARRATION + mechanics only — it must introduce NO world mutation and NO `rng` draw.** The
  repair routes exclusively to READ-ONLY answerers. The world state returned is whatever `playerMoveCore` produced
  (including a roll that already ticked, if the pre-roll gate missed it — that state stays; only the fog narration
  is replaced). Because `worldHash` hashes state, not narration, replay equality holds. **U19/21/22/27/30 MUST stay
  green** — this is the go/no-go. If any repair path can mutate state, it's the wrong path.
- **narration ≠ canon** (this is exactly why narration-only repair is legal). Road A / V11 — the repair delivers
  canon facts / honest declines, never LLM-invented content. §0 never surfaced. LLM never throws. This is a
  **routing wrapper — NO `WORLD_VERSION` / state-shape change** (no `ensureWorld`/invariants edits).
- **The 119 locked corpus cases must stay 100%** — they are the guarantee that whitelisted answer-bearing paths
  still pass through untouched. If one goes red, a whitelist entry is wrong; fix the whitelist, not the corpus.

## Test plan — P10's antecedent checklist is the done-when (Fable §8)
Each property gets a `node --test` assertion (all mech-line/string checkable, no judge):
- **`tests/U319.egressDoor.test.js`** (pre-assigned):
  (i) **wrapper live** — a turn that `playerMoveCore` returns as a `[clarify:referent]`/gen-bank non-answer on an
  owed-answer input exits `playerMove` repaired (answer or voiced decline), proven by a before/after on the same
  input.
  (ii) **whitelist enforced, untagged→repair** — a synthetic/unknown-provenance non-answer on a question turn is
  repaired; a whitelisted answer passes through byte-identical.
  (iii) **default flip** — owed-answer turn + all dispatchers null → `declineInfoSeek` voiced decline, and the
  **gen-bank strings ("goes your way"/"after a fashion"/"see it through") are unreachable on question-shaped or
  imperative-info turns**.
  (iv) **LH-2 closed** — "who's in the next room?" no longer walks the player through the door unanswered.
  Diverge/negative controls: declared actions still hit the gen/atmosphere bank (the door only repairs QUESTION
  turns); combat stays closed; dialogue stays closed; **determinism** — repaired turns replay identical `worldHash`.
- **`tests/corpus/C21.corpus.mjs`** (pre-assigned) — the residual unenumerated-sink repros (incl. LH-2), locked.
- Existing suite + `npm run convergence` **100%** + `npm run playtest:quick` 0 bugs + **`npm run check`** (the full
  ladder incl. determinism).

## Done-when
U319 (all four P10 properties) + C21 green · convergence 100% · `node --test` fully green · **determinism green
(U19/21/22/27/30)** · `npm run playtest:quick` 0 bugs · `npm run check` GREEN. Bump the version (solo):
`package.json` → **0.21.0** (minor — a structural milestone), `public/v1.js` →
**v0.21.0 / build 035 · 2026-07-02 · the one-way door**.

## Commit protocol
Stage ONLY your files by explicit path (`engine/playloop.js`, `engine/grace/*` only if a read-only answerer needs a
signature tweak — flag if so, `package.json`, `public/v1.js`, `tests/U319.*`, `tests/corpus/C21.*`) — **never
`git add -A`** (many untracked briefs in the tree). Commit locally (`feat(playloop): AG-3 — the egress door; a
question can't silently dead-end (repair-by-provenance)`). **Report the commit hash; do NOT push** — this is the
keystone; Basecamp verifies each P10 property + the determinism gate + the 119-corpus hold, then does the next
paid gate (P10: DM_TEST_DEADEND ≤1/48 across all personas) before pushing the milestone.
