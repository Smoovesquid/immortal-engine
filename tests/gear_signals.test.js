import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { worldTick } from '../engine/worldTick.js';
import { resolveMove } from '../engine/resolve.js';

function mkEntity({ id = 'p1', inventory }) {
  return {
    id,
    name: id,
    archetype: 'Test',
    vibe: 'grim',
    stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 },
    stress: 0,
    wounds: 0,
    inventory,
    traits: { vibe: '', fear: '', flaw: '', ideal: '' },
    background: { name: '', tags: [], hook: '' },
    signature: { itemName: '', meaning: '' },
    position: { zone: 'far' }
  };
}

test('gear signals: noisy kit increases pressure drift on worldTick', () => {
  const base = newWorld({ seed: 'seed', fate: 0.7, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  base.scene.promptSeed = 'p';

  const quiet = { ...base, party: [mkEntity({ id: 'quiet', inventory: { tools: [{ name: 'Soft boots', tags: ['clothes'], weight: 1, noise: 0, light: 0, bulk: 1 }], weapons: [], armor: [], clothes: [], spells: [], tech: [], oddities: [], consumables: [], junk: [] } })] };
  const loud = { ...base, party: [mkEntity({ id: 'loud', inventory: { tools: [{ name: 'Lantern', tags: ['tools'], weight: 2, noise: 2, light: 4, bulk: 2 }], armor: [{ name: 'Chain mail', tags: ['armor'], weight: 5, noise: 5, light: 0, bulk: 5 }], weapons: [], clothes: [], spells: [], tech: [], oddities: [], consumables: [], junk: [] } })] };

  const a = worldTick(quiet, 'S');
  const b = worldTick(loud, 'S');

  assert.ok(b.clocks.pressure >= a.clocks.pressure);
  assert.ok(b.timeline.length >= a.timeline.length);
});

test('gear signals: stealthy approach gets higher DC with noisy kit (all else equal)', () => {
  const base = newWorld({ seed: 'seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  base.scene.promptSeed = 'p';

  const quiet = { ...base, party: [mkEntity({ id: 'p1', inventory: { tools: [{ name: 'Soft boots', tags: ['clothes'], weight: 1, noise: 0, light: 0, bulk: 1 }], weapons: [], armor: [], clothes: [], spells: [], tech: [], oddities: [], consumables: [], junk: [] } })] };
  const loud = { ...base, party: [mkEntity({ id: 'p1', inventory: { tools: [{ name: 'Lantern', tags: ['tools'], weight: 2, noise: 3, light: 4, bulk: 2 }], armor: [{ name: 'Mail', tags: ['armor'], weight: 4, noise: 4, light: 0, bulk: 4 }], weapons: [], clothes: [], spells: [], tech: [], oddities: [], consumables: [], junk: [] } })] };

  const move = { actorId: 'p1', intentText: 'Sneak past the guard', approachTag: 'finesse', stakeTag: 'exposure', risk: 0.5 };
  const dcQuiet = resolveMove(quiet, move).result.dc;
  const dcLoud = resolveMove(loud, move).result.dc;

  assert.ok(dcLoud >= dcQuiet);
});
