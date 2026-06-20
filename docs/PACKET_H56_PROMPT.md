# H-56 packet — ungrounded-NPC referent guard: decline/clarify a fabricated NPC, don't roll-and-filler or movement-deadend (Codex)

Paste everything below the line to the Codex worker. You own `engine/playloop.js` + `tests/U219...` (and a
`docs/AGENT_CHANGELOG.md` claim/DONE line). **Do NOT edit `engine/grace/gracefulAdjudication.js`** — reuse its
already-exported classifiers (imported at `playloop.js:46`); if you think you need to change a grace regex,
STOP and report.

---

## Context

Opus gate `docs/playtests/opus-gate-2026-06-20-postH54-H55.md` (10/48) — the dominant cluster, **7 of 10
fails**, is one shape: the player references an NPC that was never grounded in canon, and the DM neither
confirms nor *declines* — it rolls a generic success with content-free filler, or gives a movement deadend.

**Lore-hound (×5)** — asserts a false premise about a fabricated NPC ("Brae Copperforge"), then demands
specifics:
- _"Wait — who's Brae Copperforge, and when did they walk in? I never saw anyone else in this room."_
  → DM: _"You bide your time, eyes moving over Pilgrim's Rest Village."_ `[roll:15 vs DC:12 → success …]`
- _"Don't dodge me — you mentioned Brae Copperforge nodding along just now. Where is this person standing?"_
  → DM: _"You manage it, and the way ahead opens a little."_ `[roll:14 vs DC:12 → success …]`
- _"So Brae's a guard now — who posted them here, and what crime am I suspected of?"_
  → DM: _"You see it through, and it goes your way."_ `[roll:19 vs DC:12 → success …]`

**Confused-newbie (×2)** — a *social* intent toward the same fabricated NPC gets a *movement* deadend:
- _"Okay, um, can I go talk to that guard, Brae, about the bandit?"_ → DM: _"That way is blocked from here."_
- _"Okay, I made it. Brae, can I talk to you about that bandit…?"_ → DM: _"It falls short here… left where you started."_

Right behavior in every case: a grounded clarify/decline — _"There's no one named Brae here; I never mentioned
anyone by that name. Who do you mean?"_ — NOT a rolled generic success, NOT a movement deadend. This is the
H-9 false-premise family + the U214 referent guard, extended to a **named** ungrounded referent.

## Root cause (already traced — do not re-discover)

NPCs are grounded only as `node.settlement.npcs` at the current node (there is no global NPC registry). Nothing
checks a player-supplied **proper-name** referent against that ground truth before resolving:

1. **Talk/approach half** — `playloop.js:1512–1600`. `extractDialogueRef`/`extractApproachRef` pull
   `talkRef = "Brae"`. At **line 1544** `resolveNpcAtCurrentNode(w, "Brae")` returns null (no such NPC), the
   `if (resolved) {…}` block is **skipped**, and execution falls through past the `if (talkRef)` block into the
   travel/movement gates below → "That way is blocked from here." A social intent with an unresolved *named*
   referent becomes a movement deadend. (The vague-referent clarify at **1527–1542** only fires for
   "someone/anyone/people" — not for a concrete fabricated name.)
2. **Demand/interrogation half** — the "where is Brae standing / who posted Brae" utterances match no talk,
   approach, or `handleMetaQuestion` branch (grace runs at **line 803**, returns null here), so they fall to
   the generic non-combat action path that ends at **line 2369** (`genericGroundedOutcome`) → a generic
   WITS/focus `success` narrated as content-free filler.

Grace already exports useful classifiers (imported at **line 46**): `isNpcObserverQuery`, `isInfoSeekingText`,
`isConfrontationChallenge`. Use them as the detection substrate — do not rebuild them and do not edit them.

## The fix — one deterministic ungrounded-referent guard in playloop.js

