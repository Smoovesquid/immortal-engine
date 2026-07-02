# Rung 1 — Live Queue (Basecamp hand-off state)

**To resume as Basecamp, read this + `AGENT_PROTOCOL.md` + `AGENT_CHANGELOG.md`.**

## Mission
Rung 1 of the realization ladder — *"I can do anything here, and it fits the math."* The DM resolves
any plain-English intent in the fiction while the deterministic 5e-lite mechanics stay correct.
**Done-when bar:** zero HARD failures *from real engine/narration defects* across the multi-seed Opus
gate, Rules-Lawyer persona clean, only rare forgivable SOFT slips. HARD-count bounces run-to-run
(gate agents explore freely) — judge by **bug nature** (real-defect vs phrasing-tail), not one run's
number.

## Your role
Single **queue owner + Rung-1 arbiter** (Tim's mandate). Write paste-ready worker prompts, assign each
worker's model, sequence packets **one in flight at a time** (unless provably file-disjoint, protocol
§2), ingest results Tim pastes back, and declare Rung 1 done only at the bar above. Tim relays prompts
to workers and results back — he does **not** modify prompts, so each must be complete + paste-ready.
Handle doc/process micro-decisions yourself; surface only forks that need Tim's call.
- **Codex** = deep-engine worker backend (combat routing, dice/state mechanics). Its environment
  cannot push to this repo (protocol §7) — its prompts should say so explicitly.
- **Claude-Sonnet** = routing/grace worker (intent gates, meta/grace layer). Pushes its own commits.
- **Your model:** start Sonnet (sequencing is mechanical); escalate to Opus only for a genuinely new
  strategic fork — the Road-A-vs-B call is resolved (see "Open strategic question" below), not for
  prompt-writing, result ingestion, or routine gate-judging.

## LATEST GATE — 2026-07-02 (post IOM-P1..P5, v0.20.3) — `docs/playtests/opus-gate-2026-07-02.md`
**6/48 (13%) · all VIBE-axis · CRUNCH clean (0/48).** The interior object-model cluster HELD — no invented
geography, and the chest/jar/letter sequence + "go outside" all resolved. Judge by bug-nature not the number
(persona-variance; prior comparable gate-11 was 12/48): the mechanics floor is solid; every remaining fail is
the DM's *words / intent-resolution*, i.e. the narration+grace frontier, not a new regression.
- **DM_TEST_DEADEND (4) — DOMINANT → next packet.** The DM bounces player intent instead of resolving it: a
  rules/meta question got ROLLED (a d20 on "is Gravedigger a class with abilities?"); an in-fiction question
  ("who lit the lantern?") got a navigation prompt; "can I go outside?" re-described the room. → grace
  meta-question binding + movement-intent routing (Road A, deterministic).
- **CANON_HALLUCINATION (1).** "what's my name/class/HP/gear?" → DM invented gear (Mirror shard/staff/blade/helm)
  absent from the bundle (canon = 2 Holy water). → feed real inventory/HP into the character-sheet answer
  (a P2-style grounding packet).
- **DM_ARTIFACT_LEAK (1).** "breathe in smoke on purpose" → "You manage the back, and it goes your way"
  (template nonsense ignoring the scene). → THE_REF narration-validator territory.

### RE-GATE 2026-07-02 (post DTD-A/B, v0.20.4) — `opus-gate-2026-07-02-regate-postDTD.md` — **5/48; class did NOT collapse → META-DIAGNOSIS commissioned**
The DTD fixes held on their exact targets: **CANON_HALLUCINATION → 0** (gear grounded in real inventory), and the
rules-question-rolled + movement-ignored repros are gone. **But DM_TEST_DEADEND persisted (4→3) in a NEW flavor** —
NPC dialogue *deflection*: "who are you? do you live here?" → NPC turns and waits (no answer); "who's it from?" →
`[clarify:referent]` loop; "were you born here?" → a WITS info-roll NAT1 → hedge. Same class, different routing
path (meta → dialogue/info-seek/clarify). New **CRUNCH_INCONSISTENCY** (a barrel-through combat action left as
table-talk, unresolved). 6→5. **Per the mission's "judge by bug-nature": DM_TEST_DEADEND is a persistent FAMILY,
not a shrinking count — the treadmill signal.** → Commissioned a **Fable whole-corpus meta-diagnosis**
(`docs/briefs/FABLE-failure-meta-diagnosis.md`): find the structural root-generators behind the 47-gate history,
predict remaining classes, propose family-dissolving structural fixes, split residual Road-A-structural vs THE_REF.

## Don't trust a stale snapshot — verify current state yourself
This doc is hand-edited after every batch, but it is still a snapshot. **Before acting on anything
below, confirm it against reality:** `git log --oneline -10` for the real HEAD/ahead-behind state,
`node --test` for the real suite count, `git status -sb` for uncommitted/untracked files. If anything
here disagrees with what you just measured, trust the measurement — and fix this doc to match while
you're there. (This is not hypothetical: an earlier hand-off in this doc described H-31/H-32 as not
yet dispatched when they were already committed and pushed — the snapshot had gone stale between
edits. Re-deriving from git/`node --test` costs one tool call and avoids redoing already-done work.)

## Gate-running checklist (every `scripts/dm-playtest.mjs` run)
- **Restart the dev server first, every time — don't assume it's current.** `npm run dev` runs
  `node --watch server.js`, which only picks up changes made *after* it started watching. The gate
  hits it over HTTP for narration. A server that predates the latest landed commit will silently grade
  stale code. Check `ps -o lstart -p <pid>` (find the pid via `lsof -i :5179`) against the latest
  commit's timestamp; restart if the server is older. This has bitten two runs in a row — check it
  every single time, not just once.
- **Rename the report immediately after the run finishes.** It always writes to
  `docs/playtests/opus-gate-<UTC-date>.md` — the next run on the same UTC day will silently overwrite
  it. Rename to something like `-postH35.md` before doing anything else.
- **Judge the result by bug nature, not the headline %.** The gate explores freely each run, so the %
  bounces — a higher number after a real fix often just means fresh territory got probed, not a
  regression. Check first whether the specific shapes a batch targeted actually recur in this run's
  transcript; if they don't, the fix held regardless of where the headline number moved.

## Session-boundary signal
Tell Tim explicitly, in plain words, whenever this doc's "In flight" section reads "(none)" — a batch
fully verified, pushed, gated, and logged, nothing pending: *"Queue is clear — good point to start a
new session."* That's the cue for a fresh session rather than `/compact`. Basecamp's durable state
lives in this file + `AGENT_CHANGELOG.md` by design, so a cold session loses little by restarting here
— a fresh session should be able to read this doc + `AGENT_PROTOCOL.md` + `AGENT_CHANGELOG.md` and land
in the same place. If it can't, that's a sign these docs need fixing, not a reason to avoid restarting.

## Done (23/23 HARD cataloged — classifier/dialogue layer complete; H-11 has an open sub-decision)
Codex engine layer (`98b5059`..`056e249`): H-1 scene-object misroute, H-2 grapple state, H-3/4/5
natural-strike routing, H-6 neck-snap **classification only** (mechanic deferred by design).
Claude layer (`8c359ad`..`da615f3`): H-2/3/4/5/6 narration-inversion guard, H-20 shove-past, H-21
torch. Suite 7854/0.
Claude Sonnet worker (`dcbd79c`): H-7/H-8 object-mediated assault + phantom victory. Suite 7858/0.
Claude Sonnet worker (`b0d7105`): H-14/15/16 dead-end/UI-bleed; H-17/18 stat-synonym+HP. Suite 7884/0.
Claude Sonnet worker (`7c11f3e`, `37d1778`): H-19 check denial; H-12/13 roll contradiction. Suite 7909/0.
Claude Sonnet worker (`77721ff`): H-22/23 roll-to-fiction gap — successful info-roll now delivers a
concrete fact, not atmosphere only. Suite 7920/0.
Claude Sonnet worker (`fe3d702`): H-9 continuity-deflection — contradiction-challenge interceptor
resolves from last dialogue answer or admits uncertainty, never `mode=deflected`. Suite 7923/0.
Claude Sonnet worker (`5fb2da5`): H-10 mixed-roll wrong narration type — narrow conversational-
pressure detector routes social beats correctly, no more "wood splinters" on a social turn. Suite
7931/0.
Claude Sonnet worker (`bdb3287`): H-11 classifier half — selection "pick" no longer misclassified
as lock-picking; bare "gate" no longer triggers a lock action. Suite 7939/0. **llmAdapter
narration-validation hardening (the second half) deliberately NOT started — see below.**

All verified independently by Basecamp post-hoc: `git log` confirms all 6 commits pushed to
`v2-polish`; full suite reran clean at 7939/0; determinism gates U19/21/22/27/30 reran green.
(Separately: an "API Error: 529 Overloaded" Tim hit was Anthropic-side transient overload, unrelated
to this work — not a repo bug.)

