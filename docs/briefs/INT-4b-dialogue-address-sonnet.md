# INT-4b (Sonnet lane) — family graduation cut #2: dialogue-address consumes the shared packet

**Model:** Claude Sonnet. **Serial lane, HIGH CARE** — same file/seam as INT-4a (`engine/playloop.js`'s
`playerMoveCore`, the recursive reducer core). **Worktree + branch** (suggested: `int-4b-dialogue-address`).
Nothing else may touch `playloop.js`/`engine/grace/*` while this is in flight. **Prerequisite: INT-1
(`57b878c`), INT-2 (`918b10a`), INT-3 (`a19b0bc`), INT-4a (`d217c85`) are landed on `v2-polish`** — build on
top, don't re-derive them.
**Spec of record:** `docs/PACKETS.md` → ACTIVE → INT arc → **INT-4** (the family-graduation queue; order:
referent-grounding → **dialogue-address (S5 deflect-and-wait)** → combat table-talk → compound). INT-4a did
cut #1 (referent-grounding). This is cut #2. On conflict, PACKETS.md wins.

## Mission — ONE bounded packet, on the exact INT-4a template

INT-4a collapsed two of `playerMoveCore`'s referent-grounding call-sites (~1518, ~2030) onto the single
shared `directQuestionIntent(text, world)` verdict that INT-3 already computes once per top-level turn
(threaded in as `playerMoveCore`'s optional 4th param `dqIntent`). This packet does the **same collapse for
the dialogue-address family** — the "talk to X" / unnamed-direct-address block — which today re-derives
`directQuestionIntent(text, w)` at **two more call-sites**, currently:
- **~2579** — `daDqKind = DA_OBJECT_REFERENT_RE.test(text) && !w.combat?.active && !w.scene?.dialogue ?
  directQuestionIntent(text, w) : null;` (the direct-address object-referent guard).
- **~2594** — `const dqEnterIntent = directQuestionIntent(text, w);` (inside the `daBegun.outcome.ok`
  dialogue-enter block; consumed at ~2606 for the `npc-addressed` in-voice decline — DLG-1's
  "never the silent turns-and-waits" line).

Re-grep for current line numbers (`grep -n "directQuestionIntent(text, w)" engine/playloop.js`) — they
shift after each cut. **ONLY these two are in scope.** The remaining `directQuestionIntent` call-sites
(~3423 `isUngroundedInfoCheck(w,text) || directQuestionIntent(text,w)`, and ~7724 `dqFloor` inside
`answerOrDeclineQuestion`) are NOT dialogue-address and NOT this cut — INT-4a already investigated ~3423 and
left it because `recordProvocation` can mutate `w` on a non-returning fall-through before it; respect that
finding, leave both untouched, and list them in your report as confirmed-out-of-scope.

Why it matters (plain English): still the same "compute the same question-classification once, not three or
four times per turn" cleanup — this packet retires the dialogue-address family's duplicate. No player-visible
behavior changes; every turn reads byte-identical before and after.

## THE HAZARD — the auto-seek room-move (this cut's version of INT-4a's recursion hazard)

Both target call-sites sit **after** the `if (talkRef) { … }` block (~2451-2565). Inside that block, when you
"talk to <someone in another room of this same building>", `autoSeekWithinStructure` (~9227) **reassigns
`w`** (`w = seek.world`, ~2485) to walk you to them. There is a real fall-through path where that mutation
happens and the block does NOT return (named target resolves, `beginDialogue` fails, `ungroundedNpcReferentForText`
returns null → falls past ~2565), so by ~2579 `w` may be a *moved* world, not the function-entry `w`. If you
blindly consumed a `dqIntent` computed against the entry `w`, you must be certain that move can't change what
`directQuestionIntent` would return — otherwise you'd answer against a stale roster (a real regression, not a
no-op).

