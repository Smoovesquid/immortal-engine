import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';

// U82 — Pass T1 crunch schema JSON roundtrip.
//
// Create a party member with all crunch fields populated (level 5,
// xp 1500, three foci, purse, one item, two known spells with max
// slots). Serialize to JSON and re-hydrate through ensureWorld. The
// re-hydrated member must deep-equal the source on every crunch field.

test('U82-01: party[0] crunch fields roundtrip through JSON + ensureWorld', () => {
  const w0 = newWorld({
    seed: 'u82', fate: 0.2, campaignId: 'c',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  const member = {
    id: 'party',
    name: 'Lira',
    archetype: 'Seeker',
    vibe: 'cooperative',
    stress: 1,
    wounds: 2,
    level: 5,
    xp: 1500,
    foci: ['athletics', 'stealth', 'arcana'],
    purse: { copper: 12, silver: 7, gold: 3, platinum: 1 },
    stats: { MIGHT: 12, AGILITY: 14, WITS: 16, GRIT: 12, CHARM: 10 },
    inventory: {
      weapons: [],
      armor: [],
      tools: [],
      clothes: [],
      spells: [],
      tech: [],
      oddities: [],
      consumables: [],
      junk: [],
      items: [
        { id: 'i1', defRef: 'sword:short', equipped: 'mainHand' }
      ]
    },
    spells: {
      known: ['spark', 'shield'],
      slots:    { 1: 2, 2: 1, 3: 0, 4: 0, 5: 0 },
      maxSlots: { 1: 4, 2: 2, 3: 0, 4: 0, 5: 0 },
      concentration: { spellRef: 'shield', startedAt: 3 }
    },
    traits: { vibe: '', fear: '', flaw: '', ideal: '', detail: '', keepsake: '', lineYouWontCross: '', rumor: '' },
    background: { name: '', tags: [], hook: '' },
    signature: { itemName: '', meaning: '' },
    position: { zone: 'far' },
    companion: null
  };

  const w = ensureWorld({ ...w0, party: [member] });

  const json = JSON.stringify(w);
  const re = ensureWorld(JSON.parse(json));

  const a = w.party[0];
  const b = re.party[0];

  assert.equal(b.level, 5);
  assert.equal(b.xp, 1500);
  assert.deepEqual(b.foci, ['athletics', 'stealth', 'arcana']);
  assert.deepEqual(b.purse, { copper: 12, silver: 7, gold: 3, platinum: 1 });
  assert.deepEqual(b.inventory.items, [
    { id: 'i1', defRef: 'sword:short', equipped: 'mainHand' }
  ]);
  assert.deepEqual(b.spells.known, ['spark', 'shield']);
  assert.deepEqual(b.spells.slots,    { 1: 2, 2: 1, 3: 0, 4: 0, 5: 0 });
  assert.deepEqual(b.spells.maxSlots, { 1: 4, 2: 2, 3: 0, 4: 0, 5: 0 });
  assert.deepEqual(b.spells.concentration, { spellRef: 'shield', startedAt: 3 });

  // And the whole party[0] block is deep-equal
  assert.deepEqual(b, a);
});
