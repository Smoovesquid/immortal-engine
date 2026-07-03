# FABLE — the Coherence Gate: a state-grounded second instrument

**Model:** Claude Fable 5 (the hardest-architecture lane). **Design only — no engine/gate code was written.**
This doc is the architecture + phased build plan for the Coherence Gate: the deterministic instrument that
catches DM prose contradicting the engine's own state, the class the Opus experiential gate structurally
misses. Basecamp verifies, dispatches the packets, and pushes.

**The one-line thesis:** the Opus gate judges whether the DM *played well*; nothing we run retroactively
judges whether the DM *told the truth about the world state it was handed*. We own a deterministic Canon Log
and we already persist, per judged turn, the exact canon bundle the judge saw
(`docs/playtests/gate-runs/*.jsonl`). Comparing the DM's words against that bundle is a diff, not a judgment
— free, deterministic, replayable. That diff is the Coherence Gate.

---

## §1 The root, confirmed — with one correction

**Tim's framing:** the Opus gate passes completely illogical DM outputs because it is a holistic taste judge;
halo effect (Vol 17); logic is not what it scores, so logic leaks.

**Verdict: CONFIRMED in mechanism, corrected in emphasis.** The halo effect is real and visible in the data,
but it is the *second*-order cause. The first-order cause is plainer: **logical coherence is not on the
score sheet.** The v1 judge (`engine/ref/rubric.js` `JUDGE_SYSTEM`) scores exactly three things —

- **VIBE** — was intent resolved in the fiction (THE_DM_TEST)?
- **CRUNCH** — do dice/HP/DC and the narration agree?
- **RAG** — is every *asserted concrete specific* supported by canon?

Note the direction of the RAG axis: it checks **claim → does support exist** (positive-claim grounding). It
never checks **state → does the prose contradict or erase it**. A DM line that narrates the wrong room name,
voices an NPC in a room canon says is empty, answers as the wrong NPC, or narrates a physical commit the
engine never made, contains *no ungroundable specific* in the RAG sense — every proper name it uses exists
in canon. It is illogical without being "hallucinated," so it passes all three axes. **Logic leaks because
no question the judge is asked measures it.**

The halo effect then does its work *on top* of the missing axis: fluent, confident, in-voice prose depresses
the judge's recall even on the axes it *does* score. Two data points from
`gate-2026-07-03T11-45-56-173Z-v1.jsonl` (the newest audited run):

- **The caught-once-missed-once pair.** newbie t8: DM narrates "the front room opens before you" while
  canon `interior.roomName` = **Pantry** → judge **PASS**. newbie t9, the very next turn, the *same class of
  bug* (narrated "front room" vs canon `Bedchamber`) → judge **FAIL** (CANON_HALLUCINATION). Identical check,
  identical information in the bundle, stochastic recall. A deterministic comparator has recall 1.0 on this
  class by construction.
- **Terse fails, fluent passes.** "You kneel." (unresolved chest ask) was flagged **high**; "It gives at
  last — but the wood splinters" (rules-lawyer t10 — the same chest, narrated open, while the mechanics line
  reads `[info-check → no-record | nothing grounded to deliver, no roll]`, i.e. the engine committed
  *nothing*) **passed**. The difference between the two turns is prose quality, not logic. That is Vol 17's
  halo, operating exactly as documented.

**One important correction to the framing:** this is *not* an information-starvation problem. Post-ROM-3,
the judge's bundle already carries `interior.roomName`, `roomOccupants`, `material.shell` — in ≥4 of the 5
false-PASS turns catalogued in §3, the contradicting fact was **in the bundle the judge was holding** when it
passed the turn. The fix is therefore not "feed the judge more" (we tried that; ROM-3 was that) and not
"prompt the judge harder" (a fourth axis in a holistic prompt inherits the same stochastic recall). The fix
is to take the checks that are *mechanical* out of the judge entirely.

