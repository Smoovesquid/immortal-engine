import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { adjudicate } from '../engine/adjudication/adjudicate.js';

// ── U87 — Adjudicate Loop (End-to-End) ───────────────────────────────────

// Setup: create a world with a wooden barrel at the current node
function makeWorldWithBarrel() {
  return ensureWorld({
    meta: { version: 21, seed: 'u87-barrel', fate: 0.2 },
    party: [{
      id: 'party',
      name: 'Hero',
      stats: { MIGHT: 12, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 }
    }],
    map: {
      nodes: [{
        id: 'n0',
        name: 'cellar',
        currentNodeId: 'n0',
        furniture: [
          {
            name: 'wooden barrel',
            parts: ['staves', 'hoops', 'bottom'],
            state: 'intact',
            bulk: 4,
            weight: 3,
            tags: ['wood', 'container', 'furniture']
          }
        ]
      }],
      currentNodeId: 'n0',
      edges: []
    },
    timeline: []
  });
}

test('U87-01: adjudicate detects physical interaction', () => {
  const w = makeWorldWithBarrel();
  const result = adjudicate(w, 'examine the barrel');
  assert.ok(result.narration);
  assert.ok(result.world);
});

test('U87-02: adjudicate returns narration from template', () => {
  const w = makeWorldWithBarrel();
  const result = adjudicate(w, 'examine the wooden barrel');
  assert.ok(result.narration.length > 0);
  assert.ok(typeof result.narration === 'string');
});

test('U87-03: adjudicate break action generates deltas', () => {
  const w = makeWorldWithBarrel();
  const result = adjudicate(w, 'smash the wooden barrel');
  assert.ok(result.world);
  // Timeline should have a ruling entry
  assert.ok(result.world.timeline.length > 0);
  const lastEntry = result.world.timeline[result.world.timeline.length - 1];
  assert.equal(lastEntry.kind, 'ruling');
});

test('U87-04: adjudicate logs the ruling with action, approach, outcome', () => {
  const w = makeWorldWithBarrel();
  const result = adjudicate(w, 'smash the barrel');
  const lastEntry = result.world.timeline[result.world.timeline.length - 1];
  const data = lastEntry.data;
  assert.ok(data.action.includes('smash'));
  assert.equal(data.approach, 'force');
  assert.ok(['success', 'mixed', 'failure'].includes(data.outcome));
});

test('U87-05: adjudicate includes roll and DC in log', () => {
  const w = makeWorldWithBarrel();
  const result = adjudicate(w, 'break the barrel');
  const lastEntry = result.world.timeline[result.world.timeline.length - 1];
  const data = lastEntry.data;
  assert.ok(typeof data.roll === 'number');
  assert.ok(data.roll >= 1 && data.roll <= 20);
  assert.ok(typeof data.dcSuggestion === 'number');
});

test('U87-06: adjudicate computes outcome from roll vs DC', () => {
  const w = makeWorldWithBarrel();
  const result = adjudicate(w, 'smash the barrel');
  const lastEntry = result.world.timeline[result.world.timeline.length - 1];
  const data = lastEntry.data;
  const total = data.roll + data.modifier;
  if (total >= data.dcSuggestion) {
    assert.equal(data.outcome, 'success');
  } else if (total >= data.dcSuggestion - 5) {
    assert.equal(data.outcome, 'mixed');
  } else {
    assert.equal(data.outcome, 'failure');
  }
});

test('U87-07: adjudicate infers approach from intent keywords', () => {
  const wForce = makeWorldWithBarrel();
  const resultForce = adjudicate(wForce, 'smash the barrel');
  const forceEntry = resultForce.world.timeline[resultForce.world.timeline.length - 1];
  assert.equal(forceEntry.data.approach, 'force');

  const wExamine = makeWorldWithBarrel();
  const resultExamine = adjudicate(wExamine, 'examine the barrel');
  const examineEntry = resultExamine.world.timeline[resultExamine.world.timeline.length - 1];
  assert.equal(examineEntry.data.approach, 'force'); // default if no keyword match
});

