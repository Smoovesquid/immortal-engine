// U271: The world answers — W1·2 substrate depth (placeQuery + personQuery).
//
// Gates that pointed substrate questions return grounded answers (never a dice
// roll or fabrication) or an honest null when no data exists. Three additions:
//   1. placeQuery `events` now returns ALL node local-events joined, not just the first.
//   2. placeQuery `history` type surfaces region-layer crisis/blessing events.
//   3. personQuery `tenure` type answers "how long has X been here?" from npc.originTick.
//
// The trade_town_tavern fixture has a seeded substrate (ensureNodeSubstrate called), so
// both node and region layers are populated and verifiable.

import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPlaceQuery, resolvePlaceFact } from '../engine/world/placeQuery.js';
import { classifyPersonQuery, resolvePersonFact } from '../engine/world/personQuery.js';
import { FIXTURES } from '../scripts/convergence/fixtures.mjs';

// ── Helper: minimal world with region events ────────────────────────────────────

function worldWithRegionEvents(crisisLabel = 'the great flood of the valley') {
  return {
    substrate: {
      worldSeed: 'w271-seed',
      cosmology: {},
      regions: {
        'region-0': [
          { id: 'r0:crisis', kind: 'crisis',   layer: 'region', regionId: 'region-0', t: -400, label: crisisLabel, sealed: false },
          { id: 'r0:bless',  kind: 'blessing', layer: 'region', regionId: 'region-0', t: -200, label: 'the decade of clear roads', sealed: false },
        ],
      },
      nodes: {},
    },
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', settlement: { npcs: [] } }] },
    regions: [{ regionId: 'region-0', tier: 'mid' }],
  };
}

function worldWithTwoNodeEvents() {
  return {
    substrate: {
      worldSeed: 'w271-seed',
      cosmology: {},
      regions: { 'region-0': [] },
      nodes: {
        'n1': [
          { id: 'n1:e0', kind: 'founding',    layer: 'node', nodeId: 'n1', t: -60, label: 'founded at the ford', sealed: false },
          { id: 'n1:e1', kind: 'local-event', layer: 'node', nodeId: 'n1', t: -40, label: 'the stranger who stayed the winter', sealed: false },
          { id: 'n1:e2', kind: 'local-event', layer: 'node', nodeId: 'n1', t: -20, label: 'the year the well ran strange', sealed: false },
        ],
      },
    },
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', settlement: { npcs: [] } }] },
    regions: [{ regionId: 'region-0', tier: 'mid' }],
  };
}

// ── 1. placeQuery `events` — returns ALL node local-events ──────────────────────

test('U271: events — classifies place-anchored local-history questions', () => {
  // "what happened the winter a stranger stayed?" has no place anchor → it routes
  // to the bare-happened handler elsewhere, which is correct by design. The events
  // type covers place-anchored questions; all node events return so the stranger-
  // winter label surfaces when a player asks "what happened here?".
  for (const t of [
    'what happened here?',
    'anything happen around here?',
    'what goes on in this town?',
    'what happened in this settlement?',
  ]) {
    assert.deepEqual(classifyPlaceQuery(t), { scope: 'here', type: 'events' }, t);
  }
});

test('U271: events — returns ALL node local-events when the node has two', () => {
  const world = worldWithTwoNodeEvents();
  const fact = resolvePlaceFact(world, { scope: 'here', type: 'events' });
  assert.ok(fact, 'expected a fact');
  assert.equal(fact.type, 'events');
  // Both events must appear in the body.
  assert.match(fact.body, /stranger who stayed the winter/);
  assert.match(fact.body, /well ran strange/);
  // Joined with a separator — not bare concatenation.
  assert.ok(fact.body.includes('; also, '), 'expected "; also, " separator between events');
});

