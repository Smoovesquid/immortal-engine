# CMB-SINK-1 — a forceful advance mid-fight resolves; it never bounces as table-talk

**Model:** Codex 5.5 (deep combat-engine lane — `escapeCombat.js` / `playloop.js` combat routing).
**Solo on the combat files.** Runs in PARALLEL with NBIO-1 (Sonnet), which is file-disjoint (dialogue/personQuery only).
**Stay OFF** `engine/npc/dialogue.js` and `engine/world/personQuery.js` — those are NBIO-1's. If your fix seems to
need them, STOP and flag it.

## Context — the last live combat dead-end
On the 2026-07-02 re-gate (`docs/playtests/opus-gate-2026-07-02-regate-postDTD.md`, the Chaos-griefer finding),
during **active escape combat (round 4)** the player declared:

> "I barrel through the doorway, knocking anything in my way flat, and sprint into the outpost."

The engine narrated positioning and returned **`[combat:table-talk]` with ZERO mechanical consequence** — no
roll, no enemy reaction, the round did not advance. The judge flagged it: a **declared forceful action with
stakes** (knocking things flat, bulling past braced foes) was left unresolved as free table-talk. That is a
DM_TEST_DEADEND: the player committed to a violent advance and the fiction did nothing back.

This is the combat half of the answerability family (AG-1/DLG-1 closed the info/dialogue sinks). The rule to
restore (THE_TABLE_TEST): **a forceful advance/shove-through is a combat ACTION — it costs the round and the foes
react — it is NOT flight and NOT idle scene-business.** Escape combat still can't be *fled*; but "barrel THROUGH /
shove past / charge in" is an *engagement*, not a disengagement, so the "you can't flee" ruling is the wrong sink.

## Read first
- `engine/playloop.js:2405-2495` — the escape-mode table-talk gate. The over-matching guards:
  - `:2463` **`isFreeMovementIntent`/`isFleeIntent`** → `'no running from this one'` (this is where "barrel
    through … sprint into the outpost" currently lands, or:)
  - `:2445` **`isCombatSceneObjectAction`** → `'make a mess of the room … the fight is still on you'`.
  Each of these is a `!explicitAction && …` guard whose purpose is to stop the escape resolver from turning
  non-actions into phantom sword swings. A forceful advance is a real action, so it should be treated as one.
- `engine/playloop.js` — `parseEscapeAction` (the verb parser; note the existing `parley` verb) and the
  `explicitAction` composite at `:2417` (`improvisedCombatAction || targetedViolentAction || isNaturalWeaponAttack
  || isFoeEnvironmentAttack || /\b(strike|attack|…|guard|ward|cover|throw|…)\b/`). "barrel/bull/shove/charge/rush"
  are absent — that's why it isn't `explicitAction`.
- `engine/escapeCombat.js` — the escape resolver (HP resolver, enemy reactions). This is where a resolved advance
  must produce a mechanical beat: the round advances and the foes act.

## Fix shape (the advance RESOLVES; determinism holds)
1. **Classify forceful advance as a combat action.** Distinguish *aggressive/closing movement* — "barrel through",
   "bull past", "shove through/past", "charge in", "rush them", "force my way through", "knock X flat and push in"
   — from *genuine flight* ("I run away", "I flee", "I retreat", "escape out the back"). Only genuine flight keeps
   the `'no running from this one'` ruling. A forceful advance is a declared action.
2. **Resolve it with a real consequence** through the escape resolver — do NOT return `[combat:table-talk]`:
   - The advance **costs the round** and **the foes react** (an opportunity strike / the braced foe's attack —
     whatever the resolver already does for a taken turn). The player may reposition, but the escape law holds:
     they do not leave the fight — and now that outcome is a *consequence they paid for* (took hits, still
     engaged), not a free no-op. A resolved forceful advance is closest to a Dash/shove-past that draws attacks.
   - If the cleanest resolver fit is "treat as a shove/advance that provokes and ends the turn," do that; if the
     resolver has no advance verb, add a minimal one (`advance`/`shove`) that ends the round and lets enemies act.
     **Biblioteca V11: the resolver sets every number** (attack rolls, damage) via `engine/rng.js` — never the LLM.
3. **Keep the genuine guards intact.** Real flight → the no-flee ruling. A real question mid-fight → still answered
   as `[combat:table-talk]`. Idle scene-business with no advance ("I pace the room") → still table-talk. Only the
   forceful-advance case changes.

## Invariants — by reference (do not weaken)
THE_TABLE_TEST (a declared forceful action gets a consequence). Escape law: fights can't be *fled* — that ruling
STAYS for genuine flight. Determinism: `engine/rng.js` is the sole randomness source; a resolved advance must be
seed-stable; `worldHash` stable under replay; **U19/21/22/27/30 green**. All mutations via
`effectsCore.applyDeltas` — no direct combat-state writes (mind the ensureCombat whitelist if you add a field).
LLM never throws. §0 never surfaced.

## Test plan
- **`tests/U314.combatAdvanceResolves.test.js`** (pre-assigned, LLM-off): in active escape combat, "I barrel
  through the doorway, knocking anything in my way flat, and sprint into the outpost" → the round ADVANCES and a
  mechanical beat lands (enemy acts / HP or turn-state changes), **NOT** `[combat:table-talk]` with zero change.
  Diverge guards (must stay table-talk / their existing ruling): genuine flight "I run for the door and flee" →
  the `no running from this one` ruling; a real question "what are my options?" → answered as table-talk; idle
  "I pace the room" → table-talk. Assert determinism: same seed → same resolved outcome.
- **`tests/corpus/C18.corpus.mjs`** (pre-assigned) — a small paraphrase corpus for the forceful-advance family
  ("barrel through", "shove past them", "charge in", "bull my way through") vs diverge ("I flee", "I run away"),
  locked. Keep the whole corpus 100% (`npm run convergence`).

## Done-when
`U314` + `C18` green · `npm run convergence` 100% locked · `node --test` fully green · determinism green ·
**`npm run playtest:quick` 0 bugs** (combat/playloop touched — run it). **Do NOT touch `package.json` or
`public/v1.js`** — NBIO-1 runs in parallel and would collide on the version lines; Basecamp does ONE consolidated
version bump when both lanes land.

## Commit protocol
Stage ONLY your files by explicit path (`engine/playloop.js`, `engine/escapeCombat.js`, `tests/U314.*`,
`tests/corpus/C18.*`) — untracked briefs/docs are in the tree, so **never `git add -A`**. Commit locally
(`feat(combat): CMB-SINK-1 — a forceful advance mid-fight resolves, not table-talk`). **Report the commit hash; do
NOT push** — Basecamp verifies (re-runs the repro, checks the flee/question diverge guards + determinism), does the
version bump, and pushes.
