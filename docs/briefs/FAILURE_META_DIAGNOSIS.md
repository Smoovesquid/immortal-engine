# Failure Meta-Diagnosis — the structural root-generators behind 47 gates

**Author:** Fable 5 (per `docs/briefs/FABLE-failure-meta-diagnosis.md`), 2026-07-02.
**Corpus:** all 49 `docs/playtests/opus-gate-*.md` reports (2026-06-15 → 2026-07-02), `docs/RUNG1_QUEUE.md`
(the H-1…H-90 verdict trail), `docs/CAPABILITY_LEDGER.md` (C1–C16 + gates 3–19 + THE_REF/W/D findings),
`docs/RUNG1_CONVERGENCE_PLAN.md`, `docs/THE_REF.md`, biblioteca V14/V15/V17. No new paid runs.

**Judge-bias discipline (V14):** every root below is grounded in (a) recurrence across many independent runs
and (b) `mech:`-line engine facts (deterministic routing tags: `[clarify:referent]`, `[dialogue enter]`,
`[roll:… → failure]`, `[combat:table-talk]`, `gen:s/m/f` template strings traced to source lines) — not the
Opus judge's class labels. Single-run VIBE taste calls are flagged as such and weighted low.

---

## 0. The headline

**One root generates the persistent failure family; it was correctly diagnosed 13 days ago and the diagnosis
was never shipped in its structural form.**

The 2026-06-19 Basecamp design review (RUNG1_QUEUE.md, "content-free hedge tail" verdict, lines ~1374–1457)
found: the hedges are *deterministic fallback templates* (`gen:s` @ `playloop.js:4979`, `gen:m` @ `:4980`,
"yours to call" @ `gracefulAdjudication.js:818`), the gate judge is sound, and the root is a **single
detector chokepoint tuned for precision when the cost structure demands recall** — every fix "has been
ADDING ALTERNATIONS to this allowlist — a recall problem treated as an enumeration problem." It prescribed:
*(i) flip the bias — any question-shaped input routes to deliver-or-decline; (ii) invert the fall-through
default — a question reaching a last-resort sink emits an honest voiced decline, never success-flavored
atmosphere.*

What actually shipped (H-39) was **another allowlist** (`INFO_SEEKING_TOPIC_RE`, verb-phrase-anchored, chosen
to avoid breaking `isExploreIntent`), and a safety net **keyed on the same detector** — the H-39 DONE note
itself concedes it is "belt-and-suspenders across OUTCOMES, NOT across detection-recall." Every subsequent
DEADEND fix is one more alternation on one more path: H-78 `PROVENANCE_RE`, H-84 `FOUNDING_RE`, H-85
`TENURE_RE`, H-89 `PRIOR_HOLDER_RE`, THE_REF-3 `WHY_ABSENT_RE`, U232 (name-one-other-family), U235
(presence), U237 (imperative info-request + "the old days"), DTD-A (`META_CAPABILITY` + npc-address). Each
zeroed its exact shapes (they held — the corpus proves it) and the class re-emerged on the next unpatched
path. That is ~25 packets spent on one root. The 07-02 re-gate is the cleanest demonstration: DTD-A/B killed
the meta-question and movement flavors, and the identical class re-emerged the same day on the **dialogue**
path (deflection / clarify-loop / info-roll-hedge).

**DM_TEST_DEADEND appears in every one of the 49 gate reports, 06-15 → 07-02.** No other class does.
CRASH, COMBAT_NOT_STARTED, coin-desync, invented-geography, CANON_HALLUCINATION each spiked and then
*dissolved* when their root was hit structurally. The non-answer family never dissolved because its root has
only ever been patched per-path.

---

## 1. Failure taxonomy — five root-generators

Every historical HARD failure in the corpus maps onto one of five roots (a handful are judge artifacts,
§1.6). Citations are gate-report + turn or queue/ledger entries; each root cites ≥3 independent runs.

### G1 — DIRECT QUESTION → NON-ANSWER (**STILL GENERATING** — the dominant root)

**Statement:** there is no enforced contract that a direct player question terminates in an answer or an
honest in-fiction decline. Detection of "this is a question needing an answer" is re-implemented per routing
path as precision-tuned allowlists; any miss falls into one of six **legal non-answer sinks**. Patching adds
detectors at the entrances; the sinks stay legal, so the failure relocates.

