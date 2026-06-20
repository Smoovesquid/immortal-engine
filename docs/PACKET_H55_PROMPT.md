# H-55 packet — declared lethal attack on a role/descriptor NPC must start real combat, not assert a freebie hit (Codex)

Paste everything below the line to the Codex worker. **Parallel with H-54 (Claude-Sonnet, grace lane) —
file-disjoint: you own ONLY `engine/playloop.js` + `tests/U218...`. If your fix appears to need
`engine/grace/gracefulAdjudication.js`, STOP and report.**

---

## Context

Opus gate `docs/playtests/opus-gate-2026-06-20-postH52-H53.md` flagged one **high**-severity
COMBAT_NOT_STARTED from the Chaos-griefer persona at the glass-harbor settlement:

- Player: *"I let go of his ankles, draw my dagger, and stab the baker in the gut."*
- DM: *"The baker of Pilgrim's Rest Village stumbles back against the flour-dusted shelf as your dagger finds
  his gut, his breath leaving him in a sharp, disbelieving grunt."*
- mech: `(none)` — **a lethal attack on a present NPC was narrated as a clean hit with no combat started, no
  enemy entity/HP created, no roll resolved.** This violates narration≠canon: prose asserted a wound the
  mechanics never adjudicated.

## Root cause (already traced — do not re-discover)

`engine/playloop.js` attack-intent detection resolves the target by **NAME only**. The CM11 attack path
(~**line 1983**) is:

```js
const anyIntent = detectAttackAnyIntent(w, text);
... engageNpcCombat(w, anyIntent.npc, text, pack, actorId, true)
```

`detectAttackAnyIntent` / `declaredNpcViolence` (~line 771) and the sibling assault detectors match the
player's text against `settlement.npcs` by **NPC name** (and filter `!n.hostile`). "the baker" is a
**role/descriptor**, not a name, so no NPC matches → no combat is engaged → the turn falls through to a
narration-only beat that asserts the hit.

The codebase **already has** role/descriptor NPC resolution for a different verb: the APPROACH path uses a
`npcByRoleOrDescriptor`-style matcher (~**lines 3468–3480**) that resolves "the baker"/"the blacksmith" against
`settlement.npcs` by role/occupation/descriptor. The attack detectors simply don't use it.

## The fix

Make a **declared lethal/violent attack on a present NPC referenced by role or descriptor** resolve that NPC
and route to `engageNpcCombat`, exactly as a name-referenced attack already does.

1. **Target resolution.** In the attack-intent resolution (`detectAttackAnyIntent` / `declaredNpcViolence`),
   after the existing name match fails, fall back to the **same role/descriptor matcher the APPROACH path
   uses** (lines 3468–3480 — extract/reuse it; do not fork a second divergent matcher). If it resolves a
   present NPC, return that NPC as the attack target so line 1983 engages combat normally.
2. **Hostility filter.** The attack path must NOT filter on `!n.hostile` for target *selection* — you can
   attack a currently-non-hostile NPC (that's the whole point; attacking the baker makes him a combatant).
   Keep any `!n.hostile` filter that exists for *peaceful* interactions, but the attack resolver must be able
   to target a non-hostile present NPC. Reuse the APPROACH matcher's presence/at-node check.
3. **No present NPC → decline in-fiction, never narrate a freebie kill.** If neither name nor role/descriptor
   resolves a present NPC (the "baker" is purely narration-invented and not in `settlement.npcs`), the turn
   must NOT assert a wound. Route to the existing in-fiction decline/redirect beat (the same "there's no one
   like that here / who do you mean?" grounding the engine already uses elsewhere) — do NOT mint an NPC and do
   NOT narrate an unmechanized hit. This is the narration≠canon guard; it is as important as the combat-start
   fix.

Keep the change surgical: it's a target-resolution fallback on the attack path plus the no-target guard. Do
not alter `engageNpcCombat`, the combat resolver, damage math, or `combatGroundedOutcome`.

## Out of scope (do NOT do)
- Do **not** touch `engine/combat/escapeCombat.js`, `combatGroundedOutcome`, combat damage/HP math, or
  `engine/grace/gracefulAdjudication.js` (H-54 owns grace — STOP and report if you think you need it).
- Do not build a new NPC matcher — reuse the APPROACH role/descriptor matcher (lines 3468–3480).
- Do not change name-based attack behavior (it works); only add the role/descriptor fallback + no-target guard.
- No `WORLD_VERSION` bump, no `Math.random`/`Date.now`, no `effectsCore`/`invariants` changes.

## Test plan — `tests/U218.attackByRoleStartsCombat.test.js` (U217 is H-54's; pick U218)

RED-first. Build a minimal `world` with a settlement containing a present, non-hostile NPC whose role/descriptor
is "baker" (no proper name needed, mirror an existing `settlement.npcs` fixture — find one via
`grep -rl "settlement" tests/ | head`). Drive the attack turn through the real entry the gate exercises
(`playerMove`/`newScene` — match how other playloop tests invoke a turn; do NOT call private detectors if the
suite convention is full-turn). Assert:

1. **Combat starts:** `"I draw my dagger and stab the baker in the gut"` → combat is engaged against the baker
   NPC (assert the combat/enemy entity now exists and/or a roll was resolved — assert on the same world-state
   signal other combat-start tests use, e.g. `w.combat`/escape-combat state), NOT a `(none)`-mech narration.
2. **Name path still works:** an attack on a named NPC still engages combat (regression).
3. **No-target guard:** `"I stab the dragon-priest in the gut"` when no such NPC is present → NO combat, NO
   asserted wound; the output is the in-fiction decline/redirect (assert no enemy entity was minted and the
   text is the grounding/decline beat, not a hit narration).
4. **Non-hostile is targetable:** confirm the baker being `hostile:false` does not block the attack.
5. Determinism: U19/21/22/27/30 unaffected (a fresh combatant is created through the normal deterministic path).

## Done-when

1. `tests/U218...` added RED-first, then all green.
2. Full suite green (`node --test`); determinism U19/21/22/27/30 green.
3. `npm run playtest:quick` clean (touches attack routing — 50 runs, 0 crashes).
4. `git diff --stat` shows ONLY `engine/playloop.js` + `tests/U218...` (+ your `docs/AGENT_CHANGELOG.md`
   claim/DONE line) — nothing incidental.
5. Claim `[CLAIMED] H-55` in `docs/AGENT_CHANGELOG.md` before starting; replace with a full DONE entry
   (root cause, fix summary, RED-first proof, counts) when finished.
6. **Codex: commit locally, do NOT push** — the queue owner verifies per §7 and pushes.
