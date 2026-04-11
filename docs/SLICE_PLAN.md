# Vertical Slice — Worker-Pass Breakdown

**Goal:** Ship a playable slice that demonstrates every load-bearing idea from `NORTH_STAR.md` in the smallest possible code footprint, then iterate from there.

**Slice scope reminder:**
- One pack (`fantasy`), one region fully authored via prose-to-world.
- One archetype (Wanderer), one chargen flow.
- ~12 items, ~6 spells, ~8 bestiary entries.
- Rumor layer active across the authored region.
- Full character sheet, inventory, spellbook, map, journal, rumor board UI.
- Mobile-responsive.

---

## Execution model

Each worker pass is a self-contained unit of work handed off to a fresh Claude Code window via the home-base / worker-window pattern. Each worker pass:

- Lands on a feature branch from `main`.
- Has a scoped spec, file list, test gates, and explicit non-goals.
- Commits incrementally.
- Opens a PR to `main` when done.
- Home base reviews and merges.

---

## Pass dependency graph

```
                     ┌──────────────┐
                     │  Pass S1     │  UI surface (existing engine)
                     │  4 panels    │  ← no engine changes, unblocks visibility
                     └──────┬───────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
  ┌────────────┐     ┌────────────┐     ┌────────────┐
  │  Pass T1   │     │  Pass R1   │     │  Pass I1   │
  │  Crunch    │     │  Rumor     │     │  Importer  │
  │  schema    │     │  schema    │     │  validator │
  └─────┬──────┘     └─────┬──────┘     └─────┬──────┘
        ▼                  ▼                  ▼
  ┌────────────┐     ┌────────────┐     ┌────────────┐
  │  Pass T2   │     │  Pass R2   │     │  Pass I2   │
  │  Items +   │     │  Rumor     │     │  Importer  │
  │  combat    │     │  mint LLM  │     │  stages    │
  └─────┬──────┘     └─────┬──────┘     └─────┬──────┘
        ▼                  ▼                  ▼
  ┌────────────┐     ┌────────────┐     ┌────────────┐
  │  Pass T3   │     │  Pass R3   │     │  Pass I3   │
  │  Spells    │     │  Propagate │     │  Slice     │
  │            │     │  + verify  │     │  pack      │
  └─────┬──────┘     └─────┬──────┘     └─────┬──────┘
        └──────────────────┼──────────────────┘
                           ▼
                  ┌────────────────┐
                  │  Pass M1       │  Merge + polish
                  │  Integration   │  (slice ready)
                  └────────────────┘
```

The three tracks (T, R, I) run in parallel worktrees after their respective kickoff passes. Pass S1 runs first because it's the smallest and unblocks visual verification for every downstream pass. Pass M1 is the merge where everything integrates.

---

## The passes

### Pass S1 — UI Surface Spine
**Goal:** four panels reading canonical engine state, no engine changes. Mobile-responsive from day one.

**Panels:** Character Sheet, Inventory, Rumor Board (stub for now — reads future `world.rumors` if present, empty otherwise), Recent Beats.

**Files:** `public/v1.html`, `public/v1.js`, `public/styles.css`, new `public/panels/*.js`.

**Engine:** no changes.

**Tests:** none (view layer) — manual visual verification via `preview_*` tools.

**Commit:** `feat(ui): pass S1 — four-panel spine for character sheet + rumor board`

**Worker prompt:** home base drafts this.

---

### Pass T1 — Crunch Schema
**Goal:** extend `world.party[0]` with `level`, `xp`, `maxWounds` (derived), `foci`, `purse`, and `inventory.items[]` (objects, not strings). Bump `WORLD_VERSION` to 16. Add invariants. Save/load roundtrip. Full `worldHash` projection update including `worldHash.browser.js`.

**Files:** `engine/state.js`, `engine/invariants.js`, `engine/worldHash.js`, `engine/worldHash.browser.js`, `engine/save.js`, `engine/ruleset/core/stats.js` (new), `engine/ruleset/core/levelTable.js` (new).

**Engine:** schema only. No item defs yet. No combat changes yet.

**Tests:** new `U80-{schema, invariants, roundtrip, hash}.test.js`. Must include the `WORLD_VERSION` migration path from 15.

**Commit:** `feat(crunch): pass T1 — crunch schema + WORLD_VERSION 16`

---

### Pass T2 — Items + Combat Integration
**Goal:** item definitions loaded from `engine/ruleset/core/items/`. `equipItem`/`unequipItem`/`addItem`/`removeItem` delta ops. `combat/combatResolve.js` reads equipped weapon/armor and computes attack/AC using proper 5e-lite math. Loot tables + `loot` dialogue intent.

**Files:** `engine/ruleset/core/items/*.js` (new), `engine/effectsCore.js`, `engine/combat/combatResolve.js`, `engine/combat/combatLifecycle.js`, `engine/gear/gearProps.js`, `engine/ruleset/core/loot/*.js` (new).

**Slice content:** 12 items (3 weapons, 3 armor, 2 consumables, 2 magic, 2 quest items), 2 loot tables.

**Tests:** R04, R05, R06, R09 from `CRUNCH_V1.md`.

**Commit:** `feat(crunch): pass T2 — item defs, equip flow, combat reads gear, loot drops`

---

### Pass T3 — Spells
**Goal:** spell definitions loaded from `engine/ruleset/core/spells/`. Spell slot tracking on player. `cast <spell>` intent. Concentration. Effects route through existing `applyDeltas` with new effect kinds (damage, condition, area).

