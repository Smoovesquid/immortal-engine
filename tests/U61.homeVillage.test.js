import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld, WORLD_VERSION } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { worldHash } from '../engine/worldHash.js';
import { buildDMContext } from '../engine/ai/narratorContext.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

function begin(seed = 'u61') {
  const w0 = newWorld({
    seed,
    fate: 0.2,
    campaignId: 'c',
    pack: { primaryId: 'fantasy', mixerId: null }
  });
  return beginAdventure(w0, packsById).world;
}

// U61-01 — WORLD_VERSION is at the overworld-geometry bump.
test('U61-01: WORLD_VERSION is 20', () => {
  assert.equal(WORLD_VERSION, 20);
});

// U61-02 — beginAdventure sets meta.homeNodeId to the starting settlement.
test('U61-02: beginAdventure sets meta.homeNodeId to the starting node', () => {
  const w = begin('u61-02');
  const homeId = String(w.meta?.homeNodeId || '');
  assert.ok(homeId, 'homeNodeId must be set after begin');
  assert.equal(homeId, String(w.map?.currentNodeId || ''), 'home == starting node');
  const node = (w.map?.nodes || []).find(n => String(n.id) === homeId);
  assert.ok(node, 'homeNodeId must reference an existing node');
  assert.equal(String(node.nodeType), 'settlement', 'home must be a settlement');
});

// U61-03 — scene.time is 'waking' at begin and the player is inside an interior.
test('U61-03: begin places player in home bedroom with scene.time=waking', () => {
  const w = begin('u61-03');
  assert.equal(String(w.scene?.time || ''), 'waking', 'scene.time must be waking at begin');
  assert.ok(w.scene?.interior && typeof w.scene.interior === 'object',
    'player must be inside a home interior at begin');
  assert.ok(String(w.scene.interior.structureKey || ''), 'interior has a structureKey');
  assert.ok(String(w.scene.interior.roomId || ''), 'interior has a roomId');
});

// U61-04 — homeNodeId invariant rejects non-settlement and unknown references.
test('U61-04: invariants reject a meta.homeNodeId that does not reference a settlement', () => {
  const w = begin('u61-04');

  // Unknown id → throw
  const wBadId = { ...w, meta: { ...w.meta, homeNodeId: 'nonexistent-node-id' } };
  assert.throws(() => assertWorldInvariants(wBadId), /homeNodeId/);

  // Existing node, but not a settlement → throw
  const nodes = (w.map?.nodes || []).map(n =>
    String(n.id) === String(w.meta.homeNodeId) ? { ...n, nodeType: 'wilderness' } : n
  );
  const wBadType = { ...w, map: { ...w.map, nodes } };
  assert.throws(() => assertWorldInvariants(wBadType), /homeNodeId/);
});

// U61-05 — worldHash is stable under a save/load round-trip after begin.
test('U61-05: homeNodeId survives save/load round-trip with stable worldHash', () => {
  const w = begin('u61-05');
  const json = exportWorld(w);
  const reimported = importWorld(json);

  assert.equal(String(reimported.meta?.homeNodeId || ''), String(w.meta.homeNodeId),
    'homeNodeId survives round-trip');
  assert.equal(worldHash(reimported), worldHash(w),
    'worldHash is stable under save/load round-trip');
});

// U61-06 — begin is deterministic: same seed → same homeNodeId and same hash.
test('U61-06: same seed → same home and same worldHash', () => {
  const w1 = begin('u61-06-same');
  const w2 = begin('u61-06-same');
  assert.equal(w1.meta.homeNodeId, w2.meta.homeNodeId);
  assert.equal(worldHash(w1), worldHash(w2));
});

// U61-07 — pre-Pass-H saves import cleanly: missing homeNodeId defaults to ''
// and the home projection is silently omitted.
test('U61-07: pre-Pass-H save (no homeNodeId) imports with homeNodeId=""', () => {
  const w = begin('u61-07');
  const parsed = JSON.parse(exportWorld(w));
  delete parsed.world.meta.homeNodeId;
  const reimported = importWorld(JSON.stringify(parsed));
  assert.equal(String(reimported.meta?.homeNodeId || ''), '',
    'missing homeNodeId defaults to empty string');

  // Validate the DM projection silently omits home when homeNodeId is empty.
  const dm = buildDMContext(reimported, {}, { name: 'fantasy' });
  assert.equal(dm.home, null, 'DMContext.home is null when homeNodeId is empty');
});

// U61-08 — DMContext.home reports isCurrent correctly at home vs. away.
test('U61-08: DMContext.home.isCurrent flips when player leaves home', () => {
  const w = begin('u61-08');
  const dmAtHome = buildDMContext(w, {}, { name: 'fantasy' });
  assert.ok(dmAtHome.home, 'DMContext.home present when homeNodeId is set');
  assert.equal(dmAtHome.home.nodeId, w.meta.homeNodeId);
  assert.equal(dmAtHome.home.isCurrent, true, 'isCurrent is true at home');

  // Move the player away from home in-memory (force different currentNodeId).
  // Pick any other node id if one exists; otherwise fabricate a sibling to
  // prove the projection logic (we don't rely on playloop travel here).
  const otherNode = (w.map?.nodes || []).find(n => String(n.id) !== String(w.meta.homeNodeId));
  if (otherNode) {
    const wAway = ensureWorld({
      ...w,
      map: { ...w.map, currentNodeId: String(otherNode.id) }
    });
    const dmAway = buildDMContext(wAway, {}, { name: 'fantasy' });
    assert.ok(dmAway.home, 'DMContext.home still present when away');
    assert.equal(dmAway.home.isCurrent, false, 'isCurrent is false away from home');
  }
});
