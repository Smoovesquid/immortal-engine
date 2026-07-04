# Worker brief — DX-2a: tactical positioning confers combat mechanics

*(Self-contained prompt for a fresh Opus 4.8 window in the immortal-engine repo. Homebase owns the merge — leave a branch, do not merge to `v2-polish`.)*

---

## TASK
Make tactical position actually MATTER in combat: **cover raises effective defense; flanking and high ground grant advantage.** This is the bounded first slice of DX-2 in the D&D × XCOM direction. DX-1 (already shipped) makes the DM *narrate* the tactical read; DX-2 makes the read *true* — the engine owns the mechanic, the prose only describes it.

## READ FIRST (cold start — do not skip)
- `docs/DND_XCOM.md` — the design lock. Especially THE LAW (*narrate the read, never the number*), the adopt-table (cover→AC, flank→advantage, high ground→advantage), and the **DX-2 entry**.
- `CLAUDE.md` → **Core Contracts** (Determinism-by-seed; all mutations through `engine/effectsCore.js applyDeltas()`; Invariants throw; **the WORLD_VERSION bump protocol**) and **Purity Rules**.
- `engine/combat/combatResolve.js` — `resolveCombatTurn(world, move, opts)`, the LIVE combat path. Uses `computeAttack`, `computeAC` from `engine/gear/gearProps.js`, plus traitHooks/bossActions/actionResolver.
- `engine/tactical/combat.js` — the EXISTING XCOM cover/hit core (`coverAt()` directional cover/flank, `hitChance`, deterministic `resolveAttack`). Currently dark/unwired. It is the eventual backend; you may reuse its logic.
- `engine/llmAdapter.js` — `buildSystemPrompt(ctx)`, the COMBAT block (~line 172) that builds `ctx.combat` the DM sees. DX-1's `TACTICAL READ` rule already lives here.

## THE FINDING THAT SCOPES THIS
The live combat path is **NOT positional today** — `combatResolve` has no cells/x,y. `tactical/combat.js` is a separate dark module expecting a grid. **So you are adding abstract tactical STATE to combat — not a pixel grid.** This is intentional: theater-of-the-mind / audio-first. The x,y grid + the LLM spatial-intent resolver are explicit follow-ons, OUT OF SCOPE here.

## DO EXACTLY THIS (small, surgical diff)
1. **Add per-combatant tactical fields to combat state** (deterministic, behind a `WORLD_VERSION` bump): at minimum `cover: 'none'|'half'|'full'`, `flanked: boolean`, `highGround: boolean`. Default `'none'`/`false`.
2. **Honor them in resolution** (engine owns the number; randomness only via `rng.js`):
   - cover → effective AC: **+2 (half), +5 (full)** (the D&D mapping).
   - `flanked` OR `highGround` → the attacker rolls with **advantage**.
   Route through `computeAC`/`computeAttack` (or reuse `tactical/combat.js`).
3. **Give the state at least one deterministic SOURCE** so it's exercised: e.g. a "take cover" action that sets the actor's cover from the scene, and/or `flanked = true` when ≥2 conscious allies are engaged with the same enemy. Keep it minimal and deterministic.
4. **Surface the facts to the DM** — extend the `ctx.combat` object built for `buildSystemPrompt` so each combatant's `cover/flanked/highGround` are present. DX-1's rule will narrate them as fiction. **Pass STATE, never numbers** — do not add figures to the prompt.
5. **Tests** (deterministic): half cover = +2 effective AC; full = +5; flanked/high-ground grants advantage; same seed → same outcome (worldHash stable).

## HARD CONSTRAINTS
- **Determinism is sacred.** `rng.js` is the only randomness. All mutations via `effectsCore.applyDeltas()` — no direct state writes. `worldHash` stable under replay; **tests U19/U21/U22/U27/U30 must pass.**
- **WORLD_VERSION bump protocol** (CLAUDE.md "When Bumping WORLD_VERSION"): bump `engine/state.js` + `ensureWorld` shape, safe defaults for the new fields, invariants in `invariants.js`, old-save warning, grep tests for version-embedded strings and fix, run full suite + `npm run playtest:quick`.
- **Hide the math stays.** The prompt gets tactical STATE only, never a number.
- **Small bounded diff.** If it balloons, or you cannot hold `worldHash` green, **STOP and report** — do not force it. Bad work is worse than no work.

## DONE-WHEN
- Cover confers AC; flank/high-ground confer advantage; all read from per-combatant tactical state; all deterministic.
- `ctx.combat` carries the facts; a live combat narration surfaces the read (DX-1) with **zero number/label leaks**.
- `node --test` green (incl. U19/21/22/27/30 + combat tests) · `npm run check` green · `npm run playtest:quick` clean.
- `WORLD_VERSION` bumped per protocol.

## OUTPUT CONTRACT
- Branch off `v2-polish` (e.g. `dx2-tactical-mechanics`). Commits per convention: `feat(combat): …`, `feat(state): …`. End each commit message with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Do NOT merge to `v2-polish`** — leave the branch for Homebase to review + integrate.
- Final report: files changed, the WORLD_VERSION delta, test/check/playtest results (counts), a sample live combat read showing cover/flank narrated as fiction, and anything you punted.

## OUT OF SCOPE (follow-ons — do not do here)
The LLM spatial-intent resolver ("flank the wolf" → committed position), an x,y grid or the 3D render of positions (MAP_PATH Phase 2.4 / Phase 3), destructible cover. Keep to abstract tactical state + the mechanic + the narration.
