// U545 — FURN-1: furniture is physical — a seeded body is NEVER placed inside it.
//
// docs/MAP_REAL.md promise 1 ("a bed occupies its cells; a body doesn't share them")
// + docs/PACKETS.md FURN-1. Tim's first v0.30.0 wake: the honest marker (MR-1b) drew
// the player standing INSIDE the bed mini — the engine seeded the wake position on a
// furniture cell because furniture never joined ANY blocking mask (MR-2a masked
// walls + doors only). This is the reproduce-then-fix test: the seeded tactical
// placement (the wake position, and every indoor NPC's) must land on a FREE cell —
// never on a piece of furniture.
//
// RED-BEFORE / GREEN-AFTER: pre-fix, structPos placed a body on ANY cell of the room
// rect via the seeded jitter, furniture-blind — so on the seeds below the player woke
// ON the pallet/chest (structCellFree === false). Post-fix, structPos lands on the
// nearest FREE cell (furniture footprints joined the struct mask), so every seeded
// struct pos is furniture-free. The assertion is stated on structCellFree — the
// exported struct-mask predicate the walk and the probe also honour.
//
// (On the DEFAULT slice seed the wake room's seeded cell already happened to fall on
// a door-approach cell — free — so the default boot alone did NOT reproduce the bug;
// the property is therefore stated over a small fixed seed set that INCLUDES seeds
// whose wake cell landed on furniture pre-fix. That is the honest reproduction: the
// derivation was furniture-blind for EVERY seed; only the RNG draw hid it on some.)
//
// Hermetic — no network, no API key, LLM off (the deterministic parseIntent floor).

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { structCellFree, placementForWorld } from '../engine/map/spatial/tacticalPos.js';

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

function bootSlice(seed = SLICE_SEED) {
  const w0 = newWorld({
    seed, fate: 0.2, campaignId: `campaign-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape',
  });
  return beginAdventure(ensureWorld(w0), PACKS).world;
}

const playerPos = (w) => (w?.party?.[0]?.pos) || null;

// The structure a struct-frame pos names, or null.
function structOfPos(world, pos) {
  if (!pos || typeof pos.frame !== 'string') return null;
  const m = /^struct:(.+)$/.exec(pos.frame);
  if (!m) return null;
  return world?.structures?.byId?.[m[1]] || null;
}

// ── the falsifier: the DEFAULT wake position is furniture-free ────────────────
test('U545: the default wake position is inside a room and NOT on a furniture cell', () => {
  const world = bootSlice();
  assert.ok(world.scene?.interior, 'the boot starts indoors (the wake room)');
  const pos = playerPos(world);
  assert.ok(pos && String(pos.frame).startsWith('struct:'), `wake pos is a struct frame; got ${JSON.stringify(pos)}`);
  const st = structOfPos(world, pos);
  assert.ok(st, 'the wake structure resolves from the pos frame');
  assert.equal(
    structCellFree(st, pos.gx, pos.gy), true,
    `the player woke ON a furniture cell (${pos.gx},${pos.gy}) — nobody stands inside the bed`,
  );
});

// ── the property (the real red-before/green-after): across a fixed seed set that
//    includes wake rooms whose seeded cell landed on furniture pre-fix, EVERY
//    seeded struct-frame placement (player + indoor NPCs) is furniture-free ──────
const SEEDS = [SLICE_SEED, 'tallow', 'testA', 'testB', 'qqq', 'a1', 'seed1', 'seed2'];

for (const seed of SEEDS) {
  test(`U545: every seeded indoor placement is furniture-free (seed ${seed})`, () => {
    const world = bootSlice(seed);
    const placements = placementForWorld(world);
    let indoorChecked = 0;
    for (const [id, pos] of placements) {
      if (!pos || !String(pos.frame).startsWith('struct:')) continue; // outdoors — a different mask
      const st = structOfPos(world, pos);
      assert.ok(st, `structure resolves for ${id}`);
      indoorChecked++;
      assert.equal(
        structCellFree(st, pos.gx, pos.gy), true,
        `seed ${seed}: entity ${id} was placed ON a furniture cell (${pos.gx},${pos.gy})`,
      );
    }
    // The default slice always has the player indoors at boot; assert we exercised it.
    if (seed === SLICE_SEED) assert.ok(indoorChecked >= 1, 'the default boot placed at least one body indoors');
  });
}

// ── idempotence: re-ensuring the world does not move a body onto furniture ─────
test('U545: re-ensuring the world keeps every indoor body furniture-free (idempotent)', () => {
  let world = bootSlice();
  world = ensureWorld(world); // a second pass must not clobber the free-cell placement
  const pos = playerPos(world);
  const st = structOfPos(world, pos);
  assert.ok(st, 'wake structure resolves after re-ensure');
  assert.equal(structCellFree(st, pos.gx, pos.gy), true,
    `re-ensure moved the player onto furniture (${pos.gx},${pos.gy})`);
});
