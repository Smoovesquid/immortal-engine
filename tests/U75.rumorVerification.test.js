import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { verifyRumorsForSeed } from '../engine/rumor/verify.js';
import { decompressAndCanonizeSync } from '../engine/decompression/decompress.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function mkWorld(overrides = {}) {
  const base = newWorld({ seed: 'u75', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  return ensureWorld({ ...base, ...overrides });
}

function mkRumor(overrides = {}) {
  return {
    id: 'rumor:seed1:npc1:1',
    sourceSeedId: 'seed1',
    carrierNpcId: 'npc1',
    hopCount: 1,
    tier: 1,
    age: 5,
    mintedAt: 0,
    body: 'The old well is cursed.',
    tags: ['well', 'curse'],
    ...overrides
  };
}

// ── U75-01: tier-0 rumor is verified as 'true' ─────────────────────────

test('U75-01: tier-0 rumor is verified as true', () => {
  const rumor = mkRumor({ tier: 0, body: 'Anything at all.' });
  const w = mkWorld({ rumors: [rumor] });
  const { world } = verifyRumorsForSeed(w, 'seed1', 'The truth about something.', { events: [] });
  assert.equal(world.rumors[0].verified, 'true', 'tier-0 should always verify as true');
});

// ── U75-02: tier-1 rumor with matching words is 'partial' ──────────────

test('U75-02: tier-1 rumor with matching words is partial', () => {
  const rumor = mkRumor({ tier: 1, body: 'The old well is cursed.' });
  const w = mkWorld({ rumors: [rumor] });
  const { world } = verifyRumorsForSeed(w, 'seed1', 'The ancient well of Thornbrook', { events: [] });
  assert.equal(world.rumors[0].verified, 'partial', 'tier-1 with shared word "well" should be partial');
});

// ── U75-03: tier-4 rumor with no matching words is 'false' ─────────────

test('U75-03: tier-4 rumor with no matching words is false', () => {
  const rumor = mkRumor({ tier: 4, body: 'Bad news from the east.' });
  const w = mkWorld({ rumors: [rumor] });
  const { world } = verifyRumorsForSeed(w, 'seed1', 'The iron forge of Keldara', { events: [] });
  assert.equal(world.rumors[0].verified, 'false', 'tier-4 with no shared words should be false');
});

// ── U75-04: verification does not mutate body ──────────────────────────

test('U75-04: verification does not mutate body', () => {
  const originalBody = 'The old well is cursed.';
  const rumor = mkRumor({ tier: 1, body: originalBody });
  const w = mkWorld({ rumors: [rumor] });
  const { world } = verifyRumorsForSeed(w, 'seed1', 'The well of doom', { events: [] });
  assert.equal(world.rumors[0].body, originalBody, 'body should not be changed by verification');
});

// ── U75-05: decompressAndCanonizeSync triggers verification ─────────────

test('U75-05: decompressAndCanonizeSync triggers verification', () => {
  const w = mkWorld();
  // Find a node that is not yet decompressed.
  const targetNode = w.map.nodes.find(n => !n.settlement?.decompressed);
  if (!targetNode) {
    // All nodes decompressed — skip gracefully.
    return;
  }
  const nodeId = targetNode.id;

  // Add a rumor about this node's seedId (nodeId is the seedId in this engine).
  const rumor = mkRumor({
    id: `rumor:${nodeId}:npc1:1`,
    sourceSeedId: nodeId,
    tier: 0,
    body: 'A place of wonder.'
  });
  const wWithRumor = ensureWorld({ ...w, rumors: [rumor] });

  // Decompress the node — this should trigger verification.
  const pack = { primaryId: 'fantasy', mixerId: null };
  const result = decompressAndCanonizeSync(wWithRumor, nodeId, pack);
  const verifiedRumor = result.rumors.find(r => r.sourceSeedId === nodeId);
  assert.ok(verifiedRumor, 'rumor should still exist after decompression');
  assert.ok(verifiedRumor.verified, 'rumor should have a verified field after decompression');
});