The six sinks, each an engine fact (deterministic template or tag, not LLM taste):

| Sink | Mechanism | Cited instances (sample of many) |
|---|---|---|
| **S1 roll-then-fog** | question reaches `resolve()` as a gradeable d20; failure licenses fog | 07-02 t-RL "is Gravedigger a class?" `[roll:3 vs DC:13 → failure]`; re-gate Lore "were you born here?" `[roll:1 → NAT1]` → hedge; postH37 Lore t8 `[roll:11 → mixed]` → "It lands, after a fashion" |
| **S2 atmosphere bank** | `gen:s/m/f` content-free templates (`playloop.js:4979–80`) on a resolved info-turn | postH35 cluster 1 (~6 turns); gate-4 C4 ×5 ("who carried me in" → "it goes your way"); gate-13 t5 `[roll:20 → success]` → "You see it through" |
| **S3 nav/survey bounce** | `buildLocationSurvey` answers a question with exits | 07-02 Lore "Who lit that lantern, Elske?" → "Ways lead off east and south"; gate-24 mirror dead-ends; postH42 Lore t1 travel-bounce |
| **S4 clarify/referent bounce** | `[clarify:referent]` on a resolvable or just-narrated referent | re-gate Newbie "who's it from? Is there a name at the bottom?" → `[clarify:referent]` loop; THE_REF-2 "That's no answer, Corwin" → "no one named That"; gate-11 "Enough about Corwin" → "no one named Enough" |
| **S5 dialogue-enter / deflect-and-wait** | `[dialogue enter]` swallows the question; NPC "turns and waits" | re-gate Newbie "Who are you, though? Do you live here?" → Elske turns, waits; gate-17 #2 RL "what's your name, and which old dispute…?" → "turns and waits" (**design-locked as C16-001**); gate-19 Lore "how long have you been here?" → `[dialogue ask | continuity]` atmosphere dodge |
| **S6 compound partial-answer** | multi-part ask answers one slot, drops the rest | postH52/53 "name, class, HP" dropped HP; gates 17/18/19 compound-precedence class (deferred ×5 as DESIGN); C1 lineage H-25/31/40/54/59/83 |

**Why it keeps regenerating:** the fix history is a random walk over the entrances. Grace meta-detectors
(H-25/31/35/40…), info-seek REs (H-39/78/84/85/89…), playloop floors (U235/237), movement (DTD-B), dialogue
(N-4, partially) — each is a real fix for its path, and each leaves the *other* paths' misses falling into
the same sinks. The convergence plan §3 named the cure (one typed interpreter, finite act-set) and was only
executed as per-family partial graduations; THE_REF named the same cure for the narration channel (verdict
enum incl. honest-decline) and its soft-source set doesn't cover S3/S4/S5.

**Judge-bias check:** S1–S5 instances carry deterministic mech tags and the template strings are traced to
source lines (RUNG1_QUEUE 06-19 review step 2) — these are engine facts. The 06-19 review also confirmed the
judge rubric is *not* the defect (a confident in-voice reframe would pass) — we have not been chasing judge
taste.

### G2 — NARRATION EXCEEDS STATE / fabrication (**DISSOLVED at the fact level; words-tail remains**)

Lineage: CANON_HALLUCINATION ("Corvin Ashe"/"1347" postH28; invented gear 07-02; kin/tenure inventions
gates 5–11) + narration>mechanics (H-28 R1–R4, kill-over-flee U245). Three structural moves dissolved it:
- **H-29's deliver-or-decline** — and the H-29 root-cause is a lesson in itself: the "hallucinations" were a
  *deterministic bug* (a static proper-noun pool minted on info-success), not LLM confabulation.
- **EK-1** killed the one prompt line licensing invention (`llmAdapter.js:151`), backed by the
  `findInvented*` validator family.
- **World-wiring (W-1…W-6, P-1/P-2)** gave the narrator true facts — the 06-22 insight that empty-success
  and invention are *the same seam* (nothing true to say).

