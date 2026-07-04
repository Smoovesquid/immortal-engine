// U410 — TT-DRAW placed-token model (docs/TABLETOP_MAP.md, docs/briefs/
// TT-DRAW-tabletop-look.md). The one rule's other half: entities (people,
// livestock, TREES, notable props) are PLACED tokens, never ground ink. This
// locks the token set to the occupancy TRUTH — reusing U398's MAP-OCC-1
// guarantee (no roster-scatter regression: a node the player isn't at draws
// zero people tokens; the current node draws exactly its true outdoor
// occupants) — and confirms trees appear as individually placed tokens rather
// than one grove ellipse of ground paint. Pure + deterministic; no engine
// writes, no Math.random, worldHash unchanged. Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { outdoorOccupants } from '../engine/structures/roomOccupancy.js';
import { placedTokenModel } from '../public/map/drawModel.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// Reuses U398's populated multi-occupant fixture style: a settlement node with a
// real indoor/outdoor NPC split, so the token set can be checked against ground truth.
function fixtureWorld() {
  const npcs = ['Alaric', 'Bryn', 'Cass', 'Dael', 'Elowen', 'Gareth', 'Hale'].map((name, i) => ({ id: 'n' + i, name }));
  return {
    meta: { seed: 'world1' },
    map: {
      currentNodeId: 'home',
      nodes: [{ id: 'home', x: 0, y: 0, nodeType: 'settlement', settlement: { population: 400, npcs, buildings: [{ name: 'smithy' }, { name: 'tavern' }] } }]
    },
    structures: { byId: {
      'home:smithy': { id: 'home:smithy', nodeId: 'home', buildingType: 'smithy' },
      'home:tavern': { id: 'home:tavern', nodeId: 'home', buildingType: 'tavern' }
    } }
  };
}

test('U410-A: the people token set equals true outdoor occupancy exactly — no roster scatter (reuses U398\'s guarantee)', () => {
  const w = fixtureWorld();
  const trueOutdoor = new Set(outdoorOccupants(w).map(n => n.name));
  assert.ok(trueOutdoor.size > 0 && trueOutdoor.size < 7, 'precondition: a real indoor/outdoor split exists');

  const model = placedTokenModel(w, 'home');
  const tokenNames = new Set(model.people.map(p => p.name));
  assert.deepEqual(tokenNames, trueOutdoor, 'placed-token people set must equal true outdoor occupants exactly');
  for (const p of model.people) {
    assert.ok(Number.isFinite(p.wx) && Number.isFinite(p.wy), `person ${p.name} must have finite world coordinates`);
  }
});

test('U410-B: a node the player is NOT at draws zero people tokens (never fabricate, MAP-OCC-1)', () => {
  const npcs = ['Xannon', 'Yorick'].map((name, i) => ({ id: 'x' + i, name }));
  const w = {
    meta: { seed: 'world1' },
    map: {
      currentNodeId: 'home',
      nodes: [
        { id: 'home', x: 0, y: 0, nodeType: 'settlement', settlement: { population: 400, npcs: [{ id: 'h0', name: 'Home Body' }] } },
        { id: 'away', x: 20, y: 20, nodeType: 'settlement', settlement: { population: 400, npcs, buildings: [{ name: 'cottage' }] } }
      ]
    },
    structures: { byId: {} }
  };
  const model = placedTokenModel(w, 'away');
  assert.equal(model.people.length, 0, 'a node the player is not at must draw zero people tokens');
});

test('U410-C: the tallow boot world places trees as individually PLACED tokens, not ground ink', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const model = placedTokenModel(w, nodeId);
  assert.ok(Array.isArray(model.trees), 'trees must be an array of placed tokens');
  assert.ok(model.trees.length > 0, 'precondition: the tallow settlement has at least one grove/tree');
  for (const t of model.trees) {
    assert.ok(Number.isFinite(t.wx) && Number.isFinite(t.wy), 'each tree token must have finite world coordinates');
    assert.ok(Number.isFinite(t.r) && t.r > 0, 'each tree token must carry a positive placement radius');
  }
});

test('U410-D: livestock is never fabricated — with no settlement livestock data, the livestock token list is empty', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const model = placedTokenModel(w, nodeId);
  assert.deepEqual(model.livestock, [], 'no livestock data exists at the settlement-node level today — the model must never invent one');
});

test('U410-E: token layout is a pure seed projection — same seed yields identical tokens, worldHash untouched', () => {
  const w1 = boot();
  const w2 = boot();
  const nodeId1 = String(w1.map.currentNodeId), nodeId2 = String(w2.map.currentNodeId);
  const p1 = placedTokenModel(w1, nodeId1);
  const p2 = placedTokenModel(w2, nodeId2);
  assert.deepEqual(p1, p2, 'the tallow boot world must project an identical placed-token model on replay');

  const w = boot();
  const h0 = worldHash(w);
  placedTokenModel(w, String(w.map.currentNodeId));
  const h1 = worldHash(w);
  assert.equal(h1, h0, 'deriving the placed-token model must never mutate anything worldHash covers');
});

test('U410-F: an unknown node yields empty token lists, never invented content', () => {
  const w = boot();
  const model = placedTokenModel(w, 'a-node-that-does-not-exist');
  assert.deepEqual(model, { nodeId: 'a-node-that-does-not-exist', people: [], trees: [], livestock: [] });
});
