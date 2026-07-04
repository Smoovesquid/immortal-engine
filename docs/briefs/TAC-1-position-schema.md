# TAC-1 — position-as-canon: schema + migration + invariants + seeded placement (DARK)

**Model:** Opus (engine schema lane — `WORLD_VERSION` bump; serial, nothing else on engine files).
**Your tests: U412–U415.**
**Contract of record (READ FIRST, IT DECIDES EVERYTHING):** `docs/POSITION_AS_CANON.md` (revised
2026-07-04-pm) — §1 the frame model, §2 who has a position, §5 determinism/invariants/migration.
Also: PACKETS §TAC + §TABLETOP (THE MOVEMENT LAW), `CLAUDE.md` "When Bumping WORLD_VERSION".

## The mission (one breath)

Give the engine canonical tactical position — `pos` on party members and present NPCs, deterministic,
inside `worldHash` — completely DARK: nothing consumes it yet (movement stays as-is; TAC-2 adds the
verb; the renderer snaps later). This is the keystone under 5-ft-square minis and the DND_XCOM arc.

## The schema (contract §1 — implement, don't redesign)

```
pos = null                                   // absent from the tactical layer
pos = { frame: 'region', gx, gy }            // outdoors — ONE continuous 5-ft grid over the region
pos = { frame: 'struct:<structId>', gx, gy } // inside a structure (floorPlan-grid cells)
```

- **Pin the unit constants ONCE, named + tested** (contract §1): CELL_FT = 5; the region grid anchors to
  the ONE_MAP world-unit model (`node.x,y × NODE_WU = 1000`, `PLACE_WU = 4`) — you own choosing the
  exact WU↔ft constant; document it in the contract file (append a "Pinned constants (TAC-1)" block)
  and lock it with a test. Interiors: floorPlan-units↔ft pinned the same way.
- **`currentNodeId` STAYS authoritative** in TAC-1. New invariant: a region-frame `pos` must project to
  the current node (nearest-node-center projection, deterministic helper); a struct-frame `pos` must
  have `roomOf(pos)` (containing floorPlan room rect) agree with `scene.interior.roomId`, and the
  structure at `currentNodeId` (composes with NODE-DESYNC-1's invariant).
- **NAME COLLISION WARNING:** the renderer's legacy pixel field is `position` (ux/uy) and MAP-OCC-2
  just STRIPPED it from the hash (`projectPosition` in `engine/crunchHashProjection.js`). Your new field
  is **`pos`** (cells) and it MUST be hashed. Do not let the strip touch `pos`; do not write cells into
  `position`. Add a test asserting both directions (ux/uy still excluded; pos included).

## Who gets a position (contract §2 — v1 scope)

Party members + settlement NPCs present at the current node. Monsters/positioned-objects are LATER
packets (TAC-5). **Do NOT touch combat enemies** (`ensureCombat` strips non-whitelisted enemy fields —
known trap; combat-board unification is a later packet).

- **Seeded placement, deterministic + idempotent:** at migration/`ensureWorld` backfill, place each
  entity by `f(worldSeed, entityId, frameId, entryContext)` via `rng.js` derived streams — NEVER
  `Math.random`, and **NEVER re-roll on subsequent `ensureWorld` calls** (backfill only when `pos` is
  absent; same world → byte-identical result every call — `ensureWorld` runs on every turn).
  Party indoors at boot: place in the wake room's rect (via floorPlan). NPCs: consistent with
  `roomOccupancy` (indoor NPCs in their assigned room's rect; outdoor NPCs on the region grid near the
  node center). Walkability-perfect placement is NOT owed — cells must be in-bounds and inside the
  correct room rect / node area; fine-grained walkable-mask validation arrives with TAC-2's movement.

## WORLD_VERSION bump — full protocol (CLAUDE.md)

1. Bump the number in `engine/state.js`; add `pos` defaults in `ensureWorld()`.
2. Old saves must WARN before upgrade (the `d50c49f` pattern — find and mirror it).
3. New invariants in `engine/invariants.js` (throwing): `pos` is null XOR (frame valid ∧ gx/gy integers
   in bounds ∧ projections consistent per above).
4. **Grep tests for version-embedded strings** (e.g. `v<old>:` → `v<new>:`) and fix them. Do NOT touch
   `STRUCTURE_SCHEMA_VERSION` (structure-gen is deliberately decoupled, pinned at 27).
5. Full suite + `npm run playtest:quick`; determinism U19/21/22/27/30 replay equality MUST hold with
   `pos` hashed (seeded placement is pure of when-it-runs).

## Hard boundaries

- **DARK means DARK:** no movement path writes `pos` yet; no renderer reads it; zero behavior change
  anywhere outside schema/migration/invariants. `npm run convergence` must be 100% UNCHANGED.
- Files: `engine/state.js`, `engine/invariants.js`, a new placement module (e.g.
  `engine/map/spatial/tacticalPos.js` — your call, keep it pure), tests. NOT `playloop.js`, NOT
  `escapeCombat.js`, NOT any `public/` file (a TT-DRAW renderer lane is running in parallel worktree —
  you have zero file overlap with it; keep it that way).
- All mutations through the normal ensureWorld/migration path; `rng.js` only.

## Tests (U412–U415)

- **U412:** schema + migration — a pre-bump save loads with a warn, gains `pos` on party + present
  NPCs; defaults valid; invariants pass; idempotent (two consecutive ensureWorld calls → identical).
- **U413:** determinism — same seed, two fresh worlds → identical `pos` everywhere; replay hash
  equality with `pos` in the hash; ux/uy still excluded while `pos` included (the MAP-OCC-2 interplay).
- **U414:** invariants — hand-built bad states throw (out-of-bounds cell; region pos projecting to the
  wrong node; struct pos whose room disagrees with `scene.interior`); good states pass.
- **U415:** pinned constants — the units block exists, values match the contract, and a round-trip
  (cell → wu → cell) is exact.

## Done-when

- `WORLD_VERSION` bumped with the full protocol; `pos` live in state + hash, consumed by NOTHING;
  suite green (all ~9600), convergence 100% unchanged, determinism green, playtest:quick clean;
  U412–U415 green; contract file carries the pinned-constants block.
- One local commit on your branch (do NOT push); patch version bump per repo convention; changelog +
  PACKETS row updates in the same commit.

## Rollback

Revert the commit (schema returns; old saves unaffected — they warned, they didn't convert in place?
verify the warn path leaves the stored save readable by the previous build, per the d50c49f pattern).

## Report (plain English for Tim)

What this is (every hero and villager now has an exact 5-foot square recorded in the world's permanent
memory — invisible today, but it's the foundation the moving minis, the tactical grid, and XCOM-style
play all stand on), why it matters (this was the one deep engine change everything else was waiting on,
and it landed without changing a single thing a player can see — on purpose).
