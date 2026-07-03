# INT-3 (Sonnet lane) — graduate family #1: the egress consumes ONE packet, never re-derives

**Model:** Claude Sonnet. **Serial lane, HIGH CARE** — this packet edits `engine/playloop.js`'s AG-3 egress
door, the single most invariant-critical, gate-proven surface in the repo. **Worktree + branch**
(suggested: `int-3-egress-packet`). Nothing else may touch `playloop.js`/`engine/grace/*` while this is in
flight. **Prerequisite: INT-1 (`57b878c`) and INT-2 (`918b10a`) are landed on `v2-polish`** — build on top,
don't re-derive them.
**Spec of record:** `docs/PACKETS.md` → ACTIVE → INT arc → INT-3 (on conflict, PACKETS wins). Context:
`docs/RUNG1_CONVERGENCE_PLAN.md` §3.2/§3.3 (Vol 8 §15's 9-point graduation bar), `docs/briefs/AG-3-egress-wrapper.md`
(the pattern this packet graduates — read it in full, it is the best model in this repo for how to touch
this file safely), `docs/briefs/AG-3b-intent-aware-whitelist.md` (the most recent surgery on the same seam).

## Mission — ONE bounded, narrow packet (narrower than PACKETS.md's prose suggests — read this section)

AG-3 already built "the one-way egress door": every free-text turn's output funnels through
`applyEgressRepair` (`engine/playloop.js:566`), which — for a turn the player was OWED an answer to —
repairs a dead-end narration by dispatching on a **typed verdict** from `directQuestionIntent(text, world)`
(`engine/grace/answerability.js:82`). That machinery is correct and gate-proven. The problem INT-3 fixes is
narrower than "graduate everything": **the egress currently RE-DERIVES that typed verdict from scratch**
(`playloop.js:576`) instead of consuming the packet INT-1 already assembled one call earlier, in the same
turn, from the same `(text, world)` pair (`assemblePacket`, `playloop.js:629`, which itself calls
`directQuestionIntent` internally). Two independent calls to the same pure function on the same inputs,
one turn apart, computing the same answer twice. **INT-3's whole job: make that one call, not two** — the
egress consumes the packet, it doesn't re-derive it.

**Investigate the file before you scope this any wider.** `grep -n "directQuestionIntent" engine/playloop.js`
turns up **seven** call-sites (lines ~576, ~1462, ~1964, ~2513, ~2528, ~3357, ~7658), not one. **Only the
egress call-site (~576) is in scope for INT-3.** The other six belong to separate families that PACKETS.md's
own INT-4 stub lists as a queue, one packet each: referent-grounding (the `[clarify:referent]` sink),
dialogue-address (the deflect-and-wait sink), combat table-talk, and compound multi-part asks. Touching any
of those six here is scope creep on a hot file — leave them exactly as they are, call them out by line
number in your report as "confirmed out of scope, reserved for INT-4," and do not "helpfully" collapse them
too. Same discipline applies to `isInfoSeekingText` (`engine/grace/gracefulAdjudication.js:837`, the
scattered `INFO_SEEKING_TOPIC_RE`/`PROVENANCE_RE`/`FOUNDING_RE`/`TENURE_RE` family PACKETS.md mentions) — it
has **nine** call-sites across combat suppression, dialogue routing, and exploration logic, most unrelated
to the meta-query answer-binding family this packet graduates. See step 3 below for the bounded way to
handle it (investigate + report, don't force a retirement that risks the other eight call-sites).

Why it matters (plain English): right now the same "is this a real question, and what kind?" judgment gets
computed twice per turn, by two separate calls that happen to currently agree — a silent duplication that
could quietly drift out of sync the moment either call-site changes independently. Collapsing it to one
computation, consumed twice, is what makes the packet trustworthy as the engine's actual seat of judgment —
the thing every future family (referent-grounding, dialogue-address, …) will build on in INT-4.

## Step 0 — self-assemble (FIRST, before any edit)

```
pwd && git status --short && git log --oneline -6
```
Confirm you're building on `918b10a` (INT-2) or later. Then read (current repo state wins over memory):
- `docs/PACKETS.md` — INT arc header + INT-3 packet.
- `docs/briefs/AG-3-egress-wrapper.md` and `docs/briefs/AG-3b-intent-aware-whitelist.md` in full — the
  house style for touching this exact seam, including the "narration-only repair, no state mutation, no
  rng, worldHash unchanged" discipline that is the actual safety net here.
- `engine/playloop.js:481-660` (the whole AG-3 block: `egressRepair`, `applyEgressRepair`, the INT-1/INT-2
  packet call-site in `playerMove`, and `playerMoveTraced` which wires them together) — read this slice in
  full, don't skim it; it is short and every line is load-bearing.
- `engine/grace/answerability.js` (`directQuestionIntent`) and `engine/intent/assemblePacket.js`
  (`assemblePacket` — note it already calls `directQuestionIntent(raw, world)` internally to fill `kind`/
  `ambiguity`).
- `engine/playloop.js:7527` `answerOrDeclineQuestion(world, text, outcome, intent)` — the function the
  egress dispatches to; note it already accepts an optional `intent` (the `directQuestionIntent` return
  shape `{kind, addressee, parts}`) specifically to skip re-derivation (see its header comment, "AG-2R:
  Blocker B").
- `tests/U319.egressDoor.test.js` and `tests/corpus/C21.corpus.mjs` — the regression lock for this exact
  seam. These call `applyEgressRepair(prevWorld, text, res)` directly with **3 args, no packet** — your
  change to that function's signature MUST keep that 3-arg call working byte-identically (see step 1).

## The work

1. **Thread a single, shared `directQuestionIntent` computation from `playerMoveTraced` into
   `applyEgressRepair`, replacing that function's internal re-derivation — without breaking existing
   3-arg callers.** Concretely:
   - Give `applyEgressRepair` an optional 4th parameter, e.g. `applyEgressRepair(prevWorld, text, res,
     dqIntent)`. When `dqIntent` is provided, use it directly instead of calling
     `directQuestionIntent(text, prevWorld)` internally. When omitted (every existing call in
     `tests/U319.egressDoor.test.js`), behavior is **byte-identical to today** — it computes it internally,
     exactly as now. This is the same "optional trailing param defaults to today's behavior" pattern INT-1
     and INT-2 already used successfully — reuse it, don't invent something new.
   - In `playerMoveTraced` (`playloop.js:637`), compute `directQuestionIntent(text, world)` **once**, and
     pass that single result into `applyEgressRepair(world, text, playerMoveCore(...), dqIntent)`. This is
     the one real production call-site that should now make exactly one call where it used to (indirectly,
     via `assemblePacket` + the egress's own internal call) make two.
   - You have a genuine choice here on how far to take "one call": the minimal-risk version computes
     `dqIntent` once in `playerMoveTraced` for the egress, leaving `assemblePacket`'s own internal
     `directQuestionIntent` call (which feeds the INT-1/INT-2 shadow/proposal packet, a separate concern)
     untouched — two call-sites in the file, but the *egress family this packet graduates* now consumes a
     single shared computation rather than deriving its own. This is the safe, bounded, reversible option.
     A more thorough version could also have `assemblePacket` accept an optional pre-computed `dqIntent` to
     get down to truly one call per turn — attempt this ONLY if it is a clean, low-risk addition; if it
     requires touching `assemblePacket`'s public signature in a way that risks INT-1/INT-2's zero-diff
     guarantees, take the minimal-risk version instead and say so in your report. Favor reversibility.
2. **Prove zero behavior change.** This is a pure refactor: `directQuestionIntent(text, prevWorld)` and
   `directQuestionIntent(raw, world)` (inside `assemblePacket`) are called with equivalent arguments on the
   same turn, so the computed value is mathematically identical either way — you are removing a redundant
   *call*, not changing an *answer*. Verify this empirically, not just by argument: `npm run convergence`
   must stay at exactly the INT-2 baseline (124/124, 100%), the full suite must stay green, and
   `tests/U319.egressDoor.test.js` / `tests/corpus/C21.corpus.mjs` must pass unchanged.
3. **Investigate the "scattered entrance REs" claim — report, don't force.** PACKETS.md's INT-3 objective
   says `INFO_SEEKING_TOPIC_RE`/`PROVENANCE_RE`/`FOUNDING_RE`/`TENURE_RE` (in `isInfoSeekingText`,
   `gracefulAdjudication.js:837`) should "become packet-feeders or be deleted." Grep their real call graph
   first (nine call-sites, most in combat-suppression/dialogue-routing logic unrelated to the egress). For
   each of the four REs, determine: is it now provably redundant because the graduated egress path (step 1)
   already covers everything it used to catch? If — and only if — you can prove that with the corpus (a
   red test if you comment it out, still green if you delete it), retire it. If it's still load-bearing for
   any of its other call-sites (the likely finding, given the fan-out), **leave it in place** and document
   in your report exactly which call-sites still depend on it and why deleting it would be unsafe within
   this bounded packet. A finding of "not safely retireable yet" is a legitimate, complete answer here —
   do not force a deletion to satisfy the letter of PACKETS.md's prose at the cost of the corpus.
4. **Tests**: extend `tests/U319.egressDoor.test.js` (or add a new test, allocate via
   `scripts/next-test-number.sh U` if a fresh file is cleaner) with a case that: (a) proves the 3-arg call
   (no `dqIntent`) is untouched — same input, same output, before and after your change; (b) proves the
   4-arg call with an explicitly-passed `dqIntent` produces the identical repaired narration as the 3-arg
   call would have on the same input (i.e., threading the packet doesn't change the answer); (c) confirms
   `playerMoveTraced`'s real call-site now passes a `dqIntent` and that a full `playerMove` turn is
   byte-identical to pre-INT-3 for at least 3 of the existing U319/C21 corpus utterances.

## Invariants — by reference (do not weaken any assertion)

`docs/IMMORTAL_INVARIANTS.md` + AG-3's own invariants section (`docs/briefs/AG-3-egress-wrapper.md`
"Invariants — determinism is the hard gate") apply verbatim: **the egress repairs narration + mechanics
only — no world mutation, no `rng` draw**; `worldHash` replay equality holds (**U19/21/22/27/30 stay
green** — this is the go/no-go, exactly as it was for AG-3 itself); no `WORLD_VERSION`/state-shape change;
narration ≠ canon; LLM never throws (unaffected — this packet touches no LLM code); no new contract enum.
**The 121+-case corpus (U319 + C21 + the existing suite) must stay 100%** — if anything goes red, a
threading mistake is the first suspect, not the corpus.

## Verification ladder → done-when

`node --test` fully green · `npm run convergence` **100%**, unchanged from the INT-2 baseline (124/124) ·
determinism gates green (U19/21/22/27/30) · `tests/U319.egressDoor.test.js` all properties green ·
`tests/corpus/C21.corpus.mjs` green · `npm run playtest:quick` 0 crashes/0 bugs · `npm run check` green ·
a before/after diff on at least 3 real question utterances from the U319/C21 corpus showing byte-identical
narration pre- and post-refactor (paste it in your report — this is the actual proof, not the test count).

## Landing contract

Commit ON YOUR WORKTREE BRANCH only (authorized by this brief), atomic, staged **by path** —
`refactor(playloop): INT-3 — the egress consumes ONE packet, never re-derives (meta-query family)`.
**Never push to or merge `v2-polish`; never `git add -A`.** Basecamp verifies and lands. No paid gate
(`dm-playtest.mjs`) required for this refactor, but if you have budget headroom and want extra confidence
given this touches the gate's most-tested seam, note that as optional, not required. No version bump (this
is an internal refactor with a proven zero-behavior-change property, not a new capability). Make all
judgment calls yourself — favor the minimal-risk option described in step 1 if genuinely forked, and flag
any deviation under "Residual risk." End your report with a plain-English paragraph for Tim: what was
broken, what changed, why it matters — jargon translated. Explicitly state, in plain terms, that this
packet does NOT change what the game says or does in any single turn — it only removes a redundant
internal computation, and name the honest finding on the entrance-REs investigation (retired / kept and
why).

## Out of scope (hard)

Any of the other six `directQuestionIntent` call-sites in `playloop.js` (~1462/1964/2513/2528/3357/7658) —
reserved for INT-4's family queue · forcing a retirement of any `isInfoSeekingText` regex whose other
call-sites you haven't proven safe · compound multi-part routing (`compoundParts[]`) — that's a named INT-4
family, not this one · any actual behavior/routing change based on `kind`/`ambiguity` beyond what
`answerOrDeclineQuestion` already does today · `WORLD_VERSION` or persisted state-shape changes ·
`public/` UI changes · anything not in `engine/playloop.js`'s AG-3 block, `engine/grace/answerability.js`,
`engine/intent/assemblePacket.js` (if you take the fuller option in step 1), and new/extended tests.
