# CG-LIVE-2 — what repairs shadow-flagged narration (Ref-off)

*Design brief. Decision-ready, code-audited against `fcbc4f3d` (v0.28.22). Changes no code.*
*Dispatched: PACKETS §CG-LIVE-2 DESIGN LANE (2026-07-04). Companion: `COHERENCE_GATE.md` §4–§8.*

---

## §0 The question, exactly

The coherence **shadow observer** (`engine/coherence/shadowObserver.js`) runs the deterministic
Tier-D comparators (`engine/coherence/checks.js`) over the **final** live DM prose each turn and
**logs** would-be desyncs — a flag is a *desync pointer* naming the exact `{class, canonField,
expected, narrated}`. Live fire rate is **~2.8%** (1/36 on the last real run), the lone fire was a
false positive since fixed by **CG-1c** (absence/negation guard, landed), and the observer now
reproduces **2/3 → all** of the retroactive catches on the same play once it was moved post-Ref.

But the flag is **telemetry only**. The **Ref** — the old Tier-2 LLM that would have *regenerated*
flagged narration — was **pulled** by Tim's 2026-07-04 ruling (`a06912e`; `REF_ENABLED=0`; *"engine
authoritative; fewer governing LLMs; a third governing LLM that re-writes the output compounds
failure"*). So today: **when the shadow flags a turn's narration as contradicting canon, nothing
repairs it.** The player sees the incoherent line.

**This brief picks the mechanism that closes that gap without re-introducing a governing LLM.**

---

## §1 Ground truth — what a flag is, and where the seam is (audited, not guessed)

**A flag is a precise, deterministic pointer — not a vibe.** `checks.js` emits (line 97):

```
{ class:'CG-1b', canonField:'roomOccupants', expected:'[] (empty)',
  narrated:'"Elske Nightherd" speaks/acts in-room', severity:'fail', span, seed, persona, turn }
```

Nine single-turn-capable comparators are already exported as `SINGLE_TURN_DETECTORS` and run via
`runDetectors([record], SINGLE_TURN_DETECTORS)` — pure, LLM-free, never-throws (each detector is
wrapped in try/catch inside `runDetectors`). Every comparator ships a documented false-positive
guard and goes **dormant** (never a false flag) when its canon field is absent from the bundle.
Severities are `fail` and `warn` (`SEVERITY`). **CG-2c** (unnarrated relocation) is the one
cross-turn check; the shadow already supplies its prev-canon via a module-level `PREV_CANON` Map,
never on `world` (worldHash sacred).

**The narration seam is `augmentNarration` in `engine/llmAdapter.js` (~L1390–1443):**

```
1413  candidate   = await callLLM(...)                         // the LLM polish
1418  ok          = validateNarrationCandidate(world, candidate, {baseNarration: base, ctx})
1422  if (!ok) return base                                     // Tier-1 REJECT → deterministic base
1429  finalNarration = await reviewNarration({... ref})        // Ref (OFF: returns candidate unchanged)
1441  observeCoherenceShadow({world, candidate: finalNarration, outcome})   // telemetry only, return discarded
1443  return finalNarration
```

Three facts this seam settles:

1. **The house pattern is REJECT-AT-SINK → honest base fallback.** `validateNarrationCandidate`
   (L602) is a boolean gate: ~20 deterministic guards (RL-1 table-leak, location-lock, invented
   proper-noun, **U245 fled-foe kill-claim**, **PERC-1 un-hedge**, combat hit/miss inversion, and
   the **INFO-HONESTY** guard a sibling lane is adding tonight). Any `return false` drops the polish
   and ships `base`. The coherence checks are the *same shape of question* ("does this line
   contradict deterministic ground truth?") the validator already asks — they belong in the same
   position.

2. **The Ref is not "disabled by a flag" so much as unwired.** `reviewNarration`'s `judge`/`regenerate`
   are injected params that default `undefined` and `enabled` defaults `false`; with the Ref off it
   returns `candidate` untouched. Therefore **`finalNarration === candidate`** in live play. The
   pre-Ref/post-Ref distinction that forced the observer's move (`c7676cf`) has **collapsed** — a
   real simplification for us: the validator (pre-Ref) and the observer (post-Ref) now sit on
   identical text.

3. **A deterministic base ALWAYS exists.** `augmentNarration` early-returns `base` when the LLM is
   off / keyless / errors (L1402–1404), and on every validator reject. `base` is produced upstream
   by `engine/composer.js` `compose(world, playerText, resolution, ctx)` — the grounded, LLM-free
   floor. **This is the shippable fallback for any repair mechanism below.**

**The pinned laws this must obey** (IMMORTAL_INVARIANTS #6, THE_DM_TEST, THE_REF §1–3):
narration ≠ canon; the LLM authors **words, never canon**; the LLM/observer layer **never throws
and never blocks a turn** (silent fallback); the deterministic base must always read well with the
LLM off; **§0** cosmology never surfaces; **hide-the-math** (no numbers/system artifacts in prose).

---

## §2 One correctness fact that shapes every candidate: **the base is not guaranteed coherent**

Naïvely, "on a coherence flag, fall back to base" assumes the base is clean. **It is not always.**
The CG-LIVE-1b finding (PACKETS) is explicit: the validator-rejected turns produced *terse base
lines* like the run-1 **"Elske shrugs"** — a base narration that itself ghost-voices an absent NPC.
Falling back to such a base would trade one incoherent line for another and the shadow would re-fire
on the fallback.

So any candidate that "falls back to base on flag" must **re-check the base** with the same
comparators, and if the base *also* flags, degrade to a **guaranteed-inert deterministic floor**:
the grounded sensory line the composer already emits with zero roster/asserted-speaker/asserted-exit
content (the "you're in the bedchamber; timber walls, a cold hearth" register — description without
any canon-contradicting *claim*). This "coherence-safe floor" is the true bottom of the ladder and
must be named in whichever candidate wins. It is the same discipline PERC-1/U245 already use: the
base carries the correct *shape*; the guard only prevents polish from breaking it — here we extend
that to "and if the base breaks it too, strip to the description-only floor."

*(Practical note for the packet, not a design fork: the composer already produces a description
register; "coherence-safe floor" = select/trim to the clause set that carries no present-roster,
speech-act, exit, or headcount assertion. It is deterministic and cheap. If CG-LIVE-1b's base-blind-spot
fix lands first, the observer will already have measured how often base itself flags — read that
number before sizing the floor work.)*

---

## §3 The candidates

### Candidate A — **promote the shadow to a pre-delivery validator** (recommended)

**Mechanism.** Move the `SINGLE_TURN_DETECTORS` run out of the fire-and-forget observer and into a
new boolean check, `coherenceRejects(world, candidate, outcome)`, called from **the validator
position** (right where `validateNarrationCandidate` already gates). On any **`fail`-severity**
pointer → treat exactly like a validator reject → fall back to base; then **re-run the check on the
base**, and if base also `fail`s → the coherence-safe floor (§2). `warn`-severity pointers are
**logged, never blocking** (they are the soft classes — CG-1c omission, CG-7 quantity, the
escape-combat CG-4 case — where a real DM needn't be literal; blocking them would fight the DM Test).

- **New LLM calls: zero.** The comparators are pure code; this is the same $0/turn the shadow costs.
- **Latency: negligible** (regex bank over one line; sub-millisecond).
- **Determinism: untouched.** No RNG, no world mutation, reads the same read-only `buildCanonGroundTruth`
  bundle. The one cross-turn check keeps the existing `PREV_CANON` module-Map (never on `world`).
- **Complexity: low.** It extends an existing, blessed pattern (REJECT-AT-SINK) with an existing,
  tested comparator bank. The shadow **keeps running** in parallel as the measurement instrument
  (its log becomes the A/B evidence — see §5).
- **Failure modes & mitigations:**
  - *False positive → suppresses a good polish.* Cost is bounded: you fall back to the grounded
    base, never to nothing. Live `fail`-rate is ~2.8% pre-CG-1c and the FP in that sample is now
    guarded. Recall-bounded-by-lexicon means it can only **under**-block — the correct failure
    direction. **Only `fail` severities block**, so the recall-y `warn` classes can't cause churn.
  - *Base also flags.* Handled by the §2 re-check → coherence-safe floor. This is the load-bearing
    piece; without it, Candidate A regresses to "incoherent base."
  - *Blind to validator-rejected turns.* If we put the coherence check **after** the existing
    `if (!ok) return base`, it never sees turns the validator already rejected. **Fix inline:** run
    the coherence check on **whatever text `augmentNarration` is about to return**, at both return
    paths (the CG-LIVE-1b fix). Cleanest is a single `finalize(text)` helper that both the
    `!ok`-path and the happy-path call — one choke point, mirrors the observer's "observe the final
    text" lesson.

**Why this is the honest reading of Tim's ruling.** Tim pulled a *governing LLM that re-writes
output*. Candidate A adds **no LLM** — it lets the deterministic engine's own comparators *reject*
an incoherent LLM line and fall back to the engine's own grounded prose. That is "engine
authoritative + one narration pass," not a second author. It is the REJECT-AT-SINK pattern the
codebase already runs a dozen times, extended to the coherence axis.

**What it cannot do:** it cannot *answer better* — it can only *stop the lie* and deliver the honest
floor. If the flagged turn was the DM dodging a pointed question by conjuring an absent speaker,
Candidate A removes the conjured speaker but does **not** produce a satisfying in-fiction answer.
That gap is **AG-4's job** (already dispatched: "answer pointed questions in the fiction without
conjuring an absent speaker") at the *engine/base* layer — the right place, per the ruling. Candidate
A + AG-4 compose: AG-4 makes the base answer well; Candidate A guarantees the *polish* can't
re-break it. **This is the intended division of labor, not a shortfall.**

### Candidate B — **one named-violation retry**

**Mechanism.** On a `fail` flag, re-call the polish LLM **once** with the specific contradiction
injected as a hard constraint (`"Do NOT state or imply {narrated}; canon says {canonField} =
{expected}. Rewrite the same beat honoring that."`), re-run the comparators on the retry; on a
second flag → base → coherence-safe floor.

- **LLM calls: one extra on ~3% of turns** (~1 in 33). Real but small on the `.env` budget.
- **Latency: +1 full LLM round-trip on flagged turns** (~0.7–1.7s at Haiku/Sonnet polish latency) —
  and it's *conditional and invisible*, so it lands on exactly the turns already going wrong.
- **Determinism: untouched** (narration layer), but it adds an LLM call *inside* a path that must
  never block indefinitely → the retry MUST be bounded (one attempt, hard timeout, any error →
  fall straight through to base). The Ref's budget primitive (`engine/ref/budget.js`,
  `defaultRefBudget`) is the ready-made bound if we want a per-turn/per-session cap.
- **Complexity: medium.** New prompt surface, a retry orchestrator, a budget hookup, and a
  second-pass re-check. It re-creates a *slice* of what `reviewNarration`'s regenerate did — which
  is precisely the shape Tim's ruling was skeptical of.
- **The ruling tension (decisive).** B is a **narrower REF-GHOST**: an LLM re-writing the output to
  satisfy a constraint. The A/B that informed the pull (chaos+lore-hound ×16/arm) had **Ref-off = 0
  coherence flags / honest-floor 2/16** vs **Ref-on = 1 flag / 6/16 — worse on both axes**. B is
  better-constrained than the Ref was (a *specific* named violation, not an open "answer better"),
  so it might not reproduce REF-GHOST — but it re-opens the exact class the ruling closed, on a
  principle call. **Do not lead with B.** It is the *considered upgrade* to A **only if** live data
  proves the honest-floor fallback is too flat too often (measurable — see §5).

### Candidate C — **post-hoc canon-note repair**

**Mechanism.** Ship the flagged line as-is; write a correction into the next turn's LLM context
("last turn implied X; canon is Y — do not repeat").

- **LLM calls: zero extra** (rides existing context).
- **Fatal problem: it ships the incoherent line to the player this turn.** The desync the player
  *already saw* is the failure; a silent correction next turn cannot un-see it, and there's no
  guarantee the next turn even revisits the contradiction. This **violates hide-the-math/immersion
  by construction** (the world visibly contradicted itself; a later quiet retcon is exactly the
  seam we forbid) and does nothing for single-turn / one-shot desyncs.
- **Verdict: reject.** Evaluated fairly and it fails the core requirement (repair the turn the
  player sees). Keeping a *prev-turn desync note in context* is still worth doing as a **cheap
  assist to AG-4/base quality** (bias the next base away from repeating a caught contradiction), but
  that is a prompt-hygiene nicety, **not** the CG-LIVE-2 repair mechanism.

---

## §4 Recommendation — **Candidate A**, with the §2 coherence-safe floor, staged behind a flag

Candidate A is the only option that repairs the turn the player sees, adds **no new governing LLM**
(honoring the ruling to the letter), costs **$0 and ~0 latency**, extends a **blessed existing
pattern** (REJECT-AT-SINK), preserves determinism **by construction**, and keeps the shadow running
as its own falsification instrument. Its one real limitation — it stops the lie but doesn't author a
better answer — is **AG-4's chartered territory at the engine layer**, which is where the ruling
says that work belongs. A and AG-4 are complementary, not redundant.

**B is the escape hatch, not the plan.** Ship A; keep the shadow log; if the honest-floor fallback
proves too flat too often *in live data*, revisit B as a bounded, budget-capped, named-violation
retry — a decision Tim makes against a number, not a hunch.

### Rollout shape — dark → shadow-compare → live (mirrors CG-LIVE-1's own discipline)

1. **Dark.** Land `coherenceRejects()` + the `finalize()` choke point + the coherence-safe floor,
   all behind `COHERENCE_REPAIR=1` (**default OFF → byte-identical**, the U395 posture). Flag off:
   not one byte changes; the shadow keeps logging as today.
2. **Shadow-compare.** With `COHERENCE_SHADOW=1` **and** `COHERENCE_REPAIR=1`, log **both** the
   would-block decision **and** what the fallback text would be (the observer already logs `dm` +
   `evaluated`; add `wouldBlock` + `fallbackKind: base|floor`). Run the gate server this way over a
   real slice set. This yields the live block-rate, the base-also-flags rate (sizing the floor), and
   a **human read of every fallback** before any player sees one — no blind re-roll (the
   architecture-by-principle rule: don't silently swap prose you haven't eyeballed).
3. **Live.** Flip `COHERENCE_REPAIR=1` by default only after the shadow-compare slice shows: block
   rate boring (~single-digit %), zero human-judged "the floor was worse than the flagged line" on
   `fail` classes, and the honest-floor / base-also-flags rates within tolerance. Revert = one env
   line (rollback parity with the Ref pull itself).

### Eval plan — how corpus + gate + shadow ledger prove it

- **Corpus (regression, $0).** `scripts/coherence-gate.mjs` over `docs/playtests/gate-runs/*.jsonl`
  is the regression lock. A new committed baseline asserts the exact `fail`-class counts the repair
  *would* have blocked on historical transcripts — a silent comparator/wiring regression fails the
  test (the U337/U390-U393 pattern). **All 8 historical true catches must still be flagged** by the
  promoted path (the promotion must not lose recall vs the shadow).
- **Gate (discovery).** Run the Opus experiential gate (`scripts/dm-playtest.mjs`, chaos +
  lore-hound arms — the arms that produced the original desyncs) **with repair ON vs OFF**. Success:
  coherence-flag count on the ON arm drops toward 0 **without** the judge's taste/quality score
  regressing (repair must not make the DM read worse). This is the direct A/B analogue of the one
  that justified pulling the Ref — run the same shape, expect the opposite result (A improves
  coherence at no taste cost; the Ref made both worse).
- **Shadow ledger (the honest floor).** The `coherence-shadow/*.jsonl` from the shadow-compare stage
  **is** the live FP/block-rate evidence and the base-also-flags measurement. It stays running
  post-launch as the standing detector of any drift — repair ON, the ledger's `fail` rate should sit
  near zero (the class is being healed); a rising rate is the early warning.
- **Unit.** New `Uxxx` tests (range TBD by Basecamp; current max is U459, U394/U395 are the shadow
  pair — the natural home is a new sequential block): (1) a crafted `fail` bundle → `coherenceRejects`
  returns true → `augmentNarration` returns the base (not the flagged candidate); (2) base **also**
  flags → returns the coherence-safe floor, and the floor itself does **not** flag; (3) `warn`-only
  pointer → narration **unchanged** (soft classes never block); (4) `COHERENCE_REPAIR` unset →
  byte-identical + worldHash stable (the U395 twin); (5) a comparator throwing → turn completes on
  the candidate/base, never throws to caller (Invariant 3).

### Packet cut (S/M · files · tests — sizes for Basecamp)

- **Size: M.** One new pure function + one choke-point refactor + the coherence-safe floor selector +
  the flag + 5 tests + a committed corpus baseline. No hot-file surgery, no schema, no WORLD_VERSION.
- **Files (allowed):**
  - `engine/llmAdapter.js` — add `coherenceRejects()` (or import it), add the `finalize(text)` choke
    point that both return paths call, wire the `COHERENCE_REPAIR` flag. **This is the same
    Ref/adapter layer CG-LIVE-1 was scoped to** — *not* the forbidden hot files.
  - `engine/coherence/checks.js` — no logic change expected; if a shared "fail-only pointers" helper
    or a `coherenceSafeFloor()` selector reads cleanest here, add it (pure, no engine state — the
    module's whole contract).
  - `engine/composer.js` **only if** the coherence-safe floor needs a description-only accessor the
    composer doesn't already expose. **composer is a competence hot file (serial lane)** — prefer to
    derive the floor *from the base string* in the adapter (trim asserted-roster/speech/exit clauses)
    and touch composer **only if unavoidable**; if touched, it is its own serial sub-step with Tim's
    nod. *(Flag this fork explicitly at packet time.)*
  - `engine/coherence/shadowObserver.js` — add `wouldBlock` + `fallbackKind` to the logged record for
    the shadow-compare stage (observer stays side-effect-only).
  - New tests `Uxxx…Uxxx` (Basecamp assigns), one committed corpus baseline under
    `docs/playtests/`.
- **Forbidden (unchanged from CG-LIVE-1):** altering returned narration in any path when the flag is
  OFF; `WORLD_VERSION`; `state.js`; mutation; RNG; storing prev-canon on `world`;
  `playloop.js`/`escapeCombat.js`/`dialogue.js`/`grace/` (and `composer.js` except the guarded case
  above).
- **Invariants to assert:** default OFF byte-identical + worldHash stable; repair path never throws
  to caller; only `fail` severities block (`warn` classes never alter narration); the fallback is
  always a shippable grounded string (base or floor), never empty/nothing; §0 never surfaces.
- **Sequencing:** land **CG-LIVE-1b** (observe validator-rejected turns) first or fold it in — the
  `finalize()` choke point is the shared vehicle for both, so doing them together is cheaper than
  twice. AG-4 proceeds in parallel on the engine/base layer; A depends on nothing AG-4 ships, and
  AG-4 makes A's fallback read better.
- **done_when:** `COHERENCE_REPAIR=1` blocks `fail`-class desyncs on live turns and ships a grounded
  fallback (base, else coherence-safe floor); the shadow-compare log shows a boring block rate with
  zero human-judged "floor worse than the flagged line"; corpus baseline keeps all 8 historical true
  catches; gate A/B shows coherence up / taste flat; suite + determinism + convergence green.
- **rollback:** delete the flag + the `coherenceRejects` call (the comparators and the extracted
  helpers stay — pure refactor value).

---

## For Tim — plain English

Right now the game has a free, no-AI "fact-checker" quietly watching every line the DM writes and
comparing it against the world's own records — *"the DM said Elske answered you, but the records say
Elske isn't in this room."* It catches these slip-ups reliably, but at the moment it can only
**write them in a notebook** — it doesn't stop the bad line from reaching you. The old fix for that
was a second AI that rewrote the line, and you (rightly) pulled it, because a second AI trying to
"help" mostly invented *new* problems (it was the thing conjuring absent people in the first place).

My recommendation keeps your ruling exactly: **no new AI.** Instead, we let that same free
fact-checker do what the game already does a dozen times elsewhere — when the AI's fancy line fails a
check, we simply **throw it out and use the plain, always-correct version the engine wrote itself.**
Zero extra cost, no noticeable delay, and it can't invent anything because it's not writing anything
new — it's just refusing to ship a line that contradicts the world. The one honest caveat: this
*stops the lie* but doesn't always give you a *great* answer in its place — that better-answer work
is a separate task already underway (making the DM answer pointed questions well instead of dodging).
The two fit together: one makes the answer good, this one guarantees the pretty version can't
re-break it. We'd ship it dark (off, changing nothing), watch it decide-but-not-act on real play so a
human eyeballs every swap first, then turn it on — and it's one line to turn back off if you don't
like what you see. The runner-up option (let a bounded AI take *one* corrected retry) stays on the
shelf as an upgrade **only if** the plain fallback turns out too flat — and that's a call you'd make
looking at real numbers, not a guess.