Evidence of dissolution: gate-13 lore-hound drilled invention bait → 0 invented facts; Phase-A/B gates
§0-clean, RAG-clean; 07-02 CANON_HALLUCINATION ×1 (ungrounded gear answer) → DTD-A grounded it → re-gate
**0**. What remains is the **words tail**: DM_ARTIFACT_LEAK (raw `location:…` leak postH37; the modifier
table dumped in answer to a roll-reconciliation demand, re-gate RL; "You manage the back, and it goes your
way" 07-02 Chaos) — right-state-wrong-words, THE_REF territory (§5b).

### G3 — DECLARED ACTION ↔ COMBAT RESOLVER MISMATCH (**MOSTLY DISSOLVED; same disease as G1 on the action side**)

Lineage: H-30/32/43/48/55/64/71/72/92/93/94/95. The generator is structurally identical to G1: an
*enumerated-verb allowlist* decides whether a declared action reaches `resolveEscapeCombatTurn`; misses fall
into the silent sink `[combat:table-talk]`. Each verb-add held (Chaos-griefer ran fully clean in the
postH43/44, gate-10, gate-12-post runs), and new flavors keep arriving at ~1/gate: `stamp` (gate-12),
bystander-throw (H-95), and the 07-02 re-gate's **barrel-through escape action left as table-talk**
(`[combat:table-talk]`, mech-confirmed). Judge-bias caveat applies here more than anywhere: H-93/H-93a and
the Tier-3 flee-vs-kill work *disproved several judged combat fails as measurement artifacts* (defeat
registration, hazard damage, morale-flee) — weight combat tags only when the mech line shows the swallow.

### G4 — HOLLOW WORLD: no grounded fact where the fiction needs one (**DISSOLVED where wired; generating at the unwired edge**)

The W-track wired place founding/events/population/overview/concern and person identity/location. Every
wired slot's failure class went to zero and stayed (gate-13, Phase-A/B gates). The generating edge is
exactly where data doesn't exist yet: **NPC personal history** — the re-gate's "were you born here, Elske?"
has no grounded bio fact, so it fell to S1 (rolled, NAT1, hedged). Deliver-or-decline is only half a fix
when canon is empty on a question every player asks a tavern-keeper; the demo needs a thin NPC-bio substrate
(same pattern as `placeQuery` → `personQuery`).

### G5 — TWO-LAYER GEOGRAPHY / interior object model (**DISSOLVED**)

The DM narrated rooms/stairs/objects the topology lacked (WHOLE_BUILDING findings, WB-Q1/Q3/Q5/Q9; memory:
"DM invents geography = the root interior-incoherence bug"). Fixed structurally, not per-shape: room-scoped
objects (WB-Q5 foundational), IOM-P2 (DM prompt learns the real room), IOM-P3 (dialogue voice stops
inventing space), IOM-P4/P5. 07-02 gate: "the interior object-model cluster HELD — no invented geography,
chest/jar/letter + 'go outside' all resolved"; re-gate: held again. **This is the model case: a shared
authoritative state consumed by every sink dissolved a whole family in one refactor.**

### 1.6 Judge artifacts (excluded from the taxonomy, per V14)

~13 of gate-2's 18 were judge false-positives (roll-recall, fixed by reference-guided judging `6e39d5c`);
the "SIX ability scores" fail (Phase-A gate) assumed D&D's six vs the engine's five; H-93 disproved two
combat tags; gate-REF A/B were narration-emphasis not missed deductions. The instrument is now
reference-guided and trustworthy as a *pointer*, but Opus×Opus self-preference stands unhardened
(cross-family re-judge remains the deferred mitigation).

---

## 2. The deeper pattern — three root behaviors

**R1 — The contract is enforced on only one side.** The engine structurally enforces *"never say a
falsehood"* (validator rules, EK-1, invariants) but has never structurally enforced *"always resolve the
intent."* Falsehood-prevention is implemented as postconditions at the sinks (validate-then-fallback);
intent-resolution is implemented as preconditions at the entrances (detector allowlists). Postconditions
dissolve families (G2 died); preconditions relocate them (G1 lives). The DTD-B lesson ("unified three
drifted meta-prechecks behind one predicate") generalizes: **the whole G1 family needs one postcondition at
the sinks, not a thirtieth detector at the entrances.**

**R2 — Detection is distributed per routing path.** Meta, grace info-seek, dialogue, clarify, playloop
floors, and combat each independently re-decide "is this a question / an attack / addressed to whom." A fix
on one path cannot help the others by construction — this is why DTD-A's meta fix and the same-day dialogue
deflection coexist. The convergence plan already named this (typed PragmaticPacket, Vol 7 "interpret richly,
commit narrowly") and it was only partially executed.

**R3 — Rolling is the default epistemology for the unrecognized.** An input that escapes classification is
handed to `resolve()` as a gradeable d20, and a failed roll then *licenses* a non-answer ("the knowledge
stays just out of reach"). A real DM never rolls to decide whether to answer "is Gravedigger a class?" or
"were you born here?" — the first is table-talk, the second is the NPC's choice. Dice-as-fallback converts
every detector miss into a 45–55% chance of a licensed dead-end (and pre-roll suppression is keyed on the
same allowlists, so it misses in lockstep).

The brief's hypothesis is **confirmed with one amendment**: the DM_TEST_DEADEND instances are ONE root at
the level of *missing contract* (R1) — but the reason patching relocates rather than shrinks it is the
*distributed detection* (R2), and the reason misses become player-visible dead-ends rather than harmless
blandness is *roll-as-default* (R3). All three must be hit; hitting only R2 (full typed-packet migration) is
the expensive path, hitting R1+R3 first is the cheap structural path.

---

## 3. Falsifiable predictions

If the next gate runs with no structural change (only per-instance patches of the re-gate's three repros):

- **P1:** DM_TEST_DEADEND recurs at 2–5/48, ≥2 flavors NOT among the three patched repros, landing on
  currently-unpatched paths. Most likely shapes: (a) an NPC-directed personal-history/opinion question
  *inside* active dialogue → deflect/atmosphere (`[dialogue ask | …]`); (b) a compound question dropping a
  part (the deferred gates-17/18/19 DESIGN class); (c) an imperative-form info demand ("name me…", "walk me
  through…") reaching S1/S2; (d) a follow-up referent resolvable from the previous DM line bouncing S4.
- **P2:** ≥1 of the failures will carry a mech line showing S1 (a d20 rolled on a question), because
  pre-roll suppression is still allowlist-keyed.
- **P3:** CANON_HALLUCINATION stays 0 on wired domains (place/person-identity/gear/roster). Any fabrication
  that appears is lowercase/attributive (the THE_REF validator's known blind spot), not a proper noun.
- **P4:** Combat CRUNCH ≈ 0–1/48, and if present it is a table-talk swallow of a compound/novel-verb
  declared action, not a state-math error.
- **P5 (the positive test):** if AG-1 (§4) ships instead, DM_TEST_DEADEND ≤1/48 and the residual instance,
  if any, is judged on decline *quality* (VIBE-soft wording) rather than a non-answer — i.e. the class moves
  from (a)-structural to (b)-narration, where THE_REF owns it.

P1–P4 are checkable from the next gate's per-turn mech lines alone; no judge trust required.

---

## 4. Structural fixes — ranked, bounded packets

Ordered by families-dissolved per unit risk. Each is one worker session, LLM-off reproducible, corpus-locked.

### AG-1 — the Answerability Gate (THE packet; grace+playloop, Sonnet with a Codex consult; ~1 session)
The R1 fix: one exported classifier + one postcondition, enforced at the **sinks**.
- **Classifier** (`engine/grace/answerability.js`, new): `directQuestionIntent(text, world)` → null | a
  typed `{kind: rules|self|npc-addressed|place|object|referent-followup, addressee, parts[]}`. Built on
  `isQuestionShaped` + npc-address + imperative-info forms ("name/tell/show/walk me") + action-verb
  exclusion (the exclusion list already exists in `isExploreIntent`/H-39). Recall-biased by design: a false
  positive costs a graceful in-voice line, a false negative costs a HARD dead-end (the 06-19 cost-asymmetry
  finding, verbatim).
- **Postcondition at the sinks:** in `genericGroundedOutcome`'s gen-bank, the `buildLocationSurvey` return
  sites, the `[clarify:referent]` emitter, and the dialogue-enter branch: if `directQuestionIntent` is
  non-null and the pending output is a non-answer sink, replace it with the deliver-or-decline machinery
  that already exists (`answerOrDeclineQuestion` / `declineInfoSeek` / `confrontationReaction` /
  personQuery/placeQuery lookups). No new answer content is invented — the gate only reroutes to the
  existing grounded answer/decline paths.
- **Pre-roll rule (R3):** a `directQuestionIntent` turn never reaches `resolve()` as a gradeable check
  unless it embeds a declared perception/social ACTION. Kills S1 outright.
- **Done-when:** the three re-gate repros pass LLM-off; a 15-case paraphrase corpus (one per sink × phrasing
  family) locks; all existing corpus 100%; diverge guards prove actions/exploration still roll.
- This is DTD-B's unified-predicate lesson at family scale, and it is literally the 06-19 verdict (i)+(ii)
  finally shipped structurally.

### DLG-1 — dialogue answers or declines in voice (dialogue.js, Sonnet; ~1 session; AG-1's dialogue half)
"Who are you? Do you live here?" must answer from the roster (personQuery `identity` already holds
name+role; residence is derivable from the settlement roster) or decline in voice — never enter-and-wait.
**Requires a design call from Tim first:** gate-17 #2 was *deliberately locked* as C16-001
(identity questions ENTER dialogue by design; answering on entry broke convergence 105→104). The corpus has
locked the losing side of THE_DM_TEST here — the re-gate failed the exact behavior the corpus protects.
Recommendation: relock C16-001 as "enter dialogue AND the NPC's first line answers the question." Flag,
don't silently flip.

### NBIO-1 — thin NPC-bio substrate (world lane, Sonnet; ~1 session; the G4 edge)
`personQuery` gains `origin`/`tenure` slots fed by a deterministic per-NPC bio seed (born-here y/n, arrived
band, one why-here line) — same pattern as node founding facts (substrate → resolver → both voices,
§0-safe). Turns the "were you born here?" class from decline-hedge into deliver. Without this, AG-1 makes
that turn an *honest* decline — acceptable, but a real DM's Elske simply answers.

### CMB-SINK-1 — kill the combat silent sink (Codex, escapeCombat/playloop; ~1 session; G3's AG-1)
In active combat, a declared physical action naming a foe/exit/hazard that fails every recognizer must not
terminate `[combat:table-talk]`: route to the improvised-strike default or an explicitly contested movement
beat (the re-gate barrel-through case). Same shape as AG-1: fix the sink's default, stop enumerating verbs.

### REF-QC-1 — the words tail (THE_REF, deferred until after AG-1's gate)
The (b)-class residue: artifact-leak answers (modifier-table dumped on a reconciliation demand), template
non-sequiturs ("You manage the back"). Widen the soft-source set + per-criterion V17 rubric calls. Do NOT
spend this before AG-1 — most of what currently looks like words-quality is S1–S5 structural and will
vanish upstream.

---

## 5. The Road-A vs THE_REF split (the explicit call)

**(a) Structural / deterministic — Road-A refactor territory (the majority):** all six G1 sinks. The proof
is in the corpus itself: every quoted hedge/bounce is a deterministic template or routing tag reproduced
LLM-off (RUNG1_QUEUE 06-19 review traced each string to its source line; the re-gate's three DTDs carry
`[clarify:referent]` / `[dialogue enter]` / `[roll:1]` mech tags). G3's table-talk sink likewise. **No
prompt-craft or second-model judge can fix these — the LLM never receives a fact to deliver** (the 06-19
review's exact conclusion, still true).

**(b) Narration-quality / irreducible — THE_REF + prompt-craft (the small tail):** DM_ARTIFACT_LEAK
(table-dump-as-answer, re-gate RL — right numbers, wrong register), template non-sequiturs on otherwise
correct mechanics ("You manage the back…", 07-02 Chaos), lowercase attributive fabrication (gate-16 #5
"three nights / Corwin vouched"), narration-emphasis on hazards/defeat (gate-12 A/B). Roughly 1–2 turns per
recent gate. THE_REF Tier-1/2 + V17 rubric own these; they are the *only* class where the engine computed
right and the words failed.

Current best split of the 07-02 re-gate's 5: **4 structural** (3 × G1-S4/S5/S1 + 1 × G3 table-talk),
**1 narration** (the artifact-leak table dump).

---

## 6. What to dispatch first

**AG-1.** It dissolves the only class with a 49-gate unbroken record, it reuses existing answer machinery
(low invention risk), it is LLM-off testable end-to-end, and P5 gives it a clean falsifiable exit criterion
at the next gate. DLG-1 rides second (needs Tim's C16-001 relock decision). NBIO-1 and CMB-SINK-1 are
independent lanes and can run parallel to AG-1 (world / escapeCombat files are disjoint from grace); REF-QC
waits for the post-AG-1 gate to measure what's actually left of the words tail.