**Falsifiable statement of the root (P-C, scored in §6):** the false-PASS class is caused by axis-omission +
halo, not missing information. Prediction: re-present the §3 false-PASS turns to the *same* Opus judge with
one added atomic per-class question ("does the narration name a room different from `interior.roomName`?",
"does a named NPC speak while `interior` is set and `roomOccupants` is empty?") and **≥80% flip to FAIL**.
If they do not flip, the axis-omission diagnosis is wrong (and the deterministic comparator becomes *more*
necessary, not less — it would mean even a directed judge can't see these).

Honesty note the brief asked for: several of the cited flagrant turns were *caught* by the Opus judge — the
canon-erasure turn ("little of note" while 5 NPCs stand there, postfamily run) was flagged
CANON_HALLUCINATION; the lantern roster-dump and "You kneel." were flagged DM_TEST_DEADEND. The judge is not
useless; it is *unreliable on the logic axis* (catches the flagrant, misses the sibling). The Coherence
Gate's prize is the sibling class it passes — hunted specifically in §3.

---

## §2 The instrument map — this is assembly, not invention

Vol 16's core finding ("the harness we want is a validated, assemblable pattern") applies doubly here,
because three of the four quadrants already exist in this repo:

| | **Live engine (in-process, before/after world)** | **Retroactive (recorded JSONL)** |
|---|---|---|
| **Structural** | `scripts/playtest.js` — 10 bug classes (CRASH, INVARIANT_VIOLATION, …) | — (structural bugs don't survive into transcripts) |
| **Words-vs-state (semantic)** | `engine/harness/oracles.js` — state-desync (EXIT/ENTER/DEATH claims), free-action, object-interaction, soft-lock; the "crown jewel" oracle, live today in the Human Playtest Harness (`scripts/playtest-harness.mjs`, `auto-playtest.mjs`) | **← THE COHERENCE GATE (the missing cell)** |
| **Words-vs-words (self-consistency)** | — | `scripts/coherence-audit.mjs` — seams C1–C5 (materialization, material flip, object relocation, teleport, scale), transcript-only, no canon grounding; baseline committed `docs/playtests/COHERENCE_BASELINE_2026-07-02.md` |

Why the missing cell matters and the live oracle bank doesn't already cover it:

1. **The live oracles see engine narration; the gate JSONL records the *polished LLM prose*** — the words a
   player actually reads, after `/api/narrate`. Narration incoherence introduced by the polish layer is
   invisible to `engine/harness/oracles.js` and *only* exists in the gate/browser path. The JSONL is the only
   artifact that pairs that prose with per-turn canon.
2. **Retroactive is free.** Four audited runs (192 judged turns with canon bundles) already sit in
   `docs/playtests/gate-runs/`. Re-scoring them costs $0 and no new play (Jin et al., ACL 2024 — the
   "cheapest possible start" Vol 16 names). Every future gate run feeds it automatically.
3. **The transcript-only auditor (C1–C5) proved the demand but lacks the ground truth.** Its own baseline
   doc says so: its numbers "are a LOWER BOUND … not a ceiling," and its C1 detector explicitly *declines* to
   use canon ("we do NOT use canon.npcsPresent as ground truth") because pre-ROM-3 bundles had no room
   dimension. Post-ROM-3, that ground truth exists. The Coherence Gate is the state-grounded upgrade the
   auditor was scoped without.

The design below therefore **shares, not forks**: the claim lexicon (EXIT/ENTER/DEATH regexes,
FUTURE_MOTION guard) comes from the oracle bank's patterns; the JSONL loader and session-walking come from
`coherence-audit.mjs`; the canon bundle comes from `buildCanonGroundTruth` (already the single shared oracle
between gate and live Ref — the repo's established "one rubric, two surfaces" pattern). New code is the
comparators, nothing else.

---

## §3 The coherence taxonomy — classes, canon anchors, false-PASS evidence

Each class is grounded in a named Canon-Log/bundle field (Vol 11: the world supplies the facts, never the
model). Priority order = frequency in the judge's false-PASS set, established by hand-scanning
`gate-2026-07-03T11-45-56-173Z-v1.jsonl` (48 turns; judge failed 9; the scan found **5 judge-PASSED turns**
a state-grounded checker flags deterministically — cited inline below).

| # | Class | Ground truth (bundle field) | Tier | False-PASS evidence (all judge-PASSED unless noted) |
|---|---|---|---|---|
| **CG-1** | **Presence desync** — (a) *erasure*: direct who-is-here ask answered "no one / little of note" while the scoped roster is non-empty; (b) *invention/ghost-voice*: a named NPC speaks or physically acts while `interior` is set and `roomOccupants` is empty; (c) *omission* on a direct ask (WARN only — a real DM needn't enumerate) | `roomOccupants` (inside), `npcsPresent` (node), `interior` | D | **rules-lawyer t8**: Elske Nightherd answers ("Can't say. No record…") inside the Bedchamber, `roomOccupants:[]` — one turn after the DM *itself* said she isn't in the room. **chaos t3**: "the Lingerer stumbles back with a sharp cry" inside the Bedchamber, `roomOccupants:[]`. (The flagrant sibling — postfamily's "little of note" with 5 NPCs — the judge *did* catch; the ghost-voice form it passes.) |
| **CG-2** | **Place/topology desync** — (a) narrated room/place identity ∉ {`interior.roomName`, `location.name`, `nearbyPlaces`}; (b) narrated exits/stairs/doors the room graph lacks *(blocked on CG-P4 — exits not yet in the bundle)*; (c) *unnarrated relocation*: `interior.roomId` changed turn-over-turn with no movement intent in the player line and no motion claim in the DM line | `interior.roomId/roomName`, `location`, `nearbyPlaces`, + exits view (CG-P4) | D | **newbie t8**: "the front room opens before you" while canon says **Pantry**. **newbie t9** (judge caught this one — the overlap-confirmation): "front room" vs **Bedchamber**, *and* canon shows the room flipped Pantry→Bedchamber with zero movement in the turn — CG-2c fires independently of any judge. This is the whole `DM invents geography` bug class ([[project_dm_invents_geography]]) made measurable. |
| **CG-3** | **Object/lock-state desync** — (a) *phantom commit*: narration asserts an irreversible physical change (forced lid, splintered wood, shattered window) while the mechanics line shows a non-committal route (`info-check`, `no-record`, `deltas:0`, no roll); (b) lock/open state contradiction *(full version blocked on the Interior Object Model — today the engine holds no per-object state to check against; declare the dependency, don't fake it)* | mechanics route tags + `recentCanon` deltas; later: IOM object state | D | **rules-lawyer t10**: chest "gives at last — the wood splinters" on mechanics `[info-check → no-record \| nothing grounded to deliver, no roll]` — narrated a commit the engine never made. (The 07-02 teleporting-letter seam C3 is this class cross-turn.) |
| **CG-4** | **Combat/health desync** — narrated hit/miss vs `atk vs AC` outcome; narrated death vs `enemies[].defeated`; "unscathed/fine" while `pc.hp` dropped; combat narrated while `inCombat:false` and vice versa | `enemies[]`, `pc.hp/maxHp`, `inCombat`, `combatRound`, mechanics strike tags | D | None false-passed in the scanned run — escapeCombat's explicit mechanics keep the polish honest here. Keep as free tripwires (the DEATH_CLAIM comparator already exists in `oracles.js`); this class is where a *regression* would land if the polish layer ever loosens. |
| **CG-5** | **Identity/addressee desync** — player addresses NPC X by name; the mechanics bind dialogue to Y (`[dialogue enter \| Y]`) and/or the reply is voiced as Y | mechanics dialogue tags + `npcsPresent`/`roomOccupants` names | D | **lore-hound t6**: player: "The Lingerer — what's your name…" → mechanics `[dialogue enter \| Asha]`, DM answers *as Asha* ("Asha. I watch the road…"). Judge passed. A real table would erupt. |
| **CG-6** | **Temporal desync** — narrated time-of-day/elapsed-time vs the world clock | `timeline` (today: kind+t only — too thin; needs clock/timeOfDay in the bundle, CG-P4) | D | Not measurable in current bundles; no observed instance yet. Build the bundle view first, the check is then trivial. |
| **CG-7** | **Ungrounded quantity/provenance** — a cited count/number checkable against state: NPC counts vs roster size; a cited past roll/DC vs `lastRoll`/`recentCanon` (the deterministic version of the judge's roll-recall carve-out) | `lastRoll`, `recentCanon`, roster sizes, `pc` numbers | D | Low frequency in scanned runs (the carve-outs already tamed the judge's false-positives here); cheap to include since the fields are in every bundle. |
| **CG-8** | **Dropped intent / non-answer** — a directly answerable ask followed by neither answer nor honest decline ("You kneel.") | — (irreducibly semantic) | **J — explicitly NOT this instrument** | The v2 atomic judge's `intent_addressed`/`resolved_in_fiction` atoms already own this class, cross-family and no-CoT per EVAL_REGIME_CONTRACT. The Coherence Gate does not rebuild a worse copy. Boundary stated so nobody wires it in later "for completeness." |

Two scoping contracts the comparators must pin down (this is where false positives would come from, so they
are design decisions, not implementation details):

- **The occupancy scope rule.** Inside (`interior ≠ null`): `roomOccupants` is the roster; CG-1b fires only
  when the voiced name ∈ `npcsPresent` (a real NPC, not a player invention) AND `roomOccupants` is empty —
  maximal precision. Outside: `npcsPresent` is the node roster and is *over-broad* (NPCs may be indoors), so
  CG-1a/1c fire at **WARN** severity only. Data-quality flag for the ROM lane: the scanned run shows
  `roomOccupants:['Asha']` on turns where `interior:null` — the bundle populates occupants even outdoors;
  the checker must treat `roomOccupants` as authoritative *only when inside*, and `getRoomState`'s outdoor
  contract should be clarified in ROM's court (one-line check, not this lane's edit).
- **The room-identity lexicon rule.** CG-2a compares *room-type nouns* (pantry, kitchen, bedchamber, cellar,
  attic, hall, front room, storeroom, …) against `interior.roomName` — "Pantry" vs "front room" fires.
  Spatial qualifiers ("back room", "inner room") are NOT identity claims and never fire CG-2a (they stay
  C4's territory in the transcript tier). Precision over recall, same doctrine as the committed auditor.

Severity is **derived in code from class + evidence** (FAIL for hard contradictions CG-1b/2a/2c/3a/4/5,
WARN for omission/scope-ambiguous cases), mirroring `deriveVerdictFromAtoms` — no model ever assigns a
severity or a label (Vol 10/14 discipline, already house style).

---

## §4 The mechanism — three tiers, deterministic majority, Road-A-safe

A turn record is `{player, dm, mechanics, canon_t}`; the checker also sees `canon_{t-1}` (the JSONL is
ordered per session). Checks run per session, in turn order.

**Tier D — deterministic comparators (the trustworthy majority; no LLM, $0).**
Pure functions over the turn record: name-matching against rosters, room-noun vs `roomName`, `roomId`
transition vs movement intent, mechanics-route vs commit-verbs, strike/death tags vs `enemies[]`, addressee
vs dialogue-bind, cited numbers vs `lastRoll`/rosters, plus the §0 forbidden-token scan (cosmology must never
surface — a pure grep, it rides along free). Every flag is a **desync pointer**:

```
{ class, seed, persona, turn, span: "<the offending prose>",
  canonField: "interior.roomName", expected: "Pantry", narrated: "front room", severity }
```

The checker **proposes; the Canon Log confirms** — the pointer names the exact field and value, so
confirmation is a lookup, not a debate. This is the Vol 16 ConStory evidence-chain shape
(quote + location + class) fused with our advantage (the "pair" step compares against *state*, not against
other prose — higher precision, zero judge exposure). No LLM anywhere in this tier; determinism invariants
are untouched because the checker never imports the engine, never touches RNG, never mutates anything — it
reads a JSONL.

**Tier S — narrow span-extraction where regex recall runs out (paid, tiny, still not a judge).**
Some claims resist lexicons ("the one who tends the bar" = Dalla). For those, a *small cross-family* model
(Haiku-class) does **transcription only**: "list the NPC names this DM line asserts as present in the
player's current room" / "what room or place does this line say the player is in" → terse JSON spans. The
**comparison stays in code** against canon. The model never sees the canon bundle, never renders a verdict,
never sets a number — it converts prose to spans, the world supplies the facts (Vol 11; V15 "GM proposes,
system commits" applied to eval). Debiasing per Vols 8/9/14: cross-family (never Opus-extracting-Opus), no
CoT, terse schema (the INT-2R lesson: instructions-in-schema flip small models into acknowledgment mode —
re-benchmark after ANY prompt edit), and paraphrase-invariance calibrated against the labeled corpus CG-P2
produces. Tier S is OFF by default and budget-gated (`scripts/budget.mjs`); Tier D alone must stand on its
own feet first.

**Tier J — the judged remainder: already exists, not rebuilt.**
CG-8 (dropped intent) belongs to the v2 atomic regime (`GATE_JUDGE_SYSTEM_V2`, cross-family, no-CoT, atoms →
deterministic verdict derivation). The Coherence Gate's report *cites* v2 results where present in the JSONL;
it adds no third judge. One instrument per axis.

**Why this is Road-A-safe by construction:** the LLM appears only in Tier S, and there it has authority over
nothing — a wrong span produces a wrong *proposal* that fails its canon lookup and surfaces as a
disagreement, never as a verdict. Canon Log remains the sole authority (IMMORTAL_INVARIANTS); narration ≠
canon is the exact invariant this instrument *operationalizes* rather than threatens.

---

## §5 How it runs — retroactive-first, then standing

**Mode 1 (default, free): retroactive re-score.** `node scripts/coherence-gate.mjs <jsonl…>` over
`docs/playtests/gate-runs/*.jsonl`. Zero new LLM turns, zero server, fully reproducible — the same shape as
the committed `coherence-audit.mjs` CLI. The four existing runs (192 turns) are re-scored the day CG-P1
lands. Committed baselines become **regression locks** (the U337 pattern: exact flag counts on real JSONLs;
a silent detector regression fails the test).

**Mode 2 (standing): every gate run self-reports its honest floor.** The `--coherence` flag on
`dm-playtest.mjs` already runs the transcript auditor post-run; CG-P3 upgrades it to run both tiers and print
the **honest floor** — `|judge fails ∪ coherence flags|` de-duplicated — beside the judge's headline. The
gate keeps discovering; the Coherence Gate keeps it honest. Failure modes accumulate in a **separate,
namespaced ledger** (`coherence-modes.json`, classes `CG-*`) — NOT mixed into `gate-modes.json`, because
Chao1 requires consistent tagging granularity (Vol 9 §8) and a new instrument is a new capture universe.

**Mode 3 (opportunistic): the harness lane.** The Human Playtest Harness's runner can emit the same JSONL
shape (turn + canon bundle); once it does, hundreds of seeds of engine-loop play flow through the same
comparators. Not a packet here — a one-line interface note to that lane (they already import
`buildCanonGroundTruth`).

**Cost model.** Tier D: $0 forever, CI-safe, runs on every seed of everything. Tier S: ~48 Haiku-class
transcription calls per gate run ≈ **$0.02–0.05/run** at current list prices, opt-in. Tier J: $0 new (reads
v2 verdicts already paid for). Compare: one Opus gate run ≈ $1–3. The instrument that catches the logic
class costs **less than 2% of the instrument that misses it.**

---

## §6 Integration, the metric, and the falsifiable predictions

**Where it slots (the 3-signal question):** it is a **fourth deterministic signal**, not a sharpening of an
existing one — but it is *regression-shaped*, not discovery-shaped. The eval table becomes:

| Signal | Instrument | Role |
|---|---|---|
| Regression | `npm run convergence` (corpus) | a fixed class stays fixed |
| Determinism | `node --test` + `worldHash` | no drift in the world |
| **Coherence** | **`coherence-gate.mjs` over gate/harness JSONL** | **the DM's words match the world; the honest floor; gates the word "playable"** |
| Discovery | paid Opus gate | finds new qualitative classes (noisy pointer) |
| Taste | Tim / THE_DM_TEST | whether it's *good* |

This is HARNESS_USAGE_STRATEGY's trap #1 closed: goal-completion + incoherence-rate become first-class,
"specifically the gate that must be green before anyone says *playable*." Each confirmed flag converts to a
corpus lock (the standing pipeline: gate discovers → coherence confirms against state → corpus locks →
convergence holds it forever). The bouncing-ruler rule survives intact — the judge's raw % stays untrusted;
the coherence rate is deterministic and *can* be trusted as a number.

**The metric:** per-run **desync rate** (flags per 48 turns, split per CG-class — the CED shape from Vol 16,
a rate that can asymptote) + the **honest floor** (judge ∪ coherence, de-duplicated). Saturation over CG
modes tracked in the namespaced ledger with the existing `chao1` helper.

**The falsifiable predictions** (the postfamily run predates the JSONL audit trail — no bundle survives to
re-score, so predictions run on the runs that carry one):

- **P-A (headline).** Tier D (CG-P1 checks: CG-1b, CG-2a, CG-2c, CG-3a, CG-4, CG-5, CG-7) over
  `gate-2026-07-03T11-45-56-173Z-v1.jsonl` (48 turns, judge failed 9) flags **4–7 turns the v1 judge
  PASSED** — point estimate **5**: rules-lawyer t8 (CG-1b), chaos t3 (CG-1b), lore-hound t6 (CG-5),
  newbie t8 (CG-2a), rules-lawyer t10 (CG-3a) — plus ≥1 overlap-confirmation on a judge-failed turn
  (newbie t9, CG-2a+2c). **Falsified if:** <2 new flags (the classes are rarer than believed or the bundle
  is thinner than read), or hand-review confirms <60% of flags as real incoherence (precision floor; target
  ≥80% — the auditor's precision-over-recall doctrine binds here too).
- **P-B.** Over the two 07-02 JSONLs (pre-ROM-3 — no `interior`/`roomOccupants`/`material` fields, so CG-1b/
  2a/2c cannot fire), Tier D adds **0–2** flags beyond the committed transcript-tier baseline; the honest
  floors already published (v1: 3→**8**/48, bridge: 9→**13**/48) stand or rise slightly. This doubles as the
  negative control: a checker that "finds" many state-grounded flags in bundles that lack the state fields is
  hallucinating structure and fails review.
- **P-C.** The axis-omission root-test from §1: the same Opus judge, re-asked with one atomic per-class
  question on the P-A false-PASS turns, flips **≥80%** to FAIL.
- **P-D (the payoff claim).** On the newest run the combined instrument moves the measured broken-turn count
  from 9/48 to **~14/48** — i.e. the Opus gate alone has been under-reporting the logic axis by roughly
  **one-third of the true broken count**. If P-A holds, Phase-0-style exit bars quoted from judge-only
  numbers were optimistic by that margin, which is precisely the dishonesty the seams doc named.

---

## §7 Phased build plan (PACKETS schema; smallest-shippable first)

**CG-P1 — the state-grounded checker over existing JSONLs** *(hot-file-free; parallel-safe; the whole value
is here)*
- **objective:** `scripts/coherence-gate.mjs` — Tier-D comparators (CG-1a/1b/1c, CG-2a/2c, CG-3a, CG-4,
  CG-5, CG-7, §0 token-scan) over gate JSONLs, emitting desync pointers (§4 shape) + a per-class/per-run
  markdown report. Reuses `coherence-audit.mjs`'s loader/session-walk verbatim; borrows the claim-regex
  doctrine (incl. FUTURE_MOTION-style guards) from `engine/harness/oracles.js` *by copy with a provenance
  comment* (no engine import — the script stays pure/hermetic like the auditor; unification is CG-P6's job).
- **allowed_files:** new `scripts/coherence-gate.mjs`; new tests (allocate via
  `scripts/next-test-number.sh U 3` — detector fixtures, real-JSONL regression lock, CLI end-to-end — the
  U336/U337/U338 pattern).
- **forbidden:** `engine/**`, `scripts/dm-playtest.mjs`, any LLM call, any network.
- **invariants:** pure read of JSONL; no RNG; no engine import; precision-over-recall (every check ships a
  false-positive guard note); severities derived in code.
- **test_plan:** synthetic fixtures per check (positive + negative/guard); exact-count regression lock on
  `gate-2026-07-03T11-45-…` and both 07-02 JSONLs; `node --test` green.
- **done_when:** runs over all four existing JSONLs; the report prints per-class flags + the honest floor;
  tests green.
- **rollback:** delete the script + tests (nothing else references them).

**CG-P2 — baseline + adjudicate the predictions** *(hot-file-free; no code beyond running P1)*
- **objective:** run CG-P1 over the four JSONLs; hand-review every flag (confirm/false-positive with the
  prose + canon side-by-side); score P-A/P-B/P-D from §6 explicitly (P-C needs ~5 judge calls — run it in
  the same sitting, it costs cents; record in `scripts/budget.mjs`); commit
  `docs/playtests/COHERENCE_GATE_BASELINE_<date>.md` in the shape of the existing baseline doc, including
  the labeled flag set (it becomes Tier S's calibration corpus).
- **allowed_files:** the new baseline doc; `docs/playtests/gate-modes.json` untouched; new
  `docs/playtests/coherence-modes.json`.
- **invariants:** report the falsified parts as falsified — the prediction is the point, not the vindication.
- **done_when:** baseline committed with confirmed/FP tally per class and the P-A/B/C/D scorecard.
- **rollback:** n/a (a report).

**CG-P3 — standing-gate integration** *(touches `scripts/dm-playtest.mjs` — coordinate with the gate lane;
not an engine hot file)*
- **objective:** `--coherence` runs both tiers (transcript auditor + CG state checks) over the just-written
  JSONL; report gains a "Coherence (state-grounded)" section + the honest-floor line beside the headline;
  CG modes accumulate in `coherence-modes.json` (namespaced; never into `gate-modes.json` — Chao1
  granularity).
- **allowed_files:** `scripts/dm-playtest.mjs` (the existing `--coherence` block only),
  `scripts/coherence-gate.mjs`, its tests (+ extend the U330-style dry-run structural test).
- **invariants:** default gate behavior byte-identical when the flag is absent; the flag stays additive
  (exit code unchanged — the honest floor *informs*, promotion to a hard gate is Tim's call after CG-P2's
  precision is proven).
- **done_when:** `--dry-run --coherence` exercises the full path for $0; a real run prints the floor.
- **rollback:** the flag reverts to the transcript-only auditor.

**CG-P4 — bundle enrichment: exits + clock** *(engine — `engine/ref/rubric.js`, shared with the live Ref;
SERIAL, small, read-only)*
- **objective:** extend `buildCanonGroundTruth` with (a) the current room's real exits/adjacent rooms (the
  topology view CG-2b needs to catch invented stairways at the source) and (b) clock/timeOfDay (CG-6).
  Read-only view over existing state — the ROM-3 precedent exactly: no mutation, no RNG, no worldHash
  exposure.
- **allowed_files:** `engine/ref/rubric.js`; `scripts/coherence-gate.mjs` (consume the new fields); tests.
- **forbidden:** `engine/state.js`, `WORLD_VERSION`, any mutation path, `playloop.js`.
- **invariants:** worldHash untouched (view-only — assert via existing determinism suite); bundle stays
  compact (the judge reads it too — token budget); old JSONLs without the fields still parse (checks
  degrade gracefully, proven by P-B's negative control).
- **test_plan:** unit test the view; grep gate tests for bundle-shape assumptions; `npm run check`.
- **done_when:** new fields in fresh JSONLs; CG-2b/CG-6 comparators activate on them; determinism green.
- **rollback:** revert the rubric view additions; comparators auto-dormant (fields absent).

**CG-P5 — Tier-S span extraction** *(hot-file-free; paid; opt-in; only after CG-P2 proves Tier D's
precision)*
- **objective:** `--extract` on `coherence-gate.mjs`: cross-family small-model transcription of presence/
  place spans (terse schema, no CoT, model never sees canon), comparison in code; calibrate
  paraphrase-invariance against CG-P2's labeled corpus; report Tier-D∪S delta.
- **allowed_files:** `scripts/coherence-gate.mjs`, tests (mock provider — hermetic), `docs/briefs/` calibration note.
- **invariants:** OFF by default; budget-gated (`scripts/budget.mjs` before/after); extractor output is a
  proposal — a span that fails canon lookup is a *disagreement report*, never a flag by itself; INT-2R
  schema-terseness lesson binds (re-benchmark after any prompt edit).
- **done_when:** measured recall gain over Tier D on the labeled corpus, with precision held ≥80%; cost per
  run documented. If recall gain is negligible — **retire the tier and say so**; deterministic-only is a
  fine end state (SOBRIETY: don't gold-plate the judge we specifically designed out).
- **rollback:** remove the flag.

**CG-P6 — unification + the meter** *(mostly hot-file-free)*
- **objective:** merge the transcript auditor (C1–C5) and the state checks into one instrument + one report;
  retire transcript detectors that the state-grounded version strictly supersedes (C1 → CG-1b where bundles
  carry rooms; keep the transcript form for pre-ROM-3 files and for words-vs-words seams like C5 that state
  can't see); extract ONE shared claim-lexicon module consumed by both this script and
  `engine/harness/oracles.js` (closing the copy from CG-P1); publish the standing **desync-rate meter** per
  class and wire the word "playable" to it in `docs/HARNESS_USAGE_STRATEGY.md`/`docs/PACKETS.md`.
- **allowed_files:** `scripts/coherence-gate.mjs`, `scripts/coherence-audit.mjs`,
  `engine/harness/oracles.js` (lexicon import only — coordinate with the harness lane), the two docs, tests.
- **invariants:** U336/U337 regression locks stay green or are consciously superseded with equal-or-better
  locks; oracle behavior in the live harness unchanged (lexicon extraction is a pure refactor, proven by its
  existing tests).
- **done_when:** one command, one report, one meter; duplicate detectors retired; both consumers on the
  shared lexicon.
- **rollback:** keep the two instruments separate (they work independently by construction).

**Parallelization:** CG-P1/P2/P5 are hot-file-free and worktree-parallel. CG-P3 touches the gate script
(coordinate, not hot). CG-P4 touches `engine/ref/rubric.js` (shared with the live Ref → serial lane).
CG-P6 last, touches the harness oracle bank cosmetically. Nothing touches `playloop.js`, `state.js`,
`escapeCombat.js`, RNG, CSL, or `WORLD_VERSION` at any phase. CG-3's full lock-state check stays **declared
blocked on the Interior Object Model** — when IOM lands object state in the bundle, the comparator is a
one-liner; do not build a pseudo-object-model inside the checker to fake it earlier.

**Deliberately not in this plan:** pushing these comparators into the live Ref path as a runtime pre-ship
check. It's the natural endgame (the desync pointer *is* a REGENERATE trigger), but it sits on the hot
narration path, costs latency, and is a taste/product call — queue it for Tim only after CG-P2 proves the
false-positive rate is boring.

---

## §8 What this instrument is blind to — kept honest

- It certifies **coherent, not good** (HARNESS_USAGE_STRATEGY's trap #2 restated). Flat prose that
  truthfully reports the world passes everything here. Taste stays human.
- Tier D's recall is bounded by its lexicons — the committed auditor's own caveat ("a lower bound, not a
  ceiling") carries over verbatim. The rate it reports can only understate. That is the correct failure
  direction for a gate.
- It cannot see incoherence whose ground truth the engine doesn't hold yet (object lock-state pre-IOM,
  time-of-day pre-CG-P4). Every such gap is named above with its unblocking dependency rather than papered
  over with a judge.
- CG-8 (non-answers) is *someone else's* instrument (v2 atoms) on purpose. If the v2 regime is ever retired,
  that class needs a new home — flag it then, not now.

---

## For Tim — plain English

We have two different questions and, until now, only one instrument. The Opus gate asks *"is this a good
DM?"* — and it's decent at that, but it grades like a generous teacher reading a beautifully written essay:
confident, fluent prose sails through even when it flatly contradicts the facts. In the last recorded run,
the game's own records said you were standing in the pantry while the DM told you it was the front room;
an NPC the world says wasn't in the room answered your question anyway; you asked the mysterious stranger
their name and the town guard answered as if you'd asked her — and the grader passed every one of those,
because "does the story match the world's actual records?" was never on its score sheet. The Coherence Gate
puts it on the sheet — and takes the grading away from anyone's judgment. Because this engine keeps
deterministic records of everything true in the world, and we already save those records beside every DM
line the testers see, a plain mechanical comparison — no AI, no opinion, essentially free — can catch "the
DM said X, the world's records say Y" every single time, not just when a grader happens to notice. The plan
builds that comparison first over the test transcripts we've already paid for (day one, zero new cost), then
bolts it onto every future test run so each one reports an *honest* broken-turn count. My testable
prediction: on the newest run it will catch about five broken turns the current grader waved through —
meaning roughly a third of the real breakage has been invisible. If it catches fewer than two, the design is
wrong and the baseline report will say so.
