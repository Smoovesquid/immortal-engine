# DX-2d-i — Port the trait-as-code pipeline into the LIVE escape engine

**Lane:** Codex (deep engine; `escapeCombat.js` is a competence hot file — serial). Codex commits locally, does NOT push; Basecamp verifies + pushes.
**Type:** Convergence / wire built-but-dark. **No WORLD_VERSION bump.** Determinism-preserving by construction.
**Branch:** new worktree off `v2-polish` (e.g. `dx2d-i-traits`).

## Context (why this packet)
- `v1.html` runs `engine/combat/escapeCombat.js` (the "escape" engine), NOT the structured `combatResolve.js`. The two-engines trap: depth built in combatResolve is DARK in the playable demo (this is why DX-2a was "real but dark").
- combatResolve already runs the shared trait pipeline `engine/combat/traitHooks.js`. **escapeCombat does NOT import traitHooks at all** — so enemy traits (Regeneration, Pack Tactics, Natural Armor, Evasion, Uncanny Dodge, Undead Fortitude, Rejuvenation, auras…) have ZERO mechanical effect in the live game. `escapeCombat.js:5` says traits "stays parked" — **this packet unparks them.**
- Continues the DX-2a/2b/2c convergence (cover/flank/high-ground already landed in escapeCombat); this adds the enemy-trait layer.

## Read first (golden reference)
- `engine/combat/traitHooks.js` (409 lines, pure, NO RNG). Six ENEMY-side hooks:
  - `applyTurnStartTraits(enemy, world)` → `{hpDelta, summaryParts}` (Regeneration family; already clamps to maxHp)
  - `applyToHitTraits(enemy, baseToHit, world)` → number (Pack/Flock Tactics, Reckless, Aggressive)
  - `applyDamageDealtTraits(enemy, baseDmg)` → number (Brute, Sneak Attack, …)
  - `applyDamageTakenTraits(enemy, baseDmg, dmgType)` → number (Evasion, Uncanny Dodge, auras = DR)
  - `applyACTraits(enemy, baseAC)` → number (Natural Armor, Shell Armor, Magic/Spell Resistance…)
  - `applyDeathTraits(enemy, world)` → `{revive, hpIfRevived, summaryParts}` (Undead Fortitude, Rejuvenation, Reassemble…)
- `engine/combat/combatResolve.js` ~line 33 (import) and ~163–241 (modifyAC→DC, `applyDamageTakenTraits`, `processDeathTraits`) — mirror this wiring shape.
- `engine/combat/combatLifecycle.js:82` — the canonical `traits` sourcing.

## Step 0 (prerequisite): thread `.traits` onto escape enemies
escapeCombat's `beginCombat` builds enemy objects WITHOUT `.traits`. Source it from the bestiary def exactly as `combatLifecycle.js:82`:
`const traits = Array.isArray(bestiary?.traits) ? bestiary.traits : (Array.isArray(profile.traits) ? profile.traits : []);`
…and include `traits` on each escape enemy object. **Default `[]`** so trait-less foes are unchanged.

## Fix shape — wire the six hooks at the matching escapeCombat sites
(Discover exact line numbers; `grep -n "newHp" engine/combat/escapeCombat.js` locates every enemy-damage site.)
1. **Enemy AC / player to-hit DC** — where the player's attack rolls vs the foe's effective AC, fold `applyACTraits(enemy, ac)` alongside the existing cover bonus (DX-2c `coverAcBonus`).
2. **Damage taken (player → enemy)** — at **EVERY** enemy-damage site (weapon path + breath/magic-missile/lightning/scorching-ray/fireball/cantrip ~1375/1399/1413/1549/1609/1707/1824/2182), run `dmg = applyDamageTakenTraits(enemy, dmg, dmgType)` BEFORE computing newHp. **This is the bulk of the work — miss no site.**
3. **onDeath revive** — at each `newHp <= 0 → defeated = true`, first call `applyDeathTraits(enemy, world)`; if `revive`, set hp = hpIfRevived and do NOT mark defeated; push summaryPart as a beat. One-shot (the module enforces that).
4. **Enemy turn start** — in the enemy-turn loop (~2031+), call `applyTurnStartTraits(enemy, world)`, apply hpDelta, push summaryParts as beats (Regeneration).
5. **Enemy to-hit (enemy → player)** — where the enemy's attack roll is computed (~2160–2200), fold `applyToHitTraits(enemy, toHit, world)`.
6. **Enemy damage dealt (enemy → player)** — where enemy damage to the player is computed, fold `applyDamageDealtTraits(enemy, dmg)`.

## Determinism guard (CRITICAL)
- traitHooks is pure, no RNG. These folds must **NOT add or remove any `rng.*` draw**. Apply every modifier as arithmetic on already-rolled values — never gate a die-draw behind a trait. This keeps the rng stream identical for trait-less AND trait fights.
- `enemy.traits` is deterministically derived at `beginCombat` from the seeded bestiary → replay-stable; combat state is transient. `worldHash` must stay replay-stable. onDeath revive is RNG-free.

## Test plan
- New `tests/U299.escapeTraits.test.js` (mirror U296/U297/U298): fixed-seed escape fights —
  - Regeneration heals at turn start; Natural Armor raises the to-hit DC; Evasion/Uncanny Dodge reduce damage; Pack Tactics +2 when an ally lives; Undead Fortitude revives once then dies.
  - **Determinism proof:** a trait-LESS foe's fight is byte-identical (same beats, same hp) pre/post-change.
- `npm run check` GREEN: convergence **109/109 locked**, suite 0 fail, determinism U19/21/22/27/30 in.
- `npm run playtest:quick` clean.
- Live escape-mode probe (Haiku/Sonnet narration): fight a Regeneration / Undead-Fortitude foe; the trait beats reach the DM as **fiction** ("it knits itself back together"), **zero number/label leak** (THE LAW).

## Done-when
- [ ] escape enemies carry `.traits` (Step 0), default `[]`.
- [ ] All six hooks wired; every `newHp` site runs `applyDamageTakenTraits` + `applyDeathTraits`.
- [ ] U299 passes; trait-less fight byte-identical (determinism).
- [ ] `npm run check` GREEN; `playtest:quick` clean; live probe narrates traits as fiction.
- [ ] `docs/DND_XCOM.md` DX-2d-i entry + `docs/AGENT_CHANGELOG.md` DONE entry.

## Out of scope (prevent drift)
- Boss/legendary/lair actions (escapeCombat already imports bossActions — that's **DX-2d-ii**).
- Full single-resolver merge (escapeCombat adopting combatResolve wholesale) — later.
- Player-side feats (`relentlessEndurance` etc. are inline + player-side — **leave them**).
- DX-3 afterlife death-run (module-scale; queued).
- No WORLD_VERSION bump.
