# AGENT_CHANGELOG

2026-06-20T00:48:48Z — Codex
- Packet/seam: H-43 combat resolution
- Commit(s): `4f70b0b`
- Files changed: `engine/playloop.js`, `engine/combat/escapeCombat.js`, `tests/U206.combatResolution.test.js`
- Summary: fixed the combat-lane routing/state bugs from H-43. `hit` now counts as an explicit in-combat strike even when a trailing dice-demand makes the line question-shaped, so declared attacks resolve to real `[strike:...]` mechanics instead of `[combat:table-talk]`. Active escape combat now routes 0-HP turns through the dying gate before travel/body-action shortcuts, and `resolveEscapeCombatTurn` keeps combat active with `[combat:dying]` when the PC is downed while a live enemy still stands instead of ending the fight. Social/deixis lines such as "ignore Corwin, point at the stranger" are excluded from assault detectors so they do not mint combat. Added U206 coverage for declared dice-demand attacks, narrated-hit/HP-delta consistency, 0-HP live-enemy dying state, and social-not-combat routing. Did NOT touch `engine/grace/gracefulAdjudication.js`, `engine/llmAdapter.js`, `WORLD_VERSION`, invariants, RNG, or neighboring grace-lane files.
- Proof: `node --test tests/U206.combatResolution.test.js tests/U149.naturalAttackVerbs.test.js tests/U152.grappleIntegration.test.js tests/U167.strikeMechanicsDice.test.js tests/U191.combatImprovisedAction.test.js tests/U193.combatInitiationReconciliation.test.js tests/UX2.conversationRouting.test.js` — 41/41; `node --test` — 8190/8190; `node --test tests/U19.worldHashDeterminism.test.js tests/U21.replayGateN50.test.js tests/U22.longRunStabilityN100T500.test.js tests/U27.worldHashSurfaceContract.test.js tests/U30.gate6.sequelDeterminism.test.js` — 6/6; `npm run playtest:quick` — 50 runs, 0 crashes, no bugs found. Initial full-suite attempt failed only because the sandbox lacked local listener permission for A04 (`listen EPERM 127.0.0.1`); rerun after local network permission passed 8190/8190.
- Remaining/next: none from H-43; queue owner should verify and push.
- Rollback: revert `4f70b0b`

