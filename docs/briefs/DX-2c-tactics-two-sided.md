# Worker brief — DX-2c: make tactics two-sided and contested

*(Self-contained prompt for a fresh Opus 4.8 window in the immortal-engine repo. Branch off `v2-polish`; Homebase owns the merge — leave a branch, do not merge.)*

---

## TASK
Right now the tactical loop is **half-built: only the PLAYER uses tactics** (DX-2b shipped "take the high ground" / "flank it" → advantage, in the live `escapeCombat` engine). Make it **two-sided and contested**: enemies use cover and high ground against the player, being outnumbered is dangerous, and positions are **not permanent** (they can be broken). That back-and-forth is the XCOM tension.

## READ FIRST (cold start — do not skip)
- `docs/DND_XCOM.md` — the design lock; THE LAW (*narrate the read, never the number*); the **DX-2a and DX-2b entries** (what already shipped) and the **DX-2c follow-on list**.
- `CLAUDE.md` → Core Contracts (determinism-by-seed; mutations only via `engine/effectsCore.js applyDeltas()`; invariants throw; WORLD_VERSION protocol) and Purity Rules.
- **`engine/combat/escapeCombat.js`** — THE LIVE ENGINE the v1 demo runs (NOT `combatResolve.js` — that's the structured/dark path; see [[project_two_combat_engines]]). DX-2b already added here: `beginCombat` resets `playerTactical`; `parseEscapeAction` recognizes the high-ground/flank verbs; the player attack roll uses `rollD20Adv` (2d20 keep higher) when on high ground or striking a flanked foe; end-of-turn persists `playerTactical`. **Grep for `rollD20Adv`, `playerTactical`, `highGround`, `flanked` to find the seams (line numbers shifted post-DX-2b).**
- `engine/combat/tacticalMods.js` — the shared tactical schema (`normalizeTactical`/`defaultTactical`): `cover: 'none'|'half'|'full'`, `flanked: boolean`, `highGround: boolean`, on both `combat.playerTactical` and each `enemy.tactical`.
- `engine/ai/narratorContext.js` — already surfaces these fields to the DM read (DX-2a/2b). New enemy state should narrate for free; verify.

## SCOPING NOTE — likely NO version bump
The schema already exists (DX-2a, WORLD_VERSION 28). DX-2c is **SOURCING + HONORING the enemy-side fields** (`enemy.tactical.cover/highGround`) and **`playerTactical.flanked`** (currently never sourced), plus **contest**. Reuse the existing fields — **do NOT bump WORLD_VERSION unless you genuinely need a new field** (prefer reusing the schema). Player cover→AC already exists in escape (`escapeCover`); keep that model — cover = effective-AC bump, positioning = advantage/disadvantage (2d20).

## DO EXACTLY THIS (small, surgical diff — all in `escapeCombat.js`)
1. **Source enemy tactical at fight start** (in `beginCombat`): deterministically give *some* foes `tactical.cover` and/or `highGround` from the encounter (e.g. by enemy type / seed). Keep it simple and seeded.
2. **Honor `enemy.tactical.cover` on the player's attack** vs that enemy: raise its effective AC (+2 half, +5 full) — mirror the existing `escapeCover` math. A covered foe is harder to hit.
3. **Honor `enemy.tactical.highGround` and `playerTactical.flanked` on the ENEMY's attack roll** vs the player: roll with **advantage** (`rollD20Adv`). Find the enemy attack/counter-attack seam in escapeCombat.
4. **Source `playerTactical.flanked`**: set it when **≥2 conscious enemies** are engaged with the player (mirror DX-2b's auto-flank, enemy-side) → enemies attack with advantage. Outnumbered = dangerous.
5. **Contest — positions break (at least one mechanism each way):**
   - The player's `highGround`/flank is **not permanent** — e.g. a foe closing/reaching the player clears `playerTactical.highGround` (or it only holds while uncontested).
   - The player can **break a foe's cover** with a positioning verb (e.g. "flush it out" / "circle its cover" / "flank its cover") → clears that `enemy.tactical.cover`. Add to `parseEscapeAction`.
6. **DM read**: confirm the enemy tactical state reaches `narratorContext` so the read narrates it ("the wolf holds the high ground", "they've got you surrounded") — likely free from DX-2a/2b; verify with a live escape-mode call. **State to the DM, never numbers.**
7. **Tests** (deterministic; next free U-number — likely `U298`): covered foe harder to hit (+AC); enemy high-ground / player-flanked → enemy advantage; a position breaks when contested; same seed → same outcome (worldHash stable).

## HARD CONSTRAINTS
- **Determinism is sacred.** `rng.js` only. The 2d20 second die must be drawn **only when advantage/disadvantage is actually active** so non-tactical fights keep the identical rng stream — and this now applies on **BOTH sides**, so be careful enemy-side advantage doesn't perturb the player's stream when inactive. `worldHash` stable under replay; **U19/U21/U22/U27/U30 must pass.**
- All state mutations via `effectsCore.applyDeltas()` — no direct writes. Persist new enemy/`playerTactical` state at end-of-turn the way DX-2b does.
- **Hook `escapeCombat.js`** — the live engine. If you also touch `combatResolve.js`, keep them consistent, but escape is what must be *felt*.
- **Hide the math** stays — the DM gets tactical STATE, never a number.
- **Small bounded diff.** If it balloons or you can't hold `worldHash` green, **STOP and report.** Bad work is worse than no work.

## DONE-WHEN
- Enemies **use cover / high ground / flank against the player** in the live escape engine; being outnumbered confers enemy advantage; **positions are contestable** (not permanent free advantage).
- A live escape-mode narration surfaces an **enemy using terrain against the player** AND **a position breaking**, with **zero number/label leaks**.
- `node --test` green (incl. U19/21/22/27/30 + escapeCombat + the new test) · `npm run check` green (convergence + suite + determinism) · `npm run playtest:quick` clean.
- No WORLD_VERSION bump unless a new field was unavoidable (justify it if so).

## OUTPUT CONTRACT
- Branch off `v2-polish` (e.g. `dx2c-tactics-two-sided`). Commits per convention `feat(combat): …`, each ending with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Do NOT merge to `v2-polish`** — leave the branch for Homebase to review + land.
- Final report: files changed, whether a version bump was needed (and why), test/check/playtest counts, a **live escape-mode read** showing a foe using terrain + a position breaking (zero leaks), and anything punted.

## OUT OF SCOPE (follow-ons — do not do here)
Full engine convergence (escapeCombat adopting combatResolve's cover→DC + trait/boss pipeline) = a later DX-2d. The x,y grid + LLM spatial-intent resolver + 3D render (MAP_PATH Phase 2.2/2.4/3). Enemy positioning *AI* beyond "honor the terrain it has + simple contest" (no pathfinding). Keep it bounded to: source + honor the enemy side, source player-flanked, and make positions breakable.
