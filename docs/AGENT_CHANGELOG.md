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