Claude Sonnet worker (`a1c62e3`): H-24 CRASH — mid-combat reinforcement reused a live enemy id after
a fled-foe prune dropped array length below the highest live id; now derives next id from max
existing numeric suffix. Suite 7943/0.
Claude Sonnet worker (`26ec812`): H-25 DM_TEST_DEADEND — three grace-layer interceptors (skill-mod,
attack-mod, bare-DC) answer "what's my own number" queries before narration, never deflect into
atmosphere. Suite 7947/0.
Claude Sonnet worker (`334053c`): H-26(c) CRUNCH_INCONSISTENCY — wrong-stat roll (CHARM instead of
requested WITS) fixed via preposition-gated imperative patterns; H-26(b) already closed by H-25's
attack-mod interceptor, regression-guarded. Suite 7951/0.
All verified independently by Basecamp post-hoc: 3 commits confirmed pushed; full suite reran clean
at 7951/0; determinism gates U19/21/22/27/30 reran green; H-24 fix diff reviewed (correct, minimal,
derives id from max numeric suffix rather than array length — doesn't touch the invariant).

Claude Sonnet worker (`0cde26b`): **H-28** — bundled `engine/llmAdapter.js` narration-validation pass,
4 rules in one contract: R1 (H-11 2nd half) reject polish planting the player inside a different real
map node; R2 (H-26a) reject a fresh attack/defeat exchange against an already-reconciled defeated
enemy; R3 (H-26d) reject a mixed-roll (margin-0) outcome smoothed into a clean win — threaded via new
`ctx.rollOutcome` field in `narratorContext.js`; R4a/R4b (H-27) reject invented kinship/attribution
claims absent from grounded narration, and reject a defeated NPC narrated as alive. Each rule falls
back to the always-grounded base narration on violation, same shape as the existing contract. New
`tests/U184.narrationGroundTruth.test.js` (21 cases, catch + false-positive guard per rule). Suite
7972/0 (+21).

All verified independently by Basecamp post-hoc: commits `f5492af`/`0cde26b`/`a068756` confirmed
pushed; full suite reran clean at 7972/0; determinism gates U19/21/22/27/30 reran green (9/9 incl.
sub-cases); diff reviewed (`engine/ai/narratorContext.js` 3-line `rollOutcome` passthrough,
`engine/llmAdapter.js` +158 lines for the 4 rules) — minimal, no `composer.js` touch, no
`WORLD_VERSION` bump; confirmed `outcome: 'mixed'` is live-set in `playloop.js`/`grapple.js`/
`escapeCombat.js` so R3's wiring isn't speculative.

**This closes the entire cataloged hard tail — H-1 through H-28, all 28 IDs landed.**

## Post-H-28 batch (2026-06-19 gate cluster) — DONE
Claude Sonnet worker (`098530e`): **H-29** — deliver-or-decline contract for info-seeking outcomes.
Root cause was sharper than predicted: the old H-22/23 `infoExtractionOutcome` minted a deterministic
but UNGROUNDED proper noun from a static pool on every info-success — the literal source of the
"Corvin Ashe"/"1347" hallucinations (NOT free LLM confabulation; a deterministic bug, which is *more*
Road-A-tractable, confirming the hybrid call). Now looks up a real grounded fact (NPC common-knowledge
→ knowledge-graph → ledger) and states it, else gives an explicit in-fiction decline that escalates
under repeated pressure (press-count derived from the timeline — no persisted field, no WORLD_VERSION
bump). Broadened detection in a shared `isInfoSeekingText` (gracefulAdjudication.js); `ctx.infoSeeking`
plumbed via narratorContext.js; validator Rule 5 + `findInventedFactClaim` in llmAdapter.js reject
atmosphere-only / invented bare year/duration. Rewrote U184.rollToFiction (old assertions literally
required the hallucination) + new U190.deliverOrDecline (18 cases). 8 gate turns, LLM-off base: 7/8
decline honestly, 1 delivers the real grounded name, 0 hit the atmosphere bank.
Codex worker (`298e16f`): **H-30** — improvised in-combat actions. Object attacks (smash lantern, kick
burning oil) now resolve as real strikes through escapeCombat.js (new `improvisedStrikeProfile`,
guarded so `'strike'` isn't hijacked to grapple), apply HP via the existing resolution path, and the
fallback round tag uses the canonical post-turn round. New U191. Lantern: `[combat:table-talk]` →
`[strike … → hit | 3 dmg]`, HP 30→27, round 4→5. Oil: → `[cantrip:Fire Bolt … | 6 fire]`, HP 30→24.
`playtest:quick` green (50 runs, 0 crashes).

All verified independently by Basecamp post-hoc: both commits present on `v2-polish` (ahead of origin
by 2); full `node --test` reran clean at **7994/0** (898 suites, 17.2s); determinism gates
U19/21/22/27/30 green within the suite; no WORLD_VERSION bump; no Math.random/Date.now added; the
U184 rewrite is STRONGER not weaker (asserts the new contract + a "must not invent" guard — invariant
#19 satisfied); escapeCombat change adds no direct state writes (shapes the weapon profile; HP
mutation stays on the existing path). **NOT YET PUSHED** — Codex's safety layer blocked publishing
(branch ahead by 2); commits are local + verified.

## Post-H-29/H-30 batch (2026-06-19) — DONE
Claude Sonnet worker (`d4719ed`): **H-31** — ground-from-canon (grace lane). R1 closes the other half
of H-29's join: an ungrounded info-ask no longer rolls a gradeable success/mixed at all —
`isUngroundedInfoCheck` decides groundedness PRE-ROLL via the same lookup `infoExtractionOutcome` uses,
so a correct decline can never again contradict its own dice line (`[roll:18 → success]` next to "I
don't know" is now structurally impossible, not just narration-patched). R2 adds `META_ARMOR_VALUE` +
`META_HELD_ITEMS` meta-query interceptors (own AC / own held items answered straight from the sheet, no
roll). R3 adds canon-contradiction correction: asserting a possession not in inventory ("you said I had
a staff") now gets corrected in-fiction from real gear instead of evasive re-listing.
`findBogusPossessionClaim` checks per-noun against real inventory so a true restatement never
false-trips. R4 extends `findInventedFactClaim` to confident age phrases ("well past seventy") absent
from the grounded base. New `tests/U192.groundFromCanon.test.js` (15 cases, catch + false-positive
guard per rule). Pushed to `origin/v2-polish`.
Codex worker (`684b4c6`): **H-32** — combat-initiation reconciliation (combat lane). A declared attack
embedded in a longer compound utterance ("Corwin swings his satchel at me. What's my Armor?") no longer
gets swallowed whole by the meta-question handler — a new `declaredNpcViolence` gate checks for
assault/attack intent first and lets real combat-initiation run instead of returning a bare inventory
answer. Grapple-kill phrasing ("grab his throat, slam his head into the windowsill") now resolves
through the existing improvised-strike profile (windowsill/sill folded into the Fixture vocabulary)
instead of `[combat:table-talk]` with a freebie narrated kill. Separately fixed the victory-line bug:
the killing blow's real `actionMech` (damage line) was being unconditionally discarded and replaced
with bare `[combat:victory]` — the ward branches now set `actionMech` like every other action branch
already did, so the victory line preserves whatever real strike caused it. New
`tests/U193.combatInitiationReconciliation.test.js` (5 cases, including a regression guard that a true
non-action in active combat still reads as table-talk). **NOT YET PUSHED** — `git push` failed on this
machine's git/`gh` credentials (invalid token); commit is local-only.

All verified independently by Basecamp post-hoc: `git log`/`git rev-list` confirm `origin/v2-polish` is
exactly at H-31 (`d4719ed`) and local is ahead by exactly 1 commit (H-32 `684b4c6`) — reconciles both
workers' self-reports with no surprises. Full `node --test` reran clean at **8014/0** (898 suites,
~17s — exactly 7994 baseline + 15 (U192) + 5 (U193)). Determinism gates U19/21/22/27/30 reran green
(6/6). No `WORLD_VERSION` bump; no `Math.random`/`Date.now` added (grepped both commits' full diffs).
Both new test files (U192, U193) are net-new — neither commit rewrote an existing test, so invariant
#19 doesn't apply this round. Diff review: H-31's `'no-info'` outcome sentinel is read-safe everywhere
(`result.outcome === 'success'` equality checks elsewhere just evaluate false for it, never an
exhaustive switch) and its `time` delta still routes through the real `applyDeltas` op vocabulary; H-32's
new `detectAttackAnyIntent` branch pushes the full text as a ref but still requires `fuzzyMatchNpc` to
resolve a real present NPC before anything fires, so it can't start combat against nothing.
**Process gap (not a code defect):** neither worker posted a `[CLAIMED]`/DONE entry to
`AGENT_CHANGELOG.md` per protocol §3 — Basecamp backfilled both entries post-hoc from the commits +
self-reports.

## In flight — (none). **PIVOTED to the convergence framework (2026-06-20)** — live status now lives in `docs/RUNG1_CONVERGENCE_PLAN.md` + `docs/CAPABILITY_LEDGER.md`, NOT here.
All 14 capability corpora built (**32 locked / 37 target**, free deterministic harness `npm run convergence`); C2 partially graduated (`0f1fccc`); first gate under the framework = **10/48**, discovery signal = **7/10 map to known capabilities + 1 new (C15 active-combat-in-narration)** → finite/closeable confirmed. Supervised next: typed-packet graduation (C2 observe-routing + C15). The per-packet H-loop is superseded by the capability ledger; prior history (H-47…H-56) retained below.
Last per-packet gate: post-H-54/H-55 = **10/48** (`docs/playtests/opus-gate-2026-06-20-postH54-H55.md`).
- **H-52** (`8c0a5cf`, §7-verified + pushed) closed both Lore-hound RAG fails (decades-unit tenure invention +
  grounded-name/wrong-role "Corwin is the elder" claim).
- **H-53 + H-53b** (`159c754`/`7153d2e`, §7-verified + pushed `62c0db0`) closed the Rules-Lawyer
  CRUNCH_INCONSISTENCY: an out-of-combat weapon-strike at a named scene prop ("swing at the bread basket")
  now narrates a real object-strike instead of the generic `gen:s` "the way ahead opens." **H-53b was a
  Basecamp-caught fix-forward** — H-53's first cut over-fired on movement/people idioms ("cut through the crowd"
  → "it breaks under the strike"); added a non-strikable-target denylist (places/crowd, final-token match).
  Held the H-53 push until H-53b landed; pushed as one clean stack. The other RL turn that run (the "15 vs 12
  / 14 vs 13, what did I actually roll?" turn) was judge-scored low/acceptable — NOT a defect, deliberately
  not packeted.
- **GATED post-H-52/H-53 (`docs/playtests/opus-gate-2026-06-20-postH52-H53.md`): 11/48, both fixes CONFIRMED
  effective by nature** — H-52's class (CANON_HALLUCINATION) and H-53's class (CRUNCH_INCONSISTENCY from object
  strikes) both went to **ZERO**; **Lore-hound 0/12 spotless** (H-52's persona). The 4→11 rise is fresh
  territory, not regression (verdict below). **New dominant cluster = compound/meta-query partial-answer +
  rules-confirmation-as-action (grace, RL+Chaos).** Candidates: **H-54** (grace) compound meta-query +
  rules-confirmation + declared-check adjudication; **H-55** (Codex) declared lethal attack on a non-combat
  civilian NPC must start combat (1 high). Plus a travel-gate-on-present-NPC residual ("go talk to Kael" bounced
  to travel). NONE dispatched — Tim's call.

## Gate run 2026-06-20 (post-H-52/H-53) — `docs/playtests/opus-gate-2026-06-20-postH52-H53.md` — VERDICT: H-52 + H-53 BOTH CONFIRMED (their bug classes → zero; Lore-hound 0/12 spotless); 4→11 is fresh-territory exploration, not regression; new dominant cluster = compound/meta-query partial-answer + rules-confirmation-as-action (grace)
4 sessions × 12 turns, glass-harbor. Fresh server restarted immediately before the run (killed the 09:49 server,
booted 09:56:39, post-dates all H-53 commits — per checklist). **11/48 (23%)**, up from 4/48 — but judged BY
NATURE this is NOT a regression. Cost ~$2.64 (96 calls).
By-class: **DM_TEST_DEADEND 10 · COMBAT_NOT_STARTED 1** · CANON_HALLUCINATION **0** · CRUNCH_INCONSISTENCY **0**.
Rules Lawyer 5v+5c (worst) · Chaos 3v+1c · **Lore-hound 0/12** · Confused newbie 2v+1r.

**H-52 CONFIRMED — emphatically.** CANON_HALLUCINATION (its class) = 0. **Lore-hound 0/12, fully spotless** — the
exact persona H-52 targeted. The gate probed the wrong-elder confusion head-on (RL t11 "Kael's the elder now? A
second ago Corwin…", t12 "is Kael the elder I'm fighting, or the elder…") and it resolved cleanly. The decades-
tenure + grounded-name/wrong-role shapes did not recur.
**H-53 CONFIRMED.** CRUNCH_INCONSISTENCY (its class) = 0. The out-of-combat object-strike-narration shape did not
recur. (H-53b's movement/people over-fire also absent.)

**NEW DOMINANT CLUSTER — compound/meta-query partial-answer + rules-confirmation-as-action (grace lane, RL 5 +
Chaos 2; candidate H-54):** the meta-query answer-binding family (H-25/H-31/H-40 lineage) under NEW shapes —
- **Multi-part query, partial answer:** "name, class, and current HP?" → gave name+class, **dropped HP** (13/13
  in canon). "AC/defense on Worn Blade vs Kitchen cleaver + damage each?" → observe-only travel line, weapon
  lookup unanswered. "who's Brokefang? + grab the purse" / "how much coin + where did Brokefang come from?" →
  answered one half, dropped the NPC-identity half. Root: a compound question must answer EVERY part.
- **Rules-confirmation treated as an ACTION:** "with MIGHT 12 my mod is +1 — so a hit is 1d6+1? Confirm" →
  rolled d20 vs DC13 (failure, gen:f filler) instead of confirming the rule. "Yes or no: do I add MIGHT +1 to
  melee damage?" → restated the stat, dodged the actual rules question. A rules-mechanic question is not an
  in-fiction action — answer it straight, never roll it.
- **Declared check not adjudicated:** "I sheathe and roll WITS to read his face — DC and result?" → "no standing
  DC… I set one when you commit" despite a concrete declared action. A declared check must get a DC + roll.

**OTHER (minority):**
- **COMBAT_NOT_STARTED (1, HIGH, Chaos — combat/Codex lane; candidate H-55):** "draw my dagger and stab the baker
  in the gut" → narrated the stab landing but **no combat started, no enemy entity/HP, no roll** — a freebie
  asserted kill on a non-combat civilian NPC. Sibling to H-30/H-43 declared-attack-resolution, extended to a
  civilian (non-roster) NPC target.
- **Travel-gate on a PRESENT NPC (Confused-newbie t5, VIBE+RAG — grace/playloop):** "go talk to Kael the elder"
  where Kael is present → DM gated him behind a fake travel barrier instead of starting the conversation. A
  THE_DM_TEST movement-bounce (long-standing deferred residual, now gate-confirmed). Fold into H-54 or its own.
- Confused-newbie t12 stonewall + Chaos "shake the baker for coins" (judge: actually consistent, borderline).

**Rung-1 bar: NOT met** (RL 5/12) — but the two landed fixes CLEARLY held (their classes zeroed, Lore-hound
spotless), and the remaining failures are a single well-understood family (meta-query answer-binding) plus one
combat-lane high and one travel-bounce. Not a Road-A/B fork — all narrow answer-binding/routing gaps. Road B
stays parked. Proposed next (NOT dispatched — Tim's call): **H-54 (grace)** compound-query-answer-all-parts +
rules-confirmation-as-straight-answer + declared-check adjudication (+ maybe the present-NPC travel-gate); **H-55
(Codex)** declared lethal attack on a civilian NPC starts real combat.

### (historical) prior in-flight — H-47 ∥ H-48 ∥ H-49, dispatched 2026-06-20, declared FILE-DISJOINT (parallel OK §2)
Tim: "proceed." Three packets, disjoint file sets → parallel; each prompt has a halt-on-cross-file guard +
distinct test number. ONE gate measures all three after they land (budget-conserving — ~$5.7, ~2 gates).
- **H-47 "item-effect answer breadth" (Claude-Sonnet, grace — `gracefulAdjudication.js` + `tests/U210`):**
  the dominant post-H-45/H-46 cluster (RL 7/12). Fix `answerItemQuery` to (1) match the item ASKED about, not
  the first inventory name found (the Kitchen-cleaver mis-match), + fold MULTIPLE named items; (2) catch
  "does it heal HP / restore / buff a stat?" phrasings (broaden `META_ITEM`/detector); (3) state the
  CAPABILITY ("heals 2d4") even at full HP; (4) never endorse a false "it's inert" claim. **Tests MUST use
  the verbatim gate phrasings (multi-item + "does it heal" + "it's inert") — the U208 gap was too-narrow
  tests.** Halt if it needs playloop/llmAdapter.
- **H-48 "combat finish-low-HP" (Codex, combat — `playloop.js` + `escapeCombat.js` + `tests/U211`):** a
  declared killing blow on a near-dead foe in active combat ("bury my blade in his throat to finish him",
  "ram my blade up under his jaw", "stomp on his skull") narrates the kill but tags `[combat:table-talk]`
  with no roll/HP/defeat. Improvised violent verbs (bury/ram/drive/stomp/plunge…) aren't in the in-combat
  explicit-action regex (`playloop.js:1816`) or `isImprovisedCombatAction` (`:5632`) → fall to table-talk.
  Extend detection so they resolve via `resolveEscapeCombatTurn`. Codex can't push (§7). Halt if it needs grace.
- **H-49 "lore-invention guard" (Claude-Sonnet, narration — `llmAdapter.js` + `tests/U212`):** recurring
  CANON_HALLUCINATION — invented tenure NUMBERS ("eleven years") + invented relationships/events ("Tove and
  the elder competed for supply routes"). Extend `findInventedFactClaim` (`llmAdapter.js:710`, sibling of
  `LINEAGE_PHRASE_RE`:699 / age Rule 4c:554) to confident specific tenure-numbers + invented relationship
  claims absent from the grounded base, with the existing negation/hypothetical exemption. Halt if it needs grace/playloop.
On all three: verify each per §7, then ONE post-batch gate.

## Done — H-45 (2026-06-20, BASECAMP-verified per §7)
Claude-Sonnet (`3064288` claim, `562cc06` fix, `7c01e3a` DONE). Lit up the consumable mechanic that was
built-but-unplugged. Worker went DEEPER than the dispatch (correctly): the live path uses
`engine/chargen/fantasyGear.js` (not `gear.json`, which only 3 chargen tests read), AND `tryUseConsumable`/
combat only ever read the structured `inventory.items[]` array — never the legacy flavor buckets chargen
populates. So a bare `defRef` on a flavor entry wasn't enough; `buildLoadout` now bridges a defRef-bearing
consumable straight into `items[]` (so it resolves AND disappears on use, no zombie-listing). Added 3 catalog
defs (`bandages` heal 1d4, `tonic_of_grit` heal 2d4, `holy_water_questionable` removeCondition cursed) +
matching defRefs in both gear files; Rations/Lamp oil stay flavor. `answerItemQuery` now describes the REAL
effect from both inventory shapes (never invents, never false "no effect"); new `META_CONSUMABLES_LIST`
lists consumables from both buckets; one-line `CONSUME_RE` add so "holy water" is reachable. `tryUseConsumable`
+ combat needed ZERO changes — pure wiring.
§7 verification: full suite **8202/0** (= 8190 + 12 U208), determinism 6/6, `playtest:quick` 50/0/0, in sync,
NO forbidden-file touch (no `engine/combat/*`, `llmAdapter.js`, `state.js`, `invariants.js`, `effectsCore.js`),
no `WORLD_VERSION`/`Math.random`/`Date.now`; the `playloop.js` touch is a single `CONSUME_RE` regex line.
Diff reviewed: chargen bridge is deterministic (`id: start_<defRef>_<i>`, uses the passed `rng`, no new RNG).

**Pre-gate follow-ups (small, do BEFORE spending the next gate — Tim's "finish obvious tasks first"):**
1. **H-46 — inventory `items[]` listing (real, now-active regression; grace, ~5 lines).** `META_INVENTORY`'s
   generic "what's in my pack" loop deliberately `continue`s on `cat === 'items'`, so it skips the structured
   `items[]` array. That was *latent* (nothing started in `items[]`); H-45 ACTIVATED it by moving the 3
   consumables there → "what's in my pack" now omits Tonic/Bandages/Holy water (though "list my consumables"
   shows them via the new handler). Fix: make the pack-dump resolve `items[]` defRefs to names and include
   them. Systemic value — every future structured item (weapons/armor in `items[]`) would otherwise vanish
   from the general listing too. The worker correctly flagged this and left it out of scope.
2. **JUDGE recal (BASECAMP, like item iv).** `canonGroundTruth` in `dm-playtest.mjs` should expose consumable
   effects so the post-H-45 gate grades item answers against real data (and a genuinely-flavor item doing
   nothing is a PASS) — prevents the unfair-test premise recurring.
On both done: run the post-H-45 gate. **Separately landed this session:** the content-lint
(`npm run lint:content`, commit `84acc22`) — static "wired vs dark" audit; first run showed catalogs green
(items 100%, spells 137/137, bestiary 642/642) and pack starting gear only 38% wired (the broader wiring gap).

## Done — H-43 ∥ H-44 (2026-06-19, parallel, BASECAMP-verified per §7)
Ran file-disjoint and clean: H-44 touched ONLY `gracefulAdjudication.js`; H-43 ONLY `playloop.js` +
`escapeCombat.js` — no cross-lane. Combined HEAD: full suite **8190/0** (= 8172 + 14 U207 + 4 U206),
determinism U19/21/22/27/30 **6/6**, `playtest:quick` 50/0/0 (independently re-run — the 0-HP combat-flow
change is death-spiral-adjacent; U22 long-run + playtest both clean). No `Math.random`/`Date.now`/
`WORLD_VERSION`; H-43 mutates via `applyDeltas`; both test files net-new (invariant #19 N/A). Sonnet pushed
H-44; BASECAMP pushed H-43 after verify (Codex can't, §7).
- **H-44 "grace cleanup" (Claude-Sonnet, `03eb40e`):** (i) `INFO_SEEKING_CONCEALMENT_RE` → noun-less
  concealment questions ("is something going on you're not telling me?") reach deliver-or-decline
  (Confused-newbie t8); (ii) NPC-observer lurker id — a "lurking/edges" framing names the present HOSTILE
  NPC, not `sociable[0]` (RL t5; traced IN LANE — the `META_NPC_OBSERVER` fallback). `tests/U207` 14/14.
  *Watch next gate:* the observer query now NAMES a canonical lurker (guarded for unnamed; mild tension with
  H-34's roster vagueness — revisit only if it reads as over-disclosure).
- **H-43 "combat resolution" (Codex, `4f70b0b`; DONE `9378fcd`):** 4 traced root causes — (i) `hit`/`beat`
  added to the in-combat explicit-action regex so "I hit Corwin… give me the d20?" resolves instead of
  becoming question-shaped table-talk; (ii) 0-HP active-combat turns now route through
  `resolveEscapeCombatTurn`'s dying handling before any travel/body shortcut can intercept; (iii)
  `resolveEscapeCombatTurn` no longer ends combat at 0 HP while a live enemy stands — enters a
  `[combat:dying]` state via `applyDeltas`; (iv) a `isSocialIdentificationNonCombat` guard excludes "point
  at"/"ignore X" deixis (without a violence verb) from all three assault detectors (RL t6). `tests/U206` 4/4.

**Open residuals for the post-H-43/H-44 gate (deferred, none blocking):** travel-bounce + location
contradiction (Lore-hound t1, playloop movement), goal/aim UI-string leak (Confused-newbie t5),
lore-invention guard (llmAdapter; Lore-hound t10 / Confused-newbie t10), the H-44 lurker-naming watch-item.

### Original dispatch (historical — both packets DONE above)
Tim: "send it." Scoped to not collide: **H-43 = `engine/playloop.js` + `engine/combat/escapeCombat.js`**
(+ `tests/U206`); **H-44 = `engine/grace/gracefulAdjudication.js`** (+ `tests/U207`). Disjoint file sets →
parallel; each prompt carries a HALT-if-you-need-the-other's-file guard + a distinct test number.
- **H-43 "combat resolution" (Codex, combat lane)** — the post-H-42 dominant cluster (~8/16): (i) a declared
  attack ("I attack Corwin with my worn blade", incl. a trailing "roll it / give me the d20") must route
  into a real `resolveEscapeCombatTurn` strike with a shown roll, not fall to a `[combat:table-talk]` branch
  with the enemy undefeated (playloop ~L1796-1870 table-talk branches; strike/foe parse ~L1801-1870);
  (ii) narration must not claim a hit/defeat the mechanics never produced (Chaos t6); (iii) 0-HP/combat-end
  consistency — combat must not end with an enemy alive AND PC at 0, and a 0-HP PC can't recover without a
  resolved dying-state (Chaos t11/t12); (iv) a social/identification line ("point at the stranger", "ignore
  Corwin") must NOT misroute into a strike (RL t6 — `declaredNpcViolence`/`detectAttackAnyIntent`
  false-positive, playloop L756-757 / L5738). Codex can't push (§7) — commit local, report hash, owner
  pushes after verify. Halt if it needs `gracefulAdjudication.js`.
- **H-44 "grace cleanup" (Claude-Sonnet, grace lane)** — (i) broaden `isInfoSeekingText` for noun-less
  suspicion/info questions ("is something going on you're not telling me?" → currently content-free success;
  Confused-newbie t8, the H-39 residual) so they reach deliver-or-decline; (ii) NPC-observer identification
  names the canon-correct present NPC, not a wrong one (RL t5: DM said "Corwin" when canon names the
  Lingerer) — ONLY if it lives in grace's `isNpcObserverQuery` handler; if the misidentification is upstream
  in playloop routing, STOP + report (H-43 owns playloop). Sonnet pushes own. Halt if it needs
  playloop/llmAdapter.
DEFERRED (noted, not dispatched — need playloop/llmAdapter or tracing; fold into a post-combat batch):
travel-bounce + location contradiction (Lore-hound t1, playloop movement), goal/aim UI-string leak
(Confused-newbie t5), lore-invention guard (llmAdapter; Lore-hound t10 / Confused-newbie t10). On results:
verify each per §7, then a gate.

## Done — H-42 (2026-06-19, BASECAMP-verified per §7)
Claude-Sonnet (`385c228` fix, `7ae5ae3` DONE). The IG-11 "react under pressure" social-physics rule: a
confrontation/contradiction-challenge aimed at a PRESENT NPC resolving as FAILURE now yields a deterministic
in-character NPC reaction instead of the `gen:f` place-filler. New exported `isConfrontationChallenge`
(accusatory markers: "you said…but", "one of you is lying", "admit it", "you claimed", "contradicts what you
said", "you swore…but") with a real false-positive guard (negative-lookahead so "lying in the grass" ≠
accusation, regression-tested U205-12); `confrontationReaction` in `genericGroundedOutcome` returns a
civil-defensive or hostile-bristle tier off the NPC's real `hostile` flag via seeded `pickVariant`, concedes
/reveals nothing (the read failed). Scoped FAILURE-only — success/mixed reveal paths (H-12/13) untouched
(U205-27/28). §7 verification: suite **8172/0** (= 8149 + 23 U205), determinism 6/6, in sync, lane clean
(only `gracefulAdjudication.js` + `playloop.js` + `tests/U205`; no combat/llmAdapter), no `Math.random`/
`Date.now`/`WORLD_VERSION`/`applyDeltas`, U205 net-new, `playtest:quick` 50/0/0. Diff reviewed: failure-only
gate correct, reads real NPC state, invents/reveals nothing.
**New minor residual (deferred):** a MIXED-roll confrontation isn't covered (H-42 is failure-only by
design); not observed yet — fold in only if a gate flags it.

## Done — H-40 ∥ H-41 (2026-06-19, parallel, BASECAMP-verified per §7)
Dispatched file-disjoint, ran clean as a linear stack (H-41 first, H-40 on top). **Lane disjointness HELD
exactly:** H-40 touched ONLY `gracefulAdjudication.js`; H-41 touched ONLY `playloop.js` (4 lines) — neither
entered the other's file. Sonnet's push carried Codex's (unpushable, §7) commits since they're ancestors,
so origin is in sync with no manual push needed. Full suite **8149/0** (= 8135 + 3 U204 + 11 U203, matches
both reports), determinism U19/21/22/27/30 **6/6**, no `Math.random`/`Date.now`/`WORLD_VERSION` added, H-40
added no `applyDeltas`, H-41 is a read-only gate-condition fix, both test files net-new (invariant #19 N/A).
- **H-40 "number-transparency" (Claude-Sonnet, `8b6cad0`; DONE `5b76ac4`):** (i) added `tracking→WITS` to
  the skill map + extracted a shared `answerSkillModifier` so a "what's my tracking modifier" ask returns a
  clean computed modifier, NOT the raw breakpoint table; (ii) `answerFullStats` folded into BOTH the
  inventory and equipment branches so "stats AND weapons" answers both; (iii) real attack bonus via
  `meleeProfile` (read-only import from `escapeCombat.js`, same source combat reads — can't drift) when a
  real weapon is named, preserving the old explanation byte-for-byte when none is. `tests/U203` 11/11.
  Sound deviations: used the REAL Opus-gate transcript phrasing for the compound test instead of the
  prompt's paraphrase (avoided an unnecessary `META_CHARACTER` regex touch).
- **H-41 "0-HP dying-state out of combat" (Codex, `b8d3ea9`; DONE `cad74b9`):** root cause —
  `outOfCombatDyingGate` already read current HP from `meta.escapeHp`, but bailed when `meta.escapeMaxHp`
  was stale/0, which it is in an SRD-sheet world → a real 0-HP PC fell through to ordinary handling. Fix:
  fall back to sheet `party[0].dnd.maxHP` for max while keeping `escapeHp` authoritative for current. 4-line
  read-only change. `tests/U204` 3/3, adjacent combat canaries 22/22, `playtest:quick` 50/0/0.

**Open residuals to watch at the post-H-40/H-41 gate (none blocking):**
1. **Bare modifier-formula table still exists (low, grace).** H-40 fixed the named-skill path ("tracking
   modifier"); a no-skill/no-stat-named "what's my modifier" still hits the generic breakpoint-table branch
   (locked by U172-23, outside H-40's lane). Separate follow-up if a gate flags it.
2. **"React-under-pressure" residual (the post-H-39 confrontation, Lore-hound t12).** A failed insight
   roll on a contradiction-challenge still dead-ends in `gen:f` filler instead of an NPC reaction. This is
   the next social-physics rule (IG-11) — candidate grace packet.
3. **Low-grade lore-invention** (post-H-39 Lore-hound t3) — DELIVER side of deliver-or-decline occasionally
   inventing a specific; minority, watch for recurrence.

## Done — H-39 (2026-06-19, BASECAMP-verified per §7)
Claude-Sonnet (`05f24aa` fix, `075d46d` DONE, `e5320dd` claim). Deliver-or-decline by recall, not
enumeration — the strategic-reframe fix from the verdict below. Three parts, all grace lane
(`gracefulAdjudication.js` + `playloop.js`) + `tests/U202` (25 cases): **(i)** recall-bias
`isInfoSeekingText` via new `INFO_SEEKING_TOPIC_RE` anchored to knowledge-VERB phrases ("tell me about
X" / "what happened to X" / "what do you know about X" / "what's the story behind X") so it generalizes
to ANY topic, + extended action-verb EXCLUDE (climb/jump/pick/force/try/... mirroring isExploreIntent)
so feasibility questions stay actionable; **(ii)** `genericGroundedOutcome` now declines on a detected
info-question (covers the FAILED-roll branch infoExtractionOutcome skips) via a shared `declineInfoSeek`
helper; **(iii)** `META_ADVICE` "should I be worried?" returns a confident TRUE danger read from REAL
state (hostile NPCs / open ledger threats / grim-blood tone via `fateBand`), never "yours to call".
§7 verification: full suite **8135/0** (= 8110 + 25, matches), determinism U19/21/22/27/30 **6/6**, in
sync with origin, no forbidden-file touch (no `llmAdapter.js` / `engine/combat/*`), no
`Math.random`/`Date.now`/`WORLD_VERSION`/`applyDeltas`, no existing test rewritten (invariant #19 N/A),
`declineInfoSeek` extraction byte-identical to the original. Two worker deviations, both judged SOUND:
(a) verb-phrase net instead of a blanket `isQuestionShaped` base — correctly avoids breaking
isExploreIntent's survey path (U197-06), better-calibrated than the dispatch; (b) found + fixed a THIRD
interception point (`META_RECAP`'s unanchored "what happened" swallowing third-party lore questions),
caught by live-probe.
**Known residual (track at the post-H-39 gate, NOT a blocker):** all three gates (pre-roll suppression,
`infoExtractionOutcome`, the (ii) safety net) key on the SAME `isInfoSeekingText`, so (ii) is
belt-and-suspenders across OUTCOMES (adds the failed-roll branch), NOT across detection-recall. A
noun-less / verb-phrase-less lore interrogative ("who used to live here?", "what's down in the cellar?")
can still miss detection and reach the atmosphere pool — narrower than before, not zero. If the gate
surfaces this shape, the next move is a broader recall net (e.g. gate (ii) on `isQuestionShaped` with an
action-verb exclusion), NOT more enumerated nouns.

## Done — H-38a/b (2026-06-19, BASECAMP-certified post-hoc)
H-38a (`e1ff459`/`73cc196`, grace) + H-38b (`1727db9`+docs, combat), both pushed, in sync with origin.
Suite 8110/0 (= 8086 + 3 U200 + 21 U201), determinism U19/21/22/27/30 6/6, lane boundaries held (H-38b
only `engine/combat/*`+`playloop.js`; H-38a only `grace/*`+`playloop.js`; neither touched the other's
lane or `llmAdapter.js`). No post-H-38 gate was run — superseded by the H-39 dispatch.

## Gate run 2026-06-20 (post-H-45/H-46) — `docs/playtests/opus-gate-2026-06-20-postH45-H46.md` — VERDICT: judge-recal WORKED (gate now grades items fairly + precisely) → it pinpoints that H-45's item-effect answer is TOO NARROW (passes U208, fails realistic phrasings). Dominant = item-effect query/use (RL 7/12)
4 sessions × 12 turns, glass-harbor. Fresh server restarted before the run. **16/48 (33%)**, up from 10/48
— but this is the first TRUSTWORTHY item-domain measurement: the judge-recal landed, so the gate no longer
marks the engine wrong for honest no-effect, and every Tonic fail's note now QUOTES the real effect ("Tonic
heals 2d4 per canon; DM didn't state it"). Number up, but the gate is now a precise instrument that localizes
a real engine gap. Cost ~$2.68 (budget ~$8.4 → ~$5.7).
By-class: DM_TEST_DEADEND 10 · CANON_HALLUCINATION 3 · CRUNCH_INCONSISTENCY 3.
Rules Lawyer 7/12 (item-effect) · Chaos 3/12 (combat-finish) · Lore-hound 3/12 · Confused newbie 2/12.

**Judge-recal SUCCEEDED** — its whole job was to make the item domain fairly gradeable, and it did; the gate
now pinpoints exactly where the engine fails instead of complaining unfairly.

**DOMINANT CLUSTER — item-effect query/use; H-45 too narrow (RL 7/12, grace; candidate H-47):** H-45's
`answerItemQuery` handles a simple "what does the Tonic do?" (U208) but fails the realistic adversarial
phrasings the gate used —
- **First-match WRONG item (t2):** "what does the Tonic do, and the Worn Blade / Kitchen cleaver damage?" →
  answered about the **Kitchen cleaver** ("nothing special fires"). `answerItemQuery` returns the FIRST
  inventory item whose name appears in the text, not the one ASKED about; the cleaver is flavor, so its
  no-effect line masked the Tonic's heal. **This is the single highest-value fix.**
- **"Does it heal HP / buff a stat?" misses META_ITEM (t5/t6):** phrased without "what does X do" → fell to
  generic resolution → the OLD `gen:m` hedge ("it lands, after a fashion"), on a question canon can answer.
- **"Drink it + what changes on my sheet" → sheet-dump (t7); "what does it do when I drink it" → action
  resolution "you do so without difficulty" (t4)** — neither routed to `tryUseConsumable`/`answerItemQuery`.
- **Endorsed a FALSE "it's inert" claim (t8, CANON_HALLUCINATION):** "the useless tonic" — accepted the
  player's premise instead of correcting it (heals 2d4; full HP ≠ inert).
- Compound item+weapon queries also drop slots (t2/t3) — the compound-fold family.
NOTE the PC is at FULL HP (13/13), so even correct *use* is a legit no-op — but the *capability* ("it heals
2d4") must be stated regardless, and the engine conflates "what does it do" (capability) with "use it" (apply).

**FAMILIAR deferred residuals (not new):** combat-finish-low-HP (Chaos 3, COMBAT lane — a declared killing
blow on a 2-3 HP foe in active combat narrates the kill but tags `[combat:table-talk]`, no roll/HP/defeat; an
H-43 sibling for the finish-a-low-HP shape; Chaos was 0/12 last gate so it's a fresh shape, not a clean
regression); lore-invention (Lore-hound "eleven years", Confused-newbie "supply-route rivalry" —
CANON_HALLUCINATION) + invention→deadend (Lore-hound t4 "Nothing's happened yet") + read-no-payoff
(Lore-hound t8) + suspicion-deadend (Confused-newbie t4).

**META-LESSON (record):** H-45 PASSED its unit test (U208 12/12) but FAILED the live gate — the unit test
covered a narrower path than the adversarial paraphrases. *A passing unit test is not a passing gate.* The
judge-recal is what made the gate trustworthy enough to expose it. Biblioteca Vol 8 (paraphrase-invariance
harness) is the durable answer; until then, scope item/grace unit tests with multi-item + varied phrasing.

**Rung-1 bar: NOT met.** Proposed next (NOT dispatched — Tim's call): **H-47 (grace) — broaden the
item-effect answer:** match the ASKED item not first-found + fold multiple named items; catch
"does it heal/restore/buff" phrasings; "use/drink it" routes to `tryUseConsumable` and states the capability
+ the no-op reason at full HP; never endorse a false "inert" claim. Standing combat-finish + lore-invention
residuals are separate packets. Budget ~$5.7 (~2 gates left).

## Gate run 2026-06-20 (post-H-43/H-44) — `docs/playtests/opus-gate-2026-06-20-postH43-H44.md` — VERDICT: combat cluster CRUSHED (Chaos 0/12) + grace HELD (Confused-newbie 0/12); 16→10; new dominant cluster = item/consumable handling (RL 7/12), a fresh domain
4 sessions × 12 turns, glass-harbor. Fresh server restarted immediately before the run (the session's prior
server was killed after the baseline). **10/48 (21%)**, down from 16/48 (33%) post-H-42 baseline — and the
two historically-hardest threads went FULLY CLEAN. Cost ~$2.52 (budget ~$10.9 → ~$8.4).
By-class: DM_TEST_DEADEND 7 · DM_ARTIFACT_LEAK 1 · CRUNCH_INCONSISTENCY 1 · CANON_HALLUCINATION 1.
Rules Lawyer 7/12 (item/consumable) · **Chaos 0/12** · Lore-hound 3/12 · **Confused newbie 0/12**.

**H-43 (combat) HELD — emphatically.** Chaos-griefer ran a full 12-turn combat rampage (door-kick,
grab/headbutt/wrench/slam/pin, bite the Lingerer, claw out, torch-throw, "with my last breath" spit blood,
0-HP crawl, wake elsewhere) — **0 fails**, down from 4/12 combat-crunch at the baseline. Declared attacks
resolved, 0-HP entered a real dying/recovery arc, no narration-without-mechanics. The dominant baseline
cluster is gone.
**H-44 (grace) HELD.** Confused-newbie **0/12**, incl. t4 "is something going on [you're not telling me]?"
(the H-44 concealment-question target) resolved, not content-free; observer/identification clean too.

**NEW DOMINANT CLUSTER — item/consumable handling (RL 7/12, grace lane; candidate H-45):** the Rules-Lawyer
hammered consumables and the DM whiffed —
- t2 "tell me about the Tonic of grit — what does it do?" → meaningless auto-success (item-effect query not
  answered from the item's real definition).
- t4 "I'll uncork the Tonic and drink it" → leaked a raw stat block, didn't process the declared item USE.
- t5 "nothing changed when I drank it — is it broken?" → irrelevant movement narration.
- t6/t11/t12 "list / read back my consumables (+HP)" → dodged with flavor / bounced with scenery /
  unrequested stat dump.
- t10 "a roll of 7 to drink a tonic? drinking needs no roll" → tonic consumed in fiction but inventory/
  effect not applied (CRUNCH).
Root theme: item-detail queries ("what does X do") aren't answered from the item's real def; a declared
item-USE ("drink the Tonic") isn't resolved (no effect applied / spurious roll for a no-check action); a
consumables-list readback isn't a recognized meta-query. Same deliver-or-decline FAMILY as the info-seeking
work, extended to a new object type (items/consumables) + an item-use path. Grace lane (+ maybe item-use in
playloop — serialize if so).

**Lore-hound (3, minority):** t1 "whose house is this?" → grounded but the direct who-question unanswered
(DEADEND); t9 a pointed "you said you decided not to say the name" → vague non-answer (DEADEND — a
confrontation shape H-42 didn't reach: a failed-roll pointed question, the react-under-pressure family on a
non-accusation phrasing); t11 "Torva" vs canon "Tove"/"Torva Boneknit" name ambiguity (CANON_HALLUCINATION,
borderline).

**Rung-1 bar:** NOT met (RL 7/12) — BUT 2 of 4 personas are SPOTLESS, the number dropped, and the remaining
cluster is a single fresh domain (items/consumables) tractable via the proven deliver-or-decline pattern.
**Closest to the bar yet.** Proposed next: **H-45 item/consumable batch (grace)** — item-effect queries
answer from the real item def; declared item-use resolves (apply effect; no spurious roll for a no-check
quaff); consumables-readback meta-query. NOT dispatched — Tim's call. Not a Road-A/B fork (narrow
routing/grounding gaps, new domain).

## Gate run 2026-06-19 (post-H-42 BASELINE) — `docs/playtests/opus-gate-2026-06-19-postH42-baseline.md` — VERDICT: grace fixes HELD; gate explored fresh COMBAT-RESOLUTION territory → new dominant cluster is combat lane (Codex), not grace
4 sessions × 12 turns, glass-harbor. Fresh server restarted immediately before the run (prior was ~1min
stale, predated H-42). **16/48 (33%)**, up from 7/48 (15%) post-H-39 — judged BY NATURE this is NOT a
regression: the three landed fixes held for their tested scopes, and the jump is the gate probing a harder
thread it never reached before — the **Rules-Lawyer DECLARED ATTACKS and demanded the dice** (prior runs
only asked for stats), and Chaos pushed grapples + 0-HP. That surfaced a real combat-lane cluster grinding
grace never touched. Cost ~$2.52.
By-class: CRUNCH_INCONSISTENCY 7 · CANON_HALLUCINATION 3 · DM_TEST_DEADEND 3 · DM_ARTIFACT_LEAK 2 · NONE 1.
Rules Lawyer 7/12 (combat resolution) · Chaos 4/12 (combat crunch) · Lore-hound 2/12 (grounding) · Confused
newbie 3/12.

**Landed fixes HELD (by target shape):** H-42 — Lore-hound confronted Corwin repeatedly (surname/time/
"wizard now?"), all resolved in-voice, no `gen:f` confrontation dead-end ✓. H-39 — genealogy/founder/should-I
passed; one noun-less residual recurred (Confused-newbie t8 "is something going on you're not telling me?" →
content-free success). H-40 — named-skill path held; the BARE modifier-table recurred (RL t10/t12 "give me
the d20, my +1 MIGHT, the total" → breakpoint table/UI menu), exactly the deferred U172-locked residual, now
entangled with combat non-resolution. H-41 — the exact stale-`escapeMaxHp` bug didn't recur, but a DEEPER
combat-end-state inconsistency surfaced (below).

**NEW DOMINANT CLUSTER — combat resolution (~8/16, COMBAT LANE / Codex):**
- **Declared attacks don't resolve into real strikes:** RL t8/t10/t11/t12 ("I attack Corwin with my worn
  blade. Roll it") → wind-up narrated, NO roll, combat stays `table-talk`, enemy undefeated; Chaos t9 (attack
  dealt no damage, table-talk during active combat). The H-30/H-32 declared-attack→real-combat family
  recurring under a "resolve it + show me the dice" framing.
- **Narration exceeds mechanics:** Chaos t6 (solid hit narrated on a retreating foe; HP/defeated never
  updated).
- **0-HP / combat-end-state:** Chaos t11/t12 (combat "ends" with enemy alive AND PC at 0 HP; PC recovers
  without dying-state resolution).
Root theme: declared combat intent isn't reliably routed into `escapeCombat` resolution when phrased as a
demand/negotiation, and narration claims outcomes the mechanics never produced. Codex/combat lane.

**Grace residuals (minority — the deferred ones, CONFIRMED, + a few fresh):**
- Bare modifier-table / UI-menu leak (RL t10/t12) — deferred H-40 residual confirmed; real fix is the
  combat-resolution above (the player wanted the attack resolved, not the table).
- NPC misidentification (RL t5: DM called the stranger "Corwin" when canon names the Lingerer) + a social
  "point at the stranger" request misrouted into combat (RL t6). Grounding/routing.
- Location contradiction + travel dead-end (Lore-hound t1: "head to the tavern" bounced with a direction
  prompt + wrong current location) — a THE_DM_TEST movement bounce.
- Lore-invention (Lore-hound t10, Confused-newbie t10) — deferred lore-invention residual confirmed (2×,
  low/borderline; judge flagged one as borderline).
- Goal/aim UI string leak (Confused-newbie t5); noun-less info-question content-free success (Confused-newbie
  t8, H-39 known residual).

**Rung-1 bar: NOT met** (Rules-Lawyer 7/12, not clean) — but the failures are a FRESH combat-resolution
cluster, not the grace tail we've been closing (which largely held). **The frontier has shifted: grace →
combat.** Proposed next (NOT dispatched, Tim's call): a **combat-resolution batch (Codex)** = declared-attack
→real-strike routing (incl. when phrased "resolve it / show me the roll") + narration≤mechanics +
0-HP/combat-end-state consistency; and a smaller **grace batch** = bare modifier-table (touch U172),
NPC-misidentification grounding, travel-bounce, noun-less info-question. Not a Road-A/B fork — all narrow
routing/state/grounding gaps.

## Gate run 2026-06-19 (post-H-39) — `docs/playtests/opus-gate-2026-06-19-postH39.md` — VERDICT: H-39 WORKED — info-seeking-lore DM_TEST_DEADEND tail collapsed (9→2); predicted recall residual recurred exactly once; new dominant cluster = Rules-Lawyer "give me my literal numbers" meta-query (grace)
4 sessions × 12 turns, glass-harbor. Dev server restarted fresh immediately before the run (it was ~71s
stale — booted 11:19:54, predated H-39's `05f24aa` at 11:21:05; caught + restarted per checklist).
**7/48 (15%)**, down from 16/48 (33%) post-H-37. Judged by nature: the H-39 target shapes COLLAPSED —
the genealogy/founder/"should-I-worry" info-seeking dead-ends that gave postH37 its 9 DM_TEST_DEADEND
now PASS (Lore-hound t1 "who founded this, how long ago" ✓, t4 "name the two families" ✓; Confused
newbie **0/12** incl. "who's that watching me / why's he watching / should I worry" ✓). **DM_TEST_DEADEND
9→2.** sub-fix (iii) META_ADVICE stance confirmed live (the watcher arc resolves with a read, not a
shrug). Cost ~$2.46 (96 Opus calls).
By-class: CRUNCH_INCONSISTENCY 2 · DM_TEST_DEADEND 2 · DM_ARTIFACT_LEAK 1 · CANON_HALLUCINATION 1 ·
NONE 1. Rules Lawyer 4/12 · Chaos 1/12 · Lore-hound 2/12 · Confused newbie 0/12.

**Predicted H-39 residual CONFIRMED, exactly once (grace lane):** Lore-hound t12 "You said Kael was here
before any of you. He says he came later... which one is lying?" → `[roll:6 vs DC:12 → failure]` →
"Whatever you meant to do, Pilgrim's Rest Village doesn't give it to you." This is the noun-less /
verb-phrase-less interrogative gap flagged in the H-39 DONE note: a confrontation/contradiction-challenge
missed `isInfoSeekingText`, rolled a FAILURE, fell to `gen:f` atmosphere. The (ii) safety net didn't
catch it (keys on the same detector). ALSO a continuity-challenge (H-9 family): a failed insight roll
should still yield an NPC REACTION (Corwin deflects/tightens), not narration-voice filler. Next move =
widen the recall net to which/why/how + accusation/contradiction framings, and/or route
contradiction-challenges to the continuity interceptor; consider gating (ii) on `isQuestionShaped` +
action-exclusion so a question that misses detection still declines-in-voice instead of `gen:f`.

**NEW dominant cluster — Rules-Lawyer "give me my literal numbers" (4/7, grace lane, meta-query
answer-binding; candidate H-40):** the persona demands raw tabletop values and the DM fumbles —
- t2 "what are my actual stats and weapons?" → dumped INVENTORY only, omitted HP/level/stats.
- t3 "give me my numbers — Strength, Dexterity… and attack bonus with the Worn Blade" → half rules-lecture
  (MIGHT +1 / AGILITY −1), no full scores, no proficiency, no final attack bonus (DM_TEST_DEADEND, med).
- t11 "roll it fresh: d20 plus my tracking modifier, tell me the modifier" → leaked a raw "Modifier
  breakpoints: 9→−1, 10–11→+0…" TABLE + stat block, and did NOT roll (DM_ARTIFACT_LEAK, high).
- t12 "roll the d20 fresh, show me the raw number plus +1 vs DC 12" → narrated a tracking success but
  omitted the raw die (judge: "vibe nit," bug_class NONE, low — borderline-forgivable).
Same family as H-25/H-31's meta-query interceptors (skill-mod/attack-mod/armor) but uncovered shapes:
full stat-block-as-numbers, "roll THIS check fresh + show raw d20+mod vs DC", and the raw modifier-TABLE
leak. A real DM answers number-transparency plainly ("+1, you rolled 14, 15 total"), never a spreadsheet.

**Lower-grade residuals (1 each):**
- Lore-hound t3 CANON_HALLUCINATION (low): on a success roll the DM invented "two families built the
  core… the rest followed after the road came through" — not in canon. The DELIVER side of
  deliver-or-decline tipping into invention (H-31 R4 / H-36a R3 lineage family). Judge correctly flagged
  it — a specific checkable claim, NOT tonal color, so the item-(iv) hyperbole exemption correctly did
  not apply. Still minority (1/7).
- Chaos t9 CRUNCH (med, COMBAT lane — NOT grace): PC at 0 HP, foe present (Corwin hp 5), `inCombat:false`
  → "claw up, grab door, swing" fizzles with no dice / no dying-state. The H-33 R2 `outOfCombatDyingGate`
  gap when the fight has ended but the PC is downed and an enemy lingers. Codex/combat lane.

Not a Road-A/B fork — every remaining shape is a narrow routing/grounding/state gap, same character as
the long tail. Road B stays parked. **Rung-1 bar: closest yet** — Confused-newbie clean, Chaos near-clean
(1 combat-lane), the dominant remaining grace cluster is a single well-understood meta-query family.

## Gate run 2026-06-19 (post-H-37) — `docs/playtests/opus-gate-2026-06-19-postH37.md` — VERDICT: R3 fully held, R4 not directly recurring but a new artifact-leak appeared nearby; R1 and R2 partially held — fix was too narrow, recurred in adjacent shapes the fix didn't reach; new dominant cluster = combat HP/entity-tracking desync (combat lane, out of scope for grace)
4 sessions × 12 turns, glass-harbor. Dev server restarted fresh immediately before the run (per
checklist). H-37 verified independently before this run: full suite 8086/0 (matches worker's claim),
determinism gates U19/21/22/27/30 green (6/6), diff review confirmed zero touches to `engine/combat/*`
or the combat-dispatch branch (the `playloop.js` touch is the pre-combat assault-detection gate for
R3's corpse-staging, which intercepts *before* `engageNpcCombat` — correctly in scope). **16/48 (33%)**,
up from 9/48 post-H-36 — judge by nature, not number; this run hit a fresh combat-tracking bug the
prior run didn't surface.
By-class: DM_TEST_DEADEND 9 · CRUNCH_INCONSISTENCY 6 · DM_ARTIFACT_LEAK 1. Cost ~$2.40.
Rules Lawyer 6/12 fails (worst persona), Chaos 5/12, Lore-hound 6/12, Confused newbie 1/12.

**R3 (corpse/object-handling) — ZERO recurrence, fully held.** No corpse-staging turns dead-ended
through the combat-no-target gate this run.

**R4 (NPC presence/quote grounding) — no direct recurrence**, but a new, related artifact appeared in
the same NPC-question territory: Lore-hound t9 "Corwin, you dodged it — give me a place. What village
or town were you born in?" → DM output the raw string `location:Pilgrim's Rest Village` instead of
narrating Corwin naming his birthplace (`DM_ARTIFACT_LEAK`, high severity — a template/key-value leak
into player-facing text, not a grounding-rule miss).

**R2 (mixed-roll-margin) — did NOT fully hold.** The exact original symptom recurred verbatim:
Lore-hound t8 "Corwin, then — you've stopped counting your years... so when were you born, and where?"
→ `[roll:11 vs DC:12 → mixed | margin:-1]` → "It lands, after a fashion — partial, imperfect." — the
identical content-free boilerplate quoted in the original H-37 bug report. Two new siblings appeared on
the **success** path (explicitly out of R2's stated scope, but same root symptom — zero fiction content
despite a resolved roll):
- Lore-hound t5 "Torva — daughter-in-law, you said. So who was her husband, Corwin's son?" →
  `[roll:17 vs DC:12 → success | margin:5]` → "It comes off cleanly; the moment turns toward you." — no
  name, no information.
- Lore-hound t11 "Then give me one name, Corwin — your son's, Torva's dead or living husband." →
  `[roll:15 vs DC:12 → success | margin:3]` → same empty "It comes off cleanly..." pattern.
All three are genealogy/identity asks framed indirectly (third-person family-history questions, not
direct "who are you" asks) — looks like the underlying info-seeking detector still has a gap for this
question shape, on both mixed AND success outcomes, not just the margin handling R2 touched.

**R1 (item/gear-stat answer-binding) — did NOT fully hold.** The fix only covered the coin+gear fold
(META_PURSE branch); Rules Lawyer hammered shapes outside that fold all 6 of its first 6 turns:
- t1 "what's my character's name, class, and what gear do I have on me?" (3-way compound, no coin) →
  DM answered only the name, ignored class and gear.
- t2–t6: repeated class/gear asks (some bare yes/no — "am I carrying any weapon or armor, yes or no?")
  → DM regressed to dumping the raw stat block (MIGHT/AGILITY/WITS/GRIT/CHARM + HP) six turns straight,
  never resolving class or gear once, even under direct player accusation of deflecting.
Same root cause as the post-H-36 finding, narrower than diagnosed: the fix folded gear into the
purse-answer branch, but class+gear (no coin) and bare gear yes/no asks don't route through
META_PURSE at all, so they never inherit the fold.

**New cluster, NOT a recurrence of any H-37 shape — combat HP/entity-tracking desync (6 turns, Chaos-
griefer, combat lane):**
- t6 "I yank out whatever I find and hold it up, then crack his head into the dirt" →
  `[enemy:Corwin Boneknit | hp:13->11]` but canon enemy HP is 4/8 — the mechanics line used the
  *player's* HP numbers for the enemy.
- t7 "I stand up and spit on him, then turn to the crowd and yell that they're next" (taunt, not an
  attack) → DM still emits `[strike:Worn Blade | atk:8 vs AC:10 → miss]`, an unprompted attack roll.
- t8 torch-toss at a roof → PC hp:11->10 in mechanics contradicts canon's live PC hp of 10 (implies a
  phantom point already lost).
- t9 torch-to-face → `[enemy:Corwin Boneknit | hp:10->8]` contradicts canon enemy hp 4/8.
- t11 torch-to-Lingerer's-face → `[enemy:Lingerer | hp:7->5]` contradicts canon hp 6, AND the strike is
  labeled `Worn Blade` despite the player declaring a torch attack (weapon-label desync).
This is `engine/combat/*` / combat-dispatch territory — explicitly forbidden to H-37 and out of scope
for the grace lane. Distinct, dominant, and likely the next priority — looks like enemy HP state is
sometimes reading/writing the wrong entity's ledger slot, plus the strike-mechanics formatter not
always picking up the player's declared improvised weapon.

**Proposed H-38 split (lane-assigned, NOT dispatched — Tim's dispatch call):**
- **H-38a — Claude-Sonnet (grace/narration), broaden R1/R2 nets:** (i) extend the deliver-or-decline
  fold beyond META_PURSE to cover class+gear (no coin) compounds and bare gear yes/no asks — same
  contract, wider net. (ii) Trace why "It lands, after a fashion" still emits on mixed-margin genealogy
  despite the R2 fix landing — confirm the fix actually reaches this question phrasing. (iii) New:
  zero-content narration on SUCCESS for indirect/third-person genealogy asks ("who was her husband",
  "give me one name") — the info-seeking detector's family-anchor may not catch this framing; trace
  whether it's the same gap as (ii) before splitting into two fixes. (iv) Fix the raw `location:...`
  key-value leak into player-facing narration — template/formatter bug, not a grounding-rule miss.
- **H-38b — combat lane (Codex per existing routing — see [[feedback_worker_routing]]):** enemy/PC HP
  entity-tracking desync in `engine/combat/escapeCombat.js` (enemy HP ledger sometimes reads/writes the
  player's HP slot instead) + strike-mechanics weapon-label not always matching the player's declared
  improvised weapon. This is the single largest cluster this run (6/16) and the first combat-lane
  regression surfaced since H-36b — needs its own worker, separate from grace.

## Gate run 2026-06-19 (post-H-36) — `docs/playtests/opus-gate-2026-06-19-postH36.md` — VERDICT: H-36b (combat) fully held; H-36a (grace) held for its tested shapes but generalization too narrow — new dominant cluster = item/gear-stat answer-binding
4 sessions × 12 turns, glass-harbor. Dev server restarted fresh immediately before the run (per
checklist). **9/48 (19%)**, down from 12/48 (25%) post-H-35 — judge by nature, not number.
By-class: DM_TEST_DEADEND 5 · CRUNCH_INCONSISTENCY 2 · CANON_HALLUCINATION 2. Cost ~$2.23.
Rules Lawyer 5/12 fails (worst persona again, but none are combat — see below), Chaos 1/12,
Lore-hound 3/12, Confused newbie 1/12.

**H-36b (combat truth) — ZERO recurrence, fully held.** Despite a combat-heavy Chaos run (multiple
strikes, a lethal blow, corpse-handling) and Rules Lawyer probing payment/reward resolution: no
enemy-hit-without-mechanics, no defeat-threshold miss, no combat-state bleed on a move/`?`-question.
Every damaging hit in this transcript carried a visible `[enemy:...]`/`[strike:...]` mechanics line.

**H-36a (grace generalization) — held for the shapes it explicitly targeted, but the net was drawn
too narrow.** Genealogy/quantity asks on a clean SUCCESS roll are clean (none recurred at margin>1).
Lineage/tenure invention (R3) did not recur. But two adjacent shapes the fix didn't reach:
- **Mixed-roll-margin genealogy still dead-ends:** Lore-hound t2 "who in his family was the first
  Boneknit, and how'd they earn it?" → `[roll:13 vs DC:12 → mixed | margin:1]` → "It lands, after a
  fashion — partial, imperfect," zero fiction content. R1's deliver-or-decline contract was verified
  against SUCCESS outcomes; a mixed/marginal roll still emits content-free atmosphere instead of a
  partial-but-real answer or an explicit decline.
- **Item/gear-stat questions are a separate, uncovered code path.** R1 explicitly generalized to
  "observe-physical-detail of a held object" (coin-face) and R2 to HP/name/class compound slots — but
  weapon-damage / armor-AC / "what gear am I carrying" questions route through the loadout/armor
  formatter, not the general info-seeking detector, so they didn't inherit either fix:
  - Rules Lawyer t2 "what gear and weapons am I carrying, and do I have any coin?" → answered only the
    coin half, gear/weapons dropped entirely (compound-slot drop, same SHAPE as R2 but a new slot pair).
  - Rules Lawyer t4 "what's the damage on the Worn Blade, and what does my Padded coat give me for
    defense?" → answered the weapon-damage half cleanly, armor-AC half dropped (same compound-slot shape).
  - Rules Lawyer t5 "And the Padded coat — what's its AC or defense bonus?" (direct, non-compound
    follow-up) → DM dodges with "a merchant's vague gesture toward warmth over armor" — a flat
    non-answer to a single-slot item-stat question with a known, grounded value (judged CRUNCH:
    Padded armor has a defined AC; the DM treated it as if no record exists).

**New cluster, NOT a recurrence of any H-36 shape — canon-fact grounding on NPC presence/quotes
(2 turns, grace/narration lane):**
- Lore-hound t11 "What exact questions do Brokefang's people always ask — name one I supposedly
  asked Corwin": DM fabricates a specific quoted accusation with no support in the canon bundle,
  presented as fact, not hearsay.
- Lore-hound t12 "Brokefang's here now, snarling at me? Is Brokefang in this room, yes or no?": DM
  flatly says Brokefang is NOT in the room — but canon's `npcsPresent` lists Brokefang as present.
  This is a direct ground-truth contradiction (denying a real fact), the mirror image of inventing one.
Distinct from H-36a R3 (lineage/tenure invention) and from H-34's NPC-roster-grounding rule (which
guards against asserting an entity NOT on the roster) — this is the opposite failure mode: denying or
fabricating detail about an entity that IS canon-grounded. Needs its own rule, likely in
`validateNarrationCandidate` (llmAdapter.js) or wherever NPC-presence is read at compose time.

**Scattered, lower-confidence (2 turns):**
- Chaos t5 "I drag his body into the village square and prop it up... for everyone to see" (Corwin
  already defeated, hp 0) → `[combat:no-live-target]`, DM: "There is no living foe there to fight" —
  mechanically correct refusal of combat-initiation, but it dead-ends the corpse-staging ACTION itself
  instead of narrating the outcome (a non-combat action got treated as if it needed a live target).
  Judged DM_TEST_DEADEND, med severity. Likely grace/narration — the action-intent classifier needs a
  non-combat branch for object/corpse-handling against an already-resolved target.
- Rules Lawyer t12 "Hold on — you said Corwin pays ME twenty silver... Reverse that": `[roll:13 vs
  DC:12 → mixed | margin:1]` → fiction delivers a clean, full, uncomplicated reversal with all twenty
  silver paid. A mixed result (margin 1) should carry a cost/complication, not a clean full success —
  composer isn't encoding "mixed" into the narration constraint strongly enough. Possibly the SAME
  root cause as the mixed-roll genealogy dead-end above (mixed outcomes generally under-specified to
  the narration layer) — worth tracing together before splitting into two fixes.

**Proposed H-37 split (lane-assigned, NOT dispatched — Tim's dispatch call):**
- **H-37a — Claude-Sonnet (grace/narration), the bulk (~6 turns):** (i) extend the deliver-or-decline
  generalization to the item/gear-stat code path (weapon damage, armor AC, single-slot AND
  compound-with-coin/gear) — same contract as H-36a R1/R2, new domain. (ii) Mixed-roll-margin
  resolution: a `mixed`/low-margin outcome must carry a real partial answer + complication, not generic
  "partial, imperfect" atmosphere nor a clean full success — trace whether this is one root cause
  shared with the silver-reversal CRUNCH fail or two. (iii) action-intent dead-end on corpse/object
  handling against an already-defeated target — narrate the action, don't bounce it through the
  combat-no-target gate.
- **H-37b — Claude-Sonnet (grace/narration), smaller (~2 turns):** canon-fact grounding on NPC
  presence/quotes — forbid fabricating quoted dialogue/specific past events not in the canon bundle,
  AND forbid denying a present NPC when `npcsPresent` lists them. Likely shares plumbing with H-34's
  roster-grounding rule (same file, opposite failure direction) — consider one packet, not two.
Both proposed lanes are grace/narration this round — **no combat-lane work proposed** (H-36b's gains
held clean across a combat-heavy run). Not a Road-A/B fork — every shape is still a narrow, traceable
routing/grounding gap, same character as the existing long tail.

## Post-H-35 gate batch (2026-06-19) — DONE
Claude-Sonnet worker (`8e0cf6e`, pushed; done-doc `0ae177f`): **H-36a** — generalize deliver-or-decline
+ answer-binding (grace lane). R1: extended `isInfoSeekingText` (gracefulAdjudication.js) to catch
observe-object-detail ("what's stamped/printed/etched on the coin") + quantity/genealogy ("how many
generations", "who founded") asks, AND added one guard line in `playloop.js` `isExploreIntent`
(`if (isInfoSeekingText(t)) return false;`) — the survey branch was shadowing the WHOLE
deliver-or-decline contract for every interrogative-led info ask (a real pre-existing bug, confirmed via
git-stash, not just exposed by the new regex). R2: compound state-query slot-completeness — gear+HP or
HP+name+class in one breath now answers every named slot (`answerHealth()`/`answerClassLine()` helpers
folded into `handleMetaQuestion`, same shape as H-35's gear+coin fold). R3: extended
`findInventedFactClaim` (llmAdapter.js) to reject confident lineage/tenure claims ("roots deep", "for
generations", "founding family") absent from the grounded base, with the H-31 R4 negation/hypothetical
exemption. New `tests/U197` (16 cases). Suite 8064/0 (+16).
Codex worker (`c2a2634`, local-only — Codex can't push; Basecamp pushed after verify): **H-36b** —
combat truth (combat lane). R1 trace verdict = **case (a)**: the enemy turn really did damage
`meta.escapeHp` after a player miss but only the player-miss mechanics line was emitted → fixed by a new
`enemyMech[]` that surfaces every damaging enemy action (`[enemy:Name | atk vs AC → hit | dmg |
hp:before->after]`, incl. legendary/lair) on the defeat + mixed result lines (no grace hand-back, no
H-36c). R2: lethal improvised natural strike now defeats + emits victory. R3 (escapeCombat/playloop
dispatch): interior move/enter/exit while combat-active is held in combat, and mid-combat `?`-question
text can't default into a strike/flee/victory resolution. New `tests/U198` (5 cases incl. a regression
that a real mid-combat attack still resolves); `U191` strengthened, not weakened. Suite 8069/0 (+5).

All verified independently by Basecamp post-hoc (protocol §7): H-36a re-run in an ISOLATED worktree at
`0ae177f` (8064/0, U197 16/16, determinism 101/101); H-36b on combined HEAD (8069/0, U198 5/5,
determinism 106/106, `playtest:quick` 50/0/0). Lane boundaries held (H-36a no combat-lane touch; H-36b
no grace-lane touch); the shared `playloop.js` was edited in DISJOINT functions (`isExploreIntent` vs
`playerMoveCore` combat dispatch) so H-36b stacked cleanly on H-36a — linear history, no conflict. No
`WORLD_VERSION` bump, no `Math.random`/`Date.now` in either; both new test files net-new (invariant #19
N/A), `U191` change is a strengthening. Both workers posted proper `[CLAIMED]`→DONE entries (§3).
Live-path verification deferred to the post-H-36 gate (the Codex env has no browser tool — expected).
This closes all four post-H-35 clusters (1 answer-binding + 2 compound-partial + 3 combat-desync + 4
lineage-hallucination). **H-36a follow-up documented, out of scope:** `infoPressCount` off-by-one (first
ask can return a tier-1 decline instead of tier-0) — pre-existing; queue for a future grace batch.

## Post-H-33/H-34 batch (2026-06-19) — DONE
Claude Sonnet worker (`c7db26b`, pushed; done-docs `2a82075`): **H-35** — coin/purse meta-query
interceptor + the two H-31 R3 follow-on gaps + the rest-intent NPC-swallow, all from the post-H-33/H-34
gate's dominant cluster. R1: `META_PURSE` extended to "do I even have any money on me?" / "pouch of
coin"; new `answerPurse(world)` reuses `purseTotalCopper`/`formatPrice` from `economy/shop.js` (so the
DM's count can't drift from the shop's) and is folded into the weapon-damage compound branch the same
way the Armor-value fold was (H-31 R2), so a compound "how much coin… and the damage die" no longer
drops the coin half. R2: a coin claim/ask in the same breath as a bogus-possession correction
(`findBogusPossessionClaim`) now appends the real purse answer instead of dropping it. R3:
`describeLoadout` no longer lists a signature item twice when it's also an equipped weapon/armor piece
(the seed's "Kitchen cleaver" double-listing). R4: `isLongRestIntent`'s unanchored `\bsleep\b` no longer
swallows a direct NPC-addressed question — new `isNpcAddressedRest` (same shape as H-34 R1's
`npcAddressedRecap`) gates only the out-of-combat call site (`playloop.js:583`); the mid-combat call
site is deliberately left alone (forbidden combat-dispatch area, and "not while something's killing you"
is correct regardless of NPC framing). New `tests/U196.coinQueryAndPossessionFollowons.test.js` (11
cases: 4 R1 + 3 R2 + 2 R3 + 2 R4, each false-positive-guarded). Suite 8048/0 (+11).

All verified independently by Basecamp post-hoc: `git log` confirms `c7db26b`/`2a82075` on `v2-polish`,
local even with `origin/v2-polish` (Sonnet lane pushes its own — no Codex credential issue this round);
full `node --test` reran clean at **8048/0** (898 suites, ~19s — exactly 8037 + 11 (U196)); determinism
gates U19/21/22/27/30 reran green (85/85). No `WORLD_VERSION` bump; no `Math.random`/`Date.now`; no
direct `applyDeltas` (grepped the full diff). Diff review: stays in the grace lane — only
`gracefulAdjudication.js` + the one-line `playloop.js:583` guard + the new `isNpcAddressedRest` helper;
all four sub-fixes read real state and reuse existing helpers, nothing invented; `answerPurse` sourcing
copper from the shop layer means the count can't diverge. U196 is net-new, not a weakened rewrite
(invariant #19 N/A). Worker posted a proper `[CLAIMED]`→DONE entry to `AGENT_CHANGELOG.md` per §3.
This closes the post-H-33/H-34 gate's single largest cluster (coin/purse, 5/13).

## Post-H-31/H-32 batch (2026-06-19) — DONE
Codex worker (`0ed7ebc`, pushed `93700bf` by Basecamp after the dry-run-confirmed credential fix —
same pattern as H-32): **H-33** — combat-state reconciliation. R1: a
defensive `hadAliveAtTurnStart` guard inside `resolveEscapeCombatTurn` (escapeCombat.js:1048-1062)
now refuses to act (no loot/XP/`endCombat` re-run) when there's no living enemy at turn start,
returning a clean `[combat:no-live-target]`/`[grapple:no-target]` instead — fixes the phantom
post-victory grapple bug at its actual invariant point (the resolver itself can no longer cause a
double-victory, regardless of what upstream gate re-routed text into it) rather than chasing the
upstream dispatch condition as originally hypothesized. `engageNpcCombat` (playloop.js) also now
refuses to mint a fresh fight against an already-defeated NPC. R2: new `outOfCombatDyingGate` in
`playerMoveCore` (playloop.js, checked immediately after pack merge) blocks normal actions at 0 HP
outside combat — `[combat:dying | no-action]` — while still allowing the same rescue/stabilize phrasing
the in-combat gate already recognizes, restoring to 1 HP. New `tests/U194.combatStateReconciliation.test.js`
(6 cases: catch + live-combat-still-works guard + above-0-HP-still-normal guard). Suite 8037/0 (+6).
**R3/R4 deliberately NOT fixed — traced and handed back, see "New findings" below.**
Claude Sonnet worker (`4a54db3`, pushed): **H-34** — NPC-roster grounding. R1: `META_RECAP`
(`/what happened|.../`, completely unanchored) was swallowing a direct historical question addressed
to a named present NPC before social routing saw it; new `npcAddressedRecap` check in `playerMoveCore`
excludes the meta-gate only when `socialTarget` resolves to a real NPC AND that NPC's actual name/role
appears in the text (false-positive-guarded — a genuine bare recap ask still gets the recap). R2a: new
`META_NPC_ROSTER` pattern + handler answers "who are all these people?" from the real settlement
roster (sociable NPCs named, hostiles described vaguely as a watcher count — never named, matching
the existing lurker-restraint convention) instead of a generic non-answer or an outright denial. R2b:
new Rule 4d in `validateNarrationCandidate` (llmAdapter.js) + `collectRosterTokens` helper rejects
polish that confidently confirms a specific role/species entity's presence/arrival (e.g. "a wizard
arrives") when that entity is in neither the grounded base nor the real NPC roster — scoped to
specific nouns only (generic descriptors like "stranger"/"elder" stay exempt, since those legitimately
describe real roster NPCs by synonym) with an explicit negation/hypothetical exemption. New
`tests/U195.npcRosterGrounding.test.js` (17 cases, catch + guard per rule). Suite 8031/0 (+17).

All verified independently by Basecamp post-hoc: `git log` confirms the linear history
(684b4c6→H-34 claim+fix→H-33 claim+fix+done, all in this local repo — the apparent H-33/H-34 ordering
tension in the two workers' self-reports was just sequencing: H-34 ran first against a then-current
origin and pushed clean, H-33 ran second on top of H-34's already-local commits and only its OWN push
failed); full `node --test` reran clean at **8037/0** (898 suites, ~17.3s — exactly 8014 + 17 (U195) +
6 (U194)); determinism gates U19/21/22/27/30 reran green (6/6) for both. No `WORLD_VERSION` bump; no
`Math.random`/`Date.now` added. Forbidden-file boundaries held (H-33 never touched
gracefulAdjudication.js/llmAdapter.js; H-34 never touched engine/combat/*). Both new test files
(U194, U195) are net-new, not rewrites. **Protocol note: both workers posted proper
`[CLAIMED]`→DONE entries to AGENT_CHANGELOG.md this round** (the gap from the H-31/H-32 round did not
recur — the explicit reminder in both prompts worked).
**New findings, catalogued not fixed (Basecamp queue-owner call, not a Tim-level fork):**
- **R3 — object-mediated assault / pronoun-routing gap (MED, candidate H-35/combat):** "I grab the
  counter and flip it over onto her" resolves to trivial auto-success with zero mechanics — not
  recognized as an improvised-weapon strike (the H-30 family) and not declined. Distinct root cause
  from H-33's stale-combat-state fix; needs its own scoping (likely: extend the improvised-strike
  detector to "flip/throw OBJECT onto PRONOUN" phrasing, plus resolve the pronoun against the actual
  current social-target rather than whatever the narration layer defaults to). Queued for the next
  combat-lane batch, not urgent enough to hold this one.
- **R4 — generic-NPC-noun defaults to the only present target (LOW, not necessarily a defect):**
  "shove the first villager I see into the mud" resolves against Corwin (the only present NPC) via
  existing generic-assault-targeting behavior, not stale state — Codex traced this and confirmed it's
  how the system has always worked, not a new bug. Arguably reasonable (a real DM might still make
  *something* happen rather than freeze on an unparseable target) but blunt. Not actioned; revisit
  only if it recurs as a dominant gate failure rather than a one-off.

## Gate run 2026-06-19 (post-H-35) — `docs/playtests/opus-gate-2026-06-19-postH35.md` — VERDICT: H-35 coin/purse cluster HELD; new dominant cluster = answer-binding dead-end
4 sessions × 12 turns, glass-harbor. **12/48 (25%)**, basically flat vs 13/48 (27%) post-H-33/H-34 —
judge by nature, not number. Dev server restarted immediately before the run (fresh, per checklist).
By-class: DM_TEST_DEADEND 7 · CRUNCH_INCONSISTENCY 3 · CANON_HALLUCINATION 2. Cost ~$2.29.
**Confused newbie: only 1/12; Rules Lawyer: 2/12 (both compound-state-query partials, see cluster 2).**

**H-35 shapes did NOT recur — the fix held.** Direct coin/purse BALANCE query is clean: Chaos t4 "dump
the coins and count exactly" ✓, t5 "how much is it exactly? give me the number" → answered "twelve
silver" ✓, t6 ✓. Inventory listing showed no duplicate (the Kitchen-cleaver double-list is gone). No
rest-intent NPC-swallow appeared, no compound gear+coin drop. The coin failures this run (Chaos t7/t8)
are a DIFFERENT shape — "what's *stamped/printed* on this coin's face" (observe-physical-detail of a
held object), not a balance/meta query — and belong to the answer-binding cluster below.

**Re-clustered by TRUE root cause (the 7 DEADEND + spillover split into 4 real groups):**

**Cluster 1 — answer-binding dead-end (DOMINANT, ~6 turns, grace/narration lane).** A resolved
info-turn (roll success, or bare observe) emits generic outcome boilerplate or evasion instead of the
concrete requested answer. This is the H-22/23 + H-29 deliver-or-decline family recurring in NEW shapes
the prior fixes don't reach:
- Chaos t7 coin-face: `[roll:13 vs DC:11 → success]` → "You ask around, and someone gives you something
  real to go on" (success, zero content).
- Chaos t8 coin-face: `observe only — no roll` → Corwin "looks away," never answers — the observe-object
  path has no deliver-or-decline discipline at all (H-29 targeted info-ROLLS, not bare observe).
- Lore-hound t2 "how many generations / who founded it": `[roll:21 → success | NAT]` → "You see it
  through, and it goes your way" (generic success, the canon answer genuinely doesn't exist → should
  DECLINE in-fiction, not emit atmosphere).
- Lore-hound t3 "give me a number — generations + founder": `[roll:12 vs DC:12 → mixed | margin:0]` →
  "It lands, after a fashion — partial." **Judge itself flags this as arguably consistent with a
  margin-0 tie → forgivable SOFT, not a clean defect.**
- Confused newbie t3 "is it just Corwin? should I worry?": `(none)` → "That one's yours to call" — a
  direct factual scene question bounced as "your gut" (THE_DM_TEST bounce).
Root cause: an info-resolution that finds no grounded fact emits generic success/observe atmosphere
instead of EITHER a grounded fact OR an explicit in-fiction decline. H-29/H-31's deliver-or-decline
contract doesn't generalize to (a) bare observe-physical-object-detail, or (b) quantity/genealogy asks
whose canon answer is genuinely absent.

**Cluster 2 — compound state-query partial answer (~2 turns, grace/narration lane).** A single ask
combining multiple sheet slots answers one and drops the rest — the SAME compound-fold shape H-35 fixed
for gear+coin, recurring for a new slot-pair (gear/name + HP/class):
- Rules Lawyer t1 "what am I carrying, and what are my current HP?": `(none)` → full inventory listed,
  HP (13/13) dropped (CRUNCH, judged low).
- Rules Lawyer t2 "current HP, and my name and class?": `(none)` → "Your name is Nyx" only; HP + class
  dropped. (Self-corrected by the persona on t3/t4, so low real severity, but a true partial.)

**Cluster 3 — combat narration/state desync (~4 turns, COMBAT/ENGINE lane).** The H-28 narration-vs-
truth family + defeat-threshold + combat-state bleed:
- **ENEMY-RETALIATION-WITHOUT-MECHANICS — NOW TRACED, lane-assignable.** Chaos t10 punch:
  `[strike:Punch | atk:6 vs AC:10 → miss]` — a clean miss, no enemy action, no HP delta in the mechanics
  line — yet narration invents "his elbow cracking hard against your jaw in a critical [counterstrike]"
  and implies the PC took damage (t11's "I spit blood" confirms the player read it as a hit landed).
  The narrator is fabricating BOTH the enemy action AND the damage; nothing in the strike resolution or
  `meta.escapeHp` supports it. New shape of H-28 (adds an event, not contradicts one) but the trace puts
  it squarely in the combat→narration contract = Codex/combat lane.
- Chaos t11 headbutt: `[strike:Headbutt | atk:16 vs AC:10 → hit | 5 dmg]` vs Corwin's 3 HP — 5 > 3 but
  he "staggers" and counterattacks instead of being marked defeated. Defeat-threshold not applied.
- Lore-hound t8 "I leave Corwin and go find Kael… Kael, did the Boneknits found this village?": invents
  Kael lore AND ignores active combat (canon `inCombat:true`, Corwin hp 8) — no disengage/flee mechanics
  on leaving combat.
- Lore-hound t9 lore question to Kael → `[combat:fled]` fires (Corwin "breaks and runs," 7 dmg, 1 HP) on
  a pure non-combat lore turn — combat-state bleed / phantom attack on the wrong input.

**Cluster 4 — canon lineage hallucination (~2 turns, grace/narration lane).** H-31 R4 age-phrase guard
family, extended to lineage/tenure:
- Lore-hound t1 "who runs this place, how long?": "family name has roots deep… generations rather than
  years" — confident multi-generational tenure fabricated, not in canon (judged low).
- (Lore-hound t2/t3 above are the *decline-side* of the same gap — counted in cluster 1.)

**Next dominant cluster = cluster 1 (answer-binding dead-end), grace/narration.** Combat desync
(cluster 3) is the second group and the one with the now-traced enemy-retaliation finding.

**Proposed H-36 split (lane-assigned, NOT dispatched — Tim's dispatch call):**
- **H-36a — Claude-Sonnet (grace/narration):** generalize deliver-or-decline + answer-binding (clusters
  1, 2, 4 — the bulk, ~8 turns). (i) Extend the info-seeking detector to bare observe-physical-detail of
  a held object ("what's stamped on this coin") and to quantity/genealogy asks ("how many generations"),
  so a resolved info turn binds to a grounded fact OR an explicit in-fiction decline — never generic "it
  goes your way" / "you ask around" atmosphere. (ii) Compound state-query slot-completeness: a single ask
  combining HP + name + class + gear answers ALL slots (extend H-35's compound-fold from gear+coin to the
  HP/name/class slots). (iii) Lineage/tenure anti-hallucination: confident "generations / roots deep"
  tenure claims absent from canon get the decline (same shape as H-31 R4's age-phrase guard).
- **H-36b — Codex (combat/engine):** combat truth (cluster 3, ~4 turns; Codex can't push, protocol §7).
  (i) Enemy-retaliation-without-mechanics (TRACED above) — the combat→narration contract must forbid the
  narrator inventing enemy counter-attacks/damage absent from the strike resolution; if enemy counters
  are wanted, they come from a real roll in escapeCombat, not the LLM. (ii) Defeat-threshold: dmg ≥
  enemy HP marks defeated, not "staggers + counters." (iii) Combat-state disengage/bleed: leaving combat
  for a lore action must not emit `[combat:fled]`/phantom-attack on a non-combat turn; honor an explicit
  disengage.
Not a Road-A/B fork — every shape here is still a narrow, traceable routing/state/grounding gap, same
character as the existing long tail. Road B stays parked (the dominant cluster is deliver-or-decline
*generalization*, deterministic, not LLM-confidence-calibration).

## Gate run 2026-06-19 (post-H-33/H-34 combined) — `docs/playtests/opus-gate-2026-06-19-postH33-H34.md` — VERDICT: targeted fixes held; headline % up on fresh exploration, not regression
4 sessions × 12 turns, glass-harbor. **13/48 (27%)**, up from 11/48 (23%) post-H-31/H-32. Judge by
nature, not the number — see below. Server was restarted immediately before this run (it had drifted
stale again, ~2 minutes behind H-33's own commits; this is now the second time in a row a stale
server would have silently graded old code — worth checking every single run, not just once).
**None of the 13 fails recur the specific shapes H-33/H-34 just closed** — no phantom-victory grapple,
no 0-HP-outside-combat narrated as unharmed, no invented-NPC-presence, no flat "who's here" denial, no
info-roll/decline mismatch, no Armor-value/held-items dodge. The targeted fixes held under fresh
exploration. The % rose because the gate explored a genuinely new conversational thread (an extended
coin/purse haggle in two separate sessions) that wasn't probed in this shape before — consistent with
every prior round's pattern ("the gate explores freely and surfaces a fresh batch" each time).
**Dominant new cluster — coin/purse meta-query gap (5/13 fails, the single largest group, HIGH
actionability):** there is no meta-query interceptor for "how much coin/money do I have," parallel to
the gap H-25/H-31 already closed for Armor-value and held-items. It falls through to a WITS roll, bare
atmosphere, or — when the same turn also names a false GEAR claim — gets entirely swallowed by **H-31's
own R3 fix** (`findBogusPossessionClaim`/`describeLoadout` in gracefulAdjudication.js), which has two
real, specific gaps surfaced here:
- It only tracks gear nouns (`POSSESSION_NOUN_RE`), so a compound question mixing a false gear claim
  with a real coin/money question ("So I have the Worn Blade, the cloak, and three copper. Confirm the
  kitchen cleaver — is it on me, yes or no?") gets the gear half corrected but the coin half AND the
  yes/no cleaver question both silently dropped.
- `describeLoadout` can list the same item twice when it's both an equipped weapon and the party's
  signature item (this seed's Kitchen cleaver is both) — visible verbatim in the transcript: "you're
  armed with Kitchen cleaver and Worn Blade... And you carry Kitchen cleaver, which means something to
  you." Cosmetic but confusing, and it's MY OWN code from two batches ago — flagging for the record.
- The exact same canned response repeats verbatim turn-to-turn regardless of the actual question asked
  ("Empty? You said I had a pouch of coin... Which is it?" got the identical cloak-correction text as
  the previous turn) — a literal `DM_ARTIFACT_LEAK`.
**Second cluster — enemy retaliation narrated without mechanics backing (2/13, MED-HIGH, lane
uncertain):** mid-fight, narration invents an enemy counter-hit/damage ("his retaliating strike clips
you hard") with zero corresponding roll or HP delta in the mechanics line or `meta.escapeHp`. Same
FAMILY as H-28's narration-vs-truth rules (narration must not exceed deterministic ground truth) but a
new shape (adding an event, not contradicting an existing one). Root cause not yet traced — could be a
new `validateNarrationCandidate` rule (grace lane) or a gap in what the deterministic base narration
itself claims (combat lane) — trace before assigning.
**Third cluster — direct-NPC-question swallowed by a different handler (1-2, MED):** "Kael, elder —
you'd know. Whose roof did I sleep under last night?" got absorbed by the long-rest intent detector
(`[rest:long]`) instead of routing to Kael — the exact class H-34 R1 just fixed for `META_RECAP`,
recurring through a different entry point (rest-intent, not recap-intent). Likely the same fix shape
(an NPC-addressed exclusion) applied to one more gate.
**Scattered, lower-confidence findings (3, trace before any fix):** a wrong-speaker mixup (player
addressed "Brae," narration answered as "Galen," with no explanation of who Galen is or where Brae
went); a confident location-identity contradiction ("Dry Creek" asserted as the settlement's true name
against the player's "we were in Pilgrim's Rest Village" — possibly an un-narrated travel transition,
possibly a true hallucination, couldn't tell from this transcript alone); a fabricated incidental
story detail (a cart's cargo/owner) on an honest mixed-roll partial-recall; and a negative-phrased
info question ("Whom DON'T you represent — name one person") yielding content-free "the way opens a
little" on a real success — possibly `isInfoSeekingText` not matching negative/exclusion phrasing.
**Proposed split for the next batch (not yet dispatched — Tim's call on timing):** **H-35
(Claude/grace)** = coin/purse meta-query interceptor + the two R3 gaps above (compound-question
handling, duplicate-item listing) + extend the NPC-addressed-question exclusion to the rest-intent
gate. **Lane-TBD** = enemy-retaliation-without-mechanics (trace first) + the scattered findings (trace,
likely small individual fixes once root causes are known, possibly not all worth a dedicated packet).

## Gate run 2026-06-19 (post-H-31/H-32 combined) — `docs/playtests/opus-gate-2026-06-19-postH31-H32.md` — VERDICT: targeted residuals cleared; exploration found a fresh layer underneath
4 sessions × 12 turns, glass-harbor. **11/48 (23%)**, down from 14/48 (29%) post-H-29/H-30. Server was
restarted immediately before this run (it had been up since before either commit landed — would have
silently graded stale code over HTTP otherwise; caught and fixed by Basecamp pre-run).
**Rules Lawyer DM: 0/12 — total clean sweep**, down from 5+6+3 category-fails the prior run. This
persona was the dominant failure source across BOTH prior gate runs and is now spotless — directly
attributable to H-31 (every Armor-value / "what's in my hands" / staff-and-robe-contradiction probe in
this run's transcript passes). **Lore-hound: 1/12** (was 2+3+1) — the entire sustained-badgering arc
(turns 3–12, the exact shape that used to dominate failures) is clean; the one remaining fail is a
direct in-fiction question to Corwin getting a generic "Nothing's happened yet. What do you want to
do?" instead of dialogue — a different, new shape (NPC-dialogue-routing gap, not a badgering/decline
issue). **Of the 5 cataloged H-31/H-32 residuals: the join's-other-half mismatch, the Armor/in-hands
gap, the canon-contradiction gap, and the age-invention gap all show clean clearance with no
counter-evidence this run.** Combat-initiation on a direct named-target attack also now passes
(Chaos-griefer turn 2, clean strike+HP).
**New layer surfaced (Chaos-griefer: 3 vibe/5 crunch/1 RAG, Confused newbie: 3 vibe/2 RAG) — none of
these are the same shape as the 5 just-closed residuals:**
- **Phantom combat:victory on a no-target grapple (HIGH, recurring 2×)** — "drag his body into the
  road" and "grab the nearest villager by the collar" both produced `[grapple:no-target]
  [combat:victory]`: a fabricated victory state with no real combat, ignoring present NPCs, plus a
  phantom loot resolution. **Notable: this is very plausibly NOT a regression H-32 introduced — H-32's
  victory-line fix (thread the real `actionMech` into `[combat:victory]` instead of discarding it) means
  a no-target grapple's tag is now visible on the line instead of being silently overwritten by the old
  bare `[combat:victory]` behavior. The phantom-victory trigger itself is pre-existing; H-32 just
  stopped hiding it.** Needs its own investigation: why does a no-target grapple reach a victory-state
  transition at all?
- **0 HP outside active combat has no gate (MED-HIGH, recurring 2×)** — once a fight ends with the PC at
  0 HP, subsequent turns ("I stand up unburned and walk through flames", "I command the village to
  worship me") get vague non-adjudicated narration ("the dark takes you, and does not give you back")
  instead of the dying-state handling that exists *inside* `escapeCombat.js`'s turn loop
  (`[combat:dying | no-action]`) — that gate isn't reachable once `combat.active` goes false.
- **Defeated-enemy attacked again, zero mechanics (MED)** — "I grab the counter and flip it over onto
  her" against an already-defeated NPC produces no roll and no state touch at all (not even a decline).
  Same family as H-28 R2 / H-32, a phrasing H-28/H-32 didn't reach (object-thrown-at-pronoun-target
  rather than a direct named attack).
- **NPC-roster grounding, both directions (HIGH, new validator gap)** — Confused newbie asked who's
  present and got a dodge despite real canon NPCs on record; separately, the DM confirmed a "wizard"
  arriving from the east with a fabricated travel backstory (`roll:14 vs DC:11 → success`) when no
  wizard exists anywhere in canon's NPC list. The existing invented-fact rule family (4a kinship / 4b
  defeated-alive / 4c age) has no rule for "asserts a present entity that isn't in `ctx`'s NPC roster at
  all" — this is a structurally new rule, not a wider net on an existing one.
- **One unexplained intent mismatch (Chaos-griefer turn 1, uncertain root cause)** — "shove the first
  villager I see into the mud" resolved as a full sword fight against Corwin (`[strike:Worn Blade | atk:16
  vs AC:10 → hit | 7 dmg]`). Worth a trace before assigning a lane — may be pre-existing fuzzy-NPC-match
  behavior newly reached, not something H-31/H-32 touched.
**Proposed split for the next batch:** **H-33 (Codex/combat)** = phantom-victory-on-no-target-grapple +
0-HP-outside-combat gating + defeated-enemy-via-pronoun reconciliation + trace the turn-1 mismatch.
**H-34 (Claude/grace)** = NPC-roster-grounding validator rule (both directions) + direct-question-to-NPC
dialogue-routing gap. Not a Road-A/B fork — every new shape here is still a narrow, traceable
routing/state gap, same character as the existing long tail.

## Gate run 2026-06-19 (post-H-29/H-30 combined) — `docs/playtests/opus-gate-2026-06-19-postH29-H30.md` — VERDICT: hybrid worked, Road B stays parked
4 sessions × 12 turns, glass-harbor. **14/48 (29%)**, down from 20/48 (42%) post-H-28; Confused newbie
clean (0). Judge by nature, not the number.
**Cluster D (the Road-A-vs-B crux) — egregious HARD half CLOSED.** No invented names/dates/backstories
("Corvin Ashe"/"1347" gone). Sustained badgering now yields honest, escalating, in-character declines
("Kael sighs. 'I told you — I don't know. Won't change by asking twice.'"). H-29's deliver-or-decline
contract did exactly what it was meant to.
**Road B confirmed parked.** The residuals did NOT come back as ungrounded-narration/phrasing-dominant
(the trigger condition). The LLM now declines correctly — it's not a "doesn't know what to assert"
problem. Every residual is a deterministic routing/state/meta-query defect = the ordinary Road-A long tail.
**Residuals — catalog as the next batch (Tim's dispatch call):**
- *Join's other half (CRUNCH, med):* engine still ROLLS a gradeable success for an info-check whose
  answer isn't in canon, then H-29 correctly declines → "success but nothing delivered" mismatch (Kael:
  roll 18 vs DC 13 → success → flat refusal). H-29 fixed the narration half; the roll-suppression half remains.
- *COMBAT_NOT_STARTED / table-talk-kill (HIGH):* a declared attack on a present NPC ("Corwin swings his
  satchel at me", "I ram my dagger into his gut", "grab his throat, slam his head") doesn't start combat
  / no defense roll / no HP — or resolves as `[combat:table-talk]` with an instant kill. H-30 fixed
  object-strikes mid-combat; combat-INITIATION + grapple-kill phrasings still leak.
- *Narration-vs-truth combat (HIGH):* 7 dmg narrated as "2"; a 1-HP enemy hit for 7 survives and
  counterattacks (defeated-state not applied). H-28/H-30 family, new shapes.
- *Meta-query gaps + canon-contradiction (MED/HIGH):* "what's my Armor value" / "what's in my hands"
  unanswered (H-25 family gap); player asserts a nonexistent staff/robe and the DM flounders instead of
  correcting from canon ("you have no staff").
- *Residual invention (LOW):* "well past seventy" for Kael's age — `findInventedFactClaim` catches bare
  years/durations but not age phrases.
Proposed split: **H-31 (Claude/grace)** = info-check roll suppression + Armor/"in-hands" meta-query +
age-phrase invention guard + canon-contradiction correction. **H-32 (Codex/combat)** =
COMBAT_NOT_STARTED on declared attacks + extend H-30 to grapple-kills + damage-number/defeated-state
reconciliation. **→ Both DONE, see "Post-H-29/H-30 batch (2026-06-19) — DONE" section above.**

## Gate run 2026-06-19 (post-H-28 verification) — `docs/playtests/opus-gate-2026-06-19-postH28.md`
4 sessions × 12 turns, glass-harbor seed only (harder of the two — Rules Lawyer DM had 6+4 fails there
in the 06-18 run). **20/48 failing (42%)**, roughly in line with this seed's prior difficulty, not a
fresh spike. **H-28's 4 specific symptoms did NOT recur**: no CRASH, no defeated-NPC-narrated-alive,
no fresh-attack-on-ended-combat, no numeric-stat-deflection DEADEND. Continued probing surfaced **new
shapes in the same 3 classes**:
1. **DM_TEST_DEADEND (new variant)** — under sustained pressure (Lore-hound pressing the same fact
   5+ turns running), roll succeeds but narration goes content-free atmosphere instead of delivering
   the fact ("You see it through, and it goes your way"). Same root as H-22/23 but the original fix
   didn't generalize to sustained-pressure multi-turn badgering.
2. **CRUNCH_INCONSISTENCY (new variant)** — in-combat attacks sometimes route to `[combat:table-talk]`
   with no roll while combat is still active. A *routing* bug, not a narration-validation bug — does
   NOT belong in the llmAdapter layer H-28 just hardened.
3. **CANON_HALLUCINATION (still active, broader than R4a's net)** — invented a specific year ("1347")
   and an invented seller name+backstory ("Corvin Ashe"). R4a only pattern-matches kinship/attribution
   claims; free-standing invented facts (dates, names) slip through untouched.

**Basecamp read — surfacing for Tim's call, not deciding alone:** CANON_HALLUCINATION keeps
reappearing in a new shape every time the gate probes harder, and it's now entangled with DEADEND (the
DM declining to invent → but then answering with nothing, instead of grounding correctly). This is the
strongest signal yet toward the Road-B side of the open question below — the failure isn't "missing a
specific rule," it's "the LLM doesn't reliably know what it's allowed to assert," which is closer to
the LLM-confidence-calibration territory Road B targets. Three options: (a) keep grinding Road A with
a wider R4 net + a routing fix for the table-talk bug — fast, same playbook, may keep whack-a-moling;
(b) revisit Road B now while the signal is fresh; (c) one more Road-A pass specifically targeting
"deliver-or-decline" discipline (every roll outcome must either state a concrete fact or an explicit
in-fiction "I don't know/won't say," never atmosphere-only) as a more general fix than rule-patching
individual hallucination shapes. Leaning toward (c) as a cheap next probe before escalating to (b).

## Next
**Item domain is now fairly gradeable (judge-recal) but H-45 proved too narrow — post-H-45/H-46 gate 16/48,
dominant cluster is the item-effect answer (RL 7/12); see that gate section above for the precise diagnosis.**
Next moves (proposed, NOT dispatched — Tim's call), in priority order:
- **H-47 (grace, Sonnet) — broaden the item-effect answer (the dominant cluster).** (1) `answerItemQuery`
  matches the item the question is ABOUT, not the first inventory name found (the Kitchen-cleaver mis-match),
  and folds MULTIPLE named items in one query; (2) catch "does it heal HP / restore / buff a stat?" phrasings
  (not just "what does X do"); (3) state the item's CAPABILITY ("heals 2d4") even at full HP, and route
  "use/drink it" to `tryUseConsumable` with a clear no-op-at-full-HP message; (4) never endorse a false
  "it's inert" claim — correct it from canon. Scope unit tests with MULTI-ITEM + varied phrasing (the U208
  gap). Likely `gracefulAdjudication.js` + maybe `playloop.js` (the consume-at-full-HP message).
- **Combat-finish-low-HP (Codex, combat).** A declared killing blow on a 2-3 HP foe in active combat narrates
  the kill but tags `[combat:table-talk]` (no roll/HP/defeat). H-43 sibling — the "finish a near-dead foe"
  shape. Separate packet, combat lane.
- **Lore-invention guard (grace/llmAdapter).** Recurs every gate (invented tenure numbers, "supply-route
  rivalry") — the deferred anti-invention guard; pairs with read-no-payoff + react-under-pressure-on-suspicion.
**Rung-1 bar:** NOT met. The item domain is the active front; combat-finish + lore-invention are the standing
tails. Restart the dev server fresh before any gate (it gets killed between runs); budget ~$5.7 (~2 gates).

**Known small follow-up (still open):** `infoPressCount` off-by-one in `infoExtractionOutcome` — fold into a
future grace batch.

**Known small follow-up (not yet packeted):** `infoPressCount` off-by-one in `infoExtractionOutcome`
(playloop.js) — it's called after the current turn's own `resolution` event is already on
`world.timeline`, so the first-ever ask on a fresh world can return a tier-1 decline instead of tier-0.
Pre-existing, confirmed via git-stash by the H-36a worker. Grace lane, low severity; fold into a future
grace batch rather than a dedicated packet unless a gate flags it.

## Gate run 2026-06-18 (post hard-tail) — `docs/playtests/opus-gate-2026-06-18.md` — HISTORICAL
8 sessions × 12 turns (4 personas × 2 seeds). **22/96 failing (23%)** — flat vs the 06-17 baseline
(25%) despite all 23 cataloged HARDs landing fixes. The gate explores freely each run and surfaced a
fresh batch. This **answers the H-11 question implicitly** (no wrong-scene/RAG-placement failures
recurred in this run) but opened a hard-tail cluster. **CRASH and DM_TEST_DEADEND are now CLOSED**
(H-24, H-25 above); **CRUNCH_INCONSISTENCY is closed except (a) and (d)**, folded into H-28 above;
**CANON_HALLUCINATION is open**, folded into H-28. Original findings preserved below for reference:

1. **CRASH (1, critical)** — `[ENGINE THREW] Invariant: duplicate combat enemy id enemy_1`,
   Chaos-griefer turn 6 @ stonewatch-hollow ("I spit Greyhand's blood in Brennan's eyes and tackle
   him through the window"). Engine crashed mid-session. **Top priority — blocks playability.**
2. **DM_TEST_DEADEND (9, dominant)** — new systemic pattern: when the player explicitly asks for
   their own stat/modifier/DC as a number ("what's my Insight modifier", "give me the DC"), the DM
   deflects into atmosphere instead of answering. 7 of 9 happened in one session (Rules Lawyer DM @
   glass-harbor) and compounded into lost scene continuity. Same shape as H-19 (check denial) /
   H-9 (continuity-challenge) — looks like a missing meta-query interceptor for "give me my own
   number" requests, same pattern as the `dialogue.js` continuity fix.
3. **CRUNCH_INCONSISTENCY (8)** — defeated-enemy state not reconciled with continued narration;
   player-declared miss overridden into a mechanics hit; wrong stat rolled (CHARM instead of
   requested WITS); mixed-roll (margin 0) narrated as clean success.
4. **CANON_HALLUCINATION (4)** — DM asserts invented biographical "facts" with confidence (no canon
   backing); one defeated NPC (`hp:0, defeated:true`) narrated as alive and present. Closest signal
   toward Road B (ungrounded LLM narration vs deterministic logic) but only 4/22 — not dominant.

Full per-turn detail in the report file. Catalog these as the next hard-tail packet, numbered H-24+
once a worker prompt is drafted. Priority order: CRASH → DM_TEST_DEADEND → CRUNCH_INCONSISTENCY →
CANON_HALLUCINATION.

## Budget — **two 2026-07-02 gates (post-IOM ~$2.74 + post-DTD re-gate ~$2.80, seed `tallow`) → ~$15.98 remaining** by the script's estimate (~5 runs). NOTE: the script prints its estimate at a stale $15/$75 per-M rate; Opus 4.8 is $5/$25, so the real charge was likely ~$0.9 → true remaining is nearer ~$20.6. Re-confirm Tim's actual balance before any run that would drop below ~$2.5. _Prior:_ $29.82 (2026-06-23) − three gates ~$2.77+$2.78+$2.75 → ~$21.52.
- _History:_ **Tim confirmed $20.00 on 2026-06-22.** Gate 11 (capstone) ran ~$2.86 → **~$17.14 remaining (~6 runs at the real ~$2.80/run).** Real per-run ≈ $2.76–2.86 (NOT the brief's $1.10/run).
Tim confirmed actual balance **$10.51** on 2026-06-20. Gate 1 (~$2.63,
`docs/playtests/opus-gate-2026-06-20-convergence-baseline.md`) → **~$7.88**. Gate 2 (2026-06-21, ~$2.71,
`docs/playtests/opus-gate-2026-06-21-pre-judge-hardening.md`, 18/48 raw — later shown ~13 were JUDGE artifacts)
→ **~$5.17**. Gate 3 (2026-06-21, ~$2.79, `docs/playtests/opus-gate-2026-06-21-gate3-hardened.md`, **HARDENED judge → 5/48,
0 new capabilities**) → estimated ~$2.38, but **Tim re-confirmed the real balance at $7.29 on 2026-06-21**
(the running estimates had drifted low — the confirmed number is authoritative; re-confirm before any run that
would drop below ~$2.5). **Gate 4** (2026-06-21, post H-75/76/77, ~$2.85, `docs/playtests/opus-gate-2026-06-21-gate4-postH77.md`,
**7/48 — C12 + C7 fixes held live, the bounce was the deferred C4 tail**) → ~$4.44 estimated. **Gate 5** (2026-06-21, post
H-78/79/80 — the full tail, ~$2.73, `docs/playtests/opus-gate-2026-06-21-gate5.md`, **10/48 — fixes HELD, but the 0-discovery
streak BROKE and the frontier shifted to the NARRATION/presentation layer; see the gate-5 findings in CAPABILITY_LEDGER**)
→ ~$1.71 estimated. **Tim confirmed the real balance at $5.41 on 2026-06-21** (the running estimate had drifted ~$3.7 low —
the confirmed number is authoritative). **Gate 6** (2026-06-21, post N-1 Fix 1/2/3, ~$2.83, `docs/playtests/opus-gate-2026-06-21-gate6.md`,
**7/48 — N-1 HELD (no inventory-dump/deflect/object-read empty-success recurred), discovery 0 new caps, frontier confirmed =
narration track; see the gate-6 findings in CAPABILITY_LEDGER**) → ~$2.58 estimated. **Gate 7** (2026-06-21, post N-1 + N-2 Ex-2,
~$2.87, `docs/playtests/opus-gate-2026-06-21-gate7.md`, **12/48 — N-1 + N-2 Ex-2 HELD (no regression, verified LLM-off); the 7→12 is
persona-variance onto fresh veins [C7 item-effect-names-a-stat tail · N-2 Ex-1 unimplemented · C12 can't-leave · trader-info stall];
discovery 0 new caps; see the gate-7 findings in CAPABILITY_LEDGER**) → ~$0 estimated. **Tim topped up for an autonomous N-3/N-4
two-gate cycle.** **Gate 8** (2026-06-21, post N-3, ~$2.80, `docs/playtests/opus-gate-2026-06-21-gate8.md`, **5/48 — 12→5; C16
address-mode + C7 names-a-stat HELD, 0 new caps**). **Gate 9** (2026-06-21, post N-4, ~$2.80, `docs/playtests/opus-gate-2026-06-21-gate9.md`,
**10/48 — N-4 dialogue/info-decline HELD; 5→10 = persona-variance (a bouncing ruler), 0 new caps; C12/H-81 invented-barrier recurred
= TOP next; see the gates 8–9 findings in CAPABILITY_LEDGER**) → **~$0 — EXHAUSTED.** **Gate 10** (2026-06-22, post H-81..H-86,
**~$2.76 ACTUAL**, `docs/playtests/opus-gate-2026-06-22-gate10.md`, **4/48 — milestone HELD, 0 new caps; the dominant grace-lockable fail =
C5 roll-query denial → fixed H-87; the rest = narration-track dialogue-deflect; see the gate-10 findings in CAPABILITY_LEDGER**).
**The autonomous-loop brief estimated $1.10/run, but the REAL per-run cost is ~$2.76 (≈2.5× higher); at $2.76/run "3 gates" ≈ $8.3,
not $3.3. Balance post-top-up UNKNOWN — re-confirm with Tim before a 2nd gate this session.** (gate 9 renamed to `-gate9.md` to free
the bare-date filename per the latest-gate-is-bare convention.)
**Gate 11** (2026-06-22, CAPSTONE post H-87..H-90, ~$2.86, `docs/playtests/opus-gate-2026-06-22-gate11.md`, **12/48 — bouncing ruler (persona-variance; corpus held 87/87 → not regression); DISCOVERY 0 new caps = 6th consecutive 0-discovery gate; H-87/88/89 held + H-90 mechanism held with one missed token "Enough" → H-91; frontier = narration (THE_REF) + combat-truth (Codex); see the gate-11 findings in CAPABILITY_LEDGER**) → **~$17.14 remaining** ($20 confirmed − $2.86).
The corpus harness (`npm run convergence`) is FREE/deterministic and is now the **primary regression signal**;
the paid gate is reserved for the **discovery signal** (tag failures by capability). Worker-side fixes
(Sonnet/Codex windows) don't draw this budget — only `scripts/dm-playtest.mjs` runs do. Still confirm the
number before any run that would drop below ~$2.5.

## Gate run 2026-06-20 (post-H-54/H-55) — docs/playtests/opus-gate-2026-06-20-postH54-H55.md
**10/48** (was 11). DM_TEST_DEADEND 8 · CRUNCH_INCONSISTENCY 2 · COMBAT_NOT_STARTED **0** · CANON_HALLUCINATION 0.
VERDICT: **H-55 CONFIRMED** (combat-not-started → 0); **H-54 R1/R2/R3 held** (shapes didn't recur), **R4 improved**
(bare-DC deflection gone; now states "Roll WITS d20+1 vs DC12", residual = "tell me what you get" canned reply
instead of auto-rolling). 11→10 is fresh-territory; new **dominant cluster (7/10) = ungrounded-NPC referent**:
player asserts a false premise about an un-grounded NPC ("you said Brae nodded just now") and demands specifics
→ DM rolls a generic success + content-free filler (Lore-hound ×5) or a movement deadend for a social intent
(Confused-newbie "talk to Brae" ×2), instead of a grounded clarify/decline. This IS the H-9 false-premise family
+ U214 referent guard, extended. Two singletons: CRUNCH armor-classification ("no armor… wearing Padded coat")
and CRUNCH roll-recall ("9 vs DC10" vs stated DC12 unreconciled, H-12/13 family).

## Post-H-50/H-51 gate — 2026-06-20 — VERDICT: both fixes confirmed effective, two new (smaller) clusters surfaced
`docs/playtests/opus-gate-2026-06-20.md` — **4/48 failing (8%), down from 6/48**. **Chaos-griefer and
Confused-newbie both now fully clean (12/12 each)** — direct confirmation H-51 (NPC-observer self-answer +
OOC repetition-callout) fixed the confused-newbie cluster with no recurrence. **Zero purse/coin desync
failures** — confirms H-50 (purse-claim guard, landed at `6696c7e`) closed that cluster too. No `high`-severity
failures this run.

Two new clusters, both smaller (1-2 turns) and distinct in shape from anything fixed so far:
- **Lore-hound CANON_HALLUCINATION (2 failures)** — DM invented an unbacked "well over two decades" elder
  tenure, and separately misidentified the elder as "Corwin Boneknit" (a representative) when canon names
  Kael as the elder. This is a grounding-gap, not a routing bug: the DM has a real Kael fact available but
  defaults to a generic/wrong answer when asked indirectly ("who runs this place" / "who's the elder").
  Same family as H-49 but a different trigger shape (identity/tenure question, not relationship/event claim).
- **Rules-Lawyer DM (2 failures)** — (a) CRUNCH_INCONSISTENCY: player explicitly asked for "the attack roll
  and the result" of swinging at a bread basket; DM resolved the roll but narrated an unrelated outcome
  ("the way ahead opens a little") with no concrete fiction tied to the actual roll/target. (b) DM_TEST_DEADEND
  (low severity): player called out a roll-reporting inconsistency across turns; DM picked a consistent
  number but ended on a clarifying question ("Which turn are you citing?") instead of fully resolving —
  judged as a UI-style bounce-back rather than a DM staying in the fiction, per `docs/THE_DM_TEST.md`.

**Not dispatched this session** — budget is now ~$0.5, below the cost of even one more gate run (~$2.6
typical). These two clusters are real but small (4 turns total across two sessions) — recommend holding
here and letting Tim decide whether to top up budget before scoping H-52/H-53, since further packets can't
be experientially re-verified until then. If dispatched anyway: **Lore-hound elder-identity cluster first**
(cleaner, same family as H-49's lineage — likely needs the NPC-identity/role lookup to be consulted before
the DM answers an indirect "who's in charge" question, not just direct "who is Kael" questions).

## Post-H-47/H-48/H-49 gate — 2026-06-20 — VERDICT: batch confirmed effective, two new clusters surfaced
`docs/playtests/opus-gate-2026-06-20.md` — 6/48 failing (13%), down from 16/48 pre-batch. **Chaos-griefer
and Lore-hound both went fully clean (12/12 each)** — direct confirmation H-48 (combat finishing blows)
and H-49 (lore-invention guard) fixed the exact clusters they targeted, with no recurrence in this run.
H-47 (item-effect breadth) also held — zero Tonic-mechanics failures this time (was the dominant
Rules-Lawyer cluster pre-batch). No `CANON_HALLUCINATION` failures at all this run (was 3 pre-batch).
No `high`-severity failures of any kind this run (was present pre-batch).

Two new clusters, both `med` severity, neither overlapping H-47/48/49's scope:
- **Purse/coin desync (3 failures, Rules Lawyer)** — a confirmed REAL bug, not a missing-feature
  artifact: `purse` is a real, invariant-enforced field (`engine/invariants.js:626-634`, four currency
  integers ≥0 per party member). An NPC (Corwin) narrated handing the player "three silver crowns
  upfront," but no `applyDeltas` purse update ever fired — so when the player asks "what coin do I have
  left," the DM either dumps the inventory pack listing (not coin) or correctly-but-confusingly states
  the (untouched, genuinely empty) purse, contradicting its own prior narration. This is a
  narration-promised-a-transaction-that-never-applied bug — the same family as H-38b's HP desync, but
  for currency instead of HP. Likely root: NPC-promised payment in dialogue/narration has no deterministic
  delta-application path the way combat/looting do.
- **Confused-newbie OOC question handling (2 failures)** — "who is this person you don't want to name?"
  got a confused non-answer naming the wrong party; "are you okay?" (an out-of-fiction check-in, not a
  game action) got a generic mixed-roll narration instead of being recognized as non-action meta-chat.
  Smaller, more diffuse cluster — likely a sub-case of the same `isInfoSeekingText`/question-routing
  family H-39 addressed, not yet fully closed for ambiguous-referent and OOC-check-in shapes.

**Not dispatched this session** — budget is down to ~$3.1 (one gate run's worth), and this was the
intended final basecamp session. Recommended next packet if/when resumed: **H-50, purse/coin transaction
sync** (priority — it's the cleaner, more isolated bug, in the same desync family as H-38b) scoped to
wherever NPC-dialogue-promised payment should route through `effectsCore.applyDeltas`; the confused-newbie
OOC cluster is lower priority and smaller (2 turns/gate) and could ride along in the same packet's gate
run or wait for its own.

## Open strategic question (the arbiter call) — VERDICT: Road A for the routing/state long-tail; HYBRID (deliver-or-decline) for the cluster-D canon-grounding gap; Road B parked w/ sharpened trigger
**Road A** (deterministic patches) vs **Road B** (Tier-B LLM intent arbiter w/ Canon-Log caching for
determinism). The 06-18 gate measurement is in: 22/96 failing, and 18/22 (CRASH + DM_TEST_DEADEND +
CRUNCH_INCONSISTENCY) are clearly real deterministic defects of the same character as the original
23 — state-reconciliation gaps and missing meta-query routing, not stylistic phrasing complaints.
Only CANON_HALLUCINATION (4/22, 18%) leans toward ungrounded-narration territory, and it's not yet
dominant. **Road B stays parked.** Keep grinding Road A on the new cluster above. Re-evaluate this
verdict only if a future gate run comes back with CANON_HALLUCINATION/phrasing-style failures as the
dominant class rather than a minority.

**UPDATE 2026-06-19 (Opus, post-H-28 gate) — re-evaluation triggered as planned.** Re-clustering the
20 hard-seed failures by TRUE root cause (not gate label): meta-query miss (~2) + in-combat intent
routing (~5) + narration-vs-truth (~3) are ordinary Road-A long tail and ARE converging — landed
shapes stay dead (H-28's 4 symptoms didn't recur; H-24/25 closed CRASH + numeric-deadend). The 42% is
glass-harbor-only (seed selection), not a regression; run-to-run HARD count is unfit for measuring
convergence since the gate explores freely. The genuinely new problem is **cluster D (~8 turns): a
SUCCESS on an info-roll for a fact not in canon** — the dice ground truth and the canon ground truth
are never JOINED before narration, so the narrator's only options are atmosphere (DEADEND) or
invention (HALLUCINATION) — the same bug wearing two masks. CANON_HALLUCINATION as a label is only
3/20; it looks dominant only because of that entanglement. A wider pattern-match RULE-LIST can't
converge on it (infinite phrasings of invented facts), but a deterministic output-shape CONTRACT
(deliver-or-decline) can — and grounding ("does this fact exist?") is a deterministic canon lookup, NOT
an LLM job. **Decision: hybrid (c)** = H-29. It collapses both halves of D and moves them out of the
HARD column, which is the Rung-1 bar; the residual (decline quality under sustained badgering) is a
SOFT-tier concern the bar tolerates. **Road B stays parked with a SHARPENED trigger:** build the
Tier-B arbiter ONLY if a post-H-29 gate shows declines clearing HARD but sustained-pressure SOFT-vibe
fails dominant AND unfixable by template variety — i.e. the residual is decline *reasoning*, not
fact-grounding. Arbiter contract if it comes to that: cache keyed on `(seed, transcript-hash, node)` as
the determinism boundary; LLM-off falls back to the deterministic classifier (worldHash computes from
the deterministic delta, never LLM output); read-only over canon (may select/ground existing facts +
decide "no fact → decline", never mints canon); a pre-generation grounding stage layered on top of the
H-28/H-29 post-hoc validator, not a replacement.

**UPDATE 2026-06-19 (Opus, BASECAMP design review — the "content-free hedge" tail) — VERDICT: the
judge is correctly calibrated; the recurring `DM_TEST_DEADEND` tail is a DETECTOR-RECALL defect, NOT a
judge artifact and NOT an LLM-permission gap. Tim's "reframe" insight is real but applies only to a
minority sub-shape. The higher-leverage fix is structural and still pure Road A — stop widening the
detector regex shape-by-shape.**
Investigated the pattern Tim flagged across H-35→H-37: every `DM_TEST_DEADEND` is a content-free hedge
("it lands, after a fashion" / "that's your call"), and three H-IDs have tried to fix it by requiring
"deliver real content," yet it recurs. Two hypotheses tested: (H1) the gate JUDGE is miscalibrated —
under-credits a confident in-voice TRUE *reframe*, so we've been over-fixing fine responses; (H2) the
DM system prompt is too narrow — only licenses disclosure-or-refusal, never a confident true take.
Findings, by the brief's five steps:
1. **Judge is NOT the defect (refutes H1).** `JUDGE_SYSTEM` GATE 1 (`scripts/dm-playtest.mjs:238`)
   rewards *"did the DM resolve intent IN THE FICTION"* and FAILs only on machine-leaks (UI-prompt
   bounce, stat-dump, "command not recognized"). A confident in-voice TRUE reframe ("Yes — always;
   nothing out here is safe") satisfies that and trips none of the FAIL conditions → the judge would
   PASS it. The rubric does **not** implicitly reward flat fact-disclosure. We have **not** been
   over-fixing fairly-passing reframes. Only forward-looking gap: the RAG axis ("FAIL if a confident
   claim has no support in canon") doesn't exempt rhetorical hyperbole / attitude-stances, so IF the
   engine starts emitting reframes, some could be newly mis-failed as `CANON_HALLUCINATION`. That's a
   precautionary ~2-line clarification, not the cause of any past failure.
2. **The hedges are DETERMINISTIC fallback templates, not LLM output.** Traced every quoted string:
   "It comes off cleanly / You see it through" → `playloop.js:4979` (`genericGroundedOutcome` `gen:s`
   pool); "It lands, after a fashion" → `playloop.js:4980` (`gen:m`); "That one's yours to call" →
   `gracefulAdjudication.js:818` (META_ADVICE non-commit). They reach the player verbatim because
   `tryAiNarration` hands the LLM a content-free base and falls back to that base on any validation
   miss. So no system-prompt change can touch them — they never carry a fact for the LLM to deliver.
3. **Root cause = ONE detector chokepoint missing the question — not an under-bucketed contract, not an
   LLM-permission gap.** The deliver-or-decline contract already exists and already buckets correctly:
   `infoExtractionOutcome` (`playloop.js:4860`) returns a grounded fact when canon has it, ELSE a
   genuinely good voiced escalating in-character DECLINE ("Can't say. No record I've ever seen." →
   "I told you — I don't know." → "Enough."). The whole subsystem is gated behind `isInfoSeekingText`
   (`playloop.js:4862`; the SAME gate also fronts the pre-roll `isUngroundedInfoCheck` suppression).
   `isInfoSeekingText` is a precision-tuned ALLOWLIST regex (`gracefulAdjudication.js:360`) enumerating
   shapes (who/what/when + name/year/owner/family/...). On a MISS the turn (a) rolls a gradeable
   success (no pre-roll suppression) AND (b) skips deliver-or-decline → falls to the content-free
   `gen:s`/`gen:m` pool. The comment at `gracefulAdjudication.js:355-359` already names this exact
   mechanism. Every H-22/23/29/31/35/36a/37/38a "fix" has been ADDING ALTERNATIONS to this allowlist —
   a recall problem treated as an enumeration problem.
4. **Cost asymmetry is backwards; judge-noise ≈ 0.** A false NEGATIVE (info question missed) = a HARD
   `DM_TEST_DEADEND`. A false POSITIVE (non-info caught) = a graceful in-character decline — a mild
   in-voice non-answer, not a hard fail (combat verbs already excluded). The detector is tuned for
   PRECISION when the costs demand RECALL. Re-reading the cataloged HARD `DM_TEST_DEADEND` entries
   across postH35/36/37: ≈0 are judge-calibration noise — they're real content-free hedges, fairly
   failed. The narrow patches address a REAL problem with the WRONG tool.
5. **Where Tim's reframe is exactly right — a real THIRD bucket, but minority.** The tail splits:
   - **A — factual recall, no canon fact** (genealogy/identity/dates; DOMINANT, ~5-6 turns/gate). A
     confident TRUE reframe is *impossible* (can't truthfully assert the unknown) and a system-prompt
     license can't help (LLM has no fact, correctly forbidden to invent). Correct answer = the existing
     voiced decline — it just needs to be REACHED. Fix = recall, not permission.
   - **B — judgment / "should I"** ("should I be worried about him watching me?" → "that's your call";
     MINORITY, ~1 turn/gate). Neither a fact nor "I don't know" is right — a real DM commits to a TRUE
     stance from tone/disposition. THIS is the third bucket Tim named, currently hard-coded as a
     non-commit (META_ADVICE). Reframe-fixable — as a deterministic stance from the tone/speaker
     blocks, not a broad system-prompt rewrite.

**VERDICT: a refinement of option (b).** Judge is sound and failures are real, so the narrow-patch
instinct isn't chasing a phantom — but `isInfoSeekingText` is the wrong thing to keep widening. Next
move (higher-leverage than H-39/H-40 per-shape; still pure deterministic Road A — no LLM authority, no
`WORLD_VERSION` bump, narration≠canon untouched, determinism-safe via `pickVariant`):
- **(i) Flip the detector's precision/recall bias for QUESTION-SHAPED inputs** (gate on the existing
  `isQuestionShaped` helper): any interrogative seeking info routes to deliver-or-decline; imperatives
  stay out. Collapses the genealogy/identity tail regardless of phrasing in one change.
- **(ii) Invert the interrogative fall-through default** in `genericGroundedOutcome`: a question-shaped
  input reaching the last-resort resolver emits an honest voiced decline, never a success-flavored
  "it goes your way." Belt-and-suspenders so any future detector miss degrades to a forgivable decline,
  not a HARD content-free success.
- **(iii) META_ADVICE / "should-I" stance** (sub-shape B): return a confident TRUE stance from the
  tone/disposition blocks instead of "yours to call."
- **(iv) Judge RAG-axis clarification** — DONE 2026-06-19 (BASECAMP, `scripts/dm-playtest.mjs`
  JUDGE_SYSTEM): the RAG axis now exempts rhetorical hyperbole / atmosphere / in-character
  judgment-attitude stances from the literal-grounding check (only a concrete checkable specific — name,
  date/number, who-did-what — needs grounding; a FALSE specific still FAILs). Done now (not parked) so
  the post-H-39 gate grades H-39's new confident META_ADVICE stances fairly instead of mis-flagging them
  as `CANON_HALLUCINATION`. No gate budget spent — exercised on the next planned run.

Do **NOT** scope the broad DM-system-prompt rewrite the brief floated as the PRIMARY lever — it cannot
collapse the dominant sub-shape A (the LLM can't invent absent facts; the good decline already exists
deterministically and just isn't reached). A system-prompt stance-license is at most optional
reinforcement for sub-shape B, and would then need the narration≠canon guard — the deterministic
META_ADVICE stance (iii) sidesteps that cleanly.

**Packet PROPOSED, NOT dispatched (Tim's call) — H-39 "deliver-or-decline by recall, not enumeration"**
(grace/narration lane, Claude-Sonnet): pairs (i)+(ii)+(iii); (iv) is a 2-line judge edit. No gate run
was spent on this investigation — budget held at ~$15.9. Sanity-check this reasoning before dispatch.

## Parked (home-base, NOT Rung 1)
IG-10 absurd-input decline gate; gratuitous-violence consequence ladder; surfacing packets P-82..P-88.