test('U271: events — single-event node returns its body without a separator', () => {
  const world = {
    substrate: {
      worldSeed: 'w271-seed', cosmology: {}, regions: { 'region-0': [] },
      nodes: { 'n1': [
        { id: 'n1:e0', kind: 'local-event', layer: 'node', nodeId: 'n1', t: -30, label: 'the fire that took the records', sealed: false },
      ]},
    },
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', settlement: { npcs: [] } }] },
    regions: [{ regionId: 'region-0', tier: 'mid' }],
  };
  const fact = resolvePlaceFact(world, { type: 'events' });
  assert.ok(fact);
  assert.match(fact.body, /fire that took the records/);
  assert.ok(!fact.body.includes('; also,'), 'no separator for a single event');
});

test('U271: events — trade_town_tavern fixture (seeded substrate) delivers a local-event body', () => {
  // The full seeded fixture has its own node events — assert it returns something grounded.
  const fact = resolvePlaceFact(FIXTURES.trade_town_tavern(), { scope: 'here', type: 'events' });
  assert.ok(fact, 'expected a grounded local-event from the seeded fixture');
  assert.equal(fact.type, 'events');
  assert.equal(fact.clarity, 'vivid');
  // The seeded fixture has "traveling healers" in one of its events (from U220); must still be there.
  assert.match(fact.body, /traveling healers/);
});

test('U271: events — node with NO local-events returns null (honest decline)', () => {
  const world = {
    substrate: {
      worldSeed: 'w271-seed', cosmology: {}, regions: {}, nodes: {
        'n1': [{ id: 'n1:f', kind: 'founding', layer: 'node', nodeId: 'n1', t: -60, label: 'a founding', sealed: false }],
      },
    },
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', settlement: { npcs: [] } }] },
    regions: [],
  };
  assert.equal(resolvePlaceFact(world, { type: 'events' }), null);
});

// ── 2. placeQuery `history` — regional crisis/blessing layer ────────────────────

test('U271: history — classifies regional-history questions', () => {
  for (const t of [
    'what troubles has this land seen?',
    'what hardships has this region faced?',
    'has this land known strife?',
    'what is the history of this land?',
    'what crises have hit this area?',
  ]) {
    assert.deepEqual(classifyPlaceQuery(t), { scope: 'here', type: 'history' }, `FAILED: "${t}"`);
  }
});

test('U271: history — local-settlement questions do NOT classify as history', () => {
  // These stay in `events` (node-scoped) or `founding` — not the regional layer.
  for (const t of [
    'what happened here?',
    'how was this town founded?',
    'who lives here?',
    'what happened to the baker?',
  ]) {
    const q = classifyPlaceQuery(t);
    assert.notEqual(q?.type, 'history', `"${t}" should NOT classify as history`);
  }
});

test('U271: history — returns region crisis/blessing events joined', () => {
  const world = worldWithRegionEvents('the great flood of the valley');
  const fact = resolvePlaceFact(world, { scope: 'here', type: 'history' });
  assert.ok(fact, 'expected a regional history fact');
  assert.equal(fact.type, 'history');
  assert.equal(fact.clarity, 'distant');
  assert.match(fact.body, /great flood of the valley/);
  assert.match(fact.body, /decade of clear roads/);
});

test('U271: history — node-layer events do NOT appear in history (region-only filter)', () => {
  // Build a world with ONLY a node-layer local-event in a region bucket.
  const world = {
    substrate: {
      worldSeed: 'w271', cosmology: {}, regions: {
        'region-0': [
          { id: 'r0:node-event', kind: 'local-event', layer: 'node', regionId: 'region-0', t: -100, label: 'local gossip only', sealed: false },
        ],
      },
      nodes: {},
    },
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', settlement: { npcs: [] } }] },
    regions: [{ regionId: 'region-0', tier: 'mid' }],
  };
  assert.equal(resolvePlaceFact(world, { type: 'history' }), null);
});

test('U271: history — region with no crisis/blessing events returns null (honest decline)', () => {
  const world = worldWithRegionEvents();
  // Override with empty region.
  world.substrate.regions = { 'region-0': [] };
  assert.equal(resolvePlaceFact(world, { type: 'history' }), null);
});

// ── 3. personQuery `tenure` — how long has X been here? ──────────────────────────

