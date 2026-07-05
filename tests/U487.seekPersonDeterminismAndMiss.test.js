import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { DEMO_SEED } from '../engine/world/demoRegion.js';

// SEEK-PERSON — determinism + the honest miss. Same seed twice → identical
// narration. A canon-empty occupancy case yields an honest in-fiction miss, never
// "no record" and never a navigation refusal.

function boot(seed = DEMO_SEED) {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  return { w, byId };
}

const UTTER = 'I get up and go find someone in the settlement who can tell me who founded this outpost.';

test('U487: the seek-person bridge is deterministic (same seed → identical narration)', () => {
  const a = boot();
  const b = boot();
  const ra = playerMove(a.w, a.byId, UTTER);
  const rb = playerMove(b.w, b.byId, UTTER);
  assert.equal(String(ra.output?.narration || ''), String(rb.output?.narration || ''), 'identical narration across two boots');
  assert.equal(String(ra.output?.mechanics || ''), String(rb.output?.mechanics || ''), 'identical mechanics across two boots');
});

test('U487: a canon-empty settlement yields an honest miss, never "no record"/"blocked"', () => {
  const { w, byId } = boot();
  const nid = w.map?.currentNodeId;
  // Empty the node's sociable roster so the seek genuinely has no one to find.
  const wEmpty = {
    ...w,
    map: {
      ...w.map,
      nodes: w.map.nodes.map(n => (n && n.id === nid && n.settlement)
        ? { ...n, settlement: { ...n.settlement, npcs: [] } }
        : n),
    },
  };
  const r = playerMove(wEmpty, byId, UTTER);
  const narr = String(r.output?.narration || '');
  const mech = String(r.output?.mechanics || '');

  assert.doesNotMatch(narr, /no record|not written anywhere|no answer exists/i, 'never a "no record" dodge');
  assert.doesNotMatch(narr, /blocked from here|wall holds/i, 'never a navigation refusal');
  // An honest in-fiction person-search miss — the player looked and found the lane empty.
  assert.match(narr, /lane|empty|shutters?|no one|still/i, 'an honest in-fiction miss about an empty settlement');
  assert.match(mech, /seek-person → none about/i, 'tagged as a person-search miss, not an info decline');
});
