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
