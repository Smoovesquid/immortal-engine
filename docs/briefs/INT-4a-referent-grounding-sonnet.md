# INT-4a (Sonnet lane) — family graduation queue, cut #1: referent-grounding consumes the shared packet

**Model:** Claude Sonnet. **Serial lane, HIGH CARE** — same file/seam class as INT-3 (`engine/playloop.js`'s
`playerMoveCore`, the recursive reducer core — even more sensitive than the egress wrapper because it
**recurses**, see "THE HAZARD" below). **Worktree + branch** (suggested: `int-4a-referent-grounding`).
Nothing else may touch `playloop.js`/`engine/grace/*` while this is in flight. **Prerequisite: INT-1
(`57b878c`), INT-2 (`918b10a`), INT-3 (`a19b0bc`) are landed on `v2-polish`** — build on top, don't
re-derive them.
**Spec of record:** `docs/PACKETS.md` → ACTIVE → INT arc → **INT-4** (the stub: "the family graduation
queue — cut one packet per family on the INT-3 template... order: referent-grounding (`[clarify:referent]`,
sink S4) → dialogue-address → combat table-talk → compound multi-part asks. Cut each packet when its
predecessor lands.") This is that first cut. On conflict, PACKETS.md wins.

## Mission — ONE bounded packet, narrower than it looks

INT-3 collapsed the **egress** (`applyEgressRepair`, the single wrapper around every turn's output) onto
one shared `directQuestionIntent` computation instead of two. This packet does the **same kind of
collapse**, but for the **referent-grounding family** — the code that decides "does this utterance name a
real, present NPC, or an ungrounded/ambiguous one that needs `[clarify:referent]`?" and "is this a
pronoun-referent follow-up ('who's it from?', 'is there a name on it?') that should be answered, not
bounced?" Per INT-3's own report, the relevant call-sites live INSIDE `playerMoveCore`
(`engine/playloop.js:864`), in the `isExploreIntent` branch around lines **1976-2013** (grep
`directQuestionIntent(text, w)` at ~1992 and `ungroundedNpcReferentForText` → `npcReferentClarify` at
~2009-2011). There are OTHER `[clarify:referent]`/`npcReferentClarify` call-sites further down the file
(~2513/~3156/~7079, per `grep -n "\[clarify:referent\]" engine/playloop.js`) — **do not assume they're all
in scope**; investigate each on its own merits per "THE HAZARD" below, and it is a fully acceptable outcome
to graduate only the first one and leave the rest documented as future work (exactly how INT-3 left six
other `directQuestionIntent` call-sites and eight other `isInfoSeekingText` call-sites untouched).

## THE HAZARD — read this before writing any code (this is NOT like the INT-3 egress case)

`playerMoveCore` **recurses on itself** for chained turns (confirmed call-sites currently at
approximately lines **1261**, **1819**, **1849** — re-grep, line numbers shift): e.g. `playerMoveCore(wEnded,
packsById, text)` after an auto-ended dialogue, or `playerMoveCore(w2, packsById, interiorAction.thenText)`
with a **DIFFERENT text** for a chained interior action. Each recursive call runs the **entire function
body again**, including the referent-grounding code at ~1992/~2009, but with a **different `(world, text)`
pair** than the original top-level turn.

This means: **you cannot simply thread the single `__dqIntent` that `playerMoveTraced` already computes
(INT-3) into `playerMoveCore` and have every internal call-site use it unconditionally** — that value is
only valid for the ORIGINAL top-level `(text, world)`. If a recursive invocation reaches the same line with
its OWN different `text`/`world`, blindly reusing the outer `dqIntent` would silently classify the WRONG
utterance — a real regression, not a no-op refactor, and exactly the kind of bug the existing corpus may
not catch if it lacks a chained/recursive referent-question repro.

**The safe design (use this, don't invent a riskier one):**
1. Give `playerMoveCore` an optional trailing parameter, e.g. `playerMoveCore(world, packsById, text,
   dqIntent)`. **Every recursive self-call inside the function body must NOT forward this parameter** — call
   with exactly the same 3 args as today (`playerMoveCore(wEnded, packsById, text)`, etc.), so a recursive
   invocation always falls back to computing its OWN fresh `directQuestionIntent` for its OWN `(text,
   world)`. This is the load-bearing safety property — verify it by grepping every recursive call-site after
   your edit and confirming none of them gained a 4th argument.
2. Only `playerMoveTraced` (the true, non-recursive top-level caller, which already computes `__dqIntent`
   per INT-3) passes it in: `playerMoveCore(world, packsById, text, __dqIntent)`.
3. Inside the function body, at each in-scope call-site (~1992, ~2009-2011), use the passed `dqIntent`
   ONLY if you can show, by reading the code path from function entry to that line within the SAME
   invocation, that neither `text` nor the NPC-roster-relevant parts of `world`/`w` have been reassigned
   before reaching it (i.e., this is still operating on exactly the pair the parameter was computed for).
   If a code path reaches your target line only AFTER a local rebind of `w` (e.g. `ensureWorld`
   normalization is fine — same semantic world; a genuine state change like ending dialogue or moving rooms
   is NOT fine), do not use the passed value there — compute fresh, exactly as today, and say so in your
   report.
4. **Mandatory new test**: a chained/recursive turn where the OUTER turn's utterance and the RECURSIVE
   sub-turn's utterance would classify differently under `directQuestionIntent` (e.g., construct a case
   using the existing `interiorAction.thenText` chaining path, or the dialogue-auto-exit-then-resolve path
   at ~1261, with a referent-shaped follow-up text) — prove the recursive step computes its own correct,
   FRESH classification and does NOT inherit the outer turn's stale one. This is the actual proof the hazard
   above is closed, not just avoided by accident.

If, after investigating, you cannot cleanly prove points 3-4 for a given call-site within reasonable time,
**leave that call-site computing fresh internally, exactly as it does today, and document why** — this is
a legitimate, complete outcome for this bounded packet (same bar INT-3 set for the `isInfoSeekingText`
investigation). Do not ship a change you cannot prove is recursion-safe.

## Step 0 — self-assemble (FIRST, before any edit)

```
pwd && git status --short && git log --oneline -6
```
Confirm you're building on `a19b0bc` (INT-3) or later. Then read (current repo state wins over memory):
- `docs/PACKETS.md` — INT arc header + the INT-4 stub.
- `docs/briefs/AG-3-egress-wrapper.md` + `docs/briefs/INT-3-egress-packet-graduation-sonnet.md` — the
  template this packet follows, and the exact discipline (investigate the real call graph, narrow scope,
  optional-trailing-param, prove zero behavior change, leave what you can't prove).
- `engine/playloop.js:864` `playerMoveCore` in full control flow around lines 1200-1270 (the dialogue-exit
  recursion), 1780-1860 (the interior-action-chain recursion), and 1959-2013 (the referent-grounding
  call-sites this packet targets) — read these slices, don't skim.
- `engine/grace/answerability.js` `directQuestionIntent` (unchanged, just re-orient).
- `engine/playloop.js:5189` `npcReferentClarify` and its other call-sites (`ungroundedNpcReferentForText`
  callers) — re-grep `\[clarify:referent\]` for current line numbers, confirm which are inside
  `playerMoveCore`'s top-level-reachable-without-recursion path vs. reachable only via/after a recursive
  self-call.
- `tests/U319.egressDoor.test.js`, `tests/corpus/C21.corpus.mjs`, and grep the suite for any existing
  chained/recursive-turn referent test to avoid duplicating one.

## The work

1. Add the optional `dqIntent` trailing parameter to `playerMoveCore`, wired from `playerMoveTraced`'s
   already-computed `__dqIntent` (INT-3), with the non-forwarding-on-recursion property from "THE HAZARD"
   step 1 as the hard, load-bearing safety rule.
2. At the ~1992 call-site (`directQuestionIntent(text, w)` feeding `rules`/`referent-followup` kind
   dispatch) and the ~2009-2011 call-site (`ungroundedNpcReferentForText` → `npcReferentClarify`), consume
   the passed `dqIntent` where you can prove it's safe per step 3 above; otherwise leave as-is and document.
3. Investigate the other `[clarify:referent]`/`npcReferentClarify` call-sites further down the file
   (~2513/~3156/~7079 or wherever they currently are). For each: is it reachable only from the top-level
   non-recursive path, or could a recursive self-call reach it with a different `(text, world)`? Thread the
   shared packet into any you can prove safe by the same rule; leave and document the rest. It is fully
   acceptable to graduate only the ~1976-2013 region in this packet and leave the others as a named residual
   for a follow-up cut — do not force it.
4. Tests: the mandatory chained/recursive-turn proof from "THE HAZARD" step 4, plus a same-style
   before/after byte-identical comparison (like INT-3's) for at least 3 non-chained referent-grounding
   utterances (e.g. an ungrounded name like "where is Bartholomew?", a real referent-followup like "who's it
   from?", a grounded real NPC name that should NOT clarify). Allocate test numbers via
   `scripts/next-test-number.sh U` — never guess.

## Invariants — by reference (do not weaken any assertion)

`docs/IMMORTAL_INVARIANTS.md` + AG-3's determinism section, verbatim, as in INT-3: narration/mechanics-only
changes where you do change anything (you're not expected to change any narration here — this is a
zero-behavior-change refactor, same as INT-3); no world mutation, no `rng` draw introduced; `worldHash`
replay equality holds; **U19/21/22/27/30 stay green**; no `WORLD_VERSION`/state-shape change; no new
contract enum. **The existing corpus (U319/C21/full suite) must stay 100%** — plus your new
chained-turn test must FAIL if you temporarily force the unsafe "always reuse the outer dqIntent" version
(prove the safety property actually catches a real bug, don't just write a test that passes either way).

## Verification ladder → done-when

`node --test` fully green · `npm run convergence` **100%**, unchanged from the INT-3 baseline (124/124) ·
determinism gates green (U19/21/22/27/30) · `tests/U319.egressDoor.test.js` + `tests/corpus/C21.corpus.mjs`
green, unchanged · the new chained/recursive-turn test passes AND is shown to fail against a deliberately
unsafe version (paste both results) · `npm run playtest:quick` 0 crashes/0 bugs · `npm run check` green · a
before/after diff on ≥3 real referent-grounding utterances (grounded name, ungrounded name, pronoun
referent-followup) showing byte-identical narration pre/post-refactor.

## Landing contract

Commit ON YOUR WORKTREE BRANCH only (authorized by this brief), atomic, staged **by path** —
`refactor(playloop): INT-4a — referent-grounding consumes the shared packet (recursion-safe)`. **Never push
to or merge `v2-polish`; never `git add -A`.** Basecamp verifies and lands. No paid gate required. No
version bump (zero-behavior-change refactor). Make all judgment calls yourself — if you cannot prove a
call-site is recursion-safe, leave it and document why (a complete, acceptable outcome); flag any deviation
under "Residual risk." End your report with a plain-English paragraph for Tim: what was broken/redundant,
what changed, why it matters, and explicit reassurance that no single turn's output changes — including a
plain-English note on the recursion hazard (why chained/multi-step turns needed special care) so he
understands why this packet took real care rather than being a trivial copy-paste of INT-3.

## Out of scope (hard)

Dialogue-address, combat table-talk, compound multi-part asks — the next three INT-4 family cuts, not this
one · any `[clarify:referent]` call-site you cannot prove recursion-safe (leave it, document it, do not
force) · any actual behavior/routing change to what gets classified or how a clarify/decline reads ·
`WORLD_VERSION` or persisted state-shape changes · `public/` UI changes · anything not in
`engine/playloop.js`'s referent-grounding call-sites, `engine/grace/answerability.js` (read-only reference,
should need no edits), and new/extended tests.