test('U271: tenure — classifies "how long has X been here" questions before the defer guard', () => {
  for (const t of [
    'how long has Bram been here?',
    'how long has Kael been in town?',
    'has Marta been here long?',
    'is Dalla a founding member?',
  ]) {
    const q = classifyPersonQuery(t);
    assert.ok(q, `"${t}" should classify`);
    assert.equal(q.type, 'tenure', `"${t}" expected type 'tenure', got '${q?.type}'`);
  }
});

test('U271: tenure — tenure does NOT fire for generic "how long" with no referent', () => {
  // "how long have they been here?" — bare "they" is a demonstrative, tenure pattern should miss.
  const q = classifyPersonQuery('how long have I been here?');
  // "I" is not an NPC referent — should not fire tenure (and deferred otherwise).
  assert.ok(!q || q.type !== 'tenure', 'should not classify "I" as a tenure referent');
});

test('U271: tenure — resolves founding resident (originTick=0) grounded answer', () => {
  const world = {
    map: {
      currentNodeId: 'n1',
      nodes: [{ id: 'n1', settlement: { npcs: [
        { id: 'npc_1', name: 'Bram', role: 'tavern-keeper', hostile: false, originTick: 0, conversationState: {} },
      ]}}],
    },
  };
  const q = classifyPersonQuery('how long has Bram been here?');
  assert.ok(q, 'expected a tenure query');
  const fact = resolvePersonFact(world, q);
  assert.ok(fact, 'expected a resolved fact');
  assert.equal(fact.type, 'tenure');
  assert.match(fact.body, /since the founding/);
  assert.match(fact.body, /Bram/);
});

test('U271: tenure — resolves newer arrival (originTick=7) grounded answer', () => {
  const world = {
    map: {
      currentNodeId: 'n1',
      nodes: [{ id: 'n1', settlement: { npcs: [
        { id: 'npc_2', name: 'Lyssa', role: 'healer', hostile: false, originTick: 7, conversationState: {} },
      ]}}],
    },
  };
  const q = classifyPersonQuery('how long has Lyssa been in town?');
  assert.ok(q);
  const fact = resolvePersonFact(world, q);
  assert.ok(fact);
  assert.equal(fact.type, 'tenure');
  assert.match(fact.body, /arrived more recently/);
});

test('U271: tenure — unknown referent returns null (honest decline, no invention)', () => {
  const world = {
    map: {
      currentNodeId: 'n1',
      nodes: [{ id: 'n1', settlement: { npcs: [
        { id: 'npc_1', name: 'Bram', role: 'tavern-keeper', hostile: false, originTick: 0, conversationState: {} },
      ]}}],
    },
  };
  const q = classifyPersonQuery('how long has Grendel been here?');
  assert.ok(q && q.type === 'tenure');
  const fact = resolvePersonFact(world, q);
  assert.equal(fact, null, 'unknown referent must return null — never invent');
});

test('U271: tenure — hostile NPC is never answered (sight-scoped safety)', () => {
  const world = {
    map: {
      currentNodeId: 'n1',
      nodes: [{ id: 'n1', settlement: { npcs: [
        { id: 'npc_bad', name: 'Grik', role: 'bandit', hostile: true, originTick: 0, conversationState: {} },
      ]}}],
    },
  };
  const q = classifyPersonQuery('how long has Grik been here?');
  if (q) {
    const fact = resolvePersonFact(world, q);
    assert.equal(fact, null, 'hostile NPC tenure must return null');
  }
});

// ── 4. Purity / determinism ───────────────────────────────────────────────────────

test('U271: all three resolvers are pure — same input same output', () => {
  const world = worldWithTwoNodeEvents();
  const q = { scope: 'here', type: 'events' };
  const a = resolvePlaceFact(world, q);
  const b = resolvePlaceFact(world, q);
  assert.deepEqual(a, b, 'resolvePlaceFact is not deterministic');
  const hw = worldWithRegionEvents();
  const ha = resolvePlaceFact(hw, { type: 'history' });
  const hb = resolvePlaceFact(hw, { type: 'history' });
  assert.deepEqual(ha, hb, 'history resolver is not deterministic');
});
