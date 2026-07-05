// U500 — MR-1a: the pos backfill is demoted to a REPAIR, not an author.
//
// Before MR-1a, backfillTacticalPositions (engine/state.js) both filled a missing
// pos AND re-seeded any stale one — which is how an exit's null got re-rolled into
// the 247-ft teleport. MR-1a makes egress WRITE the doorstep, so the backfill must:
//   (1) still repair a genuinely-LEGACY save — a world whose party carries no pos
//       (predates TAC-1) boots fine and comes out with a valid pos; and
//   (2) NEVER move a pos a transition just wrote — a post-exit world re-run through
//       ensureWorld keeps the doorstep pos byte-identical (the keep-if-consistent
//       rule leaves it alone; only absent/stale positions are (re)seeded).
//
// docs/POSITION_AS_CANON.md §2/§5. Siblings: U497 (probe), U498 (threshold),
// U499 (the egress lands on the doorstep).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';

const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'], starterObjectives: ['find the key'],
    skills: ['Steel'], locations: ['tower'], objectives: ['find the key'],
    complications: ['a clock starts'], npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust'],
  },
};

function bootSlice() {
  const w0 = newWorld({
    seed: SLICE_SEED, fate: 0.2, campaignId: `campaign-${SLICE_SEED}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape',
  });
  const { world } = beginAdventure(ensureWorld(w0), PACKS);
  return world;
}

const playerPos = (w) => (w?.party?.[0]?.pos) || null;

// ── (1) Legacy-save repair: a world with NO party pos still boots + gets one ─────
test('U500: a legacy save (no party pos) boots fine — backfill repairs the missing pos', () => {
  const world = bootSlice();
  // Simulate a pre-TAC-1 save: strip pos from every party member (legacy shape).
  const legacy = {
    ...world,
    party: world.party.map(m => {
      const { pos, ...rest } = m; // drop pos entirely (absent, as an old save has it)
      return rest;
    }),
  };
  assert.ok(!('pos' in legacy.party[0]), 'the legacy fixture truly has no pos');

  // ensureWorld must NOT throw (invariants pass) and must repair the pos.
  let repaired;
  assert.doesNotThrow(() => { repaired = ensureWorld(legacy); }, 'legacy save re-ensures without throwing');
  const pos = playerPos(repaired);
  assert.ok(pos && typeof pos === 'object' && Number.isInteger(pos.gx) && Number.isInteger(pos.gy),
    `backfill gave the player a valid pos; got ${JSON.stringify(pos)}`);
  // At wake the player is indoors, so the repaired frame is the wake structure.
  assert.equal(pos.frame, `struct:${repaired.scene.interior.structureKey}`,
    'the repaired wake pos is the wake structure frame (backfill still authors a legacy null)');
});

// ── (2) The written doorstep survives re-ensure: backfill does not move it ───────
test('U500: a post-exit doorstep pos is NOT re-seeded by a later ensureWorld', () => {
  let world = bootSlice();
  ({ world } = playerMove(world, PACKS, 'go outside'));
  const doorstep = playerPos(world);
  assert.ok(doorstep && doorstep.frame === 'region', `exit produced a region doorstep; got ${JSON.stringify(doorstep)}`);

  // Re-run through ensureWorld repeatedly (save/load, any consumer). The consistent
  // region pos must be kept EXACTLY — no placeNearNode re-seed.
  const once = ensureWorld(world);
  assert.deepEqual(playerPos(once), doorstep, 'pos is unchanged after one ensureWorld');
  const thrice = ensureWorld(ensureWorld(once));
  assert.deepEqual(playerPos(thrice), doorstep, 'pos is unchanged after three ensureWorld passes');
});

// ── (2b) Idempotence: the doorstep pos does not drift across repeated ensures ────
test('U500: ensureWorld does not drift the doorstep pos on a post-exit world', () => {
  let world = bootSlice();
  ({ world } = playerMove(world, PACKS, 'go outside'));
  const a = ensureWorld(world);
  const b = ensureWorld(a);
  // pos is the value the backfill governs; it must be byte-stable across re-ensures
  // (other party fields may re-normalize, but the tactical pos never re-seeds).
  assert.deepEqual(a.party[0].pos, b.party[0].pos, 'the doorstep pos is byte-stable on re-ensure (no needless re-seed)');
});