2026-06-20T00:16:42Z — Claude-Sonnet
- Packet/seam: H-44 grace cleanup (post-H-42 baseline gate residuals)
- Commit(s): 03eb40e
- Files changed: `engine/grace/gracefulAdjudication.js`, `tests/U207.graceCleanup.test.js` (new)
- Summary:
  (i) PRIMARY — isInfoSeekingText (~L369) missed noun-less suspicion/info questions that seek
      CONCEALED information from a person ("is something going on you're not telling me?", "what
      aren't you telling me?", "are you hiding something?", "is there something you're not
      saying?") — no who/what+noun anchor (INFO_SEEKING_RE) and no knowledge-verb topic phrase
      (INFO_SEEKING_TOPIC_RE), so they fell through to content-free success atmosphere instead of
      the deliver-or-decline contract (confused-newbie t8). Added `INFO_SEEKING_CONCEALMENT_RE`,
      anchored on an explicit concealment/withholding marker so a neutral statement or plain action
      never trips it. Wired into `isInfoSeekingText`'s OR-chain only — the deliver-or-decline
      machinery downstream (playloop.js `infoExtractionOutcome`/`declineInfoSeek`) already reads
      this gate and needed no changes, confirmed by an integration test calling
      `infoExtractionOutcome` directly.
  (ii) SECONDARY, traced and confirmed IN LANE — `handleMetaQuestion`'s `META_NPC_OBSERVER` branch
      always answered with `sociable[0]`, ignoring any hostile NPC entirely. RL t5
      (CANON_HALLUCINATION, opus-gate-2026-06-19-postH42-baseline.md): player explicitly asked who
      the stranger LURKING at the edges is, not about Corwin — DM re-served "Corwin Boneknit, a
      representative — one of the folk here, watching from nearby," which is this branch's exact
      no-description fallback string, confirming the bug lives here, not upstream in playloop
      routing. Added `NPC_OBSERVER_LURK_RE`: a "lurking"/"edges"/"shadows" framing now selects the
      present hostile NPC (the real lurker, e.g. canon's "the Lingerer") instead of defaulting to
      the first sociable one. Non-lurk-framed queries ("who's that stranger watching me?") are
      untouched — same sociable-first behavior as before, verified by a regression-guard test.
      Also gave the hostile fallback line its own phrasing ("— keeping to the edges, watching")
      instead of reusing the sociable "one of the folk here" line, for tonal correctness, mirroring
      the idiom `buildLocationSurvey` already uses for lurkers elsewhere in this file.
  - Deliberately did NOT touch playloop.js, escapeCombat.js, or llmAdapter.js — H-43 (combat,
    Codex) owns playloop.js/escapeCombat.js in parallel this round; confirmed file-disjoint before
    and after (diff touches only gracefulAdjudication.js + the new test file).
  - Deliberately did NOT redesign the "lurkers stay anonymous in a roster sweep" convention
    (`buildLocationSurvey`, `META_NPC_ROSTER`) — this fix is scoped to the DIRECT/SPECIFIC
    identity-ask branch (`META_NPC_OBSERVER`) only, per the packet's scope.
- Proof:
  - `node --test tests/U207.graceCleanup.test.js` → 14/14 pass (confirmed RED on all 9
    catch/integration cases before the fix, GREEN after).
  - `node --test` (full suite) → 8190/8190 pass, 0 fail (no regressions; count is baseline + this
    packet's +14 U207 cases + H-43's in-flight combat tests already in the shared tree).
  - Determinism: `node --test tests/U19.worldHashDeterminism.test.js tests/U21.replayGateN50.test.js
    tests/U22.longRunStabilityN100T500.test.js tests/U27.worldHashSurfaceContract.test.js
    tests/U30.gate6.sequelDeterminism.test.js` → 6/6 pass.
- Remaining/next: none for this packet. (ii) was confirmed in lane and fixed in full — no deferral.
- Rollback: revert 03eb40e

2026-06-19T20:27:54Z — Claude-Sonnet
- Packet/seam: H-42 react-under-pressure (grace lane)
- Commit(s): 385c228
- Files changed: `engine/grace/gracefulAdjudication.js`, `engine/playloop.js`, `tests/U205.reactUnderPressure.test.js` (new)
- Summary: post-H-39 Opus gate, Lore-hound t12 (HIGH DM_TEST_DEADEND) — player confronts a present
  NPC with a contradiction ("You said Kael was here before any of you. He says he came later. One of
  you is lying about your own village's founding. Which one?"), the insight roll FAILS, and the DM
  fell to the generic place-filler ("Whatever you meant to do, Pilgrim's Rest Village doesn't give it
  to you.") instead of having the confronted NPC react. IG-11 social-physics fix:
  - **New exported `isConfrontationChallenge(text)`** (`gracefulAdjudication.js`, just after
    `isInfoSeekingText`) — recall-biased net of independent accusatory markers: "you said/told
    me/claimed ... but/yet/however/and now/now you", "you're lying" / "one of you is lying" /
    "which of you is lying" / "he's/she's/they're lying" / "stop lying", "admit it", "you claimed",
    "contradicts what you said", "you swore ... but". Guarded two ways: (a) each trigger requires an
    unambiguous accusation/contradiction marker so a neutral statement or a plain info-ask
    (`isInfoSeekingText`'s job) never trips it; (b) the lying-accusation regex carries a negative
    lookahead against the common spatial-preposition reading ("she's lying in the grass") so an
    examine/status action on a prone NPC is never misread as an accusation — caught this myself while
    writing the detector (not in the original packet's literal pattern list) and added U205-12 to lock
    it in.
  - **New `genericGroundedOutcome` branch** (`playloop.js`, sibling to and checked BEFORE the existing
    H-39 `isInfoSeekingText` decline at the top of the function): on a FAILURE outcome only, if
    `isConfrontationChallenge(text)` AND `socialTarget(world, text)` resolves to a present NPC, return
    a new `confrontationReaction(world, npc)` instead of falling through to the gen:s/gen:m/gen:f
    atmosphere pool. Two tiers off the NPC's real `hostile` flag (the same signal `socialDC` already
    reads as tougher resistance) — a civil-but-defensive deflection, or a sharper bristle for a
    hostile NPC — each 3 variants, picked via the existing `pickVariant` (seeded by
    `meta.seed`/node/key + resolved-action count, so a replay reproduces the identical line; no new
    RNG). The reaction never names the contested third party or concedes the contradiction: the
    player's roll failed, so they have not earned the read — a successful/mixed read stays the
    deliver path's job (H-12/13's roll-recall contradiction handling), confirmed untouched by tests
    U205-27/28.
  - Did NOT touch `npc/dialogue.js` (the H-9 continuity-deflection there owns DIALOGUE-mode turns; the
    Lore-hound t12 turn went through the normal roll path instead, landing in
    `genericGroundedOutcome` — confirmed by the worker prompt's own trace and not re-derived here). Did
    NOT alter the success/mixed paths, `WORLD_VERSION`, invariants, or any `applyDeltas`/mutation call
    site (narration-only, no state change). No `Math.random`/`Date.now` — `pickVariant` is the sole
    variation mechanism, deterministic by design.
- Proof:
  - `node --test tests/U205.reactUnderPressure.test.js` — 23/23 (written FIRST; confirmed failing
    against pre-fix code via `git stash` of the two source files — the whole file failed to load with
    `SyntaxError: ... does not provide an export named 'isConfrontationChallenge'`, 0/23 — then
    `git stash pop` restored the fix and all 23 went green)
  - Full suite: `node --test` — 8172/0 (baseline 8149 + 23 new, zero regressions, zero pre-existing
    tests modified)
  - Determinism: `node --test tests/U19.worldHashDeterminism.test.js tests/U21.replayGateN50.test.js
    tests/U22.longRunStabilityN100T500.test.js tests/U27.worldHashSurfaceContract.test.js
    tests/U30.gate6.sequelDeterminism.test.js` — 6/6
  - `npm run playtest:quick` — 50 runs, 0 crashes, 0 bugs
  - `git diff --stat` confirms only the two claimed engine files + the new test file touched; grep for
    `Math.random`/`Date.now`/`WORLD_VERSION`/`applyDeltas` in the diff — empty
- Remaining/next: queue owner should re-run the Opus gate to confirm the Lore-hound t12
  `DM_TEST_DEADEND` shape is cleared. The fix is scoped to the roll-path (`genericGroundedOutcome`);
  if a future gate finds the same dead-end reachable via the DIALOGUE-mode path instead, that's a
  `npc/dialogue.js` follow-up, not a recurrence of this one.
- Rollback: revert 385c228

2026-06-19T20:18:00Z — Claude-Sonnet
- Packet/seam: H-40 number-transparency (grace lane)
- Commit(s): 8b6cad0
- Files changed: `engine/grace/gracefulAdjudication.js`, `tests/U203.numberTransparency.test.js` (new)
- Summary: post-H-39 Opus gate's dominant remaining cluster (4/7, Rules Lawyer persona asking for its
  own numbers) — three fixes, all inside `handleMetaQuestion`/the META_* skill-modifier machinery,
  grounded in the real transcript (`docs/playtests/opus-gate-2026-06-19-postH39.md`):
  - **(i) DM_ARTIFACT_LEAK** — `"...d20 plus my tracking modifier, and tell me what the modifier even
    is"` matched `META_MODIFIER_FORMULA` via its bare `"the modifier"` trigger, found no recognized
    skill/stat name (`"tracking"` was missing from `SKILL_STAT`/`META_SKILL_MOD`), and fell to the
    last-resort branch that prepends the raw breakpoint-table string + a full stat dump. Added
    `tracking: 'WITS'` to `SKILL_STAT` + the `META_SKILL_MOD` alternation so it now resolves through the
    existing clean skill-modifier path instead. Extracted that path's body into a new shared helper
    `answerSkillModifier(lowerText, world)` (pure refactor of the existing `META_SKILL_MOD` block — same
    computation, same output, zero behavior change at that call site) and call it FIRST from
    `META_MODIFIER_FORMULA` too, so any skill name reaching that branch resolves the same way. Also
    hardened `META_MODIFIER_FORMULA`'s own bare-stat sub-case (a bare ability name alongside `"the
    modifier"/"the formula"`) to report just that stat's number, no table prepended. The truly generic,
    no-target-named fallback (`"what's the formula for modifiers?"`, locked in by U172-23) is
    deliberately untouched — kept the table there since I can't edit that test file and the real
    reported failure never reaches that branch once skill-routing is fixed.
  - **(ii) CRUNCH_INCONSISTENCY** — `"what are my actual stats and what weapons am I carrying?"` matches
    `META_INVENTORY` (via its `"what {1-4 words} am i carrying"` clause) and the inventory branch only
    folded in HP via `META_HEALTH`, never the ability-score block, so a stats-led compound ask got gear
    only. Added a new shared helper `answerFullStats(world)` (same `order.filter(...).map(...).join(',
    ')` ability-block format already used 3+ other places in this file, plus escape-mode HP — mirrors
    `META_CHARACTER`'s existing stats+HP bundling exactly) and folded it into both `META_INVENTORY` and
    the `META_EQUIPMENT`/`META_HELD_ITEMS`/`META_GEAR_YESNO` branch whenever `META_STATS_REQ` also
    matches — same family of fix as the H-36a/H-37/H-38a gear+coin/class folds, applied symmetrically to
    both branches this time (the changelog's own H-37 retro flagged a PARTIAL fold-fix, covering only one
    branch, as a recurring failure shape — avoided that here).
  - **(iii) DM_TEST_DEADEND** — `"give me my numbers ... and my attack bonus with the Worn Blade"`
    matched `META_ATTACK_MOD`, which only ever explained the RULE (MIGHT-vs-AGILITY) abstractly, never
    computing a final number, and never folding in the requested ability scores. `META_ATTACK_MOD`'s
    branch now checks whether a REAL weapon from `party[0].inventory.weapons` is named in the question
    (same substring/token-match idiom `answerWeaponDamage` already uses); if so it calls `meleeProfile`
    (imported read-only from `engine/combat/escapeCombat.js` — the exact function
    `resolveEscapeCombatTurn` itself reads, so the reported bonus can never drift from what combat
    actually rolls) and reports `"With the <name>, your attack bonus is <±N>"`. When no weapon is named,
    the original melee/finesse explanation is preserved byte-for-byte (required — U189/U190 lock in that
    exact string for the bare ask). Either branch additionally prepends `answerFullStats` when
    `META_STATS_REQ` also matches.
  - Did NOT add any RNG/fresh-die-roll capability (out of scope per the worker prompt — purity rule, no
    `Math.random`, meta-handlers stay pure string responses) and did NOT touch `engine/combat/*`,
    `engine/playloop.js`, or any other file outside the two listed above.
  - One deviation from the worker prompt worth flagging: the prompt's own illustrative test phrasing for
    (ii) (`"what are my actual stats and weapons?"`) does not actually match any existing meta-question
    gate (verified by exhaustive regex trace) and would have required broadening the sensitive,
    heavily-tested `META_CHARACTER` gate to catch it — instead used the VERIFIED real transcript phrasing
    (`"what are my actual stats and what weapons am I carrying?"`, confirmed to already match
    `META_INVENTORY`) for U203, which exercises the identical underlying bug with zero gate changes and
    zero added regression surface.
- Proof:
  - `node --test tests/U203.numberTransparency.test.js` — 11/11
  - Adjacent regression sweep: `node --test tests/U172.statSheetAnswerer.test.js
    tests/U181.statSynonyms.test.js tests/U189.ownNumberQuery.test.js tests/U190.crunchConsistency.test.js
    tests/U162.statModifierGrace.test.js` — 51/51; `node --test tests/U196.coinQueryAndPossessionFollowons.test.js
    tests/U199.itemStatAndPresenceGrounding.test.js tests/U201.itemGearBroadenedAndZeroContentFix.test.js
    tests/U144.equipmentQueryGrace.test.js tests/U146.characterIdentityGrace.test.js
    tests/U155.hpNumberGrace.test.js tests/U156.itemQueryGrace.test.js` — 65/65
  - Full suite: `node --test` — 8149/0 (baseline 8138 post-H-41 + 11 new; the worker prompt's stated
    baseline of 8135 was already stale — H-41 landed first and moved it to 8138)
  - Determinism: `node --test tests/U19.worldHashDeterminism.test.js tests/U21.replayGateN50.test.js
    tests/U22.longRunStabilityN100T500.test.js tests/U27.worldHashSurfaceContract.test.js
    tests/U30.gate6.sequelDeterminism.test.js` — 6/6
  - No existing test was modified — all 8138 baseline tests pass unchanged; invariant #19 (stronger not
    weaker) is moot here since nothing pre-existing was rewritten.
  - `git diff --stat` confirms only the two claimed files touched; grep for `Math.random`/`Date.now`/
    `WORLD_VERSION`/`applyDeltas` in the diff — empty.
- Remaining/next: queue owner should re-run the Opus gate to confirm the Rules-Lawyer number-transparency
  cluster (4/7) is cleared. The out-of-scope "roll it fresh, show me the raw die" vibe-nit (bug_class
  NONE, low, turn 41 of the postH39 gate) was deliberately left untouched per the worker prompt.
- Rollback: revert 8b6cad0

2026-06-19T19:55:27Z — Codex
- Packet/seam: H-41 0-HP dying-state out of combat
- Commit(s): b8d3ea9
- Files changed: `engine/playloop.js`, `tests/U204.outOfCombatDyingState.test.js`
- Summary: `outOfCombatDyingGate` now still treats `meta.escapeHp` as the true current downed HP, but falls back to a real SRD sheet `dnd.maxHP` when `meta.escapeMaxHp` is stale/zero so a 0-HP escape character cannot fall through into ordinary narration or rolls. Added U204 coverage for a live Corwin preserved in inactive combat, normal attack blocked as `[combat:dying | no-action]`, rescue/stabilize restoring `hp:0->1`, and above-0 HP normal dispatch. Deliberately did NOT touch `engine/grace/gracefulAdjudication.js`, `engine/llmAdapter.js`, `engine/combat/escapeCombat.js`, `WORLD_VERSION`, invariants, randomness, or broad combat routing.
- Proof: Baseline before fix: `node --test tests/U204.outOfCombatDyingState.test.js` — 1/3 (2 failing: stale `escapeMaxHp:0` fell through to ordinary dispatch). After fix: `node --test tests/U204.outOfCombatDyingState.test.js` — 3/3; `node --test tests/U204.outOfCombatDyingState.test.js tests/U90.wildEncountersAndSight.test.js` — 10/10; `node --test tests/U174.hpZeroDying.test.js tests/U194.combatStateReconciliation.test.js tests/U200.combatEntityMechanics.test.js tests/U204.outOfCombatDyingState.test.js` — 22/22; `node --test` — 8138/0; determinism `node --test tests/U19.worldHashDeterminism.test.js tests/U21.replayGateN50.test.js tests/U22.longRunStabilityN100T500.test.js tests/U27.worldHashSurfaceContract.test.js tests/U30.gate6.sequelDeterminism.test.js` — 6/6; `npm run playtest:quick` — 50 runs, 0 crashes, 0 bugs.
- Remaining/next: none.
- Rollback: revert b8d3ea9

Compact append-only log of meaningful agent-made changes. Use this to preserve
cross-agent continuity: what changed, what proved it, and what remains.

**Coordination: read [`AGENT_PROTOCOL.md`](AGENT_PROTOCOL.md) before touching code.** One queue
(Claude/Basecamp owns it), one packet in flight, claim-before-code.

## CLAIMS (in-flight work — claim here BEFORE editing, clear when done)

`[CLAIMED] <seam> · <agent> · <UTC> · files: <paths>` — a claimed seam or file is off-limits to
other agents. (none active)

## Template

- Date:
- Agent:
- Packet/seam:
- Commit:
- Files changed:
  - 
- Summary:
- Proof:
  - 
- Remaining:
  - 
- Rollback:

---

2026-06-19T15:40:00Z — Claude-Sonnet
- Packet/seam: Rung 1 / H-39 deliver-or-decline by recall, not enumeration (grace lane)
- Commit(s): 05f24aa
- Files changed: `engine/grace/gracefulAdjudication.js`, `engine/playloop.js`, `tests/U202.deliverOrDeclineRecall.test.js` (new)
- Summary:
  - **(i) recall-bias `isInfoSeekingText`** — added `INFO_SEEKING_TOPIC_RE`, a knowledge-VERB-phrase
    net ("tell me about X", "what do you know about X", "what happened/became to/of X", "what's the
    story behind/of/with X") anchored to the verb phrase rather than a noun, so it generalizes to ANY
    topic that follows instead of needing a per-noun allowlist entry — the structural fix for the
    H-35→H-38a whack-a-mole. Considered (and rejected) the literally-broader `isQuestionShaped(t) &&
    !actionExclude(t)` design the dispatch suggested: traced it against the full suite first and found
    it collides with `isExploreIntent`'s own "what do I see"/"is there a window" survey branches
    (playloop.js ~L4347-4354, which already defer to `isInfoSeekingText` — broadening it further would
    have silently broken U197-06's genuine-room-survey guard). The narrower verb-phrase net gets the
    same generalization benefit for the fact/lore/history class without that collision. Extended
    `INFO_SEEKING_EXCLUDE_RE` with `isExploreIntent`'s own action-verb vocabulary (climb/jump/leap/
    vault/pick/force/break/try/attempt/sneak/steal/track/forage/decipher/calm) so feasibility asks
    ("can I climb this wall?") keep rolling as actions. **Unplanned third collision found and fixed**:
    `META_RECAP`'s unanchored "what happened" (playloop.js's out-of-combat/out-of-dialogue meta-gate,
    ~L756-783) was swallowing third-party historical questions that name no NPC at all ("what happened
    to the people who used to live here?" → "Nothing's happened yet") — a different proximate cause
    than the two the dispatch named (`isUngroundedInfoCheck`/`infoExtractionOutcome`), caught only by
    live-probing the exact MUST-MATCH phrase against `playerMove` before writing the test. Fixed by
    extending the existing `npcAddressedRecap` bypass (originally H-34 R1, NPC-named-in-text only) with
    an `isInfoSeekingText(text)` OR-branch — same deferral the explicitly-named-NPC case already gets.
    U195's R1 false-positive guard (a genuine "what happened? what did I just do?" recap with no
    knowledge-verb anchor) is unaffected and still passes.
  - **(ii) `genericGroundedOutcome` safety net** — extracted the no-grounding decline block out of
    `infoExtractionOutcome` into a shared `declineInfoSeek(world, text, npc)` helper (identical
    phrasing/escalation-tier behavior, zero behavior change there). `genericGroundedOutcome` (now
    exported for testing) checks `isInfoSeekingText` first and always declines via the same helper
    instead of falling to gen:s/gen:m/gen:f — traced that on TODAY's call graph this is reachable only
    on a FAILURE outcome for info-seeking text (success/mixed/no-info are already fully handled by
    `infoExtractionOutcome` earlier in the caller's `grounded ||` chain, confirmed by direct trace, so
    those two branches are not currently dead code paths reachable from there) — verified live via
    `node -e` probes before and after. The net never attempts delivery even when grounded (a failed
    roll shouldn't hand over the fact); its purpose is explicitly belt-and-suspenders against a FUTURE
    detector miss per the dispatch.
  - **(iii) `META_ADVICE` confident stance** — the no-talk-verb branch's "That one's yours to call —
    ... Go with your gut." replaced with a real-state-derived stance: hostile NPCs at the current node,
    open `world.ledger.threats`, or a grim/blood `fateBand(world.meta.fate)` tone all read as danger
    ("Yes — keep your eyes open; nothing out here is friendly by default."); none of those present
    reads as calm ("You're alright for the moment — nothing here's looking to move on you."). Reads
    real state, invents nothing. The existing "should I talk to them" branch (names present NPCs) is
    untouched.
  - Deliberately did NOT touch `engine/llmAdapter.js` or any `engine/combat/*` file. Deliberately did
    NOT adopt the dispatch's literal `isQuestionShaped`-as-base-net suggestion (see (i) above — traced
    and found a real collision, used a narrower mechanism that achieves the same recall-over-enumeration
    goal for the targeted class without it). No `WORLD_VERSION` bump, no new persisted field, no
    `Math.random`/`Date.now`, no new `applyDeltas` call site (narration/routing-only).
- Proof:
  - `node --test tests/U202.deliverOrDeclineRecall.test.js` — 25/25 (written FIRST and confirmed
    failing 14-15/25 against pre-fix code, including a self-caught gap in the test's own atmosphere-bank
    regex — see test file header)
  - Full suite: `node --test` — 8135/0 (baseline 8110 + 25 new, zero regressions, zero rewritten
    pre-existing tests needed)
  - Determinism gates `node --test tests/U19.worldHashDeterminism.test.js tests/U21.replayGateN50.test.js tests/U22.longRunStabilityN100T500.test.js tests/U27.worldHashSurfaceContract.test.js tests/U30.gate6.sequelDeterminism.test.js` — 6/6
  - Grep diff for `engine/combat/*` and `engine/llmAdapter.js` — both empty (0 lines); grep for
    `Math.random`/`Date.now`/`WORLD_VERSION`/`applyDeltas` in the diff — empty
  - `git diff --stat`: exactly the two engine files + the new test file, nothing else
- Remaining/next: queue owner should run a post-H-39 Opus gate to confirm the `DM_TEST_DEADEND` tail
  collapses regardless of phrasing (per the dispatch note in `docs/RUNG1_QUEUE.md`). Worth a sweep if a
  future gate finds a fourth/fifth knowledge-verb-phrase shape `INFO_SEEKING_TOPIC_RE` doesn't cover —
  the net is generalized for "tell me about X"/"what happened to X"-style phrasing specifically, not
  literally every possible fact-seeking phrasing.
- Rollback: revert 05f24aa

---

2026-06-19 — Claude-Sonnet
- Packet/seam: Rung 1 / H-38a broaden R1/R2 nets + fix artifact leak (grace lane)
- Commit(s): e1ff459
- Files changed: `engine/grace/gracefulAdjudication.js`, `engine/playloop.js` (`lookupGroundedFact` only — not combat dispatch), `tests/U201.itemGearBroadenedAndZeroContentFix.test.js` (new)
- Summary:
  - **R1** — H-37 only folded gear into the `META_PURSE` (coin-ask) branch, so a class+gear compound with no coin, and a bare gear yes/no ask with no compound at all, both missed the fold. Added two general helpers, `mentionsCharacterClass`/`mentionsGearAsk`, and wired them into the `META_NAME`, `META_SHEET_CONFIRM`, and `META_CHARACTER` branches so a class and/or gear ask folds in regardless of compound shape or coin presence. Also added `META_GEAR_YESNO` (gate + answer branch) for the bare yes/no framing ("am I carrying any weapon or armor, yes or no?") — this closes a real gate/answerer drift: `isMetaQuestion` already accepted that shape via `META_ITEM`'s loose "am i carrying" clause, but `handleMetaQuestion` had no matching branch and silently fell through to `return null`. The dominant failure (4 of 6 Rules-Lawyer fails this gate) was `META_SHEET_CONFIRM` unconditionally dumping the raw MIGHT/AGILITY/WITS/GRIT/CHARM block whenever "sheet" was mentioned, even when the question named class/gear and never asked for ability scores — it now answers what was actually asked, falling back to the raw block only when stats are absent from both the class/gear ask AND the score request. Added `stripArmorClassPhrase` so "armor/armour class" (the AC number) is never misread as a character-class or gear-item ask by the new broader detectors.
  - **R2** — traced BOTH symptoms (the recurring mixed-margin boilerplate and the new success-path zero-content sibling) to ONE shared root cause, not two: `isInfoSeekingText`'s `INFO_SEEKING_RE` had no anchor for birth/age phrasing ("when were you born") or bare kinship nouns ("who was her husband"), a THIRD detection gap distinct from H-37's "family"/"kin" fix on the same regex. `playloop.js`'s `infoExtractionOutcome` and `narratorContext.js`'s `ctx.infoSeeking` (the `llmAdapter.js` Rule 5 validator backstop) both gate on this one function, so the single gap explained the mixed-path recurrence and the success-path failure identically — one fix, not two. Added `born`/`husband`/`wife`/`spouse`/`son`/`daughter`/`father`/`mother`/`married` to the anchor-word list and widened the literal `give me a name` clause to also accept `one`/`the`.
  - **R3** — traced the raw `location:Pilgrim's Rest Village` artifact leak to `lookupGroundedFact`'s loose ledger-fact substring match in `playloop.js` — **not** an LLM structured-tag leak as the packet's file guess suggested. `buildSystemPrompt` (the prompt actually used by the narration-polish path that composes this player-facing prose) never mentions `<<ITEM_CREATED>>` at all; that tag belongs to `buildDMSystemPrompt`'s separate full-conversation path, untouched here — confirmed `engine/llmAdapter.js` needed no change. The real mechanism: `addFact(world, \`location:${location}\`, 'scene')` (playloop.js L340/L2404) stores an internal scene-tracking marker in the ledger; `factStrings()` (ledger.js) flattens away the `source` tag; a player's "village"-anchored question substring-matched the raw internal fact text and `infoExtractionOutcome` handed it to the player verbatim. Added `STRUCTURED_FACT_RE` (`/^[a-z]+:\S/i`) to skip any internal `key:value`-shaped ledger fact in the loose-match candidate pool — scoped narrowly enough (checked against every other `addFact` call site in the engine) to leave real prose facts (e.g. from `conductorDecision`'s `op.addFact` pass-through) untouched.
  - Deliberately did NOT touch `engine/llmAdapter.js` (see R3 trace) or any `engine/combat/*` file / playloop.js's combat-dispatch branch.
- Proof:
  - `node --test tests/U201.itemGearBroadenedAndZeroContentFix.test.js` — 21/21
  - `node --test tests/U199.itemStatAndPresenceGrounding.test.js` — 17/17 (H-37 regression guard, unaffected)
  - Full suite: `node --test` — 8110/0 (baseline 8086 + 3 from the parallel H-38b combat worker's `U200.combatEntityMechanics.test.js` + 21 new here)
  - Determinism gates `U19/U21/U22/U27/U30` — 6/6 green
  - Grep diff for `engine/combat/*` and `engine/llmAdapter.js` — both empty (0 lines)
  - No `Math.random`/`Date.now` added, no `WORLD_VERSION` bump, no direct state writes outside `effectsCore.applyDeltas` (the `playloop.js` change is a pure narration-lookup filter, no mutation)
  - Test file renamed `U200` → `U201` mid-session: the parallel H-38b worker (sharing this working tree) had already landed `tests/U200.combatEntityMechanics.test.js` first; kept the lower number with the earlier committer per first-landed convention.
- Remaining/next: queue owner should re-run the Opus gate to confirm the Rules-Lawyer item/gear cluster (DM_TEST_DEADEND ×6) and the Lore-hound mixed/success-path zero-content + artifact-leak clusters (CRUNCH_INCONSISTENCY ×2, DM_ARTIFACT_LEAK ×1) are cleared. R1's gear/class fold now covers all four META_* branches that can plausibly lead a compound identity ask (`META_NAME`/`META_SHEET_CONFIRM`/`META_CHARACTER`/`META_PURSE`) — worth a sweep if a future gate finds a fifth.
- Rollback: revert e1ff459

---

2026-06-19 — Codex
- Packet/seam: Rung 1 / H-38b combat HP entity-tracking desync + weapon-label mismatch
- Commit(s): 1727db9
- Files changed: `engine/combat/escapeCombat.js`, `engine/playloop.js`, `tests/U191.combatImprovisedAction.test.js`, `tests/U198.combatTruthReconciliation.test.js`, `tests/U200.combatEntityMechanics.test.js`
- Summary: Traced the apparent enemy/PC HP cross-contamination to the mechanics-line contract, not a wrong `meta.npcCombatHp` write: enemy attacks were correctly mutating `meta.escapeHp`, but reported that player HP delta inside `[enemy:...]` as bare `hp:before->after`, which the gate reasonably read as enemy HP. Enemy attack mechanics now report `pcHp:before->after` for normal, legendary, and lair enemy damage. Separately fixed the weapon-label gap by treating `ram`/`drive` + torch/flame/fire as improvised combat actions, so torch-fire attacks do not fall back to `Worn Blade`. Also fixed the separate taunt dispatch gap: pure spit/yell/threat social beats in active escape combat now return `[combat:table-talk]` instead of defaulting to a strike. Deliberately did NOT touch `engine/grace/gracefulAdjudication.js` or `engine/llmAdapter.js`; no `WORLD_VERSION` bump; Codex push failed on GitHub credentials after the local claim commit.
- Proof: Baseline regression before fix: `node --test tests/U200.combatEntityMechanics.test.js` — 0/3, reproducing all three H-38b symptoms. After fix: `node --test tests/U200.combatEntityMechanics.test.js` — 3/3; `node --test tests/U200.combatEntityMechanics.test.js tests/U198.combatTruthReconciliation.test.js tests/U191.combatImprovisedAction.test.js tests/U149.naturalAttackVerbs.test.js tests/U152.grappleIntegration.test.js tests/U167.strikeMechanicsDice.test.js tests/UX2.conversationRouting.test.js` — 40/40; `node --test` — 8089/0 (+3 from 8086/0 baseline); determinism gates `node --test tests/U19.worldHashDeterminism.test.js tests/U21.replayGateN50.test.js tests/U22.longRunStabilityN100T500.test.js tests/U27.worldHashSurfaceContract.test.js tests/U30.gate6.sequelDeterminism.test.js` — 6/6; forbidden-file diff grep for `engine/grace/*` and `engine/llmAdapter.js` — empty.
- Remaining/next: Queue owner should push local commits `3d5530b` (claim, unpushed because credentials failed) and `1727db9` after independent verification, plus the DONE-entry commit that contains this log update. No remaining H-38b combat follow-up known: (a) and (b) were independent seams; the taunt-fired-attack symptom was separate from both and fixed in this packet.
- Rollback: revert 1727db9

---

2026-06-19 — Codex
- Packet/seam: Rung 1 / H-36b combat truth (retaliation/defeat/disengage)
- Commit(s): this commit
- Files changed: `engine/combat/escapeCombat.js`, `engine/playloop.js`, `tests/U191.combatImprovisedAction.test.js`, `tests/U198.combatTruthReconciliation.test.js`
- Summary: R1 traced as case (a): the deterministic enemy turn really can damage `meta.escapeHp` after a player miss, but the old mechanics line only surfaced the player strike. Enemy-turn hits from normal, legendary, and lair actions now append visible roll/save, damage, and PC HP delta to the mechanics line. R2 confirmed the improvised/natural strike path already applies `newHp <= 0` defeat and victory; added U198 coverage for the headbutt path. R3 fixed combat-state bleed by holding active escape-combat interior movement in combat and treating any `?`-bearing non-action as table-talk, so lore/social text cannot silently exit then later trigger strike/morale/flee math. Deliberately did NOT touch `engine/grace/gracefulAdjudication.js` or `engine/llmAdapter.js`; no `WORLD_VERSION` bump; no push from Codex.
- Proof: `node --test tests/U198.combatTruthReconciliation.test.js` — 5/5; `node --test tests/U198.combatTruthReconciliation.test.js tests/U191.combatImprovisedAction.test.js tests/U193.combatInitiationReconciliation.test.js tests/U194.combatStateReconciliation.test.js tests/U152.grappleIntegration.test.js tests/U151.grapple.test.js` — 32/32; `node --test` — 8069/0 after enabling local bind permission (first attempt hit sandbox `listen EPERM 127.0.0.1`); determinism gates `U19/U21/U22/U27/U30` — 106/106 in the targeted glob; `npm run playtest:quick` — 50 runs, 0 crashes. Live `v1.html` served 200 on port 5179, but visible screenshot QA was not completed because no browser automation package or in-app browser tool was available in this environment; `npm run dev` watch mode also hit `EMFILE`, while an existing server was already listening on 5179.
- Remaining/next: Queue owner should push after independent verification. No H-36c grace handoff for R1, because this was combat-side case (a), not pure polish invention.
- Rollback: revert this commit

---

2026-06-19 — Codex
- Packet/seam: Rung 1 / H-33 combat-state reconciliation
- Commit(s): `0ed7ebc`
- Files changed: `engine/combat/escapeCombat.js`, `engine/playloop.js`, `tests/U194.combatStateReconciliation.test.js`
- Summary: Prevented persisted-down NPCs from starting fresh escape combat after victory, added a defensive no-live-target guard inside `resolveEscapeCombatTurn()`, and added an out-of-combat 0 HP gate that blocks normal actions while allowing stabilization. Deliberately did NOT change R3 pronoun/object-mediated assault routing or R4 generic-villager combat initiation; both were traced and left for Basecamp decision.
- Proof: `node --test tests/U194.combatStateReconciliation.test.js` — 6/6; `node --test tests/U193.combatInitiationReconciliation.test.js tests/U115.parleyLongRest.test.js` — 13/13; `node --test tests/U152.grappleIntegration.test.js tests/U151.grapple.test.js` — 12/12; `node --test` — 8037/0; determinism gates U19/U21/U22/U27/U30 — 6/6; `npm run playtest:quick` — 50 runs, 0 bugs.
- Remaining/next: R3 remains a separate routing/pronoun gap (`flip counter onto her` falls to trivial auto-success); R4 is existing generic-NPC assault behavior (`first villager` resolves to first present NPC and escape combat defaults to Worn Blade strike). Live `v1.html` screenshot was not run because no browser automation library is installed in this checkout.
- Rollback: revert `0ed7ebc`

---

## 2026-06-19T08:17:59Z — Claude Sonnet (worker)

- Packet/seam: Rung 1 / H-34 — NPC-roster grounding (grace/narration lane, sibling to H-33/combat)
- Commit(s): (this commit)
- Files changed:
  - `engine/playloop.js` (+20: `npcAddressedRecap` exclusion on the out-of-combat/out-of-dialogue
    meta-question gate, same shape as the existing `declaredNpcViolence`/`META_LOCATION` exclusions;
    `META_RECAP` added to the gracefulAdjudication.js import)
  - `engine/grace/gracefulAdjudication.js` (+42: `META_RECAP` exported so playloop.js can reference
    it; new `META_NPC_ROSTER` pattern + handler branch checked before `META_ADVICE`)
  - `engine/llmAdapter.js` (+60: Rule 4d CANON_HALLUCINATION in `validateNarrationCandidate`; new
    exported `collectRosterTokens` helper, same shape as the existing `collectDefeatedNames`)
  - `tests/U195.npcRosterGrounding.test.js` (new, 17 cases — catch + false-positive guard per rule,
    mirrors U190/U192's discipline)
- Summary: Closed the gate's freshest residual cluster (post-H-31/H-32 run, the grace half — H-33
  covers the combat half separately). **R1**: `META_RECAP`'s bare `/what happened/` is unanchored and
  was swallowing a direct, named-NPC-addressed historical question ("What happened twelve years ago
  that made you settle here, Corwin?") into the recap dead-end ("Nothing's happened yet") before
  dialogue/social routing ever saw it. Added an exclusion that requires the resolved `socialTarget`
  NPC's own name/role to literally appear in the text (not just be present at the node — `socialTarget`
  falls back to the first NPC even unaddressed, so a bare proximity check would have been a
  false-positive trap); the gate now falls through past META_RECAP to whatever downstream handling
  exists for the rest of the turn instead of answering from the recap. **Residual note**: downstream,
  this currently lands on a generic observe/explore fallback rather than an in-character NPC reply —
  there's no existing "ask a present NPC a question without first entering dialogue" router. That's a
  separate, larger routing gap outside this packet's scope (and outside the allowed playloop.js
  region); the fix's bar was "stop the recap swallow," which it does — the dead-end non-answer is
  gone. **R2a**: no existing handler covered a general "who's here / who are all these people" roster
  ask (only narrow single-NPC phrasings did) — added `META_NPC_ROSTER`, checked before `META_ADVICE`
  so a trailing "...should I know them?" can't steal the turn into the generic "yours to call"
  non-answer. Folded in the sibling "is there a stranger watching" shape via the same pattern/handler:
  it now acknowledges a present hostile/lurker NPC ("someone else keeps to the edges, watching")
  instead of denying one that's real in canon, while still never naming a hostile outright (same
  restraint `buildLocationSurvey`'s existing lurkers line already uses). **R2b**: added Rule 4d to the
  narration validator — rejects polish that confidently confirms the presence/arrival of a specific
  occupation/species noun (wizard, goblin, knight, etc.) absent from both the grounded base narration
  and the real NPC roster (`ctx.settlement.npcs`, the field already proven live by `collectDefeatedNames`;
  also defensively checks `ctx.npcsPresent` though that field is empty on the actual
  `validateNarrationCandidate` call path today — `buildNarratorContext` doesn't set it, only the
  separate `buildDMContext`/system-prompt path does). Deliberately scoped to a curated list of
  specific role/species nouns, not generic human descriptors (man/woman/stranger/elder/figure/...) —
  those are exempt because a real roster NPC is routinely described that way by a synonym (the same
  restraint Rules 4a/4b/4c already hold for kinship/defeat/age claims). Denials ("no wizard answers")
  and hypotheticals ("if a wizard showed up") are excluded by a negation/hypothetical lookback window
  before the match. Did NOT touch `engine/combat/*` (H-33's lane), did NOT bump `WORLD_VERSION`, did
  NOT add `Math.random`/`Date.now`, did NOT mutate state outside the existing read-only meta-question/
  narration-validation paths (no `applyDeltas` call needed — nothing here writes world state).
- Proof:
  - `node --test tests/U195.npcRosterGrounding.test.js` — 17/17
  - Full suite: `node --test` — 8031/0 (898 suites; was 8014, +17 new)
  - Determinism gates `U19/U21/U22/U27/U30` — 6/6 green
  - Repro lines re-verified live (`node -e` against the actual exported functions, not just the unit
    tests): "What happened twelve years ago that made you settle here, Corwin?" no longer returns
    "Nothing's happened yet"; "Um, who are all these people? Should I know them?" now names the real
    present NPC instead of "That one's yours to call"; "can I just look at the stranger watching from
    the edges?" no longer returns "no stranger lurks here" when a hostile NPC is actually present;
    a synthetic "wizard" arrival narration with no wizard in the roster is rejected by
    `validateNarrationCandidate` (falls back to grounded base), while a real roster NPC, a denial, and
    a hypothetical mention all still pass.
- Remaining/next: R1's downstream fallback (generic observe, not an in-character NPC reply) is a
  separate pre-existing routing gap — out-of-dialogue direct-address-to-NPC has no dedicated router.
  Worth its own packet if Tim wants the full experience, not just the dead-end fix. No other follow-ups
  cataloged for H-34.
- Rollback: revert this commit.

---

## 2026-06-19 — Codex (worker)

- Packet/seam: Rung 1 / H-32 — combat-initiation reconciliation (declared attacks, grapple-kills, damage/defeated-state)
- Commit: `684b4c6`
- Files changed:
  - `engine/combat/escapeCombat.js` (improvised-strike vocab +windowsill/sill; `actionMech` now set on both ward branches and threaded into the victory mechanics line instead of being discarded)
  - `engine/playloop.js` (`declaredNpcViolence` gate suppresses the out-of-combat meta-question short-circuit when the text also declares an attack; `isCombatSceneObjectAction`/`isImprovisedCombatAction` +windowsill/sill; `ANY_VIOLENCE` swing→swings?; `detectAttackAnyIntent` new "verb + at/against/into me" branch for 3rd-person-declared attacks on the player)
  - `tests/U193.combatInitiationReconciliation.test.js` (new, 5 cases)
- Summary: Closed the gate's COMBAT_NOT_STARTED + table-talk-kill + narration-vs-truth residuals. A declared attack by a present NPC ("Corwin swings his satchel at me", embedded inside a longer compound question) no longer gets swallowed whole by the meta-question handler — `declaredNpcViolence` checks for assault/attack intent first and, when present, lets combat-initiation logic run instead of returning a bare inventory answer. Grapple-style kill phrasing ("grab his throat, slam his head into the windowsill") now resolves through the existing improvised-strike profile (windowsill/sill added to the Fixture vocabulary) instead of `[combat:table-talk]` with a freebie narrated kill. The victory-line bug (the LAST action's `actionMech` — a real strike's damage — was being unconditionally discarded and replaced with bare `[combat:victory]`) is fixed: the ward branches now set `actionMech` like every other action branch already did, and the victory return prepends whatever `actionMech` was set to. Did NOT touch HP/defeated mutation logic itself (already correct via the existing resolution path — the bug was the *reporting* line plus the upstream routing gate); did not touch `combatLifecycle.js`'s id-minting; no `WORLD_VERSION` bump.
- Proof:
  - `node --test tests/U193.combatInitiationReconciliation.test.js` — 5/5
  - Full suite: `node --test` — 8014/0 (Basecamp reran independently; includes H-31's 15 new tests landed in the same working tree)
  - Determinism gates U19/21/22/27/30 — 6/6 green (Basecamp reran independently)
- Remaining/next: none cataloged. **NOT YET PUSHED** — `git push` failed against this machine's git/`gh` credentials (invalid token); commit is local-only, `origin/v2-polish` still at H-31 (`d4719ed`). Tim needs to push manually or refresh credentials.
- Rollback: revert `684b4c6`

---

## 2026-06-19 — Claude Sonnet (worker)

- Packet/seam: Rung 1 / H-31 — ground-from-canon (info-roll suppression, Armor/inventory meta-query, canon-contradiction, age-invention guard)
- Commit: `d4719ed` (pushed to `origin/v2-polish`)
- Files changed:
  - `engine/playloop.js` (`isUngroundedInfoCheck`/`noInfoCheckResult` decide groundedness PRE-ROLL and skip `resolveMove` for an ungrounded info-ask; `buildBeatFromTurn` clamps the new `'no-info'` sentinel to `'failure'` for the `recentBeats` invariant; `infoExtractionOutcome` accepts `'no-info'` as a third valid outcome)
  - `engine/grace/gracefulAdjudication.js` (+132: `META_ARMOR_VALUE`/`META_HELD_ITEMS` interceptors answer the real AC/loadout with no roll; `META_POSSESSION_CHALLENGE`/`findBogusPossessionClaim` corrects a false possession claim from real inventory instead of re-listing evasively; `describeLoadout` factored out of the existing equipment branch)
  - `engine/llmAdapter.js` (+45: Rule 4c + `AGE_PHRASE_RE` — `findInventedFactClaim` now also flags an ungrounded confident age phrase like "well past seventy")
  - `tests/U192.groundFromCanon.test.js` (new, 15 cases — catch + false-positive guard per rule, mirrors U190's discipline)
- Summary: Closed the gate's remaining DM_TEST_DEADEND/CRUNCH_INCONSISTENCY/CANON_HALLUCINATION residuals in the grace/narration lane. R1 is "the other half" of H-29's join: H-29 already declined honestly when a fact isn't in canon, but the engine still rolled a gradeable success/mixed for that ask, so a correct decline contradicted its own dice line — now decided pre-roll via the same lookup, so the two can never disagree. R2/R3/R4 are net-new meta-query/correction/invention-guard coverage, same shape as the existing H-25/H-29 families. Grounded asks, true gear restatements, and grounded age phrases are all false-positive-guarded and pass unchanged. Did NOT touch `composer.js` or combat resolution; no `WORLD_VERSION` bump.
- Proof:
  - `node --test tests/U192.groundFromCanon.test.js` — 15/15
  - Full suite: `node --test` — 8014/0 (Basecamp reran independently; includes H-32's 5 new tests landed concurrently in the same working tree — the two packets touched `playloop.js` in disjoint regions and were hand-separated by hunk rather than rebased)
  - Determinism gates U19/21/22/27/30 — 6/6 green (Basecamp reran independently)
- Remaining/next: none cataloged for H-31. Next step for the batch is the combined post-H-31/H-32 gate run once H-32 is pushed.
- Rollback: revert `d4719ed`

---

## 2026-06-18 — Claude Opus (worker)

- Packet/seam: H-28 — bundled llmAdapter narration-validation pass (closes H-11 2nd half, H-26a, H-26d, H-27 → entire H-1..H-28 hard tail)
- Commit: `0cde26b` (claim: prior commit on this branch)
- Files changed:
  - `engine/llmAdapter.js` (+~130: four rejection rules in validateNarrationCandidate + exported `collectDefeatedNames` helper)
  - `engine/ai/narratorContext.js` (+3: `rollOutcome` field on the narrator context so R3 can see the roll band)
  - `tests/U184.narrationGroundTruth.test.js` (new, 21 cases — each rule: catch + false-positive guard + helper unit tests)
- Summary: Extended the existing narration-validation contract (validate polish against ground truth, else fall back to grounded base) with four rules, all the same failure shape (LLM polish drifting from/contradicting deterministic truth):
  - **R1 (H-11 2nd half):** the prior location-lock only checks the CURRENT place is *mentioned*; added a guard that rejects polish asserting the player is INSIDE a *different* real map node ("standing inside Stonebridge's sole structure" while elsewhere). Conservative assertion frames only — merely mentioning another node as a destination passes.
  - **R2 (H-26a):** when combat is inactive but a defeated enemy is on record, reject a fresh player-defeat exchange ("you fall, defeated") or the reconciled-dead enemy launching an attack. Mere recap ("Greyhand lies still") passes.
  - **R3 (H-26d):** threaded `ctx.rollOutcome`; on a `mixed` band, reject prose that reads as an unqualified clean win (explicit clean-win marker AND no friction/cost language). Fires only on mixed; friction-bearing mixed prose and genuine success wins pass.
  - **R4a (H-27):** reject invented kinship/attribution claims (grandfather backstory, "it was X who raised it") NOT present in the grounded base narration; pronoun attributions ("it was you who") and grounded kinship pass.
  - **R4b (H-27):** reject a defeated NPC (combat enemy, scene-NPC flag, or ledger death fact) narrated as alive/active/present; gone/still references and living NPCs pass.
  - Deliberately did NOT touch composer.js (deterministic generation is correct per H-26 triage), did NOT bump WORLD_VERSION, did NOT spend the Opus gate (budget exhausted — node --test only).
- Proof:
  - `node --test tests/U184.narrationGroundTruth.test.js` → 21/0
  - `node --test` → 7972/0 (was 7951, +21)
  - Determinism gates U19/21/22/27/30 → 6/6 green
- Remaining: none — this closes the cataloged H-1..H-28 hard tail. Note: R3 in production depends on `outcome.outcome` reaching `buildNarratorContext`; the unit contract is proven directly, the production wiring is a one-field passthrough. Returns to queue owner for the optional final gate-budget verification run.
- Rollback: revert `0cde26b`

---

## 2026-06-18 — Claude Sonnet (worker)

- Packet/seam: P-82a — Westmarch static-NPC `historicalFigure` casting (RAG corpus binding)
- Commit: (this commit)
- Files changed:
  - `packs/fantasy/westmarch/pack.json` (+6 `historicalFigure` fields, additive)
- Summary: Bound all 6 Westmarch static NPCs to existing `server/rag/corpus/*` figures by role/personality fit (Westmarch's crown-watch/seil-compact factions have no corpus cluster, so matched on role, NOT faction/name — corpus doesn't name Westmarch NPCs). Casting: aldric-hale→`captain_rath` (Iron Brotherhood commander; "afraid/decide/useful" tone ≈ "privately worried"); renna-voss→`scarlet_compact_quartermaster` (literal Compact provisioner — strongest match); warden-maren→`covenant_elder` (eldest practitioner, contemplative/knowledgeable/patient); corin-blackthorn→`wild_hunter` (lone tracker attuned to "disturbance/pattern" — rhymes with the Greywood Silence thread); dalla-smith→`forge_master` ("iron has opinions" warmth ≈ cheerful smith); old-gerren→`father_len` (itinerant Thornwall spiritual attendant — long-winded/devout). Faction reconciliation was NOT needed/forced — role-fit was viable. No engine code, no WORLD_VERSION bump (field is optional/additive), no marquee real-person casting (that's P-82c).
- Proof:
  - Traced real `retrieveChunks()` code path (`server/rag/ragRetriever.js`): all 6 figures load (empty-query topN=4 and a themed-query=4 each); JSON parses; `reconstructed=false` for all 6. Note: role-string query returns 0 chunks only because role tokens don't overlap chunk keywords — expected; real player queries retrieve fine. No live LLM call (protocol §4).
- Remaining: none for P-82a. Match quality is "best available by role" — corpus has no Westmarch-specific figures, so these are thematic, not canonical, bindings.
- Rollback: revert this commit.

---

## 2026-06-18 — Claude Sonnet (worker)

- Packet/seam: Rung 1 / H-19 explicit-check denial; H-12/13 roll-number contradiction
- Commits: `7c11f3e` (H-19 gate), `37d1778` (H-12/13 persistence)
- Files changed:
  - `engine/grace/gracefulAdjudication.js` (+75: META_EXPLICIT_CHECK_A/B + META_ROLL_RECALL patterns + handlers)
  - `engine/playloop.js` (+14: persist lastRoll after resolveMove + resolveSocialAdjudication)
  - `engine/state.js` (+10: lastRoll: null default in ensureWorld, excluded from worldHash)
  - `tests/U182.explicitCheckRequest.test.js` (new, 11 cases)
  - `tests/U183.rollContradiction.test.js` (new, 14 cases)
- Summary: H-19: "read him" matched INSPECT_VERB → observe-only before roll logic ran. Added META_EXPLICIT_CHECK gate: explicit "let me make a [STAT] check" fires before tryExamineTarget, returns DC + roll prompt. H-12/13: each playerMove re-seeded RNG from timeline.length, so every follow-up turn produced a different roll. Added conversation.lastRoll (null default, excluded from worldHash); META_ROLL_RECALL gate acknowledges or disputes the player's cited roll against stored state instead of re-rolling silently. Did NOT touch combat, world shape, or invariants.
- Proof:
  - `node --test` → 7909/0 (was 7884, +25 new tests)
  - Determinism gates U19/21/22/27/30 green
  - U183-50: lastRoll excluded from worldHash confirmed
- Remaining: none
- Rollback: revert `37d1778` then revert `7c11f3e`

---

## 2026-06-18 — Claude Sonnet (worker)

- Packet/seam: Rung 1 / H-14/15/16 dead-end+UI-bleed; H-17/18 stat-synonym+HP gap
- Commit: `b0d7105`
- Files changed:
  - `engine/grace/gracefulAdjudication.js` (+89 lines)
  - `engine/playloop.js` (+46 lines)
  - `tests/U180.deadEndGuards.test.js` (new, 9 cases)
  - `tests/U181.statSynonyms.test.js` (new, 13 cases)
- Summary: H-14: "Who's that stranger?" was caught by isExploreIntent's `^(who|what)` pattern → cardinal-exit recap; fixed by adding META_NPC_OBSERVER + isNpcObserverQuery guard before explore branch. H-15: "Hey, um, I'm talking to you" — extractDialogueRef m3 grabbed filler-leading garbage as talkRef, fell to movement roll; fixed by dropping m3 captures that start with filler/pronouns and adding isDirectAddressIntent handler. H-16: "Is that stranger gone?" caught by isExploreIntent's `^is\s+(there|the|it|this|that)` → roster list; fixed by same META_NPC_PRESENCE guard. H-17/18: stat-answerer only knew IE names (MIGHT/AGILITY/etc.); D&D synonym set (Strength/DEX/CON…) not mapped; multi-stat queries returned first match only; HP skipped; formula leaked as prose. Fixed: `str` added to STAT_SYNONYMS; ≥3 D&D names → full stat block + HP; formula prose replaced with breakpoint examples. Did NOT change combat, roll resolution, or worldHash logic.
- Proof:
  - `node --test tests/U180.deadEndGuards.test.js tests/U181.statSynonyms.test.js` → 22+/0
  - `node --test` → 7884/0
  - Determinism gates U19/21/22/27/30 green
- Remaining:
  - none
- Rollback: revert commit `b0d7105`

---

## 2026-06-18 — Claude Sonnet (worker)

- Packet/seam: Rung 1 / H-7 object-mediated assault → trivial auto-success; H-8 phantom combat victory (cascade)
- Commit: `dcbd79c`
- Files changed:
  - `engine/playloop.js` (1 char: added "their" to GENERIC_WORD in fuzzyMatchNpc)
  - `tests/U179.objectMediatedAssault.test.js` (new, 4 cases)
- Summary: "smash it over their head" resolved prep[1]="their head" to null — fuzzyMatchNpc GENERIC_WORD was missing "their" despite having him/her/his/its. One-word insertion routes object-mediated assaults with possessive-pronoun body-part targets to combat. H-8 phantom victory resolves as cascade (T10 now starts combat; T11 is a normal combat turn). Did NOT change DIRECT_ATTACK_VERB, detectPhysicalAssault, or combat mechanics.
- Proof:
  - `node --test tests/U179.objectMediatedAssault.test.js` → 4/0
  - `node --test` → 7858/0
  - Determinism gates U19/21/22/27/30 green
- Remaining:
  - Note: "crack" is not in ANY_VIOLENCE; "on" is not a prep-list preposition — U179-02 regression guard was corrected from "crack lantern on her head" to "smash lantern over her head" before committing.
- Rollback: revert commit `dcbd79c`

---

## 2026-06-18 — Codex

- Packet/seam: Rung 1 / H-1 scene-object action misrouted as strike
- Commit: `202ba1f`
- Files changed:
  - `engine/playloop.js`
  - `tests/U149.naturalAttackVerbs.test.js`
- Summary: Active escape-combat door/scene-object actions no longer default into enemy strike resolution.
- Proof:
  - `node --test tests/U149.naturalAttackVerbs.test.js`
  - `node --test tests/U149.naturalAttackVerbs.test.js tests/U151.grapple.test.js tests/U152.grappleIntegration.test.js tests/U170.combatStateNarration.test.js`
- Remaining Rung 1 seams:
  - H-2 narration inversion on grapple clinch
  - H-3/H-4/H-5 unarmed/natural attacks resolving as Worn Blade prose/profile
  - H-6 lethal grab/neck-snap intent routing to grapple clinch
- Rollback: revert commit `202ba1f`

## 2026-06-18 — Codex

- Packet/seam: Rung 1 / H-3/H-4/H-5 natural strikes surfacing as Worn Blade
- Commit: `7914ab3`
- Files changed:
  - `engine/combat/escapeCombat.js`
  - `tests/U149.naturalAttackVerbs.test.js`
- Summary: Active escape-combat natural/unarmed strike intents such as stomp now use a natural strike surface label instead of Worn Blade, without changing damage math.
- Proof:
  - `node --test tests/U149.naturalAttackVerbs.test.js`
  - `node --test tests/U149.naturalAttackVerbs.test.js tests/U167.strikeMechanicsDice.test.js tests/U170.combatStateNarration.test.js tests/U151.grapple.test.js tests/U152.grappleIntegration.test.js`
- Remaining Rung 1 seams:
  - H-2 narration inversion on grapple clinch
  - H-4/H-5 should be explicitly pinned if needed with headbutt/bite regressions
  - H-6 lethal grab/neck-snap intent routing to grapple clinch
- Rollback: revert commit `7914ab3`

## 2026-06-18 — Codex

- Packet/seam: Rung 1 / H-4/H-5 headbutt and bite natural strike coverage
- Commit: `93758b1`
- Files changed:
  - `tests/U149.naturalAttackVerbs.test.js`
- Summary: Added explicit regressions proving active-combat headbutt and bite no longer surface as Worn Blade after the naturalStrikeProfile fix.
- Proof:
  - `node --test tests/U149.naturalAttackVerbs.test.js`
- Remaining Rung 1 seams:
  - H-2 narration inversion on grapple clinch
  - H-6 lethal grab/neck-snap intent routing to grapple clinch
- Rollback: revert commit `93758b1`

## 2026-06-18 — Codex

- Packet/seam: Rung 1 / H-2 grapple clinch output contradicted saved state
- Commit: `caae8a5`
- Files changed:
  - `engine/combat/escapeCombat.js`
  - `tests/U152.grappleIntegration.test.js`
- Summary: Fixed deterministic grapple output/state alignment: enemy break-free text now corresponds to persisted enemy state, and active choke exchanges do not grant a separate immediate break-free roll that resets choke progress.
- Proof:
  - `node --test tests/U152.grappleIntegration.test.js`
  - `node --test tests/U151.grapple.test.js tests/U152.grappleIntegration.test.js tests/U170.combatStateNarration.test.js tests/U149.naturalAttackVerbs.test.js tests/U167.strikeMechanicsDice.test.js`
- Remaining Rung 1 seams:
  - H-6 lethal grab/neck-snap intent routing to grapple clinch
- Rollback: revert commit `caae8a5`

## 2026-06-18 — Codex

- Packet/seam: Rung 1 / H-6 lethal neck-snap intent routed to ordinary grapple
- Commit: `056e249`
- Files changed:
  - `engine/combat/grapple.js`
  - `tests/U151.grapple.test.js`
- Summary: Added a classification boundary so lethal head/neck twist-snap language no longer returns ordinary "grapple" from parseGrappleVerb(). This does not implement neck-snap mechanics, instant kill, HP damage, or a new "lethal" action.
- Proof:
  - `node --test tests/U151.grapple.test.js tests/U152.grappleIntegration.test.js`
- Remaining Rung 1 seams:
  - Run the Opus/Rung 1 gate again to discover any remaining live-output failures.
  - Decide later, in a separate design packet, how lethal close-quarters intent should resolve mechanically.
- Rollback: revert commit `056e249`

## 2026-06-18 — Claude Sonnet

- Packet/seam: Rung 1 / H-22/23 successful info-roll withheld concrete fact in favor of atmosphere
- Commit: `77721ff`
- Files changed:
  - `engine/playloop.js`
  - `engine/llmAdapter.js`
  - `tests/U184.rollToFiction.test.js` (new)
- Summary: Added `infoExtractionOutcome()` — detects explicit name/date/fact-extraction phrasing ("name me / who was the / say the name") and deterministically injects a proper noun (derived from world seed + topic key, stable under replay) on a successful knowledge roll. Wired into the grounded outcome chain alongside `physicalObjectOutcome`/`nonObjectSkillOutcome`. On failure, returns null (atmospheric outcome stays acceptable). LLM system prompts (`buildSystemPrompt`, `buildDMSystemPrompt`) got an explicit success-directive exception overriding the "no inventing proper names" rule when the player earned a concrete answer.
- Proof:
  - `node --test tests/U184.rollToFiction.test.js` — 11/11 pass
  - Full suite: 7920/0; determinism gates U19/21/22/27/30 green
- Remaining/next: H-9/10/11 (continuity-deflection, mixed-roll wrong narration type, RAG wrong-scene) — next in queue.
- Rollback: revert commit `77721ff`

## 2026-06-18 — Claude Opus

- Packet/seam: Rung 1 / H-9 continuity-deflection — contradiction challenge polished into atmospheric avoidance
- Commit: `fe3d702`
- Files changed:
  - `engine/npc/dialogue.js` (`CONTINUITY_CHALLENGE_RE`, `handleContinuityChallenge()`, intercept in `askNpc()`)
  - `engine/playloop.js` (`dialogueAskNarration()` continuity case, `askBeatOutcome()`)
  - `tests/U185.continuityChallenge.test.js` (new)
- Summary: Continuity challenges ("first you said X, now Y — which is it?") routed through ordinary topic scoring (which matches known fact tokens only) and fell to `mode=deflected` → NPC voice polished it into atmospheric avoidance. Added a deterministic interceptor BEFORE `extractTopic()`, keyed on explicit quote-back/which-is-it markers ("you said", "first you said", "now you('re) saying", "which is it", "contradict", "that's not what you said", "you just said"). It resolves from the NPC's last in-dialogue answer (reaffirm the prior fact, speaking authored testimony verbatim if present) or honestly admits uncertainty — new `mode=continuity`, never `deflected`. No trust change. Deliberately did NOT: touch `composer.js`/`gracefulAdjudication.js`, alter `extractTopic` scoring, mint NPC memory for the challenge (mirrors the invite handler), or broaden the regex to swallow plain skepticism ("are you sure?", "really?" — verified non-matching by test).
- Proof:
  - `node --test tests/U185.continuityChallenge.test.js` — 3/3 pass (uncertainty branch, reaffirm-prior-fact branch, skeptical-question-does-not-misfire)
  - Full suite: `node --test` — 7923/0
  - Determinism gates U19/21/22/27/30 green
- Remaining/next: H-10 (mixed-roll wrong narration type), H-11 (RAG wrong-scene) — next in queue, same worker.
- Rollback: revert commit `fe3d702`

## 2026-06-18 — Claude Opus

- Packet/seam: Rung 1 / H-10 mixed-roll wrong narration type — social pressure rendered as physical prose
- Commit: `5fb2da5`
- Files changed:
  - `engine/playloop.js` (`CONVERSATIONAL_PRESSURE_RE`/`SELF_ADMIT_RE`/`isConversationalPressure()`, `detectApproach()` branch, `physicalObjectOutcome()` guard)
  - `tests/U186.conversationalPressure.test.js` (new)
- Summary: A demand for a verbal concession ("push him until he admits it", "stop lying, tell me the truth") could carry a physical-force verb that tripped `PHYS_FORCE` → `physicalObjectOutcome()` narrated "the wood splinters" for a social beat. Added a narrow conversational-pressure detector keyed on the verbal-concession marker itself (admit(s)/confess/come clean/own up/stop lying/tell me the truth/out with it/spit it out), excluding self-admissions ("I admit I was wrong"). `detectApproach()` now routes pressure as intimidate (resolved upstream by `resolveSocialAdjudication` before the resolveMove/physical fallthrough); `physicalObjectOutcome()` bails on pressure text as a defense-in-depth guard for the in-dialogue/combat fallthrough. Deliberately did NOT: touch `gracefulAdjudication.js` or `composer.js`, broaden the matcher to the force verbs (push/press alone), or change DC/roll math. Real physical commands ("push the door", "force the gate") stay physical — verified by test.
- Proof:
  - `node --test tests/U186.conversationalPressure.test.js` — 8/8 pass (4 pressure-routes-social cases, 3 physical-not-swallowed guards, 1 self-admission guard)
  - Full suite: `node --test` — 7931/0
  - Determinism gates U19/21/22/27/30 green
- Remaining/next: H-11 (RAG wrong-scene) — next in queue, same worker. Note: one collision found while testing — "admit it, you saw what happened" trips the `gracefulAdjudication.js` recap gate ("Nothing's happened yet…") on "what happened", which is off-limits this packet; test uses a recap-free pressure phrase instead.
- Rollback: revert commit `5fb2da5`

## 2026-06-19 — Claude Opus

- Packet/seam: Rung 1 / H-26 CRUNCH_INCONSISTENCY cluster (4 sub-bugs)
- Commit: `334053c`
- Files changed:
  - `engine/grace/gracefulAdjudication.js` (`META_EXPLICIT_CHECK_C`/`_D` + `extractRequestedStat` priority + handler/`isMetaQuestion` wiring)
  - `tests/U190.crunchConsistency.test.js` (new)
- Summary: Triaged the 4 sub-bugs; two are cleanly deterministic and fixed, two are LLM narration-grounding and deferred.
  - **(b) declared-miss reframed into a hit** — "A 4 against AC 10, a clean miss… what's my attack modifier?" produced `[strike … → hit | 4 dmg]`. Already closed by H-25's `META_ATTACK_MOD` interceptor (the combat meta-gate now answers the modifier as table-talk and resolves no strike). Regression-guarded here (U190-b).
  - **(c) wrong stat (WITS→CHARM)** — FIXED. "Roll the d20 against WITS … not a CHARM attempt on Senna" ran a CHARM social check: `detectApproach` matched the stray "charm" word and `extractRequestedStat` took the FIRST stat in the sentence. Added explicit-check Pattern C (imperative "roll … against <stat>", preposition-gated so bare "roll might" modal doesn't fire) and Pattern D (named "<stat> check/save/test"); `extractRequestedStat` now prefers the roll-TARGET stat. The out-of-dialogue meta-gate intercepts before social adjudication → "Roll WITS — d20 +1 against DC 12." (U190-c).
  - **(a) defeated-enemy not reconciled** and **(d) mixed-roll narrated as clean success** — NOT fixed. Verified the deterministic layer is already correct: the composer's `APPROACH_LEXICON` differentiates `mixed` (e.g. force/mixed → "momentum costs its tax"), and combat mechanics carry the `defeated`/`hp:0` state faithfully. Both gate traces are the **LLM polish** smoothing a mixed outcome into clean success / narrating a `defeated:true` body as active. That is the same llmAdapter narration-validation layer as H-27 and the deferred H-11 second half.
- Proof:
  - `node --test tests/U190.crunchConsistency.test.js` — 3/3
  - `node --test tests/U182…` + `U189` + `U186` — 26/26 (explicit-check + meta regressions)
  - Full suite: `node --test` — 7951/0
  - Determinism gates U19/21/22/27/30 green
- Remaining/next: **STOPPED before H-27 per queue plan.** H-26(a) and H-26(d) collapse into the H-27 CANON_HALLUCINATION / llmAdapter narration-validation work, which itself overlaps the still-open H-11 llmAdapter hardening. Basecamp to decide whether to bundle H-27 + H-26(a,d) + H-11-second-half into ONE llmAdapter validation pass (recommended — same file, same layer) rather than three separate passes.
- Rollback: revert commit `334053c`

## 2026-06-19 — Claude Opus

- Packet/seam: Rung 1 / H-25 DM_TEST_DEADEND — DM won't answer "what's my own number"
- Commit: `26ec812`
- Files changed:
  - `engine/grace/gracefulAdjudication.js` (`META_SKILL_MOD`/`META_ATTACK_MOD`/`META_BARE_DC` + `SKILL_STAT` map + handlers; `isMetaQuestion` wiring; `profBonusFor` import)
  - `tests/U189.ownNumberQuery.test.js` (new)
- Summary: Asking for one's OWN number — a D&D skill modifier ("what's my Insight modifier? I need a number"), attack modifier, or a bare DC — was unrecognized (only the 5 game-native stats matched `META_STAT`), so it fell through to general narration and got deflected into atmosphere for several turns (9 gate occurrences, 7 in one session). Added three deterministic interceptors answered before narration: skill-mod maps each D&D skill → governing game-stat (mirrors resolve.js `FOCUS_APPROACH`→`statForApproach`: insight→CHARM, perception→WITS, etc.) and reports stat-mod + proficiency (`profBonusFor(level)` when the focus is owned); attack-mod reports melee (MIGHT) and finesse/ranged (AGILITY) to-hit numbers; bare-DC cites `world.conversation.lastRoll.dc` if present, else explains DCs are per-moment. Bare-DC defers to the existing `META_EXPLICIT_CHECK` handler when a check was declared in the same breath ("let me make a WITS check… what's the DC?") — caught one collision (U182-10) and guarded it. Deliberately did NOT: touch the in-dialogue routing (the meta gate is intentionally `!dialogue` — mid-conversation "what happened" is a question FOR the npc; own-number asks resolve via the out-of-combat and combat gates), or change any roll/DC math.
- Proof:
  - `node --test tests/U189.ownNumberQuery.test.js` — 7/7 (5 recognition + 4 answer-shape unit cases + 1 end-to-end `playerMove`)
  - `node --test tests/U182.explicitCheckRequest.test.js` — 11/11 (collision guard verified)
  - Full suite: `node --test` — 7948/0
  - Determinism gates U19/21/22/27/30 green
- Remaining/next: H-26 CRUNCH_INCONSISTENCY cluster (4 sub-bugs) — next, same worker.
- Rollback: revert commit `26ec812`

## 2026-06-19 — Claude Opus

- Packet/seam: Rung 1 / H-24 duplicate combat enemy id (CRASH)
- Commit: `a1c62e3`
- Files changed:
  - `engine/playloop.js` (mid-combat reinforcement id minting)
  - `tests/U188.reinforceEnemyId.test.js` (new)
- Summary: "I spit Greyhand's blood in Brennan's eyes and tackle him through the window." threw `Invariant: duplicate combat enemy id enemy_1`. `beginCombat()` (combatLifecycle.js) is the only START id-assigner and is collision-free, but the mid-fight reinforcement path (`detectNewCombatTarget` branch in playloop.js) minted the new combatant's id as `enemy_${enemies.length}`. A fled foe is pruned from `combat.enemies` (escapeCombat.js:1733), so after a flee the array length falls below the highest LIVE id and the length-based id reuses it → duplicate-id invariant. Fixed by deriving the next id from the max existing `enemy_<n>` numeric suffix (collision-free even after a prune). Deliberately did NOT: touch the invariant (invariants.js:332-333 is correct), change `beginCombat()`'s start-of-fight scheme (already unique), or alter the flee/prune logic.
- Proof:
  - `node --test tests/U188.reinforceEnemyId.test.js` — 2/2 (1 post-prune collision repro now passes, 1 normal-reinforcement regression guard)
  - `node --test tests/U148.midCombatTargetSwitch.test.js` — 4/4 (adjacent path unaffected)
  - Full suite: `node --test` — 7941/0 (was 7939, +2 new)
  - Determinism gates U19/21/22/27/30 green
- Remaining/next: H-25 (DM won't answer "what's my own number") — next in queue, same worker.
- Rollback: revert commit `a1c62e3`

## 2026-06-18 — Claude Opus

- Packet/seam: Rung 1 / H-11 RAG wrong-scene — selection "pick" misclassified as lock-picking (classifier half)
- Commit: `bdb3287`
- Files changed:
  - `engine/playloop.js` (`physicalObjectOutcome()` `isPick` — `PICK_SELECTION`/`PICK_LOCK_NOUN`)
  - `tests/U187.pickClassification.test.js` (new)
- Summary: The broad pick parser matched a SELECTION ("pick one of the gates", "you pick which gate", "pick any door") as lock-picking and treated a bare "gate" as a lock target → "pin by pin… it springs open" for a choose-an-option beat, feeding wrong scene context downstream. Tightened `isPick`: exclude selection phrasings (pick one/any/a/some/whichever/which; you/please/just pick) AND require a genuinely-named lock object (lock/padlock/chest/door/safe/strongbox/cabinet/drawer) — a bare "gate" no longer triggers; "pick the lock on the gate" still works via the named lock. Genuine lock-picks ("pick the lock", "pick the chest") unchanged (regression-guarded). Deliberately did NOT: touch `gracefulAdjudication.js`/`composer.js`, change roll/DC math, or remove "door" from the lock set (kept it — investigation only called out "gate").
- Proof:
  - `node --test tests/U187.pickClassification.test.js` — 8/8 pass (4 selection cases, 1 bare-gate case, 3 genuine-lock-pick regression guards)
  - Full suite: `node --test` — 7939/0
  - Determinism gates U19/21/22/27/30 green
- Remaining/next: **STOPPED per queue plan.** The second half — `engine/llmAdapter.js` narration-validation hardening (reject "standing in/inside/at <wrong node>") — is a SEPARATE, larger commit and was deliberately NOT started. The live wrong-scene text ("Stonebridge's sole structure") is an LLM-polish artifact not reproducible in deterministic `node --test` (and the gate bills the `.env` key, which a worker must not spend, protocol §4). Basecamp to decide whether the classifier fix alone closes H-11 on the next owner-run gate, or whether to authorize the llmAdapter hardening.
- Rollback: revert commit `bdb3287`

## 2026-06-19 — Claude Sonnet

- Packet/seam: Rung 1 / H-35 coin-query interceptor + H-31 R3 follow-ons
- Commit: `c7db26b`
- Files changed:
  - `engine/grace/gracefulAdjudication.js` (META_PURSE extension, `answerPurse` helper, weapon-damage/possession-correction folds, `describeLoadout` dedupe)
  - `engine/playloop.js` (`isNpcAddressedRest` + gate on the out-of-combat `isLongRestIntent` call site)
  - `tests/U196.coinQueryAndPossessionFollowons.test.js` (new)
- Summary: Triaged 4 sub-bugs from the post-H-33/H-34 Opus gate (`docs/playtests/opus-gate-2026-06-19-postH33-H34.md`).
  - **R1** — a `META_PURSE` interceptor already existed (probably from an earlier batch) but was un-tested and had two gaps: it didn't match "do I even have any money on me?" / "pouch of coin" phrasings, and a compound damage+coin ask ("how much coin... and what's the damage die") dropped the coin half the same way the Armor-value compound case used to (H-31 R2). Extended the regex, added an `answerPurse(world)` helper that reuses `purseTotalCopper`/`formatPrice` from `economy/shop.js` (so the DM's count can't drift from the shop's), and folded it into the weapon-damage compound branch.
  - **R2** — `findBogusPossessionClaim`'s correction dropped a coin claim/ask in the same breath as a bogus gear claim. Added a `COIN_CLAIM_RE` (re-asserted amounts like "three copper", distinct from the question-shaped `META_PURSE`) and appended `answerPurse(world)` to the correction when either pattern matches.
  - **R3** — `describeLoadout` listed a signature item twice when it was also an equipped weapon/armor piece (substring-matched case-insensitively against the rendered weapons/armor lists; skip the signature line when it's already named).
  - **R4** — `isLongRestIntent`'s unanchored `\bsleep\b` resolved a direct NPC-addressed historical question ("Kael, elder — ... Whose roof did I sleep under last night?") as an actual long rest. Added `isNpcAddressedRest` (same shape as H-34 R1's `npcAddressedRecap` — requires `socialTarget` to resolve to a real present NPC AND that NPC's name/role to literally appear in the text) and gated the out-of-combat call site (`playloop.js:583`). Left the mid-combat call site (`playloop.js` inside the `w.combat?.active` block, ~line 1803) unguarded per the prompt's own instruction to read context first — it's already narrow (only reachable mid-fight, where "not while something is trying to kill you" is correct regardless of NPC framing) and touching it would brush up against the forbidden combat-dispatch area.
- Proof:
  - `node --test tests/U196.coinQueryAndPossessionFollowons.test.js` — 11/11 (4 R1 + 3 R2 + 2 R3 + 2 R4, each with a false-positive guard)
  - Full suite: `node --test` — 8048/0
  - Determinism gates U19/21/22/27/30 — 6/6 green
  - Live repro check (all 5 exact gate phrasings re-run through `handleMetaQuestion`/`playerMove` directly): all dead-ends/drops/duplicates gone — see commit message for details.
- Remaining/next: none for this packet.
- Rollback: revert commit `c7db26b`

## 2026-06-19 — Basecamp (gate ingestion, no code change)

- Packet/seam: Rung 1 / post-H-35 Opus experiential gate
- Commit: docs-only (RUNG1_QUEUE.md gate section + Next/Budget; this entry)
- Gate: `scripts/dm-playtest.mjs --turns 12 --seeds glass-harbor --personas rules-lawyer,chaos,lore-hound,newbie` → `docs/playtests/opus-gate-2026-06-19-postH35.md`. Dev server restarted fresh immediately before the run (checklist). Cost ~$2.29 (96 calls, 117,460 tokens); budget ~$22.86 → ~$20.5.
- Result: **12/48 (25%)**, flat vs 13/48 post-H-33/H-34 — judged by nature, not number. By-class: DM_TEST_DEADEND 7 · CRUNCH_INCONSISTENCY 3 · CANON_HALLUCINATION 2. Confused newbie 1/12; Rules Lawyer 2/12 (compound-state-query partials, not clean).
- **H-35 shapes did NOT recur — fix held.** Coin/purse BALANCE query clean (Chaos t5 "give me the number" → "twelve silver"); no duplicate inventory listing; no rest-intent NPC-swallow; no compound gear+coin drop. The coin fails this run (Chaos t7/t8) are a different shape — "what's *stamped* on this coin's face" (observe-physical-detail), which belongs to the answer-binding cluster.
- Re-clustered by true root cause into 4 groups (detail in the queue gate section):
  1. **Answer-binding dead-end (DOMINANT, ~6, grace lane)** — resolved info-turn (roll success or bare observe) emits generic boilerplate ("you ask around" / "it goes your way" / "your call") instead of a grounded fact or an explicit in-fiction decline. H-22/23/H-29 deliver-or-decline family recurring in shapes those fixes don't reach (observe-object-detail; quantity/genealogy asks with no canon answer).
  2. **Compound state-query partial (~2, grace lane)** — HP + name + class ask answers one slot, drops the rest (same fold shape H-35 fixed for gear+coin, new slot-pair).
  3. **Combat narration/state desync (~4, combat lane)** — incl. the now-TRACED **enemy-retaliation-without-mechanics**: Chaos t10 `[strike:Punch | atk:6 vs AC:10 → miss]` (clean miss, no enemy action, no HP delta) yet narration invents a "critical counterstrike" dealing PC damage. Plus defeat-threshold not applied (5 dmg vs 3 HP not dropped) and combat-state bleed/no-disengage (`[combat:fled]` on a lore turn).
  4. **Canon lineage hallucination (~2, grace lane)** — confident "generations / roots deep" tenure absent from canon (H-31 R4 age-guard family, extended to lineage).
- **H-36 split PROPOSED, NOT dispatched** (Tim's call): **H-36a (Claude-Sonnet/grace)** = generalize deliver-or-decline (observe-object-detail + quantity/genealogy) + compound slot-completeness + lineage anti-hallucination (clusters 1/2/4, ~8 turns); **H-36b (Codex/combat)** = enemy-retaliation-without-mechanics (traced) + defeat-threshold + disengage/state-bleed (cluster 3, ~4 turns; Codex can't push, §7). File-disjoint → dispatchable in parallel (§2). Road B stays parked.
- Rung-1 bar: **not met** — ~1 forgivable SOFT (Lore-hound t3 margin-0 tie), the rest real defects across 4 clusters; Rules Lawyer not clean.

## 2026-06-19 — Claude Sonnet

- Packet/seam: Rung 1 / H-36a deliver-or-decline generalization
- Commit: `8e0cf6e`
- Files changed:
  - `engine/grace/gracefulAdjudication.js` (broadened `isInfoSeekingText`; compound HP/name/class fold + new `answerHealth`/`answerClassLine`/`META_CLASS_FOLD_RE`)
  - `engine/llmAdapter.js` (`findInventedFactClaim` extended with `LINEAGE_PHRASE_RE`)
  - `engine/playloop.js` (`isExploreIntent` — added an `isInfoSeekingText` exclusion; **see note below**)
  - `tests/U197.deliverOrDeclineGeneralization.test.js` (new, 16 cases)
- Summary: Triaged clusters 1/2/4 from the post-H-35 Opus gate (`docs/playtests/opus-gate-2026-06-19-postH35.md`).
  - **R1** — `isInfoSeekingText`'s `INFO_SEEKING_RE` didn't cover observe-object-detail phrasing ("what's stamped/printed/etched on the coin", "tell me what's on it") or quantity/genealogy phrasing ("how many generations", "who founded"). Added `INFO_SEEKING_OBSERVE_RE` and extended the noun list with `found(?:ed|ing)` (suffix-anchored so it can't false-positive on "found" as past tense of "find") and a `\bhow many generations\b` alt.
    **Playloop touch, disclosed per prompt instruction**: broadening the detector alone wasn't sufficient. Root-caused that `isExploreIntent` (playloop.js) — a SEPARATE, earlier gate covering the broad `/^(what|how|where|who|describe)\b/` survey branch — was intercepting EVERY interrogative-led info-seeking question (old and new phrasings alike) before the deliver-or-decline contract (`infoExtractionOutcome`/`isUngroundedInfoCheck`) ever got a chance to run. This means the H-22/23/H-29/H-31 deliver-or-decline family was effectively dead code for any info-seeking ask starting with who/what/where/how — only non-interrogative-led asks ("Tell me...", "I press him for...") ever reached it. Added a one-line `isInfoSeekingText` exclusion to `isExploreIntent` (confined strictly to that function — `infoExtractionOutcome`, `isUngroundedInfoCheck`, `lookupGroundedFact`, `genericGroundedOutcome` untouched). This is a materially bigger fix than the prompt scoped (it fixes the contract for ALL info-seeking phrasings, not just the two new ones) — flagging for the queue owner to confirm scope is acceptable.
    Also found and left alone: `infoPressCount`'s tier escalation is off-by-one on the very first ask (the current turn's own `pushEvent` lands in `world.timeline` before `infoExtractionOutcome` reads it back, so a brand-new ungrounded ask can render as a tier-1 "I already told you" decline instead of tier-0). Confirmed via `git stash` this predates H-36a entirely (reproducible on pre-H-36a code with old-regex-supported phrasings) — out of scope for this packet, noted for a future R.
  - **R2** — `handleMetaQuestion`'s `META_NAME`, `META_INVENTORY`, and `META_EQUIPMENT`/`META_HELD_ITEMS` branches each returned on first match, dropping HP/class/gear asked in the same breath. Extracted `answerHealth(world)` (lifted verbatim from the old inline `META_HEALTH` body) and `answerClassLine(world)`, added `META_CLASS_FOLD_RE` (narrow — requires "and class/archetype"), and folded them into all three branches.
  - **R3** — extended `findInventedFactClaim`'s H-31 R4 age-phrase family with `LINEAGE_PHRASE_RE` ("roots deep", "for generations", "generations rather than years", "founding family", "since the founding", "multiple generations"), gated the same way (only fires when absent from grounded base; same negation/hypothetical exemption pattern as Rule 4d's roster-entity guard).
- Proof:
  - `node --test tests/U197.deliverOrDeclineGeneralization.test.js` — 16/16
  - Full suite: `node --test` — 8069/0 (run includes a parallel uncommitted H-36b combat-lane diff in the shared working tree — `engine/combat/escapeCombat.js` + `tests/U191`/`U198` — not part of this commit; isolated this packet's `playloop.js` hunk via `git add -p` so only the `isExploreIntent` change is in `8e0cf6e`)
  - Determinism gates U19/21/22/27/30 — 106/106 green
  - No `Math.random`/`Date.now`, no `WORLD_VERSION` bump, no mutation outside `effectsCore.applyDeltas` (this packet adds no new mutation paths — narration/routing only)
- Remaining/next: `infoPressCount` off-by-one (noted above) — separate small fix, not blocking. Queue owner should confirm the `isExploreIntent` scope expansion is acceptable before next gate run.
- Rollback: revert commit `8e0cf6e`

## 2026-06-19 — Basecamp (H-36a + H-36b independent verification)

- Packet/seam: Rung 1 / H-36a (grace) + H-36b (combat)
- Verified (re-ran independently, protocol §7):
  - **H-36a** (`8e0cf6e`/`0ae177f`, on origin) verified in an ISOLATED worktree at `0ae177f` (no H-36b in tree): U197 16/16, full suite **8064/0** (= 8048 + 16), determinism U19/21/22/27/30 101/101. Diff review: grace lane only (gracefulAdjudication.js, llmAdapter.js, tests) + ONE `playloop.js` line — a guard `if (isInfoSeekingText(t)) return false;` inside `isExploreIntent`, confined to that function (the survey branch was shadowing the whole deliver-or-decline contract for interrogative-led info asks — a real pre-existing bug, justified scope-widen). No WORLD_VERSION/Math.random/Date.now; no combat-lane touch; U197 net-new (invariant #19 N/A).
  - **H-36b** (`c2a2634`, local-only — Codex can't push) verified on combined HEAD: U198 5/5, full suite **8069/0** (= 8064 + 5), determinism 106/106, `playtest:quick` 50 runs / 0 crashes / 0 bugs. Diff review: combat lane only (escapeCombat.js, playloop.js combat-dispatch, U191, U198) — NO grace-lane files touched. R1 trace = **case (a)**: the enemy turn really did damage `meta.escapeHp` after a player miss but only the player-miss mechanics line was emitted; fixed by surfacing every damaging enemy action (`enemyMech[]`: `[enemy:Name | atk vs AC → hit | dmg | hp:before->after]`) on the defeat + mixed result lines (no hand-back to grace, no H-36c). R2 (lethal improvised strike → defeated + victory) and R3 (interior move/`?`-question while combat-active held in combat, no fabricated strike/flee/victory) covered by U198 + a regression case that a real mid-combat attack still resolves. U191 STRENGTHENED (round-tag prefix match + new "enemy damage must be visible if HP dropped" assertion) — not weakened. No WORLD_VERSION/Math.random/Date.now.
  - **Shared-file check:** both touched `playloop.js` but in disjoint functions (H-36a `isExploreIntent` ~L4298; H-36b `playerMoveCore` combat dispatch ~L967/L1775) — H-36b stacked cleanly on H-36a's DONE commit, no conflict, linear history.
- Push: Basecamp pushed `c2a2634` (H-36b) + this verification + queue docs to origin after verification (Codex push asymmetry, protocol §7).
- Live-path note: the Codex worker flagged it couldn't run visible v1.html QA (no browser tool in its env) — expected; live-path verification for this batch is the **post-H-36 Opus gate** (the established close for the H-series), not a worker screenshot.
- Remaining/next: run the post-H-36 gate to confirm clusters 1–4 cleared under fresh exploration. H-36a documented follow-up: `infoPressCount` off-by-one (first-ever ask can return a tier-1 decline instead of tier-0 — pre-existing, out of scope; queue for a future grace batch).
- Rollback: revert `c2a2634` (H-36b); `8e0cf6e` (H-36a).

## 2026-06-19 — Basecamp (post-H-36 Opus gate)

- Packet/seam: Rung 1 / post-H-36 gate run + triage
- Action: pre-flight verified (HEAD `fb70e9d`, matches expected; `npm install` clean; key present);
  dev server killed and restarted fresh immediately before the run (per checklist — a stale server has
  silently graded old code before); ran `node scripts/dm-playtest.mjs --turns 12 --seeds glass-harbor
  --personas rules-lawyer,chaos,lore-hound,newbie` (4×12=48 turns, ~$2.23, 96 calls); renamed report
  `docs/playtests/opus-gate-2026-06-19.md` → `opus-gate-2026-06-19-postH36.md` immediately.
- Result: **9/48 failing (19%)**, down from 12/48 (25%) post-H-35. By-class: DM_TEST_DEADEND 5,
  CRUNCH_INCONSISTENCY 2, CANON_HALLUCINATION 2.
- **H-36b (combat truth) — ZERO recurrence, fully held** across a combat-heavy Chaos run (multiple
  strikes incl. a lethal blow). Every damaging hit carried a visible mechanics line; no
  enemy-hit-without-mechanics, no defeat-threshold miss, no combat-state bleed.
- **H-36a (grace generalization) — held for tested shapes, net too narrow.** No recurrence of
  coin-face/genealogy-dead-end-on-SUCCESS, lineage-tenure invention, or HP/name/class compound-drop.
  But two adjacent gaps surfaced:
  1. Mixed-roll-margin genealogy still dead-ends into content-free atmosphere (R1 was verified against
     success outcomes, not mixed/marginal ones).
  2. Item/gear-stat questions (weapon damage, armor AC, gear+coin compound) route through the
     loadout/armor formatter, a separate code path from the general info-seeking detector R1/R2
     touched — inherited neither fix. 3 of the 9 fails are this exact shape (Rules Lawyer t2/t4/t5).
- **New cluster (not an H-36 recurrence) — canon-fact grounding on NPC presence/quotes (2 turns):**
  fabricating a specific quoted accusation not in canon; denying a present NPC against `npcsPresent`.
  Mirror image of H-34's roster-grounding rule (that guards against asserting an entity NOT on the
  roster; this is denying/fabricating detail about one that IS).
- Scattered (2 turns, lower confidence): corpse-staging action dead-ended through the
  combat-no-live-target gate instead of being narrated as a non-combat action; a mixed-roll (margin 1)
  payment reversal narrated as a clean full success instead of carrying a complication — possibly same
  root cause as the mixed-roll genealogy dead-end, trace together.
- **H-37 split PROPOSED, NOT dispatched** (Tim's call): **H-37a (Claude-Sonnet/grace)** = item/gear-stat
  answer-binding generalization + mixed-roll-margin resolution + corpse/object-handling dead-end
  (~6 turns). **H-37b (Claude-Sonnet/grace)** = NPC presence/quote canon-grounding, likely shares
  plumbing with H-34's roster rule (~2 turns). No combat-lane work proposed this round — H-36b held clean.
- Docs updated: `docs/RUNG1_QUEUE.md` (new gate-run section + "Next" + "In flight" reset to none).
- Rung-1 bar: **not met** — Rules Lawyer not clean (5/12); real defects across 3 clusters, not
  phrasing-tail noise.

## 2026-06-19 — Claude-Sonnet (H-37 item/gear + mixed-roll + corpse-staging + canon-presence)

- Packet/seam: Rung 1 / H-37 (R1–R4, grace lane)
- Commit: `4faca88`
- Files changed: `engine/grace/gracefulAdjudication.js`, `engine/llmAdapter.js`, `engine/playloop.js` (pre-combat assault gate + `detectPhysicalAssault` only), `tests/U199.itemStatAndPresenceGrounding.test.js` (new)
- Summary:
  - **R1** — `META_INVENTORY` broadened to allow up to 4 intervening words ("what GEAR AND WEAPONS am I carrying") so a named-noun ask still matches, not just the bare contiguous form. `META_ARMOR_VALUE` broadened to catch a named-armor-piece defense ask ("what does my Padded coat give me for defense?", "what's its AC or defense bonus?"), narrowly scoped to those literal phrasings. `handleMetaQuestion`'s `META_PURSE` branch now folds in `describeLoadout` when a gear/equipment ask is in the same breath — previously it returned the coin half only and dropped gear entirely, since `META_PURSE` is checked before `META_INVENTORY`/`META_EQUIPMENT`.
  - **R2** — traced and found TWO independent root causes, not one shared bug. (a) **Detection-gap**: `isInfoSeekingText`'s `INFO_SEEKING_RE` had no "family" anchor (only "kin"), so a family-lineage ask never matched at all — the entire deliver-or-decline pathway (`infoExtractionOutcome`) was skipped and the turn fell straight to the generic atmosphere floor. Fixed by adding "family" alongside "kin". (b) **Validator false-friction signal**: Rule 3 in `validateNarrationCandidate` (llmAdapter.js) had `'pay'` in its `FRICTION` word list, which matches "paid"/"pays" in virtually any payment narration whether or not it's actually complicated — a clean full payment reversal slipped past undetected. Removed `'pay'` and flipped the rule's logic: previously it only rejected a mixed outcome when an explicit clean-win phrase ("effortlessly") was ALSO present; now ANY mixed-outcome candidate lacking real friction/cost language is rejected outright, full stop.
  - **R3** — `detectPhysicalAssault` (playloop.js) now tags each branch with a `kind` (`grapple`/`move`/`blade`/`hostage`/`bite`). New helper `isNpcAlreadyDefeated(world, npc)` reads `world.meta.npcCombatHp` to check pre-mint whether the target's last recorded combat state was a defeat. The pre-combat assault-gate call site (in `playerMoveCore`, NOT the combat-dispatch branch) now special-cases `kind === 'move'` (drag/shove/throw a body) against an already-defeated NPC: narrates the corpse-staging action directly instead of routing through `engageNpcCombat` and dead-ending on `[combat:no-live-target]`. Genuine renewed-attack shapes (grapple/blade/hostage/bite) on a corpse are unchanged — still correctly no-op.
  - **R4** — new Rule 4e + 4f in `validateNarrationCandidate`, siblings to Rule 4d's roster-grounding check but the opposite failure direction (4d guards against confirming an entity NOT on the real roster; 4e/4f guard against fabricating or denying detail about one that IS). New helper `collectPresentNpcNames(world, ctx)` mirrors `collectRosterTokens`'s source-list order (`ctx.npcsPresent`, `ctx.settlement.npcs`, `world.scene.npcs`, `world.npcs`) but returns real names instead of tokens. Confirmed `ctx.settlement.npcs` (not `ctx.npcsPresent`, which `buildNarratorContext` never actually populates) is the real production presence source. **4e**: rejects a confidently-attributed quoted past NPC statement ("you supposedly asked Corwin, '...'", "they always ask, '...'") whose quoted content is absent from the grounded base — denial/hypothetical lead-ins ("you never asked...") are exempt. **4f**: rejects narration denying the presence of an NPC ("X is not here", "no X here") who the real settlement roster lists as present.
- Proof:
  - `node --test tests/U199.itemStatAndPresenceGrounding.test.js` — 17/17
  - Full suite: `node --test` — 8086/0 (baseline 8069 + 17 new)
  - Determinism gates U19/21/22/27/30 — 123/123 green
  - Grep diff for `engine/combat/*` and `playerMoveCore`'s combat-dispatch branch — empty; all `playloop.js` changes are in the pre-combat assault gate (~L1635-1657) and `detectPhysicalAssault` (~L5680-5740), outside H-36b's scope
  - No `Math.random`/`Date.now` added, no `WORLD_VERSION` bump, no direct state writes outside `effectsCore.applyDeltas` (narration/routing-only changes, no new mutation paths)
- Remaining/next: queue owner should re-run the Opus gate to confirm clusters from `opus-gate-2026-06-19-postH36.md` (DM_TEST_DEADEND ×5, CRUNCH_INCONSISTENCY ×2, CANON_HALLUCINATION ×2) are cleared. R1's compound-fold pattern (gear+coin, weapon+armor) is now consistent across all three META_* branches that needed it (H-35/H-36a/H-37) — worth a sweep to confirm no fourth branch was missed if a future gate surfaces a similar drop.
- Rollback: revert commit `4faca88`

## 2026-06-19 — Basecamp (H-37 verification + post-H-37 Opus gate)

- Packet/seam: Rung 1 / H-37 verification + post-H-37 gate run + triage
- Action: pre-flight found H-37 already `[CLAIMED]` with an uncommitted in-progress diff in
  `engine/grace/gracefulAdjudication.js` — paused and reported status without touching anything (worker
  still active). On resume, worker reported H-37 complete and pushed (`4faca88` code, `e811ba2` DONE
  entry). Verified independently per protocol §7 before trusting the report: `git diff --stat` between
  `eca8584..4faca88` confirmed zero touches to `engine/combat/*`; the `playloop.js` diff reviewed line
  by line and confirmed it's the pre-combat assault-detection gate (intercepts before
  `engageNpcCombat`), not the combat-dispatch branch — in scope per the claim. Full suite `node --test`
  — 8086/0 (matches worker's claimed count exactly). Determinism gates U19/21/22/27/30 run individually
  — 6/6 green. Dev server killed and restarted fresh immediately before the gate (per checklist). Ran
  `node scripts/dm-playtest.mjs --turns 12 --seeds glass-harbor --personas rules-lawyer,chaos,lore-hound,newbie`
  (4×12=48 turns, ~$2.40, 96 calls); renamed report `opus-gate-2026-06-19.md` →
  `opus-gate-2026-06-19-postH37.md` immediately.
- Result: **16/48 failing (33%)**, up from 9/48 post-H-36 — judged by nature, not headline number.
  By-class: DM_TEST_DEADEND 9, CRUNCH_INCONSISTENCY 6, DM_ARTIFACT_LEAK 1.
- **R3 (corpse-staging) — ZERO recurrence, fully held.**
- **R4 (NPC presence/quote) — no direct recurrence**, but a new artifact-leak appeared nearby: DM
  output the raw string `location:Pilgrim's Rest Village` instead of narrating Corwin naming his
  birthplace (template/formatter bug, not a grounding-rule miss).
- **R2 (mixed-roll-margin) — did NOT fully hold.** The exact original boilerplate ("It lands, after a
  fashion — partial, imperfect") recurred verbatim on a margin-1 genealogy ask. Two new siblings
  appeared on the SUCCESS path (out of R2's stated scope but same root symptom): clean success rolls
  (margin 5, margin 3) on indirect/third-person genealogy asks ("who was her husband", "give me one
  name") produced zero fiction content ("It comes off cleanly; the moment turns toward you.").
- **R1 (item/gear-stat) — did NOT fully hold.** Fix only covered the coin+gear fold (META_PURSE
  branch); Rules Lawyer hit class+gear (no coin) 3-way compounds and bare gear yes/no asks all 6 of its
  first 6 turns — DM regressed to dumping the raw stat block, never resolving class or gear once.
- **New cluster (not an H-37 recurrence) — combat HP/entity-tracking desync, 6 turns, Chaos-griefer,
  combat lane:** enemy HP mechanics lines used the player's own HP numbers (`hp:13->11` when canon
  enemy HP is 4/8); an unprompted attack roll fired on a non-attack action (spit + taunt); strike
  mechanics labeled "Worn Blade" when the player declared a torch attack (weapon-label desync). This is
  `engine/combat/*` territory — out of scope for grace, first combat-lane regression since H-36b.
- **H-38 split PROPOSED, NOT dispatched** (Tim's call): **H-38a (Claude-Sonnet/grace)** = broaden the
  R1 fold beyond META_PURSE to class+gear/bare-gear asks; trace why R2's mixed-margin fix isn't
  reaching this phrasing; new success-path zero-content genealogy gap (same detector family-anchor
  gap?); fix the `location:...` artifact leak (~9-10 turns). **H-38b (combat lane, Codex per
  [[feedback_worker_routing]])** = enemy/PC HP entity-tracking desync + weapon-label mismatch in
  `escapeCombat.js` territory — needs its own worker, separate from grace (~6 turns).
- Docs updated: `docs/RUNG1_QUEUE.md` (new gate-run section + "Next" + "In flight" reset to none +
  budget updated to ~$15.9 remaining).
- Rung-1 bar: **not met** — two of four H-37 fixes need broadening (not regressions, narrow nets), plus
  a fresh combat-lane bug surfaced. Rules Lawyer not clean (6/12), Chaos not clean (5/12, new shape).

2026-06-20T10:58:00Z — Claude-Sonnet
- Packet/seam: H-45 consumables wire-up
- Commit(s): `562cc06` (code), `3064288` (claim)
- Files changed: `engine/ruleset/core/items/consumables.js`, `packs/fantasy/gear.json`, `engine/chargen/fantasyGear.js`, `engine/chargen/gear.js`, `engine/playloop.js` (CONSUME_RE noun-list only), `engine/grace/gracefulAdjudication.js`, `tests/U208.consumables.test.js` (new)
- Summary:
  - **Root cause confirmed exactly as dispatched**: the live game path (`beginAdventure` → `createCharacter` → `buildLoadout`) uses `engine/chargen/fantasyGear.js`'s `FANTASY_STARTER_GEAR`, NOT `packs/fantasy/gear.json` directly (a comment at playloop.js:187 already said so — "gear.json was never wired in"). The two files are byte-identical mirrors with no generator script left in the repo (`scripts/gen-fantasy-gear.mjs` referenced in a fantasyGear.js comment no longer exists), so both were hand-edited identically and verified byte-equal after every change. `packs/fantasy/gear.json` itself is only consumed by three chargen unit tests (`chargen_pack_tags`, `chargen_determinism`, `save_roundtrip_chargen`), not by the live seed.
  - **Deeper finding beyond the dispatch's trace**: `tryUseConsumable`/`escapeCombat.js`'s consumable path only ever reads `inventory.items` (the structured, defRef-keyed T2 array) — never the legacy flavor buckets (`inventory.consumables` etc.) that chargen's `buildLoadout` populates. So giving the gear.json entries a bare `defRef` field would NOT have been sufficient by itself: the flavor pick never reaches `inventory.items` at chargen time at all (that array starts permanently empty until a shop-buy/loot `addItem` delta fires). The real fix needed a bridge at the instantiation glue, not just a catalog link.
  - **(i) Catalog + bridge**: added three defs to `consumables.js` — `bandages` (`heal 1d4`, `applied:true` → narrated as bound, not drunk), `tonic_of_grit` (`heal 2d4`), `holy_water_questionable` (`removeCondition: 'cursed'`, condition names are free-form strings, no enum to extend). Added a matching `"defRef"` field to those three entries in both `gear.json` and `fantasyGear.js` (Rations and Lamp oil deliberately untouched — no defRef, no catalog def — they stay pure flavor). In `engine/chargen/gear.js`'s `buildLoadout`, a picked consumable carrying a defRef that resolves in the real catalog is now minted directly into `inventory.items` (`{id:'start_<defRef>_<i>', defRef, equipped:null}`) INSTEAD OF the legacy bucket — deliberately not duplicated into both, since `removeItemById` only ever touches `items[]` and a dual-bucket copy would zombie-list in the flavor bucket forever after being consumed. A flavor-only pick (no defRef) goes through exactly as before. `tryUseConsumable` and `escapeCombat.js`'s combat-path consumable resolution needed ZERO changes — both already generically resolve any `inventory.items` entry via `getItemDef`/`effect.kind`, confirming this was pure wiring. One minimal, commented addition to `playloop.js`'s `CONSUME_RE` (noun-list only, `holy\s*water` added) — without it "I drink the holy water" never reached `tryUseConsumable` at all, since none of the existing recognized nouns (potion/draught/elixir/antidote/tonic/remedy/splint/dressing/bandage) cover it.
  - **(ii) Grace**: `answerItemQuery` (`gracefulAdjudication.js`) previously only ever read `.notes`/`.note` and always claimed "nothing special fires when you use it" for ANY item, real effect or not — and silently dropped every `inventory.items` entry from consideration entirely (its filter required a `.name`, which structured items don't have). Rewrote it to resolve a catalog def for both inventory shapes (flavor via `findDefByName`, structured via `getItemDef`) and describe the real effect (`heal`→"restorative, heals you"; `removeCondition`→"cures `<condition>`") when one exists; the existing honest no-effect line is unchanged and still reached correctly for Rations/Lamp oil (which have no catalog def at all). New `META_CONSUMABLES_LIST` pattern + handler ("list/read back/name/show my consumables", "what consumables do I have") returns the real consumables from BOTH buckets, checked before `META_INVENTORY` in the handler chain so it wins over that branch's existing (pre-existing, unrelated to this packet) blanket skip of the entire `items[]` array.
  - **(iii) No stat-block leak**: confirmed via U208-02's explicit assertion — drinking carries no `MIGHT/AGILITY/WITS/GRIT/CHARM` leak and no stray d20/`🎲` token in mechanics.
  - **Deliberately did NOT do**: did not fix `META_INVENTORY`'s generic pack-dump loop's pre-existing blanket `cat === 'items'` skip (it already silently dropped ALL structured items — shop-bought potions, equipped weapons, everything — from "what's in my pack?" before this packet; still does, for everything except the new dedicated "list my consumables" query). Did not touch the EXAMINE path (`allInventoryItems`/`nameMatches` in playloop.js, used by "examine my X") — structured items have no `.name` so "examine my tonic of grit" falls through same as any other structured item; this was already true for every shop-bought/looted item and isn't new. Did not touch `engine/combat/*` or `engine/llmAdapter.js`. Did not bump `WORLD_VERSION` or touch `effectsCore.js`/`invariants.js`/`state.js`. No `Math.random`/`Date.now` introduced.
- Proof:
  - `node --test tests/U208.consumables.test.js` — 12/12 (written FAILING first: 9/12 failed pre-fix, confirming the bug; all 12 green post-fix)
  - `node --test tests/U156.itemQueryGrace.test.js tests/U120.consumables.test.js` — 10/10 (directly adjacent existing coverage, unmodified, still green)
  - Full suite: `node --test` — 8202/8202 (baseline 8190 + 12 new)
  - Determinism: `node --test tests/U19.worldHashDeterminism.test.js tests/U21.replayGateN50.test.js tests/U22.longRunStabilityN100T500.test.js tests/U27.worldHashSurfaceContract.test.js tests/U30.gate6.sequelDeterminism.test.js` — 6/6
  - `npm run playtest:quick` — 50 runs, 0 crashes, no bugs found
  - `git diff --stat` confirms the touched-file list exactly matches scope; `git diff engine/playloop.js` is the single CONSUME_RE line (+comment) only, nowhere near the combat-dispatch branch; gear.json/fantasyGear.js verified byte-identical via JSON diff after edits
- Remaining/next: `META_INVENTORY`'s blanket `items[]` skip (noted above) is pre-existing and broader than this packet (affects weapons/armor/magic/quest items too, not just consumables) — worth its own packet if the queue owner wants the generic "what's in my pack" answer to be fully items-aware rather than just the new dedicated consumables-list query. Same for the EXAMINE-path `.name`-only matching gap.
- Rollback: revert `562cc06`

2026-06-20T11:35:00Z — Claude-Sonnet
- Packet/seam: H-46 inventory items[] listing
- Commit(s): `7ea7669` (code+test), `8f9e858` (claim)
- Files changed: `engine/grace/gracefulAdjudication.js`, `tests/U209.inventoryItemsListing.test.js` (new)
- Summary: META_INVENTORY's generic "what's in my pack?" dump looped `Object.entries(inventory)` and explicitly `continue`d on `cat === 'items'`, dropping every structured `inventory.items[]` entry — H-45's bridged starting consumables (Tonic of grit, Bandages, Holy water) and any future structured item (shop-bought potions, looted weapons/armor) silently vanished from this generic dump, even though they're real and the dedicated "list my consumables" query already surfaced them. Fix: each `inv.items[]` entry is now resolved via `getItemDef(it.defRef)` (already imported) and merged into the same `byCat` listing under its catalog `kind`'s line (`weapon`→`weapons`, `consumable`→`consumables`, `tool`→`tools`, `armor`→`armor` no pluralization, others default to `kind + 's'`) — so a bridged consumable appears under `consumables:` alongside Rations/Lamp oil, one combined line, not an orphan. A `seen` Set (lowercase item name) built from the flavor-bucket pass first, then checked before adding any items[]-resolved name, prevents double-listing if an item somehow exists in both shapes under the same name. Entries whose `defRef` doesn't resolve (`getItemDef` returns falsy/no `.name`) are silently skipped, never invented. The existing flavor-bucket listing logic and empty-pack honesty line are unchanged.
- Deliberately did NOT do: did not touch the EXAMINE path (`allInventoryItems`/`nameMatches` in playloop.js) — "examine my tonic of grit" still falls through for structured items since they have no `.name` field there; that's a separate, pre-existing gap noted in the H-45 DONE entry, out of this packet's scope. Did not touch `engine/combat/*`, `llmAdapter.js`, or `playloop.js`. No `WORLD_VERSION` bump, no `effectsCore.js`/`invariants.js` changes, no `Math.random`/`Date.now`.
- Proof:
  - `node --test tests/U209.inventoryItemsListing.test.js` — 6/6 (written FAILING first: 3/6 failed pre-fix — 01 bridged consumable missing, 02 same in a mixed flavor+structured pack, 03 a non-consumable weapon-kind item missing — confirming the bug; all 6 green post-fix)
  - Full suite: `node --test` — 8208/8208 (baseline 8202 + 6 new)
  - Determinism: `node --test tests/U19.worldHashDeterminism.test.js tests/U21.replayGateN50.test.js tests/U22.longRunStabilityN100T500.test.js tests/U27.worldHashSurfaceContract.test.js tests/U30.gate6.sequelDeterminism.test.js` — 6/6
  - `git diff --stat` confirms only `engine/grace/gracefulAdjudication.js` (+21/-2) and the new test file were touched
- Remaining/next: none for this packet; EXAMINE-path `.name`-only matching gap (noted above, pre-existing per H-45) still open if the queue owner wants it picked up separately.
- Rollback: revert `7ea7669`
[CLAIMED] H-47 item-effect answer breadth · Claude-Sonnet · 2026-06-20T11:47:44Z · files: engine/grace/gracefulAdjudication.js, tests/U210.itemEffectBreadth.test.js
[CLAIMED] H-48 combat finish-low-HP · Codex · 2026-06-20T11:48:26Z · files: engine/playloop.js, engine/combat/escapeCombat.js, tests/U211.combatFinishLowHp.test.js
[CLAIMED] H-49 lore-invention guard · Claude-Sonnet · 2026-06-20T11:48:33Z · files: engine/llmAdapter.js, tests/U212.loreInventionGuard.test.js