**Files:** `engine/ruleset/core/spells/*.js` (new), `engine/spell/castSpell.js` (new), `engine/effectsCore.js`, `engine/playloop.js`, `engine/combat/combatResolve.js`.

**Slice content:** 6 spells: fire_bolt, mage_armor, shield, misty_step, fireball, counterspell.

**Tests:** R07, R08 from `CRUNCH_V1.md`. Concentration determinism test.

**Commit:** `feat(crunch): pass T3 — spell slots, six-spell slice catalog, concentration`

---

### Pass R1 — Rumor Schema
**Goal:** `world.rumors[]`, `npc.rumorIds[]`, `npc.sophistication`. Deterministic tier computation. New `mintRumor`/`forgetRumor` delta ops. Canon Log event types. `WORLD_VERSION` → 17 (coordinate with T1 — whichever lands second bumps to 17). Invariants.

**Files:** `engine/state.js`, `engine/invariants.js`, `engine/worldHash.js`, `engine/worldHash.browser.js`, `engine/rumor/tier.js` (new), `engine/effectsCore.js`, `engine/csl/canonLog.js`.

**Engine:** schema + tier computation. No LLM calls yet. Fallback body synthesis.

**Tests:** U70, U71, U72, U73 from `RUMOR_LAYER.md`.

**Commit:** `feat(rumor): pass R1 — rumor schema + deterministic tier computation`

---

### Pass R2 — Rumor Minting via LLM
**Goal:** lazy rumor minting at dialogue surface. LLM prompt per tier. Silent fallback to deterministic placeholder. Canon Log integration.

**Files:** `engine/rumor/mint.js` (new), `engine/rumor/prompt.js` (new), `engine/llmAdapter.js`, `engine/npc/perspectiveFilter.js`, `engine/npc/dialogue.js`.

**Tests:** U76 (LLM fallback determinism), integration test with stubbed LLM.

**Commit:** `feat(rumor): pass R2 — lazy LLM-backed rumor minting with canon log caching`

---

### Pass R3 — Rumor Propagation + Verification
**Goal:** `worldTick.js` ages and propagates rumors. Decompressing source seed verifies matching rumors.

**Files:** `engine/worldTick.js`, `engine/rumor/propagate.js` (new), `engine/rumor/verify.js` (new), `engine/decompression/decompress.js`.

**Tests:** U74, U75.

**Commit:** `feat(rumor): pass R3 — propagation and verification`

---

### Pass I1 — Pack Validator
**Goal:** `scripts/packValidator.js` that verifies a pack's shape: adjacencies, faction refs, seed coverage, tone vectors. Runs against existing `fantasy` pack and passes. Runs against a deliberately broken fixture and fails with useful error.

**Files:** `scripts/packValidator.js` (new), `scripts/__tests__/packValidator.test.js` (new).

**Tests:** I13 from `PROSE_TO_WORLD.md`.

**Commit:** `feat(importer): pass I1 — pack validator`

---

### Pass I2 — Prose Importer (3 stages + cache)
**Goal:** the full 3-stage LLM pipeline with hash-keyed cache. CLI `npm run import-pack -- <file>`. Runs against a short fixture prose doc and produces a valid pack.

**Files:** `scripts/import/stage1-structure.js` (new), `scripts/import/stage2-expansion.js` (new), `scripts/import/stage3-seeds.js` (new), `scripts/import/cache.js` (new), `scripts/import/index.js` (new), `package.json` (add script).

**Tests:** I10, I11, I12, I14 from `PROSE_TO_WORLD.md`.

**Commit:** `feat(importer): pass I2 — prose-to-world pipeline with cache`

---

### Pass I3 — Slice Pack
**Goal:** write a 1-page prose doc for a slice region of the `fantasy` pack (call it "The Westmarch"). Run it through the importer. Commit both the prose and the artifact. Wire it to load as the slice default.

**Files:** `packs/fantasy/westmarch/source.md` (new), `packs/fantasy/westmarch/*.json` (generated), `engine/playloop.js` (slice default).

**Tests:** I15 (pack version pinning).

**Commit:** `feat(slice): pass I3 — Westmarch region via prose-to-world`

---

### Pass M1 — Slice Merge + Polish
**Goal:** integrate all three tracks. Chargen UI for Wanderer. Playable loop from "new game" → chargen → wake in Westmarch → explore → dialogue with rumor → combat with real items → victory with loot → level up → continue.

**Files:** `engine/playloop.js`, `public/v1.js`, `public/chargen.js` (new), `engine/chargen/wanderer.js` (new).

**Tests:** full integration playtest. `npm run playtest:full`.

**Commit:** `feat(slice): pass M1 — vertical slice playable end-to-end`

---

## Milestone: slice ready for review

After Pass M1, the slice is shown to the user. If it holds up, post-slice work:

- Pass TTS1 — TTS voice output.
- Pass D1 — Second region, deeper rumor testing.
- Pass A1 — Server authority + accounts.
- Pass L1 — Legacy doc cleanup: rewrite `VICTORY_LADDER_MVP_v1.md` and `CAMPAIGN_LIFECYCLE_SPEC_v1.md` to reflect the new direction.

---

## What home base owns (does not delegate)

- The four design docs (`NORTH_STAR.md`, `RUMOR_LAYER.md`, `PROSE_TO_WORLD.md`, `CRUNCH_V1.md`).
- This slice plan.
- The handoff prompts for each pass.
- Review of worker PRs before merge.
- Scope decisions — workers flag, home base decides.
- Memory updates.

## What workers own (delegated)

- Implementation inside the pass scope.
- Writing the tests.
- Commit discipline within the pass.
- Reporting design questions back up.
- Not bleeding into other passes.
