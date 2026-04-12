import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { createWanderer } from '../engine/chargen/wanderer.js';
import { createCharacter } from '../engine/chargen/genesis.js';
import { rollDetailOptions } from '../engine/chargen/details.js';
import { normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { listBackgrounds } from '../engine/chargen/backgrounds.js';

// Minimal pack stubs — enough for the engine to run
const fantasyPack = {
  id: 'fantasy',
  toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
  starterLocations: ['Roadside Shrine'],
  starterObjectives: ['find the missing courier'],
  starterGoals: [{ kind: 'reach', targetRef: '__nearest_settlement__', label: 'Travel to the next settlement' }],
  skills: ['Steel', 'Wits']
};

const westmarchPack = {
  id: 'westmarch',
  name: 'The Westmarch',
  toneWords: { cooperative: ['mossy'], grim: ['grey'], blood: ['ashen'] },
  starterLocations: ['Thornwall Gate'],
  starterObjectives: ['find the missing tax collector'],
  starterGoals: [{ kind: 'reach', targetRef: '__nearest_settlement__', label: 'Find shelter in the Westmarch' }],
  skills: ['Steel', 'Wits']
};

const packsById = {
  fantasy: fantasyPack,
  westmarch: westmarchPack
};

test('M1-01: Wanderer creation produces valid character', () => {
  const pc = createWanderer({ seed: 'm1-01', fate: 0.2, name: 'Aric' });

  assert.ok(pc, 'character must exist');
  assert.equal(pc.name, 'Aric');
  assert.equal(pc.archetype, 'Wanderer');
  assert.ok(typeof pc.id === 'string' && pc.id.length > 0, 'must have an id');

  // Stats must be in valid 2d6+2 range (4..14)
  const statKeys = ['MIGHT', 'AGILITY', 'WITS', 'GRIT', 'CHARM'];
  for (const k of statKeys) {
    const v = pc.stats[k];
    assert.ok(typeof v === 'number' && v >= 4 && v <= 14, `${k} = ${v} must be in 4..14`);
  }

  // Must have traits from ritual defaults
  assert.ok(typeof pc.traits.detail === 'string' && pc.traits.detail.length > 0, 'detail trait');
  assert.ok(typeof pc.traits.keepsake === 'string' && pc.traits.keepsake.length > 0, 'keepsake trait');
  assert.ok(typeof pc.traits.lineYouWontCross === 'string', 'lineYouWontCross trait');
  assert.ok(typeof pc.traits.rumor === 'string' && pc.traits.rumor.length > 0, 'rumor trait');

  // Must have background
  assert.equal(pc.background.name, 'Wanderer');
  assert.ok(pc.background.darkFate, 'dark fate must be set');

  // Position zone for back-compat
  assert.equal(pc.position?.zone, 'far');
});

test('M1-02: beginAdventure with pre-created Wanderer preserves party', () => {
  const pc = createWanderer({ seed: 'm1-02', fate: 0.3, name: 'Bryn' });
  const w0 = newWorld({ seed: 'm1-02', fate: 0.3, campaignId: 'c-m1-02', pack: { primaryId: 'fantasy', mixerId: null } });

  // Inject pre-created character
  const w1 = ensureWorld({ ...w0, party: [pc] });

  const { world } = beginAdventure(w1, packsById);

  assert.ok(Array.isArray(world.party), 'party must be array');
  assert.equal(world.party.length, 1, 'party must have exactly 1 member');
  assert.equal(world.party[0].name, 'Bryn', 'party member name must be preserved');
  assert.equal(world.party[0].archetype, 'Wanderer', 'archetype must be preserved');
});

test('M1-03: full slice loop — create, explore, playerMove sequence', () => {
  const pc = createWanderer({ seed: 'm1-03', fate: 0.2, name: 'Kael' });
  const w0 = newWorld({ seed: 'm1-03', fate: 0.2, campaignId: 'c-m1-03', pack: { primaryId: 'fantasy', mixerId: null } });
  const w1 = ensureWorld({ ...w0, party: [pc] });

  const { world: w2, output: o1 } = beginAdventure(w1, packsById);
  assert.ok(o1, 'beginAdventure must return output');
  assert.ok(typeof o1.narration === 'string', 'output must have narration');

  // Run a sequence of moves — no invariant violations should occur
  let current = w2;
  const moves = [
    'look around',
    'explore',
    'look for someone to talk to',
    'search for supplies',
    'rest briefly'
  ];

  for (const move of moves) {
    const result = playerMove(current, packsById, move);
    assert.ok(result.world, `playerMove("${move}") must return world`);
    assert.ok(result.output, `playerMove("${move}") must return output`);
    current = result.world;
  }

  // World must still pass invariants (ensureWorld calls assertWorldInvariants)
  const final = ensureWorld(current);
  assert.ok(final, 'final world passes invariants');
});

test('M1-04: westmarch pack normalizes correctly', () => {
  const raw = westmarchPack;
  const normalized = normalizePack(raw);

  assert.equal(normalized.id, 'westmarch');
  assert.equal(normalized.name, 'The Westmarch');
  assert.ok(Array.isArray(normalized.starterLocations), 'must have starterLocations');
  assert.ok(normalized.starterLocations.length > 0, 'starterLocations non-empty');
  assert.ok(Array.isArray(normalized.starterObjectives), 'must have starterObjectives');
  assert.ok(normalized.starterObjectives.length > 0, 'starterObjectives non-empty');
  assert.ok(Array.isArray(normalized.toneWords.cooperative), 'toneWords.cooperative');
  assert.ok(Array.isArray(normalized.toneWords.grim), 'toneWords.grim');
  assert.ok(Array.isArray(normalized.toneWords.blood), 'toneWords.blood');
});

test('M1-05: chargen ritual picks survive into world', () => {
  const seed = 'm1-05';

  // Create character with no picks — gets defaults (first option each category)
  const pcDefault = createWanderer({ seed, fate: 0.2, name: 'Sera' });

  // All trait fields must be non-empty strings (defaults filled in)
  assert.ok(pcDefault.traits.detail.length > 0, 'default detail');
  assert.ok(pcDefault.traits.keepsake.length > 0, 'default keepsake');
  assert.ok(pcDefault.traits.lineYouWontCross.length > 0, 'default lineYouWontCross');
  assert.ok(pcDefault.traits.rumor.length > 0, 'default rumor');

  // Now create with explicit picks matching those defaults — they must persist
  const picks = {
    detail: pcDefault.traits.detail,
    keepsake: pcDefault.traits.keepsake,
    lineYouWontCross: pcDefault.traits.lineYouWontCross,
    rumor: pcDefault.traits.rumor
  };

  const pcPicked = createWanderer({ seed, fate: 0.2, name: 'Sera', ritualPicks: picks });

  assert.equal(pcPicked.traits.detail, picks.detail);
  assert.equal(pcPicked.traits.keepsake, picks.keepsake);
  assert.equal(pcPicked.traits.lineYouWontCross, picks.lineYouWontCross);
  assert.equal(pcPicked.traits.rumor, picks.rumor);
});

test('M1-06: Wanderer background exists in fantasy backgrounds list', () => {
  const bgs = listBackgrounds('fantasy');
  const wanderer = bgs.find(b => b.name === 'Wanderer');
  assert.ok(wanderer, 'Wanderer must exist in fantasy backgrounds');
  assert.deepEqual(wanderer.tags, ['wits', 'charm']);
  assert.ok(wanderer.hook.length > 0, 'hook must be non-empty');
});

test('M1-07: Wanderer creation is deterministic', () => {
  const opts = { seed: 'm1-07', fate: 0.5, name: 'Test' };
  const pc1 = createWanderer(opts);
  const pc2 = createWanderer(opts);

  assert.equal(pc1.id, pc2.id);
  assert.deepEqual(pc1.stats, pc2.stats);
  assert.deepEqual(pc1.traits, pc2.traits);
  assert.deepEqual(pc1.inventory, pc2.inventory);
});

test('M1-08: replay determinism — hash stable across two runs', async () => {
  function runSlice() {
    const pc = createWanderer({ seed: 'replay-m1', fate: 0.2, name: 'Hash' });
    const w0 = newWorld({ seed: 'replay-m1', fate: 0.2, campaignId: 'c-replay', pack: { primaryId: 'fantasy', mixerId: null } });
    const w1 = ensureWorld({ ...w0, party: [pc] });
    const { world: w2 } = beginAdventure(w1, packsById);

    let current = w2;
    const moves = ['look around', 'explore'];
    for (const move of moves) {
      current = playerMove(current, packsById, move).world;
    }
    return current;
  }

  const a = runSlice();
  const b = runSlice();

  const ha = await worldHash(a);
  const hb = await worldHash(b);
  assert.equal(ha, hb, 'world hash must be identical across replays');
});