**The invariance you must INDEPENDENTLY VERIFY (do not take this brief's word — prove it in the code, then
lock it with a test):**
- `directQuestionIntent(text, world)` (in `engine/grace/answerability.js`) reads world state ONLY via
  `world.map.currentNodeId` and that node's `settlement.npcs` roster (plus the raw `text`, which is never
  reassigned anywhere in `playerMoveCore`). Confirm this by reading the function — if it reads anything else
  world-dependent, this analysis changes.
- `autoSeekWithinStructure` mutates ONLY `w.scene.interior.roomId` (via `moveWithinInterior`) — it does NOT
  change `w.map.currentNodeId` or the settlement roster. Confirm by reading it (~9227) and `moveWithinInterior`.
- Therefore the auto-seek move leaves `directQuestionIntent(text, w)` **invariant**: same `text`, same
  `currentNodeId`, same `settlement.npcs` ⇒ same verdict. If — and only if — you verify this chain end to
  end, the two call-sites are safe to consume the shared `dqIntent`.
- You must ALSO verify the broader path (function entry → ~2579, and → ~2594): no OTHER non-returning `w =`
  reassignment between entry and these lines changes `currentNodeId`/`settlement.npcs`. INT-4a already
  established the entry→~2030 span is clean; you're extending the proof across ~2030→~2594. The talkRef
  block's other `w =` reassignments (beginDialogue at ~2492, the direct-address `daBegun` at ~2589) either
  return before your target line or don't change the roster — trace each and state your finding.

If any link in that chain does NOT hold, **do not force the graduation** — leave that call-site computing
fresh internally exactly as today and document precisely why (the same standard INT-4a used for the
call-sites it left: a documented "not safely graduatable" is a complete, acceptable outcome, not a failure).

## The recursion property from INT-4a still binds

`playerMoveCore` recurses (dialogue auto-exit ~1280, interior move-then-act ~1847, indoor-to-travel ~1877).
INT-4a's load-bearing rule stands: **every recursive self-call stays 3-arg and never forwards `dqIntent`**,
so a recursion recomputes fresh for its own `(text, world)`. You are only ADDING consumers of the existing
`dqIntent` param at ~2579/~2594 — you must not touch the recursive call-sites, and must re-grep after your
edit to confirm they're still 3-arg. The INT-4a test that proves this (`tests/U378`) must stay green.

## Step 0 — self-assemble (FIRST, before any edit)

```
pwd && git status --short && git log --oneline -6
```
Confirm you're building on `d217c85` (INT-4a) or later. Then read (current repo wins over memory):
- `docs/PACKETS.md` INT arc header + INT-4 stub.
- `docs/briefs/INT-4a-referent-grounding-sonnet.md` + `docs/briefs/AG-3-egress-wrapper.md` — the template
  and the determinism discipline.
- `engine/playloop.js` ~2451-2620 (the whole talkRef + direct-address block) in full, ~9227
  `autoSeekWithinStructure` + `moveWithinInterior`, and the INT-4a signature comment on `playerMoveCore`
  (~869) so you consume `dqIntent` the same way (`dqIntent !== undefined ? dqIntent : directQuestionIntent(text, w)`).
- `engine/grace/answerability.js` `directQuestionIntent` in full (the invariance proof depends on exactly
  what world fields it touches).
- `tests/U378.referentGroundingPacket.test.js`, `tests/U319.egressDoor.test.js`, `tests/corpus/C21.corpus.mjs`.

## The work

