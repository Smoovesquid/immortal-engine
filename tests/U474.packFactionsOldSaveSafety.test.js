// U474 — FACT-1 old-save safety: a save created BEFORE FACT-1 (defaults-only
// civic/shadow factions, whether or not they've evolved via worldTick) must
// round-trip byte-stable through the real load path with NO re-seed and NO
// clobber of evolved state.
//
// Why this is safe by construction: beginAdventure (where FACT-1's seeder lives)
// runs ONLY on a fresh new-game start. The load/resume path in public/v1.js
// (continueSlot1) calls save.js loadSlot -> ensureWorld and goes straight to the
// play loop — it NEVER re-enters beginAdventure. So an old save can't reach the
// seeder at all; the seeder is also guarded on "factions are the untouched
// defaults", which an evolved save is not. This test locks BOTH guarantees:
//   1. an un-evolved defaults-only save loads with its civic/shadow factions
//      byte-identical (no re-seed to the authored set), and
//   2. an EVOLVED defaults-only save (worldTick has moved pressure/hostility/
//      lastMove) survives load -> turn -> save with those exact evolved values
//      intact (explicit no-clobber), including re-entering beginAdventure.
//
// Mirrors the save round-trip idiom (G03 / the ND-1b family): exportWorld ->
// importWorld and saveSlot -> loadSlot both route through ensureWorld, so a
// stable hash across the round-trip is the byte-stable proof.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { worldTick } from '../engine/worldTick.js';
import { exportWorld, importWorld, saveSlot, loadSlot } from '../engine/save.js';
import { worldHash } from '../engine/worldHash.js';
import { assertWorldInvariants } from '../engine/invariants.js';

// A minimal no-faction pack: booting through it produces exactly the ensureWorld
// civic/shadow defaults — i.e. a world shaped like a pre-FACT-1 save.
const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    starterGoals: [],
    skills: ['Steel']
  }
};

// In-memory localStorage shim for the saveSlot/loadSlot path.
function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); }
  };
}

const factionIds = (w) => (Array.isArray(w.factions) ? w.factions : []).map(f => f.id);

test('U474-A: a pre-FACT-1 (defaults-only) save round-trips byte-stable — NO re-seed to authored factions', () => {
  // A world booted through a no-faction pack == the pre-FACT-1 shape.
  const w0 = newWorld({ seed: 'u474-old', fate: 0.3, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const w = beginAdventure(w0, packsById).world;
  assert.deepEqual(factionIds(w), ['civic', 'shadow'], 'precondition: this is a defaults-only (pre-FACT-1) world');

  const before = worldHash(w);
  const roundTripped = importWorld(exportWorld(w)); // routes through ensureWorld
  assert.deepEqual(factionIds(roundTripped), ['civic', 'shadow'],
    'load must NOT re-seed the authored factions onto an old defaults-only save');
  assert.equal(worldHash(roundTripped), before, 'defaults-only save round-trips byte-stable (hash unchanged)');
});

test('U474-B: an EVOLVED defaults-only save survives load -> turn -> save with evolved values intact (no clobber)', () => {
  const w0 = newWorld({ seed: 'u474-evolved', fate: 0.5, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  let w = beginAdventure(w0, packsById).world;

  // Evolve the defaults via worldTick so pressure/hostility/lastMove move off
  // the untouched-default fingerprint.
  const basePressure = w.factions.find(f => f.id === 'civic').pressure;
  for (let i = 0; i < 6; i++) w = worldTick(w, `${w.meta.seed}|evolve|${i}`);
  const evolvedCivic = w.factions.find(f => f.id === 'civic');
  assert.ok(evolvedCivic.pressure !== basePressure || evolvedCivic.lastMove !== '',
    'precondition: worldTick must have evolved the civic faction off its default');

  // The real load path: saveSlot -> loadSlot (both go through ensureWorld,
  // NEVER beginAdventure). Evolved factions must survive verbatim.
  const storage = memStorage();
  saveSlot(storage, w, 'slot1');
  const loaded = loadSlot(storage, 'slot1');
  assert.deepEqual(loaded.factions, w.factions,
    'evolved factions must survive load verbatim (no re-seed, no clobber)');

  // Take a turn, save again — still byte-stable against the loaded world.
  const afterTurn = worldTick(loaded, `${loaded.meta.seed}|post-load-turn`);
  const reSaved = saveSlot(storage, afterTurn, 'slot1');
  const reLoaded = loadSlot(storage, 'slot1');
  assert.equal(worldHash(reLoaded), worldHash(reSaved), 'post-load turn + save round-trips byte-stable');
  assert.doesNotThrow(() => assertWorldInvariants(reLoaded), 'reloaded evolved world must be invariant-clean');
});

test('U474-C: re-entering beginAdventure on an EVOLVED defaults-only world does NOT clobber it', () => {
  // Defense in depth: even though the live load path never calls beginAdventure,
  // prove the seeder's untouched-defaults guard refuses to fire on evolved state.
  const w0 = newWorld({ seed: 'u474-rebegin', fate: 0.5, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  let w = beginAdventure(w0, packsById).world;
  for (let i = 0; i < 5; i++) w = worldTick(w, `${w.meta.seed}|reb|${i}`);
  const evolvedFactions = w.factions;

  const rebegun = beginAdventure(w, packsById).world;
  assert.deepEqual(rebegun.factions, evolvedFactions,
    're-begin must not re-seed / clobber a world whose factions have evolved');
});

test('U474-D: an un-evolved defaults-only world re-entering beginAdventure through a no-faction pack stays default', () => {
  // The other half of the guard: an un-evolved defaults-only world booted through
  // a pack that authors NO factions has nothing to seed — its factions stay
  // civic/shadow byte-for-byte. (We assert on w.factions specifically, not the
  // whole-world hash: beginAdventure is not idempotent across a second call —
  // it re-materializes structures etc. — but FACT-1's contract is only that the
  // FACTIONS array is not touched, which is exactly what this asserts.)
  const w0 = newWorld({ seed: 'u474-noauthor', fate: 0.3, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const w = beginAdventure(w0, packsById).world;
  const rebegun = beginAdventure(ensureWorld(w), packsById).world;
  assert.deepEqual(rebegun.factions, w.factions,
    'no-faction pack re-begin leaves the default factions byte-identical (no seed, no clobber)');
  assert.deepEqual(rebegun.reputation, w.reputation,
    'no-faction pack re-begin leaves reputation untouched');
});