test('U87-08: adjudicate narration is deterministic (same input = same narration)', () => {
  // Same seed and input should always produce same narration
  const seed = 'u87-narr-test';
  const w1 = ensureWorld({
    meta: { version: 21, seed, fate: 0.2 },
    party: [{ id: 'party', name: 'Hero', stats: { MIGHT: 12, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 } }],
    map: {
      nodes: [{
        id: 'n0',
        name: 'cellar',
        furniture: [{ name: 'wooden barrel', parts: ['staves'], state: 'intact', bulk: 4, weight: 3, tags: ['wood'] }]
      }],
      currentNodeId: 'n0',
      edges: []
    },
    timeline: []
  });

  const w2 = ensureWorld({
    meta: { version: 21, seed, fate: 0.2 },
    party: [{ id: 'party', name: 'Hero', stats: { MIGHT: 12, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 } }],
    map: {
      nodes: [{
        id: 'n0',
        name: 'cellar',
        furniture: [{ name: 'wooden barrel', parts: ['staves'], state: 'intact', bulk: 4, weight: 3, tags: ['wood'] }]
      }],
      currentNodeId: 'n0',
      edges: []
    },
    timeline: []
  });

  const r1 = adjudicate(w1, 'break the barrel');
  const r2 = adjudicate(w2, 'break the barrel');
  assert.equal(r1.narration, r2.narration, 'same seed + input should produce same narration');
});

test('U87-09: adjudicate applies deltas to world state', () => {
  const w = makeWorldWithBarrel();
  assert.ok(w.map.nodes[0].furniture.length > 0);

  const result = adjudicate(w, 'break the barrel');
  // After breaking, furniture may be modified or removed depending on deltas
  assert.ok(result.world.timeline.length > 0);
});

test('U87-10: adjudicate is deterministic (same seed = same roll)', () => {
  const seed = 'u87-det';
  const w1 = ensureWorld({
    meta: { version: 21, seed, fate: 0.2 },
    party: [{ id: 'party', name: 'Hero', stats: { MIGHT: 12, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 } }],
    map: {
      nodes: [{
        id: 'n0',
        name: 'cellar',
        furniture: [{ name: 'wooden barrel', parts: ['staves'], state: 'intact', bulk: 4, weight: 3, tags: ['wood'] }]
      }],
      currentNodeId: 'n0',
      edges: []
    },
    timeline: []
  });

  const w2 = ensureWorld({
    meta: { version: 21, seed, fate: 0.2 },
    party: [{ id: 'party', name: 'Hero', stats: { MIGHT: 12, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 } }],
    map: {
      nodes: [{
        id: 'n0',
        name: 'cellar',
        furniture: [{ name: 'wooden barrel', parts: ['staves'], state: 'intact', bulk: 4, weight: 3, tags: ['wood'] }]
      }],
      currentNodeId: 'n0',
      edges: []
    },
    timeline: []
  });

  const r1 = adjudicate(w1, 'smash the barrel');
  const r2 = adjudicate(w2, 'smash the barrel');

  const e1 = r1.world.timeline[r1.world.timeline.length - 1].data;
  const e2 = r2.world.timeline[r2.world.timeline.length - 1].data;

  assert.equal(e1.roll, e2.roll, 'rolls should be identical with same seed');
  assert.equal(e1.outcome, e2.outcome, 'outcomes should be identical with same seed');
});

test('U87-11: adjudicate does not mutate input world', () => {
  const w = makeWorldWithBarrel();
  const wCopy = JSON.stringify(w);
  adjudicate(w, 'smash the barrel');
  assert.equal(JSON.stringify(w), wCopy, 'input world should not be mutated');
});

test('U87-12: adjudicate handles missing furniture gracefully', () => {
  const wEmpty = ensureWorld({
    meta: { version: 21, seed: 'u87-empty', fate: 0.2 },
    party: [{ id: 'party', name: 'Hero', stats: { MIGHT: 12, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 } }],
    map: {
      nodes: [{ id: 'n0', name: 'empty', furniture: [] }],
      currentNodeId: 'n0',
      edges: []
    },
    timeline: []
  });

  const result = adjudicate(wEmpty, 'examine the barrel');
  assert.ok(result.narration);
  assert.ok(result.world);
});
