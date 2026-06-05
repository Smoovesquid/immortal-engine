import test from 'node:test';
import assert from 'node:assert/strict';

import { creatureCard, npcCard } from '../engine/ai/inspectCards.js';

const rat = {
  ref: 'gnaw_rat', name: 'Gnaw-Rat', cr: 0, tier: 'trivial', maxHp: 7, ac: 11,
  stats: { MIGHT: 4, AGILITY: 13, WITS: 2, GRIT: 6, CHARM: 2 },
  traits: ['Keen Smell', 'Pack Tactics'], tags: ['beast'],
  socialStructure: 'Swarm, 6–12 individuals, no leader',
  physicalDescription: 'Matted grey fur, yellow incisors.',
  weakness: 'Panics near fire.', loreHook: "Where there's one, there's forty.",
  encounterSign: 'Scratching inside the walls.'
};

test('U94: unidentified creature hides name + stats', () => {
  const c = creatureCard(rat, { identified: false });
  assert.equal(c.kind, 'creature');
  assert.match(c.glance.title, /Unknown beast/);
  assert.equal(c.glance.sub, 'moves in a pack');
  assert.equal(c.full.identified, false);
  assert.equal(c.full.hp, '???');
  assert.equal(c.full.ac, '???');
  assert.equal(c.full.stats.MIGHT, '?');
  assert.ok(!('weakness' in c.full), 'weakness must not leak before identification');
});

test('U94: identified creature reveals the full stat block', () => {
  const c = creatureCard(rat, { identified: true });
  assert.equal(c.glance.title, 'Gnaw-Rat');
  assert.equal(c.full.identified, true);
  assert.equal(c.full.hp, 7);
  assert.equal(c.full.ac, 11);
  assert.equal(c.full.stats.AGILITY, 13);
  assert.deepEqual(c.full.traits, ['Keen Smell', 'Pack Tactics']);
  assert.equal(c.full.weakness, 'Panics near fire.');
});

test('U94: unmet NPC is a Stranger; known facts show, secrets are counted not shown', () => {
  const npc = {
    name: 'Kessa', role: 'prisoner', species: 'Human',
    conversationState: { metPlayer: false, trustLevel: 2 },
    knowledgeGraph: [{ factId: 'cell_three_nights', source: 'observed' }, { factId: 'vault_phrase', source: 'secret' }],
    secrets: ['vault_phrase', 'warden_sister']
  };
  const c = npcCard(npc, {});
  assert.equal(c.glance.title, 'Stranger');
  assert.match(c.glance.sub, /Human · prisoner/);
  assert.equal(c.full.met, false);
  assert.deepEqual(c.full.known, ['cell_three_nights']); // public knowledge only
  assert.equal(c.full.hiddenCount, 2);
});

test('U94: met NPC reveals name', () => {
  const npc = { name: 'Kessa', role: 'prisoner', species: 'Human', conversationState: { metPlayer: true, trustLevel: 7 } };
  const c = npcCard(npc, {});
  assert.equal(c.glance.title, 'Kessa');
  assert.equal(c.full.met, true);
  assert.equal(c.full.name, 'Kessa');
});