1. At ~2579 and ~2594, replace the bare `directQuestionIntent(text, w)` with `dqIntent !== undefined ?
   dqIntent : directQuestionIntent(text, w)` — preserving each call-site's exact surrounding gating (at
   ~2579 the `DA_OBJECT_REFERENT_RE.test(text) && !w.combat?.active && !w.scene?.dialogue ? … : null`
   ternary must stay byte-for-byte except for the inner expression). Add a one-line comment at each site,
   in the INT-4a style, naming the invariance that makes it safe (roster keyed on `currentNodeId`, unchanged
   by auto-seek's interior-only move; recursion never receives `dqIntent`).
2. Verify the full invariance chain in "THE HAZARD" by reading the code; if it holds, graduate both; if a
   link fails for either site, leave that one fresh and document.
3. Tests (allocate via `scripts/next-test-number.sh U` — never guess): the load-bearing one is a
   **same-structure auto-seek then dialogue-address turn** — set up a world where a named NPC is in another
   room of the same building, "talk to" them so `autoSeekWithinStructure` fires and `w` moves, on a
   direct-address utterance, and assert the graduated path produces byte-identical narration to the
   pre-INT-4b (fresh-compute) path — i.e. consuming the shared packet after the move gives the same answer.
   Plus the standard before/after byte-identical check on ≥3 plain dialogue-address utterances (e.g.
   "who are you?", "who's this letter from?" (object-referent, must NOT be swallowed as address), a "talk
   to <present NPC>" enter). If you can additionally construct a case proving the guard matters (a
   deliberately-broken variant that would diverge if the invariance DIDN'T hold), include it — but if the
   invariance is total (same value regardless), a passing byte-identical test across the auto-seek move is
   the honest proof; say so.

## Invariants — by reference (do not weaken any assertion)

`docs/IMMORTAL_INVARIANTS.md` + AG-3's determinism section, verbatim: no world mutation, no `rng` draw
introduced; narration/mechanics unchanged (this is zero-behavior-change); `worldHash` replay equality holds;
**U19/21/22/27/30 stay green**; no `WORLD_VERSION`/state-shape change; no new contract enum. The existing
corpus (U319/U378/C21/full suite) stays 100%.

## Verification ladder → done-when

`node --test` fully green (run in the MAIN checkout environment if the worktree shows unrelated
auth/server failures — those are a known worktree-env artifact, not your change; the real bar is the main
checkout, which Basecamp will confirm on landing) · `npm run convergence` **100%** unchanged (124/124) ·
determinism gates green · `tests/U378` + `tests/U319` + `tests/corpus/C21` green, unchanged · your new
auto-seek-move test green · `npm run playtest:quick` 0 crashes/0 bugs · `npm run check` green · a
before/after diff on ≥3 real dialogue-address utterances showing byte-identical narration.

## Landing contract

Commit ON YOUR WORKTREE BRANCH only, atomic, staged **by path** — `refactor(playloop): INT-4b —
dialogue-address consumes the shared packet (auto-seek-invariant)`. **Never push to or merge `v2-polish`;
never `git add -A`.** Basecamp verifies and lands. No paid gate. No version bump (zero-behavior-change
refactor). Make all judgment calls yourself; if a call-site can't be proven safe, leave it and document
(complete, acceptable). Flag any deviation under "Residual risk." End with a plain-English paragraph for
Tim: what was redundant, what changed, why the auto-seek room-move made this need care, and explicit
reassurance no single turn's output changed.

## Report must include
1. Branch + commit hash.
2. Full ladder pass/fail with real numbers (state clearly if you had to run in the main checkout to clear
   the worktree-env auth/server failures — Basecamp will re-verify there regardless).
3. The invariance-chain proof you established (what `directQuestionIntent` reads; what `autoSeekWithinStructure`
   mutates; why the two don't intersect) — in your own words, from reading the code, not restated from this brief.
4. Before/after narration for ≥3 utterances + the auto-seek-move test result.
5. Which of the two sites you graduated vs. left (with reasons), and confirmation the recursive call-sites
   (~1280/1847/1877) are still 3-arg and U378 is green.
6. The plain-English paragraph.

## Out of scope (hard)

Combat table-talk, compound multi-part asks (the remaining INT-4 cuts) · the ~3423 and ~7724
`directQuestionIntent` call-sites · any behavior/routing change to what's classified or how a decline/enter
reads · `WORLD_VERSION`/state-shape · `public/` UI · anything outside the two named call-sites in
`engine/playloop.js` and new/extended tests.
