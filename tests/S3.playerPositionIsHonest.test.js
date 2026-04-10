/**
 * Gate S3 — Player Position Is Honest
 *
 * localFtX / localFtY in world state must always reflect where the
 * player actually is. Accumulation must be additive and exact.
 * Node arrival must reset position to (0, 0).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

function makeWorld(seed = 's3') {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
  return beginAdventure(w0, packsById).world;
}

function ftX(w) { return Number(w.party?.[0]?.position?.localFtX ?? 0); }
function ftY(w) { return Number(w.party?.[0]?.position?.localFtY ?? 0); }

test('S3: 3 explicit-ft moves north accumulates localFtY to -90', () => {
  let w = makeWorld('s3-north');
  w = playerMove(w, packsById, 'move 30ft north').world;
  w = playerMove(w, packsById, 'move 30ft north').world;
  w = playerMove(w, packsById, 'move 30ft north').world;
  assert.equal(ftX(w), 0,   'localFtX should be 0 after 3 north moves');
  assert.equal(ftY(w), -90, 'localFtY should be -90 after 3 north moves');
});

test('S3: 3 explicit-ft moves south accumulates localFtY to +90', () => {
  let w = makeWorld('s3-south');
  w = playerMove(w, packsById, 'move 30ft south').world;
  w = playerMove(w, packsById, 'move 30ft south').world;
  w = playerMove(w, packsById, 'move 30ft south').world;
  assert.equal(ftX(w), 0,  'localFtX should be 0 after 3 south moves');
  assert.equal(ftY(w), 90, 'localFtY should be +90 after 3 south moves');
});

test('S3: explicit-ft east/west moves accumulate localFtX only', () => {
  let w = makeWorld('s3-ew');
  w = playerMove(w, packsById, 'move 30ft east').world;
  w = playerMove(w, packsById, 'move 30ft east').world;
  w = playerMove(w, packsById, 'move 30ft west').world;
  assert.equal(ftX(w), 30, 'localFtX should be +30 (2 east, 1 west)');
  assert.equal(ftY(w), 0,  'localFtY should be 0');
});

test('S3: node arrival resets localFtX and localFtY to 0', () => {
  let w = makeWorld('s3-reset');
  // Move locally first with explicit foot distances
  w = playerMove(w, packsById, 'move 30ft north').world;
  w = playerMove(w, packsById, 'move 30ft east').world;
  assert.ok(ftX(w) !== 0 || ftY(w) !== 0, 'position should be non-zero after local moves');

  // Travel to a new node via directional shorthand (now inter-node travel)
  const neighbors = (w.map?.edges || [])
    .filter(e => e.a === w.map.currentNodeId || e.b === w.map.currentNodeId)
    .map(e => e.a === w.map.currentNodeId ? e.b : e.a);
  assert.ok(neighbors.length > 0, 'starting node must have neighbors');

  const destNode = w.map.nodes.find(n => n.id === neighbors[0]);
  assert.ok(destNode, 'destination node must exist');

  const result = playerMove(w, packsById, `travel to ${destNode.name}`);
  // Only check reset if travel succeeded (moved to a new node)
  if (result.world.map.currentNodeId !== w.map.currentNodeId) {
    assert.equal(ftX(result.world), 0, 'localFtX must reset to 0 on node arrival');
    assert.equal(ftY(result.world), 0, 'localFtY must reset to 0 on node arrival');
  }
});

test('S3: position is deterministic — same seed + same inputs = same coords', () => {
  const run = () => {
    let w = makeWorld('s3-det');
    w = playerMove(w, packsById, 'go north').world;
    w = playerMove(w, packsById, 'go east').world;
    w = playerMove(w, packsById, 'go north').world;
    return { x: ftX(w), y: ftY(w) };
  };
  const a = run();
  const b = run();
  assert.deepEqual(a, b, 'same inputs must always produce same position');
});
