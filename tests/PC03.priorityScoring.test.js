// PC03: Priority scoring in gatherNpcKnowledge
import test from 'node:test';
import assert from 'node:assert/strict';

import { gatherNpcKnowledge } from '../engine/npc/perspectiveFilter.js';

function makeNpc(overrides = {}) {
  return {
    id: 'npc_0',
    knowledgeGraph: [
      { factId: 'old_trade_route', source: 'witnessed' },
      { factId: 'village_fire', source: 'heard' },
      { factId: 'dragon_lair', source: 'witnessed' },
      { factId: 'dragon_weakness', source: 'secret' },
      { factId: 'harvest_festival', source: 'common' },
      { factId: 'recent_earthquake', source: 'witnessed' }
    ],
    rumorIds: ['r_dragon_hoard', 'r_bandit_camp', 'r_well_curse'],
    ...overrides
  };
}

function makeWorld() {
  return {
    rumors: [
      { id: 'r_dragon_hoard', body: 'A dragon hoards gold in the mountain', tier: 0, tags: ['dragon', 'treasure'] },
      { id: 'r_bandit_camp', body: 'Bandits have set up camp near the road', tier: 2, tags: ['danger'] },
      { id: 'r_well_curse', body: 'The well is cursed by old magic', tier: 3, tags: ['magic'] }
    ]
  };
}

test('PC03.1: without opts.topic, no priority field is added', () => {
  const npc = makeNpc();
  const world = makeWorld();
  const { facts, rumors } = gatherNpcKnowledge(npc, world);

  for (const f of facts) {
    assert.equal(f.priority, undefined, `fact ${f.id} should not have priority`);
  }
  for (const r of rumors) {
    assert.equal(r.priority, undefined, `rumor ${r.id} should not have priority`);
  }
});

test('PC03.2: facts with topic word in id get priority 3', () => {
  const npc = makeNpc();
  const world = makeWorld();
  const { facts } = gatherNpcKnowledge(npc, world, { topic: 'dragon' });

  const dragonLair = facts.find(f => f.id === 'dragon_lair');
  const dragonWeakness = facts.find(f => f.id === 'dragon_weakness');
  assert.equal(dragonLair.priority, 3, 'dragon_lair should have priority 3');
  assert.equal(dragonWeakness.priority, 3, 'dragon_weakness should have priority 3');
});

test('PC03.3: old facts (early in array) get priority 1', () => {
  const npc = makeNpc();
  const world = makeWorld();
  const { facts } = gatherNpcKnowledge(npc, world, { topic: 'dragon' });

  const oldTrade = facts.find(f => f.id === 'old_trade_route');
  assert.equal(oldTrade.priority, 1, 'old_trade_route (early in array) should be priority 1');
});

test('PC03.4: recent facts (late in array) get priority 2', () => {
  const npc = makeNpc();
  const world = makeWorld();
  const { facts } = gatherNpcKnowledge(npc, world, { topic: 'dragon' });

  const recent = facts.find(f => f.id === 'recent_earthquake');
  assert.equal(recent.priority, 2, 'recent_earthquake (late in array) should be priority 2');
});

test('PC03.5: rumors with matching tags get priority 3', () => {
  const npc = makeNpc();
  const world = makeWorld();
  const { rumors } = gatherNpcKnowledge(npc, world, { topic: 'dragon' });

  const dragonRumor = rumors.find(r => r.id === 'r_dragon_hoard');
  assert.equal(dragonRumor.priority, 3, 'dragon-tagged rumor should have priority 3');
});

test('PC03.6: high-tier rumors (tier 0-1) without matching tags get priority 2', () => {
  const npc = makeNpc();
  const world = makeWorld();
  // Use a topic that won't match any tags
  const { rumors } = gatherNpcKnowledge(npc, world, { topic: 'forest' });

  const dragonRumor = rumors.find(r => r.id === 'r_dragon_hoard');
  assert.equal(dragonRumor.priority, 2, 'tier-0 rumor without matching tag should be priority 2');
});

test('PC03.7: low-tier rumors (tier 2+) without matching tags get priority 1', () => {
  const npc = makeNpc();
  const world = makeWorld();
  const { rumors } = gatherNpcKnowledge(npc, world, { topic: 'forest' });

  const banditRumor = rumors.find(r => r.id === 'r_bandit_camp');
  assert.equal(banditRumor.priority, 1, 'tier-2 rumor without matching tag should be priority 1');
});

test('PC03.8: topic words shorter than 4 chars are ignored', () => {
  const npc = makeNpc();
  const world = makeWorld();
  // 'old' is 3 chars, should be ignored; no words >= 4 chars match
  const { facts } = gatherNpcKnowledge(npc, world, { topic: 'old' });

  // No topic words matched (all < 4 chars), so nothing gets priority 3
  const hasPri3 = facts.some(f => f.priority === 3);
  assert.ok(!hasPri3, 'short topic words should not trigger priority 3');
});

test('PC03.9: existing call path without opts returns same shape', () => {
  const npc = makeNpc();
  const world = makeWorld();
  const result = gatherNpcKnowledge(npc, world);

  assert.ok(Array.isArray(result.facts), 'should have facts array');
  assert.ok(Array.isArray(result.rumors), 'should have rumors array');
  assert.equal(result.facts.length, 6, 'should have all 6 facts');
  assert.equal(result.rumors.length, 3, 'should have all 3 rumors');

  // Verify shape of each fact
  for (const f of result.facts) {
    assert.ok('id' in f && 'text' in f && 'source' in f, 'fact should have id, text, source');
    assert.equal(f.priority, undefined, 'no priority without opts');
  }
});