### Shared helper
Add `isGroundedNpcRef(world, ref)` near the other NPC resolvers (`resolvePresentNpcStrict`/`Loose`, ~3453):
returns true iff `ref` resolves to a present NPC (`resolvePresentNpcStrict(world, ref) ||
resolvePresentNpcLoose(world, ref)`) **or** the name token appears in the world's already-introduced canon —
check the cheap, deterministic sources only: present `settlement.npcs` (name/role/descriptor — the
`resolveNpcByRoleOrDescriptor` fields), and the recent-beats / dialogue history the engine already keeps
(`world.scene?.dialogue`, recent beats). If the ref is a bare role that *does* match a present NPC, it's
grounded (don't break "talk to the guard" when a guard is present). Conservative: only treat a ref as a
"concrete referent" when it's a proper-name-shaped token or a role/descriptor — never a pronoun or a generic
"someone".

### (A) Talk/approach path — referent clarify instead of movement fall-through
At **line 1544**, when `talkRef` is a concrete referent and `resolveNpcAtCurrentNode` returns null AND
`!isGroundedNpcRef(w, talkRef)`, return the existing `[clarify:who]` shape (mirror **1536/1541**) naming who
*is* actually here:
`"Wizard: There's no one named ${ref} here — ${rosterClause}. Who do you mean?"` (rosterClause = the present
non-hostile names, or "no one's within earshot" when empty). Do **not** fall through to travel. Keep the
existing behavior when the name DOES resolve (real NPC → dialogue) and when the ref is grounded-but-not-here.

### (B) Demand/interrogation path — grounded decline instead of a generic roll
Before the generic non-combat resolution (i.e. after the grace block at ~803 and the dialogue/approach routing
at ~1524, in the same region as the attack no-target guard ~2008, BEFORE the resolve that feeds line 2369):
detect an utterance that is **centered on a concrete NPC referent** (use `isNpcObserverQuery` /
`isInfoSeekingText` / `isConfrontationChallenge` plus a proper-name/role extraction) whose referent is
**ungrounded** (`!isGroundedNpcRef`). Return a grounded decline, not a roll:
`"Wizard: I haven't introduced anyone named ${ref}, and there's no one by that name here. ${rosterClause} —
who do you actually mean?"` `mechanics: '[clarify:referent]'`. No d20, no state change.

Reuse one decline/roster builder for (A) and (B). Keep it surgical — a guard that returns early; touch no other
branch.

## False-positive fences (required — this is where it goes wrong)
- A real present NPC referenced by name OR role must still resolve to dialogue (A) and must NOT trip the decline
  (B). Test "talk to the baker" / "where is the baker standing" with a baker present → unchanged.
- A generic non-NPC action ("I search the room", "I wait", "I head north") must NOT be caught — the guard fires
  ONLY when the utterance is NPC-referent-centered with a concrete name/role token.
- A vague "talk to someone" must still hit the existing **1527** clarify, not the new named-referent decline.
- Pronoun-only follow-ups ("where is he standing") when a real NPC is in scene/dialogue must NOT be declined as
  ungrounded — a pronoun with a grounded antecedent is grounded.

## Out of scope (do NOT do)
- Do **not** edit `engine/grace/gracefulAdjudication.js` (reuse its exports), `escapeCombat.js`,
  `combatGroundedOutcome`, `llmAdapter.js`, `resolve.js`, or combat. If the fix seems to need any, STOP/report.
- Do **not** mint the fabricated NPC, and do not add it to canon — the whole point is to decline it
  (narration≠canon).
- No `WORLD_VERSION` bump, no `Math.random`/`Date.now`, no `effectsCore`/`invariants` changes.

## Test plan — `tests/U219.ungroundedNpcReferent.test.js` (U218 is the current highest)

RED-first. Build a minimal `world` with a present non-hostile NPC (a baker, role+name), mirroring the
`worldWith` fixture in `tests/U218.attackByRoleStartsCombat.test.js`. Drive turns through `playerMove` (the real
entry). Assert:
1. **(B) demand, fabricated name** — verbatim gate phrasing `"Don't dodge me — you mentioned Brae Copperforge
   nodding along just now. Where is this person standing?"` → mechanics is `[clarify:referent]` (or `[clarify:*]`),
   NOT a `[roll:… → success]`; narration says no one named Brae / never introduced; world unchanged.
2. **(A) talk, fabricated name** — `"can I go talk to that guard, Brae, about the bandit?"` → a `[clarify:*]`
   referent line that names the real roster, NOT "that way is blocked" / a movement deadend; no dialogue begun.
3. **Grounded name still works (A)** — `"talk to the baker"` with the baker present → dialogue begins (unchanged).
4. **Grounded demand still resolves (B-negative)** — `"where is the baker standing?"` with the baker present →
   NOT declined as ungrounded (resolves as before).
5. **Generic action untouched** — `"I search the room"` / `"I head north"` → NOT caught by the guard.
6. **Vague referent unchanged** — `"I talk to someone"` → the existing **1527** "A few folk are about…" clarify.

## Done-when
1. `tests/U219...` RED-first, then all green; existing U214/U207/U218/UX2 routing tests still green.
2. Full suite green (`node --test`); determinism U19/21/22/27/30 green.
3. `npm run playtest:quick` clean (touches social/action routing — 50 runs, 0 crashes).
4. `git diff --stat` shows ONLY `engine/playloop.js` + `tests/U219...` (+ the changelog claim/DONE line).
5. Claim `[CLAIMED] H-56` in `docs/AGENT_CHANGELOG.md` before starting; replace with a full DONE entry (root
   cause, fix summary, RED-first proof, counts) when finished.
6. **Codex: commit locally, do NOT push** — Basecamp verifies per §7 (incl. adversarial probes beyond U219)
   and pushes.
