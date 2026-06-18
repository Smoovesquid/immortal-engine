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
