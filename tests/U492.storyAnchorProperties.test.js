// U492 — OCC-STORY-1 story-anchor properties. Placement is no longer a blind hash-scatter: each
// settlement NPC is anchored to a building explained by WHO THEY ARE (role → building kind), the
// anchor is permanently theirs for a given world (seed-stable), hostiles always take a purpose spot at
// the margins (never idle inside an unrelated interior), and EVERY placement carries a short, fixed,
// narratable reason. These are the invariants that make "why is he here?" always answerable. Hermetic
// — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { occupantsOfRoom, outdoorOccupants } from '../engine/structures/roomOccupancy.js';
import { placementFor, drawnBuildings, REASON_TAXONOMY } from '../engine/structures/storyAnchors.js';
import { normalizeTopology } from '../engine/structures/topology.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const nodeNpcs = (w) => (w.map.nodes.find(n => n.id === w.map.currentNodeId)?.settlement?.npcs) || [];
const rooms = (w, sk) => (normalizeTopology(w.structures?.byId?.[sk]?.topology)?.rooms || []).map(r => r.id);
const REASONS = new Set(REASON_TAXONOMY);

// A hand-built town with an inn + a smithy so kind-matching can be exercised directly. No wakeKey.
function kindWorld(hours = 5) {
  const topo = (p) => ({ kind: 'rooms', rooms: [{ id: `${p}:entry`, tags: ['entry'] }, { id: `${p}:back` }], edges: [{ a: `${p}:entry`, b: `${p}:back` }] });
  return {
    meta: { seed: 'anchors' },
    time: { hours },
    map: { currentNodeId: 'town', nodes: [{ id: 'town', settlement: {
      buildings: [{ name: 'inn', state: 'intact' }, { name: 'smithy', state: 'intact' }, { name: 'well', state: 'intact' }],
      npcs: [
        { id: 'smith0', name: 'Bruna', role: 'smith' },
        { id: 'keep0', name: 'Halda', role: 'innkeeper' },
        { id: 'brute0', name: 'Ashblade', role: 'bandit', hostile: true }
      ]
    } }] },
    structures: { byId: {} }
  };
}

test('U492: every placement carries a non-empty reason drawn from the fixed taxonomy', () => {
  const w = boot();
  const wakeSK = w.scene.interior.structureKey;
  const seen = [];
  for (const rid of rooms(w, wakeSK)) seen.push(...occupantsOfRoom(w, wakeSK, rid));
  seen.push(...outdoorOccupants(w));
  // Also cover the raw placementFor for every roster NPC (indoor anchors the player can't enter).
  for (const npc of nodeNpcs(w)) {
    const p = placementFor(w, npc, { nodeId: w.map.currentNodeId, seed: w.meta.seed, wakeKey: wakeSK });
    seen.push({ name: npc.name, reason: p.reason });
  }
  assert.ok(seen.length > 0, 'precondition: someone is placed');
  for (const o of seen) {
    assert.ok(o.reason && o.reason.length > 0, `every occupant needs a reason: ${o.name} has "${o.reason}"`);
    assert.ok(REASONS.has(o.reason), `reason "${o.reason}" (for ${o.name}) must be in the fixed taxonomy`);
  }
});

test('U492: placement is deterministic across two independent boots (same world → same anchors)', () => {
  const a = boot(), b = boot();
  const nodeId = a.map.currentNodeId;
  const skA = a.scene.interior.structureKey, skB = b.scene.interior.structureKey;
  const placeOf = (w, sk) => nodeNpcs(w).map(n => {
    const p = placementFor(w, n, { nodeId, seed: w.meta.seed, wakeKey: sk });
    return `${n.name}:${p.where}:${p.key || '-'}:${p.reason}`;
  });
  assert.deepEqual(placeOf(a, skA), placeOf(b, skB), 'two boots of the same world produce identical placements');
});

test('U492: an NPC anchors to the building KIND their role belongs to when one is drawn', () => {
  const w = kindWorld(5); // daytime
  const buildings = drawnBuildings(w, 'town');
  const innKey = buildings.find(b => b.kind === 'inn')?.key;
  const smithyKey = buildings.find(b => b.kind === 'smithy')?.key;
  assert.ok(innKey && smithyKey, 'precondition: the town drew an inn and a smithy');
  const npcs = w.map.nodes[0].settlement.npcs;
  const smith = npcs.find(n => n.role === 'smith');
  const keeper = npcs.find(n => n.role === 'innkeeper');
  const pSmith = placementFor(w, smith, { nodeId: 'town', seed: w.meta.seed });
  const pKeep = placementFor(w, keeper, { nodeId: 'town', seed: w.meta.seed });
  // Kind-matched → anchored to their kind's building, and (by day, not up-to-something) "at their post".
  assert.equal(pSmith.where === 'building' ? pSmith.key : 'outdoors', smithyKey, `the smith should anchor to the smithy: ${JSON.stringify(pSmith)}`);
  assert.equal(pKeep.where === 'building' ? pKeep.key : 'outdoors', innKey, `the innkeeper should anchor to the inn: ${JSON.stringify(pKeep)}`);
});

test('U492: an NPC\'s anchor is STABLE — the same person keeps the same building across the day', () => {
  // Anchor identity must not drift with the clock. We read the day-phase placements (when folk are AT
  // their anchor) at two different daytime hours and confirm the building key is identical.
  const w1 = kindWorld(4), w2 = kindWorld(8); // both 'day'
  const smith = w1.map.nodes[0].settlement.npcs.find(n => n.role === 'smith');
  const key = (w) => { const p = placementFor(w, smith, { nodeId: 'town', seed: w.meta.seed }); return p.where === 'building' ? p.key : null; };
  const k1 = key(w1), k2 = key(w2);
  // The smith is at their post by day (not up-to-something for these hours); if out, both must still agree.
  if (k1 || k2) assert.equal(k1, k2, 'the anchor building is the same across the day');
});

test('U492: a HOSTILE never idles inside an unrelated interior — always a purpose spot at the edges, outdoors', () => {
  for (const hours of [0, 5, 12, 18]) { // dawn, day, dusk, night
    const w = kindWorld(hours);
    const bandit = w.map.nodes[0].settlement.npcs.find(n => n.hostile);
    const p = placementFor(w, bandit, { nodeId: 'town', seed: w.meta.seed });
    assert.equal(p.where, 'outdoors', `a hostile must be outdoors at hour ${hours}: ${JSON.stringify(p)}`);
    assert.equal(p.reason, 'keeping to the edges', `a hostile's reason is a purpose spot at hour ${hours}: ${p.reason}`);
  }
  // And in the live tallow boot, no hostile is ever inside the wake cottage (the original bug).
  const w = boot();
  const sk = w.scene.interior.structureKey;
  let inside = [];
  for (const rid of rooms(w, sk)) inside = inside.concat(occupantsOfRoom(w, sk, rid));
  assert.equal(inside.filter(n => n && n.hostile).length, 0, 'no hostile is placed in the wake cottage');
});

test('U492: occupancy writes nothing back onto the stored roster (reason is on the returned clone only)', () => {
  const w = boot();
  const before = nodeNpcs(w).map(n => 'reason' in n);
  outdoorOccupants(w); // exercise the read
  const sk = w.scene.interior.structureKey;
  for (const rid of rooms(w, sk)) occupantsOfRoom(w, sk, rid);
  const after = nodeNpcs(w).map(n => 'reason' in n);
  assert.deepEqual(after, before, 'the stored roster NPCs never gain a `reason` field (occupancy is a pure read)');
  assert.ok(after.every(has => has === false), 'no stored roster NPC carries a reason');
});
