# AGENT_CHANGELOG

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
